// Resolves the org ids in the local `following` set to display rows.
//
// `following` is a user-preference Set kept in the Zustand store (local-only,
// like drafts / subscribedInterests). This hook turns those ids into Account
// rows for the my-following screen: in mock mode from the SC_* fixtures
// (preserving SC_ORGS-then-managed order so the screen tests stay stable); in
// live mode via api.getProfilesByIds so the data comes from Supabase.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { SC_ORGS, SC_MY_ACCOUNTS } from '@/data/mocks';
import type { Account } from '@/types/domain';

// SC_ORGS first, then the user's managed orgs — the order the screen + its
// tests expect.
const ALL_MOCK_ORGS: Account[] = [...SC_ORGS, ...SC_MY_ACCOUNTS.filter(a => a.type === 'org')];

interface UseFollowedOrgsResult {
  orgs: Account[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useFollowedOrgs(): UseFollowedOrgsResult {
  const following = useStore(s => s.following);
  const mock = api.isMock();
  const ids = useMemo(() => Array.from(following), [following]);
  const idsKey = ids.join(',');

  const mockList = useMemo(() => ALL_MOCK_ORGS.filter(o => following.has(o.id)), [following]);

  const [orgs, setOrgs] = useState<Account[]>(() => mock ? mockList : []);
  const [loading, setLoading] = useState(() => !mock && ids.length > 0);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (mock) {
      setOrgs(ALL_MOCK_ORGS.filter(o => following.has(o.id)));
      setLoading(false);
      return;
    }
    if (ids.length === 0) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.getProfilesByIds(ids)
      .then(list => { if (!cancelled) { setOrgs(list); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e : new Error(String(e))); setLoading(false); } });
    return () => { cancelled = true; };
    // `idsKey` is the stable string trigger for the live-mode fetch (it captures
    // every change to `following` without depending on the unstable array ref);
    // `following` is the trigger for the mock branch which reads the Set
    // directly. Listing `ids` here too would be redundant — it always changes
    // in lockstep with `idsKey`.
  }, [idsKey, mock, reloadCounter, following]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { orgs, loading, error, reload };
}
