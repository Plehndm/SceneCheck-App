// Single-profile fetcher. Wraps `api.getProfile(userId)`.
//
// Mock mode: synchronous `SC_ACCOUNT_BY_ID[id]` lookup so the
// existing other-profile screen tests keep their first-render
// assertions.
// Live mode: hits `profiles` and re-renders when the promise
// resolves. `id === undefined` is handled (Expo Router param-not-
// resolved edge case on first render).

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_ACCOUNT_BY_ID } from '@/data/mocks';
import type { Account } from '@/types/domain';

interface UseProfileResult {
  profile: Account | null;
  loading: boolean;
  error: Error | null;
}

export function useProfile(id: string | undefined): UseProfileResult {
  const mock = api.isMock();
  const [profile, setProfile] = useState<Account | null>(() =>
    mock && id ? (SC_ACCOUNT_BY_ID[id] ?? null) : null,
  );
  const [loading, setLoading] = useState(() => !mock && !!id);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!mock) {
      setLoading(true);
      setError(null);
    }
    api.getProfile(id)
      .then(row => {
        if (cancelled) return;
        setProfile(row);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, mock]);

  return { profile, loading, error };
}
