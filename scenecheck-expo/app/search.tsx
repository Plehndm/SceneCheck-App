// Search — unified search across events, people, and orgs. The ALL tab shows
// all three in one feed; the EVENTS / PEOPLE / ORGS tabs narrow to one type.
// An optional `?tab=` param auto-selects a tab (e.g. "Browse orgs" → orgs,
// "Find people" → people). People + orgs come from Supabase via
// useSearchPeople / useSearchOrgs (SC_* fixtures in mock mode); events come
// from useEvents and are filtered client-side.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCAvatar } from '@/components/SCAvatar';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useEvents } from '@/hooks/useEvents';
import { useLocation } from '@/hooks/useLocation';
import { useSearchPeople, useSearchOrgs } from '@/hooks/useSearch';
import { excludeSelf } from '@/lib/people';
import { whenRange } from '@/lib/date-time';
import { eventCategory, EVENT_CATEGORY_LABEL, isAlsoRecommended } from '@/lib/events';
import { pinColor } from '@/components/Map/types';
import { SCListSkeleton } from '@/components/SCSkeleton';
import { MILES_TO_METERS } from '@/lib/units';
import { RADIUS } from '@/theme/tokens';
import type { SCEvent, Account } from '@/types/domain';

type Tab = 'all' | 'events' | 'people' | 'orgs';
const TABS: Tab[] = ['all', 'events', 'people', 'orgs'];

export default function SearchScreen() {
  const t = useTokens();
  // ?tab= auto-selects a filter on open; default to the combined ALL feed.
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(() =>
    TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'all',
  );
  const [query, setQuery] = useState('');
  const meId = useStore(s => s.me.id);
  // Same interest set the home feed + map use, so an event's icon colour /
  // label reflects whether it's yours / a friend's / recommended / other —
  // and recolours reactively when you add or remove interests.
  const meInterests = useStore(s => s.me.interests ?? []);
  // Discovery radius (miles → meters at the query boundary). Changing it in
  // the Map/Settings refetches the in-range events, so their recommendations
  // re-derive against your current interests.
  const radiusM = Math.round(useStore(s => s.radius) * MILES_TO_METERS);
  // Anchor discovery on the user's ACTUAL location (falls back to the default
  // region when permission isn't granted) so the events match the home/map
  // feed instead of being pinned to the Irvine default. Passing only radiusM
  // before meant search ignored where the user actually is.
  const { coords } = useLocation();
  const lowered = query.trim().toLowerCase();

  // Events come from useEvents (live or fixtures) and are filtered locally.
  // People + orgs come from Supabase (fixtures in mock mode); the hooks
  // already apply the query, so when it's empty we just cap the default view.
  const { events: allEvents, loading: eventsLoading, reload: reloadEvents } = useEvents({
    lat: coords?.latitude,
    lng: coords?.longitude,
    radiusM,
  });
  const { results: peopleAll, loading: peopleLoading, reload: reloadPeople } = useSearchPeople(query);
  const { results: orgsAll, loading: orgsLoading, reload: reloadOrgs } = useSearchOrgs(query);
  const loading = eventsLoading || peopleLoading || orgsLoading;

  // Full in-range match set (uncapped) — drives the EVENTS tab + its count.
  const matchedEvents = useMemo(() => {
    if (!lowered) return allEvents;
    return allEvents.filter(e =>
      e.title.toLowerCase().includes(lowered) ||
      e.where.toLowerCase().includes(lowered) ||
      e.interests.some(i => i.toLowerCase().includes(lowered))
    );
  }, [lowered, allEvents]);
  // The dedicated EVENTS tab shows EVERY event in the discovery range; the
  // combined ALL feed shows a capped preview so it doesn't bury people/orgs.
  const events = useMemo(
    () => (tab === 'events' ? matchedEvents : matchedEvents.slice(0, 6)),
    [matchedEvents, tab],
  );

  // Never surface yourself in people results (live excludes self in the
  // query; this also covers mock mode where the fixture list is unfiltered).
  const peopleVisible = excludeSelf(peopleAll, meId);
  const people = lowered ? peopleVisible : peopleVisible.slice(0, 6);
  const orgs = lowered ? orgsAll : orgsAll.slice(0, 6);

  const showEvents = tab === 'all' || tab === 'events';
  const showPeople = tab === 'all' || tab === 'people';
  const showOrgs = tab === 'all' || tab === 'orgs';
  const visibleCount =
    (showEvents ? events.length : 0) +
    (showPeople ? people.length : 0) +
    (showOrgs ? orgs.length : 0);

  const renderEvent = (e: SCEvent) => {
    // Colour + label from the shared category, so search agrees with the
    // home feed, the map legend, and the event detail.
    const accent = pinColor(e, t, meInterests);
    const label = EVENT_CATEGORY_LABEL[eventCategory(e, meInterests)];
    return (
      <Pressable
        key={`e-${e.id}`}
        onPress={() => router.push(`/event/${e.id}` as never)}
        style={({ pressed }) => [pressed && { opacity: 0.9 }]}
      >
        <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{
            width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: accent,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <SCIcon name="pin" size={16} color="white" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <SCText variant="mono" size={9} weight="600" color={accent}>{label}</SCText>
              {isAlsoRecommended(e, meInterests) && (
                <View style={{
                  backgroundColor: t.accentBlue, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                }}>
                  <SCText variant="mono" size={9} weight="600" color="white">RECOMMENDED</SCText>
                </View>
              )}
            </View>
            <SCText variant="display" size={14} style={{ marginTop: 2 }}>{e.title}</SCText>
            <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
              {whenRange(e)} · {e.where}
            </SCText>
          </View>
          <SCIcon name="chevron-right" size={14} color={t.ink3} />
        </SCCard>
      </Pressable>
    );
  };

  const renderPerson = (p: Account) => (
    <Pressable
      key={`p-${p.id}`}
      onPress={() => router.push(`/profile/${p.id}` as never)}
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
    >
      <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <SCAvatar person={p} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <SCText variant="display" size={14}>{p.name}</SCText>
          <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
            @{p.username}{p.mutual != null ? ` · ${p.mutual} mutual` : ''}
          </SCText>
        </View>
        <SCIcon name="chevron-right" size={14} color={t.ink3} />
      </SCCard>
    </Pressable>
  );

  const renderOrg = (o: Account) => {
    const handle = o.handle ?? (o.username ? `@${o.username}` : '');
    return (
      <Pressable
        key={`o-${o.id}`}
        onPress={() => router.push(`/profile/${o.id}` as never)}
        style={({ pressed }) => [pressed && { opacity: 0.9 }]}
      >
        <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <SCAvatar person={o} size={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <SCText variant="display" size={14}>{o.name}</SCText>
            <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
              {handle}{o.followers != null ? ` · ${o.followers} followers` : ''}
            </SCText>
          </View>
          <SCIcon name="chevron-right" size={14} color={t.ink3} />
        </SCCard>
      </Pressable>
    );
  };

  // In the ALL feed, label each block; single-type tabs need no header.
  const sectionLabel = (text: string) => (
    <SCText variant="labelCap" color={t.ink3} style={{ marginTop: 6, paddingHorizontal: 4 }}>
      {text}
    </SCText>
  );

  return (
    <Screen onRefresh={() => { reloadEvents(); reloadPeople(); reloadOrgs(); }}>
      <SCTopBar onBack={() => router.back()} />

      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText variant="displayTight" size={32}>Search</SCText>
      </View>

      {/* Search input */}
      <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: t.card, borderColor: t.line, borderWidth: 1,
          borderRadius: RADIUS.lg, paddingHorizontal: 14, height: 48,
        }}>
          <SCIcon name="search" size={18} color={t.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search events, people, orgs…"
            placeholderTextColor={t.ink3}
            style={{ flex: 1, color: t.ink, fontSize: 14, height: '100%' }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <SCIcon name="x" size={16} color={t.ink3} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 6, paddingBottom: 14 }}
      >
        {([
          { k: 'all', label: `ALL · ${matchedEvents.length + people.length + orgs.length}` },
          { k: 'events', label: `EVENTS · ${matchedEvents.length}` },
          { k: 'people', label: `PEOPLE · ${people.length}` },
          { k: 'orgs', label: `ORGS · ${orgs.length}` },
        ] as { k: Tab; label: string }[]).map(c => (
          <Pressable
            key={c.k}
            onPress={() => setTab(c.k)}
            style={({ pressed }) => [{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
              borderWidth: 1,
              backgroundColor: tab === c.k ? t.ink : t.card,
              borderColor: tab === c.k ? t.ink : t.line,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCText variant="mono" size={11} weight="600" color={tab === c.k ? t.surface : t.ink}>
              {c.label}
            </SCText>
          </Pressable>
        ))}
      </ScrollView>

      {/* Results */}
      {loading && visibleCount === 0 ? (
        <SCListSkeleton rows={5} />
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {showEvents && (
            <>
              {tab === 'all' && events.length > 0 && sectionLabel('Events')}
              {events.map(renderEvent)}
            </>
          )}
          {showPeople && (
            <>
              {tab === 'all' && people.length > 0 && sectionLabel('People')}
              {people.map(renderPerson)}
            </>
          )}
          {showOrgs && (
            <>
              {tab === 'all' && orgs.length > 0 && sectionLabel('Orgs')}
              {orgs.map(renderOrg)}
            </>
          )}

          {visibleCount === 0 && (
            <SCCard style={{ padding: 24, alignItems: 'center' }}>
              <SCText variant="displayTight" size={20}>No matches</SCText>
              <SCText size={13} color={t.ink3} style={{ marginTop: 6, textAlign: 'center' }}>
                {query.trim()
                  ? 'Try a different search term or tab.'
                  : 'Nothing to show yet. Pull to refresh.'}
              </SCText>
            </SCCard>
          )}
        </View>
      )}
    </Screen>
  );
}
