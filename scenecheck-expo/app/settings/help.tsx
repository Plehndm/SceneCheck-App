// Settings → Help & feedback. Quick links to docs, support, and
// replaying the post-signup onboarding (the interests questionnaire).

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

// Each row either:
//   - opens an external URL via Linking (`href`)
//   - navigates to an in-app screen (`route`)
//   - runs an inline action (`action`)
// Privacy used to link out to https://scenecheck.app/privacy — that
// domain isn't owned by this project and serves an unrelated demo
// site, so we route to an in-app privacy screen that accurately
// describes what SceneCheck does instead. The bug-report URL was
// also pointing at a non-existent github.com/scenecheck/issues; it
// now points at the actual repo.
//
// "Replay onboarding" sends the user back through /onboarding/interests
// (the post-signup picker built for FR1.3). markOnboarded is idempotent
// and additive — re-picking tags adds to the user's existing interests
// rather than wiping the existing set, so this is safe to invoke from
// settings without a confirmation gate. The label and subtitle reflect
// that ("re-pick interests" rather than the older "walkthrough" copy,
// which implied a multi-step tour we never actually built).
const ROWS: { icon: IconName; label: string; sub: string; href?: string; route?: string }[] = [
  { icon: 'help', label: 'Replay onboarding', sub: 'Re-pick the interests we use to rank events for you', route: '/onboarding/interests' },
  { icon: 'mail', label: 'Email support', sub: 'support@scenecheck.app', href: 'mailto:support@scenecheck.app' },
  { icon: 'shield', label: 'Privacy policy', sub: 'How SceneCheck handles your data', route: '/settings/privacy' },
  { icon: 'flag', label: 'Report a bug', sub: 'github.com/Plehndm/SceneCheck-App/issues', href: 'https://github.com/Plehndm/SceneCheck-App/issues' },
];

export default function HelpFeedbackScreen() {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);

  const handlePress = async (row: typeof ROWS[number]) => {
    if (row.route) {
      router.push(row.route as never);
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
        {ROWS.map((row) => (
          <Pressable
            key={row.label}
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
