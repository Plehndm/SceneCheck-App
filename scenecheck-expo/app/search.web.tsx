// Search / Discover (web) — 4-section layout.
//
// Centered max-720 column. Top: a sticky search bar bound to the URL
// `?q=` param so links like "browse #climbing" can deep-link from the
// rail or other screens. Below: four sections (Events / People /
// Organizations / Interests), each in a WebDiscSection wrapper.
//
// Reuses the existing hooks (no new wiring): useEvents (client-side
// filtered by query), useSearchPeople + useSearchOrgs (server-filtered),
// useInterests (server-filtered). Mock-mode (lib/supabase null) is
// supported by every one of these hooks already.
//
// Falls back to a "Recommended for you" mode when the query is empty:
// shows the top N from each section (people/orgs/interests come from
// the unfiltered hook calls; events come from the user's discovery
// radius via useEvents).

import { useMemo, useState, useEffect, type CSSProperties } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { useEvents } from '@/hooks/useEvents';
import { useSearchPeople, useSearchOrgs } from '@/hooks/useSearch';
import { useInterests } from '@/hooks/useInterests';
import { useLocation } from '@/hooks/useLocation';
import { useJoinEventHandler } from '@/hooks/useJoinEventHandler';
import { excludeSelf } from '@/lib/people';
import { MILES_TO_METERS } from '@/lib/units';
import { WebIcon } from '@/web/WebIcon';
import { WebTag } from '@/web/WebTag';
import { WebDiscSection } from '@/web/WebDiscSection';
import { WebEventListCard } from '@/web/WebEventListCard';
import { WebPersonRow } from '@/web/WebPersonRow';
import { WebOrgRow } from '@/web/WebOrgRow';

const SECTION_LIMIT = 8;

type Tab = 'all' | 'events' | 'people' | 'orgs' | 'interests';
const TABS: Tab[] = ['all', 'events', 'people', 'orgs', 'interests'];

export default function WebSearchScreen() {
  const t = useTokens();
  const params = useLocalSearchParams<{ q?: string; tab?: string }>();
  const initialQ = typeof params.q === 'string' ? params.q : '';
  const initialTab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'all';
  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<Tab>(initialTab);
  // Keep the URL in sync as the user types or switches tabs so the
  // search is bookmarkable and the rail/profile deep-links
  // (router.push('/search?tab=people')) hydrate this screen with the
  // right initial section selected.
  useEffect(() => {
    if ((params.q ?? '') === query && (params.tab ?? 'all') === tab) return;
    router.setParams({
      q: query || undefined,
      tab: tab === 'all' ? undefined : tab,
    } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab]);

  const lowered = query.trim().toLowerCase();
  const meId = useStore(s => s.me.id);
  // Pull the stable Set reference from the store and derive the array
  // in a memo. Returning `Array.from(...)` directly from the selector
  // produces a new array reference per render, which Zustand's
  // useSyncExternalStore adapter treats as "changed" → infinite render.
  const subscribedInterests = useStore(s => s.subscribedInterests);
  const meInterests = useMemo(
    () => Array.from(subscribedInterests),
    [subscribedInterests],
  );
  const joined = useStore(s => s.joined);
  // Routed through the shared hook so optimistic-commit + waitlist
  // toast + UNDO grace match every other web caller.
  const onJoin = useJoinEventHandler();
  const radiusMiles = useStore(s => s.radius);
  const { coords } = useLocation();

  // Events: server returns the radius-cut set; we sub-filter by query
  // client-side (same pattern as the native search.tsx).
  const radiusM = Math.round(radiusMiles * MILES_TO_METERS);
  const { events: allEvents, loading: eventsLoading } = useEvents({
    lat: coords?.latitude,
    lng: coords?.longitude,
    radiusM,
  });
  // Full discovery-range set matching the query (uncapped) — drives the true
  // Events tab-count and the dedicated Events section.
  const matchedEvents = useMemo(() => {
    if (!lowered) return allEvents;
    return allEvents.filter(e =>
      e.title.toLowerCase().includes(lowered) ||
      (e.where ?? '').toLowerCase().includes(lowered) ||
      (e.interests ?? []).some(i => i.toLowerCase().includes(lowered))
    );
  }, [allEvents, lowered]);
  // The dedicated Events tab shows the full set (matches what the Home/Map feed
  // loads for the same radius); the 'all' overview shows a capped preview.
  const events = useMemo(
    () => (tab === 'events' ? matchedEvents : matchedEvents.slice(0, SECTION_LIMIT)),
    [matchedEvents, tab],
  );

  const { results: peopleRaw, loading: peopleLoading } = useSearchPeople(query);
  const { results: orgsRaw, loading: orgsLoading } = useSearchOrgs(query);
  // useInterests returns Interest rows (`tag` + subscriberCount etc.);
  // we cap to a comfortable per-section ceiling. With an empty query
  // the hook returns the top suggested set per its existing implementation.
  const { interests: interestsRaw, loading: interestsLoading } = useInterests(query);

  const people = useMemo(() => {
    const v = excludeSelf(peopleRaw, meId);
    return (lowered ? v : v.slice(0, SECTION_LIMIT)).slice(0, SECTION_LIMIT);
  }, [peopleRaw, lowered, meId]);

  const orgs = useMemo(() => {
    return (lowered ? orgsRaw : orgsRaw.slice(0, SECTION_LIMIT)).slice(0, SECTION_LIMIT);
  }, [orgsRaw, lowered]);

  const interests = useMemo(() => {
    return (interestsRaw ?? []).slice(0, SECTION_LIMIT * 2);
  }, [interestsRaw]);

  const eventGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 14,
  };
  const peopleGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  };
  const tagsRowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        background: t.surface,
      }}
    >
      <div
        style={{
          maxWidth: 880,
          margin: '0 auto',
          padding: '40px 32px 80px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 800,
              fontSize: 36,
              letterSpacing: '-0.045em',
              color: t.ink,
              lineHeight: 1.05,
            }}
          >
            Discover
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              color: t.ink3,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginTop: 6,
            }}
          >
            {lowered ? `Results for “${query}”` : 'Events, people, organizations + interests'}
          </div>
        </div>

        {/* Search bar */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            background: t.surface,
            paddingBottom: 18,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: t.card,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: '0 16px',
              height: 52,
              boxShadow: '0 12px 24px -18px rgba(0,0,0,0.18)',
            }}
          >
            <WebIcon name="search" size={18} color={t.ink3} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search events, people, orgs, interests…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: FONT.body,
                fontSize: 15,
                color: t.ink,
                height: '100%',
              }}
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: t.subtle, border: 'none',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: t.ink2,
                }}
              >
                <WebIcon name="x" size={13} />
              </button>
            )}
          </div>

          {/* Tab strip — filters which section is visible. Counts are
              shown inline so the user knows what each tab will reveal
              before they switch. Tab state is mirrored to the URL
              (?tab=…) so deep-links from the rail and from the
              profile's "Find more friends" button land on the right
              section. */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 14,
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {([
              { k: 'all', label: 'All', n: matchedEvents.length + people.length + orgs.length + interests.length },
              { k: 'events', label: 'Events', n: matchedEvents.length },
              { k: 'people', label: 'People', n: people.length },
              { k: 'orgs', label: 'Organizations', n: orgs.length },
              { k: 'interests', label: 'Interests', n: interests.length },
            ] as { k: Tab; label: string; n: number }[]).map(c => {
              const on = tab === c.k;
              return (
                <button
                  key={c.k}
                  type="button"
                  onClick={() => setTab(c.k)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: `1px solid ${on ? t.ink : t.line}`,
                    background: on ? t.ink : t.card,
                    color: on ? t.surface : t.ink,
                    cursor: 'pointer',
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.label}
                  <span
                    style={{
                      fontSize: 10,
                      opacity: 0.6,
                      fontWeight: 500,
                    }}
                  >
                    {c.n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sections — each renders only when the active tab includes it. */}
        {(tab === 'all' || tab === 'events') && (
          <WebDiscSection
            title="Events"
            count={events.length}
            loading={eventsLoading}
            emptyText="No matching events nearby."
          >
            <div style={eventGridStyle}>
              {events.map(e => (
                <WebEventListCard
                  key={e.id}
                  event={e}
                  joined={joined.has(e.id)}
                  onJoin={() => onJoin(e)}
                  onOpen={() => router.push(`/event/${e.id}` as never)}
                />
              ))}
            </div>
          </WebDiscSection>
        )}

        {(tab === 'all' || tab === 'people') && (
          <WebDiscSection title="People" count={people.length} loading={peopleLoading} emptyText="No matching people.">
            <div style={peopleGridStyle}>
              {people.map(p => (
                <WebPersonRow key={p.id} person={p} message />
              ))}
            </div>
          </WebDiscSection>
        )}

        {(tab === 'all' || tab === 'orgs') && (
          <WebDiscSection title="Organizations" count={orgs.length} loading={orgsLoading} emptyText="No matching orgs.">
            <div style={peopleGridStyle}>
              {orgs.map(o => (
                <WebOrgRow key={o.id} org={o} showBio={false} />
              ))}
            </div>
          </WebDiscSection>
        )}

        {(tab === 'all' || tab === 'interests') && (
          <WebDiscSection title="Interests" count={interests.length} loading={interestsLoading} emptyText="No matching tags.">
            <div style={tagsRowStyle}>
              {interests.map(i => {
                const subscribed = meInterests.includes(i.tag);
                return (
                  <WebTag
                    key={i.tag}
                    tag={i.tag}
                    size="lg"
                    tone={subscribed ? 'primary' : 'soft'}
                    onClick={() => router.push(`/interests/${encodeURIComponent(i.tag)}` as never)}
                  />
                );
              })}
            </div>
          </WebDiscSection>
        )}
      </div>
    </div>
  );
}
