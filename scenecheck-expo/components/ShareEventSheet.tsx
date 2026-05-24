// Bottom-sheet for sharing an event to friends. Pick one or more friends, add
// an optional note, and send — each friend gets the event in a 1:1 DM. Reuses
// the existing chat plumbing: api.createChat opens (or dedupes to) the DM and
// api.sendMessage posts a message referencing the event. No backend changes.

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { SCAvatar } from './SCAvatar';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useFriends } from '@/hooks/useFriends';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';

interface Props {
  visible: boolean;
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

// The message body sent into each friend's DM. Plain text (the chat renders
// text) with the event title + an in-app path the recipient can open.
function shareBody(eventTitle: string, eventId: string, note: string): string {
  const ref = `Check out "${eventTitle}" on SceneCheck — /event/${eventId}`;
  return note.trim() ? `${note.trim()}\n\n${ref}` : ref;
}

export function ShareEventSheet({ visible, eventId, eventTitle, onClose }: Props) {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const { friends } = useFriends();

  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  // Reset selection + note each time the sheet opens.
  useEffect(() => {
    if (visible) { setPicked([]); setNote(''); setSending(false); }
  }, [visible]);

  const toggle = (id: string) =>
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const send = async () => {
    if (picked.length === 0 || sending) return;
    setSending(true);
    const body = shareBody(eventTitle, eventId, note);
    let sent = 0;
    for (const friendId of picked) {
      try {
        const { id: chatId } = await api.createChat([friendId], 'dm');
        await api.sendMessage(chatId, body);
        sent++;
      } catch {
        /* best-effort per friend — keep going, report the count below */
      }
    }
    if (sent > 0) {
      showToast({ message: `Shared with ${sent} friend${sent === 1 ? '' : 's'}.`, kind: 'success' });
      onClose();
    } else {
      showToast({ message: "Couldn't share — try again.", kind: 'error' });
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', paddingBottom: kbHeight }}
      >
        <Pressable
          onPress={() => { /* swallow taps inside the sheet */ }}
          style={{
            backgroundColor: t.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 20, paddingBottom: insets.bottom + 20, gap: 14,
            maxHeight: '82%',
          }}
        >
          <View>
            <SCText variant="mono" size={10} weight="600" color={t.ink3}>SHARE TO FRIENDS</SCText>
            <SCText variant="displayTight" size={22} numberOfLines={1} style={{ marginTop: 2 }}>
              {eventTitle}
            </SCText>
          </View>

          {friends.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <SCIcon name="people" size={28} color={t.ink3} />
              <SCText size={13} color={t.ink3} style={{ marginTop: 8, textAlign: 'center' }}>
                Add friends to share events with them.
              </SCText>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
              {friends.map((p, i) => {
                const on = picked.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggle(p.id)}
                    accessibilityLabel={`Share with ${p.name}`}
                    style={({ pressed }) => [{
                      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.line,
                    }, pressed && { opacity: 0.85 }]}
                  >
                    <SCAvatar person={p} size={38} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <SCText size={15} weight="600">{p.name}</SCText>
                      {!!p.username && <SCText variant="mono" size={11} color={t.ink3}>@{p.username}</SCText>}
                    </View>
                    <View style={{
                      width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
                      borderColor: on ? t.primary : t.line,
                      backgroundColor: on ? t.primary : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {on && <SCIcon name="check" size={14} color={t.primaryInk} />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {friends.length > 0 && (
            <TextInput
              value={note}
              onChangeText={(v) => setNote(v.slice(0, 200))}
              placeholder="Add a note (optional)"
              placeholderTextColor={t.ink3}
              style={{
                minHeight: 44, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1,
                borderRadius: RADIUS.md, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10,
                color: t.ink, fontSize: 14, textAlignVertical: 'top',
              }}
              multiline
            />
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [{
                flex: 1, height: 48, borderRadius: RADIUS.lg,
                borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
                alignItems: 'center', justifyContent: 'center',
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={12} weight="600">CANCEL</SCText>
            </Pressable>
            <Pressable
              onPress={send}
              disabled={picked.length === 0 || sending}
              style={({ pressed }) => [{
                flex: 2, height: 48, borderRadius: RADIUS.lg,
                backgroundColor: picked.length ? t.primary : t.subtle,
                alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
                opacity: sending ? 0.6 : 1,
              }, pressed && picked.length > 0 && { opacity: 0.85 }]}
            >
              <SCIcon name="send" size={14} color={picked.length ? t.primaryInk : t.ink3} />
              <SCText variant="mono" size={12} weight="700" color={picked.length ? t.primaryInk : t.ink3}>
                {sending ? 'SENDING…' : picked.length > 1 ? `SEND · ${picked.length}` : 'SEND'}
              </SCText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
