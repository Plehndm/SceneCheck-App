// Root layout. Wraps the entire app in our ThemeProvider so any screen
// can read tokens via useTokens(). Drops the template's @react-navigation
// ThemeProvider since we manage palette/mode in the Zustand store and
// render our own header chrome (the navigation header is hidden).

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { ToastHost } from '@/components/ToastHost';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AuthBootstrap } from '@/components/AuthBootstrap';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // Subscribe so StatusBar style flips with the active mode.
  const mode = useStore(s => s.mode);
  return (
    // SafeAreaProvider must wrap the tree so the custom SCTopBar /
    // Screen `SafeAreaView edges={['top']}` get real top insets on
    // native — otherwise the back buttons + headers render under the
    // status bar / notch.
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="event/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="profile/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="events" options={{ presentation: 'card' }} />
          <Stack.Screen name="search" options={{ presentation: 'card' }} />
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="settings/blocked" options={{ presentation: 'card' }} />
          <Stack.Screen name="settings/linked-calendar" options={{ presentation: 'card' }} />
          <Stack.Screen name="settings/help" options={{ presentation: 'card' }} />
          <Stack.Screen name="requests" options={{ presentation: 'card' }} />
          <Stack.Screen name="my-hosting" options={{ presentation: 'card' }} />
          <Stack.Screen name="my-events" options={{ presentation: 'card' }} />
          <Stack.Screen name="my-friends" options={{ presentation: 'card' }} />
          <Stack.Screen name="my-following" options={{ presentation: 'card' }} />
          <Stack.Screen name="attendees/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="interests/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="interests/[tag]" options={{ presentation: 'card' }} />
          <Stack.Screen name="ratings/[hostId]" options={{ presentation: 'card' }} />
          <Stack.Screen name="new-chat" options={{ presentation: 'modal' }} />
          {/* Card (not modal): native modals render in a separate layer
              above the root ToastHost/ConfirmDialog, which hid the
              "Saved to Drafts" / publish-error toasts + the save-draft
              confirm. A card route keeps those overlays visible. */}
          <Stack.Screen name="create-event" options={{ presentation: 'card' }} />
          <Stack.Screen name="event-published" options={{ presentation: 'card' }} />
          <Stack.Screen name="drafts" options={{ presentation: 'card' }} />
          {/* Sign-in is the unauthenticated entry point (AuthGate
              redirects here), so it's a full-screen route — not a
              modal. Same for reset-password since users land on it
              directly from the recovery email link. Sign-up and
              forgot-password are reached from sign-in and slide up
              as modals so the user can dismiss to return. */}
          <Stack.Screen name="auth/sign-in" />
          <Stack.Screen name="auth/reset-password" />
          <Stack.Screen name="auth/sign-up" options={{ presentation: 'modal' }} />
          <Stack.Screen name="auth/forgot-password" options={{ presentation: 'modal' }} />
        </Stack>
        <AuthBootstrap />
        <ToastHost />
        <ConfirmDialog />
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
