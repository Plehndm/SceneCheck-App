// "Events I'm hosting" — list of events where you are the host. Empty
// state CTA to create the first event.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCButton } from '@/components/SCAddButton';
import { useTokens } from '@/theme/ThemeProvider';
import { SC_EVENTS } from '@/data/mocks';
import { whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';

export default function MyHostingScreen() {
  const t = useTokens();
  const events = SC_EVENTS.filter(e => e.hostId === 'me');

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} subtitle="HOSTING" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={32}>Events I&apos;m hosting</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </SCText>
      </View>
      {events.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>No events posted yet</SCText>
            <SCText size={12} color={t.ink3} style={{ marginTop: 4, marginBottom: 14 }}>
              Create your first event to start filling this list.
            </SCText>
            <SCButton label="New event" onPress={() => router.push('/create-event' as never)} />
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 18, gap: 8 }}>
          {events.map(e => (
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
          ))}
        </View>
      )}
    </Screen>
  );
}
