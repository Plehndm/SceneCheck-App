// People / org search hooks. Same mock-synchronous pattern as useInterests:
// in mock mode the useState initializer filters the SC_* fixtures so the first
// render already has rows (existing search-screen tests assert on first paint);
// in live mode the effect calls api.searchPeople / api.searchOrgs and
// re-renders when the promise resolves. Re-fires on query change so callers
// don't have to debounce, and exposes reload() for pull-to-refresh.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_VISIBLE_PEOPLE, SC_ORGS } from '@/data/mocks';
import type { Account } from '@/types/domain';

interface UseSearchResult {
  results: Account[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

function peopleMockFilter(query: string): Account[] {
  const q = query.trim().toLowerCase();
  if (!q) return SC_VISIBLE_PEOPLE;
  return SC_VISIBLE_PEOPLE.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.username ?? '').toLowerCase().includes(q) ||
    (p.interests ?? []).some(i => i.toLowerCase().includes(q))
  );
}

function orgsMockFilter(query: string): Account[] {
  const q = query.trim().toLowerCase();
  if (!q) return SC_ORGS;
  return SC_ORGS.filter(o =>
    o.name.toLowerCase().includes(q) ||
    (o.username ?? o.handle ?? '').toLowerCase().includes(q)
  );
}

export function useSearchPeople(query: string = ''): UseSearchResult {
  const mock = api.isMock();
  const [results, setResults] = useState<Account[]>(() => mock ? peopleMockFilter(query) : []);
  const [loading, setLoading] = useState(() => !mock);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (mock) {
      setResults(peopleMockFilter(query));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.searchPeople(query)
      .then(list => { if (!cancelled) { setResults(list); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e : new Error(String(e))); setLoading(false); } });
    return () => { cancelled = true; };
  }, [query, mock, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { results, loading, error, reload };
}

export function useSearchOrgs(query: string = ''): UseSearchResult {
  const mock = api.isMock();
  const [results, setResults] = useState<Account[]>(() => mock ? orgsMockFilter(query) : []);
  const [loading, setLoading] = useState(() => !mock);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (mock) {
      setResults(orgsMockFilter(query));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.searchOrgs(query)
      .then(list => { if (!cancelled) { setResults(list); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e : new Error(String(e))); setLoading(false); } });
    return () => { cancelled = true; };
  }, [query, mock, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { results, loading, error, reload };
}
