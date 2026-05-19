// Friends list hook.
//
// In mock mode the Zustand `friends` Set is the source of truth —
// we filter `SC_VISIBLE_PEOPLE` by that set so unfriend operations
// reflect instantly in the screen without an explicit reload.
//
// In live mode `api.fetchFriends()` joins `friendships` ↔ `profiles`
// in both directions and returns the result. We re-fire the fetch
// on `reload()` so the screen can trigger a refresh after a remove.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { SC_VISIBLE_PEOPLE } from '@/data/mocks';
import type { Account } from '@/types/domain';

interface UseFriendsResult {
  friends: Account[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useFriends(): UseFriendsResult {
  const mock = api.isMock();
  const friendIds = useStore(s => s.friends);
  const [friends, setFriends] = useState<Account[]>(() =>
    mock ? SC_VISIBLE_PEOPLE.filter(p => friendIds.has(p.id)) : [],
  );
  const [loading, setLoading] = useState(() => !mock);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (mock) {
      setFriends(SC_VISIBLE_PEOPLE.filter(p => friendIds.has(p.id)));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.fetchFriends()
      .then(list => {
        if (cancelled) return;
        setFriends(list);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mock, friendIds, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { friends, loading, error, reload };
}
