// Notifications full-page feed (web).
//
// The rail's activity dropdown is the dense one; this page is the
// "see all" destination — centered max-720 column, rows grouped by
// Today / Yesterday / Earlier, "Mark all read" at the top. Reuses
// WebActivityRow (the same row component the dropdown renders).
//
// The route is registered in app/_layout.tsx (`notifications`) and
// resolves to `notifications.tsx` (the native fallback) on iOS/Android
// and to this file on the web.

import { useMemo } from 'react';
import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationRow } from '@/hooks/useNotifications';
import { WebActivityRow } from '@/web/WebActivityRow';
import { WebIcon } from '@/web/WebIcon';
import { WebButton } from '@/web/WebButton';

interface Group {
  key: 'today' | 'yesterday' | 'earlier';
  label: string;
  rows: NotificationRow[];
}

function dayKey(iso: string): Group['key'] {
  try {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return 'earlier';
    const today = new Date();
    const sameDay =
      then.getFullYear() === today.getFullYear() &&
      then.getMonth() === today.getMonth() &&
      then.getDate() === today.getDate();
    if (sameDay) return 'today';
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    const isYest =
      then.getFullYear() === yest.getFullYear() &&
      then.getMonth() === yest.getMonth() &&
      then.getDate() === yest.getDate();
    if (isYest) return 'yesterday';
    return 'earlier';
  } catch {
    return 'earlier';
  }
}

export default function WebNotificationsScreen() {
  const t = useTokens();
  const { data, loading, error, reload, markRead, markAllRead } = useNotifications();
  const unread = useMemo(() => data.filter(n => !n.read).length, [data]);

  const groups: Group[] = useMemo(() => {
    const today: NotificationRow[] = [];
    const yest: NotificationRow[] = [];
    const earlier: NotificationRow[] = [];
    for (const n of data) {
      const k = dayKey(n.created_at);
      if (k === 'today') today.push(n);
      else if (k === 'yesterday') yest.push(n);
      else earlier.push(n);
    }
    const out: Group[] = [];
    if (today.length) out.push({ key: 'today', label: 'Today', rows: today });
    if (yest.length) out.push({ key: 'yesterday', label: 'Yesterday', rows: yest });
    if (earlier.length) out.push({ key: 'earlier', label: 'Earlier', rows: earlier });
    return out;
  }, [data]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        background: t.surface,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '40px 32px 60px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: t.card, border: `1px solid ${t.line}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: t.ink,
            }}
          >
            <WebIcon name="back" size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: FONT.display,
                fontWeight: 800,
                fontSize: 32,
                letterSpacing: '-0.04em',
                color: t.ink,
                lineHeight: 1.05,
              }}
            >
              Activity
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                color: t.ink3,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginTop: 4,
              }}
            >
              {data.length} total · {unread} unread
            </div>
          </div>
          {unread > 0 && (
            <WebButton tone="soft" size="sm" onClick={() => markAllRead()}>
              Mark all read
            </WebButton>
          )}
        </div>

        {/* Body */}
        {loading && data.length === 0 ? (
          <div
            style={{
              padding: 32,
              color: t.ink3,
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            Loading…
          </div>
        ) : data.length === 0 ? (
          <div
            style={{
              border: `1px dashed ${t.line}`,
              borderRadius: 16,
              padding: '48px 24px',
              textAlign: 'center',
              color: t.ink3,
            }}
          >
            <div
              style={{
                fontFamily: FONT.display,
                fontWeight: 700,
                fontSize: 20,
                color: t.ink2,
                marginBottom: 6,
              }}
            >
              You&apos;re all caught up
            </div>
            <div style={{ fontSize: 13 }}>
              {error ? 'Couldn’t load activity right now.' : 'Replies, requests + reminders land here.'}
            </div>
            {error && (
              <div style={{ marginTop: 16 }}>
                <WebButton tone="ghost" size="sm" icon="refresh" onClick={reload}>
                  Try again
                </WebButton>
              </div>
            )}
          </div>
        ) : (
          groups.map(g => (
            <div key={g.key} style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: t.ink3,
                  marginBottom: 12,
                }}
              >
                {g.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {g.rows.map(n => (
                  <WebActivityRow
                    key={n.id}
                    notification={n}
                    markRead={markRead}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
