// Test helpers used across the per-screen integration tests.
//
//   - renderScreen(ui) wraps render() with the ThemeProvider, since every
//     SC component reads from useTokens() and crashes without one.
//   - resetStore() puts the Zustand store back to a known fixture state
//     between tests so order-of-execution doesn't leak.
//   - setRouteParams(params) sets what useLocalSearchParams returns next.

import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useStore, DEFAULT_TWEAKS, DEFAULT_NOTIF_PREFS } from '@/store/useStore';
import { SC_ME } from '@/data/mocks';

export function renderScreen(ui: ReactElement, options?: RenderOptions) {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options);
}

export function resetStore(overrides: Partial<ReturnType<typeof useStore.getState>> = {}) {
  useStore.setState({
    joined: new Set(['e1']),
    pendingLeave: new Set(),
    conflictPrompt: null,
    eventOverrides: {},
    friends: new Set(['p1', 'p3', 'p5']),
    outgoingRequests: new Set(['p2']),
    incomingRequests: new Set(['fr1', 'fr2']),
    picture: null,
    orgPictures: {},
    palette: 'sunset',
    mode: 'light',
    tweaks: DEFAULT_TWEAKS,
    drafts: [],
    radius: 5,
    visibility: 'public',
    notifPrefs: DEFAULT_NOTIF_PREFS,
    linkedCalendar: 'google',
    blocked: [
      { id: 'b1', name: 'Casey Morgan', username: 'casey_m', reason: 'Blocked Mar 14' },
      { id: 'b2', name: 'Riley Tanaka', username: 'rileyt', reason: 'Blocked Feb 02' },
    ],
    following: new Set(['orgA', 'orgD']),
    subscribedInterests: new Set(['biking', 'coffee', 'climbing']),
    me: SC_ME,
    // Default to "signed in" in tests so AuthGate-wrapped routes render
    // without a redirect. Tests that exercise the signed-out branch
    // pass `session: null` via the `overrides` argument.
    session: { userId: SC_ME.id, email: 'me@scenecheck.test' },
    toasts: [],
    confirm: null,
    _toastIdCounter: 0,
    ...overrides,
  });
}

export function setRouteParams(params: Record<string, string | undefined>) {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
}
