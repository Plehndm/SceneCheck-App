// WebActivityPanel — rail-pinned notifications dropdown opened from
// the bell icon on the WebRail. Wave C2 fills the panel body with
// the live notifications feed:
//
//   • Header — "Activity" + "Mark all read" link + close button.
//   • Body  — scrollable column of WebActivityRow, one per
//     notification, in compact mode. Each row's CTA navigates and
//     closes the panel.
//   • Footer — "SEE ALL ACTIVITY →" link → /notifications, the full
//     page (universal — see app/notifications.tsx).
//
// The panel is positioned absolutely inside the WebShell's main
// content area, anchored to the top-left (right of the rail). ESC +
// backdrop click both close it (Wave A behavior preserved).

import { useEffect, useRef, type CSSProperties } from 'react';
import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useNotifications } from '@/hooks/useNotifications';
import { WebIcon } from './WebIcon';
import { WebActivityRow } from './WebActivityRow';
import { useFocusTrap } from './useFocusTrap';

interface Props {
  open: boolean;
  onClose: () => void;
  width?: number;
  style?: CSSProperties;
}

export function WebActivityPanel({
  open,
  onClose,
  width = 360,
  style,
}: Props) {
  const t = useTokens();
  const { data, loading, error, markRead, markAllRead } = useNotifications();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Keep keyboard focus inside the panel while it's open. (WCAG 2.1
  // SC 2.4.3 — focus order; see `docs/WEB_BUILD_REVIEW.md` H-02.)
  useFocusTrap(open, panelRef);

  if (!open) return null;

  const unread = data.filter(n => !n.read).length;
  const isEmpty = !loading && data.length === 0;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 60,
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Activity"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          width,
          maxHeight: 'calc(100% - 24px)',
          background: t.surface,
          border: `1px solid ${t.line}`,
          borderRadius: 18,
          boxShadow: '0 30px 70px -20px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 61,
          overflow: 'hidden',
          ...style,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: `1px solid ${t.line}`,
            background: t.card,
          }}
        >
          <WebIcon name="bell" size={18} color={t.ink} />
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: t.ink,
              flex: 1,
            }}
          >
            Activity
          </div>
          {unread > 0 && (
            <span
              style={{
                background: t.primary,
                color: t.primaryInk,
                fontFamily: FONT.mono,
                fontSize: 9.5,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: '0.08em',
              }}
            >
              {unread} NEW
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              border: `1px solid ${t.line}`,
              background: t.card,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.ink,
              flexShrink: 0,
            }}
          >
            <WebIcon name="x" size={14} />
          </button>
        </div>

        {/* Mark-all-read row */}
        {unread > 0 && (
          <div
            style={{
              padding: '8px 14px',
              borderBottom: `1px solid ${t.line}`,
              display: 'flex',
              justifyContent: 'flex-end',
              background: t.surface,
            }}
          >
            <button
              type="button"
              onClick={() => markAllRead()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT.mono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: t.ink2,
                textTransform: 'uppercase',
              }}
            >
              Mark all read
            </button>
          </div>
        )}

        {/* Body */}
        <div
          style={{
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
          }}
        >
          {loading && data.length === 0 && (
            <div
              style={{
                padding: 22,
                color: t.ink3,
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              Loading…
            </div>
          )}
          {error && data.length === 0 && (
            <div
              style={{
                padding: 22,
                color: t.warn,
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: '0.06em',
                textAlign: 'center',
              }}
            >
              Couldn&apos;t load activity.
            </div>
          )}
          {isEmpty && (
            <div
              style={{
                padding: 28,
                textAlign: 'center',
                border: `1px dashed ${t.line}`,
                borderRadius: 14,
                color: t.ink3,
              }}
            >
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: 15,
                  color: t.ink2,
                  marginBottom: 4,
                }}
              >
                You&apos;re all caught up
              </div>
              <div style={{ fontSize: 12 }}>
                Replies, requests + reminders land here.
              </div>
            </div>
          )}
          {data.map(n => (
            <WebActivityRow
              key={n.id}
              notification={n}
              markRead={markRead}
              onClose={onClose}
              compact
            />
          ))}
        </div>

        {/* Footer */}
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push('/notifications' as never);
          }}
          style={{
            padding: 13,
            border: 'none',
            borderTop: `1px solid ${t.line}`,
            background: t.card,
            cursor: 'pointer',
            fontFamily: FONT.mono,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: t.ink2,
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          See all activity →
        </button>
      </div>
    </>
  );
}
