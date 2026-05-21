// Interest detail — definition, faux activity chart, similar tags,
// subscribe/unsubscribe CTA.

import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCAddButton } from '@/components/SCAddButton';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useInterest } from '@/hooks/useInterest';
import { api } from '@/lib/api';

export default function InterestDetailScreen() {
  const t = useTokens();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  // `useInterest(tag)` hits the `interests` table in live mode and
  // SC_INTERESTS_DETAILS in mock mode. When the tag isn't in the
  // catalog (either mode), the fallback below keeps the screen
  // rendering so the user can still subscribe to a hand-typed tag.
  const { interest } = useInterest(tag);
  const i = interest
    ?? { tag: tag ?? '', others: 0, desc: 'A user-created interest tag.', similar: [] };
  const subscribed = useStore(s => s.subscribedInterests);
  const toggleStore = useStore(s => s.toggleInterestSub);
  const showToast = useStore(s => s.showToast);

  // Optimistic store toggle (syncs me.interests + persists locally), then
  // commit to user_interests in live mode so it survives a reload.
  const toggle = (t2: string) => {
    const willSubscribe = !subscribed.has(t2);
    toggleStore(t2);
    if (!api.isMock()) {
      api.setInterestSubscribed(t2, willSubscribe).catch(() => {
        showToast({ message: "Couldn't save that interest. Try again.", kind: 'error' });
      });
    }
  };

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <SCText variant="mono" size={56} weight="700" color={t.primary}>#</SCText>
          <SCText variant="displayTight" size={56} style={{ lineHeight: 56, fontStyle: 'italic' }}>{i.tag}</SCText>
        </View>
        <SCText variant="mono" size={14} color={t.ink2} style={{ marginTop: 4 }}>
          {i.others.toLocaleString()} others
        </SCText>

        <SCText size={16} style={{ lineHeight: 23, marginTop: 18 }}>{i.desc}</SCText>

        <View style={{ marginTop: 22, marginBottom: 22 }}>
          <SCText variant="labelCap" style={{ marginBottom: 8 }}>Activity in your area</SCText>
          <SCCard style={{ padding: 16 }}>
            <ActivityBar />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              {['JAN', 'MAR', 'MAY', 'JUL', 'SEP', 'NOV'].map(m => (
                <SCText key={m} variant="mono" size={10} color={t.ink3}>{m}</SCText>
              ))}
            </View>
          </SCCard>
        </View>

        <SCAddButton joined={subscribed.has(i.tag)} onPress={() => toggle(i.tag)} />

        <View style={{ marginTop: 28 }}>
          <SCText variant="labelCap" style={{ marginBottom: 10 }}>Similar interests</SCText>
          <View style={{ gap: 4 }}>
            {i.similar.map(s => (
              <Pressable
                key={s}
                onPress={() => router.push(`/interests/${s}` as never)}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 6,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCText variant="mono" size={22} color={t.ink2} style={{ fontStyle: 'italic' }}>
                  <SCText variant="mono" size={22} color={t.ink2} style={{ opacity: 0.5 }}>#</SCText>{s}
                </SCText>
                <SCIcon name="chevron-right" size={14} color={t.ink3} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

function ActivityBar() {
  const t = useTokens();
  const bars = [3, 5, 4, 6, 7, 8, 9, 11, 9, 7, 5, 4];
  const max = 12;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44 }}>
      {bars.map((b, i) => (
        <View key={i} style={{
          flex: 1,
          height: (b / max) * 44,
          backgroundColor: i === 4 ? t.primary : t.subtle,
          borderRadius: 4,
        }} />
      ))}
    </View>
  );
}
