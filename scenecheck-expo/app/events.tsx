// Events list — the "SEE ALL" surface from the Home screen. Vertical
// list with filter chips (ALL / YOURS / FRIENDS / FOR YOU). Each row
// taps through to /event/[id].

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCTag } from '@/components/SCTag';
import { ConflictChip } from '@/components/ConflictChip';
import { SCListSkeleton } from '@/components/SCSkeleton';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useEvents } from '@/hooks/useEvents';
import { isRecommendedFor, eventCategory, EVENT_CATEGORY_LABEL, isAlsoRecommended } from '@/lib/events';
import { pinColor } from '@/components/Map/types';
import { whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';
import type { SCEvent } from '@/types/domain';

type Filter = 'all' | 'yours' | 'friend' | 'recommended';

export default function EventsListScreen() {
  const t = useTokens();
  const [filter, setFilter] = useState<Filter>('all');
  const joined = useStore(s => s.joined);
  const pendingLeave = useStore(s => s.pendingLeave);
  const meInterests = useStore(s => s.me.interests ?? []);
  // Live in live mode, fixture array in mock mode — same hook the
  // Home tab + Map tab use.
  const { events: allEvents, loading, reload } = useEvents();
  // id → event lookup so the conflict chip can resolve joined events' times
  // (live mode — SC_EVENT_BY_ID only has the seeded ones).
  const eventsById = useMemo(
    () => Object.fromEntries(allEvents.map(e => [e.id, e])),
    [allEvents],
  );

  // "FOR YOU" = events that match one of your interests (see lib/events).
  const isRecommended = (e: SCEvent) => isRecommendedFor(e, meInterests);

  const list = allEvents.filter(e =>
    filter === 'all' ? true :
    filter === 'recommended' ? isRecommended(e) :
    e.kind === filter
  );

  const counts = {
    all: allEvents.length,
    yours: allEvents.filter(e => e.kind === 'yours').length,
    friend: allEvents.filter(e => e.kind === 'friend').length,
    recommended: allEvents.filter(isRecommended).length,
  };

  const accentFor = (e: SCEvent) => pinColor(e, t, meInterests);
  const kindLabel = (e: SCEvent) => EVENT_CATEGORY_LABEL[eventCategory(e, meInterests)];

  return (
    <Screen onRefresh={reload}>
      <SCTopBar
        onBack={() => router.back()}
        subtitle="HAPPENING NEAR YOU"
        right={
          <Pressable
            onPress={() => router.push('/(tabs)/map' as never)}
            style={({ pressed }) => [{
              height: 34, paddingHorizontal: 12, borderRadius: 999,
              backgroundColor: t.card, borderWidth: 1, borderColor: t.line,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="pin" size={12} color={t.ink2} />
            <SCText variant="mono" size={10} weight="600" color={t.ink2}>MAP</SCText>
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText variant="displayTight" size={32}>Events nearby</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
          {list.length} {list.length === 1 ? 'event' : 'events'} happening · Sat May 9 · Irvine
        </SCText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}
      >
        {([
          { k: 'all', label: `ALL · ${counts.all}` },
          { k: 'yours', label: `YOURS · ${counts.yours}` },
          { k: 'friend', label: `FRIENDS · ${counts.friend}` },
          { k: 'recommended', label: `FOR YOU · ${counts.recommended}` },
        ] as { k: Filter; label: string }[]).map(c => (
          <Pressable
            key={c.k}
            onPress={() => setFilter(c.k)}
            style={({ pressed }) => [{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
              borderWidth: 1,
              backgroundColor: filter === c.k ? t.ink : t.card,
              borderColor: filter === c.k ? t.ink : t.line,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCText variant="mono" size={11} weight="600" color={filter === c.k ? t.surface : t.ink}>
              {c.label}
            </SCText>
          </Pressable>
        ))}
      </ScrollView>

      {loading && allEvents.length === 0 ? (
        <SCListSkeleton rows={5} />
      ) : list.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 24, alignItems: 'center' }}>
            <SCText variant="displayTight" size={20}>Nothing in this slice</SCText>
            <SCText size={13} color={t.ink3} style={{ marginTop: 6, textAlign: 'center' }}>
              {allEvents.length === 0
                ? 'No events nearby right now. Pull to refresh or widen your range.'
                : 'No events match this filter. Try a different one.'}
            </SCText>
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 10 }}>
          {list.map(e => {
            const accent = accentFor(e);
            const joinedNow = joined.has(e.id) && !pendingLeave.has(e.id);
            return (
              <Pressable
                key={e.id}
                onPress={() => router.push(`/event/${e.id}` as never)}
                style={({ pressed }) => [{
                  flexDirection: 'row', gap: 12, padding: 14,
                  backgroundColor: t.card, borderColor: t.line, borderWidth: 1,
                  borderRadius: RADIUS.lg,
                }, pressed && { opacity: 0.9 }]}
              >
                <View style={{
                  width: 44, borderRadius: RADIUS.md, backgroundColor: accent,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <SCIcon name="pin" size={20} color="white" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
                    <SCText variant="mono" size={9} weight="600" color={accent}>
                      {kindLabel(e)}
                    </SCText>
                    {isAlsoRecommended(e, meInterests) && (
                      <View style={{
                        backgroundColor: t.accentBlue, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                      }}>
                        <SCText variant="mono" size={9} weight="600" color="white">RECOMMENDED</SCText>
                      </View>
                    )}
                    {joinedNow && (
                      <View style={{
                        backgroundColor: t.good, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                      }}>
                        <SCText variant="mono" size={9} weight="600" color="white">JOINED</SCText>
                      </View>
                    )}
                    {!joinedNow && <ConflictChip event={e} compact eventsById={eventsById} />}
                  </View>
                  <SCText variant="display" size={16} style={{ marginBottom: 4 }}>{e.title}</SCText>
                  <SCText variant="mono" size={11} color={t.ink2}>{whenRange(e)}</SCText>
                  <SCText size={12} color={t.ink3} style={{ marginTop: 2 }}>{e.where}</SCText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <SCText variant="mono" size={11} weight="600">
                      {e.attendees}
                      <SCText variant="mono" size={11} color={t.ink3}>/{e.cap > 0 ? e.cap : 'unk'}</SCText>
                    </SCText>
                    {e.interests.slice(0, 2).map(tag => (
                      <SCTag key={tag} tag={tag} size="sm" tone="soft" />
                    ))}
                  </View>
                </View>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <SCIcon name="chevron-right" size={16} color={t.ink3} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
