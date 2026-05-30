// WebMap — desktop-class interactive map with rich pin hover cards,
// pan/zoom controls, a "you are here" pulse, a live LIVE/OFFLINE chip,
// and a colour-legend. Used by the Home two-column layout (left pane)
// and the full-screen `/map` route.
//
// Composition strategy — this component wraps the existing
// `components/Map/Map.web.tsx` (react-leaflet, OSM tiles) so we keep a
// single tile renderer across native and web and don't duplicate the
// leaflet wiring. The Wave A map already accepts events + pin tap; we
// layer the desktop chrome on top:
//
//   • Custom DOM overlays for every event pin so we get teardrop pins
//     with the same colour-coding the legacy `WMap` used (yours = ★,
//     joined = ✓, otherwise a dot), the same scale-on-hover animation,
//     and the rich hover card. Leaflet's own CircleMarker stays
//     visible too as a fall-back tap target.
//   • A "you are here" pulse over the user's coords (when available).
//   • Bottom-right pan/zoom/recenter controls that drive Leaflet's
//     map instance imperatively (zoomIn/zoomOut/setView).
//   • Bottom-left LIVE/OFFLINE + legend chip group.
//   • A hover card layer with smart left/right flip based on which
//     side of the viewport the pin sits.
//
// Backend wiring — none directly. The `events` prop is expected to
// already be the result of `useEvents({lat,lng,radiusM})` which wraps
// the `rank_events_query` RPC; we pass `joinedSet` + `onJoin` /
// `onOpen` so the JOIN button in the hover card and the pin-tap can
// trigger the screen's own optimistic-commit flow. Pin tap →
// `onOpen(id)` so the parent navigates to `/event/[id]` (a Wave B3
// slide-over).
//
// Hover modes: `richHover=true` renders the full WMapHoverCard. When
// false (driven by `useStore().tweaks?.richPinHover` in Settings) it
// renders a compact WMapMiniTip, which has no JOIN button. The mini
// tip never gets pointer events — it's purely informational.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { eventLatLng } from '@/components/Map/types';
import type { SCEvent } from '@/types/domain';
import { useStore } from '@/store/useStore';
import { whenRange } from '@/lib/date-time';
import { wHostAccount, wKindMeta } from './kind';
import { WebAvatar } from './WebAvatar';
import { WebCapBar } from './WebCapBar';
import { WebIcon } from './WebIcon';
import { WebJoinButton } from './WebJoinButton';
import { WebStars } from './WebStars';
import { WebTag } from './WebTag';
import { WebTip } from './WebTip';

// Leaflet ships its CSS in `Map.web.impl.tsx` already. The map
// implementation is loaded lazily client-only so we keep the same
// SSR-safe pattern by importing react-leaflet bits dynamically.

type LatLngLike = { latitude: number; longitude: number };

export interface WebMapProps {
  events: SCEvent[];
  you?: LatLngLike | null;
  /** Currently-hovered event id (sync with the list). */
  activeId?: string | null;
  /** Called when hover or list-driven activeId changes. */
  onActive?: (id: string | null) => void;
  /** Called when a pin or hover card "open" affordance is clicked. */
  onOpen?: (id: string) => void;
  /** Joined event ids — used to swap the pin glyph and JOIN→JOINED. */
  joinedSet: Set<string>;
  /** Called when the JOIN button in the hover card is clicked. */
  onJoin?: (id: string) => void;
  /** When true, render the full hover card; when false, a compact tip. */
  richHover?: boolean;
  /** True when the device is online and Realtime is healthy. */
  online?: boolean;
  /** Height of the wrapper. Defaults to 100% so the parent controls it. */
  height?: number | string;
  /** Initial discovery radius circle (meters); also used to pick the zoom. */
  radiusM?: number;
  style?: CSSProperties;
}

// The colour map for the leaflet backdrop tiles — pulled out so the
// implementation can theme the leaflet tile layer. (For now we keep the
// OpenStreetMap tiles; the styled backdrop is overlaid as a faint
// gradient to nudge the palette toward the SceneCheck tokens without
// re-rendering custom tiles.)

export function WebMap({
  events,
  you,
  activeId,
  onActive,
  onOpen,
  joinedSet,
  onJoin,
  richHover = true,
  online = true,
  height = '100%',
  radiusM,
  style,
}: WebMapProps) {
  const t = useTokens();
  const subscribedInterests = useStore(s => s.subscribedInterests);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The leaflet wrapper is loaded after mount so its `window`-touching
  // code never runs during SSR. Keeping it lazy here also lets us reach
  // into the leaflet instance via the `whenReady` ref to drive zoom +
  // pan controls from our own buttons.
  const [Leaflet, setLeaflet] = useState<typeof import('react-leaflet') | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('react-leaflet'),
      // `leaflet/dist/leaflet.css` is already loaded by Map.web.impl,
      // but it's idempotent so loading it here too is fine for the
      // standalone case where this component is used outside the home
      // tab (Wave B1 callers always render alongside the leaflet
      // implementation anyway).
      import('leaflet/dist/leaflet.css'),
    ])
      .then(([rl]) => { if (!cancelled) setLeaflet(rl); })
      .catch(() => { /* SSR / network — render the chrome without tiles */ });
    return () => { cancelled = true; };
  }, []);

  // ResizeObserver to keep pin overlay coordinates aligned.
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Center the map on `you` (or the UCI fall-back when nothing else).
  const center = useMemo(() => {
    if (you) return [you.latitude, you.longitude] as [number, number];
    return [33.6461, -117.8427] as [number, number];
  }, [you]);

  // Pin pixel positions are recomputed every render off the leaflet
  // projection so they pan/zoom in lockstep with the tiles. We trigger
  // a re-render on map move via a counter so the projection lookups
  // stay live.
  const [, bumpProj] = useState(0);
  useEffect(() => {
    if (!Leaflet || !mapRef.current) return;
    const m = mapRef.current;
    const tick = () => bumpProj(n => n + 1);
    m.on('move zoom moveend zoomend resize', tick);
    return () => { m.off('move zoom moveend zoomend resize', tick); };
  }, [Leaflet]);

  // Compute pin (x,y) by projecting the event's lat/lng to container
  // pixel space. When the map isn't ready yet we fall back to the
  // normalized x/y fixture coords scaled to the container, so the demo
  // pins still appear before tiles load.
  const project = useCallback((e: SCEvent) => {
    const ll = eventLatLng(e);
    if (mapRef.current) {
      try {
        const p = mapRef.current.latLngToContainerPoint([ll.latitude, ll.longitude]);
        return { x: p.x, y: p.y, real: true };
      } catch {
        // ignore: fall through to fixture x/y
      }
    }
    return { x: e.x * box.w, y: e.y * box.h, real: false };
  }, [box.w, box.h]);

  const projectLatLng = useCallback((lat: number, lng: number) => {
    if (mapRef.current) {
      try {
        const p = mapRef.current.latLngToContainerPoint([lat, lng]);
        return { x: p.x, y: p.y };
      } catch {
        // ignore
      }
    }
    return null;
  }, []);

  const openHover = useCallback((id: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverId(id);
    onActive?.(id);
  }, [onActive]);

  const closeHoverSoon = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setHoverId(null);
      onActive?.(null);
    }, 120);
  }, [onActive]);

  const shownId = hoverId || activeId || null;
  const shown = shownId ? events.find(e => e.id === shownId) ?? null : null;

  // Card placement: prefer right of the pin, flip left if too close to
  // the right edge. Top is biased upward by 60px so the card visually
  // sits next to the teardrop rather than below it.
  const CARD_W = 318;
  const CARD_H = 360;
  let cardLeft = 0;
  let cardTop = 0;
  if (shown) {
    const p = project(shown);
    const place = p.x > box.w - CARD_W - 40 ? 'left' : 'right';
    cardLeft = place === 'right' ? p.x + 22 : p.x - CARD_W - 22;
    cardTop = Math.max(14, Math.min(Math.max(14, box.h - CARD_H - 14), p.y - 60));
  }

  // ── Zoom + recenter controls (drive leaflet's map instance) ──
  const zoomIn = useCallback(() => { mapRef.current?.zoomIn(); }, []);
  const zoomOut = useCallback(() => { mapRef.current?.zoomOut(); }, []);
  const recenter = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    m.setView(center, 13);
  }, [center]);

  const youPx = you ? projectLatLng(you.latitude, you.longitude) : null;

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        background: t.mapLand,
        ...style,
      }}
    >
      {/* Leaflet tile layer (loaded after mount) */}
      {Leaflet && (
        <Leaflet.MapContainer
          center={center}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom
          dragging
          doubleClickZoom
          touchZoom
          boxZoom
          keyboard
          zoomControl={false}
          ref={(instance: import('leaflet').Map | null) => { mapRef.current = instance; }}
        >
          <Leaflet.TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {you && (
            <Leaflet.Circle
              center={[you.latitude, you.longitude]}
              radius={radiusM ?? 8000}
              pathOptions={{
                color: t.accentBlue,
                fillColor: t.accentBlue,
                fillOpacity: 0.08,
                weight: 1,
              }}
            />
          )}
        </Leaflet.MapContainer>
      )}

      {/* "you are here" pulse */}
      {youPx && (
        <div
          style={{
            position: 'absolute',
            left: youPx.x,
            top: youPx.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: 44, height: 44,
              marginLeft: -22, marginTop: -22,
              borderRadius: '50%',
              background: t.accentBlue,
              opacity: 0.18,
              animation: 'webmap-pulse 1.8s ease-out infinite',
            }}
          />
          <div
            style={{
              width: 20, height: 20, borderRadius: '50%',
              background: t.accentBlue,
              border: '4px solid white',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      )}

      {/* Pin overlay layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {events.map(e => {
          const { accent } = wKindMeta(e, t, subscribedInterests);
          const isActive = shownId === e.id;
          const joined = joinedSet.has(e.id);
          const p = project(e);
          // Hide if off-screen by a wide margin (keeps the overlay light).
          if (p.x < -60 || p.x > box.w + 60 || p.y < -60 || p.y > box.h + 60) return null;
          return (
            <div
              key={e.id}
              data-pin
              onMouseEnter={() => openHover(e.id)}
              onMouseLeave={closeHoverSoon}
              onClick={(ev) => { ev.stopPropagation(); onOpen?.(e.id); }}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                transform: 'translate(-50%, -100%)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: isActive ? 30 : 10,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transition: 'transform 140ms ease',
                  transform: isActive ? 'scale(1.14)' : 'scale(1)',
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 2,
                      width: 40, height: 40,
                      borderRadius: '50%',
                      background: accent,
                      opacity: 0.22,
                      animation: 'webmap-pulse 1.8s ease-out infinite',
                    }}
                  />
                )}
                <div
                  style={{
                    width: 30, height: 30,
                    borderRadius: '50% 50% 50% 0',
                    transform: 'rotate(-45deg)',
                    background: accent,
                    border: '3px solid white',
                    boxShadow: isActive
                      ? '0 8px 18px -4px rgba(0,0,0,0.4)'
                      : '0 4px 10px -2px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ transform: 'rotate(45deg)', color: 'white', display: 'flex' }}>
                    {e.kind === 'yours' ? (
                      <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 13 }}>★</span>
                    ) : joined ? (
                      <WebIcon name="check" size={14} strokeWidth={3} />
                    ) : (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hover card layer */}
      {shown && (
        <div
          data-card
          onMouseEnter={() => openHover(shown.id)}
          onMouseLeave={closeHoverSoon}
          style={{
            position: 'absolute',
            left: richHover ? cardLeft : Math.max(8, project(shown).x - 110),
            top: richHover ? cardTop : Math.max(12, project(shown).y - 96),
            zIndex: 50,
            pointerEvents: richHover ? 'auto' : 'none',
          }}
        >
          {richHover ? (
            <WebMapHoverCard
              event={shown}
              joined={joinedSet.has(shown.id)}
              onJoin={() => onJoin?.(shown.id)}
              onOpen={() => onOpen?.(shown.id)}
            />
          ) : (
            <WebMapMiniTip event={shown} />
          )}
        </div>
      )}

      {/* Zoom + recenter controls (bottom-right) */}
      <div
        data-ctrl
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 60,
        }}
      >
        <WebTip title="Zoom in" side="left">
          <button onClick={zoomIn} style={ctrlBtnStyle(t)}>
            <WebIcon name="zoom-in" size={18} />
          </button>
        </WebTip>
        <WebTip title="Zoom out" side="left">
          <button onClick={zoomOut} style={ctrlBtnStyle(t)}>
            <WebIcon name="zoom-out" size={18} />
          </button>
        </WebTip>
        <WebTip title="Recenter" desc="Back to your location" side="left">
          <button onClick={recenter} style={ctrlBtnStyle(t)}>
            <WebIcon name="crosshair" size={18} />
          </button>
        </WebTip>
      </div>

      {/* LIVE/OFFLINE chip + legend (bottom-left) */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          display: 'flex',
          alignItems: 'stretch',
          background: `color-mix(in oklab, ${t.card} 88%, transparent)`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 14,
          border: `1px solid ${t.line}`,
          boxShadow: '0 8px 22px -12px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          zIndex: 60,
        }}
      >
        <WebTip
          title={online ? 'Connected' : 'No connection'}
          desc={online ? 'Live — events update in real time' : 'Offline — showing the last cached events'}
          side="top"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '9px 14px',
              height: '100%',
              background: online ? 'transparent' : `color-mix(in oklab, ${t.warn} 20%, transparent)`,
            }}
          >
            <span style={{ position: 'relative', display: 'flex', width: 9, height: 9 }}>
              {online && (
                <span
                  style={{
                    position: 'absolute',
                    left: -3, top: -3,
                    width: 15, height: 15,
                    borderRadius: '50%',
                    background: t.good,
                    opacity: 0.5,
                    animation: 'webmap-pulse 1.8s ease-out infinite',
                  }}
                />
              )}
              <span
                style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: online ? t.good : '#D6452F',
                  boxShadow: online ? 'none' : '0 0 8px rgba(214,69,47,0.6)',
                }}
              />
            </span>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                letterSpacing: '0.1em',
                fontWeight: 600,
                color: online ? t.ink : '#B83A28',
                whiteSpace: 'nowrap',
              }}
            >
              {online ? `LIVE · ${events.length} NEARBY` : 'OFFLINE · RECONNECTING…'}
            </span>
          </div>
        </WebTip>
        <div style={{ width: 1, background: t.line }} />
        <div style={{ display: 'flex', gap: 13, alignItems: 'center', padding: '9px 14px' }}>
          <WebLegendDot color={t.primary} label="Yours" />
          <WebLegendDot color={t.accentFriend} label="Friends" />
          <WebLegendDot color={t.accentBlue} label="For you" />
          <WebLegendDot color={t.mapPinMute} label="Other" />
        </div>
      </div>

      {/* Pulse keyframes — scoped to this component, injected once. */}
      <style>{`
        @keyframes webmap-pulse {
          0% { transform: scale(0.85); opacity: 0.55; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function ctrlBtnStyle(t: ReturnType<typeof useTokens>): CSSProperties {
  return {
    width: 42, height: 42, borderRadius: 12,
    border: `1px solid ${t.line}`,
    background: t.card,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: t.ink,
    boxShadow: '0 8px 22px -12px rgba(0,0,0,0.35)',
  };
}

// ── Rich pin-hover card (port of WMapHoverCard) ────────────────
interface WebMapHoverCardProps {
  event: SCEvent;
  joined: boolean;
  onJoin: () => void;
  onOpen: () => void;
}

export function WebMapHoverCard({ event, joined, onJoin, onOpen }: WebMapHoverCardProps) {
  const t = useTokens();
  const subscribedInterests = useStore(s => s.subscribedInterests);
  const { accent, label } = wKindMeta(event, t, subscribedInterests);
  // No batched profile fetch is plumbed through the map yet; empty
  // lookup means the host row only renders for callers that later
  // seed `wHostAccount` with a real map.
  const host = wHostAccount(event, {});
  return (
    <div
      style={{
        width: 318,
        background: t.card,
        border: `1px solid ${t.line}`,
        borderRadius: 18,
        boxShadow: '0 24px 60px -18px rgba(0,0,0,0.42)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 5, background: accent }} />
      <div style={{ padding: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              letterSpacing: '0.16em',
              fontWeight: 600,
              color: accent,
            }}
          >
            {label}
          </span>
          {joined && (
            <span
              style={{
                marginLeft: 'auto',
                background: t.good,
                color: 'white',
                fontFamily: FONT.mono,
                fontSize: 9,
                letterSpacing: '0.12em',
                fontWeight: 600,
                padding: '3px 7px',
                borderRadius: 999,
              }}
            >
              JOINED
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 19,
            fontWeight: 700,
            lineHeight: 1.12,
            marginBottom: 10,
            letterSpacing: '-0.02em',
            color: t.ink,
          }}
        >
          {event.title}
        </div>

        {host && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <WebAvatar person={host} size={26} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.1, color: t.ink }}>
                {host.name}
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  color: t.ink3,
                  letterSpacing: '0.04em',
                }}
              >
                {host.handle || 'hosting'}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 11 }}>
          <Fact icon="clock" text={whenRange(event)} />
          <Fact icon="pin" text={event.where} />
        </div>

        {event.desc && (
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 12.5,
              lineHeight: 1.45,
              color: t.ink2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}
          >
            {event.desc}
          </p>
        )}

        <div style={{ marginBottom: 12 }}>
          <WebCapBar attendees={event.attendees} cap={event.cap} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          {(event.interests || []).map(tag => (
            <WebTag key={tag} tag={tag} size="sm" tone="soft" />
          ))}
          {event.rating != null && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
              <WebStars value={event.rating} size={12} />
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <WebJoinButton
            joined={joined}
            onToggle={(e) => { e.stopPropagation(); onJoin(); }}
            size="md"
            full
            label={event.kind === 'yours' ? 'MANAGE' : 'JOIN EVENT'}
          />
          <WebTip title="Open event" desc="Full details, attendees & chat" side="top">
            <button
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              style={{
                width: 42, height: 42, flexShrink: 0, borderRadius: 12,
                border: `1px solid ${t.line}`, background: t.card,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: t.ink,
              }}
            >
              <WebIcon name="arrow-up-right" size={17} />
            </button>
          </WebTip>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, text }: { icon: 'clock' | 'pin'; text: string }) {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: t.ink2 }}>
      <WebIcon name={icon} size={14} color={t.ink3} /> {text}
    </div>
  );
}

// ── Compact tooltip (port of WMapMiniTip) ──────────────────────
function WebMapMiniTip({ event }: { event: SCEvent }) {
  const t = useTokens();
  const subscribedInterests = useStore(s => s.subscribedInterests);
  const { accent, label } = wKindMeta(event, t, subscribedInterests);
  return (
    <div
      style={{
        width: 220,
        background: t.card,
        border: `1px solid ${t.line}`,
        borderRadius: 12,
        boxShadow: '0 16px 40px -14px rgba(0,0,0,0.38)',
        padding: 12,
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            letterSpacing: '0.15em',
            fontWeight: 600,
            color: accent,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 14.5,
          fontWeight: 700,
          lineHeight: 1.15,
          marginBottom: 4,
          color: t.ink,
          letterSpacing: '-0.02em',
        }}
      >
        {event.title}
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 10, color: t.ink3 }}>
        {whenRange(event)} · {event.where}
      </div>
    </div>
  );
}

function WebLegendDot({ color, label }: { color: string; label: string }) {
  const t = useTokens();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: FONT.mono,
        fontSize: 11,
        color: t.ink2,
        letterSpacing: '0.04em',
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}
