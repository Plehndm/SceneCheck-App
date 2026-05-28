// Settings → Linked calendar. FR7.2 — Google Calendar OAuth connect /
// disconnect, plus a "not configured" affordance for builds without OAuth
// credentials wired. The other calendar providers (Apple, Outlook) stay
// here as inert options until Phase 4.x.
//
// State:
// - The Google connection is owned by lib/google-calendar.ts. We just call
//   isConfigured() to know whether the connect button should be live, and
//   connect()/disconnect() to flip the connection. Local UI state caches
//   the "connected" flag so the row re-renders immediately.
// - The store's `linkedCalendar` slice still drives the radio for Apple /
//   Outlook (legacy single-select). When the user connects Google we also
//   set the store value to 'google' so create-event / event-detail (which
//   read from the store) know to fire the calendar side-effects.

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
  const showToast = useStore(s => s.showToast);

  // OAuth credentials may not be wired in dev builds — the connect button
  // surfaces a different label in that case so the user knows to update
  // .env / AGENTS.md instead of tapping a dead button.
  const configured = googleCalendar.isConfigured();
  // Google connection state is owned by the lib. We start optimistic from
  // the store (set to 'google' iff the user previously connected) and let
  // a refresh effect re-sync after connect/disconnect.
  const [googleConnected, setGoogleConnected] = useState(value === 'google');

  // Keep the local flag in sync with the store on mount + when the route
  // refocuses; the OAuth web flow returns to the app and the lib stamps
  // the store, so this catches that.
  useEffect(() => { setGoogleConnected(value === 'google'); }, [value]);

  // expo-auth-session's Google provider must be driven from a component —
  // the hook returns `[request, response, promptAsync]`. `request` is null
  // until the env-keyed config resolves (so the connect button stays
  // pressable but `promptAsync()` is gated below). On a successful response
  // the `useEffect` downstream extracts the access token and hands it to
  // `googleCalendar.completeConnect`. Mock mode short-circuits this entirely
  // (`googleCalendar.connect()` returns a fake success without ever calling
  // promptAsync), so the hook config not being available in mock builds is
  // not a regression.
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
    // Implicit-flow tokens don't carry a refresh token, so completeConnect
    // is called with refresh_token=null. `insertEvent` handles the expired-
    // access-token case by throwing a 'reconnect' error, which the
    // event-detail / create-event call sites surface as a side-effect toast
    // ("Joined, but couldn't add to your Calendar.") without blocking the
    // primary flow. The user reconnects from this same screen.
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
    // Only react to a new `response`; everything else here is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const handleConnect = async () => {
    if (!configured) {
      showToast({
        message: 'Google OAuth isn\'t configured for this build. See scenecheck-expo/AGENTS.md.',
        kind: 'info',
        duration: 6000,
      });
      return;
    }
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
    // promptAsync resolves once the user finishes (or cancels) the consent
    // flow; the `useEffect` above completes the connection on success.
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
    <Screen>
      <SCTopBar onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText variant="labelCap" color={t.ink3}>SETTINGS</SCText>
        <SCText variant="displayTight" size={28} style={{ marginTop: 4 }}>Linked calendar</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6, lineHeight: 19 }}>
          When you join or create an event, SceneCheck will mirror it to your linked calendar.
        </SCText>
      </View>

      {/* Google Calendar — OAuth-backed connect/disconnect row */}
      <View style={{ paddingHorizontal: 14, gap: 8 }}>
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
                backgroundColor: configured ? t.primary : t.subtle,
                borderWidth: 1, borderColor: configured ? t.primary : t.line,
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText
                variant="mono" size={10} weight="700"
                color={configured ? t.primaryInk : t.ink2}
              >
                {configured ? 'CONNECT' : 'OAUTH NOT CONFIGURED'}
              </SCText>
            </Pressable>
          )}
        </SCCard>

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
          onPress={() => { setValue(null); setGoogleConnected(false); }}
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
