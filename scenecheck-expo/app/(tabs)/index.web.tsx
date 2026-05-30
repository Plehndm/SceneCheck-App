// Web-only Home — two-column desktop layout. Replaces the Wave A
// placeholder with the real shell-aware Home that the design's `WHome`
// implements: an interactive map on the left (~62%) plus a scrollable
// event-list column on the right (~38%, 408 px at the 1440 stage). A
// small people-carousel sits underneath the right list so "find your
// people" still has a home in the desktop flow without stealing the
// map's vertical space.
//
// Mock-mode short-circuit: `useEvents` returns `SC_EVENTS` synchronously
// when Supabase env vars aren't set, so this component renders the
// fixture list on first paint — no flicker.
//
// Wired data:
//   • `useEvents({lat,lng,radiusM})` → POST /rpc/rank_events_query
//     (lib/api.ts → atomic PostGIS distance + interest scoring). The
//     filter chips (All/Yours/Friends/For You) and distance pill are
//     client cuts over that set; radius writes back to the persisted
//     store so the Map tab and Settings stay in sync.
//   • `useLocation()` → browser Geolocation (web). Defers to a user
//     gesture; falls back to UCI when denied.
//   • `useSearchPeople('')` → people-with-shared-interests carousel.
//   • Join taps go through the store's optimistic flow + api.subscribe
//     ToEvent — same as native Home.

import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useEvents } from '@/hooks/useEvents';
import { useLocation } from '@/hooks/useLocation';
import { useSearchPeople } from '@/hooks/useSearch';
import { useDateCityLabel } from '@/hooks/useDateCityLabel';
import { useOnline } from '@/web/useOnline';
import { api } from '@/lib/api';
import { MILES_TO_METERS } from '@/lib/units';
import { excludeSelf } from '@/lib/people';
import { wIsRecommended } from '@/web/kind';
import { WebMap } from '@/web/WebMap';
import { WebEventListCard } from '@/web/WebEventListCard';
import { WebSearchAutocomplete } from '@/web/WebSearchAutocomplete';
import { WebAvatar } from '@/web/WebAvatar';
import { WebIcon } from '@/web/WebIcon';
import { WebTip } from '@/web/WebTip';
import type { SCEvent } from '@/types/domain';

type KindFilter = 'all' | 'yours' | 'friend' | 'recommended';
const DISTANCES = [1, 3, 5, 10, 25, 50] as const;
const RIGHT_COL_W = 408;

export default function HomeWeb() {
  const t = useTokens();

  // ── store / network ─────────────────────────────────────
  const joined = useStore(s => s.joined);
  const pendingLeave = useStore(s => s.pendingLeave);
  const subscribedInterests = useStore(s => s.subscribedInterests);
  const meId = useStore(s => s.me.id);
  const joinEventStore = useStore(s => s.joinEvent);
  const schedulePendingLeave = useStore(s => s.schedulePendingLeave);
  const cancelPendingLeave = useStore(s => s.cancelPendingLeave);
  const showToast = useStore(s => s.showToast);
  const radius = useStore(s => s.radius);
  const setRadius = useStore(s => s.setRadius);
  // `tweaks` carries the offline-mode toggle and the map's rich-pin-hover
  // preference (Settings → Appearance → Map). Read defensively in case the
  // slice is undefined during a store-shape migration.
  const tweaks = useStore(s => s.tweaks);

  const { coords } = useLocation();
  const dateCityLabel = useDateCityLabel(coords, 'granted');
  const radiusM = Math.round(radius * MILES_TO_METERS);
  const { events, loading } = useEvents({
    lat: coords?.latitude,
    lng: coords?.longitude,
    radiusM,
  });
  const { results: peopleResults } = useSearchPeople('');
  const peopleNearby = excludeSelf(peopleResults, meId).slice(0, 4);
  const online = useOnline() && !(tweaks?.offline ?? false);

  // The set the join button uses is `joined - pendingLeave` so a 5-second
  // "undo leave" doesn't visually re-add the row.
  const effectiveJoined = useMemo(() => {
    const s = new Set(joined);
    pendingLeave.forEach(id => s.delete(id));
    return s;
  }, [joined, pendingLeave]);

  // ── filter chip + hover sync ────────────────────────────
  const [filter, setFilter] = useState<KindFilter>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isPresetDist = (DISTANCES as readonly number[]).includes(radius);
  const distLabel = !isPresetDist
    ? `Custom · ${radius} mi`
    : radius >= 50
      ? 'Any distance'
      : `${radius} mi`;
  const filterActive = filter !== 'all' || radius < 10;

  const counts = useMemo(() => ({
    all: events.length,
    yours: events.filter(e => e.kind === 'yours').length,
    friend: events.filter(e => e.kind === 'friend').length,
    recommended: events.filter(e => wIsRecommended(e, subscribedInterests)).length,
  }), [events, subscribedInterests]);

  const listEvents = useMemo(() => events.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'recommended') return wIsRecommended(e, subscribedInterests);
    return e.kind === filter;
  }), [events, filter, subscribedInterests]);

  // ── join (optimistic + commit), matches the event detail flow ──
  const onJoin = useCallback(async (id: string) => {
    const e = events.find(x => x.id === id);
    if (!e) return;
    const isJoined = effectiveJoined.has(id);
    if (isJoined) {
      schedulePendingLeave(id);
      showToast({
        message: `Left "${e.title}". Removing in 5s.`,
        kind: 'info',
        duration: 5200,
        action: { label: 'UNDO', onPress: () => cancelPendingLeave(id) },
      });
      try {
        await api.cancelSubscription(id);
      } catch (err) {
        showToast({
          message: err instanceof Error ? `Couldn't leave: ${err.message}` : "Couldn't leave.",
          kind: 'error',
        });
      }
    } else {
      joinEventStore(id);
      showToast({ message: `Joined "${e.title}".`, kind: 'success' });
      try {
        await api.subscribeToEvent(id, true);
      } catch (err) {
        showToast({
          message: err instanceof Error ? `Couldn't join: ${err.message}` : "Couldn't join.",
          kind: 'error',
        });
      }
    }
  }, [events, effectiveJoined, schedulePendingLeave, cancelPendingLeave, showToast, joinEventStore]);

  const goEvent = useCallback((id: string) => {
    router.push(`/event/${id}` as never);
  }, []);

  return (
    // `position: absolute; inset: 0` so the home layout fills its
    // positioned WebShell ancestor regardless of any intermediate
    // react-native-web View that might collapse during route transitions
    // (same fix as map.web.tsx — `height: 100%` was working in the steady
    // state but flaking on first mount and after the rail expanded).
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        minHeight: 0,
        background: t.surface,
        color: t.ink,
        fontFamily: FONT.body,
      }}
    >
      {/* ───────── MAP COLUMN (left) ───────── */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <WebMap
            events={listEvents}
            you={coords ?? null}
            activeId={hoveredId}
            onActive={setHoveredId}
            onOpen={goEvent}
            joinedSet={effectiveJoined}
            onJoin={onJoin}
            richHover={tweaks?.richPinHover ?? true}
            online={online}
            radiusM={radiusM}
          />

          {/* floating search bar (top center) */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 16,
              transform: 'translateX(-50%)',
              width: 'min(500px, 64%)',
              zIndex: 45,
            }}
          >
            <WebSearchAutocomplete
              events={events}
              onPick={goEvent}
              onSearch={(q) => router.push(`/search?q=${encodeURIComponent(q)}` as never)}
              width="100%"
              trailing={
                <WebTip title="Filters" desc="Type, distance & who's hosting" side="bottom">
                  <button
                    onClick={() => setFiltersOpen(o => !o)}
                    style={{
                      position: 'relative',
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: `1px solid ${filtersOpen || filterActive ? t.ink : t.line}`,
                      background: filtersOpen ? t.ink : t.card,
                      color: filtersOpen ? t.card : t.ink,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <WebIcon name="sliders" size={16} />
                    {filterActive && !filtersOpen && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -3,
                          right: -3,
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: t.primary,
                          border: `2px solid ${t.card}`,
                        }}
                      />
                    )}
                  </button>
                </WebTip>
              }
            />

            {/* filters popover */}
            {filtersOpen && (
              <FiltersPopover
                filter={filter}
                setFilter={setFilter}
                radius={radius}
                setRadius={setRadius}
                counts={counts}
                listLen={listEvents.length}
                onReset={() => {
                  setFilter('all');
                  setRadius(10);
                }}
                onClose={() => setFiltersOpen(false)}
                distLabel={distLabel}
                isPresetDist={isPresetDist}
              />
            )}
          </div>
        </div>

        {/* People carousel — sits beneath the map, full-width of the left column */}
        <PeopleCarousel people={peopleNearby} />
      </div>

      {/* ───────── RIGHT LIST COLUMN ───────── */}
      <div
        style={{
          width: RIGHT_COL_W,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          borderLeft: `1px solid ${t.line}`,
          background: t.surface,
        }}
      >
        <div
          style={{
            padding: '22px 20px 10px',
            position: 'sticky',
            top: 0,
            zIndex: 5,
            background: `linear-gradient(${t.surface} 78%, transparent)`,
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: '0.16em',
              fontWeight: 600,
              color: t.ink3,
              textTransform: 'uppercase',
            }}
          >
            {dateCityLabel}
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 32,
              fontWeight: 800,
              fontStretch: '85%',
              lineHeight: 0.95,
              margin: '4px 0 14px',
              letterSpacing: '-0.04em',
              color: t.ink,
            }}
          >
            What&apos;s the scene?
          </div>
          <KindFilterChips filter={filter} setFilter={setFilter} counts={counts} />
        </div>

        <div
          style={{
            padding: '6px 20px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: '0.16em',
              fontWeight: 600,
              color: t.ink3,
              textTransform: 'uppercase',
            }}
          >
            Happening near you
          </div>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink3 }}>
            {listEvents.length} shown · {!isPresetDist
              ? `custom ${radius}mi`
              : radius >= 50
                ? 'any dist'
                : `${radius} mi`}
          </span>
        </div>
        <div style={{ padding: '6px 20px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {listEvents.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                border: `1px dashed ${t.line}`,
                borderRadius: 16,
                color: t.ink3,
              }}
            >
              <div
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: 16,
                  color: t.ink2,
                  marginBottom: 4,
                }}
              >
                {loading ? 'Loading events…' : 'Nothing here'}
              </div>
              <div style={{ fontSize: 12.5 }}>Try a different filter or search.</div>
            </div>
          ) : (
            listEvents.map(e => (
              <WebEventListCard
                key={e.id}
                event={e}
                joined={effectiveJoined.has(e.id)}
                active={hoveredId === e.id}
                onOpen={goEvent}
                onJoin={onJoin}
                onHover={setHoveredId}
              />
            ))
          )}
        </div>

        {/* Shared-interest people list */}
        <div
          style={{
            padding: '14px 20px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: '0.16em',
              fontWeight: 600,
              color: t.ink3,
              textTransform: 'uppercase',
            }}
          >
            People with shared interests
          </div>
          <button
            onClick={() => router.push('/search' as never)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT.mono,
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: t.ink3,
            }}
          >
            SEE ALL →
          </button>
        </div>
        {/* Bottom padding kept minimal so the right column doesn't grow
            a visible whitespace tail under the people list — the
            scrollable area handles any overflow itself. */}
        <div style={{ padding: '4px 20px 8px' }}>
          <div
            style={{
              background: t.card,
              border: `1px solid ${t.line}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {peopleNearby.length === 0 ? (
              <div style={{ padding: 14, color: t.ink3, fontSize: 12 }}>No people nearby yet.</div>
            ) : (
              peopleNearby.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/profile/${p.id}` as never)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 14px',
                    cursor: 'pointer',
                    borderTop: i === 0 ? 'none' : `1px solid ${t.line}`,
                  }}
                >
                  <WebAvatar person={p} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: FONT.display,
                        fontWeight: 700,
                        fontSize: 14.5,
                        letterSpacing: '-0.02em',
                        color: t.ink,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10.5,
                        color: t.ink3,
                      }}
                    >
                      @{p.username} · {p.mutual ?? 0} mutual
                    </div>
                  </div>
                  <WebIcon name="chevron-right" size={16} color={t.ink3} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Filter chip row (top of the right column) ──────────────────
function KindFilterChips({
  filter,
  setFilter,
  counts,
}: {
  filter: KindFilter;
  setFilter: (k: KindFilter) => void;
  counts: Record<KindFilter, number>;
}) {
  const t = useTokens();
  const chips: { k: KindFilter; label: string }[] = [
    { k: 'all', label: `All · ${counts.all}` },
    { k: 'yours', label: `Yours · ${counts.yours}` },
    { k: 'friend', label: `Friends · ${counts.friend}` },
    { k: 'recommended', label: `For you · ${counts.recommended}` },
  ];
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {chips.map(c => {
        const on = filter === c.k;
        return (
          <button
            key={c.k}
            onClick={() => setFilter(c.k)}
            style={{
              padding: '7px 13px',
              borderRadius: 999,
              cursor: 'pointer',
              background: on ? t.ink : t.card,
              color: on ? t.card : t.ink2,
              border: `1px solid ${on ? t.ink : t.line}`,
              fontFamily: FONT.mono,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Filters popover (hangs off the search bar's sliders button) ──
function FiltersPopover({
  filter,
  setFilter,
  radius,
  setRadius,
  counts,
  listLen,
  onReset,
  onClose,
  distLabel,
  isPresetDist,
}: {
  filter: KindFilter;
  setFilter: (k: KindFilter) => void;
  radius: number;
  setRadius: (r: number) => void;
  counts: Record<KindFilter, number>;
  listLen: number;
  onReset: () => void;
  onClose: () => void;
  distLabel: string;
  isPresetDist: boolean;
}) {
  const t = useTokens();
  const labelCap: React.CSSProperties = {
    fontFamily: FONT.mono,
    fontSize: 11,
    letterSpacing: '0.16em',
    fontWeight: 600,
    color: t.ink3,
    textTransform: 'uppercase',
  };
  const opts: { k: KindFilter; label: string; icon: 'globe' | 'star' | 'users' | 'sparkles' }[] = [
    { k: 'all', label: 'All events', icon: 'globe' },
    { k: 'yours', label: 'Yours', icon: 'star' },
    { k: 'friend', label: 'Friends', icon: 'users' },
    { k: 'recommended', label: 'For you', icon: 'sparkles' },
  ];
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 44 }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 56,
          width: 326,
          zIndex: 47,
          background: t.card,
          border: `1px solid ${t.line}`,
          borderRadius: 16,
          boxShadow: '0 28px 60px -18px rgba(0,0,0,0.45)',
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={labelCap}>Show me</div>
          <button
            onClick={onReset}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT.mono,
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: t.ink3,
            }}
          >
            RESET
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 18 }}>
          {opts.map(o => {
            const on = filter === o.k;
            return (
              <button
                key={o.k}
                onClick={() => setFilter(o.k)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: on ? t.ink : t.surface,
                  color: on ? t.card : t.ink,
                  border: `1px solid ${on ? t.ink : t.line}`,
                }}
              >
                <WebIcon name={o.icon} size={15} />
                <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 600 }}>
                  {o.label}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    opacity: 0.6,
                  }}
                >
                  {counts[o.k]}
                </span>
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={labelCap}>Within distance</div>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: !isPresetDist ? t.primary : t.ink3,
              fontWeight: !isPresetDist ? 700 : 500,
            }}
          >
            {distLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {DISTANCES.map(d => {
            const on = radius === d;
            return (
              <button
                key={d}
                onClick={() => setRadius(d)}
                style={{
                  flex: 1,
                  padding: '9px 3px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: on ? t.primary : t.surface,
                  color: on ? t.primaryInk : t.ink2,
                  border: `1px solid ${on ? t.primary : t.line}`,
                  fontFamily: FONT.mono,
                  fontSize: 10.5,
                  fontWeight: 600,
                }}
              >
                {d >= 50 ? 'Any' : `${d}mi`}
              </button>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 13,
            paddingTop: 12,
            borderTop: `1px solid ${t.line}`,
            fontFamily: FONT.mono,
            fontSize: 10,
            color: t.ink3,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <WebIcon name="crosshair" size={12} /> {listLen} events in range · syncs with Settings
        </div>
      </div>
    </>
  );
}

// ── People carousel (bottom of the left/map column) ────────────
function PeopleCarousel({ people }: { people: ReturnType<typeof useSearchPeople>['results'] }) {
  const t = useTokens();
  if (!people.length) return null;
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '12px 18px 14px',
        borderTop: `1px solid ${t.line}`,
        background: `color-mix(in oklab, ${t.surface} 92%, transparent)`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: '0.16em',
            fontWeight: 600,
            color: t.ink3,
            textTransform: 'uppercase',
          }}
        >
          People with shared interests
        </div>
        <button
          onClick={() => router.push('/search' as never)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: FONT.mono,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: t.ink3,
          }}
        >
          SEE ALL →
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {people.map(p => (
          <button
            key={p.id}
            onClick={() => router.push(`/profile/${p.id}` as never)}
            style={{
              flexShrink: 0,
              width: 168,
              background: t.card,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: t.ink,
              textAlign: 'left',
            }}
          >
            <WebAvatar person={p} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: 13.5,
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  color: t.ink3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                @{p.username}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
