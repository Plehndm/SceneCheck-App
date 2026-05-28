// FR5.3 — Host analytics hook. Wraps api.fetchHostAnalyticsByCity /
// fetchHostAnalyticsByVenue. Passing both `city` and `venue` runs them in
// parallel and surfaces both result sets; passing one runs just that one.
// Passing neither short-circuits to empty arrays.
//
// Matches the shared `{ data, loading, error, reload }` hook contract,
// returning the two result sets under named keys so the screen can render
// them in separate panels without re-fetching when one of the two args
// changes.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { HostAnalyticsRow } from '@/types/domain';

interface UseHostAnalyticsResult {
  byCity: HostAnalyticsRow[];
  byVenue: HostAnalyticsRow[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useHostAnalytics(city?: string, venue?: string): UseHostAnalyticsResult {
  const [byCity, setByCity] = useState<HostAnalyticsRow[]>([]);
  const [byVenue, setByVenue] = useState<HostAnalyticsRow[]>([]);
  const [loading, setLoading] = useState<boolean>(() => !!(city || venue));
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!city && !venue) {
      setByCity([]);
      setByVenue([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const cityP = city ? api.fetchHostAnalyticsByCity(city) : Promise.resolve<HostAnalyticsRow[]>([]);
    const venueP = venue ? api.fetchHostAnalyticsByVenue(venue) : Promise.resolve<HostAnalyticsRow[]>([]);
    Promise.all([cityP, venueP])
      .then(([c, v]) => {
        if (cancelled) return;
        setByCity(c);
        setByVenue(v);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [city, venue, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { byCity, byVenue, loading, error, reload };
}
