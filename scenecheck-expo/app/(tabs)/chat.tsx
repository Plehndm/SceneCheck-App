// Chat tab — minimal list of conversations. Threaded view ships in Phase 4
// as app/chat/[id].tsx.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { useTokens } from '@/theme/ThemeProvider';
import { useChats } from '@/hooks/useChats';
import { SC_ACCOUNT_BY_ID, SC_EVENT_BY_ID } from '@/data/mocks';
import { RADIUS } from '@/theme/tokens';

export default function ChatTab() {
  const t = useTokens();
  // useChats() reads from Supabase in live mode (the chats ⨝
  // chat_members ⨝ messages join) and SC_CHATS in mock mode.
  const { chats } = useChats();
  return (
    <Screen>
      <View style={{
        paddingHorizontal: 18, paddingTop: 8,
        flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <View>
          <SCText variant="labelCap">Conversations</SCText>
          <SCText variant="displayTight" size={32} style={{ marginTop: 4 }}>Chat</SCText>
        </View>
        {/* Start a new chat — opens the friends picker (matches the legacy
            chat-list compose button). */}
        <Pressable
          onPress={() => router.push('/new-chat' as never)}
          accessibilityLabel="Start a new chat"
          style={({ pressed }) => [{
            width: 42, height: 42, borderRadius: RADIUS.lg,
            backgroundColor: t.ink,
            alignItems: 'center', justifyContent: 'center',
          }, pressed && { opacity: 0.85 }]}
        >
          <SCIcon name="edit" size={18} color={t.card} />
        </Pressable>
      </View>

      {chats.length === 0 ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
          <SCCard style={{ padding: 20, alignItems: 'center', gap: 6 }}>
            <SCText size={14} weight="600">No conversations yet</SCText>
            <SCText size={12} color={t.ink3} style={{ textAlign: 'center', lineHeight: 17 }}>
              Tap the compose button above to start a chat with a friend.
            </SCText>
          </SCCard>
        </View>
      ) : (
      <View style={{ paddingHorizontal: 14, paddingTop: 14, gap: 10 }}>
        {chats.map(c => {
          const title = c.kind === 'event'
            ? c.title ?? SC_EVENT_BY_ID[c.eventId ?? '']?.title ?? 'Event chat'
            : SC_ACCOUNT_BY_ID[c.personId ?? '']?.name ?? 'DM';
          return (
            <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}` as never)}>
              <SCCard style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <SCText variant="display" size={15}>{title}</SCText>
                  <SCText variant="mono" size={10} color={t.ink3}>{c.time}</SCText>
                </View>
                <SCText size={12} color={t.ink2} style={{ marginTop: 4 }} numberOfLines={1}>
                  {c.last}
                </SCText>
                {c.unread > 0 && (
                  <View style={{
                    position: 'absolute', top: 12, right: 14,
                    minWidth: 18, height: 18, borderRadius: 9,
                    paddingHorizontal: 5,
                    backgroundColor: t.primary,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SCText variant="mono" size={10} weight="700" color={t.primaryInk}>
                      {String(c.unread)}
                    </SCText>
                  </View>
                )}
              </SCCard>
            </Pressable>
          );
        })}
      </View>
      )}
    </Screen>
  );
}
