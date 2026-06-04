// Settings → Linked calendar. FR7.2 — Google Calendar OAuth connect /
// disconnect, plus a graceful "not set up yet" affordance for builds without
// OAuth credentials wired. Apple / Outlook stay as inert single-select options
// until a later phase.
//
// CRASH FIX (web + native): `expo-auth-session`'s `Google.useAuthRequest(...)`
// has to be called at render, and it errors when no client id is configured
// for the current platform — which crashed this screen on BOTH web and native
// whenever `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` is unset (the "calendar link
// button gives an error when pressed" report — pressing the row navigates here
// and the screen blew up on mount). We now only mount the OAuth-driving row
// when `googleCalendar.isConfigured()` is true; otherwise a sibling row renders
// the same affordance and surfaces a friendly "sync isn't set up yet" toast on
// press instead of crashing. `isConfigured()` is derived from a build-time env
// var, so the branch is stable for the session (no conditional-hook hazard).
// Mock mode reports configured=true, so demos/tests keep the connect row (its
// OAuth flow is short-circuited in mock mode anyway).

import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import * as googleCalendar from '@/lib/google-calendar';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';
import type { LinkedCalendar } from '@/store/useStore';

// On web, expo-auth-session redirects back through the same browser tab.
// Calling this at module scope finalises that round-trip before the screen
// mounts. On native it's a no-op.
WebBrowser.maybeCompleteAuthSession();

const OTHER_OPTIONS: { k: NonNullable<LinkedCalendar>; label: string; desc: string }[] = [
  { k: 'apple', label: 'Apple Calendar', desc: 'Sync to iCloud across your devices' },
  { k: 'outlook', label: 'Outlook', desc: 'Microsoft 365 / Outlook.com' },
];

export default function LinkedCalendarScreen() {
  const t = useTokens();
  const value = useStore(s => s.linkedCalendar);
  const setValue = useStore(s => s.setLinkedCalendar);

  // Whether real OAuth credentials are wired for this build. When false we
  // skip the `useAuthRequest` hook entirely (it would throw on render) and
  // render the graceful "not set up yet" row instead.
  const configured = googleCalendar.isConfigured();

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText variant="labelCap" color={t.ink3}>SETTINGS</SCText>
        <SCText variant="displayTight" size={28} style={{ marginTop: 4 }}>Linked calendar</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6, lineHeight: 19 }}>
          When you join or create an event, SceneCheck will mirror it to your linked calendar.
        </SCText>
      </View>

      <View style={{ paddingHorizontal: 14, gap: 8 }}>
        {/* Google Calendar. Only the configured variant mounts the OAuth hook —
            the not-configured variant avoids the crash and toasts instead. */}
        {configured ? <GoogleConnectRow /> : <GoogleNotConfiguredRow />}

        {/* Other providers stay here as inert (legacy single-select). Picking
            one still updates the store so feature flags downstream can branch
            on it; the actual sync ships only for Google in this iteration. */}
        {OTHER_OPTIONS.map(opt => {
          const selected = value === opt.k;
          return (
            <Pressable
              key={opt.k}
              onPress={() => setValue(opt.k)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <SCCard style={{
                padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? t.primary : t.line,
              }}>
                <View style={{
                  width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: t.subtle,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <SCIcon name="calendar" size={16} color={selected ? t.primary : t.ink2} />
                </View>
                <View style={{ flex: 1 }}>
                  <SCText size={14} weight={selected ? '600' : '500'}>{opt.label}</SCText>
                  <SCText size={11} color={t.ink3} style={{ marginTop: 1 }}>{opt.desc}</SCText>
                </View>
                {selected && (
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: t.primary,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SCIcon name="check" size={12} color={t.primaryInk} />
                  </View>
                )}
              </SCCard>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setValue(null)}
          style={({ pressed }) => [{
            padding: 12, marginTop: 4,
            borderRadius: RADIUS.md, borderWidth: 1, borderColor: t.line,
            alignItems: 'center',
          }, pressed && { opacity: 0.85 }]}
        >
          <SCText variant="mono" size={11} weight="600" color={t.ink2}>UNLINK CALENDAR</SCText>
        </Pressable>
      </View>
    </Screen>
  );
}

// ── Google rows ──────────────────────────────────────────────────────────────

// Rendered only when `googleCalendar.isConfigured()` — this is the ONLY place
// the `expo-auth-session` hook is called, so an unconfigured build never hits
// the render-time crash.
function GoogleConnectRow() {
  const t = useTokens();
  const value = useStore(s => s.linkedCalendar);
  const setValue = useStore(s => s.setLinkedCalendar);
  const showToast = useStore(s => s.showToast);

  // Google connection state is owned by the lib. We start optimistic from the
  // store (set to 'google' iff the user previously connected) and re-sync on
  // connect/disconnect + when the route refocuses after the OAuth round-trip.
  const [googleConnected, setGoogleConnected] = useState(value === 'google');
  useEffect(() => { setGoogleConnected(value === 'google'); }, [value]);

  const [request, response, promptAsync] = Google.useAuthRequest(
    googleCalendar.getAuthRequestConfig(),
  );

  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') return;
    const auth = response.authentication;
    if (!auth?.accessToken) {
      showToast({ message: "Google didn't return an access token.", kind: 'error' });
      return;
    }
    const expiresIn = typeof auth.expiresIn === 'number' ? auth.expiresIn : 3600;
    googleCalendar
      .completeConnect(auth.accessToken, null, expiresIn)
      .then(() => {
        setValue('google');
        setGoogleConnected(true);
        showToast({ message: 'Google Calendar connected.', kind: 'success' });
      })
      .catch((e) => {
        showToast({
          message: e instanceof Error
            ? `Couldn't finish connecting: ${e.message}`
            : "Couldn't finish connecting.",
          kind: 'error',
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const handleConnect = async () => {
    // Mock mode preserves the pre-hook behaviour: `googleCalendar.connect()`
    // returns success immediately without touching the OAuth flow.
    if (api.isMock()) {
      try {
        await googleCalendar.connect();
        setValue('google');
        setGoogleConnected(true);
        showToast({ message: 'Google Calendar connected.', kind: 'success' });
      } catch (e) {
        showToast({
          message: e instanceof Error ? `Couldn't connect: ${e.message}` : "Couldn't connect.",
          kind: 'error',
        });
      }
      return;
    }
    if (!request) {
      showToast({ message: 'OAuth not ready yet — try again.', kind: 'info' });
      return;
    }
    promptAsync().catch((e) => {
      showToast({
        message: e instanceof Error ? `Couldn't connect: ${e.message}` : "Couldn't connect.",
        kind: 'error',
      });
    });
  };

  const handleDisconnect = async () => {
    try {
      await googleCalendar.disconnect();
      setValue(null);
      setGoogleConnected(false);
      showToast({ message: 'Google Calendar disconnected.', kind: 'info' });
    } catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't disconnect: ${e.message}` : "Couldn't disconnect.",
        kind: 'error',
      });
    }
  };

  return (
    <SCCard style={{
      padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
      borderWidth: googleConnected ? 1.5 : 1,
      borderColor: googleConnected ? t.primary : t.line,
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: t.subtle,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <SCIcon name="calendar" size={16} color={googleConnected ? t.primary : t.ink2} />
      </View>
      <View style={{ flex: 1 }}>
        <SCText size={14} weight={googleConnected ? '600' : '500'}>Google Calendar</SCText>
        <SCText size={11} color={t.ink3} style={{ marginTop: 1 }}>
          {googleConnected ? 'Connected — events will sync.' : 'Sync events to your Google account'}
        </SCText>
      </View>
      {googleConnected ? (
        <Pressable
          onPress={handleDisconnect}
          accessibilityLabel="Disconnect Google Calendar"
          style={({ pressed }) => [{
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md,
            borderWidth: 1, borderColor: t.danger + '59', backgroundColor: t.card,
          }, pressed && { opacity: 0.85 }]}
        >
          <SCText variant="mono" size={10} weight="700" color={t.danger}>
            DISCONNECT
          </SCText>
        </Pressable>
      ) : (
        <Pressable
          onPress={handleConnect}
          accessibilityLabel="Connect Google Calendar"
          style={({ pressed }) => [{
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md,
            backgroundColor: t.primary, borderWidth: 1, borderColor: t.primary,
          }, pressed && { opacity: 0.85 }]}
        >
          <SCText variant="mono" size={10} weight="700" color={t.primaryInk}>
            CONNECT
          </SCText>
        </Pressable>
      )}
    </SCCard>
  );
}

// Rendered when OAuth isn't configured. No `useAuthRequest` here, so the screen
// can't crash; pressing the row explains that sync isn't ready yet.
function GoogleNotConfiguredRow() {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);
  const notReady = () =>
    showToast({
      message: "Google Calendar sync isn't fully set up yet — it's coming soon.",
      kind: 'info',
      duration: 4200,
    });
  return (
    <Pressable onPress={notReady} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <SCCard style={{
        padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
        borderWidth: 1, borderColor: t.line,
      }}>
        <View style={{
          width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: t.subtle,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <SCIcon name="calendar" size={16} color={t.ink2} />
        </View>
        <View style={{ flex: 1 }}>
          <SCText size={14} weight="500">Google Calendar</SCText>
          <SCText size={11} color={t.ink3} style={{ marginTop: 1 }}>
            Sync events to your Google account
          </SCText>
        </View>
        <View style={{
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md,
          borderWidth: 1, borderColor: t.line, backgroundColor: t.subtle,
        }}>
          <SCText variant="mono" size={10} weight="700" color={t.ink2}>
            COMING SOON
          </SCText>
        </View>
      </SCCard>
    </Pressable>
  );
}
