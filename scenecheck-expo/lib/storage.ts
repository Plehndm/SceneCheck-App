// Cross-platform key/value storage adapter.
//
// On native (iOS/Android) this is AsyncStorage. On web it's a wrapper around
// `window.localStorage` that no-ops when `window` is undefined — necessary
// because Expo Router's `web.output: "static"` pre-renders pages in Node,
// where touching `window` crashes the build. The wrapper lets module-level
// consumers (Supabase auth init, Zustand persist hydration) run safely
// during SSR and pick up real values after client hydration.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

export const kvStorage = Platform.OS === 'web' ? webStorage : AsyncStorage;
