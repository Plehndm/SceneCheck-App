// Single-event fetcher hook. Mirrors `hooks/useEvents.ts`:
//   - Mock mode initializes synchronously from SC_EVENT_BY_ID[id]
//     (so existing event-detail screen tests keep passing).
//   - Live mode starts with `event=null + loading=true` and resolves
//     after `api.getEventById(id)` returns.
//   - `reload()` lets the screen re-fetch after a host edit / cancel
//     so the UI reflects the new row without remounting.
//
// `id` is allowed to be undefined for the param-not-resolved-yet
// edge case Expo Router can hit; the hook treats it as "no event".

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_EVENT_BY_ID } from '@/data/mocks';
import type { SCEvent } from '@/types/domain';

interface UseEventResult {
  event: SCEvent | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useEvent(id: string | undefined): UseEventResult {
  const mock = api.isMock();
  const [event, setEvent] = useState<SCEvent | null>(() =>
    mock && id ? (SC_EVENT_BY_ID[id] ?? null) : null,
  );
  const [loading, setLoading] = useState(() => !mock && !!id);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!id) {
      setEvent(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!mock) {
      setLoading(true);
      setError(null);
    }
    api.getEventById(id)
      .then(row => {
        if (cancelled) return;
        setEvent(row);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, reloadCounter, mock]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { event, loading, error, reload };
}
