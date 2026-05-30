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
  SC_ACCOUNT_BY_ID,
  SC_EVENT_BY_ID,
} from '@/data/mocks';
import type { Chat, ChatMember } from '@/types/domain';
import { WebAvatar } from './WebAvatar';
import { WebIcon } from './WebIcon';
import { WebTip } from './WebTip';

interface ChatMeta {
  /** Primary line — display name shown on the row. */
  title: string;
  /** Avatar subject. DM = the other person; event = host (org). */
  person: ChatMember | null;
  /** Secondary caption (event note or @handle). */
  sub: string;
}

/**
 * Resolve the avatar + label pair for a chat row. Mirrors the
 * prototype's `wChatMeta` (web-screens-c.jsx) but uses live `chat`
 * fields where available — falling back to SC_* fixtures in mock mode
 * — so the same component renders correctly under both modes.
 *
 * Mock-leak inventory: every SC_* read is gated by `api.isMock()` so
 * that a live UUID can never accidentally hit a fixture entry. Live
 * mode already populates `c.title` + `c.members` from the joined
 * `chats` query, so the fallbacks are defensive only.
 */
function wChatMeta(c: Chat): ChatMeta {
  const mock = api.isMock();
  if (c.kind === 'event') {
    const ev = mock && c.eventId ? SC_EVENT_BY_ID[c.eventId] : undefined;
    return {
      title: c.title || ev?.title || 'Event chat',
      // Real-data chat members are the only safe source here; the
      // previous host-fixture fallback only worked in mock mode and
      // silently returned null for live UUIDs.
      person: c.members?.[0] ?? null,
      sub: 'Event group chat',
    };
  }
  // DM: live mode carries the other-side display on c.title + c.members;
  // mock mode looks up SC_VISIBLE_PERSON_BY_ID (or SC_ACCOUNT_BY_ID for
  // accounts not currently visible — e.g. blocked) so the row still
  // renders a name even if the person is filtered from the feed.
  const member = c.members?.[0] ?? null;
  if (member) {
    return {
      title: c.title ?? member.name ?? 'Direct message',
      person: member,
      sub: 'Direct message',
    };
  }
  const p = mock && c.personId
    ? SC_VISIBLE_PERSON_BY_ID[c.personId] ?? SC_ACCOUNT_BY_ID[c.personId]
    : null;
  return {
    title: c.title ?? p?.name ?? 'Direct message',
    person: p ? { id: p.id, name: p.name, picture: p.picture, type: p.type } : null,
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
          <div
            style={{
              padding: '20px 12px',
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: t.ink3,
            }}
          >
            Loading…
          </div>
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
                <div style={{ position: 'relative' }}>
                  <WebAvatar
                    person={meta.person}
                    size={48}
                    // Event chats use the org-style square; DM keeps the
                    // circle. The square + dark fill match the design
                    // (which mirrors org avatars elsewhere in the app).
                    square={c.kind === 'event'}
                  />
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
