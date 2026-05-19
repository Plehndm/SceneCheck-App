// Push notifications — Expo Push API surface. Mirrors the architecture
// doc's notification flow:
//   Edge Function → Expo Push API → APNs/FCM → device
// (Architecture doc, "Push notifications" section.)
//
// This module owns the device side: permission request, token retrieval,
// and the local-notification handler config. The actual server-side
// dispatch lives in supabase/functions/dispatch-notification.
//
// In mock-mode (no Supabase configured) the token is just logged. In
// live-mode the token should be persisted to `profiles.expo_push_token`
// so the dispatch function can target this device.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase, isLiveBackendAvailable } from './supabase';

// Foreground-notification behavior. Without this set, banners are
// suppressed when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface RegisterResult {
  status: PermissionStatus;
  token: string | null;
  // True if we attempted to persist the token to Supabase.
  persisted: boolean;
  error?: string;
}

export async function registerForPushNotifications(): Promise<RegisterResult> {
  // Push notifications don't exist on web in the same way; bail early.
  if (Platform.OS === 'web') {
    return { status: 'undetermined', token: null, persisted: false };
  }
  // Simulators can't get push tokens.
  if (!Device.isDevice) {
    return { status: 'undetermined', token: null, persisted: false, error: 'Push requires a physical device.' };
  }

  // Ensure Android has a channel — required for FR10.x to deliver banners.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status: PermissionStatus = existing.status as PermissionStatus;
  if (status !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    status = requested as PermissionStatus;
  }
  if (status !== 'granted') {
    return { status, token: null, persisted: false };
  }

  try {
    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token = tokenResp.data;
    const persisted = await persistTokenIfLive(token);
    return { status, token, persisted };
  } catch (e) {
    return {
      status, token: null, persisted: false,
      error: e instanceof Error ? e.message : 'Failed to get push token.',
    };
  }
}

async function persistTokenIfLive(token: string): Promise<boolean> {
  if (!isLiveBackendAvailable() || !supabase) return false;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

// Convenience subscribers for the two events we care about. Components
// in the app can call these in useEffect to react to push taps + foreground deliveries.
export function onNotificationReceived(handler: (n: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(handler);
}

export function onNotificationResponseReceived(handler: (r: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
