// Supabase client, configured for React Native.
//
// - URL polyfill is required because React Native's URL constructor doesn't
//   support some of what supabase-js expects.
// - AsyncStorage is the auth-session store so login survives app restarts.
// - detectSessionInUrl is disabled because RN doesn't have a URL bar (the
//   OAuth deep-link path goes through expo-linking instead, wired later
//   in Phase 5).
//
// Key naming: Supabase's 2025 key-system update renamed the client-side
// key from "anon" (a JWT) to "publishable" (an opaque string starting
// with `sb_publishable_`). Both formats work with @supabase/supabase-js;
// we prefer the new name and fall back to the legacy var if it's the
// only one set, so existing projects don't break on upgrade.
//
// `supabase` is null when env vars aren't set — callers should fall back
// to mock-mode via `isLiveBackendAvailable()`.

import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const forceMock = process.env.EXPO_PUBLIC_USE_MOCK === '1';

function isPlaceholder(v: string | undefined): boolean {
  return !v
    || v.includes('YOUR_PROJECT_REF')
    || v.includes('YOUR_PUBLISHABLE_KEY')
    || v.includes('YOUR_ANON_KEY');
}

const configured = !forceMock && !isPlaceholder(url) && !isPlaceholder(publishableKey);

export const supabase: SupabaseClient | null = configured
  ? createClient(url!, publishableKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function isLiveBackendAvailable(): boolean {
  return supabase !== null;
}
