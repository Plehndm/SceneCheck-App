// WebActivityRow — shared notification row used by both the rail's
// activity dropdown (WebActivityPanel) AND the full-page
// /notifications screen. Port of the design's WActivityRow.
//
// Each row maps a `notification.type` to a presentation:
//   • friend_request → avatar + "X wants to be friends" + Accept/Ignore
//     buttons; the actions hit the store + api directly via
//     useFriendRequests-style mutators (acceptFriendRequest /
//     declineFriendRequest) so the rail bell badge ticks the moment
//     the user clicks.
//   • event_invite / event_reminder / event_update → message + "View
//     event" CTA → /event/[id]. Deep link from payload_json.
//   • chat_reply → "X: <preview>" + "Open chat" → /chat/[id].
//   • rating_received → "X rated your event" + "See reviews" →
//     /ratings/[hostId].
//   • generic fallback → renders payload.title + payload.body + uses
//     `deep_link` as the CTA target.
//
// `onClose` (optional) lets the panel close itself when the row
// navigates — the full-page view passes nothing.

import { useMemo } from 'react';
import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { WebIcon, type WebIconName } from './WebIcon';
import type { NotificationRow } from '@/hooks/useNotifications';

interface Props {
  notification: NotificationRow;
  /** Optional close hook — the dropdown panel passes this. */
  onClose?: () => void;
  /** Marks the row as read; supplied by both the panel + the page. */
  markRead?: (id: string) => void;
  /** Render a tighter row (used inside the dropdown). */
  compact?: boolean;
}

// Time-since-created in the same casual register the design uses
// ("2h ago", "yesterday", "Mar 14"). Kept inline so the row stays
// drop-in across the two surfaces.
function relativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const now = Date.now();
    const dSec = Math.max(0, Math.round((now - then) / 1000));
    if (dSec < 60) return 'just now';
    const dMin = Math.round(dSec / 60);
    if (dMin < 60) return `${dMin}m ago`;
    const dHr = Math.round(dMin / 60);
    if (dHr < 24) return `${dHr}h ago`;
    const dDay = Math.round(dHr / 24);
    if (dDay === 1) return 'yesterday';
    if (dDay < 7) return `${dDay}d ago`;
    const d = new Date(then);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

interface RowMeta {
  icon: WebIconName;
  accentToken: 'primary' | 'accentBlue' | 'accentFriend' | 'good' | 'warn';
  title: string;
  body: string;
  cta?: string;
  ctaHref?: string;
  isRequest?: boolean;
  // For friend_request rows we need to know who the requester is so
  // the store mutators can move them into the friends set.
  requestPersonId?: string;
  requestId?: string;
}

// Read a payload value defensively — notification.payload_json comes
// from the dispatch Edge Function so the exact shape varies per type.
function p(payload: Record<string, unknown> | null | undefined, key: string): string | undefined {
  if (!payload) return undefined;
  const v = payload[key];
  return typeof v === 'string' ? v : undefined;
}
function pNum(payload: Record<string, unknown> | null | undefined, key: string): string | undefined {
  if (!payload) return undefined;
  const v = payload[key];
  return v == null ? undefined : String(v);
}

export function WebActivityRow({
  notification: n,
  onClose,
  markRead,
  compact = false,
}: Props) {
  const t = useTokens();
  const acceptStore = useStore(s => s.acceptFriendRequest);
  const declineStore = useStore(s => s.declineFriendRequest);
  const friends = useStore(s => s.friends);
  const incoming = useStore(s => s.incomingRequests);
  const showToast = useStore(s => s.showToast);

  const meta: RowMeta = useMemo(() => {
    const pl = n.payload_json ?? {};
    const senderName = p(pl, 'sender_name') ?? p(pl, 'name') ?? p(pl, 'from_name') ?? 'Someone';
    const eventTitle = p(pl, 'event_title') ?? p(pl, 'title') ?? 'an event';
    const eventId = pNum(pl, 'event_id') ?? pNum(pl, 'eventId');
    const chatId = pNum(pl, 'chat_id') ?? pNum(pl, 'chatId');
    const hostId = pNum(pl, 'host_id') ?? pNum(pl, 'hostId');
    const personId = pNum(pl, 'person_id') ?? pNum(pl, 'from_id') ?? pNum(pl, 'sender_id');
    const requestId = pNum(pl, 'request_id') ?? pNum(pl, 'requestId');
    const preview = p(pl, 'preview') ?? p(pl, 'body') ?? '';
    const deepLink = p(pl, 'deep_link');

    switch (n.type) {
      case 'friend_request':
        return {
          icon: 'user-plus',
          accentToken: 'accentBlue',
          title: `${senderName} wants to be friends`,
          body: preview || (p(pl, 'note') ?? ''),
          isRequest: true,
          requestPersonId: personId,
          requestId: requestId,
        };
      case 'event_invite':
        return {
          icon: 'calendar-plus',
          accentToken: 'accentFriend',
          title: `${senderName} invited you to ${eventTitle}`,
          body: preview,
          cta: 'View event',
          ctaHref: eventId ? `/event/${eventId}` : deepLink,
        };
      case 'event_reminder':
        return {
          icon: 'bell',
          accentToken: 'primary',
          title: `${eventTitle} starts soon`,
          body: preview || 'Tap to view details.',
          cta: 'View event',
          ctaHref: eventId ? `/event/${eventId}` : deepLink,
        };
      case 'event_update':
        return {
          icon: 'edit',
          accentToken: 'warn',
          title: `${eventTitle} changed`,
          body: preview || 'The host updated this event.',
          cta: 'View event',
          ctaHref: eventId ? `/event/${eventId}` : deepLink,
        };
      case 'chat_reply':
      case 'chat_message':
        return {
          icon: 'chat',
          accentToken: 'good',
          title: `${senderName} replied`,
          body: preview || '(new message)',
          cta: 'Open chat',
          ctaHref: chatId ? `/chat/${chatId}` : deepLink,
        };
      case 'rating_received':
        return {
          icon: 'star',
          accentToken: 'warn',
          title: `${senderName} rated your event`,
          body: preview || 'Tap to see the new review.',
          cta: 'See reviews',
          ctaHref: hostId ? `/ratings/${hostId}` : deepLink,
        };
      case 'waitlist_promotion':
        // FR5.5 — the highest-signal notification a user can receive:
        // a confirmed spot just opened on an event they were waitlisted
        // for. Treat it as a 'good' (green) accent with a direct deep
        // link to the event so the tap target reads as "claim your spot",
        // not generic "something happened".
        return {
          icon: 'check',
          accentToken: 'good',
          title: `You're in — ${eventTitle} has a spot for you`,
          body: preview || 'Tap to view event details.',
          cta: 'View event',
          ctaHref: eventId ? `/event/${eventId}` : deepLink,
        };
      default: {
        const title = p(pl, 'title') ?? n.type.replace(/_/g, ' ');
        const body = p(pl, 'body') ?? '';
        return {
          icon: 'bell',
          accentToken: 'primary',
          title,
          body,
          cta: deepLink ? 'Open' : undefined,
          ctaHref: deepLink,
        };
      }
    }
  }, [n]);

  const accent =
    meta.accentToken === 'primary' ? t.primary
    : meta.accentToken === 'accentBlue' ? t.accentBlue
    : meta.accentToken === 'accentFriend' ? t.accentFriend
    : meta.accentToken === 'good' ? t.good
    : t.warn;

  const navigate = (href?: string) => {
    if (markRead && !n.read) markRead(n.id);
    if (href) router.push(href as never);
    onClose?.();
  };

  // friend_request rows have a different footer: action buttons in
  // place of the CTA, with a "handled" state once accept/decline has
  // fired (or if the request is no longer in the incoming set).
  const isPendingRequest =
    meta.isRequest && meta.requestId != null && incoming.has(meta.requestId);
  const isAcceptedRequest =
    meta.isRequest && meta.requestPersonId != null && friends.has(meta.requestPersonId);

  const accept = async () => {
    if (!meta.requestId || !meta.requestPersonId) return;
    acceptStore(meta.requestId, meta.requestPersonId);
    showToast({ message: 'Friend request accepted.', kind: 'success' });
    if (markRead && !n.read) markRead(n.id);
    try { await api.acceptFriendRequest(meta.requestId); }
    catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't accept: ${e.message}` : "Couldn't accept.",
        kind: 'error',
      });
    }
  };

  const decline = async () => {
    if (!meta.requestId) return;
    declineStore(meta.requestId);
    showToast({ message: 'Request declined.', kind: 'info' });
    if (markRead && !n.read) markRead(n.id);
    try { await api.declineFriendRequest(meta.requestId); }
    catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't decline: ${e.message}` : "Couldn't decline.",
        kind: 'error',
      });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: compact ? 11 : 14,
        background: t.card,
        border: `1px solid ${n.read ? t.line : accent}`,
        borderRadius: compact ? 13 : 16,
        padding: compact ? '11px 12px' : '14px 16px',
        opacity: n.read ? 0.92 : 1,
        position: 'relative',
      }}
    >
      {/* Unread dot — design uses a tiny accent dot in the corner. */}
      {!n.read && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: compact ? 6 : 8,
            right: compact ? 8 : 10,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: accent,
          }}
        />
      )}
      <div
        style={{
          width: compact ? 36 : 42,
          height: compact ? 36 : 42,
          borderRadius: compact ? 10 : 12,
          flexShrink: 0,
          background: `color-mix(in oklab, ${accent} 16%, ${t.card})`,
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WebIcon name={meta.icon} size={compact ? 17 : 20} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: compact ? 12.5 : 14,
            fontWeight: 600,
            lineHeight: 1.25,
            color: t.ink,
            paddingRight: !n.read ? 14 : 0,
          }}
        >
          {meta.title}
        </div>
        {meta.body && (
          <div
            style={{
              fontSize: compact ? 11 : 12.5,
              color: t.ink3,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: compact ? 'nowrap' : 'normal',
            }}
          >
            {meta.body}
          </div>
        )}

        {meta.isRequest && (
          <div style={{ display: 'flex', gap: 7, marginTop: 9, alignItems: 'center' }}>
            {isPendingRequest ? (
              <>
                <button
                  type="button"
                  onClick={accept}
                  style={{
                    height: compact ? 28 : 32,
                    padding: compact ? '0 11px' : '0 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: t.primary,
                    color: t.primaryInk,
                    cursor: 'pointer',
                    fontFamily: FONT.mono,
                    fontSize: compact ? 9.5 : 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={decline}
                  style={{
                    height: compact ? 28 : 32,
                    padding: compact ? '0 11px' : '0 14px',
                    borderRadius: 10,
                    border: `1px solid ${t.line}`,
                    background: t.card,
                    color: t.ink2,
                    cursor: 'pointer',
                    fontFamily: FONT.mono,
                    fontSize: compact ? 9.5 : 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Ignore
                </button>
              </>
            ) : (
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  color: isAcceptedRequest ? t.good : t.ink3,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {isAcceptedRequest ? '✓ Accepted' : 'Handled'}
              </span>
            )}
          </div>
        )}
      </div>

      {!meta.isRequest && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              color: t.ink3,
            }}
          >
            {relativeTime(n.created_at)}
          </span>
          {meta.cta && (
            <button
              type="button"
              onClick={() => navigate(meta.ctaHref)}
              style={{
                height: compact ? 28 : 32,
                padding: compact ? '0 11px' : '0 14px',
                borderRadius: 10,
                border: `1px solid ${t.line}`,
                background: t.surface,
                color: t.ink,
                cursor: 'pointer',
                fontFamily: FONT.mono,
                fontSize: compact ? 9.5 : 10.5,
                fontWeight: 600,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
              }}
            >
              {meta.cta}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
