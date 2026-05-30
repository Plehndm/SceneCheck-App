// Web-only chat-thread route. Renders the same two-pane layout as
// `(tabs)/chat.web.tsx`, but with the right pane populated by the
// selected thread.
//
// Shape-wise this is the desktop's "messenger" view — Discord /
// Telegram style — where the left rail of conversations stays put
// across thread switches. The shared <WebChatList/> + <WebChatThread/>
// components keep both routes pixel-identical so navigation between
// them feels like swapping the right pane in place, not a full page
// transition.
//
// NATIVE: untouched. The native `chat/[id].tsx` is the per-thread
// stack screen with its own header / safe-area / keyboard handling.

import { useLocalSearchParams } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { WebChatList } from '@/web/WebChatList';
import { WebChatThread } from '@/web/WebChatThread';

export default function ChatThreadWeb() {
  const t = useTokens();
  // expo-router types `id` as `string | string[]` when the route can
  // collide with an array shape; we only ever route to a single id
  // so normalise once.
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        background: t.surface,
      }}
    >
      <WebChatList activeChatId={id ?? null} />
      {id ? <WebChatThread chatId={id} /> : null}
    </div>
  );
}
