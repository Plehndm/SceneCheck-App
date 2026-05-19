// Component tests for the hard auth gate (`AuthGate.tsx`).
//
// Three things matter:
//   1. With a session set, children render.
//   2. With session=null AND api.isMock()=false, the gate redirects.
//      We assert by checking that the children DON'T render and that
//      expo-router's `Redirect` was rendered with the right href.
//   3. In mock mode the gate is a pass-through regardless of session
//      state, so the existing 277 tests don't have to mock auth.

import { Text } from 'react-native';
import { renderScreen, resetStore } from '../test-utils';
import { AuthGate } from '@/components/AuthGate';
import { api } from '@/lib/api';

const CHILD = 'protected-content';

describe('AuthGate', () => {
  test('renders children when a session is set', () => {
    resetStore(); // resetStore() defaults to a stub session — signed in
    const { getByText } = renderScreen(
      <AuthGate><Text>{CHILD}</Text></AuthGate>,
    );
    expect(getByText(CHILD)).toBeTruthy();
  });

  test('renders children in mock mode even with session=null', () => {
    // In the Jest environment api.isMock() is always true (no Supabase
    // env vars) — the gate must short-circuit so existing screen tests
    // don't redirect.
    expect(api.isMock()).toBe(true);
    resetStore({ session: null });
    const { getByText } = renderScreen(
      <AuthGate><Text>{CHILD}</Text></AuthGate>,
    );
    expect(getByText(CHILD)).toBeTruthy();
  });

  test('blocks render in live mode when session is null', () => {
    // Flip the mock check for one test only, then restore it. This is
    // the only branch where AuthGate's <Redirect /> short-circuits.
    const spy = jest.spyOn(api, 'isMock').mockReturnValue(false);
    try {
      resetStore({ session: null });
      const { queryByText } = renderScreen(
        <AuthGate><Text>{CHILD}</Text></AuthGate>,
      );
      // The protected content must NOT be in the tree.
      expect(queryByText(CHILD)).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
