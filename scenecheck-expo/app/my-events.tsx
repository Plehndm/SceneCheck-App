// Events you've joined — every event you're confirmed for, in one place.
// Reached from the ATTENDED stat on your profile.

import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCButton } from '@/components/SCAddButton';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useJoinedEvents } from '@/hooks/useJoinedEvents';
import { SCListSkeleton } from '@/components/SCSkeleton';
import { pinColor } from '@/components/Map/types';
import { whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';

export default function MyEventsScreen() {
  const t = useTokens();
  // Same interest set the map/legend uses, so the icon color reflects whether
  // an event is yours / a friend's / recommended (interest match) / other —
  // and recolors when you add/remove interests.
  const meInterests = useStore(s => s.me.interests ?? []);
  const pendingLeave = useStore(s => s.pendingLeave);
  const { events, loading, reload } = useJoinedEvents();

  // Refetch every time the screen is focused, so joining/leaving an event
  // elsewhere (and navigating back) is reflected — the live list comes from
  // the server and the screen stays mounted under the stack, so a mount-only
  // fetch would go stale.
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Hide events you're mid-leave on (the 5s grace) so the list matches the
  // Join/Leave button state immediately.
  const visible = events.filter(e => !pendingLeave.has(e.id));

  // Split into upcoming vs past by the event's start time. Events without a
  // start (mock fixtures) are treated as upcoming.
  const now = Date.now();
  const isPast = (e: typeof events[number]) =>
    e.startAt ? new Date(e.startAt).getTime() < now : false;
  const upcoming = visible.filter(e => !isPast(e));
  const past = visible.filter(isPast);

  const renderRow = (e: typeof events[number]) => (
    <Pressable
      key={e.id}
      onPress={() => router.push(`/event/${e.id}` as never)}
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
    >
      <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View style={{
          width: 38, height: 38, borderRadius: RADIUS.md,
          backgroundColor: pinColor(e, t, meInterests),
          alignItems: 'center', justifyContent: 'center',
        }}>
          <SCIcon name="pin" size={16} color="white" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <SCText variant="display" size={14}>{e.title}</SCText>
          <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
            {whenRange(e)} · {e.where}
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
      <SCTopBar onBack={() => router.back()} subtitle="ATTENDING" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={32}>Events you&apos;ve joined</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
          {visible.length} {visible.length === 1 ? 'event' : 'events'}
        </SCText>
      </View>

      {loading && events.length === 0 ? (
        <SCListSkeleton rows={4} />
      ) : visible.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>No events yet</SCText>
            <SCText size={12} color={t.ink3} style={{ marginTop: 4, marginBottom: 14, textAlign: 'center' }}>
              Join an event and it&apos;ll show up here.
            </SCText>
            <SCButton label="Browse events" onPress={() => router.push('/events' as never)} />
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
