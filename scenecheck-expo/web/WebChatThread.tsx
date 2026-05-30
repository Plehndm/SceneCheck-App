// WebChatThread — right pane of the desktop two-pane Chat layout.
// Port of `WChat`'s thread column from `web-screens-c.jsx`, plumbed
// through the existing `useChatMessages` hook so we share the same
// Supabase Realtime subscription, initial-fetch, optimistic-send, and
// retry plumbing that the native screen uses (per AGENTS.md — never
// rebuild that pipeline, just consume it).
//
// Layout:
//   • Header — chat avatar + name + sub-line + "View profile" /
//     "View event" pill. Pill navigates to the relevant overlay
//     route (event/[id] or profile/[id]).
//   • History — "BEGINNING OF CONVERSATION" sentinel, then bubbles
//     (mine right-aligned with primary bg; theirs left-aligned with
//     card bg + name tag above when the sender changes — same rule
//     the native screen uses). Auto-scrolls to bottom on new
//     messages. FR9.5 announcements get a tinted card.
//   • Composer — text input + send button. Enter submits;
//     Shift+Enter inserts a newline. Send routes through
//     `useChatMessages().send` — no new wiring.

import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useChats } from '@/hooks/useChats';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useEvent } from '@/hooks/useEvent';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import {
  SC_VISIBLE_PERSON_BY_ID,
  SC_ACCOUNT_BY_ID,
  SC_EVENT_BY_ID,
} from '@/data/mocks';
import type { Chat, ChatMember } from '@/types/domain';
import { WebAvatar } from './WebAvatar';
import { WebIcon } from './WebIcon';
import { WebButton } from './WebButton';
import { WebTip } from './WebTip';

interface Props {
  chatId: string;
}

interface ResolvedHeader {
  title: string;
  sub: string;
  person: ChatMember | null;
  /** Navigates to the "view profile" / "view event" target. */
  onJump: (() => void) | null;
  jumpLabel: string | null;
}

function resolveHeader(chat: Chat | null): ResolvedHeader {
  if (!chat) return { title: 'Chat', sub: '', person: null, onJump: null, jumpLabel: null };
  // Mock-leak inventory: SC_* lookups only consulted in mock mode so a
  // live UUID can't accidentally hit a fixture entry. Live mode already
  // populates `chat.title` + `chat.members` from the joined chats query.
  const mock = api.isMock();
  if (chat.kind === 'event') {
    const ev = mock && chat.eventId ? SC_EVENT_BY_ID[chat.eventId] : undefined;
    return {
      title: chat.title || ev?.title || 'Event chat',
      // Member count when we have one (live mode), otherwise the
      // designed default. We don't have an attendees-realtime channel
      // here so the "1234 members" line is best-effort.
      sub: chat.members?.length
        ? `${chat.members.length} member${chat.members.length === 1 ? '' : 's'}`
        : 'Event group chat',
      // Prefer the first chat member (real data, live + mock). No
      // batched profile fetch is wired through here yet, so the
      // host-fixture fallback was removed — it only worked in mock.
      person: chat.members?.[0] ?? null,
      onJump: chat.eventId
        ? () => router.push(`/event/${chat.eventId}` as never)
        : null,
      jumpLabel: chat.eventId ? 'View event' : null,
    };
  }
  // DM
  const member = chat.members?.[0] ?? null;
  const p = mock && chat.personId
    ? SC_VISIBLE_PERSON_BY_ID[chat.personId] ?? SC_ACCOUNT_BY_ID[chat.personId]
    : null;
  const personId = member?.id ?? chat.personId ?? null;
  return {
    title: chat.title ?? member?.name ?? p?.name ?? 'Direct message',
    sub: p ? `@${p.username ?? p.handle ?? ''}` : 'Direct message',
    person:
      member ??
      (p ? { id: p.id, name: p.name, picture: p.picture, type: p.type } : null),
    onJump: personId
      ? () => router.push(`/profile/${personId}` as never)
      : null,
    jumpLabel: personId ? 'View profile' : null,
  };
}

export function WebChatThread({ chatId }: Props) {
  const t = useTokens();
  const mock = api.isMock();
  // Same hook the native chat list uses — guaranteed live in production
  // mode (chat_members ⨝ profiles join + realtime subscription is
  // owned by useChatMessages, not here).
  const { chats } = useChats();
  const chat = useMemo(() => chats.find(c => c.id === chatId) ?? null, [chats, chatId]);
  const { messages: msgs, send, retry } = useChatMessages(chatId);
  const { event } = useEvent(chat?.kind === 'event' ? chat.eventId : undefined);
  const showToast = useStore(s => s.showToast);

  const isGroup = chat?.kind === 'event';
  const header = resolveHeader(chat);

  // FR9.5 — announcement composer state. Mirrors `app/chat/[id].tsx:62-76`.
  // The toggle chip is only rendered for event group chats where the viewer
  // is the event creator (api.canPostAnnouncement returns true). It auto-
  // deactivates after a successful send so the next message defaults back
  // to a normal message.
  const [canAnnounce, setCanAnnounce] = useState(false);
  const [announceNext, setAnnounceNext] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCanAnnounce(false);
    setAnnounceNext(false);
    if (!chatId) return;
    api.canPostAnnouncement(chatId)
      .then(ok => { if (!cancelled) setCanAnnounce(ok); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chatId]);

  // Blocked-DM stub — mock-only. RLS blocks the row in live mode.
  const blockedDm =
    mock &&
    chat?.kind === 'dm' &&
    !!chat.personId &&
    !SC_VISIBLE_PERSON_BY_ID[chat.personId];

  // Auto-scroll to the bottom whenever the message list changes
  // (initial mount, optimistic send, realtime echo). Mirrors the
  // native screen's behavior. We use a tiny timeout so the DOM has
  // a frame to paint the new bubble before we measure.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const tid = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 30);
    return () => clearTimeout(tid);
  }, [msgs]);

  const [draft, setDraft] = useState('');

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    // FR9.5 — if the announcement toggle is on, route this message through
    // the same send pipeline with messageType='announcement' and reset the
    // toggle so the next message defaults back to normal. Backend RLS
    // verifies the sender is the event creator.
    const messageType = announceNext ? 'announcement' : 'normal';
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

  // Render fallback for the mock-only blocked-DM case so it matches
  // the native screen instead of silently rendering an empty thread.
  if (blockedDm) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          padding: 32,
          background: t.surface,
          color: t.ink3,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            background: t.subtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WebIcon name="lock" size={24} color={t.ink3} />
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 17,
            color: t.ink,
          }}
        >
          Conversation unavailable
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 280 }}>
          You can&apos;t message this account right now.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: t.surface,
      }}
    >
      {/* Header — avatar + name + jump pill. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 24px',
          borderBottom: `1px solid ${t.line}`,
          background: t.card,
        }}
      >
        <WebAvatar person={header.person} size={42} square={isGroup} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 700,
              fontSize: 17,
              color: t.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {header.title}
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10.5,
              color: t.ink3,
              marginTop: 2,
            }}
          >
            {header.sub}
          </div>
        </div>
        {header.onJump && header.jumpLabel && (
          <WebButton
            tone="ghost"
            size="sm"
            icon={isGroup ? 'pin' : 'profile'}
            onClick={header.onJump}
          >
            {header.jumpLabel}
          </WebButton>
        )}
        <WebTip title="Details" side="bottom">
          <button
            type="button"
            aria-label="Chat details"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: `1px solid ${t.line}`,
              background: t.card,
              color: t.ink,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WebIcon name="more" size={18} />
          </button>
        </WebTip>
      </div>

      {/* Optional event banner — links to the event detail overlay. */}
      {event && (
        <button
          type="button"
          onClick={() => router.push(`/event/${event.id}` as never)}
          style={{
            margin: '10px 24px 0',
            padding: '12px 14px',
            background: t.subtle,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: 'none',
            cursor: 'pointer',
            color: t.ink,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: t.primary,
              color: t.primaryInk,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <WebIcon name="calendar" size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {event.when}
              {event.where ? ` · ${event.where}` : ''}
            </div>
            <div style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
              {event.attendees} going · click to view
            </div>
          </div>
          <WebIcon name="chevron-right" size={14} color={t.ink3} />
        </button>
      )}

      {/* History */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 24px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: '0.18em',
              color: t.ink3,
              background: t.subtle,
              padding: '4px 12px',
              borderRadius: 999,
              textTransform: 'uppercase',
            }}
          >
            Beginning of conversation
          </span>
        </div>
        {msgs.map((m, i) => {
          const mine = m.from === 'host';
          const prev = msgs[i - 1];
          // Show the sender's name above the bubble whenever it changes
          // (group chats only — DMs have one other party so the label
          // is redundant). Same rule used by the native screen.
          const showWho = !mine && isGroup && (!prev || prev.who !== m.who);
          const isAnnouncement = m.messageType === 'announcement';
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isAnnouncement
                  ? 'stretch'
                  : mine
                    ? 'flex-end'
                    : 'flex-start',
                marginBottom: 6,
              }}
            >
              {showWho && !isAnnouncement && (
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    color: t.ink3,
                    margin: '6px 0 3px 8px',
                  }}
                >
                  {m.who}
                </span>
              )}
              {isAnnouncement ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: `color-mix(in oklab, ${t.warn} 18%, transparent)`,
                    border: `1.5px solid ${t.warn}`,
                    opacity: m.status === 'sending' ? 0.7 : 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 6,
                      color: t.ink,
                    }}
                  >
                    <WebIcon name="bell" size={12} />
                    <span
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                      }}
                    >
                      ANNOUNCEMENT
                      {m.who && m.from === 'them' ? ` · ${m.who}` : ''} · {m.time}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: t.ink }}>
                    {m.text}
                    {m.edited && (
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          opacity: 0.6,
                          marginLeft: 6,
                          textTransform: 'uppercase',
                        }}
                      >
                        (edited)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '10px 14px',
                    borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: mine ? t.primary : t.card,
                    color: mine ? t.primaryInk : t.ink,
                    border: mine ? 'none' : `1px solid ${t.line}`,
                    fontSize: 13.5,
                    lineHeight: 1.4,
                    opacity: m.status === 'sending' ? 0.7 : 1,
                  }}
                >
                  {m.text}
                  {m.edited && (
                    <span
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        opacity: 0.6,
                        marginLeft: 6,
                        textTransform: 'uppercase',
                      }}
                    >
                      (edited)
                    </span>
                  )}
                  <span
                    style={{
                      display: 'block',
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      opacity: 0.6,
                      marginTop: 4,
                      textAlign: 'right',
                    }}
                  >
                    {m.status === 'sending'
                      ? 'sending…'
                      : m.status === 'failed'
                        ? 'failed'
                        : m.time}
                  </span>
                </div>
              )}
              {/* M-06 — retry link for failed sends. Mirrors native
                  `app/chat/[id].tsx:274-282`. Only the host can retry
                  their own failed messages (failed status is only set on
                  optimistic sends). */}
              {mine && m.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => void retry(m.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '4px 4px 0',
                    marginTop: 2,
                    cursor: 'pointer',
                    color: t.primary,
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    textDecoration: 'underline',
                    alignSelf: 'flex-end',
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div style={{ padding: '14px 24px 20px' }}>
        {/* FR9.5 — announcement toggle chip. Only visible when the viewer
            can post announcements for this chat (event creator on an event
            chat). Tapping flips `announceNext`; the chip styling switches
            between an active "ANNOUNCEMENT" pill and an idle ghost pill. */}
        {canAnnounce && (
          <div style={{ display: 'flex', marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setAnnounceNext(v => !v)}
              aria-label="Toggle announcement"
              aria-pressed={announceNext}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                cursor: 'pointer',
                border: `1.5px solid ${announceNext ? t.warn : t.line}`,
                background: announceNext
                  ? `color-mix(in oklab, ${t.warn} 20%, transparent)`
                  : t.card,
                color: announceNext ? t.warnInk : t.ink2,
                fontFamily: FONT.mono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              <WebIcon
                name="bell"
                size={12}
                color={announceNext ? t.warnInk : t.ink2}
              />
              {announceNext ? 'Announcement · On' : 'Send as announcement'}
            </button>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            background: t.card,
            border: `1px solid ${announceNext ? t.warn : t.line}`,
            borderRadius: 16,
            padding: '8px 8px 8px 18px',
          }}
        >
          {/* textarea (not input) so Shift+Enter can insert a real
              newline while bare Enter submits. Auto-height to a sane
              cap so long drafts stay editable without the composer
              eating the history pane. */}
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={announceNext ? 'Send an announcement…' : 'Write a message…'}
            rows={1}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              fontFamily: FONT.body,
              color: t.ink,
              padding: '8px 0',
              resize: 'none',
              maxHeight: 140,
              lineHeight: 1.5,
            }}
          />
          <WebTip title="Send" side="top">
            <button
              type="button"
              onClick={submit}
              aria-label="Send message"
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                border: 'none',
                cursor: draft.trim() ? 'pointer' : 'default',
                background: draft.trim() ? t.primary : t.subtle,
                color: draft.trim() ? t.primaryInk : t.ink3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WebIcon name="send" size={18} />
            </button>
          </WebTip>
        </div>
      </div>
    </div>
  );
}
