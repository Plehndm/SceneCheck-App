// Follow requests — incoming friend requests waiting for approval
// (only shown when account visibility = 'private'). Accept moves them
// into `friends`; decline drops them silently.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCAvatar } from '@/components/SCAvatar';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';

export default function RequestsScreen() {
  const t = useTokens();
  const acceptStore = useStore(s => s.acceptFriendRequest);
  const declineStore = useStore(s => s.declineFriendRequest);
  const showToast = useStore(s => s.showToast);
  // useFriendRequests filters by the Zustand `incomingRequests` Set
  // in mock mode (so accept / decline reflect instantly) and pulls
  // from the `friendships` table in live mode. `reload()` re-fetches
  // after each mutation.
  const { requests, reload } = useFriendRequests();

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} subtitle="INBOX" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={36}>Follow requests</SCText>
        <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 6 }}>
          {requests.length} {requests.length === 1 ? 'PERSON WANTS' : 'PEOPLE WANT'} TO ADD YOU
        </SCText>
      </View>

      {requests.length === 0 ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <View style={{
            width: 64, height: 64, borderRadius: 20, backgroundColor: t.subtle,
            alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <SCIcon name="user-check" size={28} color={t.ink3} />
          </View>
          <SCText size={16} weight="600">You&apos;re all caught up</SCText>
          <SCText size={13} color={t.ink3} style={{ marginTop: 4 }}>
            New requests will show here.
          </SCText>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 10 }}>
          {requests.map(r => (
            <View key={r.id} style={{
              backgroundColor: t.card, borderColor: t.line, borderWidth: 1,
              borderRadius: RADIUS.lg, padding: 14, gap: 10,
            }}>
              <Pressable
                onPress={() => router.push(`/profile/${r.person.id}` as never)}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCAvatar person={r.person} size={48} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SCText size={15} weight="600">{r.person.name}</SCText>
                  <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                    @{r.person.username} · {r.when}
                  </SCText>
                </View>
              </Pressable>
              {r.note && (
                <View style={{
                  padding: 12, backgroundColor: t.subtle, borderRadius: RADIUS.md,
                }}>
                  <SCText size={13} color={t.ink2} style={{ lineHeight: 18 }}>
                    &ldquo;{r.note}&rdquo;
                  </SCText>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={async () => {
                    // Optimistic local mutation, then commit. The
                    // store update sweeps the row out of `incoming`
                    // and into `friends` so the list updates the
                    // moment ACCEPT is pressed.
                    acceptStore(r.id, r.person.id);
                    showToast({ message: `${r.person.name} added as a friend.`, kind: 'success' });
                    try {
                      await api.acceptFriendRequest(r.id);
                      reload();
                    } catch (e) {
                      showToast({
                        message: e instanceof Error ? `Couldn't accept: ${e.message}` : "Couldn't accept.",
                        kind: 'error',
                      });
                    }
                  }}
                  style={({ pressed }) => [{
                    flex: 1, height: 40, borderRadius: RADIUS.md,
                    backgroundColor: t.primary,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }, pressed && { opacity: 0.85 }]}
                >
                  <SCIcon name="check" size={14} color={t.primaryInk} />
                  <SCText variant="mono" size={11} weight="700" color={t.primaryInk}>ACCEPT</SCText>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    declineStore(r.id);
                    showToast({ message: 'Request declined.', kind: 'info' });
                    try {
                      await api.declineFriendRequest(r.id);
                      reload();
                    } catch (e) {
                      showToast({
                        message: e instanceof Error ? `Couldn't decline: ${e.message}` : "Couldn't decline.",
                        kind: 'error',
                      });
                    }
                  }}
                  style={({ pressed }) => [{
                    flex: 1, height: 40, borderRadius: RADIUS.md,
                    borderWidth: 1, borderColor: t.line,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }, pressed && { opacity: 0.85 }]}
                >
                  <SCIcon name="x" size={14} color={t.ink2} />
                  <SCText variant="mono" size={11} weight="700" color={t.ink2}>DECLINE</SCText>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
