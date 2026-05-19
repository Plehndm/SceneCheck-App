// Hard auth gate for the authenticated app surface (the `(tabs)`
// route group). Most non-events data — chats, friendships, attendees,
// friend_requests, event_subscriptions — is RLS-blocked for
// unauthenticated requests, so forcing sign-in here matches the data
// model: a signed-out user can't see anything useful past Home/Map
// anyway.
//
// In mock mode (`api.isMock()`) the gate is a pass-through. The test
// suite + the standalone mock build don't have a Supabase client at
// all and the store's default `session` is null, which would
// otherwise loop the user into /auth/sign-in forever.
//
// We read `session` from the Zustand store rather than re-querying
// supabase here — `AuthBootstrap.tsx` is the single writer of that
// slice. The component re-renders whenever the slice changes, so
// sign-in / sign-out transitions flow through this component
// automatically.

import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';

export function AuthGate({ children }: { children: ReactNode }) {
  const session = useStore(s => s.session);
  if (!api.isMock() && !session) {
    return <Redirect href={'/auth/sign-in' as never} />;
  }
  return <>{children}</>;
}
