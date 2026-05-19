# Code Review Report — IN4MATX 43 Project (SceneCheck)

_Date: 2026-05-18 | Reviewer: Senior Code Reviewer (Claude) | Scope: Full working-tree state — all source files in `src/`, `supabase/`, and `tests/`_

---

## Executive Summary

- The database schema and Edge Function layer are the strongest part of the project. The PostGIS spatial setup, the atomic waitlist (`add_to_waitlist` advisory lock), RLS policies, and the trigger-driven counter pattern all reflect solid systems-level thinking that goes well beyond typical student work.
- The frontend prototype correctly models most of the required user flows, but the architecture document prescribes React Native + Expo for a mobile build while the delivered prototype is a plain HTML/CSS/JavaScript web page. This is the most significant deviation from the governance docs.
- Global state is managed by `useState` inside a single `App()` closure and shared downward through prop-drilling across 30+ screens. This pattern was acknowledged in the test plan as a testability barrier, but it creates coupling that will also make a future React Native migration harder.
- `send-friend-request` contains a meaningful logic bug: it auto-accepts friend requests to public profiles server-side, but the front-end prototype models public-profile adds as instant (no handshake needed) while the architecture doc describes a request/accept flow for all connections. These three sources disagree.
- Test coverage is low overall (8.5% line coverage), as expected and honestly documented, but the tests that exist are well-structured and the critical units (time math, conflict detection, API mock bridging) are correctly covered.

---

## 1. Adherence to Architecture and Requirements

### 1.1 Architecture Document

#### What the document prescribes

The architecture document specifies:

- **Mobile client**: iOS 15.1+ / Android 6.0+ React Native app running the Hermes JS engine inside a native shell. Expo SDK for GPS, push tokens, and camera.
- **Backend**: Supabase (Postgres 15 + PostGIS 3.x + Deno Edge Functions + Realtime/Phoenix).
- **Language**: TypeScript for the mobile client and Edge Functions.
- **State store**: Zustand.
- **CI**: GitHub Actions with ESLint, Prettier, TypeScript typecheck, and unit tests. EAS Build for iOS/Android binaries.
- **Web scraper**: GitHub Actions cron, Node.js 20 + Playwright.
- **Communication**: HTTPS/REST for data, WebSocket/Supabase Realtime for chat and live counts, Expo Push → APNs/FCM for push notifications, Google Calendar API for calendar sync.
- **Design style**: MVC in the mobile client (separate screens/views from app logic and data models).

#### What the code delivers

- **Frontend**: A single-page HTML prototype (`index.html` + script tags loading `src/*.jsx` in order). There is no React Native shell, no Expo SDK, no native GPS, no Hermes engine, and no Zustand store. The app runs only in a desktop browser, not on a phone.
- **Backend**: The Supabase layer (13 migrations, 9 Edge Functions in TypeScript/Deno) matches the architecture doc closely and is the strongest area of implementation.
- **TypeScript**: Used in all Edge Functions and the shared client (`_shared/supabase-client.ts`, validators). The frontend (`src/*.jsx`) is plain JavaScript. This is a partial match.
- **CI**: No GitHub Actions workflow files exist. The architecture doc mandates ESLint, Prettier, and TypeScript typecheck pre-merge.
- **Zustand**: Not used. State is managed via `useState` in `App()`.
- **Web scraper**: No scraper code exists. The `ingest-scraped` Edge Function is the receiver but the Playwright sender is absent.
- **Google Calendar API**: Not integrated. The frontend shows a checkbox in the create-event flow but no call is made.
- **WebSocket / Realtime**: `api.js` has a correct `subscribeToChat()` method wiring Supabase Realtime, but no screen component calls it.

#### Deviations (with file locations)

| Deviation | Severity | Location |
|---|---|---|
| React Native → plain HTML/JS web prototype | Architecture mismatch (expected for prototype stage) | `index.html`, all `src/` files |
| Zustand → `useState` in `App()` closure | Architecture mismatch | `src/app.jsx:122` |
| TypeScript frontend → JavaScript | Architecture recommendation not followed | `src/*.jsx` |
| No CI pipeline | Missing infrastructure | (no `.github/workflows/` directory) |
| No web scraper | FR6 partially unimplemented | (no Playwright code) |
| Google Calendar not called | FR7.2 unimplemented | `src/screens.jsx` (create-event form, checkbox present, no API call) |
| Realtime subscriptions not connected to UI | FR4.5 / FR9 partially unimplemented | `src/api.js:294` exists but nothing calls `subscribeToChat()` |

**Important context**: The architecture doc explicitly has a "Prototype Implementation" section and links the Canva prototype. The prototype's own index page labels itself `· PROTOTYPE`. For a course prototype the HTML-based approach is a pragmatic shortcut, not a design failure. The deviations above matter most for grading against the spec.

---

### 1.2 Requirements Document

#### FR-by-FR gap analysis

| FR | Requirement Summary | Status | Notes |
|---|---|---|---|
| FR1.1 | Email + password account creation | Backend only | `api.js:signUp()` wired; no sign-up screen |
| FR1.2 | 18+ age gate | Not implemented | No age check in frontend or backend |
| FR1.3 | Post-login questionnaire | Onboarding screen exists | `SCOnboarding` in `src/additions.jsx`; no data persisted to Supabase |
| FR1.4 | Individual / Organization account type | Data model supports it | `profiles.account_type`; UI shows account switcher |
| FR1.5 | Prompt for location access | Not implemented | No `navigator.geolocation` or Expo Location call |
| FR2.1 | Profile with name, picture, bio, mutual friends, rating, event history | Mostly implemented in prototype | `SCMyProfile`, `SCProfileOther`; mutual friends shown as count, not list |
| FR2.2 | Public / private visibility | Implemented | Both layers: `profiles.visibility` column + RLS + UI toggle |
| FR2.3 | Org profile with name, description, events | Implemented | `SCOrgProfile` in `src/screens.jsx` |
| FR3.1–3.3 | Subscribe to / search / create interests | Implemented | `SCInterestsScreen`, `interests` table, `user_interests` table |
| FR3.4 | Related/similar tag matching | Schema exists, not used | `tag_relations` table created; `rank_events_query` scores only exact-match interests |
| FR3.5 | Subscribe to orgs; receive org-event notifications | UI only | Follow/unfollow in prototype; `dispatch-notification` exists but no org-subscription trigger |
| FR4.1 | Live map with interest-filtered events | Implemented (mocked) | `SCMapScreen` with pin filtering |
| FR4.2 | Discovery radius filter | UI only | Radius slider in Settings; not wired to `fetchEvents` |
| FR4.3 | Keyword search | Implemented | `SCSearchScreen`, map search by title/location/tag |
| FR4.4 | Visually distinguish User vs App created events | Implemented | Color-coded pins and labels |
| FR4.5 | Live participant count; waitlist count | Count shown; live update missing | Realtime subscription not wired to UI |
| FR5.1 | Create event with all required fields | Implemented | 4-step `SCCreateEvent` wizard |
| FR5.2 | Participant limit | Implemented | `capacity` field in form and DB |
| FR5.3 | Event analytics (popular event types by city/location) | Not implemented | No analytics screen or query |
| FR5.4 | Publish gate (min subscribers) | Implemented | `check_publish_gate` SQL function |
| FR5.5 | Capacity enforcement + waitlist | Implemented | `subscribe-to-event` Edge Function handles |
| FR5.6 | Adjustable capacity → waitlist promotion | `promote-waitlist` Edge Function exists | No UI for creator to change capacity post-publish |
| FR5.7 | Edit event details after publication | No edit screen | |
| FR5.8 | View attendee list | Implemented | `SCAttendees` screen |
| FR5.9 | Join group chat on subscription | Implemented | `subscribe-to-event` creates/joins chat |
| FR5.10 | Organizer removes user | Implemented | `organizer-remove` Edge Function |
| FR5.11 | Rate event after it ends | Partially implemented | `rollup-rating` Edge Function; no rating UI screen |
| FR6.1–6.4 | Web scraper: auto-generate events from public data | Receiver implemented | `ingest-scraped` Edge Function complete; scraper sender absent |
| FR7.1 | Subscribe to events | Implemented | |
| FR7.2 | Add to Google Calendar | Not implemented | Checkbox in UI; no API call |
| FR7.3 | Join event group chat | Implemented | Opt-in on subscribe |
| FR8.1 | Search for users by username | Implemented | `SCSearchScreen` |
| FR8.2 | Send/receive/accept/decline friend requests | Implemented | |
| FR8.3 | Block check on friend request | Implemented | `send-friend-request` checks `is_blocked()` |
| FR8.4 | Follow attendees during/after event | Follow implemented | `SCAttendees` shows follow buttons |
| FR8.5 | Share events to friends | Not implemented | No share button or flow |
| FR9.1 | One-on-one DMs | Implemented in prototype | `SCChatThread` |
| FR9.2 | Prevent messages between non-connected / blocked users | RLS implemented | `messages` RLS checks `chat_members` and `is_blocked` |
| FR9.3 | Create group chats from friends/attendees | Implemented | `SCNewChat` |
| FR9.4 | Auto group chat per event | Implemented | |
| FR9.5 | Organizer announcements in group chat | Not implemented | No special announcement mechanic |
| FR10.1 | Notify on friend request | `send-friend-request` does NOT dispatch notification | Bug: the Edge Function creates the friendship but never calls `dispatch-notification` |
| FR10.2 | Notify on event update/cancel | Not implemented | No trigger when creator updates event |
| FR10.3 | Notify when matching event created within radius | Not implemented | `ingest-scraped` does not call `dispatch-notification` |
| FR10.4 | Tappable notifications → deep link | `dispatch-notification` sets `deep_link` | Frontend notification list not implemented |
| FR10.5 | In-app + push notifications | `dispatch-notification` does both | In-app list not shown to user |
| FR11.1 | Block user | Implemented | `api.js:blockUser()`, `blocks` table, RLS |
| FR11.2 | Report user/event | Implemented | `api.js:submitReport()`, `reports` table |
| FR11.3 | Event creator removes user | Implemented | `organizer-remove` Edge Function |

**Summary of missing features**: FR1.2 (age gate), FR1.5 (location prompt), FR5.3 (analytics), FR5.6 (UI to adjust capacity), FR5.7 (edit event), FR5.11 (rating UI), FR7.2 (Google Calendar), FR8.5 (event sharing), FR9.5 (announcements), FR10.1 (friend-request notification is wired but not dispatched), FR10.2, FR10.3.

---

## 2. Best Practices

### Critical

**`send-friend-request/index.ts:50` — Logic mismatch: auto-accept for public profiles bypasses the friend-request model**

The Edge Function auto-accepts the friendship when the target's visibility is `'public'`:

```typescript
const friendshipStatus = targetProfile?.visibility === "public" ? "accepted" : "pending";
```

This means two public users become immediate friends without either party seeing a request. The requirements document (FR8.2) says users shall "send, receive, accept, and decline friend requests." The architecture doc shows a request/accept flow. The frontend models public adds as instant in `toggleFriend()` (`app.jsx:322-326`), which matches the current Edge Function behavior, but this was a design decision in the frontend that was never validated against the requirements. If this is intentional for the prototype, it needs a comment explaining the deviation and the actual spec requires an accept step.

**`supabase/functions/_shared/supabase-client.ts:11–13` — Missing CORS header on all Edge Function responses**

Every `jsonResponse()` and `errorResponse()` call omits `Access-Control-Allow-Origin`. When the frontend calls these functions from a browser origin, modern browsers will block the response. The missing OPTIONS preflight handling is a separate gap:

```typescript
// Fix: add CORS headers
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",       // or specific origin
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
```

Without this, `api.js` in live mode would fail in every browser on every Edge Function call.

**`supabase/migrations/00011_create_rls_policies.sql:24–29` — Profiles RLS SELECT policy logic error**

The current policy is:

```sql
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR NOT is_blocked(auth.uid(), user_id)   -- bug here
  );
```

The third condition `NOT is_blocked(auth.uid(), user_id)` means: "show me this profile if I have not blocked them and they have not blocked me." This is close to correct, but the intent is to hide profiles of users who have blocked you (both directions). The current logic would expose a private profile to a user who has blocked the profile owner, because the profile owner hasn't blocked them. The correct guard is:

```sql
USING (
  visibility = 'public'
  OR user_id = auth.uid()
  OR (
    NOT EXISTS (SELECT 1 FROM blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = user_id)
         OR (blocker_id = user_id    AND blocked_id = auth.uid()))
  )
);
```

Using `is_blocked()` is fine, but the policy still leaks `private` profiles to non-friends who haven't blocked each other. A private profile should only be visible to its owner and accepted friends:

```sql
USING (
  user_id = auth.uid()
  OR (
    visibility = 'public'
    AND NOT is_blocked(auth.uid(), user_id)
  )
  OR (
    visibility = 'private'
    AND NOT is_blocked(auth.uid(), user_id)
    AND EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND ((from_id = auth.uid() AND to_id = user_id)
          OR (to_id = auth.uid() AND from_id = user_id))
    )
  )
);
```

**`supabase/functions/subscribe-to-event/index.ts:42–55` — Capacity check is not atomic**

The function reads `subscriber_count`, decides `isFull`, then inserts the subscription in a separate statement. Between the read and the insert, a concurrent subscriber can race in, both see `subscriber_count < capacity`, and both get `'confirmed'` status:

```typescript
// Line 42-43: read
const isFull = event.capacity !== null && event.subscriber_count >= event.capacity;
// Line 46-54: separate insert
const { error: subErr } = await admin.from("event_subscriptions").insert({ ... });
```

The existing `add_to_waitlist` function correctly uses `pg_advisory_xact_lock` for the waitlist append, but the confirmed-subscription insert has no such guard. Fix: move the capacity check and subscription insert into a single PL/pgSQL RPC function that holds the same advisory lock for the entire transaction.

---

### Major

**`src/app.jsx:125–136` — Global `window.scFixes` is an anti-pattern for sharing state**

The App component publishes heuristic-fix toggles to `window.scFixes` and fires a custom DOM event so that `heuristic-fixes.jsx` can re-read them without prop-drilling. This couples the component tree through a mutable global and a custom event bus. The correct React pattern is a Context:

```javascript
// Better: export a FixesContext from app.jsx
export const FixesContext = React.createContext({});
// In useFixes():
return React.useContext(FixesContext);
```

The window bus also makes the `useFixes()` hook completely untestable in jsdom without simulating DOM events.

**`src/app.jsx:195–210` — Duplicate `eventsOverlap` logic**

`eventsOverlap()` in `app.jsx` and `scFindConflict()` in `heuristic-fixes.jsx:24` implement the same time-parsing and overlap check independently. They share a 2-hour threshold and the same regex pattern. If the threshold changes (FR5 doesn't specify a value), one copy will be missed. The `scFindConflict` version is the one with tests; `eventsOverlap` is the one that actually gates the conflict modal. They should be one function:

```javascript
// heuristic-fixes.jsx already exports scFindConflict on window —
// use that in app.jsx instead of rewriting it:
const conflicts = [...joined]
  .map(x => SC_EVENT_BY_ID[x])
  .filter(e => window.scFindConflict && scFindConflict(target, new Set([e?.id])));
```

**`src/api.js:97` — Coordinate normalization is hardcoded to a UCI-specific bounding box**

```javascript
x: row.lng ? (row.lng + 117.88) / 0.12 : 0.5,
y: row.lat ? (row.lat - 33.62) / 0.06 : 0.5,
```

This transform will silently return wrong positions (but within 0–1) for any location outside Irvine. It should either assert the expected range or be documented as a prototype-only shortcut in a prominent comment.

**`src/api.js:7–8` — Placeholder credentials in tracked source**

```javascript
const SC_SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SC_SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

This is fine as a placeholder. However, `.env.example` exists, suggesting real credentials belong in `.env`. The `api.js` approach hard-codes them in source, which means when the real values are filled in, they will be committed to git history. The file should read from `import.meta.env` (Vite) or an equivalent, or keep the placeholder but add a prominent comment warning not to commit real values.

**`supabase/functions/send-friend-request/index.ts` — Push notification not dispatched on friend request (FR10.1)**

The function creates the friendship record but never calls `dispatch-notification`. The architecture doc and FR10.1 both require a push notification when a friend request is received. The fix is to add an invocation after the insert:

```typescript
await admin.functions.invoke('dispatch-notification', {
  body: {
    type: 'friend_request',
    recipient_ids: [target_id],
    payload: {
      title: 'New friend request',
      body: 'Someone wants to connect',
      deep_link: '/friends/requests',
    },
  },
});
```

**`supabase/functions/rollup-rating/index.ts:14` — Rating window is not enforced**

FR5.11 requires that rating is only available within 24 hours after an event ends. The Edge Function inserts any rating with no time check:

```typescript
// No check that now() < event.end_at + 24h
const { error: ratingErr } = await supabase.from("ratings").insert({ ... });
```

The check also needs to verify the user was a confirmed attendee:

```sql
-- Add to rollup-rating Edge Function before insert:
SELECT end_at FROM events WHERE id = $event_id AND creator_id != $userId;
-- And verify attendance:
SELECT id FROM event_subscriptions WHERE event_id = $event_id AND user_id = $userId AND status = 'confirmed';
```

**`supabase/functions/ingest-scraped/index.ts:50–65` — Auto-tagging fetches all interests into memory**

```typescript
const { data: allInterests } = await admin.from("interests").select("id, name");
// Then filters in TypeScript...
const matchedIds = allInterests.filter((i) => desc.includes(i.name.toLowerCase()))
```

This loads the entire `interests` table on every scrape job. As the interest list grows this will become slow. The fix is to push the match into Postgres with `ilike` or full-text search:

```sql
SELECT id FROM interests WHERE $description ilike '%' || name || '%'
```

---

### Minor

**`src/app.jsx:397` — Draft `savedAt` label uses 12h math inconsistently**

```javascript
const savedAt = `Just now · ${((hh + 11) % 12 + 1)}:${mm} ${ap}`;
```

`((hh + 11) % 12 + 1)` converts 0–23 to 1–12, which is correct. But `ap` is computed as `hh >= 12 ? 'PM' : 'AM'` before the conversion, so midnight (0) would show `12:xx AM` (correct) and noon (12) would show `12:xx PM` (correct). This works but is hard to read. Use `scMinToTime` from `date-time.jsx` which already handles this math.

**`src/screens.jsx` — `isRecommended` duplicated in two components**

`SCEventsList` (around line 192) and `SCMapScreen` (around line 347) both define an identical `isRecommended` arrow function. Extract to a module-level helper.

**`supabase/migrations/00012_create_functions.sql:120–121` — Enabling Realtime on `events` table has performance implications**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
```

Enabling CDC on the `events` table will broadcast every row update (including `subscriber_count` increments from the trigger) to all connected clients subscribed to `events`. This is appropriate for live participant counts (FR4.5) but could generate significant traffic on a busy deployment. The architecture doc mentions this intentionally for live counts, but a comment here noting the tradeoff would help the team understand the choice.

**`src/api.js:166–170` — `subscribeToEvent` is missing the `add_to_calendar` parameter from the architecture doc**

The architecture doc specifies `{event_id, join_chat, add_to_calendar}`. The current signature only passes `join_chat`. The Google Calendar call is missing entirely.

---

## 3. Testability

### Coverage gaps

Per the test plan's own reporting (8.5% line coverage overall), the following critical paths have zero test coverage:

- `app.jsx`: 0% — `toggleJoin`, `toggleFriend`, `back()`, `go()`, `acceptRequest`, `declineRequest`, and the conflict-prompt modal are untested. These contain the core interactive logic of the prototype.
- `screens.jsx`: 3.5% — 30+ screen components, of which only `SCEventCard` is covered. The `SCCreateEvent` 4-step wizard, `SCChatThread`, `SCMyProfile`, and the `SCAttendees` flow are fully uncovered.
- Edge Functions: 0% — No Deno test files exist. The `subscribe-to-event` race condition, the `organizer-remove` permission check, and the `rollup-rating` 24-hour window are all untested.
- pgTAP tests: Written but not executed (Docker not configured). The RLS verification is the most important category here.

### Test quality issues

**`supabase/tests/rls.test.sql` only checks policy names exist, not that they work**

The pgTAP file calls `policies_are()` which verifies policy names are registered and `relrowsecurity` is true. It does not attempt a query as an unauthorized user to confirm the policy actually blocks access. A meaningful RLS test would:

```sql
-- Set local role to an unprivileged authenticated user:
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "user-a-uuid"}';
-- Try to read user-b's private profile:
SELECT is_empty(
  $$ SELECT * FROM profiles WHERE user_id = 'user-b-uuid' AND visibility = 'private' $$,
  'User A cannot see User B private profile'
);
```

**`tests/integration/api-mock-mode.test.js:63–66` — Test asserts shape but not behavior**

```javascript
const messages = await api().getChatMessages('c1');
expect(messages.length).toBeGreaterThan(0);
expect(messages[0]).toHaveProperty('text');
```

This confirms the mock returns something, but the `text` field in `SC_THREADS` is the mock shape. In live mode, the Supabase `messages` table has a `body` column, not `text`. The transform function in `api.js` is not implemented for messages (it returns the raw row). This discrepancy would cause a silent failure when switching to live mode.

**`tests/unit/scFindConflict.test.js:46–51` — Test comment contradicts what it tests**

```javascript
test('detects conflict with exactly 119 minutes apart (under threshold)', () => {
  // e1: 7:00 AM = 420 min, e9: 8:00 AM = 480 min → diff = 60 < 120 ✓
```

The comment says the diff is 60 minutes, which is correct. But the test name says "exactly 119 minutes apart" — the test data doesn't exercise the 119-minute boundary at all. This passes for the wrong reason. A true boundary test needs synthetic event data with a precise 119-minute gap.

### Structural barriers to testing

**`app.jsx` cannot be imported in Jest** because the last line (`ReactDOM.createRoot(...).render(...)`) is a top-level side effect. This is why `jest.setup.js` explicitly skips it. The fix is to wrap the render call:

```javascript
// app.jsx — change the last line to:
if (typeof document !== 'undefined' && document.getElementById('root')) {
  ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
}
```

This makes the file importable in test environments while preserving browser behavior.

**All source files expose API via `window.*` globals, not ES module exports.** This means tests must load files in dependency order (as `jest.setup.js` does) and cannot import individual functions. This is a deliberate tradeoff for the no-bundler prototype setup, but it makes test isolation impossible — every test shares the same global namespace.

---

## 4. Cohesion and Coupling

### Module-by-module assessment

| Module | Responsibility | Assessment |
|---|---|---|
| `src/data.jsx` | Mock data + global registration | High cohesion. Single clear purpose. |
| `src/date-time.jsx` | Time formatting + parsing helpers | High cohesion. Well-separated, has tests. |
| `src/api.js` | Dual-mode Supabase/mock bridge | High cohesion. Clean dual-mode pattern. Minor: coordinate normalization (line 97) is a UI concern that doesn't belong here. |
| `src/heuristic-fixes.jsx` | Toggleable UX improvement components | Medium cohesion. Mixes `scFindConflict` (business logic) with `ConflictChip` (UI) and `useFixes` (state hook). Could split into a utility file + component file. |
| `src/app.jsx` | Root app + routing + ALL global state | Low cohesion. This file is responsible for: theme application, viewport scaling, routing, history management, account switching, picture persistence, join/leave state, friend state, follow state, interest subscriptions, draft management, notification preferences, dialog control, and screen rendering. It is a single 778-line god component. |
| `src/screens.jsx` | All 30+ screen components | Low cohesion by necessity of the no-bundler architecture. At 4,876+ lines it contains unrelated screens that would be separate files in any modular setup. |
| `supabase/functions/` | Edge Functions | High cohesion. Each function handles exactly one feature boundary. |
| `supabase/migrations/` | Schema evolution | High cohesion. One concern per file, well-ordered. |

### Specific coupling smells

**`src/app.jsx` is the single coupling hub for all mutable state.** Every screen receives callbacks (`go`, `back`, `toggleJoin`, `toggleFriend`) and data (`joined`, `friends`, `subs`) as props. With 30+ screens this prop list has become unmanageable. The `useMemoA` dependency array at `app.jsx:556` lists 21 items:

```javascript
}, [route, joined, pendingLeave, friends, outgoingRequests, incomingRequests,
    following, pendingFollows, subs, radius, privacy, picture, orgPictures,
    activeAccount, accountSwitcherOpen, notifPrefs, pendingUnfriend,
    tweaks.dark, tweaks.palette, tweaks.offline, tweaks.showSkeletons, drafts]);
```

This means the entire screen tree re-computes whenever any of these 21 pieces of state change, even when the current screen only cares about 2 or 3 of them.

**`window.scFixes` / `window.scToast` / `window.scReplayOnboarding` couple components through the global scope.** Three separate global "back-channels" were added to avoid prop-drilling (`app.jsx:128`, `app.jsx:241`, `app.jsx:495`). Each one makes the affected component harder to test and reason about in isolation. React Context would provide the same decoupling without the global scope side effects.

**`scFindConflict` in `heuristic-fixes.jsx` reads `SC_EVENT_BY_ID` from `window`** (`heuristic-fixes.jsx:39`). This means the function cannot be called in an environment where the global data isn't loaded. The test works only because `jest.setup.js` loads `data.jsx` first. Making `scFindConflict` accept an event lookup map as a parameter would eliminate this hidden dependency:

```javascript
function scFindConflict(event, joined, eventById = window.SC_EVENT_BY_ID) {
  // ...
  const other = eventById[id];
```

**`app.jsx:431–433` and `app.jsx:463–466` — Tab name strings are repeated inline** in both `back()` and `go()`. Adding a new route requires updating both switch-style conditionals. A lookup table or a small helper `tabForRoute(routeName)` would eliminate the duplication.

### Suggested boundaries for a future refactor

If the team migrates to React Native (as the architecture doc prescribes), consider this boundary:

- `src/state/useEventStore.js` — joined, pendingLeave, toggleJoin
- `src/state/useFriendStore.js` — friends, outgoingRequests, incomingRequests, toggleFriend
- `src/state/useFollowStore.js` — following, pendingFollows, toggleFollow
- `src/state/useAuthStore.js` — activeAccount, picture, privacy
- `src/state/useNavStore.js` — route, history, go, back, switchTab
- Each screen imports only the store(s) it needs, eliminating the 21-item prop list.

---

## 5. Positive Highlights

**Atomic waitlist implementation (`00013_atomic_waitlist.sql`) is production-grade.** Using `pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0))` to serialize concurrent waitlist appends per event, with a `UNIQUE (event_id, position)` constraint as a belt-and-braces guard, is exactly the right approach. This goes well beyond what is typically expected in an academic prototype.

**The `_shared/supabase-client.ts` pattern is clean and reusable.** Separating `createAdminClient` (service role, bypasses RLS) from `createUserClient` (anon key with user JWT, respects RLS) is the correct security model. Each Edge Function uses the right client for each operation — user-client for reads that should respect RLS, admin-client for writes that need to bypass it (e.g., inserting subscriptions on behalf of a user).

**`src/date-time.jsx` is a model of single-responsibility.** Time helpers are extracted from the screen logic, exposed consistently, co-located with tests, and the roundtrip invariant (`scMinToTime(scTimeToMin(t)) === t`) is verified. The modular arithmetic to handle midnight (`h % 12 || 12`) is correct and tested.

**The dual-mode API bridge in `src/api.js` is a pragmatic and well-executed design.** Having a single `useMock()` flag that lets the entire API layer fall back to `SC_*` globals means the prototype works standalone while the live-mode path is already wired. The ID mapping table (`ID_MAP` / `REVERSE_ID`) is a simple, transparent way to bridge string IDs to UUIDs without requiring the prototype to generate UUIDs.

**RLS coverage is comprehensive.** Every table that should be restricted has RLS enabled. The block filter on `messages` (`AND NOT is_blocked(auth.uid(), messages.sender_id)`) is applied at the data layer, not the application layer — meaning a bug in screen-level code cannot leak blocked users' messages. The `friendships` policy correctly restricts UPDATE to the recipient only, preventing the sender from self-accepting.

**The test plan document (`docs/TEST_PLAN.md`) is unusually honest and thorough for a student submission.** The gap analysis in section 2.6, the explicit acknowledgment that `app.jsx` is untestable as written and why, and the distinction between what was blocked vs. what was deferred are all exactly what a professional tech lead would want to see from a junior engineer.

**`rank_events_query` composes correctly.** The scoring function — interest overlap (capped contribution), friend attendance (capped contribution), distance penalty (normalized to radius) — is a sensible approximation of the algorithm described in the architecture doc. Using `ST_DWithin` for the radius filter ensures the spatial index is used. Returning `lat`/`lng` from `ST_Y(geog::geometry)` and `ST_X(geog::geometry)` is the correct extraction pattern.

---

## 6. Uncertainties / Needs Clarification

**1. Is the HTML prototype the intended deliverable for this sprint?**
The architecture doc describes a React Native app and the test plan refers to the prototype as separate from the production implementation. If this sprint's deliverable is explicitly the interactive HTML prototype (not the native app), then the React Native deviation is not a gap — it is the plan. A sentence in the architecture doc or assignment description confirming this would resolve it.

**2. Is the `send-friend-request` auto-accept behavior intentional?**
The Edge Function auto-accepts friendships to public-profile users. The requirements say "send, receive, accept, and decline." If the intent is that public accounts always auto-accept (Twitter-style follow), then FR8.2 needs a note clarifying the distinction. If all relationships require explicit acceptance, this is a bug.

**3. Has `supabase start` been tested end-to-end?**
The pgTAP tests reference tables and functions that exist in the migrations, but migration 00011 (`rls_policies`) is numbered after 00012 (`create_functions`). Most Supabase CLI tools sort migrations alphabetically or numerically, so `00012` would run before `00011`, meaning `rank_events_query` references `user_interests` which should exist from migration 00003, but it also references `friendships` from 00005 — the ordering looks correct there. However, running `supabase db push` was not verified in this review. If anyone has run it and encountered errors, those would be worth documenting.

**4. What is the grading weight for backend vs. frontend?**
Several backend features (FR10.1 push on friend request, the age gate, the rating time window) are absent or incomplete. If the grade is weighted toward the prototype's interactive fidelity, these gaps are less impactful. If the backend layer is graded independently, they are more significant. Knowing the rubric would help prioritize the remaining work.

**5. Is there a `babel.config.json` entry for `api.js`?**
The Jest setup manually requires `api.js` in the integration test's `beforeAll`. Coverage is not collected for `api.js` because `jest.config.js:collectCoverageFrom` only includes `src/**/*.jsx` (not `src/api.js` which has a `.js` extension). This may be intentional, but if coverage on the API client matters it needs to be added.

---

## 7. Prioritized Recommendations

Listed by impact-to-effort ratio (highest first):

1. **Fix the profiles RLS SELECT policy** (`00011_create_rls_policies.sql:24–29`). A private profile is currently visible to any user who shares no block relationship with the owner but is not a friend. This is a data privacy bug, not a prototype concern. Low effort — one SQL statement.

2. **Add CORS headers to `_shared/supabase-client.ts:jsonResponse` and `errorResponse`**. Without this, the live-mode API path fails in every browser. Low effort — two lines per function.

3. **Fix `subscribe-to-event` race condition** by moving the capacity check and subscription insert into a single PL/pgSQL RPC with the advisory lock. Medium effort. This is the highest-risk concurrency bug in the system given that it could allow subscribers beyond capacity.

4. **Dispatch the friend-request push notification in `send-friend-request`** (FR10.1). One additional `admin.functions.invoke()` call. Low effort, high functional impact.

5. **Enforce rating eligibility in `rollup-rating`**: check that `now() < event.end_at + 24h` and that the user is a confirmed attendee. Medium effort — two SQL checks before the insert.

6. **Make `app.jsx` importable in tests** by guarding the `ReactDOM.createRoot` call. This would unlock testing `toggleJoin`, `toggleFriend`, and the navigation state machine, which are currently 0% covered. Low effort (one `if` statement), high test coverage impact.

7. **Eliminate the duplicate `eventsOverlap` / `scFindConflict` implementations**. The tested `scFindConflict` version should be the one used by the conflict modal in `app.jsx`. Low effort, reduces bug risk.

8. **Replace `window.scFixes` with a React Context**. Medium effort. Removes the untestable global event bus and makes the `useFixes()` hook injectable in tests.

9. **Add Deno test files for the two highest-risk Edge Functions** — `subscribe-to-event` (concurrency) and `organizer-remove` (privilege escalation). The functions are already structured well for testability. Medium effort.

10. **Add meaningful RLS behavioral tests to `supabase/tests/rls.test.sql`** — at minimum, test that a user cannot read another user's private profile, and that a blocked sender's messages are invisible. The existing tests only confirm policy names exist, not that they block unauthorized access. Medium effort.

---

_End of report._
