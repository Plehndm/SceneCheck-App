// WebShell — desktop chrome wrapper that the web root layout puts
// around the entire route tree. Two layers:
//
//   1. Full-viewport background. Paints the warm cream `pageBg` with
//      the two radial-gradient "glows" the prototype used. The
//      actual browser provides the window chrome — we don't fake it.
//   2. Rail + content area. <WebRail/> on the left, expo-router's
//      Stack/Slot output on the right. The Activity slide-over and
//      the cross-platform <ToastHost/> overlay sit inside this area
//      so taps/toasts land in the right coordinate space.
//
// SIZING. The shell fills the real viewport (`100vw × 100vh`). No
// scale-fit, no fixed 1440×900 stage — the design's pixel numbers are
// hints, not constraints, and `NativeStackView` needs an explicit
// flex chain back to a real height or its absolute-positioned screens
// collapse to zero (which surfaced as blank-white pages in dev).
//
// NATIVE: this component is web-only — `app/_layout.tsx` lazy-imports
// it under `Platform.OS === 'web'` so it never reaches the native
// bundle. It uses raw HTML elements (div/span/button/svg via WebIcon)
// since we're already inside react-native-web's DOM layer.

import { useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useChats } from '@/hooks/useChats';
import { useNotifications } from '@/hooks/useNotifications';
import { FONT } from '@/theme/tokens';
import { WebRail, type RailBadges } from './WebRail';
import { WebActivityPanel } from './WebActivityPanel';
import { ToastHost } from '@/components/ToastHost';

interface Props {
  children: ReactNode;
}

export function WebShell({ children }: Props) {
  const t = useTokens();
  const pathname = usePathname();

  // Activity slide-over is rail-local state. WebActivityPanel handles
  // the live notifications feed (rail bell → dropdown).
  const [activity, setActivity] = useState(false);

  // Badge counts mirror the design: real unread notifications, pending
  // friend requests, unread chat threads. All three flip live via
  // Supabase Realtime in production.
  //
  // - notif: unread rows from `useNotifications` (incoming-friend-requests
  //   are a subset of this in practice).
  // - requests: kept separate so the rail's "Friends" pill still
  //   reflects pending invites independent of read state.
  // - chat: total unread across all chats. `useChats` already drives
  //   the chat-list panes, so reusing it means one subscription.
  const incoming = useStore(s => s.incomingRequests);
  const { chats } = useChats();
  const { data: notifData } = useNotifications();
  const unreadNotifs = useMemo(
    () => notifData.filter(n => !n.read).length,
    [notifData],
  );
  const totalUnread = useMemo(
    () => chats.reduce((sum, c) => sum + (c.unread ?? 0), 0),
    [chats],
  );
  const badges: RailBadges = {
    notif: unreadNotifs || null,
    requests: incoming.size || null,
    chat: totalUnread || null,
  };

  // Derive a "tab" hint from the pathname so the rail highlights the
  // right pill. Order matters: more specific first.
  const activeTab =
    pathname === '/' || pathname === '/index'
      ? 'home'
      : pathname.startsWith('/search')
        ? 'search'
        : pathname.startsWith('/chat')
          ? 'chat'
          : pathname.startsWith('/my-friends') || pathname.startsWith('/requests')
            ? 'friends'
            : pathname.startsWith('/my-following')
              ? 'following'
              : pathname.startsWith('/profile')
                ? 'profile'
                : pathname.startsWith('/settings')
                  ? 'settings'
                  : pathname.startsWith('/create-event')
                    ? 'create'
                    : 'home';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'row',
        background: t.pageBg,
        // Two-glow radial wash, same as the prototype. Kept on the
        // outer surface because the rail's dark control bar covers the
        // top-left glow anyway and the content area will paint over
        // the bottom-right; the glows only show through the slim gaps
        // around slide-overs.
        backgroundImage: `radial-gradient(1200px 700px at 15% 8%, ${t.pageGlow1} 0%, transparent 62%), radial-gradient(1100px 900px at 92% 95%, ${t.pageGlow2} 0%, transparent 62%)`,
        color: t.ink,
        fontFamily: FONT.body,
        overflow: 'hidden',
      }}
    >
      <WebRail
        activeTab={activeTab}
        activePanel={activity ? 'activity' : null}
        onPanel={() => setActivity(o => !o)}
        badges={badges}
      />
      {/* Main content area. Must be a flex column with an explicit
          height: react-native-web's NativeStackView uses `flex: 1`
          for its inner screen view, and that flex collapses to 0 if
          the parent isn't a flex container with a known height — the
          symptom is exactly the blank-white pages we hit earlier.
          Rendering {children} directly (no absolute-inset wrapper)
          lets Stack participate in the flex chain instead of trying
          to position itself against an unsized absolute box. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          position: 'relative',
          background: t.surface,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
        {/* Activity slide-over — absolute-positioned, doesn't affect
            the flex layout of {children}. */}
        <WebActivityPanel open={activity} onClose={() => setActivity(false)} />
      </div>

      {/* Toasts overlay everything. ToastHost positions itself
          absolutely from `position: fixed` props; rendering it inside
          the shell flexbox is fine because it doesn't participate in
          flow layout. */}
      <ToastHost />
    </div>
  );
}
