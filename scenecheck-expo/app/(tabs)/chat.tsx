// Chat tab — minimal list of conversations. Threaded view ships in Phase 4
// as app/chat/[id].tsx.

import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { SC_CHATS, SC_ACCOUNT_BY_ID, SC_EVENT_BY_ID } from '@/data/mocks';
import { Pressable } from 'react-native';

export default function ChatTab() {
  const t = useTokens();
  return (
    <Screen>
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <SCText variant="labelCap">Conversations</SCText>
        <SCText variant="displayTight" size={32} style={{ marginTop: 4 }}>Chat</SCText>
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 14, gap: 10 }}>
        {SC_CHATS.map(c => {
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
    </Screen>
  );
}
