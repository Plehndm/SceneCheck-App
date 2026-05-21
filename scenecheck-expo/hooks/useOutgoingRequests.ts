// Outgoing friend requests hook — the people you've requested but who
// haven't accepted yet. Returns full Account rows so the requests screen
// can render them.
//
// Mock mode: resolve the Zustand `outgoingRequests` Set against
// SC_ACCOUNT_BY_ID so cancels reflect instantly.
// Live mode: each id is a `to_id` UUID; resolve via `api.getProfile`.
// A private target whose profile RLS hides (you're not friends yet) is
// dropped from the list rather than crashing.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { SC_ACCOUNT_BY_ID } from '@/data/mocks';
import type { Account } from '@/types/domain';

interface UseOutgoingRequestsResult {
  people: Account[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useOutgoingRequests(): UseOutgoingRequestsResult {
  const mock = api.isMock();
  const outgoing = useStore(s => s.outgoingRequests);
  const [people, setPeople] = useState<Account[]>(() => (mock ? buildMock(outgoing) : []));
  const [loading, setLoading] = useState(() => !mock);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (mock) {
      setPeople(buildMock(outgoing));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const ids = Array.from(outgoing);
        const rows = await Promise.all(ids.map(id => api.getProfile(id).catch(() => null)));
        if (cancelled) return;
        setPeople(rows.filter((p): p is Account => Boolean(p)));
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mock, outgoing, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { people, loading, error, reload };
}

function buildMock(outgoing: Set<string>): Account[] {
  return Array.from(outgoing)
    .map(id => SC_ACCOUNT_BY_ID[id])
    .filter((p): p is Account => Boolean(p));
}
