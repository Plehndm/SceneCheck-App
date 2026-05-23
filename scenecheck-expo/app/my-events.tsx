// Events you've joined — every event you're confirmed for, in one place.
// Reached from the ATTENDED stat on your profile.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCButton } from '@/components/SCAddButton';
import { useTokens } from '@/theme/ThemeProvider';
import { useJoinedEvents } from '@/hooks/useJoinedEvents';
import { whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';

export default function MyEventsScreen() {
  const t = useTokens();
  const { events, reload } = useJoinedEvents();

  return (
    <Screen onRefresh={reload}>
      <SCTopBar onBack={() => router.back()} subtitle="ATTENDING" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={32}>Events you&apos;ve joined</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </SCText>
      </View>

      {events.length === 0 ? (
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
          {events.map(e => (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/event/${e.id}` as never)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={{
                  width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: t.accentBlue,
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
          ))}
        </View>
      )}
    </Screen>
  );
}
