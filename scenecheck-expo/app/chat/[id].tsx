// Chat thread — DM or group/event chat. Sends optimistic-status messages
// ('sending' → 'sent' or 'failed' under the offline tweak) with a retry
// CTA. The legacy long-press → edit/delete flow is left for Phase 4.x
// (it needs gesture-handler wiring on RN).

import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCText } from '@/components/SCText';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChats } from '@/hooks/useChats';
import { useEvent } from '@/hooks/useEvent';
import { api } from '@/lib/api';
import type { MessageType } from '@/types/domain';
import { SC_VISIBLE_PERSON_BY_ID } from '@/data/mocks';
import { whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';

export default function ChatThreadScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useStore(s => s.showToast);
  const mock = api.isMock();
  // useChatMessages owns the message list, the realtime subscription,
  // and the optimistic send / retry path. The legacy UIMessage shape
  // is preserved so the screen below doesn't have to change.
  const { messages: msgs, send, retry, reload } = useChatMessages(id);
  // Re-fetch the thread when it regains focus (returning to it) so the latest
  // messages show even if a realtime event was missed — the initial mount
  // already fetches, so skip the first focus to avoid a double fetch.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      reload();
    }, [reload]),
  );
  // Header data: the chat row comes from the (dual-mode) chat list and the
  // event banner from useEvent — both Supabase-backed in live mode, so the
  // header reads no SC_* there.
  const { chats } = useChats();
  const chat = id ? (chats.find(c => c.id === id) ?? null) : null;
  const { event } = useEvent(chat?.kind === 'event' ? chat.eventId : undefined);
  // DM display name: live carries it on chat.title; mock resolves the fixture.
  const personName = chat?.kind === 'dm'
    ? (chat.title ?? (mock ? SC_VISIBLE_PERSON_BY_ID[chat.personId ?? '']?.name : undefined))
    : undefined;

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // FR9.5 — announcement composer state. The toggle is only rendered for
  // event group chats where api.canPostAnnouncement returns true (the
  // viewer is the event's creator). It auto-deactivates after a send so
  // the next message defaults to normal.
  const [canAnnounce, setCanAnnounce] = useState(false);
  const [announceNext, setAnnounceNext] = useState(false);
  useEffect(() => {
    // Reset on chat change, then fetch the capability. The api.canPost
    // Announcement helper returns false for DMs and for non-creators,
    // so we don't need to gate on chat.kind here — the helper does it.
    let cancelled = false;
    setCanAnnounce(false);
    setAnnounceNext(false);
    if (!id) return;
    api.canPostAnnouncement(id)
      .then(ok => { if (!cancelled) setCanAnnounce(ok); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change. Clean up the pending timer
    // on unmount / re-run so it can't fire against a stale ref (M7). Depend
    // on the message array identity, not just its length, so edited /
    // replaced messages (same length, different content) still re-scroll.
    const tid = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(tid);
  }, [msgs]);

  // Mock-only: a DM with someone who blocked you renders an unavailable stub
  // (the blockedYou fixture). Live blocking is enforced by RLS — such a chat
  // simply wouldn't appear in the list.
  if (mock && chat?.kind === 'dm' && !SC_VISIBLE_PERSON_BY_ID[chat.personId ?? '']) {
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

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    // FR9.5 — if the announcement toggle is on, mark the outgoing message
    // as 'announcement' and reset the toggle so the next message defaults
    // back to normal. The hook + api both forward this through; backend
    // RLS verifies the sender is the event's creator.
    const messageType: MessageType = announceNext ? 'announcement' : 'normal';
    setAnnounceNext(false);
    try {
      await send(text, messageType);
    } catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't send: ${e.message}` : "Couldn't send.",
        kind: 'error',
      });
    }
  };

  // Prefer the chat's own title (the event chat's name / the DM partner's
  // name) and fall back to the resolved event title.
  const title = chat?.kind === 'event'
    ? (chat?.title ?? event?.title ?? 'Chat')
    : (personName ?? 'Chat');
  const subtitle = chat?.kind === 'event' ? 'EVENT GROUP CHAT' : 'DIRECT MESSAGE';

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
            // FR9.5 — announcements get a tinted card + "ANNOUNCEMENT"
            // caption + bell icon so they stand out from chatter. The
            // bubble takes the full available width (90%) and is colored
            // with the warn token (yellow) regardless of sender, so a fast-
            // scrolling user can't miss it. Normal messages render exactly
            // as before.
            const isAnnouncement = m.messageType === 'announcement';
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: isAnnouncement ? 'stretch' : (isHost ? 'flex-end' : 'flex-start'),
                  maxWidth: isAnnouncement ? '100%' : '78%',
                }}
              >
                {showWho && !isAnnouncement && (
                  <SCText variant="mono" size={10} color={t.ink3} style={{ marginLeft: 12, marginBottom: 2 }}>
                    {m.who} · {m.time}
                  </SCText>
                )}
                {isAnnouncement ? (
                  <View style={{
                    paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.lg,
                    backgroundColor: t.warn + '26',
                    borderWidth: 1.5, borderColor: t.warn,
                    opacity: m.status === 'sending' ? 0.7 : 1,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <SCIcon name="bell" size={14} color={t.warnInk} />
                      <SCText variant="mono" size={10} weight="700" color={t.warnInk}>
                        ANNOUNCEMENT{m.who && m.from === 'them' ? ` · ${m.who}` : ''} · {m.time}
                      </SCText>
                    </View>
                    <SCText size={15} weight="600" color={t.ink} style={{ lineHeight: 21 }}>
                      {m.text}
                      {m.edited && (
                        <SCText variant="mono" size={9} weight="600" color={t.ink3}>
                          {'  '}(EDITED)
                        </SCText>
                      )}
                    </SCText>
                  </View>
                ) : (
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
                )}
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

        {/* Composer — lift it off the bottom edge (+ the home-indicator inset
            on devices that have one) so it isn't cramped against the screen.
            FR9.5: when the viewer can post announcements, a small chip above
            the input row toggles the next message into "announcement" mode. */}
        <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 24 }}>
          {canAnnounce && (
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Pressable
                onPress={() => setAnnounceNext(v => !v)}
                accessibilityLabel="Toggle announcement"
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: announceNext ? t.warn : t.line,
                  backgroundColor: announceNext ? t.warn + '33' : t.card,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCIcon name="bell" size={12} color={announceNext ? t.warnInk : t.ink2} />
                <SCText
                  variant="mono" size={10} weight="700"
                  color={announceNext ? t.warnInk : t.ink2}
                >
                  {announceNext ? 'ANNOUNCEMENT · ON' : 'ANNOUNCEMENT'}
                </SCText>
              </Pressable>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
              placeholder={announceNext ? 'Send an announcement…' : 'Message…'}
              placeholderTextColor={t.ink3}
              style={{
                flex: 1, height: 44, borderRadius: RADIUS.lg,
                backgroundColor: t.card,
                borderWidth: 1,
                borderColor: announceNext ? t.warn : t.line,
                paddingHorizontal: 14, color: t.ink, fontSize: 14,
              }}
            />
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [{
                width: 44, height: 44, borderRadius: RADIUS.lg,
                backgroundColor: announceNext ? t.warn : t.primary,
                alignItems: 'center', justifyContent: 'center',
              }, pressed && { opacity: 0.85 }]}
            >
              <SCIcon name="send" size={16} color={announceNext ? t.warnInk : t.primaryInk} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
