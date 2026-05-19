// Auth bootstrap — mounted once at the root layout. In live mode this
// is the single source of truth for the Zustand `session` + `me`
// slices; in mock mode (no Supabase env vars) it short-circuits to a
// no-op.
//
// Responsibilities:
//
//   1. Restore an existing session on app load. supabase-js's
//      `persistSession` writes to our SSR-safe `kvStorage` adapter, so
//      a page reload re-hydrates from localStorage on web and
//      AsyncStorage on native. We just need to react to it.
//
//   2. Mirror the auth state into `session`. `components/AuthGate.tsx`
//      reads this to decide whether to redirect unauthenticated visitors
//      to /auth/sign-in.
//
//   3. Hydrate the social slices (`me`, `joined`,
//      `outgoingRequests` / `incomingRequests`, `friends`,
//      `subscribedInterests`) from the matching tables whenever the
//      session changes. On SIGNED_OUT we reset everything to the
//      anonymous SC_ME defaults so the rest of the app keeps rendering.

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { SC_ME } from '@/data/mocks';
import type { Account } from '@/types/domain';

interface FriendshipRow {
  id: string;
  from_id: string;
  to_id: string;
  status: 'pending' | 'accepted' | 'declined';
}

interface SubscriptionRow {
  event_id: string;
}

export function AuthBootstrap() {
  const setMe = useStore(s => s.setMe);
  const setSession = useStore(s => s.setSession);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    async function hydrate(userId: string, email: string | null) {
      // Fire every read in parallel — none depend on each other.
      const [
        { data: profile },
        { data: tagRows },
        { data: subRows },
        { data: friendshipRows },
      ] = await Promise.all([
        supabase!.from('profiles')
          .select('name, username, bio, visibility, account_type, avatar_url')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase!.from('user_interests')
          .select('interests(name)')
          .eq('user_id', userId),
        // Confirmed subscriptions = events the user has joined.
        // (Waitlisted/removed/cancelled are kept out of `joined`.)
        supabase!.from('event_subscriptions')
          .select('event_id')
          .eq('user_id', userId)
          .eq('status', 'confirmed'),
        // Both sides of the friendship table. We split by status +
        // direction below into the three Zustand sets.
        supabase!.from('friendships')
          .select('id, from_id, to_id, status')
          .or(`from_id.eq.${userId},to_id.eq.${userId}`),
      ]);

      if (cancelled) return;

      // Profile + interests.
      const interests = (tagRows ?? [])
        .map((r: { interests?: { name?: string } | null }) => r.interests?.name)
        .filter((n: string | undefined): n is string => Boolean(n));

      const profilePatch: Partial<Account> = {
        id: userId,
        type: (profile?.account_type as 'person' | 'org' | null) ?? 'person',
        name: (profile?.name as string | undefined) || email || 'You',
        username: (profile?.username as string | undefined) || email?.split('@')[0] || undefined,
        bio: (profile?.bio as string | undefined) ?? '',
        interests,
        privacy: ((profile?.visibility as 'public' | 'private' | undefined) ?? 'public'),
        picture: (profile?.avatar_url as string | undefined) ?? null,
      };
      setMe(profilePatch);

      // Joined events.
      const joined = new Set<string>(
        (subRows ?? []).map((r: SubscriptionRow) => r.event_id),
      );

      // Friend graph splits:
      //   - accepted (either direction) → friends
      //   - pending where I'm the sender (from_id = me) → outgoing
      //   - pending where I'm the recipient (to_id = me) → incoming
      const friends = new Set<string>();
      const outgoing = new Set<string>();
      const incoming = new Set<string>();
      for (const r of (friendshipRows ?? []) as FriendshipRow[]) {
        if (r.status === 'accepted') {
          friends.add(r.from_id === userId ? r.to_id : r.from_id);
        } else if (r.status === 'pending') {
          if (r.from_id === userId) outgoing.add(r.to_id);
          // For incoming we key by the friendship row id rather than
          // the sender id — the store's accept/decline calls reference
          // this id.
          else if (r.to_id === userId) incoming.add(r.id);
        }
      }

      const subscribedInterests = new Set<string>(interests);

      useStore.setState({
        joined,
        friends,
        outgoingRequests: outgoing,
        incomingRequests: incoming,
        subscribedInterests,
      });
    }

    function reset() {
      setMe({ ...SC_ME });
      useStore.setState({
        joined: new Set(),
        friends: new Set(),
        outgoingRequests: new Set(),
        incomingRequests: new Set(),
        subscribedInterests: new Set(),
      });
    }

    // 1. Initial session check (fires once at mount).
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session?.user) {
        setSession({ userId: session.user.id, email: session.user.email ?? null });
        hydrate(session.user.id, session.user.email ?? null);
      } else {
        setSession(null);
      }
    });

    // 2. Subscribe to all subsequent auth events.
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          setSession({ userId: session.user.id, email: session.user.email ?? null });
          hydrate(session.user.id, session.user.email ?? null);
        }
      }
      if (event === 'SIGNED_OUT') {
        setSession(null);
        reset();
      }
    });

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, [setMe, setSession]);

  return null;
}
