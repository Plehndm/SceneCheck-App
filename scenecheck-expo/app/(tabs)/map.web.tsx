// Web-only Map tab — full-width variant of the WebMap. Same chrome
// (floating search, filter popover, LIVE chip, legend, zoom controls)
// as the Home left-pane map, just without the right-side event list.
//
// We reuse the WebMap + WebSearchAutocomplete components so the two
// surfaces never drift; the only difference is the absence of the
// right-side list and the people carousel. Pin tap → /event/[id]
// (Wave B3 slide-over). Filters write back to the persisted store so
// the Home tab + Settings + Map agree on radius and the recommended
// chip stays in sync with `subscribedInterests`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useEvents } from '@/hooks/useEvents';
import { useOptimisticAttendees } from '@/hooks/useOptimisticAttendees';
import { useLocation } from '@/hooks/useLocation';
import { eventLatLng, type LatLng } from '@/components/Map/types';
import { useOnline } from '@/web/useOnline';
import { api } from '@/lib/api';
import { MILES_TO_METERS } from '@/lib/units';
import { wIsRecommended } from '@/web/kind';
import { WebMap } from '@/web/WebMap';
import { WebSearchAutocomplete } from '@/web/WebSearchAutocomplete';
import { WebIcon } from '@/web/WebIcon';
import { WebTip } from '@/web/WebTip';

type KindFilter = 'all' | 'yours' | 'friend' | 'recommended';
const DISTANCES = [1, 3, 5, 10, 25, 50] as const;

export default function MapWeb() {
  const t = useTokens();

  const joined = useStore(s => s.joined);
  const pendingLeave = useStore(s => s.pendingLeave);
  const subscribedInterests = useStore(s => s.subscribedInterests);
  const joinEventStore = useStore(s => s.joinEvent);
  const schedulePendingLeave = useStore(s => s.schedulePendingLeave);
  const cancelPendingLeave = useStore(s => s.cancelPendingLeave);
  const showToast = useStore(s => s.showToast);
  const radius = useStore(s => s.radius);
  const setRadius = useStore(s => s.setRadius);
  const tweaks = useStore(s => s.tweaks);

  const { coords, status, isFallback, request } = useLocation();
  const radiusM = Math.round(radius * MILES_TO_METERS);
  const { events, reload: reloadEvents } = useEvents({
    lat: coords?.latitude,
    lng: coords?.longitude,
    radiusM,
  });
  // FR4.4 — re-fetch the feed when the viewer's subscribed interests change so
  // the pin colors + "Recommended" buckets refresh immediately (not on reload).
  const interestKey = useMemo(
    () => Array.from(subscribedInterests).sort().join('|'),
    [subscribedInterests],
  );
  const interestsHydrated = useRef(false);
  useEffect(() => {
    if (!interestsHydrated.current) { interestsHydrated.current = true; return; }
    reloadEvents();
  }, [interestKey, reloadEvents]);
  const online = useOnline() && !(tweaks?.offline ?? false);

  const effectiveJoined = useMemo(() => {
    const s = new Set(joined);
    pendingLeave.forEach(id => s.delete(id));
    return s;
  }, [joined, pendingLeave]);

  // Optimistic attendee counts so the hover-card count (+ unknown-cap stripe)
  // move the instant the viewer joins/leaves, not on the next refetch.
  const { displayEvents, markToggled } = useOptimisticAttendees(events, effectiveJoined);

  const [filter, setFilter] = useState<KindFilter>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [centerOn, setCenterOn] = useState<LatLng | null>(null);

  // Arriving from an event's "Where" fact (/(tabs)/map?focus=<id>): select
  // that event (highlight its pin + open the hover card via activeId) and
  // pan the map to it. Mirrors native `app/(tabs)/map.tsx`. We consume the
  // param afterwards so a later tab visit doesn't re-center on a stale id.
  const params = useLocalSearchParams<{ focus?: string }>();
  useEffect(() => {
    const fid = params.focus;
    if (!fid) return;
    const ev = events.find(e => e.id === fid);
    if (!ev) return; // events may still be loading — retry on the next run
    setHoveredId(ev.id);
    setCenterOn(eventLatLng(ev));
    router.setParams({ focus: '' });
  }, [params.focus, events]);

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

  const listEvents = useMemo(() => displayEvents.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'recommended') return wIsRecommended(e, subscribedInterests);
    return e.kind === filter;
  }), [displayEvents, filter, subscribedInterests]);

  const onJoin = useCallback(async (id: string) => {
    const e = events.find(x => x.id === id);
    if (!e) return;
    const isJoined = effectiveJoined.has(id);
    markToggled(id); // snapshot pre-toggle membership for the optimistic count
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
  }, [events, effectiveJoined, markToggled, schedulePendingLeave, cancelPendingLeave, showToast, joinEventStore]);

  const goEvent = useCallback((id: string) => {
    router.push(`/event/${id}` as never);
  }, []);

  return (
    // `position: absolute; inset: 0` bypasses any flex-chain weirdness
    // and guarantees the map screen fills its positioned WebShell ancestor.
    // The previous `height: 100%` was working in theory but fell over when
    // an intermediate react-native-web View collapsed to 0 height during
    // route transitions, which is what caused the map to render as a tiny
    // square in the corner.
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: t.surface,
        color: t.ink,
        fontFamily: FONT.body,
      }}
    >
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
        centerOn={centerOn}
      />

      {/*
        FR1.5 / FR4.1 — Native parity affordance for location permission
        (see `app/(tabs)/map.tsx:107-122`). Browsers block automatic
        geolocation prompts; without a user-gesture trigger the map
        silently falls back to the UCI default with no recovery path. The
        pill is only shown while we're using a fallback coord; tapping it
        re-runs `request()` (which calls `Location.requestForeground`...
        in the hook).
      */}
      {isFallback && (
        <button
          type="button"
          onClick={() => { void request(); }}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 22,
            transform: 'translateX(-50%)',
            zIndex: 46,
            padding: '9px 14px',
            borderRadius: 999,
            background: t.card,
            color: t.ink,
            border: `1px solid ${status === 'denied' ? t.warn : t.line}`,
            boxShadow: '0 14px 32px -16px rgba(0,0,0,0.45)',
            cursor: 'pointer',
            fontFamily: FONT.mono,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
          aria-label={status === 'denied'
            ? 'Location denied. Using UCI default. Tap to retry.'
            : 'Tap to enable location.'}
        >
          <WebIcon name={status === 'denied' ? 'lock' : 'crosshair'} size={13} />
          {status === 'denied'
            ? 'Location denied · using UCI default'
            : status === 'requesting'
              ? 'Requesting location…'
              : 'Tap to enable location'}
        </button>
      )}

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 16,
          transform: 'translateX(-50%)',
          width: 'min(620px, 70%)',
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
  );
}

// Mirror of the popover in index.web.tsx — kept local rather than
// hoisted into a shared module because it directly owns the radius +
// kind-filter wiring that's local to each screen's state. If a third
// caller turns up we can extract a `WebMapFilterPopover`.
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
