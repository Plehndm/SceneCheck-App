// A profile's interest tags, fetched independently of the profile row.
// `user_interests` is publicly readable, so this resolves even for a
// private account whose `profiles` row RLS hides — which is exactly what
// we want: interests are shown to everyone, the rest of a private profile
// is not. `getProfile` selects only the `profiles` row (no interests), so
// the other-profile screen relies on this hook for the interests display.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_ACCOUNT_BY_ID } from '@/data/mocks';

interface UseUserInterestsResult {
  interests: string[];
  loading: boolean;
  reload: () => void;
}

export function useUserInterests(id: string | undefined): UseUserInterestsResult {
  const mock = api.isMock();
  const [interests, setInterests] = useState<string[]>(() =>
    mock && id ? (SC_ACCOUNT_BY_ID[id]?.interests ?? []) : [],
  );
  const [loading, setLoading] = useState(() => !mock && !!id);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!id) { setInterests([]); setLoading(false); return; }
    if (mock) { setInterests(SC_ACCOUNT_BY_ID[id]?.interests ?? []); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.getInterestsForUser(id)
      .then(list => { if (!cancelled) { setInterests(list); setLoading(false); } })
      .catch(() => { if (!cancelled) { setInterests([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id, mock, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { interests, loading, reload };
}
