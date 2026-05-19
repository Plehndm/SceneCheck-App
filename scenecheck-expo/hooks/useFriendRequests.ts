// Incoming friend requests hook. Returns the legacy
// `{ request, person }` shape the requests screen already renders.
//
// Mock mode: pulls from `SC_FRIEND_REQUESTS` + `SC_VISIBLE_PERSON_BY_ID`
// and filters by the Zustand `incomingRequests` Set so accept / decline
// updates flow through without an explicit reload.
//
// Live mode: `api.fetchFriendRequests()` returns shaped rows from
// `friendships` where `to_id = me AND status='pending'`. We then look
// up each requester's profile via `api.getProfile(...)`. Could be a
// single join later if perf becomes a concern, but each page only
// shows a handful of rows.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { SC_FRIEND_REQUESTS, SC_VISIBLE_PERSON_BY_ID } from '@/data/mocks';
import type { Account, FriendRequest } from '@/types/domain';

export interface PendingRequest extends FriendRequest {
  person: Account;
}

interface UseFriendRequestsResult {
  requests: PendingRequest[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useFriendRequests(): UseFriendRequestsResult {
  const mock = api.isMock();
  const incoming = useStore(s => s.incomingRequests);
  const [requests, setRequests] = useState<PendingRequest[]>(() =>
    mock ? buildMockRequests(incoming) : [],
  );
  const [loading, setLoading] = useState(() => !mock);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (mock) {
      setRequests(buildMockRequests(incoming));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const rows = await api.fetchFriendRequests();
        const withProfiles = await Promise.all(rows.map(async r => ({
          ...r,
          person: await api.getProfile(r.personId),
        })));
        if (cancelled) return;
        setRequests(withProfiles);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mock, incoming, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { requests, loading, error, reload };
}

function buildMockRequests(incoming: Set<string>): PendingRequest[] {
  return SC_FRIEND_REQUESTS
    .filter(r => incoming.has(r.id))
    .map(r => ({ ...r, person: SC_VISIBLE_PERSON_BY_ID[r.personId] }))
    .filter((r): r is PendingRequest => Boolean(r.person));
}
