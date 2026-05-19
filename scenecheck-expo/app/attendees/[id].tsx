// Attendees roster for an event. Excludes anyone who has blocked the
// viewer (handled by SC_VISIBLE_PEOPLE).

import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCTopBar } from '@/components/SCTopBar';
import { SCAvatar } from '@/components/SCAvatar';
import { useTokens } from '@/theme/ThemeProvider';
import { SC_EVENT_BY_ID, SC_VISIBLE_PEOPLE } from '@/data/mocks';

export default function AttendeesScreen() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = id ? SC_EVENT_BY_ID[id] : null;
  const visible = SC_VISIBLE_PEOPLE;
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
    <Screen>
      <SCTopBar onBack={() => router.back()} subtitle={event.title.toUpperCase()} title="Going" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="labelCap">{visible.length} of {event.attendees} going</SCText>
        <SCText variant="displayTight" size={32} style={{ marginTop: 4 }}>Attendees</SCText>
      </View>
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
    </Screen>
  );
}
