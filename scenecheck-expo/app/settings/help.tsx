// Settings → Help & feedback. Quick links to docs, support, and
// re-playing the welcome tour.

import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon, type IconName } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';

const ROWS: { icon: IconName; label: string; sub: string; href?: string; action?: 'replay-tour' }[] = [
  { icon: 'help', label: 'How SceneCheck works', sub: 'A walkthrough of the main features', action: 'replay-tour' },
  { icon: 'mail', label: 'Email support', sub: 'support@scenecheck.app', href: 'mailto:support@scenecheck.app' },
  { icon: 'shield', label: 'Privacy policy', sub: 'scenecheck.app/privacy', href: 'https://scenecheck.app/privacy' },
  { icon: 'flag', label: 'Report a bug', sub: 'github.com/scenecheck/issues', href: 'https://github.com/scenecheck/issues' },
];

export default function HelpFeedbackScreen() {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);

  const handlePress = async (row: typeof ROWS[number]) => {
    if (row.action === 'replay-tour') {
      // Onboarding tour can be re-enabled here once it's built.
      showToast({ message: 'Welcome tour replay coming soon.', kind: 'info' });
      return;
    }
    if (row.href) {
      const supported = await Linking.canOpenURL(row.href);
      if (supported) await Linking.openURL(row.href);
      else showToast({ message: 'Could not open link.', kind: 'error' });
    }
  };

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText variant="labelCap" color={t.ink3}>SETTINGS</SCText>
        <SCText variant="displayTight" size={28} style={{ marginTop: 4 }}>Help & feedback</SCText>
      </View>

      <View style={{ paddingHorizontal: 14, gap: 8 }}>
        {ROWS.map((row, i) => (
          <Pressable
            key={i}
            onPress={() => handlePress(row)}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <SCCard style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: t.primarySoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <SCIcon name={row.icon} size={16} color={t.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <SCText size={14} weight="600">{row.label}</SCText>
                <SCText size={11} color={t.ink3} style={{ marginTop: 2 }}>{row.sub}</SCText>
              </View>
              <SCIcon name="chevron-right" size={14} color={t.ink3} />
            </SCCard>
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: 18, paddingTop: 24, alignItems: 'center' }}>
        <SCText variant="mono" size={11} color={t.ink3}>SceneCheck · v0.4.2</SCText>
      </View>
    </Screen>
  );
}
