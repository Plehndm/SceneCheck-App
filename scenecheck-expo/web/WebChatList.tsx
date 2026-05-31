// WebChatList — left pane of the desktop two-pane Chat layout.
// Port of `WChat`'s conversation-list column from `web-screens-c.jsx`.
//
// Lives in `web/` (not under `app/`) so both the `(tabs)/chat.web.tsx`
// hub AND the `chat/[id].web.tsx` thread route can mount the exact
// same component — the only difference between them is which chat id
// is marked active.
//
// Backend wiring: reads `useChats()` directly (mock-mode + live-mode
// safe, returns the same per-row unread counts). Clicking a row
// navigates to `/chat/${id}` via expo-router — the URL is the source
// of truth for "which thread is open", and the route swap is what
// drives `WebChatThread` to remount with a new id.

import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useChats } from '@/hooks/useChats';
import { api } from '@/lib/api';
import {
  SC_VISIBLE_PERSON_BY_ID,
  SC_VISIBLE_PEOPLE,
  SC_ACCOUNT_BY_ID,
  SC_EVENT_BY_ID,
} from '@/data/mocks';
import type { Chat, ChatMember } from '@/types/domain';
import { WebAvatar } from './WebAvatar';
import { WebIcon } from './WebIcon';
import { WebTip } from './WebTip';
import { WebSkeletonRows } from './WebSkeleton';

const NAMES_BEFORE_PLUS = 2;

/**
 * "Alice, Bob +3" formatter ported from the native chat tab so non-event
 * group chats (kind: 'dm' with multiple members) get a readable title
 * instead of falling through to the generic "Direct message" label.
 */
function namesTitle(members: { name?: string | null }[]): string {
  if (members.length === 0) return '';
  const names = members.map(m => m.name?.trim() || 'Someone');
  if (names.length === 1) return names[0];
  if (names.length <= NAMES_BEFORE_PLUS + 1) return names.join(', ');
  const head = names.slice(0, NAMES_BEFORE_PLUS).join(', ');
  return `${head} +${names.length - NAMES_BEFORE_PLUS}`;
}

/**
 * Up to two member-shaped objects to render as the row avatar(s).
 * Same priority order as native (`app/(tabs)/chat.tsx:chatAvatars`):
 *  1. live `c.members` from the chat_members ⨝ profiles embed,
 *  2. SC_ACCOUNT_BY_ID for DMs in mock mode,
 *  3. event host + a representative attendee for mock event chats.
 *
 * Returns 0-2 entries. The render mapping below is:
 *   0 → muted placeholder circle (uses `WebAvatar person={null}`)
 *   1 → single WebAvatar (DM/event look)
 *   2 → Instagram-style stack (front offset bottom-right with a
 *       surface-colored ring so it visually separates)
 */
function chatAvatars(c: Chat, mock: boolean): ChatMember[] {
  if (c.members && c.members.length > 0) return c.members.slice(0, 2);
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
    const second = SC_VISIBLE_PEOPLE.find(p => p.id !== ev.hostId);
    if (second) out.push({ id: second.id, name: second.name, picture: second.picture, type: second.type });
    return out;
  }
  return [];
}

interface ChatMeta {
  /** Primary line — display name shown on the row. */
  title: string;
  /** Avatar subjects (0-2). Renders as single avatar or stacked pair. */
  avatars: ChatMember[];
  /** Secondary caption (event note, member count, or @handle). */
  sub: string;
}

/**
 * Resolve the title + avatar(s) for a chat row. Now matches the native
 * chat tab's three-way split: event chats use the event title and stack
 * the host + a member; DMs (one other) use the person's name and a
 * single avatar; non-event group chats (kind: 'dm' with multiple
 * members) build "Alice, Bob +N" from the member names and stack two
 * member avatars.
 *
 * Mock-leak inventory: every SC_* read is gated by `api.isMock()`.
 */
function wChatMeta(c: Chat): ChatMeta {
  const mock = api.isMock();
  const avatars = chatAvatars(c, mock);
  if (c.kind === 'event') {
    const ev = mock && c.eventId ? SC_EVENT_BY_ID[c.eventId] : undefined;
    const memberCount = c.members?.length ?? 0;
    return {
      title: c.title || ev?.title || 'Event chat',
      avatars,
      sub: memberCount > 0
        ? `Event group · ${memberCount} member${memberCount === 1 ? '' : 's'}`
        : 'Event group chat',
    };
  }
  const otherCount = c.members?.length ?? 0;
  if (otherCount > 1) {
    return {
      title: namesTitle(c.members ?? []) || c.title || 'Group chat',
      avatars,
      sub: `Group chat · ${otherCount} members`,
    };
  }
  const member = c.members?.[0] ?? null;
  if (member) {
    return {
      title: c.title || member.name || 'Direct message',
      avatars,
      sub: 'Direct message',
    };
  }
  const p = mock && c.personId
    ? SC_VISIBLE_PERSON_BY_ID[c.personId] ?? SC_ACCOUNT_BY_ID[c.personId]
    : null;
  return {
    title: c.title ?? p?.name ?? 'Direct message',
    avatars: p ? [{ id: p.id, name: p.name, picture: p.picture, type: p.type }] : [],
    sub: p ? `@${p.username ?? ''}` : 'Direct message',
  };
}

interface Props {
  /** Which chat the right pane is currently showing (URL-derived). */
  activeChatId?: string | null;
}

export function WebChatList({ activeChatId = null }: Props) {
  const t = useTokens();
  const { chats, loading } = useChats();
  const mock = api.isMock();

  return (
    <div
      style={{
        width: 348,
        flexShrink: 0,
        borderRight: `1px solid ${t.line}`,
        overflowY: 'auto',
        background: t.surface,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header — sticky so the New-message affordance stays in view as
          the conversation list scrolls. */}
      <div
        style={{
          padding: '22px 20px 12px',
          position: 'sticky',
          top: 0,
          background: t.surface,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 800,
            fontStretch: '75%',
            letterSpacing: '-0.045em',
            fontSize: 28,
            color: t.ink,
          }}
        >
          Messages
        </div>
        <WebTip title="New message" side="bottom">
          <button
            type="button"
            onClick={() => router.push('/new-chat' as never)}
            aria-label="New message"
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
            <WebIcon name="edit" size={17} />
          </button>
        </WebTip>
      </div>

      <div style={{ padding: '4px 12px 20px', flex: 1 }}>
        {loading && chats.length === 0 ? (
          <WebSkeletonRows rows={6} />
        ) : chats.length === 0 ? (
          <div
            style={{
              padding: '24px 14px',
              fontSize: 13,
              color: t.ink3,
              lineHeight: 1.5,
            }}
          >
            No conversations yet. Tap the compose button to start one.
          </div>
        ) : (
          chats.map(c => {
            const meta = wChatMeta(c);
            const on = c.id === activeChatId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => router.push(`/chat/${c.id}` as never)}
                aria-label={`Open chat: ${meta.title}`}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 12px',
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  background: on ? t.card : 'transparent',
                  boxShadow: on ? `inset 0 0 0 1px ${t.line}` : 'none',
                  textAlign: 'left',
                  marginBottom: 2,
                  color: t.ink,
                }}
              >
                {/* Avatar(s) — 0, 1, or 2 per chatAvatars(). Event chats
                    render the host (when known) as a square org-style
                    avatar; non-event group chats stack two member faces
                    Instagram-style; DMs use a single circle. The
                    people-icon overlay is always shown on event chats
                    so the kind is visible even when avatars are unknown. */}
                <div
                  style={{
                    position: 'relative',
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                  }}
                >
                  {meta.avatars.length === 0 ? (
                    <WebAvatar
                      person={null}
                      size={48}
                      square={c.kind === 'event'}
                    />
                  ) : meta.avatars.length === 1 ? (
                    <WebAvatar
                      person={meta.avatars[0]}
                      size={48}
                      square={c.kind === 'event'}
                    />
                  ) : (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                        }}
                      >
                        <WebAvatar
                          person={meta.avatars[0]}
                          size={34}
                          square={c.kind === 'event'}
                        />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          padding: 2,
                          borderRadius: c.kind === 'event' ? 10 : '50%',
                          background: t.surface,
                        }}
                      >
                        <WebAvatar
                          person={meta.avatars[1]}
                          size={32}
                          square={c.kind === 'event'}
                        />
                      </div>
                    </>
                  )}
                  {c.kind === 'event' && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: t.accentBlue,
                        border: `2px solid ${t.surface}`,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                      }}
                    >
                      <WebIcon name="people" size={9} color="white" />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: FONT.display,
                        fontWeight: 700,
                        fontSize: 14.5,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: t.ink,
                      }}
                    >
                      {meta.title}
                    </span>
                    <span
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 9.5,
                        color: t.ink3,
                      }}
                    >
                      {c.time}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: c.unread ? t.ink : t.ink3,
                        fontWeight: c.unread ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.last}
                    </span>
                    {c.unread > 0 && (
                      <span
                        style={{
                          minWidth: 18,
                          height: 18,
                          padding: '0 5px',
                          borderRadius: 999,
                          background: t.primary,
                          color: t.primaryInk,
                          fontFamily: FONT.mono,
                          fontSize: 9.5,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
        {/* Quiet hint that live data is back-filling without blocking
            the cached list — only shown when both states coincide. */}
        {loading && chats.length > 0 && !mock && (
          <div
            style={{
              padding: '8px 12px',
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: t.ink3,
            }}
          >
            Refreshing…
          </div>
        )}
      </div>
    </div>
  );
}
