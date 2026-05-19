// Single-interest fetcher. Wraps `api.getInterest(tagName)`.
//
// Mock mode initializes synchronously from `SC_INTERESTS_DETAILS[tag]`,
// so the existing `interests/[tag].tsx` screen tests keep working
// without `findByText`. Live mode resolves via Supabase.
//
// `tag === undefined` is handled gracefully — Expo Router can hand
// us an unresolved param on the first render of a new route.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_INTERESTS_DETAILS } from '@/data/mocks';
import type { Interest } from '@/types/domain';

interface UseInterestResult {
  interest: Interest | null;
  loading: boolean;
  error: Error | null;
}

export function useInterest(tag: string | undefined): UseInterestResult {
  const mock = api.isMock();
  const [interest, setInterest] = useState<Interest | null>(() =>
    mock && tag ? (SC_INTERESTS_DETAILS[tag] ?? null) : null,
  );
  const [loading, setLoading] = useState(() => !mock && !!tag);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tag) {
      setInterest(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!mock) {
      setLoading(true);
      setError(null);
    }
    api.getInterest(tag)
      .then(row => {
        if (cancelled) return;
        setInterest(row);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tag, mock]);

  return { interest, loading, error };
}
