// Bottom tab bar — Expo Router's <Tabs> with our SCIcon set, themed to
// match the legacy SCBottomTabs (dark pill with primary highlight on the
// active tab).
//
// PLATFORM SPLIT: on web the desktop shell already renders a left
// navigation rail (<WebRail/> inside <WebShell/>), so the bottom tab
// bar is redundant there. The web branch renders a plain <Slot/>
// (still wrapped in AuthGate) so route children render directly into
// the shell's content area.

import { Platform } from 'react-native';
import { Slot, Tabs } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { SCIcon, type IconName } from '@/components/SCIcon';
import { AuthGate } from '@/components/AuthGate';

const tabIcon = (name: IconName) =>
  ({ color, size }: { color: string; size: number }) => (
    <SCIcon name={name} size={size} color={color} />
  );

export default function TabsLayout() {
  const t = useTokens();

  if (Platform.OS === 'web') {
    return (
      <AuthGate>
        <Slot />
      </AuthGate>
    );
  }

  return (
    <AuthGate>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.ink3,
        tabBarStyle: {
          backgroundColor: t.card,
          borderTopColor: t.line,
        },
        tabBarLabelStyle: {
          fontSize: 10, letterSpacing: 1.2, fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'HOME', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="map" options={{ title: 'MAP', tabBarIcon: tabIcon('pin') }} />
      <Tabs.Screen name="chat" options={{ title: 'CHAT', tabBarIcon: tabIcon('chat') }} />
      <Tabs.Screen name="profile" options={{ title: 'PROFILE', tabBarIcon: tabIcon('profile') }} />
    </Tabs>
    </AuthGate>
  );
}
