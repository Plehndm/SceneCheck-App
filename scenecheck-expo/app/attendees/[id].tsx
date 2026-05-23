// Attendees roster for an event. Excludes anyone who has blocked the
// viewer (handled by SC_VISIBLE_PEOPLE).

import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCTopBar } from '@/components/SCTopBar';
import { SCAvatar } from '@/components/SCAvatar';
import { SCListSkeleton } from '@/components/SCSkeleton';
import { useTokens } from '@/theme/ThemeProvider';
import { useEvent } from '@/hooks/useEvent';
import { useAttendees } from '@/hooks/useAttendees';

export default function AttendeesScreen() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  // useEvent: mock-mode sync from SC_EVENT_BY_ID, live from
  // api.getEventById. useAttendees: live joins event_subscriptions ⨝
  // profiles for confirmed rows; mock returns SC_VISIBLE_PEOPLE so
  // the existing screen test still sees the full roster.
  const { event, reload: reloadEvent } = useEvent(id);
  const { attendees: visible, loading, reload: reloadAttendees } = useAttendees(id);
  if (!event) {
    return (
      <Screen>
        <SCTopBar onBack={() => router.back()} title="Attendees" />
        <View style={{ padding: 24 }}>
          <SCText size={14} color={t.ink2}>Event not found.</SCText>
        </View>
      </Screen>
    );
  }
  return (
    <Screen onRefresh={() => { reloadEvent(); reloadAttendees(); }}>
      <SCTopBar onBack={() => router.back()} subtitle={event.title.toUpperCase()} title="Going" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="labelCap">{visible.length} of {event.attendees} going</SCText>
        <SCText variant="displayTight" size={32} style={{ marginTop: 4 }}>Attendees</SCText>
      </View>
      {loading && visible.length === 0 ? (
        <SCListSkeleton rows={5} />
      ) : visible.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>No one&apos;s joined yet</SCText>
            <SCText size={12} color={t.ink3} style={{ marginTop: 4, textAlign: 'center' }}>
              Be the first to join this event.
            </SCText>
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {visible.map(p => (
            <Pressable
              key={p.id}
              onPress={() => router.push(`/profile/${p.id}` as never)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <SCCard style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <SCAvatar person={p} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SCText size={15} weight="600">{p.name}</SCText>
                  <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                    @{p.username} · {p.mutual ?? 0} mutual
                  </SCText>
                </View>
              </SCCard>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
