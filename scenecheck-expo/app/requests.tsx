// Friend requests — manage both directions in one place:
//   • "Requests for you"  — incoming, Accept moves them into friends,
//                           Decline drops them.
//   • "Sent by you"       — outgoing requests you've made, with Cancel.
// Reachable from the Profile tab (and from Settings for private accounts).

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
import { useOutgoingRequests } from '@/hooks/useOutgoingRequests';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';

export default function RequestsScreen() {
  const t = useTokens();
  const acceptStore = useStore(s => s.acceptFriendRequest);
  const declineStore = useStore(s => s.declineFriendRequest);
  const cancelStore = useStore(s => s.cancelOutgoingRequest);
  const showToast = useStore(s => s.showToast);
  // Incoming = pending requests where you're the recipient; outgoing =
  // requests you sent. Both re-fetch (live) / re-derive (mock) after a
  // mutation through the store sets they key off.
  const { requests, reload } = useFriendRequests();
  const { people: outgoing, reload: reloadOut } = useOutgoingRequests();

  const total = requests.length + outgoing.length;

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} subtitle="REQUESTS" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={36}>Friend requests</SCText>
        <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 6 }}>
          {requests.length} TO APPROVE · {outgoing.length} SENT
        </SCText>
      </View>

      {total === 0 ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <View style={{
            width: 64, height: 64, borderRadius: 20, backgroundColor: t.subtle,
            alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <SCIcon name="user-check" size={28} color={t.ink3} />
          </View>
          <SCText size={16} weight="600">You&apos;re all caught up</SCText>
          <SCText size={13} color={t.ink3} style={{ marginTop: 4, textAlign: 'center' }}>
            Requests you send and receive will show here.
          </SCText>
        </View>
      ) : (
        <>
          {/* ── Incoming ── */}
          {requests.length > 0 && (
            <View style={{ paddingHorizontal: 14, gap: 10, marginBottom: 18 }}>
              <SCText variant="labelCap" style={{ paddingHorizontal: 4 }}>Requests for you</SCText>
              {requests.map(r => (
                <View key={r.id} style={{
                  backgroundColor: t.card, borderColor: t.line, borderWidth: 1,
                  borderRadius: RADIUS.lg, padding: 14, gap: 10,
                }}>
                  <Pressable
                    onPress={() => router.push(`/profile/${r.person.id}` as never)}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.85 }]}
                  >
                    <SCAvatar person={r.person} size={48} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <SCText size={15} weight="600">{r.person.name}</SCText>
                      <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                        @{r.person.username} · {r.when}
                      </SCText>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={async () => {
                        acceptStore(r.id, r.person.id);
                        showToast({ message: `${r.person.name} added as a friend.`, kind: 'success' });
                        try { await api.acceptFriendRequest(r.id); reload(); }
                        catch (e) {
                          showToast({ message: e instanceof Error ? `Couldn't accept: ${e.message}` : "Couldn't accept.", kind: 'error' });
                        }
                      }}
                      style={({ pressed }) => [{
                        flex: 1, height: 40, borderRadius: RADIUS.md, backgroundColor: t.primary,
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
                        try { await api.declineFriendRequest(r.id); reload(); }
                        catch (e) {
                          showToast({ message: e instanceof Error ? `Couldn't decline: ${e.message}` : "Couldn't decline.", kind: 'error' });
                        }
                      }}
                      style={({ pressed }) => [{
                        flex: 1, height: 40, borderRadius: RADIUS.md, borderWidth: 1, borderColor: t.line,
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

          {/* ── Outgoing ── */}
          {outgoing.length > 0 && (
            <View style={{ paddingHorizontal: 14, gap: 10 }}>
              <SCText variant="labelCap" style={{ paddingHorizontal: 4 }}>Sent by you</SCText>
              {outgoing.map(p => (
                <View key={p.id} style={{
                  backgroundColor: t.card, borderColor: t.line, borderWidth: 1,
                  borderRadius: RADIUS.lg, padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <Pressable
                    onPress={() => router.push(`/profile/${p.id}` as never)}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }, pressed && { opacity: 0.85 }]}
                  >
                    <SCAvatar person={p} size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <SCText size={15} weight="600">{p.name}</SCText>
                      <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                        {p.username ? `@${p.username} · ` : ''}Pending
                      </SCText>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      cancelStore(p.id);
                      showToast({ message: `Request to ${p.name} canceled.`, kind: 'info' });
                      try { await api.removeFriend(p.id); reloadOut(); }
                      catch (e) {
                        showToast({ message: e instanceof Error ? `Couldn't cancel: ${e.message}` : "Couldn't cancel.", kind: 'error' });
                      }
                    }}
                    style={({ pressed }) => [{
                      paddingHorizontal: 14, height: 36, borderRadius: RADIUS.md,
                      borderWidth: 1, borderColor: t.line,
                      alignItems: 'center', justifyContent: 'center',
                    }, pressed && { opacity: 0.85 }]}
                  >
                    <SCText variant="mono" size={11} weight="700" color={t.ink2}>CANCEL</SCText>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
