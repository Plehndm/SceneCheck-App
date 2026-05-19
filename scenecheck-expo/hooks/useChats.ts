// Chat list hook. Wraps `api.getChats()`.
//
// Mock mode: synchronous init from `SC_CHATS` so existing chat-tab
// tests keep their first-render assertions.
// Live mode: starts empty + loading, populates after the join
// resolves. `reload()` lets the consumer re-fetch (e.g. after a
// new chat is created from the new-chat screen and the user
// navigates back).

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_CHATS } from '@/data/mocks';
import type { Chat } from '@/types/domain';

interface UseChatsResult {
  chats: Chat[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useChats(): UseChatsResult {
  const mock = api.isMock();
  const [chats, setChats] = useState<Chat[]>(() => mock ? SC_CHATS : []);
  const [loading, setLoading] = useState(() => !mock);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (mock) {
      setChats(SC_CHATS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.getChats()
      .then(list => {
        if (cancelled) return;
        setChats(list);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mock, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { chats, loading, error, reload };
}
