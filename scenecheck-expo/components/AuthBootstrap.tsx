// Auth bootstrap — mounted once at the root layout. Responsible for two
// things in live mode (no-ops when supabase is null):
//
//   1. Restore an existing session on app load. supabase-js's
//      `persistSession` writes to our SSR-safe `kvStorage` adapter, so a
//      page reload re-hydrates from localStorage on web and AsyncStorage
//      on native. We just need to react to it.
//
//   2. Keep the Zustand `me` slice in sync with the authenticated user.
//      On SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION we look up the
//      `profiles` row and merge it into `me`. On SIGNED_OUT we reset
//      `me` to the anonymous SC_ME placeholder so the rest of the app
//      keeps rendering without crashing.
//
// In mock mode (no Supabase env vars) this component is a no-op — the
// store's `me` is already SC_ME and there's nothing to subscribe to.

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { SC_ME } from '@/data/mocks';
import type { Account } from '@/types/domain';

export function AuthBootstrap() {
  const setMe = useStore(s => s.setMe);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    async function hydrateProfile(userId: string, email: string | null) {
      // 1) Basic profile row. The `handle_new_user` trigger
      //    (migration 00002) inserts a skeleton row at sign-up time,
      //    so this should always return a row for a real user. We
      //    `.maybeSingle()` defensively in case the trigger is ever
      //    disabled or a row was hand-deleted.
      const [{ data: row }, { data: tagRows }] = await Promise.all([
        supabase!
          .from('profiles')
          .select('name, username, bio, visibility, account_type, avatar_url')
          .eq('user_id', userId)
          .maybeSingle(),
        // 2) Joined interests via the user_interests bridge table.
        //    Result shape: `[{ interests: { name: 'biking' } }, ...]`.
        supabase!
          .from('user_interests')
          .select('interests(name)')
          .eq('user_id', userId),
      ]);

      if (cancelled) return;

      const interests = (tagRows ?? [])
        .map((r: { interests?: { name?: string } | null }) => r.interests?.name)
        .filter((n: string | undefined): n is string => Boolean(n));

      const patch: Partial<Account> = {
        id: userId,
        type: (row?.account_type as 'person' | 'org' | null) ?? 'person',
        name: (row?.name as string | undefined) || email || 'You',
        username: (row?.username as string | undefined) || email?.split('@')[0] || undefined,
        bio: (row?.bio as string | undefined) ?? '',
        interests,
        privacy: ((row?.visibility as 'public' | 'private' | undefined) ?? 'public'),
        picture: (row?.avatar_url as string | undefined) ?? null,
      };
      setMe(patch);
    }

    // 1. Initial session check (fires once at mount).
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session?.user) {
        hydrateProfile(session.user.id, session.user.email ?? null);
      }
    });

    // 2. Subscribe to all subsequent auth events.
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) hydrateProfile(session.user.id, session.user.email ?? null);
      }
      if (event === 'SIGNED_OUT') {
        setMe({ ...SC_ME });
      }
    });

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, [setMe]);

  return null;
}
