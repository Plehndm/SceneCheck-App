// Settings → Blocked users. Reads the persistent blocked list and lets
// the user un-block. Per the architecture doc's privacy model, blocked
// users never see this account in their feed and vice versa.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';

export default function BlockedUsersScreen() {
  const t = useTokens();
  const blocked = useStore(s => s.blocked);
  const unblock = useStore(s => s.unblockUser);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);

  const handleUnblock = (id: string, name: string) => {
    showConfirm({
      title: `Unblock ${name}?`,
      body: 'They will be able to see your profile and message you again.',
      confirmLabel: 'UNBLOCK',
      onConfirm: () => {
        unblock(id);
        showToast({ message: `Unblocked ${name}.`, kind: 'info' });
      },
    });
  };

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText variant="labelCap" color={t.ink3}>SETTINGS</SCText>
        <SCText variant="displayTight" size={28} style={{ marginTop: 4 }}>Blocked users</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6, lineHeight: 19 }}>
          People you&apos;ve blocked. They don&apos;t see your profile and you don&apos;t see theirs.
        </SCText>
      </View>

      {blocked.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>No one&apos;s blocked.</SCText>
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {blocked.map(b => (
            <SCCard key={b.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 42, height: 42, borderRadius: 21, backgroundColor: t.subtle,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <SCIcon name="shield" size={18} color={t.ink3} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <SCText size={15} weight="600">{b.name}</SCText>
                <SCText variant="mono" size={11} color={t.ink3}>
                  @{b.username} · {b.reason}
                </SCText>
              </View>
              <Pressable
                onPress={() => handleUnblock(b.id, b.name)}
                style={({ pressed }) => [{
                  paddingHorizontal: 12, height: 32, borderRadius: 999,
                  borderWidth: 1, borderColor: t.line,
                  alignItems: 'center', justifyContent: 'center',
                }, pressed && { opacity: 0.85 }]}
              >
                <SCText variant="mono" size={10} weight="700" color={t.ink2}>UNBLOCK</SCText>
              </Pressable>
            </SCCard>
          ))}
        </View>
      )}
    </Screen>
  );
}
