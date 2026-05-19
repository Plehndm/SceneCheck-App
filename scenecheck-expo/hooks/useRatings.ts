// Ratings-for-host hook. Mock-mode initializes synchronously from
// `SC_REVIEWS` filtered by `hostId`. Live mode joins `ratings ⨝
// events` and filters on `events.creator_id`, mapping each row
// into the legacy `Review` shape so the screen doesn't change.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_REVIEWS } from '@/data/mocks';
import type { Review } from '@/types/domain';

interface UseRatingsResult {
  ratings: Review[];
  loading: boolean;
  error: Error | null;
}

export function useRatings(hostId: string | undefined): UseRatingsResult {
  const mock = api.isMock();
  const [ratings, setRatings] = useState<Review[]>(() =>
    mock && hostId ? SC_REVIEWS.filter(r => r.hostId === hostId) : [],
  );
  const [loading, setLoading] = useState(() => !mock && !!hostId);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!hostId) {
      setRatings([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!mock) {
      setLoading(true);
      setError(null);
    }
    api.fetchRatings(hostId)
      .then(list => {
        if (cancelled) return;
        setRatings(list);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [hostId, mock]);

  return { ratings, loading, error };
}
