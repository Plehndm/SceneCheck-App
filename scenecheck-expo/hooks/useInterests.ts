// Interest-catalog hook. Wraps `api.searchInterests(query)` with the
// same mock-mode-synchronous pattern the events hooks use:
//
//   - When `api.isMock()` is true (the only mode jest-expo gives us),
//     the `useState` initializer pulls from `SC_INTERESTS_SUGGESTED`
//     so the first render already has the catalog and existing
//     screen tests don't need `findByText`.
//   - In live mode, the effect calls `api.searchInterests(query)`
//     and re-renders when the promise resolves. Re-fires whenever
//     `query` changes so the consumer doesn't have to debounce.
//
// `query` defaults to '' so the hook can be called with no args to
// get the full catalog. The api wrapper already orders results by
// subscriber_count desc on the server in live mode.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_INTERESTS_SUGGESTED } from '@/data/mocks';
import type { Interest } from '@/types/domain';

interface UseInterestsResult {
  interests: Interest[];
  loading: boolean;
  error: Error | null;
}

export function useInterests(query: string = ''): UseInterestsResult {
  const mock = api.isMock();
  const [interests, setInterests] = useState<Interest[]>(() =>
    mock ? mockFilter(query) : [],
  );
  const [loading, setLoading] = useState(() => !mock);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (mock) {
      // In mock mode the catalog is small + local, so just resolve
      // the substring filter synchronously on each query change.
      setInterests(mockFilter(query));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.searchInterests(query)
      .then(list => {
        if (cancelled) return;
        setInterests(list);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [query, mock]);

  return { interests, loading, error };
}

function mockFilter(query: string): Interest[] {
  const q = query.trim().toLowerCase();
  if (!q) return SC_INTERESTS_SUGGESTED;
  return SC_INTERESTS_SUGGESTED.filter(i => i.tag.toLowerCase().includes(q));
}
