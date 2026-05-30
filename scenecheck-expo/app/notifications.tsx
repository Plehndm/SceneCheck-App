// Notifications full-page feed (native fallback).
//
// The richer web layout lives in `notifications.web.tsx` and gets
// picked by Metro on the web platform. This native file exists so
// the route resolves on iOS/Android — useful when the rail's
// "See all activity" link / a future deep-link hits /notifications.
//
// Native rendering is intentionally simple: a scrollable list of
// SCCard rows wired to the same `useNotifications` hook. We don't
// build a native equivalent of WebActivityRow yet — when native gains
// a dedicated notifications screen, that's the place to add it.

import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCTopBar } from '@/components/SCTopBar';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCEmptyState } from '@/components/SCEmptyState';
import { SCListSkeleton } from '@/components/SCSkeleton';
import { useTokens } from '@/theme/ThemeProvider';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationRow } from '@/hooks/useNotifications';

function rel(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const dMin = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (dMin < 1) return 'just now';
    if (dMin < 60) return `${dMin}m ago`;
    const dHr = Math.round(dMin / 60);
    if (dHr < 24) return `${dHr}h ago`;
    const dDay = Math.round(dHr / 24);
    if (dDay === 1) return 'yesterday';
    if (dDay < 7) return `${dDay}d ago`;
    return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function deepLinkFor(n: NotificationRow): string | undefined {
  const p = n.payload_json ?? {};
  const eventId = typeof p['event_id'] === 'string' ? p['event_id'] : undefined;
  const chatId = typeof p['chat_id'] === 'string' ? p['chat_id'] : undefined;
  const hostId = typeof p['host_id'] === 'string' ? p['host_id'] : undefined;
  const deep = typeof p['deep_link'] === 'string' ? p['deep_link'] : undefined;
  if (n.type === 'friend_request') return '/requests';
  if (n.type === 'rating_received' && hostId) return `/ratings/${hostId}`;
  if ((n.type === 'chat_reply' || n.type === 'chat_message') && chatId) return `/chat/${chatId}`;
  if (eventId) return `/event/${eventId}`;
  return deep;
}

function titleFor(n: NotificationRow): string {
  const p = n.payload_json ?? {};
  const s = typeof p['sender_name'] === 'string' ? p['sender_name'] : 'Someone';
  const ev = typeof p['event_title'] === 'string' ? p['event_title'] : 'an event';
  const explicit = typeof p['title'] === 'string' ? p['title'] : undefined;
  if (explicit) return explicit;
  switch (n.type) {
    case 'friend_request': return `${s} wants to be friends`;
    case 'event_invite': return `${s} invited you to ${ev}`;
    case 'event_reminder': return `${ev} starts soon`;
    case 'event_update': return `${ev} changed`;
    case 'chat_reply':
    case 'chat_message': return `${s} replied`;
    case 'rating_received': return `${s} rated your event`;
    // FR5.5 — match the WebActivityRow waitlist phrasing so native and
    // web render the highest-signal notification consistently.
    case 'waitlist_promotion': return `You're in — ${ev} has a spot for you`;
    default: return n.type.replace(/_/g, ' ');
  }
}

export default function NotificationsScreen() {
  const t = useTokens();
  const { data, loading, error, reload, markRead, markAllRead } = useNotifications();
  const unread = useMemo(() => data.filter(n => !n.read).length, [data]);

  const onRow = (n: NotificationRow) => {
    if (!n.read) markRead(n.id);
    const href = deepLinkFor(n);
    if (href) router.push(href as never);
  };

  return (
    <Screen onRefresh={reload}>
      <SCTopBar onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end' }}>
        <SCText variant="displayTight" size={32} style={{ flex: 1 }}>Activity</SCText>
        {unread > 0 && (
          <Pressable onPress={() => markAllRead()}>
            <SCText variant="mono" size={11} weight="600" color={t.ink3}>
              MARK ALL READ
            </SCText>
          </Pressable>
        )}
      </View>

      {loading && data.length === 0 ? (
        <SCListSkeleton rows={5} />
      ) : data.length === 0 ? (
        <SCEmptyState
          icon="bell"
          title="You're all caught up"
          subtitle={error ? 'Couldn’t load activity. Pull to refresh.' : 'Replies, requests + reminders land here.'}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 32, gap: 8 }}>
          {data.map(n => (
            <Pressable
              key={n.id}
              onPress={() => onRow(n)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center', opacity: n.read ? 0.85 : 1 }}>
                <View style={{
                  width: 38, height: 38, borderRadius: 12, backgroundColor: t.subtle,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <SCIcon name="bell" size={18} color={n.read ? t.ink3 : t.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SCText variant="display" size={14}>{titleFor(n)}</SCText>
                  <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                    {rel(n.created_at)}
                  </SCText>
                </View>
                {!n.read && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary }} />
                )}
              </SCCard>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
