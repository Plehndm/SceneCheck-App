// Global Jest setup — mocks for native modules that Jest can't load
// directly. jest-expo handles most of the SDK; these are the few we
// touch in code that aren't already mocked.

import type { ReactNode } from 'react';

// AsyncStorage — used by the Zustand persistence middleware.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-location — useLocation() calls request + getCurrentPosition.
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 33.6461, longitude: -117.8427 },
  }),
}));

// expo-image-picker — useImagePicker() calls request + launchImageLibrary.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///mock/image.jpg' }],
  }),
}));

// expo-notifications — registerForPushNotifications() / handler config.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExpoPushToken[mock]' }),
  AndroidImportance: { DEFAULT: 3 },
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

// expo-device — controls the "real device only" guard in lib/notifications.
jest.mock('expo-device', () => ({ isDevice: true }));

// expo-router — `useLocalSearchParams` is exposed as a jest.fn so screen
// tests can override the params per case (e.g. `mockReturnValue({ id: 'e1' })`).
// Stack/Tabs are made callable with a Screen sub-component so layout
// files that read `<Stack.Screen ... />` don't blow up at import time.
jest.mock('expo-router', () => {
  const router = {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    setParams: jest.fn(),
  };
  const Pass = ({ children }: { children?: ReactNode }) => children ?? null;
  const StackComp = Object.assign(Pass, { Screen: () => null });
  const TabsComp = Object.assign(Pass, { Screen: () => null });
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    usePathname: jest.fn(() => '/'),
    Stack: StackComp,
    Tabs: TabsComp,
    Link: Pass,
    Redirect: () => null,
  };
});

// @react-native-community/slider — used by settings; mock as no-op view.
jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const RN = require('react-native');
  return function MockSlider() {
    return React.createElement(RN.View, null);
  };
});

// react-native-maps — native-only; not imported in unit tests but the
// resolver may try to load it during module discovery.
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: () => null,
  Marker: () => null,
  Circle: () => null,
  PROVIDER_GOOGLE: 'google',
}));

// react-native-safe-area-context — SafeAreaView in tests should just pass
// children through. jest-expo provides a partial mock but doesn't cover
// SafeAreaView's edges prop in all cases.
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return {
    SafeAreaView: RN.View,
    SafeAreaProvider: ({ children }: { children?: ReactNode }) => children ?? null,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// Quiet the "act() warning" noise from React 19's stricter render scheduling
// during the migration. We can re-enable once we've adjusted each test.
const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('act(...)') || msg.includes('not wrapped in act')) return;
  origError.apply(console, args as Parameters<typeof console.error>);
};
