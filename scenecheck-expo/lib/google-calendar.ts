// Google Calendar integration (FR7.2).
//
// This module owns the OAuth dance + the calendar.events.insert call, so
// the rest of the app can `await googleCalendar.insertEvent(...)` after a
// successful subscribe without worrying about token lifecycle.
//
// Three modes:
//   1. Mock (`api.isMock()`):    `connect` / `insertEvent` return fake
//                                success objects so screens stay drivable
//                                offline. `isConfigured()` returns true.
//   2. Configured + live:         real OAuth via expo-auth-session, real
//                                POST to googleapis.com.
//   3. Live but not configured:   `isConfigured()` returns false; `connect`
//                                + `insertEvent` throw with a clear setup
//                                instruction so the screen can show a
//                                "Google not configured" banner.
//
// Token storage: kvStorage (SSR-safe wrapper around localStorage on web,
// AsyncStorage on native). Not Secure Storage — Expo SDK 54's
// expo-secure-store would be the upgrade for a production launch; for the
// course project the kv-store approach matches what supabase-js already
// uses for its own access_token persistence.

import { kvStorage } from './storage';
import { isMock } from './api';

// Web OAuth client ID created in Google Cloud Console. The actual value
// is wired via env var so the codebase doesn't ship a secret — see the
// notes at the bottom of this file + AGENTS.md for the setup steps.
export const GOOGLE_OAUTH_CLIENT_ID: string | null =
  process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || null;

// expo-auth-session also accepts a separate iOS / Android client id;
// callers that want native-only flows can wire them up here later. For
// the FR7.2 deliverable we only need the web client id (works for Expo
// Go + the web bundle).
export const GOOGLE_OAUTH_IOS_CLIENT_ID: string | null =
  process.env.EXPO_PUBLIC_GOOGLE_OAUTH_IOS_CLIENT_ID || null;
export const GOOGLE_OAUTH_ANDROID_CLIENT_ID: string | null =
  process.env.EXPO_PUBLIC_GOOGLE_OAUTH_ANDROID_CLIENT_ID || null;

// Calendar scope only — the user shouldn't be asked for Drive / Gmail.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// kvStorage keys. Prefixed so future Google integrations (Drive, etc.) can
// reuse the pattern without colliding.
const KEY_ACCESS = 'google_calendar_access_token';
const KEY_REFRESH = 'google_calendar_refresh_token';
const KEY_EXPIRES = 'google_calendar_expires_at';

export interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: number; // ms-since-epoch
}

export interface InsertEventParams {
  summary: string;
  description?: string;
  location?: string;
  // ISO-8601 datetime strings (with timezone offset preferred). Google
  // Calendar accepts either `dateTime` (timed) or `date` (all-day); we
  // only support timed events here, which is what the SceneCheck flow
  // produces. End is optional — Google defaults to start + 1h.
  startISO: string;
  endISO?: string;
}

export interface InsertEventResult {
  event_id: string;
  html_link: string;
}

// ---- public API ---------------------------------------------------------

export function isConfigured(): boolean {
  // Mock mode pretends to be configured so the screen's "connect to Google"
  // CTA shows up in demos / tests.
  if (isMock()) return true;
  return !!GOOGLE_OAUTH_CLIENT_ID;
}

/**
 * Open the OAuth consent screen and return tokens.
 *
 * Mock mode returns a static success object. Live mode dynamically imports
 * expo-auth-session (so this file doesn't crash to import-time errors if
 * the package isn't installed at typecheck time — the dep is in
 * package.json and `npm install` is a one-time thing).
 */
export async function connect(): Promise<GoogleTokens> {
  if (isMock()) {
    const tokens: GoogleTokens = {
      access_token: 'mock-google-access-token',
      refresh_token: 'mock-google-refresh-token',
      expires_at: Date.now() + 3600 * 1000,
    };
    await persistTokens(tokens);
    return tokens;
  }
  if (!isConfigured()) {
    throw new Error(
      'Google OAuth is not configured. Set EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID in '
      + '.env.local with a Web client id from Google Cloud Console — see AGENTS.md / docs.',
    );
  }

  // Dynamic import keeps the package optional at module-load time. If the
  // dependency is missing (e.g. running tests without `npm install`) the
  // error message is clear instead of an opaque module-not-found at app boot.
  // The ts-ignore is unavoidable: expo-auth-session is listed in package.json
  // but tsc may run before `npm install` has populated node_modules (CI,
  // fresh clones), and the path is dynamic enough that even with the package
  // present the bundler treats it as runtime-only.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  let _google: any;
  try {
    // The Google provider's promptAsync triggers the consent flow.
    // expo-auth-session is in package.json (~7.0.x for SDK 54). The dynamic
    // import keeps the module out of the Metro graph in mock mode and lets
    // a missing install surface as a friendly error rather than a hard
    // bundler failure at boot.
    _google = await import('expo-auth-session/providers/google');
  } catch {
    throw new Error('expo-auth-session is not installed. Run `npm install` to pick up FR7.2 dependencies.');
  }

  // The provider needs to be configured + invoked from inside a React
  // component (the hook returns [request, response, promptAsync]). Calling
  // it from a plain async function isn't supported by expo-auth-session's
  // hook contract. So this helper exposes the *configuration* the screen
  // hook needs; the actual flow is driven from a UI hook (the screen agent
  // will wire useAuthRequest at the call site). To keep this file usable
  // standalone, we also expose a programmatic fallback below.
  throw new Error(
    'Google OAuth requires a React component to drive the consent flow. '
    + 'Call useGoogleAuthRequest() from your screen and pass the resulting '
    + 'tokens to googleCalendar.completeConnect(). See lib/google-calendar.ts.',
  );
}

/**
 * Hook-friendly config the screen feeds into
 * `expo-auth-session/providers/google`'s `useAuthRequest`. Exporting this
 * (instead of the hook itself) keeps this module React-free, which matches
 * how `lib/*` is organized.
 *
 * Token-flow (implicit) on purpose: the web client doesn't ship a client
 * secret, so the code-exchange + refresh-token flow can't complete without
 * a backend exchanger. The user re-presses Connect when the 1-hour access
 * token expires — acceptable for the course-project surface. If/when the
 * project gains a refresh-token-exchange Edge Function, swap to
 * `responseType: 'code'` + `extraParams: { access_type: 'offline' }` and
 * route the returned code through that endpoint.
 */
export function getAuthRequestConfig() {
  return {
    clientId: GOOGLE_OAUTH_CLIENT_ID ?? undefined,
    iosClientId: GOOGLE_OAUTH_IOS_CLIENT_ID ?? undefined,
    androidClientId: GOOGLE_OAUTH_ANDROID_CLIENT_ID ?? undefined,
    webClientId: GOOGLE_OAUTH_CLIENT_ID ?? undefined,
    scopes: SCOPES,
  };
}

/**
 * Persist tokens returned by the screen's OAuth flow. Called once the
 * useAuthRequest response resolves to a token exchange success.
 */
export async function completeConnect(
  access_token: string,
  refresh_token: string | null,
  expires_in_seconds: number,
): Promise<GoogleTokens> {
  const tokens: GoogleTokens = {
    access_token,
    refresh_token,
    expires_at: Date.now() + Math.max(0, expires_in_seconds - 60) * 1000, // -60s safety margin
  };
  await persistTokens(tokens);
  return tokens;
}

/**
 * Clear the locally-stored tokens. Doesn't revoke them on Google's side —
 * a full revoke would require an extra POST to oauth2/revoke; the user
 * can do that from their Google Account settings.
 */
export async function disconnect(): Promise<void> {
  await Promise.all([
    kvStorage.removeItem(KEY_ACCESS),
    kvStorage.removeItem(KEY_REFRESH),
    kvStorage.removeItem(KEY_EXPIRES),
  ]);
}

/**
 * POST the calendar event. Refreshes the access token on 401 once, then
 * gives up (the user must re-connect). The Google Calendar contract is
 * documented in docs/IN4MATX 43 Architecture Document.md.
 */
export async function insertEvent(params: InsertEventParams): Promise<InsertEventResult> {
  if (isMock()) {
    return {
      event_id: 'mock-gcal-' + Date.now(),
      html_link: 'https://calendar.google.com/event?eid=mock',
    };
  }

  let tokens = await loadTokens();
  if (!tokens) {
    throw new Error('Google Calendar is not connected. Call googleCalendar.connect() first.');
  }
  if (Date.now() >= tokens.expires_at) {
    tokens = await refreshAccessToken(tokens);
  }

  const body = buildEventBody(params);
  let res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (res.status === 401) {
    // Access token rejected — try once with a refresh.
    tokens = await refreshAccessToken(tokens);
    res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Calendar insert failed (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json() as { id: string; htmlLink: string };
  return { event_id: data.id, html_link: data.htmlLink };
}

// ---- internals ----------------------------------------------------------

async function persistTokens(t: GoogleTokens): Promise<void> {
  await Promise.all([
    kvStorage.setItem(KEY_ACCESS, t.access_token),
    t.refresh_token
      ? kvStorage.setItem(KEY_REFRESH, t.refresh_token)
      : kvStorage.removeItem(KEY_REFRESH),
    kvStorage.setItem(KEY_EXPIRES, String(t.expires_at)),
  ]);
}

async function loadTokens(): Promise<GoogleTokens | null> {
  const [access, refresh, expires] = await Promise.all([
    kvStorage.getItem(KEY_ACCESS),
    kvStorage.getItem(KEY_REFRESH),
    kvStorage.getItem(KEY_EXPIRES),
  ]);
  if (!access || !expires) return null;
  return {
    access_token: access,
    refresh_token: refresh ?? null,
    expires_at: Number.parseInt(expires, 10) || 0,
  };
}

async function refreshAccessToken(prev: GoogleTokens): Promise<GoogleTokens> {
  if (!prev.refresh_token) {
    throw new Error('Google Calendar access token expired and no refresh token is available — reconnect.');
  }
  if (!GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error('Cannot refresh Google access token without EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID.');
  }
  // Public-client refresh — no client_secret on mobile / SPA flows.
  const body = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: prev.refresh_token,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token refresh failed (${res.status}): ${text || res.statusText}`);
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  const tokens: GoogleTokens = {
    access_token: data.access_token,
    refresh_token: prev.refresh_token, // refresh response doesn't include a new refresh_token
    expires_at: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
  };
  await persistTokens(tokens);
  return tokens;
}

function buildEventBody(params: InsertEventParams) {
  return {
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: { dateTime: params.startISO },
    end: { dateTime: params.endISO ?? defaultEnd(params.startISO) },
  };
}

function defaultEnd(startISO: string): string {
  // Default to start + 1h when no end is provided.
  const start = new Date(startISO).getTime();
  if (Number.isNaN(start)) return startISO;
  return new Date(start + 3600 * 1000).toISOString();
}

// Aggregate export so callers can write `googleCalendar.insertEvent(...)`,
// which matches how the architecture doc names the integration.
export const googleCalendar = {
  isConfigured,
  connect,
  completeConnect,
  disconnect,
  insertEvent,
  getAuthRequestConfig,
};

// ---- USER ACTION CHECKLIST (FR7.2) --------------------------------------
//
// To enable real Google Calendar inserts, the user must:
//
//   1. Open https://console.cloud.google.com/ and select / create a project.
//   2. Enable the "Google Calendar API" (APIs & Services → Library).
//   3. Configure the OAuth consent screen (External, In testing is fine for
//      the course project). Add the scope:
//        https://www.googleapis.com/auth/calendar.events
//      Add test users (the developer's Google account, plus anyone running
//      a demo). Skip publishing — staying in "Testing" is intentional.
//   4. APIs & Services → Credentials → Create credentials → OAuth client ID:
//        - Application type: Web application (works for Expo Go + web).
//        - Authorized JavaScript origins: `https://auth.expo.io`,
//          `http://localhost:8081` (Expo dev), plus your production origin.
//        - Authorized redirect URIs: `https://auth.expo.io/@<your-expo-
//          username>/scenecheck-expo`. Expo's AuthSession proxies through
//          this; the exact value is what `AuthSession.makeRedirectUri()`
//          returns at runtime — log it once and paste it in.
//   5. Copy the client ID into `scenecheck-expo/.env.local`:
//        EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=<the_client_id>.apps.googleusercontent.com
//   6. Restart the Expo dev server so the env var is picked up.
//
// Without these steps the screen surfaces a "Google not configured" message
// and the rest of the app keeps working (mock mode pretends to succeed).
