# Code Review Report — Round 2 (Post-Migration)

_Date: 2026-05-19 | Reviewer: Senior Code Reviewer (Claude) | Scope: Delta review against `docs/CODE_REVIEW_REPORT.md` — new code in `scenecheck-expo/`, updated `supabase/` (migrations 00014–00015 + all 9 Edge Functions). Legacy prototype in `legacy/` is out of scope._

This is a follow-up to `docs/CODE_REVIEW_REPORT.md`. That report identified 7 primary findings (4 backend bugs, 2 structural issues, 1 architecture deviation). This report evaluates the disposition of each, then reviews the newly written Expo + TypeScript codebase on its own merits.

---

## Executive Summary

- All 4 backend bugs from the first review are genuinely fixed. The RLS policy rewrite, CORS implementation, atomic-subscribe RPC, and FR10.1 notification dispatch are correct and complete.
- The architecture deviation (web prototype vs. prescribed React Native + Expo + TypeScript + Zustand) is resolved. The new codebase matches the architecture document almost exactly, and the improvements beyond the spec (strict TS, platform-split Map, mock-mode fallback) are thoughtful additions.
- The Zustand store is substantially better than the old 21-state god component: slices are clean, mutations are correct and idempotent, and persistence handles the `Set`-serialization pitfall explicitly. Test coverage of the store is 90%.
- The platform-split Map is textbook Metro pattern: shared contract in `types.ts`, native/web implementations behind suffix resolution, clean `index.ts` barrel. The only design gap is that the web implementation imports `leaflet/dist/leaflet.css` at module level, which will crash any non-web test bundle that imports `Map.web.tsx` directly.
- The most significant new structural issue is a route mismatch: `app/event/[id].tsx` routes to `/event/${e.id}/attendees` (line 249), but the Expo Router layout registers the attendees screen as `attendees/[id]` (not nested under `event/`). This is a navigation bug that would 404 at runtime.
- Screen tests are a genuine step forward from 0% to ~55% coverage, but 17 of the 33 screen tests only verify static render ("this text appears") without exercising any state transition. The tests that do exercise state (event-detail join/leave, requests accept/decline, settings mutations) are the valuable ones worth expanding.
- `lib/api.ts` still hardcodes the UCI-bounding-box coordinate normalization (`x/y` from `lng/lat`) inherited from the prototype, now in two places: `transformEventRow` (line 117) and `components/Map/types.ts:eventLatLng` (lines 43–46). The latter is correct; the former is dead weight in live mode.

---

## 1. Status of First-Review Findings

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Profiles RLS SELECT policy leaked private profiles to any non-blocker | ✅ Fixed | `supabase/migrations/00014_fix_profiles_rls.sql` — drops old policy, installs `are_friends()` helper, correct three-case predicate (owner / public+unblocked / private+friend+unblocked) |
| 2 | All Edge Functions missing CORS headers | ✅ Fixed | `_shared/supabase-client.ts:12–17` — `CORS_HEADERS` constant + `handlePreflight()` wired into all 9 `index.ts` files (verified: `create-event`, `dispatch-notification`, `ingest-scraped`, `organizer-remove`, `promote-waitlist`, `rank-events`, `rollup-rating`, `send-friend-request`, `subscribe-to-event`) |
| 3 | `subscribe-to-event` capacity-check race condition | ✅ Fixed | `supabase/migrations/00015_atomic_subscribe.sql` — `subscribe_to_event_atomic` RPC uses `pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0))`, reads confirmed count directly (not the materialized `subscriber_count`), handles idempotency and waitlist in one transaction |
| 4 | `send-friend-request` never invoked `dispatch-notification` (FR10.1) | ✅ Fixed | `supabase/functions/send-friend-request/index.ts:90–105` — fire-and-forget `void admin.functions.invoke(...)` with correct `notifType` branching between `friend.added` and `friend.requested`, includes `deep_link` and `actor_id` |
| 5 | `app.jsx` 778-line god component, 21 useStates, 0% coverage | ✅ Fixed | `scenecheck-expo/store/useStore.ts` — Zustand store with 7 declared slices, AsyncStorage persistence with explicit `Set`-rehydration; store unit tests at 90% line coverage (25 cases) |
| 6 | `eventsOverlap` / `scFindConflict` duplicated in two files | ✅ Fixed | `scenecheck-expo/lib/conflicts.ts` — single `eventsOverlap` + `findConflict` + `findAllConflicts`, accepts injected `eventsById` map (no `window` access), 17 unit tests pass |
| 7 | Web prototype vs. prescribed React Native + Expo + TypeScript + Zustand stack | ✅ Fixed | `scenecheck-expo/` — Expo SDK 54, TypeScript strict mode, Expo Router, Zustand v5, `react-native-maps` (native), `react-leaflet` (web), `expo-location`, `expo-image-picker`, `expo-notifications` |

---

## 2. Best Practices — New Code

### Critical

**`app/event/[id].tsx:249` — Attendees navigation route mismatch**

The event detail screen routes to `/event/${e.id}/attendees`:

```typescript
onPress={() => router.push(`/event/${e.id}/attendees` as never)}
```

But the Expo Router root layout (`app/_layout.tsx:41`) registers the screen as:

```typescript
<Stack.Screen name="attendees/[id]" options={{ presentation: 'card' }} />
```

The physical file is at `app/attendees/[id].tsx` (not `app/event/[id]/attendees.tsx`). At runtime this navigation silently 404s because the Expo Router file-system convention is the source of truth and the path `/event/e1/attendees` has no corresponding file. The correct call is:

```typescript
router.push(`/attendees/${e.id}` as never)
```

This also means the attendees screen tests (`tests/screens/attendees.test.tsx`) do not exercise the navigation path from the event detail screen, so the bug exists even though tests pass.

**`scenecheck-expo/store/useStore.ts:172` — Module-level `toastIdCounter` leaks across tests**

```typescript
let toastIdCounter = 0;
```

This counter lives at module scope, outside the Zustand `create()` call. Because Jest caches modules between tests in the same suite and `resetStore()` only resets Zustand state (not the counter), `showToast` returns IDs that keep incrementing across tests. Any test that checks `toasts[0].id` would fail if it runs after a prior test that showed a toast. Currently tests only check `.id` against the returned value, not a hardcoded number, so this is latent rather than actively failing — but it will bite when test ordering changes or new tests are added that assert on a specific ID value.

Fix: move the counter inside the store as `toastIdCounter: number` and increment it with `set(s => ({ toastIdCounter: s.toastIdCounter + 1 }))`, or reset it in `resetStore()`.

### Important

**`scenecheck-expo/lib/api.ts:117–118` — Dead coordinate normalization in `transformEventRow`**

```typescript
x: row.lng != null ? (row.lng + 117.88) / 0.12 : 0.5,
y: row.lat != null ? (row.lat - 33.62) / 0.06 : 0.5,
```

This converts real `lat/lng` to the prototype's normalized `x/y` coordinate space. In live mode the `Map` component now uses `eventLatLng(e)` from `components/Map/types.ts`, which does the inverse transform back to real coordinates. So in live mode the roundtrip is: real lat/lng → normalize to x/y → denormalize back to lat/lng. This is lossy (floating-point roundtrip) and meaningless. The `x/y` fields exist in `SCEvent` only for the prototype's SVG map, which no longer exists. The live-mode transform should just store `lat` and `lng` directly on the event object or omit the normalization entirely.

**`scenecheck-expo/app/(tabs)/map.tsx:36` — Hardcoded date string**

```typescript
<SCText variant="labelCap">Sat May 9 · Irvine</SCText>
```

This is a literal from the prototype. It will always show "Sat May 9" regardless of the actual date. The prototype had this as a "today's headline" display that was never wired to real date logic. Now that there is `lib/date-time.ts` with `fmtDate()`, this should be:

```typescript
<SCText variant="labelCap">{fmtDate(new Date())} · Irvine</SCText>
```

**`scenecheck-expo/store/useStore.ts:287–290` — Hardcoded mock blocked users in production store**

```typescript
blocked: [
  { id: 'b1', name: 'Casey Morgan', username: 'casey_m', reason: 'Blocked Mar 14' },
  { id: 'b2', name: 'Riley Tanaka', username: 'rileyt', reason: 'Blocked Feb 02' },
],
```

Mock-mode fixture data is baked into the live Zustand store's initial state. When Supabase env vars are present (live mode), these fake blocked users will appear in `Settings > Blocked` until the user's real block list loads. The mock data should live only in the test reset utility or be guarded: `blocked: isMock() ? [...fixtures] : []`.

**`scenecheck-expo/app/event/[id].tsx:101` — `isHost` condition is redundant and potentially incorrect**

```typescript
const isHost = e.kind === 'yours' || e.hostId === 'me';
```

`e.kind === 'yours'` already implies `e.hostId === 'me'` in the mock data, because `transformEventRow` in `lib/api.ts` sets `kind = 'yours'` only when `row.creator_id === currentUserId`. The second clause `e.hostId === 'me'` is a literal string comparison with the mock ID, which will always be false in live mode (where `hostId` would be a UUID). This means host actions (Edit/Cancel) will never appear in live mode even for the actual event creator.

Fix: rely solely on `e.kind === 'yours'` from `transformEventRow`, or add a store field for `me.id` and compare against `e.hostId`.

**`scenecheck-expo/app.json` — `reactCompiler: true` with React 19 — experimental risk**

```json
"experiments": {
  "typedRoutes": true,
  "reactCompiler": true
}
```

React Compiler is still experimental as of Expo SDK 54. It performs automatic memoization and may silently optimize away effects or change render semantics in ways that are hard to debug. For a prototype this is fine, but it should be noted: if any test or screen behaves non-deterministically (unexpected re-renders, effects running twice or zero times), disabling `reactCompiler` is the first diagnostic step.

**`scenecheck-expo/jest.setup.ts:104–110` — Suppressed `act()` warnings hide real test problems**

```typescript
const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('act(...)') || msg.includes('not wrapped in act')) return;
  origError.apply(console, args as Parameters<typeof console.error>);
};
```

The comment says "re-enable once we've adjusted each test." Silencing `act()` warnings globally means tests that have a real async-state-update problem will pass without any signal. The `chat-thread.test.tsx` test that calls `await waitFor(...)` is the right pattern — the fix is to wrap the other async operations correctly, not suppress the warning.

**`scenecheck-expo/components/Map/Map.web.tsx:11` — CSS import at module top creates a testability hazard**

```typescript
import 'leaflet/dist/leaflet.css';
```

This is correctly stubbed in `jest.config.js` (`'^leaflet/dist/leaflet.css$': ...`), but only in the Jest environment. If any non-Jest tool (Storybook, Vitest, a type-check-only tsconfig) picks up `Map.web.tsx` before the stub is applied, it will fail. The import is necessary for Leaflet to render, but a note in the file about the stub requirement would help future maintainers.

### Suggestions

**`scenecheck-expo/lib/api.ts:96–119` — `transformEventRow` has imprecise kind classification**

```typescript
const kind: SCEvent['kind'] = row.source === 'scraped'
  ? 'recommended'
  : row.creator_id === currentUserId
    ? 'yours'
    : 'friend'; // simplified — accurate version needs the friendship table
```

The comment is honest ("simplified"), but the implication is that in live mode, events hosted by non-friends will show as `'friend'` kind with the friend-colored pin and "FRIEND HOSTING" label. This creates incorrect UI. The alternative is to add the friendship lookup to `rank_events_query` (which already has access to the user's friend graph in Postgres) and return an `is_friend_event` boolean.

**Pervasive `as never` routing casts across all 24 screens**

Expo Router with `typedRoutes: true` (enabled in `app.json`) generates typed `href` strings at build time via the `.expo/types/router.d.ts` generated file. When `typedRoutes` is on, `router.push('/search')` should work without a cast. The 65 occurrences of `as never` suggest either the generated types aren't being consumed correctly, or the tsconfig path alias isn't resolving the generated type. With typed routes working, the `as never` casts should be removed — they silence real type errors (like the attendees route mismatch flagged above).

To verify: `npx tsc --noEmit` with the `as never` casts removed from one file and see whether the correct path type is inferred.

**`scenecheck-expo/app/events.tsx:31–44` — `isRecommended` is a file-local helper that duplicates `components/Map/types.ts:pinColor` logic**

```typescript
const isRecommended = (e: SCEvent) =>
  e.kind === 'recommended' || e.interests.some(tag => subscribedInterests.has(tag));
```

The `pinColor` function in `Map/types.ts:56–57` makes the same `kind === 'recommended' || sharesTag` decision. These will diverge if the recommendation criteria change. Extract a `isEventRecommended(e, userInterests)` helper to `lib/` and use it in both places.

---

## 3. Testability of the Migrated Project

### What improved

The most significant testability win is the Zustand store. The old `app.jsx` was a 778-line render function with side effects that made import impossible. Now:

- `useStore.getState()` gives direct access to all state from any test without rendering
- `useStore.setState({...})` in `resetStore()` puts the store in a known fixture state in ~10 lines
- Every store mutator is tested in isolation in `tests/unit/store.test.ts` (25 cases, 90% line coverage)
- `lib/conflicts.ts`, `lib/date-time.ts`, and `lib/api.ts` are plain ES module functions with typed interfaces — importable in any test without setup

The `test-utils.tsx` pattern (`renderScreen`, `resetStore`, `setRouteParams`) is clean and reusable. Every screen test uses it, keeping setup boilerplate minimal.

The `jest.setup.ts` mocks are comprehensive and correct. In particular:
- `expo-router` mock exposes `useLocalSearchParams` as a `jest.fn()` that each screen test overrides with `setRouteParams()` — this is the right pattern for per-test param injection
- `react-native-maps` and `react-leaflet` are both stubbed so neither map implementation crashes during render

### What's still hard to test

**`lib/notifications.ts` — 0% coverage, by design but worth noting**

`registerForPushNotifications` uses `expo-notifications` and `expo-device`, which are mocked globally in `jest.setup.ts`. The function is testable; it just hasn't been tested. The `persistTokenIfLive` private function is not exported and therefore not individually testable — extracting it or making it injectable would enable unit testing the Supabase write path.

**`components/ConfirmDialog.tsx` and `components/ToastHost.tsx` — 0% coverage**

These overlay components are mounted in `app/_layout.tsx` and driven by the store. Screen tests write to the store (`showConfirm`, `showToast`) but render only the individual screen, not the layout. A test that wraps with both `ThemeProvider` and the full `_layout` render would exercise these, but that's heavier. Alternatively, a focused component test:

```typescript
// tests/components/ToastHost.test.tsx
it('renders a toast when the store has one', () => {
  useStore.setState({ toasts: [{ id: 1, message: 'hi', kind: 'info', duration: 0 }] });
  const { getByText } = renderScreen(<ToastHost />);
  expect(getByText('hi')).toBeTruthy();
});
```

**Map components — partial coverage gap**

`Map.web.tsx` is explicitly excluded from Jest coverage (`!components/Map/Map.web.tsx` in `jest.config.js`). `Map.native.tsx` is at 80%/63.6% (statements/branches) because `PROVIDER_GOOGLE` conditional and the `if (user && radiusM > 0)` branch on the `Circle` aren't exercised. These are minor for a prototype but worth tracking.

**Edge Functions — 0% Deno test coverage (unchanged from Review #1)**

The 4 functions modified in the migration (subscribe-to-event, send-friend-request, CORS layer, all functions) have no Deno test files. The atomic-subscribe RPC and the notification dispatch are the two most important to test with `deno test` + a local Supabase instance.

### Coverage observations beyond raw percentages

The 135 screen integration tests are not all equally valuable. Of the 17 screen test files, roughly half are render-only:

```
renders the page chrome              ← verifies nothing broke at render
renders every named section          ← verifies string constants match
```

These are useful as regression guards but tell you little about correctness. The tests with real value — where a `fireEvent` changes store state and the assertion verifies the outcome — are:

- `event-detail.test.tsx:53–68` (join/leave + toast + UNDO action)
- `requests.test.tsx:26–40` (accept/decline modifying friend set)
- `settings.test.tsx:29–52` (visibility/palette/sign-out mutations)
- `create-event.test.tsx:22–61` (validation toast, draft save, draft resume)
- `chat-thread.test.tsx:32–42` (send message appears + composer clears)

The remaining 12 screen files are primarily static renders. Adding 2–3 interaction tests per file would push coverage from 55% to ~70% and, more importantly, catch regressions in user-facing flows.

---

## 4. Cohesion and Coupling — Post-Migration

### Module-by-module assessment

| Module | Responsibility | Assessment |
|---|---|---|
| `lib/date-time.ts` | Time formatting and parsing helpers | High cohesion. Pure functions, fully tested. No dependencies outside `types/domain.ts`. |
| `lib/conflicts.ts` | Event-overlap detection | High cohesion. Accepts an injected `eventsById` map — no global access. Correctly consolidates the previously duplicated logic. |
| `lib/supabase.ts` | Supabase client initialization and mock-mode flag | High cohesion. Correct use of null-initialization when env vars are absent. |
| `lib/api.ts` | Dual-mode API bridge | High cohesion for structure, but contains `x/y` normalization that's a presentation concern (noted in §2). The `fmtWhen`/`fmtTime` private functions duplicate logic from `lib/date-time.ts` — they should use the exported helpers. |
| `lib/notifications.ts` | Expo Push token registration and listener setup | High cohesion. Platform guards are correct. |
| `store/useStore.ts` | Global app state | Good cohesion for Zustand's flat-slice pattern. The store does not have any rendering logic. The one concern is the hardcoded mock blocked users (noted in §2). |
| `components/Map/` | Platform-split map | High cohesion. `types.ts` owns the contract; each platform implementation consumes it. The barrel `index.ts` correctly re-exports only `Map` + `types`. |
| `components/` (SC* primitives) | Reusable UI components | High cohesion. Each component has a single visual responsibility. |
| `theme/` | Token definitions and ThemeProvider | High cohesion. `tokens.ts` exports 3 palettes × 2 modes. `ThemeProvider` reads from the store, not a React context tree. |
| `app/` (24 routes) | Screen components | Medium cohesion by necessity — Expo Router files double as components. Individual files are reasonably sized (100–350 lines). |
| `data/mocks.ts` | Static fixture data | High cohesion. Typed fixtures only; no logic. |

### Coupling observations

**`app/` screens bypass `lib/api.ts` and import `data/mocks.ts` directly**

10 of the 24 screen files import `SC_EVENTS`, `SC_EVENT_BY_ID`, `SC_CHATS`, or `SC_THREADS` directly (confirmed by grep). This means screens are coupled to the mock data format rather than the API contract. In a live-mode build, the map tab (`app/(tabs)/map.tsx:63`) passes `SC_EVENTS` directly to the `Map` component instead of fetching from `api.fetchEvents()`.

This is a pragmatic prototype shortcut, but it means switching from mock to live mode requires editing every screen individually rather than flipping `isMock()` in one place. The correct pattern (for the "Phase 5.x" comment already noted in `Map.tsx`) is to fetch data in a `useEffect`, store it in local state, and fall back to mocks when `api.isMock()` is true.

**`Map.native.tsx` imports `useStore` directly**

```typescript
// Map.native.tsx:12
import { useStore } from '@/store/useStore';
const meInterests = useStore(s => s.me.interests ?? []);
```

The Map component reaches into the global store to get `meInterests` rather than receiving it as a prop. This is a coupling smell — a UI component pulling from global state for data it could receive via props. It makes the component harder to render in isolation (a test needs the store initialized) and prevents using the Map with a different interest set. The fix is to add `meInterests?: string[]` to `MapProps` and pass it from the caller:

```typescript
// in map.tsx:
const meInterests = useStore(s => s.me.interests ?? []);
<Map events={SC_EVENTS} user={coords} meInterests={meInterests} ... />
```

**`app/event/[id].tsx` hardcodes `SC_CHATS` for group-chat lookup**

```typescript
// line 142
const chat = SC_CHATS.find(c => c.kind === 'event' && c.eventId === e.id);
```

In live mode, the group chat for an event won't appear in `SC_CHATS`. This navigation path is silently broken in live mode. The fix is to call `api.getChats()` or store the event's `chat_id` in `eventOverrides` when subscribing.

---

## 5. Architecture and Requirements Adherence

### Stack prescription vs. delivery

| Architecture Prescription | Current Implementation | Status |
|---|---|---|
| React Native (iOS 15.1+ / Android 6.0+) | Expo SDK 54 + `react-native` 0.81.5 | ✅ — correct foundation |
| Expo SDK for GPS, push tokens, camera | `expo-location`, `expo-notifications`, `expo-image-picker` — all present and wired | ✅ |
| TypeScript for mobile client | Strict TypeScript; `tsconfig.json` with `strict: true` (confirmed clean `tsc --noEmit`) | ✅ |
| Zustand state store | `store/useStore.ts` — Zustand v5 with AsyncStorage persistence | ✅ |
| Expo Router file-based navigation | `app/` directory with 24 routes; tab layout, stack screens, modals | ✅ |
| `react-native-maps` (native) | `Map.native.tsx` — correct `MapView` with `PROVIDER_GOOGLE` on Android | ✅ |
| Supabase backend (Postgres + PostGIS + Edge Functions) | 15 migrations, 9 Deno Edge Functions, correct admin/user client separation | ✅ |
| Supabase Realtime for chat | `api.subscribeToChat()` in `lib/api.ts:339–349` — correctly creates a channel; still not called from any screen | ⚠️ Wired but not connected to UI (same as Review #1 FR9 gap) |
| CI (GitHub Actions + ESLint + TypeScript typecheck) | No `.github/workflows/` directory exists | ❌ Still missing |
| EAS Build for iOS/Android binaries | Not configured | ❌ (expected for prototype) |
| Web scraper (Playwright + GitHub Actions cron) | No scraper code in new project | ❌ (same as Review #1 FR6) |
| MVC separation (screens/views from logic/data) | Expo Router screens own view; Zustand store owns logic/state; `lib/` owns data access | ✅ — cleaner than the prototype |

### FR gap analysis update

The major functional gaps from Review #1 persist in the new codebase because this was a port, not a feature-completion sprint. The following gaps are explicitly unchanged:

- **FR1.5 (location prompt)** — `useLocation()` exists and requests permission correctly; the map tab calls it. This is now implemented.
- **FR5.7 (edit event)** — `setEditOpen` state exists in `app/event/[id].tsx` but the edit overlay (`editOpen && ...`) is not rendered in the returned JSX. The button appears, tapping it sets state, nothing shows.
- **FR9.1–9.4 (chat)** — Chat screens render correctly in mock mode; Realtime not wired.
- **FR10.1 (friend-request notification)** — Backend fixed. Frontend shows "Inbox" route correctly.
- **FR7.2 (Google Calendar)** — `linkedCalendar: 'google'` is the store default; `app/settings/linked-calendar.tsx` shows the UI; no actual OAuth or Calendar API call exists.

**New coverage since Review #1:**

- FR1.5 (location permission) — `useLocation.ts` + `useEffect` on mount (non-web) correctly implements the spec.
- FR1.1 (sign-up screen) — `app/auth/sign-up.tsx` exists (was absent from prototype).
- FR1.3 (onboarding questionnaire) — still no persistence to Supabase.

---

## 6. Positive Highlights

**The atomic-subscribe RPC (`00015_atomic_subscribe.sql`) is the right fix, done correctly**

The solution goes beyond a simple lock-and-insert. It reads the confirmed count directly from `event_subscriptions` rather than the materialized `subscriber_count` column, which could lag by a trigger fire. It handles the idempotency case (returns `'already'` with the existing position if the user is already subscribed). It integrates waitlist insertion within the same advisory-locked transaction, preventing a race between the waitlist-append and the subscription insert. This is production-grade concurrent SQL, not student-level.

**`lib/conflicts.ts` consolidation is clean**

The single-file, injected-dependency design eliminates both the `window.SC_EVENT_BY_ID` coupling from `heuristic-fixes.jsx` and the duplicate implementation in `app.jsx`. The three exported functions (`eventsOverlap`, `findConflict`, `findAllConflicts`) have a clean, composable API, and the 17 unit tests cover null inputs, symmetry, self-exclusion, and malformed date strings. The constant `OVERLAP_WINDOW_MIN` is exported so tests can assert on it — this is the correct way to prevent magic-number drift.

**`store/useStore.ts` `merge` function handles `Set` deserialization correctly**

AsyncStorage and JSON cannot round-trip JavaScript `Set` objects. The explicit `merge` function (lines 356–374) converts each persisted array back to a `Set` during rehydration. This is the right approach and handles the "what if the key is missing" case by falling back to the current store value. Many Zustand projects silently corrupt Set state on reload; this one does not.

**`lib/supabase.ts` publishable-key fallback**

The comment and code handling Supabase's 2025 key-rename (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` falling back to `EXPO_PUBLIC_SUPABASE_ANON_KEY`) is a thoughtful migration aid. The `isPlaceholder()` function prevents a partially-filled `.env` from being treated as a valid configuration.

**The CORS implementation is complete and consistent**

`CORS_HEADERS` is defined once in `_shared/supabase-client.ts` and spread into every `jsonResponse`/`errorResponse` return. `handlePreflight` is called on the first line of every function handler. This is exactly the pattern recommended by the Supabase Edge Function docs and eliminates the per-function header duplication that was the error-prone alternative.

**Expo Router typed routes are opted in**

`"typedRoutes": true` in `app.json` generates typed `href` strings from the file system. When the `as never` casts are removed (per §2 suggestion), this will provide compile-time safety on all navigation calls — including catching the attendees route mismatch at build time rather than at runtime.

**Platform-split Map is the correct Metro pattern**

The `Map.tsx` stub (which throws a clear error if executed) makes misuse visible immediately. The shared `types.ts` contract means `pinColor` and `eventLatLng` are defined once and tested once, with both implementations consuming the same logic. The web implementation correctly handles Leaflet's quirks (default marker icons, `useMapEvents` for pan callbacks) with in-code comments explaining why.

---

## 7. New Issues Introduced

**Attendees navigation 404 (introduced in Phase 4)**

As described in §2 Critical: `app/event/[id].tsx:249` navigates to `/event/${e.id}/attendees` but the file lives at `app/attendees/[id].tsx`. This route did not exist in the legacy prototype (navigation was handled by a `go('attendees', { id })` call in the god-component's switch). The Expo Router migration introduced the mismatch.

**Mock data exposed in production store initial state (introduced in Phase 5)**

The blocked users, hardcoded friend IDs (`new Set(['p1', 'p3', 'p5'])`), and hardcoded following list (`new Set(['orgA', 'orgD'])`) are baked into `useStore.ts` as initial state, not mock-only fixtures. In live mode, a real user would see fake friends and fake blocked users on first launch before the backend data loads (assuming a loading-state refresh is ever wired). The `data/mocks.ts` import at the top of `useStore.ts` makes this coupling explicit but doesn't guard it behind `isMock()`.

**`lib/api.ts` `fmtWhen`/`fmtTime` duplicates `lib/date-time.ts` helpers**

`lib/api.ts:57–77` contains private `fmtWhen` and `fmtTime` functions that format date/time strings from ISO timestamps. `lib/date-time.ts` already exports `fmtDate`, `fmtTime`, and related helpers. The API module was written before `date-time.ts` was ported, or it intentionally avoids the dependency — but the result is divergent formatting logic. If the time format changes (e.g., switching from `7:00 AM` to `07:00`), one copy will be missed.

**`console.error` suppression in `jest.setup.ts` masks async test issues (introduced in Phase 6)**

This is noted in §2 and §3. It is a new issue that did not exist in the prototype's `jest.setup.js`.

---

## 8. Uncertainties / Needs Clarification

**1. Has `supabase db push` been run with all 15 migrations end-to-end?**

Migration `00014` drops and recreates the profiles SELECT policy by name. If the deployment already has the policy from `00011`, this is a safe `DROP POLICY IF EXISTS` + `CREATE POLICY`. However, `00014` also installs `are_friends()` as a new function. If `are_friends()` was already defined by a developer experiment before this migration ran, the `CREATE OR REPLACE` is safe. If the migrations have not been run in order against a fresh database, the dependency chain (00002 for `profiles`, 00005 for `friendships`, then 00011 for the initial policy, then 00014 for the fix) should be verified. This cannot be confirmed from code review alone.

**2. The `subscribe_to_event_atomic` waitlist path uses a separate position calculation**

Inside `00015_atomic_subscribe.sql:61`:

```sql
SELECT COALESCE(MAX(w.position), 0) + 1 INTO v_position
  FROM waitlist w WHERE w.event_id = p_event_id;
```

This is inside the same advisory-locked transaction, so concurrent waitlist appends for the same event are serialized. However, `add_to_waitlist` from migration `00013` uses the same position-calculation pattern. If both RPCs are called concurrently for the same event (one from the Edge Function calling `subscribe_to_event_atomic`, another directly calling `add_to_waitlist`), they would compete for the same advisory lock — which is correct behavior. But it's worth verifying that no code path calls `add_to_waitlist` directly for new subscriptions; all subscribe paths should go through `subscribe_to_event_atomic`.

**3. Are the `as never` casts in `router.push` calls masking real type errors from typed routes?**

`typedRoutes: true` is set in `app.json`, which should generate route-type definitions. If `npx tsc --noEmit` passes with `as never` casts, it's possible the generated types in `.expo/types/router.d.ts` are simply not being picked up by the `tsconfig.json` path configuration. This would mean typed routes are enabled in name only. Removing one `as never` cast and checking whether TypeScript catches the attendees route mismatch would confirm whether the type system is actually protecting navigation calls.

**4. `Map.native.tsx` with `PROVIDER_GOOGLE` on Android requires a Maps API key**

```typescript
provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
```

The comment "requires GOOGLE_MAPS_API_KEY in app.json's android.config block to render tiles; we leave that as a deploy-time concern" is correct, but the key is not present in `app.json`. Without it, the Android map will render as a blank grey screen. This is expected for a prototype, but if the app is demoed on an Android device, this will appear broken.

---

## 9. Prioritized Recommendations

Listed by impact-to-effort ratio:

1. **Fix the attendees navigation route** (`app/event/[id].tsx:249`). Change `/event/${e.id}/attendees` to `/attendees/${e.id}`. One-line fix, prevents a 404 on the primary navigation path from the most-used screen. Also add a navigation test to `event-detail.test.tsx` that asserts `router.push` is called with the correct path.

2. **Move hardcoded mock data out of `useStore.ts` initial state** (`store/useStore.ts:225–229, 287–290`). Guard `friends`, `outgoingRequests`, `incomingRequests`, `following`, and `blocked` behind `isMock()` or move them into `resetStore()` in `test-utils.tsx` only. This prevents a real user from seeing fake blocked users and fake friends on first launch in live mode.

3. **Remove the dead `x/y` coordinate normalization from `transformEventRow`** (`lib/api.ts:117–118`). The `Map` component uses `eventLatLng()` for rendering and does not need `x`/`y`. If `x`/`y` fields are still required for some other consumer, document why; otherwise delete them from the live-mode transform and from `SCEvent`'s required fields.

4. **Add `ConfirmDialog` and `ToastHost` render tests**. Both are at 0% and are straightforward to test as isolated components with a store pre-populated. These cover the overlay layer that every screen depends on indirectly.

5. **Fix `isHost` logic in `app/event/[id].tsx:101`**. Replace `e.hostId === 'me'` (a literal string comparison that fails in live mode) with a comparison against `useStore.getState().me.id` or rely solely on `e.kind === 'yours'` from the server.

6. **Wire `api.subscribeToChat()` to the chat thread screen**. `lib/api.ts:339–349` correctly implements the Realtime subscription. `app/chat/[id].tsx` currently uses only the seeded mock messages. A `useEffect` that subscribes on mount and unsubscribes on cleanup would complete FR9.1 in live mode.

7. **Fix the hardcoded date string** (`app/(tabs)/map.tsx:36`). Replace `'Sat May 9 · Irvine'` with `${fmtDate(new Date())} · Irvine`. Two imports, one line change.

8. **Decouple `Map.native.tsx` and `Map.web.tsx` from `useStore`**. Add `meInterests?: string[]` to `MapProps` and pass from callers. This makes the Map testable without a store and removes the hidden dependency.

9. **Add 2–3 interaction tests to the render-only screen test files**. Priority targets: `home.test.tsx` (join an event card), `my-friends.test.tsx` (unfriend), `other-profile.test.tsx` (send friend request button). These cover flows that are currently at 0% interaction coverage despite the screen being rendered.

10. **Set up CI** (`.github/workflows/`). At minimum: `npm test` + `npx tsc --noEmit` on push to `main`. The architecture document mandates this and it remains absent. Even a 10-line workflow would satisfy the spec and catch the `as never` cast issue automatically.

---

_End of report._
