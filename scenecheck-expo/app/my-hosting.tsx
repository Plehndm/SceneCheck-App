// "Events I'm hosting" — every event you host, current and past, split into
// Upcoming / Past (current on top) like the joined-events screen. Empty-state
// CTA to create the first event.
//
// Uses useHostedEvents (api.fetchEventsByHost — all statuses, all times) rather
// than the discovery feed (useEvents), which only returns published, in-range,
// future events — so past/cancelled events you hosted show up here too.

import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCButton } from '@/components/SCAddButton';
import { SCListSkeleton } from '@/components/SCSkeleton';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useHostedEvents } from '@/hooks/useHostedEvents';
import { whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';

export default function MyHostingScreen() {
  const t = useTokens();
  const meId = useStore(s => s.me.id);
  // All events you host — published, past, and cancelled (fetchEventsByHost),
  // not just the discovery-feed slice.
  const { events, loading, reload } = useHostedEvents(meId);
  // Refetch on focus so an event you just created/cancelled is reflected.
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Split into upcoming vs past by start time (events without a start —
  // mock fixtures — count as upcoming). Current on top of past.
  const now = Date.now();
  const isPast = (e: typeof events[number]) =>
    e.startAt ? new Date(e.startAt).getTime() < now : false;
  const upcoming = events.filter(e => !isPast(e));
  const past = events.filter(isPast);

  const renderRow = (e: typeof events[number]) => (
    <Pressable
      key={e.id}
      onPress={() => router.push(`/event/${e.id}` as never)}
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
    >
      <SCCard style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: RADIUS.md,
          backgroundColor: t.subtle, alignItems: 'center', justifyContent: 'center',
        }}>
          <SCIcon name="calendar" size={20} color={t.ink2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <SCText size={14} weight="600" numberOfLines={1}>{e.title}</SCText>
          <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
            {whenRange(e)} · {e.attendees}/{e.cap} going
          </SCText>
        </View>
        <SCIcon name="chevron-right" size={14} color={t.ink3} />
      </SCCard>
    </Pressable>
  );

  const sectionLabel = (text: string) => (
    <SCText variant="labelCap" color={t.ink3} style={{ marginTop: 6, paddingHorizontal: 4 }}>
      {text}
    </SCText>
  );

  return (
    <Screen onRefresh={reload}>
      <SCTopBar onBack={() => router.back()} subtitle="HOSTING" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={32}>Events I&apos;m hosting</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </SCText>
      </View>

      {loading && events.length === 0 ? (
        <SCListSkeleton rows={4} />
      ) : events.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>No events posted yet</SCText>
            <SCText size={12} color={t.ink3} style={{ marginTop: 4, marginBottom: 14, textAlign: 'center' }}>
              Create your first event to start filling this list.
            </SCText>
            <SCButton label="New event" onPress={() => router.push('/create-event' as never)} />
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {upcoming.length > 0 && sectionLabel('Upcoming')}
          {upcoming.map(renderRow)}
          {past.length > 0 && sectionLabel('Past')}
          {past.map(renderRow)}
        </View>
      )}
    </Screen>
  );
}
