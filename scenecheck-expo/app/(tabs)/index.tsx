// Home screen. Ported from SCHomeScreen in src/screens.jsx with the
// following structural changes:
//   - State (joined, pendingLeave) comes from the Zustand store instead of
//     being prop-drilled from app.jsx.
//   - Tweaks (showSkeletons, offline) likewise come from the store.
//   - Navigation uses expo-router's `router.push` instead of a `go()`
//     prop. Targets like `{name: 'event', eventId: 'e1'}` become
//     `/event/e1`.
//
// This is the first end-to-end proof that scaffold → primitives →
// store → theme all line up on both web and native.

import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/Screen';
import { SCCard } from '@/components/SCCard';
import { SCSection } from '@/components/SCSection';
import { SCText } from '@/components/SCText';
import { SCIcon } from '@/components/SCIcon';
import { SCEventCard } from '@/components/SCEventCard';
import { SCRailSkeleton } from '@/components/SCSkeleton';
import { SCPersonRow } from '@/components/SCPersonRow';
import { MapPreview } from '@/components/MapPreview';
import { LegendDot } from '@/components/LegendDot';

import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useEvents } from '@/hooks/useEvents';
import { useSearchPeople } from '@/hooks/useSearch';
import { useDateCityLabel } from '@/hooks/useDateCityLabel';
import { useLocation } from '@/hooks/useLocation';
import { excludeSelf } from '@/lib/people';
import { Pressable } from 'react-native';
import { RADIUS } from '@/theme/tokens';

export default function HomeScreen() {
  const t = useTokens();
  const joined = useStore(s => s.joined);
  const pendingLeave = useStore(s => s.pendingLeave);
  const meId = useStore(s => s.me.id);
  const meInterests = useStore(s => s.me.interests ?? []);
  const isJoinedNow = (id: string) => joined.has(id) && !pendingLeave.has(id);
  // "People nearby" — public people from Supabase (fixtures in mock mode).
  // Live mode excludes self in the query; excludeSelf also drops self in mock
  // mode (where the fixture list is unfiltered). See hooks/useSearch.
  const { results: peopleResults, reload: reloadPeople } = useSearchPeople('');
  const peopleNearby = excludeSelf(peopleResults, meId).slice(0, 4);
  // Honor the persisted discovery radius (miles → meters) so changing it in
  // the Map/Settings re-fetches the in-range events here too, and their
  // recommendations re-derive against your current interests.
  const radiusM = Math.round(useStore(s => s.radius) * 1609.34);
  // Live in live mode, fixture array in mock mode — see hooks/useEvents.
  const { events, loading, reload: reloadEvents } = useEvents({ radiusM });
  // id → event lookup for the conflict chip (resolves joined events' times in
  // live mode, where SC_EVENT_BY_ID only has the seeded events).
  const eventsById = Object.fromEntries(events.map(e => [e.id, e]));
  // Live date + (if location granted) reverse-geocoded city. Pass location
  // through explicitly — `useDateCityLabel` no longer mounts its own
  // `useLocation()` (M4 in CODE_REVIEW_REPORT_3.md).
  const { coords, status: locStatus } = useLocation();
  const dateCityLabel = useDateCityLabel(coords, locStatus);

  return (
    <Screen onRefresh={() => { reloadEvents(); reloadPeople(); }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 18, paddingTop: 8, paddingBottom: 2,
        flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <View>
          <SCText variant="labelCap">{dateCityLabel}</SCText>
          <SCText variant="displayTight" size={36} style={{ marginTop: 4, lineHeight: 36 }}>
            What&apos;s the{'\n'}scene?
          </SCText>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/search' as never)}
            style={({ pressed }) => [{
              width: 40, height: 40, borderRadius: RADIUS.md,
              borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
              alignItems: 'center', justifyContent: 'center',
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="search" size={18} color={t.ink} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/create-event' as never)}
            accessibilityLabel="Create a new event"
            style={({ pressed }) => [{
              width: 40, height: 40, borderRadius: RADIUS.md,
              backgroundColor: t.ink,
              alignItems: 'center', justifyContent: 'center',
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="plus" size={18} color={t.card} />
          </Pressable>
        </View>
      </View>

      {/* Map preview card */}
      <View style={{ paddingHorizontal: 14, paddingTop: 18 }}>
        <SCCard style={{ overflow: 'hidden', padding: 0 }}>
          <MapPreview events={events} onPress={() => router.push('/map' as never)} />
          {/* Legend strip */}
          <View style={{
            flexDirection: 'row', gap: 14, paddingHorizontal: 14, paddingVertical: 12,
            borderTopColor: t.line, borderTopWidth: 1, flexWrap: 'wrap',
          }}>
            <LegendDot color={t.primary} label="Your events" />
            <LegendDot color={t.accentFriend} label="Friends" />
            <LegendDot color={t.accentBlue} label="Recommended" />
            <LegendDot color={t.mapPinMute} label="Other" />
          </View>
        </SCCard>
      </View>

      {/* Happening near you */}
      <SCSection
        title="HAPPENING NEAR YOU"
        action={
          <Pressable onPress={() => router.push('/events' as never)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <SCText variant="mono" size={11} weight="600" color={t.ink2}>SEE ALL →</SCText>
          </Pressable>
        }
      >
        {loading && events.length === 0 ? (
          <SCRailSkeleton />
        ) : events.length === 0 ? (
          <SCCard style={{ padding: 16, alignItems: 'center', gap: 6 }}>
            <SCText size={13} color={t.ink2} weight="600">No events nearby yet</SCText>
            <SCText size={11} color={t.ink3} style={{ textAlign: 'center', lineHeight: 16 }}>
              Be the first to host something.
            </SCText>
            <Pressable
              onPress={() => router.push('/create-event' as never)}
              style={({ pressed }) => [{
                marginTop: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: t.ink,
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={11} weight="700" color={t.card}>NEW EVENT</SCText>
            </Pressable>
          </SCCard>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
          >
            {events.slice(0, 5).map(e => (
              <SCEventCard
                key={e.id}
                event={e}
                joined={isJoinedNow(e.id)}
                showConflict
                meInterests={meInterests}
                conflictLookup={eventsById}
                onPress={() => router.push(`/event/${e.id}` as never)}
              />
            ))}
          </ScrollView>
        )}
      </SCSection>

      {/* Nearby people */}
      <SCSection title="PEOPLE NEARBY">
        <SCCard>
          {peopleNearby.map((p, idx) => (
            <View key={p.id}>
              {idx > 0 && <View style={{ height: 1, backgroundColor: t.line, marginHorizontal: 14 }} />}
              <SCPersonRow person={p} onPress={() => router.push(`/profile/${p.id}` as never)} />
            </View>
          ))}
        </SCCard>
      </SCSection>
    </Screen>
  );
}
