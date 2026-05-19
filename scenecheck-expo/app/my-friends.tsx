// Your friends — people in the `friends` Set. Each row taps through to
// their profile; tapping the trailing icon unfriends them.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCAvatar } from '@/components/SCAvatar';
import { SCButton } from '@/components/SCAddButton';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useFriends } from '@/hooks/useFriends';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';

export default function MyFriendsScreen() {
  const t = useTokens();
  const removeFriendStore = useStore(s => s.removeFriend);
  const showConfirm = useStore(s => s.showConfirm);
  const showToast = useStore(s => s.showToast);
  // useFriends() reads from the Zustand friends Set in mock mode and
  // from `friendships ⨝ profiles` in live mode. `reload()` lets us
  // re-fetch after an unfriend so the list updates without a remount.
  const { friends: list, reload } = useFriends();

  const handleUnfriend = (id: string, name: string) => {
    showConfirm({
      title: `Unfriend ${name}?`,
      body: 'You can re-add them later by sending a new request.',
      confirmLabel: 'UNFRIEND',
      tone: 'danger',
      onConfirm: async () => {
        // Optimistic local update first so the row disappears
        // immediately, then commit to Supabase. On failure surface a
        // toast — the Zustand mutation is local-only so we don't need
        // a rollback unless the API call would have been authoritative.
        removeFriendStore(id);
        showToast({ message: `Unfriended ${name}.`, kind: 'info' });
        try {
          await api.removeFriend(id);
          reload();
        } catch (e) {
          showToast({
            message: e instanceof Error ? `Couldn't unfriend: ${e.message}` : "Couldn't unfriend.",
            kind: 'error',
          });
        }
      },
    });
  };

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} subtitle="FRIENDS" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={32}>Friends</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
          {list.length} {list.length === 1 ? 'connection' : 'connections'}
        </SCText>
      </View>
      {list.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>No friends yet</SCText>
            <SCText size={12} color={t.ink3} style={{ marginTop: 4, marginBottom: 14 }}>
              Find people from your interests, mutual events, or campus.
            </SCText>
            <SCButton label="Find people" onPress={() => router.push('/search' as never)} />
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {list.map(p => (
            <SCCard key={p.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={() => router.push(`/profile/${p.id}` as never)}
                style={({ pressed }) => [{
                  flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCAvatar person={p} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SCText size={15} weight="600">{p.name}</SCText>
                  <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                    @{p.username} · {p.mutual ?? 0} mutual
                  </SCText>
                </View>
              </Pressable>
              <Pressable
                onPress={() => handleUnfriend(p.id, p.name)}
                style={({ pressed }) => [{
                  width: 36, height: 36, borderRadius: RADIUS.md,
                  borderWidth: 1, borderColor: t.line,
                  alignItems: 'center', justifyContent: 'center',
                }, pressed && { opacity: 0.85 }]}
              >
                <SCIcon name="x" size={14} color={t.ink3} />
              </Pressable>
            </SCCard>
          ))}
          <Pressable
            onPress={() => router.push('/search' as never)}
            style={({ pressed }) => [{
              padding: 12, borderRadius: RADIUS.lg,
              borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="search" size={14} color={t.ink2} />
            <SCText variant="mono" size={11} weight="600" color={t.ink2}>
              FIND MORE PEOPLE
            </SCText>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
