// Chat thread hook — initial fetch + realtime subscription +
// optimistic send. Mirrors the legacy `UIMessage` shape the chat
// screen already renders (`from`/`who`/`text`/`time` + optional
// `status` and `id`), so the screen code only has to swap its
// `useState` initializer.
//
// Realtime: in live mode `api.subscribeToChat` opens a postgres-
// changes channel scoped to this chat. Each INSERT is mapped to the
// UIMessage shape and appended. We dedupe by id so the echo of our
// own send (which we already appended optimistically) is dropped.
//
// Send: optimistic insert with status='sending' + temp id; on
// `api.sendMessage` success we replace the temp id with the
// persisted UUID and flip status='sent'. Failures stamp 'failed'
// for the existing retry UI.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { SC_THREADS } from '@/data/mocks';
import type { Message } from '@/types/domain';

export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface UIMessage extends Message {
  id: string;
  status?: MessageStatus;
  edited?: boolean;
}

interface DbMessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  edited: boolean;
  created_at: string;
}

interface UseChatMessagesResult {
  messages: UIMessage[];
  loading: boolean;
  error: Error | null;
  send: (text: string) => Promise<void>;
  retry: (localId: string) => Promise<void>;
  reload: () => void;
}

export function useChatMessages(chatId: string | undefined): UseChatMessagesResult {
  const mock = api.isMock();
  const meId = useStore(s => s.me.id);
  const offline = useStore(s => s.tweaks.offline);
  const meIdRef = useRef(meId);
  meIdRef.current = meId;

  const [messages, setMessages] = useState<UIMessage[]>(() => {
    if (!chatId) return [];
    if (mock) {
      const seed = SC_THREADS[chatId] ?? [];
      return seed.map((m, i): UIMessage => ({
        ...m,
        id: `seed-${chatId}-${i}`,
        status: m.from === 'host' ? 'sent' : undefined,
      }));
    }
    return [];
  });
  const [loading, setLoading] = useState(() => !mock && !!chatId);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  // Initial fetch in live mode (re-runs on reload() — e.g. re-focusing the
  // thread — so the recipient sees new messages even if a realtime event was
  // missed). Merges with optimistic/realtime messages instead of clobbering:
  // a fetched row replaces a matching id, new rows are appended.
  useEffect(() => {
    if (!chatId || mock) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getChatMessages(chatId)
      .then(rows => {
        if (cancelled) return;
        const mapped = (rows as unknown as DbMessageRow[]).map(r => transformRow(r, meIdRef.current));
        setMessages(prev => {
          // Keep any still-sending/failed optimistic messages (no real id yet).
          const pending = prev.filter(m => m.id.startsWith('tmp-') && m.status !== 'sent');
          const byId = new Map<string, UIMessage>();
          for (const m of mapped) byId.set(m.id, m);
          return [...byId.values(), ...pending];
        });
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [chatId, mock, reloadCounter]);

  // Realtime subscription in live mode.
  useEffect(() => {
    if (!chatId || mock) return;
    const sub = api.subscribeToChat(chatId, payload => {
      const row = payload as DbMessageRow;
      if (!row?.id) return;
      setMessages(prev => {
        // Dedupe: our own optimistic-then-confirmed message is
        // already in the list by real UUID, so the echo is a
        // no-op. Same for any reload race.
        if (prev.some(m => m.id === row.id)) return prev;
        return [...prev, transformRow(row, meIdRef.current)];
      });
    });
    return () => sub.unsubscribe();
  }, [chatId, mock]);

  const send = useCallback(async (text: string) => {
    if (!chatId) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const tempId = `tmp-${Date.now()}`;
    const optimistic: UIMessage = {
      id: tempId,
      from: 'host',
      who: 'You',
      text: trimmed,
      time: 'now',
      status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);

    if (mock) {
      // Mock-mode mirrors the legacy timed feedback so existing
      // chat tests + the offline tweak keep working.
      setTimeout(() => {
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, status: offline ? 'failed' : 'sent' } : m,
        ));
      }, 650);
      return;
    }

    try {
      const row = await api.sendMessage(chatId, trimmed) as unknown as DbMessageRow;
      // Swap temp id for the persisted UUID and stamp sent. The
      // realtime echo for this same id is now a no-op (dedupe).
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, id: row.id, status: 'sent', edited: row.edited }
          : m,
      ));
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, status: 'failed' } : m,
      ));
      throw e instanceof Error ? e : new Error(String(e));
    }
  }, [chatId, mock, offline]);

  const retry = useCallback(async (localId: string) => {
    const target = messages.find(m => m.id === localId);
    if (!target) return;
    setMessages(prev => prev.map(m =>
      m.id === localId ? { ...m, status: 'sending' } : m,
    ));
    if (mock) {
      setTimeout(() => {
        setMessages(prev => prev.map(m =>
          m.id === localId ? { ...m, status: offline ? 'failed' : 'sent' } : m,
        ));
      }, 650);
      return;
    }
    if (!chatId) return;
    try {
      const row = await api.sendMessage(chatId, target.text) as unknown as DbMessageRow;
      setMessages(prev => prev.map(m =>
        m.id === localId
          ? { ...m, id: row.id, status: 'sent', edited: row.edited }
          : m,
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === localId ? { ...m, status: 'failed' } : m,
      ));
    }
  }, [messages, chatId, mock, offline]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { messages, loading, error, send, retry, reload };
}

function transformRow(row: DbMessageRow, meId: string | null): UIMessage {
  const isMe = !!meId && row.sender_id === meId;
  return {
    id: row.id,
    from: isMe ? 'host' : 'them',
    who: isMe ? 'You' : '',
    text: row.body,
    time: formatTime(row.created_at),
    status: isMe ? 'sent' : undefined,
    edited: row.edited,
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}
