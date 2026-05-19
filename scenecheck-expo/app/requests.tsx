// Follow requests — incoming friend requests waiting for approval
// (only shown when account visibility = 'private'). Accept moves them
// into `friends`; decline drops them silently.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCAvatar } from '@/components/SCAvatar';
import { SCIcon } from '@/components/SCIcon';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { SC_FRIEND_REQUESTS, SC_VISIBLE_PERSON_BY_ID } from '@/data/mocks';
import { RADIUS } from '@/theme/tokens';

export default function RequestsScreen() {
  const t = useTokens();
  const incoming = useStore(s => s.incomingRequests);
  const accept = useStore(s => s.acceptFriendRequest);
  const decline = useStore(s => s.declineFriendRequest);
  const showToast = useStore(s => s.showToast);

  const requests = SC_FRIEND_REQUESTS
    .filter(r => incoming.has(r.id))
    .map(r => ({ ...r, person: SC_VISIBLE_PERSON_BY_ID[r.personId] }))
    .filter(r => r.person);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 }}>
        <SCText variant="labelCap">Inbox</SCText>
        <SCText variant="displayTight" size={36} style={{ marginTop: 4 }}>Follow requests</SCText>
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
                  onPress={() => {
                    accept(r.id, r.person.id);
                    showToast({ message: `${r.person.name} added as a friend.`, kind: 'success' });
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
                  onPress={() => {
                    decline(r.id);
                    showToast({ message: 'Request declined.', kind: 'info' });
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
