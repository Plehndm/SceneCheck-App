// Chat thread — DM or group/event chat. Sends optimistic-status messages
// ('sending' → 'sent' or 'failed' under the offline tweak) with a retry
// CTA. The legacy long-press → edit/delete flow is left for Phase 4.x
// (it needs gesture-handler wiring on RN).

import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SCText } from '@/components/SCText';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import {
  SC_CHATS, SC_THREADS, SC_EVENT_BY_ID, SC_VISIBLE_PERSON_BY_ID,
} from '@/data/mocks';
import { whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';
import type { Message } from '@/types/domain';

type Status = 'sending' | 'sent' | 'failed';
interface UIMessage extends Message {
  id: string;
  status?: Status;
  edited?: boolean;
}

export default function ChatThreadScreen() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const offline = useStore(s => s.tweaks.offline);
  const showToast = useStore(s => s.showToast);

  const chat = id ? SC_CHATS.find(c => c.id === id) : null;
  const event = chat?.kind === 'event' && chat.eventId ? SC_EVENT_BY_ID[chat.eventId] : null;
  const person = chat?.kind === 'dm' && chat.personId ? SC_VISIBLE_PERSON_BY_ID[chat.personId] : null;

  // DM with a user who blocked you → unavailable stub
  if (chat?.kind === 'dm' && !person) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.pageBg }}>
        <SCTopBar onBack={() => router.back()} subtitle="DIRECT MESSAGE" />
        <View style={{ padding: 40, alignItems: 'center' }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32, backgroundColor: t.subtle,
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <SCIcon name="lock" size={24} color={t.ink3} />
          </View>
          <SCText size={17} weight="600">Conversation unavailable</SCText>
          <SCText size={13} color={t.ink3} style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
            You can&apos;t message this account right now.
          </SCText>
        </View>
      </SafeAreaView>
    );
  }

  const seed = (id && SC_THREADS[id]) || [];
  const [msgs, setMsgs] = useState<UIMessage[]>(
    seed.map(m => ({ ...m, id: `seed-${Math.random()}`, status: m.from === 'host' ? 'sent' : undefined }))
  );
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const nextIdRef = useRef(1);

  useEffect(() => {
    // Auto-scroll to bottom when messages change.
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs.length]);

  const send = () => {
    if (!draft.trim()) return;
    const localId = `m${nextIdRef.current++}`;
    const text = draft.trim();
    setMsgs(prev => [...prev, { id: localId, from: 'host', who: 'You', text, time: 'now', status: 'sending' }]);
    setDraft('');
    setTimeout(() => {
      setMsgs(prev => prev.map(m =>
        m.id === localId ? { ...m, status: offline ? 'failed' : 'sent' } : m
      ));
      if (offline) {
        showToast({ message: "Couldn't send — you're offline.", kind: 'error' });
      }
    }, 650);
  };

  const retry = (localId: string) => {
    setMsgs(prev => prev.map(m => m.id === localId ? { ...m, status: 'sending' } : m));
    setTimeout(() => {
      setMsgs(prev => prev.map(m =>
        m.id === localId ? { ...m, status: offline ? 'failed' : 'sent' } : m
      ));
    }, 650);
  };

  const title = event ? chat?.title ?? event.title :
                person ? person.name :
                'Chat';
  const subtitle = event ? 'EVENT GROUP CHAT' : 'DIRECT MESSAGE';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.pageBg }} edges={['top']}>
      <SCTopBar
        onBack={() => router.back()}
        subtitle={subtitle}
        title={title}
        right={event ? (
          <Pressable
            onPress={() => router.push(`/event/${event.id}` as never)}
            style={({ pressed }) => [{
              width: 38, height: 38, borderRadius: RADIUS.md,
              borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
              alignItems: 'center', justifyContent: 'center',
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="pin" size={16} color={t.ink} />
          </Pressable>
        ) : null}
      />

      {event && (
        <Pressable
          onPress={() => router.push(`/event/${event.id}` as never)}
          style={({ pressed }) => [{
            marginHorizontal: 14, marginBottom: 8, padding: 12,
            backgroundColor: t.subtle, borderRadius: RADIUS.lg,
            flexDirection: 'row', alignItems: 'center', gap: 10,
          }, pressed && { opacity: 0.85 }]}
        >
          <View style={{
            width: 32, height: 32, borderRadius: RADIUS.md,
            backgroundColor: t.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <SCIcon name="calendar" size={14} color={t.primaryInk} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <SCText size={12} weight="600">{whenRange(event)} · {event.where}</SCText>
            <SCText size={11} color={t.ink3}>{event.attendees} going · tap to view</SCText>
          </View>
          <SCIcon name="chevron-right" size={14} color={t.ink3} />
        </Pressable>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, paddingHorizontal: 14 }}
          contentContainerStyle={{ paddingVertical: 8, gap: 6 }}
        >
          {msgs.map((m, i) => {
            const showWho = m.from === 'them' && (i === 0 || msgs[i - 1].who !== m.who);
            const isHost = m.from === 'host';
            return (
              <View key={m.id} style={{ alignSelf: isHost ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                {showWho && (
                  <SCText variant="mono" size={10} color={t.ink3} style={{ marginLeft: 12, marginBottom: 2 }}>
                    {m.who} · {m.time}
                  </SCText>
                )}
                <View style={{
                  paddingVertical: 10, paddingHorizontal: 14, borderRadius: RADIUS.lg,
                  backgroundColor: isHost
                    ? (m.status === 'failed' ? t.danger : t.primary)
                    : t.card,
                  borderWidth: isHost ? 0 : 1,
                  borderColor: t.line,
                  opacity: m.status === 'sending' ? 0.7 : 1,
                }}>
                  <SCText
                    size={14}
                    color={isHost ? (m.status === 'failed' ? 'white' : t.primaryInk) : t.ink}
                    style={{ lineHeight: 19 }}
                  >
                    {m.text}
                    {m.edited && (
                      <SCText variant="mono" size={9} weight="600" color={isHost ? t.primaryInk : t.ink3}>
                        {'  '}(EDITED)
                      </SCText>
                    )}
                  </SCText>
                </View>
                {isHost && m.status && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                    marginTop: 3, marginRight: 4,
                  }}>
                    {m.status === 'sending' && (
                      <SCText variant="mono" size={9} weight="600" color={t.ink3}>SENDING…</SCText>
                    )}
                    {m.status === 'sent' && (
                      <>
                        <SCIcon name="check" size={10} color={t.ink3} />
                        <SCText variant="mono" size={9} weight="600" color={t.ink3}>SENT</SCText>
                      </>
                    )}
                    {m.status === 'failed' && (
                      <>
                        <SCText variant="mono" size={9} weight="600" color={t.danger}>FAILED</SCText>
                        <Pressable onPress={() => retry(m.id)}>
                          <SCText variant="mono" size={9} weight="700" color={t.danger} style={{ textDecorationLine: 'underline' }}>
                            RETRY
                          </SCText>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Composer */}
        <View style={{
          paddingHorizontal: 14, paddingTop: 8, paddingBottom: 16,
          flexDirection: 'row', gap: 8, alignItems: 'center',
        }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            placeholder="Message…"
            placeholderTextColor={t.ink3}
            style={{
              flex: 1, height: 44, borderRadius: RADIUS.lg,
              backgroundColor: t.card, borderWidth: 1, borderColor: t.line,
              paddingHorizontal: 14, color: t.ink, fontSize: 14,
            }}
          />
          <Pressable
            onPress={send}
            style={({ pressed }) => [{
              width: 44, height: 44, borderRadius: RADIUS.lg,
              backgroundColor: t.primary,
              alignItems: 'center', justifyContent: 'center',
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="send" size={16} color={t.primaryInk} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
