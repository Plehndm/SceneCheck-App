// Orgs you follow — surfaces in their event posts in your feed.

import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCAvatar } from '@/components/SCAvatar';
import { SCButton } from '@/components/SCAddButton';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useFollowedOrgs } from '@/hooks/useFollowedOrgs';
import { RADIUS } from '@/theme/tokens';

export default function MyFollowingScreen() {
  const t = useTokens();
  const toggleFollow = useStore(s => s.toggleFollow);
  const showToast = useStore(s => s.showToast);
  // Org rows come from Supabase via getProfilesByIds in live mode (fixtures in
  // mock mode); the `following` set itself stays local. See useFollowedOrgs.
  const { orgs: list, reload } = useFollowedOrgs();
  // Re-resolve on focus so following/unfollowing elsewhere (and persisted
  // follows after a reload) are reflected when you land here.
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return (
    <Screen onRefresh={reload}>
      <SCTopBar onBack={() => router.back()} subtitle="FOLLOWING" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={32}>Orgs you follow</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
          {list.length} {list.length === 1 ? 'organization' : 'organizations'} · You&apos;ll get notified when they post.
        </SCText>
      </View>
      {list.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>Not following anyone yet</SCText>
            <SCText size={12} color={t.ink3} style={{ marginTop: 4, marginBottom: 14, textAlign: 'center' }}>
              Browse organizations and follow ones whose events you&apos;d want to see.
            </SCText>
            <SCButton label="Browse orgs" onPress={() => router.push('/search?tab=orgs' as never)} />
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {list.map(o => (
            <SCCard key={o.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={() => router.push(`/profile/${o.id}` as never)}
                style={({ pressed }) => [{
                  flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCAvatar person={o} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SCText size={15} weight="600">{o.name}</SCText>
                  <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                    {o.handle ?? (o.username ? `@${o.username}` : '')}
                    {o.followers != null ? ` · ${o.followers} followers` : ''}
                  </SCText>
                </View>
              </Pressable>
              <Pressable
                onPress={() => {
                  toggleFollow(o.id);
                  showToast({ message: `Unfollowed ${o.name}.`, kind: 'info' });
                }}
                style={({ pressed }) => [{
                  paddingHorizontal: 14, height: 32, borderRadius: 999,
                  borderWidth: 1, borderColor: t.line,
                  alignItems: 'center', justifyContent: 'center',
                }, pressed && { opacity: 0.85 }]}
              >
                <SCText variant="mono" size={10} weight="700" color={t.ink2}>FOLLOWING</SCText>
              </Pressable>
            </SCCard>
          ))}
        </View>
      )}
    </Screen>
  );
}
