// Chat tab — minimal list of conversations. Threaded view ships in Phase 4
// as app/chat/[id].tsx.

import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCAvatar } from '@/components/SCAvatar';
import { SCListSkeleton } from '@/components/SCSkeleton';
import { useTokens } from '@/theme/ThemeProvider';
import { useChats } from '@/hooks/useChats';
import { api } from '@/lib/api';
import { SC_ACCOUNT_BY_ID, SC_EVENT_BY_ID, SC_VISIBLE_PEOPLE } from '@/data/mocks';
import { RADIUS } from '@/theme/tokens';
import type { Chat, ChatMember } from '@/types/domain';

// Resolve up to two member-shaped objects per chat to render to the
// left of the chat title. Priority order:
//   1. chat.members from api.getChats (live mode — already populated
//      from the chat_members ⨝ profiles embed).
//   2. SC_ACCOUNT_BY_ID[c.personId] for DMs (mock mode fallback).
//   3. Event host + first non-host attendee from SC_VISIBLE_PEOPLE
//      (mock mode fallback for event chats — no member list exists
//      in SC_CHATS, so we synthesise a representative pair).
// Returns 0–2 entries. The render block below maps:
//   0 entries → muted placeholder circle
//   1 entry   → single SCAvatar (DM look)
//   2 entries → Instagram-style stack (front offset bottom-right
//               with a card-color ring to separate)
function chatAvatars(c: Chat, mock: boolean): ChatMember[] {
  if (c.members && c.members.length > 0) {
    return c.members.slice(0, 2);
  }
  if (!mock) return [];
  if (c.kind === 'dm' && c.personId) {
    const p = SC_ACCOUNT_BY_ID[c.personId];
    return p ? [{ id: p.id, name: p.name, picture: p.picture, type: p.type }] : [];
  }
  if (c.kind === 'event' && c.eventId) {
    const ev = SC_EVENT_BY_ID[c.eventId];
    if (!ev) return [];
    const out: ChatMember[] = [];
    if (ev.hostId) {
      const host = SC_ACCOUNT_BY_ID[ev.hostId];
      if (host) out.push({ id: host.id, name: host.name, picture: host.picture, type: host.type });
    }
    // Pick a deterministic "second face" — first visible person who
    // isn't the host. This is purely cosmetic in mock mode; live mode
    // populates members from real chat_members.
    const second = SC_VISIBLE_PEOPLE.find(p => p.id !== ev.hostId);
    if (second) out.push({ id: second.id, name: second.name, picture: second.picture, type: second.type });
    return out;
  }
  return [];
}

export default function ChatTab() {

  const t = useTokens();
  // useChats() reads from Supabase in live mode (the chats ⨝
  // chat_members ⨝ messages join) and SC_CHATS in mock mode.
  const { chats, loading, reload } = useChats();
  const mock = api.isMock();
  // Re-fetch on every focus. The tab mounts (and does its initial fetch) at
  // app start while UNfocused — so the first time you actually open the tab,
  // that fetch is already stale and would miss chats created since (e.g. one
  // the other person started). Reloading on focus shows existing chats without
  // having to send a message first.
  useFocusEffect(
    useCallback(() => { reload(); }, [reload]),
  );
  return (
    <Screen onRefresh={reload}>
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

      {loading && chats.length === 0 ? (
        <View style={{ paddingTop: 14 }}>
          <SCListSkeleton rows={4} />
        </View>
      ) : chats.length === 0 ? (
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
          // Live mode: titles are resolved on the Chat (event title / other
          // member's name) in api.getChats. Mock mode: resolve from SC_*.
          const title = c.kind === 'event'
            ? (c.title ?? (mock ? SC_EVENT_BY_ID[c.eventId ?? '']?.title : undefined) ?? 'Event chat')
            : (c.title ?? (mock ? SC_ACCOUNT_BY_ID[c.personId ?? '']?.name : undefined) ?? 'DM');
          const avatars = chatAvatars(c, mock);
          // Stacked-avatar geometry: back avatar is top-left, front avatar
          // is offset bottom-right with a card-coloured "ring" around it
          // (a padded wrapper) so it visually separates from the back
          // avatar — the same trick Instagram uses for its group-chat
          // avatars. AVATAR_BACK and the offsets are tuned so the entire
          // stack fits in roughly the same width a single 40 px avatar
          // would occupy, keeping the row alignment tight.
          const AVATAR_DM = 40;
          const AVATAR_BACK = 30;
          const AVATAR_OFFSET = 14;
          return (
            <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}` as never)}>
              <SCCard style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* Avatar(s) on the left */}
                  {avatars.length === 0 ? (
                    <View style={{
                      width: AVATAR_DM, height: AVATAR_DM, borderRadius: AVATAR_DM / 2,
                      backgroundColor: t.subtle,
                    }} />
                  ) : avatars.length === 1 ? (
                    <SCAvatar person={avatars[0]} size={AVATAR_DM} />
                  ) : (
                    <View style={{
                      width: AVATAR_BACK + AVATAR_OFFSET,
                      height: AVATAR_BACK + AVATAR_OFFSET,
                    }}>
                      <SCAvatar
                        person={avatars[0]}
                        size={AVATAR_BACK}
                        style={{ position: 'absolute', top: 0, left: 0 }}
                      />
                      {/* Front avatar wrapped in a card-coloured pad so a
                          thin "ring" separates it from the back one. */}
                      <View style={{
                        position: 'absolute', bottom: 0, right: 0,
                        padding: 2,
                        borderRadius: (AVATAR_BACK + 4) / 2,
                        backgroundColor: t.card,
                      }}>
                        <SCAvatar person={avatars[1]} size={AVATAR_BACK} />
                      </View>
                    </View>
                  )}

                  {/* Title + last-message stack */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <SCText variant="display" size={15} style={{ flex: 1 }} numberOfLines={1}>
                        {title}
                      </SCText>
                      <SCText variant="mono" size={10} color={t.ink3} style={{ marginLeft: 8 }}>
                        {c.time}
                      </SCText>
                    </View>
                    <SCText size={12} color={t.ink2} style={{ marginTop: 4 }} numberOfLines={1}>
                      {c.last}
                    </SCText>
                  </View>
                </View>
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
