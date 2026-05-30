// Web-only Chat hub. The desktop design is two-pane (list on the
// left, thread on the right). This route renders the list with no
// thread selected; clicking a row navigates to /chat/[id].web, which
// renders the SAME left list with the right pane filled.
//
// Both files import WebChatList + WebChatThread from `web/` so the
// list never re-mounts when the URL changes — keeping scroll
// position and avoiding a flash of empty list state on every nav.
//
// NATIVE: this file is web-only. Metro picks `.web.tsx` for web and
// `chat.tsx` (the native list screen) for everything else.

import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { WebChatList } from '@/web/WebChatList';
import { WebIcon } from '@/web/WebIcon';

export default function ChatHubWeb() {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        background: t.surface,
      }}
    >
      <WebChatList activeChatId={null} />
      {/* Empty-state right pane. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
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
          <WebIcon name="chat" size={26} color={t.ink3} />
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 18,
            color: t.ink,
          }}
        >
          Pick a conversation to start chatting
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: t.ink3,
          }}
        >
          Select a chat from the list on the left
        </div>
      </div>
    </div>
  );
}
