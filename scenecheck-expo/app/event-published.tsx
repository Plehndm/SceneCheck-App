// Event-published success screen. Reached via router.replace from
// create-event so the back button doesn't re-open the editor.

import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCIcon } from '@/components/SCIcon';
import { SCButton } from '@/components/SCAddButton';
import { useTokens } from '@/theme/ThemeProvider';

export default function EventPublishedScreen() {
  const t = useTokens();
  const { eventId, title } = useLocalSearchParams<{ eventId?: string; title?: string }>();

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 }}>
        <View style={{
          width: 84, height: 84, borderRadius: 42, backgroundColor: t.good,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <SCIcon name="check" size={40} color="white" />
        </View>
        <View style={{ alignItems: 'center' }}>
          <SCText variant="displayTight" size={32}>You&apos;re live!</SCText>
          <SCText size={14} color={t.ink2} style={{ marginTop: 10, lineHeight: 21, textAlign: 'center' }}>
            <SCText size={14} weight="600">{title ?? 'Your event'}</SCText> is published.
            Once a few subscribers join, it&apos;ll appear publicly on the map.
          </SCText>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <SCButton label="Home" onPress={() => router.replace('/(tabs)' as never)} variant="ghost" />
          </View>
          <View style={{ flex: 1 }}>
            <SCButton
              label="View event"
              onPress={() => router.replace(`/event/${eventId ?? 'e1'}` as never)}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}
