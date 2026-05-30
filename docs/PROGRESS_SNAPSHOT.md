# SceneCheck — Progress Snapshot

A dated progress report on the SceneCheck project as it has evolved from
the original HW2/HW3 browser prototype into the Expo SDK 54 + TypeScript
port that's now the active codebase.

Each section below carries its own `_Last updated_` line. Sections may be
re-snapshotted independently — if a section's metrics drift between
write-time and submission, leave the date as-is.

The two source-of-truth references for "what got done" are:

- `docs/CODE_REVIEW_REPORT.md` — the audit that drove much of the migration
- `docs/TEST_PLAN.md` — current test plan and live coverage numbers
- The phased task list (16 tasks across 7 phases) reproduced in §3 below

---

## 1. Project structure evolution

_Last updated: 2026-05-18 (commit 325bbd4)_

| Date | Event |
|---|---|
| Pre-2026-05-15 | Single repo, no subprojects. Root holds `index.html` + `src/*.jsx` (~9,000 lines of prototype) + `tests/` (5 unit + 4 integration) + `supabase/` (12 migrations + 9 Edge Functions). |
| 2026-05-18 | Code review (`docs/CODE_REVIEW_REPORT.md`) lands. Flags 4 backend bugs, structural issues in `app.jsx` (21 useStates, 0% coverage), and stack-level deviation from the architecture doc (web prototype vs prescribed React Native + Expo). |
| 2026-05-18 → 19 | Expo migration runs end-to-end: 16 tasks across 7 phases. Active project becomes `scenecheck-expo/`. |
| 2026-05-19 | Original prototype moved into `legacy/`. Root is now: `scenecheck-expo/` + `supabase/` + `docs/` + `legacy/` + root markdown deliverables. |
| 2026-05-19 | Env-var renamed from `EXPO_PUBLIC_SUPABASE_ANON_KEY` to `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase 2025 key-system update). Legacy var kept as fallback. |
| 2026-05-19 | Four logical commits land on `main` (`59d5583` backend, `b38f70b` Expo project, `3b03664` archive, `48bae88` docs). Working tree clean. |
| 2026-05-19 | Second code review (`docs/CODE_REVIEW_REPORT_2.md`) lands as commit `c0432bf`. Confirms all 7 first-review findings resolved. Flags one new navigation bug + 7 smaller post-migration issues. |
| 2026-05-19 | Second-review patch batch (8 fixes) lands as commit `325bbd4`. Navigation 404, `isHost` literal-string bug, hardcoded date, `toastIdCounter` module-scope leak, dead `x/y` coordinate roundtrip, `fmtWhen`/`fmtTime` duplication, mock data leaking into live-mode store init, and `Map` coupling to `useStore` all addressed. |
| 2026-05-19 | `supabase/config.toml` schema fix: the legacy `[project] / id = "scenecheck"` table is rejected by current Supabase CLI versions (`'config.config' has invalid keys: project`). Replaced with the new top-level `project_id = "scenecheck"` so `supabase start`, `supabase status`, etc. parse the file cleanly. |
| 2026-05-19 | `supabase start` runs cleanly via `npx supabase`. All 15 migrations apply (`00001` → `00015`), `roles.sql` seeds, all containers come up. Local stack reachable at Studio `:54323` / REST `:54321` / DB `:54322`. |
| 2026-05-19 | `npm run web` ran for the first time end-to-end and hit a 3-step compatibility chain with Expo SDK 54's static SSR (`web.output: "static"`). Fixed by adding `lib/storage.ts` (SSR-safe Platform-aware k/v adapter), splitting `components/Map/Map.web.tsx` into a client-only Suspense wrapper + `Map.web.impl.tsx` (defers `leaflet` to post-mount), and adding `metro.config.js` to force Zustand to its CJS build on web (the ESM build's `devtools` middleware emits `import.meta.env` which Metro serves as a classic script → `SyntaxError`). See §9. |
| 2026-05-19 | Web design parity pass: added `app/+html.tsx` (the SSR HTML shell) to load Bricolage Grotesque / DM Sans / JetBrains Mono from Google Fonts and paint the cream `pageBg` + two radial-gradient glows from the legacy `index.html`. Previously the web build fell through to default sans-serif on a white viewport. |
| 2026-05-19 | Built the two missing input controls from the legacy Create Event screen: `components/SCDatePicker.tsx` (calendar popover, past dates greyed + line-through + disabled, today outlined in primary, selected filled in ink) and `components/SCTimePicker.tsx` (three iPhone-clock-style snap-scroll wheels: hours, 5-min minutes, AM/PM). Both replace the placeholder `TextInput`s in `app/create-event.tsx`. Cosmetic fix in the same commit: moved `pointerEvents="..."` to `style.pointerEvents` in `ToastHost.tsx` + `SCTimePicker.tsx` to silence the RN Web deprecation warning. See §10. |
| 2026-05-19 | Wired the missing host-only event editor and added create-event entry points on Home + Map. `EditEventSheet.tsx` (new) is a bottom-sheet modal that writes `applyEventOverride(id, patch)` and emits the legacy "Saved · attendees notified" toast; before this the EDIT EVENT button on `event/[id].tsx` set local state but no modal consumed it. Added a `+` button in both the Home tab header (next to Search) and the Map tab header, both routing to `/create-event`. CANCEL EVENT (already wired) untouched. See §10. |
| 2026-05-19 | Create Event tag chips now auto-fill from `me.interests` and gained a tag-search input that matches against the union of `SC_INTERESTS_SUGGESTED` + `Object.keys(SC_INTERESTS_DETAILS)` + `me.interests`. Draft hydration still wins. +3 tests on `create-event.test.tsx`. |
| 2026-05-19 | First Supabase live wire-up: switched `.env` from the hosted project to the local stack (`http://127.0.0.1:54321` + `sb_publishable_AC…`), built `components/AuthBootstrap.tsx` to subscribe to `supabase.auth.onAuthStateChange` + hydrate `me` from the `profiles` + `user_interests` tables, added `hooks/useEvents.ts` that calls `api.fetchEvents()` (initializes synchronously with `SC_EVENTS` in mock mode so existing screen tests stay green), and wired the Home tab + Map tab through it. Settings sign-out now actually calls `api.signOut()` instead of toasting a mock message. The other 17 screens still import `SC_*` from `data/mocks.ts`; a screen-by-screen plan for the full migration is queued. See §11. |
| 2026-05-19 | Full-migration **Phase 1** of 7: hard auth gate + session-driven store hydration. Added `session` slice to the store; `AuthBootstrap` now mirrors `onAuthStateChange` into it and hydrates `joined`, `friends`, `outgoingRequests`, `incomingRequests`, `subscribedInterests` from `event_subscriptions` + `friendships` + `user_interests` in parallel. New `AuthGate` component wraps the `(tabs)` route group and redirects to `/auth/sign-in` when no session (mock-mode short-circuits to pass-through so the 279 existing tests stay green). Dropped the "SKIP — EXPLORE AS GUEST" link from sign-in. `following` isn't hydrated (no `org_follows` table yet). See §12. |
| 2026-05-19 | Display name captured on sign-up (`api.signUp(email, password, displayName)` writes to `profiles.name` post-trigger) and editable from the profile tab via a new `components/EditProfileSheet.tsx` (mirrors `EditEventSheet`). The profile header is now a tappable Pressable with a small pencil icon that opens the edit sheet. +6 tests. |
| 2026-05-19 | Full-migration **Phase 2** of 7: event detail wire-up. New `hooks/useEvent.ts` (mock-mode synchronous, live-mode async). New API methods: `api.cancelSubscription`, `api.updateEvent` (writes `events.title` / `location_name` / `capacity` / `description`), `api.cancelEvent` (soft-cancel via `status='cancelled'`). `event/[id].tsx`: join/leave now hit `subscribeToEvent` / `cancelSubscription` with optimistic local state + rollback on failure; CANCEL EVENT awaits the real cancel; the EditEventSheet calls `api.updateEvent` + `applyEventOverride` and signals `onSaved` so the screen can `reload()` the hook. `when` (start/end time) intentionally not persisted yet — needs a real date+time editor. See §13. |
| 2026-05-19 | Full-migration **Phase 3** of 7: Events list, Search, My Hosting — three thin swaps from `SC_EVENTS` import to `useEvents()`. No new API methods needed (the hook + `api.fetchEvents` from Phase 0 + the filter logic already in each screen do all the work). My Hosting now filters on `kind === 'yours' \|\| hostId === me.id` so it works for live UUIDs and mock string ids. Search still reads `SC_VISIBLE_PEOPLE` + `SC_ORGS` for the people/orgs tabs (Phase 5 territory). No test churn — existing screen tests cover the rendering and the synchronous mock-mode `useEvents` initializer means assertions still land on first render. See §14. |
| 2026-05-19 | Full-migration **Phase 4** of 7: Interests system. New `hooks/useInterests.ts` (catalog + search) and `hooks/useInterest.ts` (single-tag), both with mock-mode synchronous init. New API method `api.getInterest(tagName)` (returns `null` for unknown tags so the UI can fall back gracefully); fixed the existing `api.searchInterests` to translate DB columns (`name` / `subscriber_count` / `description` / `similar_tags`) → in-memory shape (`tag` / `others` / `desc` / `similar`) since the previous `data as Interest[]` cast was a bug (wrong key names in live mode). Wired `app/interests/index.tsx`, `app/interests/[tag].tsx`, and the create-event tag-search catalog through the new hooks. +5 hook tests. See §15. |
| 2026-05-19 | Full-migration **Phase 5** of 7: Profiles + Social. New API methods: `api.fetchFriends` (friendships ⨝ profiles, both directions, client-side union), `api.fetchFriendRequests` (returns the legacy `FriendRequest` shape), `api.declineFriendRequest`, `api.removeFriend`. Three new hooks: `useFriends`, `useFriendRequests`, `useProfile` — all mock-mode-synchronous via the Zustand `friends` / `incomingRequests` Sets, live-mode via the new API methods. Wired `my-friends.tsx`, `requests.tsx`, `profile/[id].tsx`. Accept / decline / unfriend now commit to Supabase with optimistic Zustand updates. `my-following.tsx` left untouched (no `org_follows` table in the schema yet). +5 hook tests. See §16. |
| 2026-05-19 | Full-migration **Phase 6** of 7: Chat (list + thread + new chat) — the only Realtime surface in the app. New API method `api.createChat(memberIds, type)` (inserts `chats` + `chat_members` rows; mock returns the legacy `dm-…` / `group-…` stable id). Two new hooks: `useChats` (mock-mode sync from `SC_CHATS`, live-mode joins `chats ⨝ chat_members ⨝ messages`) and `useChatMessages` (handles initial fetch + realtime subscription with id-based dedupe of own echoes + optimistic `send`/`retry` with status reconciliation). Wired `app/(tabs)/chat.tsx`, `app/chat/[id].tsx`, `app/new-chat.tsx`. New chat is now friends-only (RLS-controlled friendships don't allow DMing strangers). +5 hook tests; the new-chat screen tests were rewritten to match the friends-only picker + async-start path. See §17. |
| 2026-05-19 | Full-migration **Phase 7** of 7 — final phase: Attendees + Ratings. New API methods `api.fetchAttendees` (`event_subscriptions ⨝ profiles` for confirmed rows) and `api.fetchRatings` (`ratings ⨝ events!inner` filtered on `events.creator_id`, mapped back to the legacy `Review` shape). Two new hooks `useAttendees` / `useRatings` with mock-mode synchronous init. Wired `app/attendees/[id].tsx` (also through `useEvent` for the event title) and `app/ratings/[hostId].tsx` (also through `useProfile` for the host name). +5 hook tests. **Migration complete: every original mock-imported screen now reads from Supabase in live mode.** See §18. |
| 2026-05-19 | Switched `.env` back to the hosted Supabase project (`kmlecodmifljbtzaqahm.supabase.co` + the `sb_publishable_rWC_…` key) for end-to-end verification. Added `supabase/seed-hosted.sql` — an idempotent variant of `seed.sql` with `ON CONFLICT DO NOTHING` on every INSERT so it can be safely re-run via the hosted Studio SQL Editor. Seeds 15 interests + 9 published events (all `creator_id=NULL`) + 15 event_interests join rows. Profiles / friendships / chats / ratings intentionally not seeded — they come from real user activity after sign-up. See §19. |
| 2026-05-19 | Sign-up polish: birthdate is now the same `SCDatePicker` calendar popover the Create Event screen uses (extended with `minDate` / `maxDate` / `withYear` / `placeholder` props; existing event-creation defaults preserved). The 18+ age gate is enforced at picker time — `maxDate` is 18 years ago today, so younger dates render greyed + line-through + unselectable. Added `fmtDateWithYear` / `parseDateWithYear` helpers in `lib/date-time.ts`. Email placeholder swapped from `"you@uci.edu"` → `"Your email"` to match the actual policy (any email works). +1 test ("rejects submission without a birthdate"); the "signs up successfully" case now picks a birthdate via a small test helper before submitting. |
| 2026-05-19 | Sign-up / sign-in: graceful handling for projects with email confirmation enabled. `signUp` now inspects the returned session — when null (hosted Supabase default), routes to `/auth/sign-in` with a "check your email" toast instead of bouncing through the auth gate to a sign-in that would fail with "Email not confirmed". The sign-in handler now rewrites Supabase's opaque "Email not confirmed" error into an actionable explanation. |
| 2026-05-19 | Auth UX expansion: full forgot-password flow + resend-confirmation + account management. **API**: `api.resendConfirmation`, `api.requestPasswordReset` (web computes `redirectTo` from `window.location.origin`), `api.updateEmail`, `api.updatePassword`. **New screens**: `app/auth/forgot-password.tsx` (email → recovery email), `app/auth/reset-password.tsx` (new-password form fed by the recovery session). **New components**: `ChangeEmailSheet`, `ChangePasswordSheet` (mounted from Settings). **Sign-in screen**: added a "Forgot password?" link + an inline "RESEND CONFIRMATION EMAIL" affordance that appears after a confirmation error. **Settings screen**: new ACCOUNT section with Email + Password rows that open the corresponding sheets. Email placeholder on sign-in swapped to `"Your email"` to match sign-up. +14 tests across four files. |
| 2026-05-19 | Confirmation link + UX hardening: `api.signUp` now passes `emailRedirectTo` so the email link routes back to `/auth/sign-in?confirmed=1` (web computes from `window.location.origin`); sign-in renders a persistent banner when arriving with `?confirmEmail=1` (warn-toned, "Confirm your email" + body copy) or `?confirmed=1` (good-toned, "Email confirmed"); banner has a dismiss button + an inline `RESEND CONFIRMATION EMAIL` button. Sign-up passes the typed email along via params so the resend button works without re-typing. Sign-in screen is no longer presented as a modal (dropped `presentation: 'modal'` for `auth/sign-in` and `auth/reset-password` in `_layout.tsx`; `auth/sign-up` and `auth/forgot-password` stay as modals). +5 tests. Misc copy: `"Welcome back"` → `"SceneCheck"` on the sign-in headline; sign-in password placeholder `"••••••••"` → `"Your password"` (the dots looked pre-filled). |
| 2026-05-19 | Hosted Supabase email delivery switched from the shared-SMTP free tier (rate-limited to ~2/hr) to **Resend** via the Supabase Custom SMTP setting. No code change — this is entirely dashboard config on Supabase + Resend. Full runbook captured in `docs/PROGRESS_SNAPSHOT.md` §20. |
| 2026-05-20 | **Pivoted away from email confirmation entirely.** Resend's free tier requires a *purchased + DNS-verified domain* to send to anyone other than your own inbox, and the Cloudflare DNS auto-config kept failing on an SSO mismatch — too much friction for a course project. Disabled "Confirm email" in the Supabase dashboard instead, so sign-up returns a live session immediately. UI follow-ups: `ChangeEmailSheet` now says "Email updated" / "Your sign-in email changes right away" (was "confirmation sent to both inboxes"); button relabeled `SEND CONFIRMATIONS` → `UPDATE EMAIL`; the post-sign-up toast is now `Welcome to SceneCheck, <first name>!` straight into the tabs. The confirm-email banner + Resend button on sign-in are kept as a *dormant defensive fallback* (only fire if confirmation is ever re-enabled). Also disabled "Secure email change" so the in-app email update applies without inbox round-trips. See §21. |
| 2026-05-20 | Native UX fixes. **Back buttons:** `settings.tsx` + `requests.tsx` were pushed as card routes but had no `SCTopBar` — added one to each (subtitle `ACCOUNT` / `INBOX`, `onBack → router.back()`); they were unreachable-via-button on iOS/Android (only edge-swipe / hardware back worked). Added a root `<SafeAreaProvider>` in `_layout.tsx` so the custom `SCTopBar` / `Screen` top insets resolve on native (back buttons + headers no longer hide under the notch/status bar). **Dynamic home/map header:** the hardcoded `"Sat May 9 · Irvine"` is now `useDateCityLabel()` (new hook) — live `fmtDate(new Date())` plus a reverse-geocoded city via `Location.reverseGeocodeAsync` when location permission is granted; date-only when denied/unavailable (the required fallback). Wired into both the Home and Map headers. Test updates: dynamic-date regexes (end-anchored so they don't collide with event-card `when` strings), uppercase subtitle assertions, a `reverseGeocodeAsync` jest mock returning `[]`. |
| 2026-05-20 | **Fixed display name showing as email after sign-up.** Root cause was a race: `AuthBootstrap` re-hydrates `me` from `profiles` on the `SIGNED_IN` event, and its (slow, 4-query) read of the just-created skeleton row often resolved BEFORE `api.signUp`'s separate `profiles.name` write landed — so it read `name=''` and fell back to the email, and that `setMe` ran *last*, clobbering the screen's correct `setMe({ name })`. Fix: `api.signUp` now also stamps the name into `auth.users` metadata via `options.data.display_name`, which rides on the same row the session carries; `AuthBootstrap.hydrate` reads it race-free as `session.user.user_metadata.display_name`. Name resolution is now `profiles.name → metadata display_name → email *prefix* → 'You'` (the full-email fallback is gone). The `profiles.name` write stays so other users / the ratings join see the name too. Existing accounts created before this fix show the email prefix until the name is set once via the profile-tab editor. |
| 2026-05-20 | **Home map preview is now a real device-map snapshot.** The Home card was a hand-drawn faux map (colored blobs for park/water + one fake pin). Replaced it with the actual platform map (`Map` component → Apple Maps on iOS, Google Maps on Android, OSM/leaflet on web) centered on the user's location with the live event pins, rendered non-interactive so it reads as a tappable snapshot of "what's near me." Added an `interactive?: boolean` prop to `MapProps` (default true); when false the native map disables scroll/zoom/rotate/pitch/toolbar + sets `pointerEvents="none"`, and the web map disables dragging/scrollWheelZoom/doubleClickZoom/touchZoom/boxZoom/keyboard/zoomControl + `pointerEvents="none"` — so taps fall through to the card's Pressable which opens the Map tab. `MapPreview` pulls the user coords via `useLocation` (falls back to the UCI default region when permission isn't granted) and `me.interests` for pin coloring. 331/331 tests still green. Note: `npx tsc --noEmit` surfaced 5 *pre-existing* type errors (PostgREST nested-relation typing in `AuthBootstrap`/`api.ts`/a create-event test) unrelated to this change — flagged for a separate cleanup. |
| 2026-05-21 | **Dynamic ratings + hosted-events on profiles + social seed data.** Profiles now compute ratings live instead of reading a static field: new `lib/ratings.ts` helpers (`summarizeRatings`, `ratingForEvent`, `formatRatingSummary`); new `api.fetchEventsByHost(hostId)` (all-statuses events by `creator_id`) + `hooks/useHostedEvents`. `app/profile/[id].tsx` now uses `useHostedEvents` + `useRatings` (was filtering `SC_EVENTS`/`SC_REVIEWS` mocks) — shows a Ratings summary card with the dynamic average or an explicit "No ratings yet", a hosted-events list with a per-event rating badge (or "No ratings yet" per event), and an empty state when a host has no events; rating display now shows for **people too**, not just orgs. `app/(tabs)/profile.tsx` HOSTED + RATING + "My ratings" stats are computed from the same hooks (was static `me.rating` / `SC_EVENTS` count). Added `supabase/seed-hosted-social.sql` — 6 mock auth.users (4 people + 2 orgs, password `scenecheck123`) + profiles + interests + event-host reassignment + ratings + friendships + a DM/group chat, so live mode has other users to verify against (RLS means chats/friends are visible by signing in *as* a mock user, or via the OPTIONAL "wire to your own account" block). +12 tests (ratings helpers, useHostedEvents, other-profile ratings/empty-state). 343/343. The 5 pre-existing PostgREST type errors are unchanged (no new ones). |
| 2026-05-21 | **Map discovery range is now a persisted preference (+ type/seed cleanup).** The Map tab's radius chips were local `useState` in *meters*, disconnected from `store.radius` (the *miles* value the Settings slider owns) and reset to 5 mi on every mount — the choice never survived a reload. They now read/write the persisted `store.radius`, so a chip tap is the same write the slider makes and the two screens stay in sync. Presets widened to 1/3/5/10/25/50 mi (horizontally scrollable; top matches the slider's 50-mi ceiling), and `radiusM = radius * MILES_TO_METERS` converts only at the `useEvents`/`<Map>` boundary. When the saved range is off-preset (e.g. 7.5 mi from the slider's 0.5-mi step) a **Custom · N mi** button appears on its own row below the presets and deep-links to `/settings` for finer control. Folded in two previously-unrecorded fixes: the **5 PostgREST nested-relation `tsc` errors** flagged "pre-existing" in §58–§59 are resolved (`.overrideTypes<…, { merge:false }>()` declares the to-one embed shape supabase-js widens to an array without generated DB types — `AuthBootstrap` + `api.fetchFriends`/`fetchAttendees`; plus a `me.interests ?? []` guard in a create-event test) so `tsc --noEmit` is clean again; and `seed-hosted-social.sql`'s OPTIONAL "wire to your own account" block now upserts a `profiles` row before the friendship/chat inserts, fixing the `friendships_from_id_fkey … is not present in table profiles` error for accounts created before the `handle_new_user` trigger. +3 tests (346/346). See §22. |
| 2026-05-21 | **Seeded events made visible (date fix) + Custom-range button moved below the chips.** Follow-up: seeded events weren't showing on the Map/Home feed because `rank_events_query` filters `start_at > now() - 2h` and every event in `seed.sql` / `seed-hosted.sql` was hardcoded to **2026-05-07…05-13** — all in the past by demo time (05-21). Both seeds now use **now()-relative** dates (`now() + interval 'N days'`); `seed-hosted.sql` also switched `ON CONFLICT DO NOTHING` → `DO UPDATE` on the time columns + status so re-running un-stales already-inserted rows (creator_id left untouched so the social seed's host reassignments survive). The two other "not showing" reports are by-design, not bugs: seeded **profiles** aren't in search (search still reads mocks, §7 #1) but are reachable by tapping an event host; seeded **chats/friendships** are RLS-scoped, so you must sign in as a mock user (`maya@scenecheck.dev` / `scenecheck123`) or run the OPTIONAL block to see them as yourself. Also moved the discovery-range **Custom** button to its own row below the preset chips (was inline right). No test-count change (346/346). See §22.5. |
| 2026-05-21 | **Multi-account correctness pass (photo / self / DB row / private requests).** Five fixes surfaced while verifying as a seeded mock user. **(1) Profile photo leaked across accounts** — the locally-picked `picture`/`orgPictures` overrides are persisted and weren't tied to a user, so signing in as Maya kept the personal account's avatar. AuthBootstrap now clears them on a user change (compares the persisted `me.id`) and on sign-out. **(2) You saw yourself in "people nearby"** — the Home rail + Search read mock people unfiltered; new `lib/people.excludeSelf` drops the signed-in user (matched by id and the UUID→mock-id mapping). **(3) Your account had no row in the `profiles` table** — accounts predating the `handle_new_user` trigger (or added via the dashboard) had no profiles row, and the client couldn't create one (no INSERT RLS policy). New migration `00016_profiles_self_insert.sql` adds a self-insert policy; AuthBootstrap upserts a skeleton on sign-in and `api.updateProfile` is now an upsert. **(4) Couldn't friend-request private profiles** — RLS hides a private non-friend's row, so the screen dead-ended at "Profile unavailable" with no button, and the send was store-only (never persisted). `profile/[id].tsx` now shows a minimal private-account request card (name/avatar + Send request, content still hidden), and the request persists via `api.sendFriendRequest` (the friendships INSERT RLS already permits requesting anyone). **(5) Hosting count** — confirmed already dynamic (`useHostedEvents(me.id)`); shows 0 only until events' `creator_id` is populated (re-run the social seed). +6 tests (352/352). See §23. |
| 2026-05-21 | **Create-event + map-pin + attendees + interests-display fixes.** Five more issues from end-to-end use. **(1) Couldn't publish** — `api.createEvent` posted the raw `DraftForm` (friendly `"Sat May 16"` / `"7:00 AM"` strings + a location *name*), but the create-event Edge Function needs `start_at` ISO + `location:{lat,lng}`, so it 400'd every time. The screen now builds the proper payload (`friendlyToISO` for start/end, `useLocation` coords for the point, DB field names), `api.createEvent` resolves interest tag names → ids, and the empty-form default date is now upcoming (was a hardcoded past date). **(2) No draft-save notification** — `create-event` was `presentation:'modal'`, and native modals render above the root `ToastHost`/`ConfirmDialog`, hiding the "Saved to Drafts" + publish-error toasts; switched it to `presentation:'card'`. **(3) Pins missing on the full map** — regression from the discovery-range work: `rank_events_query.p_radius` is INT but the full map passed `radius × 1609.34` (a float), so the RPC failed to resolve and returned nothing (home used the int default, hence pins there). Rounded `radiusM` in the screen + defensively in `fetchEvents`; the existing focused-pin card already shows event info before opening. **(4) Attendees preview was static** — event detail showed a fixed `SC_VISIBLE_PEOPLE.slice(0,4)` + the seeded `subscriber_count`; now driven by `useAttendees` (real confirmed subscriptions), with the count/preview/CTA derived from it and yourself merged in optimistically on join. **(5) Profile interests didn't update** — the interests screen toggled `subscribedInterests` but the profile reads `me.interests`; `toggleInterestSub` now keeps `me.interests` in sync. +4 tests (356/356). ⚠️ Publish needs the `create-event` Edge Function deployed to the hosted project. See §24. |
| 2026-05-21 | **Create-event polish: map location picker, capacity minus, today-default, time-picker loop fix.** **(1)** New `components/LocationPickerSheet.tsx` — a bottom-sheet interactive map with a fixed center pin; the host drags so the pin marks the spot, and the map center (via `onRegionChange`) is stored as `DraftForm.lat/lng` and used for publish + map placement (falls back to the host's location when not set). It passes `initialCenter` (not `user`) to `<Map>` to avoid the web recenter-on-pan loop. **(2)** Capacity decrement now uses a real `minus` icon (new in `SCIcon`) instead of an `x`. **(3)** The new-event default date is the dynamic current date (was a fixed +2d). **(4)** Fixed an infinite AM/PM loop in `SCTimePicker`: the snap `Wheel`'s `handleSettle` issued an *animated* `scrollTo`, whose `onMomentumScrollEnd` re-fired the handler — re-snapping + re-emitting `onChange` forever (repro: nudging 11 AM → 12 PM). Added a `programmatic` ref that skips the self-induced settle, and it only re-snaps when actually off-row. +3 tests (359/359). See §25. |
| 2026-05-21 | **Map pin colors now match the legend by event type.** `pinColor` mis-coloured a **friend-hosted** event as "Other" (`mapPinMute`, grey) whenever it shared no interest tag with you — it was gated on `isRec`. Pins now map 1:1 to the legend by relationship: `yours → primary` ("Your events"), `friend → accentFriend` ("Friends", always), `recommended` or interest-match `→ accentBlue` ("Recommended"), else `→ mapPinMute` ("Other", e.g. an org event you have no interest connection to). No new test count (re-pointed the friend case + added an "Other" case); 359/359. See §26. |
| 2026-05-21 | **Friend-request flow, map key persistence, location search + branch message cleanup.** **(1)** The `Co-Authored-By` trailer was stripped from all branch commit messages (`git filter-branch --msg-filter`) per request; new commits omit it too. **(2)** Selecting an event on the Map now keeps the colour **Key** visible — the focused-event card renders *above* the legend instead of replacing it. **(3)** Sending a friend request showed BOTH "request sent" and "send failed": `api.sendFriendRequest` invoked an Edge Function that wasn't reliably deployed. It now does a direct, idempotent `friendships` insert (the INSERT RLS already allows requesting anyone), and `profile/[id]` awaits it to show exactly one toast. **(4)** Added a real place to manage requests: the requests screen lists **Requests for you** (accept/decline) *and* **Sent by you** (Cancel), backed by a new `useOutgoingRequests` hook + `cancelOutgoingRequest` store action, and it's reachable from a new **Friend requests** row on the Profile tab (was only linked from Settings for private accounts). **(5)** The location picker gained **search by name/address** (geocoded via OpenStreetMap Nominatim, recentering the map) alongside drag-to-pin. +1 test (360/360). See §27. |
| 2026-05-21 | **Private-profile privacy gate + location search autocomplete.** **(1)** A private account leaked its interests (and bio / hosted events / message + safety actions) to non-friends: the request-only card only triggered when `useProfile` returned null, but in mock mode (no RLS) — and live mode as a friend — the full profile rendered. `profile/[id]` now computes `privateLocked = isPrivate && !isFriend && !isSelf` and shows the minimal request card whenever it's set, in **every** mode, so a private account exposes only name/avatar + Send-request to non-friends (the live RLS still backstops the server). **(2)** The location picker's search is now a live **autocomplete dropdown** — typing (≥3 chars, 350 ms debounce) lists up to 5 OpenStreetMap Nominatim matches; tapping one recenters the map, so users don't need the exact place name. +1 test (361/361). See §28. |
| 2026-05-21 | **Refine §28: private accounts show interests (only); search biased to the user.** Per follow-up: a private account should expose its **interests** to non-friends — just not bio/events/etc. New `api.getInterestsForUser` (reads the publicly-readable `user_interests`, so it works for any account) + `useUserInterests` hook; the private request card now renders an Interests section, and the full profile uses the hook too (which also fixes interests never loading in live mode, since `getProfile` doesn't return them). The location-search dropdown is now **biased to the user's location** — Nominatim `viewbox` + `bounded=1` centred on `coords` (default region when no permission) — so suggestions are nearby/accurate instead of global. 361/361. See §29. |
| 2026-05-21 | **Private bio visible too + edit-bio + interests persist across sessions.** **(1)** A private account now also shows its **bio** to non-friends (the private request card renders `subject.bio` alongside interests; everything else stays gated). **(2)** The Edit-profile sheet gained a **bio** field (multiline, 160 cap) — saved via `api.updateProfile({ name, bio })` (an upsert) into the `me` slice. **(3)** Interest toggles now **persist across reloads** in live mode: new `api.setInterestSubscribed(tag, on)` resolves the tag → `interests.id` (creating the row for a custom tag) and inserts/deletes `user_interests`; both interest screens call it after the optimistic store toggle. Previously the toggle was store-only, so AuthBootstrap's DB re-hydrate reset interests on the next launch. +1 test (362/362). See §30. |
| 2026-05-21 | **Fix: live profile rows weren't mapped to the `Account` shape.** The `profiles` table's PK is `user_id` (no `id` column) and it stores `avatar_url` / `visibility` / `account_type`; the UI `Account` uses `id` / `picture` / `privacy` / `type`. `getProfile` / `fetchFriends` / `fetchAttendees` returned the raw row via a bare `as Account` cast, so in **live** mode `Account.id` was `undefined` — which produced the "Each child in a list should have a unique key" warning (every `key={p.id}` was undefined on My-friends, Sent requests, Attendees, the event-detail going list), made profile links navigate to `/profile/undefined`, and silently broke the private-profile gate (it reads `person.privacy`). Added `transformProfileRow()` and used it in all three. Mock mode unaffected (fixtures already carry `id`). 362/362. See §31. |
| 2026-05-21 | **Forms keep the focused input above the on-screen keyboard.** `Screen` (scroll mode) is wrapped in `KeyboardAvoidingView` (iOS `padding`; Android uses Expo's default adjustResize) + `keyboardShouldPersistTaps`, so scrollable forms (create-event description, auth, search) keep the focused field visible. New `useKeyboardHeight` hook lifts the bottom-sheet modals — which render outside `Screen` — by adding `paddingBottom: keyboardHeight` to **EditProfileSheet** (bio) and **LocationPickerSheet** (search), seating each sheet's bottom edge at the keyboard's top. The chat composer already used `KeyboardAvoidingView`. 362/362. See §32. |
| 2026-05-21 | **Keyboard avoidance now has an upper bound (top of screen).** The bottom-sheet modals lifted by the full keyboard height with no cap, so a tall sheet could push its top above the screen. Each sheet's `maxHeight` is now clamped to `windowHeight − topInset − keyboardHeight` (top can't pass the safe area): **EditProfileSheet** content became a `ScrollView` so it scrolls instead of overflowing, and **LocationPickerSheet** shrinks its map (260 → 130) while the keyboard is open so the search field + button stay visible. 362/362. See §33. |
| 2026-05-21 | **Chat tab gained a compose button.** The Chat tab had no way to reach the new-chat composer (the screen existed but was unreachable). Added an **edit-icon compose button** in the header → `/new-chat` (matching the legacy `SCChatList` button) plus an empty state. The composer itself is already complete (pick a friend → DM, or several → group → `api.createChat` → thread). +1 test (363/363). See §34. |
| 2026-05-21 | **Cleanup + de-mocking pass: account deletion, identity/email, pull-to-refresh, live=100%-Supabase.** Six fixes. **(1) Account deletion now "reassign, then delete row":** new RPC `reassign_then_delete_account` (migration `00020`) re-points the user's events + reviews to a fixed `[deleted user]` placeholder profile, then DELETEs the real `profiles` row (cascading interests/friendships/chats/etc.); the `delete-account` Edge Function calls it then `auth.admin.deleteUser` (frees the email). Local drafts are wiped client-side via a new `clearDrafts` store action. **(2) Sign-up identity:** migration `00019` adds `profiles.email` + rewrites `handle_new_user` to stamp `name` (from the display_name metadata), a **unique** `username` (email-slug + numeric fallback), and the email — plus a backfill for existing rows; the racey client-side name write in `api.signUp` is gone. `EditProfileSheet` gains a username field with friendly UNIQUE-violation copy. Profile SELECTs narrowed to omit `email` (stored, never shipped to other clients). **(3) Pull-to-refresh:** `Screen` gained an `onRefresh` prop → `RefreshControl` on native, a `rotate-ccw` button on web; `reload()` added to the param hooks (`useProfile`/`useHostedEvents`/`useRatings`/`useAttendees`/`useUserInterests`/`useSearch*`); wired into home/search/chat/profile/event/friends/requests/my-following. **(4–6) De-mock (live = 100% Supabase):** new `api.searchPeople`/`searchOrgs`/`getProfilesByIds`, enriched `getChats` (DM title = other member's name, last message) + `fetchRatings` (reviewer + event title via joins); every live screen now reads Supabase — search/home rail (`useSearch*`), my-following (`useFollowedOrgs`), chat list + thread, ratings, new-chat chips, profile — with `SC_*` retained **only** behind `isMock()` for the test/offline fixture. `seed-hosted-social.sql` extended with the missing fixtures (p5/p6/orgC/orgD) so all four orgs exist in `profiles`. +12 tests (377/377); `tsc` clean. See §35. |
| 2026-05-22 | **Interest-gated recommendations + incoming friend-request fixes.** Three issues. **(1) "Recommended" is now interest-driven, per user:** a scraped/app-discovered event used to always count as "Recommended"; now an event is recommended only when it shares one of your subscribed interests (new `lib/events.isRecommendedFor`), so a scraped event you have no interest in shows as "Other/Nearby". Applied consistently across `pinColor` (map), the events-list "FOR YOU" filter, `SCEventCard` (new `meInterests` prop), and the event-detail hero label. **(2) Incoming friend requests weren't showing (live):** the seeded requester is a **private** account, and `profiles` RLS hides private non-friends — so `getProfile` threw and `useFriendRequests`' un-caught `Promise.all` blanked the whole list. Migration `00021` adds a `has_pending_request()` helper + an additive SELECT policy so pending-request parties can read each other's profile (both directions); the hook also resolves each requester independently with a minimal placeholder fallback. **(3) Friend-requests hint count was stale/wrong:** the Profile-tab "Friend requests" row and the Settings "Follow requests" row now derive their in/out counts from the same live hooks the `/requests` screen uses (`useFriendRequests`/`useOutgoingRequests`) instead of store-set snapshots, so the hint matches the screen and reflects the true numbers. +1 test (378/378); `tsc` clean. See §36. |
| 2026-05-22 | **Fix: a friend showing twice (duplicate React key).** Signed in as one user, a friend rendered twice in the friends list with the same key. Root cause: a cross friend-request (A→B *and* B→A) that both get accepted leaves two accepted rows — `UNIQUE(from_id,to_id)` permits the mirror pair — so `fetchFriends` (which unions the `from_id=me` and `to_id=me` queries) returned the same profile from both sides. Fix: `fetchFriends` now dedupes the union by id (repairs display for rows already in the DB), and `sendFriendRequest` no-ops when a pending/accepted friendship already exists in **either** direction so a mirror row can't form. No test-count change (378/378); `tsc` clean. See §37. |
| 2026-05-22 | **Search ALL filter + auto-selected filters, "Orgs" rename, and avatars stored in Supabase.** Four UX/data items. **(1)** The Profile-tab "Following" row is renamed **"Orgs"** (it opens your followed-orgs list). **(2)** "Browse orgs" now opens Search with the **orgs** filter pre-selected, and "Find people" / "Find more people" pre-select the **people** filter — via a new `?tab=` param `search.tsx` reads on open. **(3)** Search gained an **ALL** tab (now the default) that shows events + people + orgs in one combined feed, so you don't have to click between filters; the per-type tabs still narrow. **(4)** Profile photos are now **stored in Supabase**: new migration `00022` adds a public `avatars` storage bucket + per-user RLS, `api.uploadAvatar` uploads the picked image and persists the public URL on `profiles.avatar_url` (which AuthBootstrap already loads into `me.picture`), `api.removeAvatar` clears it; the Profile tab uploads on change (optimistic preview + revert on failure) so the photo is retained and loads on every device. +7 tests (385/385); `tsc` clean. See §38. |
| 2026-05-22 | **Chat send fixed (RLS recursion) + delivery robustness + dynamic "events attended."** **(1) Messages now send.** The real blocker was an **infinite-recursion RLS policy**: `chat_members`' SELECT policy (`00011`) sub-queried `chat_members` itself, so Postgres aborted (`infinite recursion detected in policy for relation chat_members`) on every RLS-checked chat access — the failing `messages` INSERT surfaced as the "couldn't send / [object Object]" failed-retry indicator, and it also broke the chat list + message reads. Migration `00023` adds a `SECURITY DEFINER` `is_chat_member()` helper (bypasses RLS, so no recursion) and rewrites the four chat policies to use it. `api.sendMessage` now throws the real PostgREST message instead of `[object Object]`. **(2) Delivery robustness:** AuthBootstrap authorizes Realtime with the user JWT (`realtime.setAuth`) so RLS `postgres_changes` are delivered, and the chat thread + chat tab re-fetch on focus (new `useChatMessages.reload`) so the recipient sees messages even if a realtime event was missed. **(3) "Events attended" is dynamic:** the Profile ATTENDED stat now uses the live `joined` set size (confirmed subscriptions from Supabase) instead of a static field. No test-count change (385/385); `tsc` clean. See §39. |
| 2026-05-22 | **Fix the profile "Message" button (second chat-send bug).** After the RLS fix, sending still failed from a profile with `invalid input syntax for type uuid: "dm-<uuid>"`. Cause: the other-profile **Message** button navigated to `/chat/dm-${id}` — a fabricated mock-style chat id — so live mode pushed that non-UUID straight into the `messages` insert. It now calls `api.createChat([id], 'dm')` (RPC → real chat id in live; the `dm-<id>` stable id in mock) and routes to `/chat/<id>`, matching the new-chat flow. +1 test (386/386); `tsc` clean. See §39.5. |
| 2026-05-22 | **Event join fixed (no Edge Function) + chat UI polish.** **(1) Joining an event failed** with "Failed to send a request to the Edge Function" / "non-2xx" because `api.subscribeToEvent` invoked the `subscribe-to-event` Edge Function, which isn't deployed on the hosted project. It now calls the `subscribe_to_event_atomic` RPC directly (migration `00015`; SECURITY DEFINER, so it bypasses the INSERT-less `event_subscriptions` RLS and does the capacity/waitlist/idempotency check) — same pattern as the friend-request + create-chat fixes. **(2) Leaving an event** was also silently broken: `event_subscriptions` had only SELECT policies, so `cancelSubscription`'s direct `UPDATE` matched zero rows. Migration `00024` adds own-row INSERT/UPDATE/DELETE policies. **(3) UI polish:** the `SCButton` `ghost` variant now has a visible border so the profile **Message** action reads as a button; the chat composer gained bottom padding (`insets.bottom + 24`) so it isn't cramped against the screen edge. No test-count change (386/386); `tsc` clean. See §40. |
| 2026-05-22 | **Compact event hero, other-profile stats, and a "joined events" list.** **(1)** The event-detail hero panel was 50% empty space — halved (240 → 120). **(2)** The `SCButton` `ghost` border was bumped `t.line` → `t.ink3` so the profile **Message** action unmistakably reads as a button. **(3)** Other people's profiles (friends + public) now show a **hosted / attended / rating** stat row like your own tab, and the bio area shows *"No bio yet."* when empty instead of nothing. Attended for other users goes through a new `attended_count()` RPC (migration `00025`, SECURITY DEFINER — `event_subscriptions` RLS hides others' rows). **(4)** The **ATTENDED** stat on your own profile is now tappable → a new `app/my-events.tsx` screen listing every event you've joined (new `api.fetchJoinedEvents` + `useJoinedEvents`), since there was no single place to see them. +4 tests (390/390, 53 suites); `tsc` clean. See §41. |
| 2026-05-23 | **Join/leave button state fixed + linked event host.** **(1)** The join/joined button didn't reflect actual attendance, and leaving/re-joining didn't stick. Two causes: (a) AuthBootstrap built the `joined` set from raw `event_id` UUIDs, but every event id elsewhere is `toMockId(row.id)` (seeded events → `e1`…), so `isJoined('e1')` never matched the UUID set — now `joined` is `toMockId`-mapped; (b) `cancelSubscription` soft-deleted (`status='cancelled'`), but the `subscribe_to_event_atomic` RPC treats *any* existing row as "already subscribed", so re-joining was a no-op — `cancelSubscription` now hard-DELETEs the row (allowed by `00024`; the subscriber_count trigger COALESCEs NEW/OLD on delete). **(2)** The event-detail "Hosted by" row now shows the host's **name** (via `useProfile(hostId)`) and is a button that opens their profile (`/profile/<hostId>`); app-created events stay non-interactive. No test-count change (390/390); `tsc` clean. See §42. |
| 2026-05-23 | **Chat list refresh, rejoin button, joined-event icon colors, live conflict chip.** **(1)** Existing chats didn't appear until you messaged the person: the Chat tab mounts/fetches at app start while unfocused, and it skipped its first focus — so the first time you actually opened it, it showed stale data. It now reloads on **every** focus. **(2)** Rejoining an event during the 5s leave grace showed the "Joined" toast but the button/chip didn't flip: `joinEvent` early-returned when the id was still in `joined` and never cleared `pendingLeave` (and `isJoined = joined.has && !pendingLeave.has`). `joinEvent` now clears `pendingLeave`. **(3)** The "events you've joined" list icons were a fixed blue — they now use `pinColor(e, tokens, meInterests)` so each matches its yours / friend / recommended / other label. **(4)** Recommendation already recomputes reactively from `me.interests` everywhere (via `isRecommendedFor`), and `toggleInterestSub` syncs `me.interests` — so adding/removing interests reclassifies events live; the joined-list icons (now `pinColor`) recolor with it too. **(5)** The overlap **conflict chip** only resolved joined events via `SC_EVENT_BY_ID` (seeded only); it now takes an `eventsById` prop that the events list + home build from the live feed, so overlaps are detected for real events. +1 test (391/391); `tsc` clean. See §43. |
| 2026-05-23 | **Consistent event category, map "View location", past/upcoming joined events, event rating system.** **(1)** Color and label sometimes disagreed (e.g. an org event matching your interest showed a blue "recommended" pin under an "ORG · POSTED" label). New `lib/events.eventCategory` (yours > friend > recommended > other) is the single source for both — `pinColor` + every label (`SCEventCard`, events list, event detail) derive from it. (Live root cause: the home feed + map come from the `rank_events_query` RPC, whose SETOF rows can't carry a PostgREST embed, so `event_interests` was empty and every event read as NEARBY — only the detail page's direct table query had the tags. `fetchEvents` now merges the tags back in.) **(2)** An event's **View location** now opens the Map focused on that event: new `Map` `centerOn` prop (wins over the you-are-here center; `user ?? initialCenter` always centered on the user before), and `/(tabs)/map?focus=<id>` selects + centers it. **(3)** The "events you've joined" screen splits into **Upcoming** / **Past** (new `SCEvent.startAt` from `transformEventRow`). **(4) Rating system:** `RateEventSheet` (1–5 stars + optional review) on the event detail (non-host) → `api.rateEvent` upserts into `ratings` (migration `00026` adds the UPDATE policy so re-rating works); the rating links to the host via `events.creator_id`, so it appears in their reviews + computed average. +6 tests (397/397, 54 suites); `tsc` clean. See §44. |
| 2026-05-23 | **Friend+recommended dual label, joined-list refresh, search colors, radius-driven feed.** **(1)** A **friend-hosted** event that also matches your interests now shows a **RECOMMENDED** badge next to "FRIEND HOSTING" (new `isAlsoRecommended` — `eventCategory` short-circuits on `friend`, keeping the friend colour, so the match was invisible before). Badge appears on the home card, events list, search row, and event-detail hero. **(2)** The **events-you've-joined** screen now reloads on focus (`useFocusEffect`) so joining/leaving elsewhere and navigating back reflects immediately — it was stale because the screen stays mounted under the stack and only fetched on mount — and hides events you're mid-leave on (`pendingLeave`). **(3)** **Search** event rows were a fixed blue and never reclassified; they now colour the icon via `pinColor` + show the category label / `RECOMMENDED` badge from your live interests. **(4)** Home + search now pass the persisted **discovery radius** to `useEvents` (only the Map did), so changing the radius re-fetches the in-range events and their recommendations re-derive. +3 tests (400/400, 54 suites); `tsc` clean. See §45. |
| 2026-05-23 | **Map focused-card chip + interests, loading skeletons, refresh indicator.** **(1)** Selecting a pin now shows the **category chip** (yours/friend/recommended/other + the `RECOMMENDED` badge) and the event's **interest tags**, truncated past 3 into a "+N" pill, on the focused-event card. **(2)** New reusable `SCSkeleton` / `SCListSkeleton` / `SCRailSkeleton` + `SCEmptyState`: data screens now show a shape-matched **skeleton while loading** and an explicit empty state **only after** the fetch returns nothing (gated on `!loading` so the empty no longer flashes during load) — wired into home, events list, search, joined-events, chat, ratings, and attendees. **(3)** `Screen` shows a spinning **"REFRESHING"** pill on every platform while a pull/▾ refresh is in flight (native's RefreshControl spinner is easy to miss, web had none); refresh handlers re-run all of a page's queries, and the events-list/map/attendees screens that lacked refresh now have it. +5 tests (405/405, 55 suites); `tsc` clean. See §46. |
| 2026-05-23 | **Edit/delete reviews, bolder rate symbol, selected map pin.** **(1)** Each of **your own** reviews on a host's ratings screen gets a **"⋮" menu** (new `more`/`trash` icons) → **Edit** (reopens `RateEventSheet` pre-filled with your stars + text; upsert overwrites) or **Delete** (confirm → new `api.deleteRating`, the own-row DELETE from migration `00026`). "Mine" = `api.toMockId(me.id) === r.reviewerId` (works in mock + live + seeded-self). **(2)** The event-detail **rate button** was a faint gold outline star that blended in — now a **filled gold button with a dark star** so it's clearly the review affordance. **(3)** Opening the map from an event's **View location** (and tapping any pin) now renders that pin **selected** — enlarged + dark-ringed on web, raised on native — via a new `Map` `selectedId` prop fed by the focused event. +1 test (406/406, 55 suites); `tsc` clean. See §47. |
| 2026-05-23 | **Tappable reviewer, consistent follow count, EVENTS/HOSTED profile lists.** **(1)** On the ratings screen, the reviewer's avatar + name is now a button → their profile (`/profile/<reviewerId>`). **(2)** The profile "Orgs" count showed `following.size` (raw set) while the my-following list showed only orgs whose profile **resolves** — so a followed org missing from the live `profiles` table left "2" next to a 1-row list. The profile count now uses the **resolved** followed-orgs count (`useFollowedOrgs`), and my-following re-resolves on focus; `following` is persisted locally as before. **(3)** Renamed the profile **ATTENDED** stat to **EVENTS** and made the **HOSTED** stat tappable → a hosting list. `my-hosting` now uses `useHostedEvents` (all statuses/times via `fetchEventsByHost`) instead of the discovery feed (which drops past/cancelled), and splits into **Upcoming / Past** (current on top) — matching the joined-events screen. +1 test (407/407, 55 suites); `tsc` clean. See §48. |
| 2026-05-23 | **Dark-mode contrast fixes + darker review icon.** Active "filled" pills draw their label in hardcoded `'white'` over a `t.ink` fill — but `ink` flips to near-**white** in dark mode, so the active label vanished. Replaced `'white'` with `t.surface` (the mode-adaptive inverse of `ink`) on the **settings palette** chips, the **ratings star-filter** chips, and the same pattern on the events filter, search tabs, and map radius chips. The event-detail **review (rate) button** drew its star in `t.ink`, which washed out on its constant-gold fill in dark mode — new constant `warnInk` (`#1A1205`) keeps it dark in both modes. Same pass: the event-detail **hero chips** (category + RECOMMENDED pills) had hardcoded white backgrounds → switched to `t.card`; the **refresh** icon/pill bumped `t.ink2` → `t.ink` (darker). Also pinned `supabase/config.toml` `[db] major_version` to **17** to match the linked project (CLI version-mismatch warning). +2 token-invariant tests (409/409, 56 suites); `tsc` clean. See §49. |
| 2026-05-23 | **Scraper auth → new secret key + shared token.** Supabase is deprecating the `service_role` key. The events scraper → `ingest-scraped` pipeline used the `service_role` JWT to pass the function's default JWT gate; the new `sb_secret_…` key isn't a JWT, so it can't. Reworked: deploy `ingest-scraped` with `--no-verify-jwt`, send the new secret key as the `apikey` and authorize via a shared **`INGEST_TOKEN`** (`x-ingest-token` header) the function matches (fail-closed). `scrape-events.mjs` + the workflow now read `SUPABASE_SECRET_KEY` + `INGEST_TOKEN`. The function's own insert still uses its platform-injected key. CI-only (no Jest/tsc surface). See §50. |
| 2026-05-24 | **Scraped events auto-create interests + fuzzy tag matching.** `ingest-scraped` (FR6) used to scan only the description, match interest names by raw substring, and never create a tag — so a scraped event about an uncovered topic published unlabeled. New pure analyzer `supabase/functions/_shared/interest-matching.ts` now runs over **title + description**: existing interests match on their name OR a `similar_tags` alias, compared by a morphological **stem**, so `bike`/`biking`/`bikes`/`biker` and `spin`/`spinning` reuse one interest instead of minting near-duplicates (the dedup the user asked for); when nothing matches, a singularized tag is derived from the most salient word, created, and attached. Distinct roots never fuse (`hiking` ≠ `biking` — stemming is morphology-only, not edit-distance). Covered by Deno unit tests (`interest-matching.test.ts`, run via `deno test`); no Jest/tsc surface, so 409/409 is unchanged. Requires re-deploying the function. See §51. |
| 2026-05-24 | **Scraped-event source links, dark-mode refresh spinner, bare auto-created tags.** Three polish items + plumbing. **(1)** Scraped (App-created) events now carry a `source_url` (new `events` column, migration `00027`; the scraper pulls it from each listing's JSON-LD `url`, `ingest-scraped` stores it, `transformEventRow` surfaces it as `SCEvent.sourceUrl`). The event-detail screen renders a **"View original listing →"** link (opens via `Linking.openURL`) **in place of the "Hosted by" row** when a scraped event has one — user events keep the host row. **(2)** The native pull-to-refresh spinner used the washed-out `ink3` grey; it now uses the adaptive `ink` (`tintColor` + Android `colors`/`progressBackgroundColor`), so it's dark in light mode and bright in dark mode — matching the web button + REFRESHING pill, which already used `ink`. **(3)** Auto-created interests are now stored with **just the name** (the `Auto-created from "…"` description is gone). +1 test (410/410); `tsc` clean. Needs migration `00027` applied + `ingest-scraped` redeployed. See §52. |
| 2026-05-24 | **Auto-tag precision: expanded stop-list, `unknown` fallback, trimmed aliases.** Review of the first live re-run showed mediocre tags (e.g. `experience`, `orange`, `lunch`) — not duplicates, but low-signal. Three fixes in the shared analyzer + seed: **(1)** the stop-word list grew to cover marketing/commercial/format/locale filler (`experience`, `sale`, `networking`, `conference`, `orange`, `county`, `irvine`, day/season names, …) so those words can't become tags; **(2)** when the text yields **no** usable word, the analyzer now returns the catch-all **`unknown`** tag (new exported `UNKNOWN_TAG`) instead of minting a junk interest or leaving the event untagged; **(3)** over-broad seed `similar_tags` were trimmed — `live` off `music` and `irvine` off `uci` (in `seed.sql`, `seed-hosted.sql`, and `data/mocks.ts`) so "live …" / Irvine-anything stop auto-tagging those. +2 Deno tests. Because matching also fires on **existing** catalog rows, the live cleanup also deletes the bare auto-created interests (subs 0) so the new stop-list actually takes effect on re-run; aliases are trimmed with an `UPDATE`. Requires redeploy + a delete/trim SQL + re-run. See §53. |
| 2026-05-24 | **Scraper CI resilience + verified live re-tag.** The scraper threw and `exit(1)` on a non-OK source response, so when Eventbrite served the GitHub runner's datacenter IP a `405` (intermittent bot defense) the whole workflow hard-failed. It now retries the fetch (rotating User-Agent + backoff, `SCRAPE_RETRIES` cfg) and, on total failure, falls back to seed events instead of exiting — the ingest path always runs. Verified the full FR6 pipeline end-to-end against the hosted project: migration `00027` applied, `ingest-scraped` redeployed with the tightened tagger, the catalog cleaned (scraped events + bare auto-created interests deleted, `live`/`irvine` aliases `UPDATE`-trimmed), then the scraper re-run from a non-datacenter IP → **40/40 events ingested with a real per-event `source_url` and ≥1 tag**; `uci`/`music` no longer over-match, junk tags (`experience`/`orange`/`lunch`/…) are gone, the 7 speed-dating events share one `dating` tag, and no duplicate same-meaning interests. Known precision gaps left for later user testing: a few proper-noun/brand/filler tags (`actually`, `jason`, `thermomix`, `spectrum`, …) and `biking` still over-matching via its own `running`/`spin` aliases (only `live`/`irvine` were trimmed). See §54. |
| 2026-05-24 | **Multiple derived tags per scraped event + share-event-to-friends.** Two features. **(1)** A scraped event can now mint **multiple** new interest tags, not just one: the matched-catalog path was already uncapped (e.g. Yoga Day → `yoga, bouldering, climbing`), but the *derive* path (no catalog match) coined a single word. New `deriveTags()` returns up to `MAX_DERIVED_TAGS` (3) meaningful words — ranked by stem frequency then length, deduped by stem, singularized — so "Pottery & Knitting" mints both. `InterestAnalysis.suggested` is now `string[]` (`[UNKNOWN_TAG]` when no usable word); `ingest-scraped` creates + attaches them all (deduped against the PK). `deriveTag()` kept as a single-tag wrapper. **(2)** New **`ShareEventSheet`** + a `share` hero button on the event detail: pick one or more friends (`useFriends`), add an optional note, and the event is sent into each friend's DM via `api.createChat` + `api.sendMessage` (dedupes to an existing DM) — no backend change. New `share` SCIcon. +2 tests (411/411); `tsc` clean. Feature (1) needs `ingest-scraped` redeploy + a re-run to apply to existing events; (2) ships with the app build. See §55. |
| 2026-05-24 | **Curated common-word interests + safer `-er` stemming + true-black/white refresh icon.** **(1)** Added 7 seed interests — `career`, `dating`, `business`, `dentist`, `workshop`, `concert`, `conference` (with aliases, e.g. `dentist`←`dentistry`/`dental`) — so scraped listings *match* a stable, readable tag (e.g. "Career Fair" → `career`) instead of deriving a noisy one-off, restoring good labels and cutting derive-noise (matching short-circuits derivation). In `seed.sql` + `seed-hosted.sql`. **(2)** Gated the `stemKey` `-er` strip to words >6 chars so it no longer over-reduces short words: `career` stays `career` (was `car`, which wrongly matched `care`/`cars` — e.g. "Self-Care…" → career), and `water` stays `water`; the cost is that short agentive forms (`biker`/`runner`) no longer collapse to `biking`/`running` (base forms still do). Deno tests updated. **(3)** The refresh affordance (web button, REFRESHING pill, native pull-spinner) now uses **pure `#000` in light / `#FFF` in dark** (via `useTheme().mode`) instead of the palette's tinted near-black/white `ink`. 411/411; `tsc` clean. Interests need a hosted INSERT + re-tag to apply to existing events. See §56. |
| 2026-05-24 | **Title-first tag derivation.** When a scraped event matches no catalog interest, `deriveTags` now takes the new tags straight from the **title in reading order** (its lead words are the keywords people care about) instead of ranking title+description by combined stem frequency — so a word the description merely repeats can no longer displace the title's lead words (e.g. a desc hammering "drumming" no longer pushes out "pottery/sculpture/painting" from the title). The description is used **only as a fallback** when the title has no usable word, and there it's still ranked by stem frequency (so a repeated topic like "astronomy" wins). Curated-interest *matching* (§56) is unchanged and still takes priority over derivation. +1 Deno test (411/411 Jest unchanged; `tsc` clean). Live effect needs `ingest-scraped` redeploy + re-scrape. See §57. |
| 2026-05-24 | **More stop words + 17 curated interests + 2-word compound tags.** **(1)** Added `is`, `no`, `longer`, `optional` to `STOP_WORDS` (`for`/`into` were already there). **(2)** Seeded 17 more common descriptive interests — `cafe`, `choir`, `church`, `fair`, `solar`, `free`, `digital`, `virtual`, `networking`, `wine`, `games`, `india`, `irvine`, `executives`, `health`, `medicine`, `acupuncture` (with aliases, e.g. `health`←`wellness`, `church`←`worship`, `medicine`←`medical`) — so many more listings *match* a stable readable tag and skip noisy derivation. In `seed.sql` + `seed-hosted.sql`. **(3)** Derivation can now coin a **2-word compound** interest: within a title run, the first two adjacent candidate words combine into one ≤2-word tag (`cold brew`, `natural medicine`), while a stop word / comma / dash / "and" breaks the run so genuine lists ("Pottery and Sculpture") stay separate tags. +3 Deno tests (compound, stops, title-emphasis re-pointed to a comma list); Jest 411/411; `tsc` clean. Interests need a hosted INSERT + re-tag to apply to existing events. See §58. |
| 2026-05-24 | **Unknown-capacity scraped events: unlimited join + listing warning.** Scraped events have no listed capacity (DB `capacity` is null → `SCEvent.cap` 0). The event-detail screen now treats `cap <= 0` as **unknown / no limit**: the detail row shows "N going · capacity unknown" (not "N/0 · waitlist"), the CTA stays **JOIN EVENT** (never JOIN WAITLIST), and joining pops an info toast — *"No listed capacity — check the original listing for details"* — with a **VIEW LISTING** action opening `sourceUrl`. The server already allowed unlimited joins for null capacity (the `subscribe_to_event_atomic` RPC only waitlists when `capacity IS NOT NULL AND count >= capacity`), so this is client-only — no migration/redeploy. +1 test (412/412); `tsc` clean. Ships with the app build. See §59. |
| 2026-05-26 | **Multi-city scraping + listing capacity + "/unk" display.** **(1)** The scraper scanned only Eventbrite's Irvine listing; it now scans **6 Orange County cities** (Irvine, Santa Ana, Costa Mesa, Newport Beach, Anaheim, Huntington Beach) via a `DEFAULT_SOURCES` list overridable as a whole by a comma-separated **`EVENTS_SOURCE_URLS`** (legacy single `EVENTS_SOURCE_URL` still works). A per-city cap (`MAX_PER_SOURCE`, default `ceil(MAX_EVENTS/sources)` = 7) + a **round-robin merge** mix the cities instead of filling from the first; a bot-blocked/changed source is skipped while the rest contribute, cross-listed dupes collapse, and the global `MAX_EVENTS` (40) still applies. **(2)** Each listing's schema.org **`maximumAttendeeCapacity`** is now parsed → a real `capacity` when present + positive (else `null`); `ingest-scraped` already passes it through, so no redeploy. **(3)** Capacity-unknown events render **"/unk"** instead of "/0": the events feed shows `N/unk` (`app/events.tsx`) and the detail row `N/unk going` (`app/event/[id].tsx`), superseding §59's "capacity unknown" wording; the §59 test was re-pointed. 412/412; `tsc` clean. Scraper changes apply on re-scrape; UI ships with the app build. See §60. |
| 2026-05-26 | **Tag-quality pass: month/filler stop words + trimmed group10 aliases.** The first multi-city live run re-surfaced derive-noise: `may` tagged 4 events (dates in titles), plus `one`/filler. Added all 12 month names (+ `jan`…`dec` abbrevs), number words (`one`/`two`/`three`), and `now`/`actually`/`learn` to the analyzer's `STOP_WORDS` (derivation-only; catalog matching unaffected). Also trimmed `group10`'s `similar_tags` from `['in4matx-43','team','project']` to `['in4matx-43']` (`seed.sql`, `seed-hosted.sql`, `data/mocks.ts`) — the generic `project` alias was matching an unrelated band's "side project". Verified via a Node 24 type-strip driver; Jest 412/412, `tsc` clean. Live effect needs `ingest-scraped` redeploy + a hosted `group10` alias `UPDATE` + re-tag. See §61. |
| 2026-05-27 | **Round 3 code review + multi-agent fix sweep.** `docs/CODE_REVIEW_REPORT_3.md` lands — full-stack audit of the working tree against the requirements + architecture docs (2 Critical + 10 High + 10 Medium + 18 Low). Four worker agents (backend, app-screens, app-infra, scraper+CI+docs) run in parallel on file-disjoint scopes; a compliance agent verifies. 8 logical commits ship: 6 new migrations (`00028`–`00033`, atomic waitlist + status-gated subscribe + age + rating + event-update notifications + scraper-dedup index + chat-enum check), `org_follows` table (`00034`), Edge Function updates (`promote-waitlist`, `subscribe-to-event`, `create-event`, `organizer-remove`), the FR10 client-side notification listener + push-token registration, `api.blockUser`/`submitReport`/`unfollowOrg` persistence, scraper hardening (`fetchWithTimeout`, parallel sources, `source_url` dedup, CDATA strip, fallback exit code), and a brand-new `.github/workflows/ci.yml` (lint + tsc + jest + Deno). 412/412; `tsc` clean. See §62. |
| 2026-05-27 | **Post-audit patches.** Compliance pass surfaces two real defects in the freshly-landed sweep. (1) AuthBootstrap reads `profiles.onboarded_at` but doesn't self-heal legacy users — every pre-migration account would have been force-routed to the onboarding questionnaire on next sign-in. (2) FR5.6's INCREASE half was unimplemented (the migration comment assumed the host UI would loop `promote_waitlist_atomic`; it didn't). Two fixes: a one-shot self-heal write in AuthBootstrap (write `now()` when `onboarded_at` is NULL but the user has non-empty interests), and a new migration `00039_capacity_increase_promote.sql` — AFTER UPDATE OF capacity trigger symmetric to 00037, loops `promote_waitlist_atomic` until either the waitlist is empty or the new cap is full. See §63. |
| 2026-05-27 | **FR-gap closures (FR1.3 / FR5.3 / FR5.10 UI / FR7.2 / FR9.5).** Round 3's FR table had several requirements marked ✗ that weren't lifted to numbered findings; this pass closes them. 4 new migrations (`00035` onboarding column, `00036` host-analytics RPCs, `00037` capacity-decrease demotion, `00038` announcements `message_type` + RLS + BEFORE INSERT trigger). New screens: `app/onboarding/interests.tsx`, `app/host-analytics.tsx`. Remove-attendee UI on `app/attendees/[id].tsx`. Google Calendar OAuth: `lib/google-calendar.ts` + `Google.useAuthRequest` wired in `app/settings/linked-calendar.tsx` + on-subscribe / on-publish insert paths. Announcement composer + distinct rendering in `app/chat/[id].tsx`. New deps: `expo-auth-session ~7.0.8`, `expo-crypto ~15.0.7`. `"engines": { "node": ">=22 <25" }` declared. 412/412; `tsc` clean. See §64. |
| 2026-05-28 | **Map iOS pin-crash saga → custom RN overlay rewrite.** Multi-iteration debugging of an `EXC_BAD_ACCESS` that closed the app after 2-3 pin selections on the Map tab. Tried (in order): drop title/description, imperative `showCallout` via ref, memoize markers + stable refs, upgrade `react-native-maps` to `1.27.2` (couldn't bundle in Expo Go — that package is bundled with the SDK, so a `package.json` bump is a no-op). Device logs proved every JS call landed before each crash — the bug was 100% in the bundled `react-native-maps@1.20.x` native marker pipeline. Settled on a **custom React Native overlay**: `MapView` renders only tiles + the user-location dot + radius `Circle`, **no `<Marker>` children**. Pins are absolute-positioned `<Pressable>` Views projected via in-JS Mercator math against the current region (synchronous, no `pointForCoordinate` round-trips). `onRegionChange` (continuous) tracks the region in state so pins move with the map in real time. Plus a recenter button (`crosshair` icon, bottom-right; targets selected event → user → default in priority) and `onMapPress` wired to clear the focused selection. Pin crash class structurally removed. 412/412; `tsc` clean. See §65. |
| 2026-05-28 | **Chat row avatars (DM single, group stacked Instagram-style) + non-event group titles.** Chat list rows now lead with avatars: DMs show the other person's, event/group rows show two stacked avatars (back top-left + front bottom-right with a card-coloured ring separating them — same trick Instagram uses). `Chat` type gains optional `members?: ChatMember[]`; `api.getChats` extends its existing `chat_members ⨝ profiles` embed to include `avatar_url` + `account_type` (no extra round-trips). Mock mode falls back to `SC_ACCOUNT_BY_ID` for DMs and host + first visible person for event chats. Non-event group chats (no event title) get a title built from member names: `Alice, Bob +N` truncation past three names. 412/412; `tsc` clean. See §66. |
| 2026-05-28 | **Polish pass — self-profile redirect, in-app privacy screen, /unk everywhere, edit description, onboarding interest sync.** Six small fixes from rapid bug-report iteration: (1) self-profile redirect on `app/profile/[id].tsx` so navigating to your own user id hands off to `/(tabs)/profile` instead of showing the friend/block UI pointed at yourself, plus belt-and-braces hiding of the action buttons + handler early-returns when `isSelf` is true. (2) New in-app `app/settings/privacy.tsx` replacing the external `scenecheck.app/privacy` link (not our domain — was serving unrelated demo content); bug-report URL corrected to the actual repo. (3) `0/unk` capacity fallback applied to `SCEventCard`, `my-hosting.tsx`, and `profile/[id].tsx` (was only on `events.tsx`). (4) Description editing wired into `EditEventSheet`. (5) Onboarding interest writes now mirror into the local store after the DB write (live-mode branch was missing the mirror, mock branch already had it). 412/412; `tsc` clean. See §67. |
| 2026-05-29 | **Eventbrite time correctness + ticket price columns (backend).** Two related fixes in the FR6 scraper pipeline + a new DB column. **(1) Time:** Eventbrite listing JSON-LD ships date-only `startDate` ("2026-05-29"), which `new Date()` parses as UTC midnight — a North American user reads this as the *previous day* at 5pm PDT. The scraper now follows the URL to the detail page (which carries the real `"2026-05-29T14:00:00-07:00"`) when the listing value is date-only. New pure helpers in `scripts/scrape-time.mjs` — `isDateOnly` / `hasTimezone`, `timezoneFromSourceUrl` (full US-50 state-code → IANA map), `extractFullJsonLdTimestamp`, `timezoneOffsetMinutes` via `Intl.DateTimeFormat` (DST-aware), `dateOnlyToVenueLocalNoonIso` (fallback when detail unreachable). Path classifier emits per-source `time-resolution: detail:N` log line. **(2) Ingest dedup self-heal:** the old `title + start_at` dedup missed once the scraper corrected times — the INSERT then collided with the `00033` partial unique index on `source_url`. `ingest-scraped` now keys on `source_url` first (falls back to title+start_at for `FALLBACK_EVENTS`), and patches `start_at`/`end_at`/price columns in place when they differ. **(3) Price:** migration `00040_events_price.sql` adds nullable `price_min` / `price_max` / `price_currency` (CHECK: both-set-or-neither, non-negative, max ≥ min). Encoding contract: NULL/NULL = unspecified, 0/0 = FREE, equal nonzero = fixed, min < max = range. `scripts/scrape-price.mjs` extracts from `AggregateOffer`/`Offer`/arrays with a CAD→USD override for US listings (Eventbrite mis-tags some CA events as CAD). `ingest-scraped` + `create-event` validate + persist + extend self-heal. CI workflow `scraper-tests` job now runs both `scrape-time.test.mjs` + `scrape-price.test.mjs` via `node --test`. 23 + 18 = 41 new node:test cases; jest 412/412 (no Jest surface for these); `tsc` clean. See §68. |
| 2026-05-29 | **Ticket price UI rendering (frontend).** Surfaces the new price triple end-to-end. New `lib/price.ts` — `priceState` (none/free/fixed/range), `formatPrice`, `formatPriceAmount` with currency-symbol map (USD/CAD/EUR/GBP/JPY/AUD/MXN); unknown ISO codes render `XYZ 15`. New `tag` icon in `SCIcon`. Display surfaces: `SCEventCard` gains a `PriceChip` on the bottom bar (FREE = green pill, paid = neutral outline); `app/events.tsx` mirrors the same chip; `app/event/[id].tsx` adds a "Ticket price" `DetailRow` with the tag icon ("Free to attend" for free events). Edit + create flows: `EditEventSheet` and `app/create-event.tsx` get a `NOT SET / FREE / PAID` three-mode toggle; PAID reveals MIN/MAX number inputs (max optional → fixed-price). Plumbing: `SCEvent` + `DraftForm` gain price fields; `EventRow` + `transformEventRow` map them through with a `num()` helper for supabase-js NUMERIC-as-string values; `api.updateEvent` accepts a price patch shape. 425/425 (412 baseline + 13 new); `tsc` clean. See §69. |
| 2026-05-29 | **Legacy date-only-UTC scraped rows cleanup (migration 00041).** One-shot cleanup for rows the FR6 scraper landed before the time-fix + price-column work. The conjunction `source='scraped' AND price_min IS NULL AND start_at::time = '00:00:00'` reliably fingerprints the legacy class (date-only-parsed-as-UTC-midnight + no price after the latest heal). DO block + `RAISE NOTICE` for the deleted count. FK cascades verified: `event_interests` / `event_subscriptions` / `event_waitlist` / `ratings` are ON DELETE CASCADE; `chats.event_id` and `reports.target_event_id` are ON DELETE SET NULL. No orphan risk; idempotent. See §70. |
| 2026-05-30 | **Onboarding tour replay wired.** The Help & feedback row labelled "How SceneCheck works" called an inline handler that just toasted *"Welcome tour replay coming soon"* — the walkthrough it promised was never built. Replaced the dead handler with a real route entry pointing at `/onboarding/interests` (the post-signup picker built for FR1.3), and relabelled the row to **"Replay onboarding"** / "Re-pick the interests we use to rank events for you" so the affordance matches what it actually does. `api.markOnboarded` is idempotent and additive — re-picking interests adds to the existing set rather than wiping it — so the row is safe to invoke from settings without a confirmation gate. Regression test added (`router.push` assertion). 426/426; `tsc` clean. See §71. |
| 2026-05-30 | **Wider scrape (LA cluster) + skip fixture POSTs + dupe cleanup (migration 00042).** Three related changes. **(1) Wider sources:** `DEFAULT_SOURCES` expanded 6 OC cities → **14 cities** (8 OC + 6 LA: los-angeles, long-beach, pasadena, santa-monica, west-hollywood, burbank). **(2) Cap bump:** `MAX_EVENTS` default 40 → **120** so the wider source set can actually deliver more events instead of getting clipped. **(3) Skip fixture POSTs:** `FALLBACK_EVENTS` (Beginner Bouldering Night / Aldrich Park Morning Run / Common Room Coffee Meetup) used to POST whenever Eventbrite returned 0 events, but the fixtures had drifting `start_at` + NULL `source_url` so dedup missed on both keys — multi-week buildup left 4× each title in the feed. Live mode now logs the empty result + exits with code 2 + skips the POST entirely; DRY_RUN still surfaces the fixtures for local inspection. Migration `00042_cleanup_fallback_scraped.sql` deletes every scraped row with `source_url IS NULL` (the fixture bloat + any pre-source_url-tracking-era stragglers). Live run after the changes: 120 events scraped, 103 new + 17 self-healed, 0 failed; LA cluster contributed visibly (Studio 420 West Hollywood, LA Independent Beer Fest, Santa Monica USA Kick Off, Pasadena Award-winning Rose de Chine, …). 426/426; `tsc` clean. See §72. |
| 2026-05-30 | **Events nearby honors user coords + radius; default bumped 5 → 10 mi.** Two related discovery-pipeline fixes. **(1) Coords + radius wire-up:** `app/(tabs)/index.tsx` (Home rail) was passing `radiusM` but not coords — `fetchEvents` fell back to `DEFAULT_REGION` (Irvine) instead of the user's actual location. `app/events.tsx` (the "HAPPENING NEAR YOU" full list) was calling `useEvents()` with **no arguments at all**, so BOTH coords and radius defaulted (Irvine + 5mi hardcoded). After the LA-cluster scrape landed 100+ events across OC + LA, the `rank_events_query` RPC's `ST_DWithin` only saw the ~5mi bubble around Irvine — anything further was filtered at the DB. Both screens now match the Map tab's pattern (`useEvents({ lat, lng, radiusM })` from `useLocation` + `useStore(s => s.radius)`). **(2) Default radius bump:** `store.radius` and `DEFAULT_RADIUS_M` (`components/Map/types.ts`) both bumped 5 → 10 mi (8047 → 16093 m) so a fresh install surfaces events from the full anchor metro instead of a tight Irvine bubble. `api.fetchEvents` fallback now references `DEFAULT_RADIUS_M` instead of inlining 8047. Test fixtures updated (`test-utils`, `unit/store`, `unit/map-types`, `screens/map-tab`); slider range stays 0.5–50 mi. 426/426; `tsc` clean. See §73. |
| 2026-05-30 | **Desktop web build — full large-screen parity surface (`scenecheck-expo/web/` + `*.web.tsx`).** A dedicated desktop web experience landed across nine commits: platform-branched `_layout`s + a `WebShell` (fixed full-viewport chrome, two-glow background) wrapping an Instagram-style left **rail** and the route content; a library of shared web atoms under `web/`; a desktop **map** (react-leaflet over OSM via `Map.web.impl` + a JS-injected `leafletCss`) with rich pin hover cards, search autocomplete, and a filter popover; a two-pane **chat** (realtime, announcements, retry, edited); a sticky-left **profile** with five slide-over overlays + secondary lists; a **create-event** wizard with live preview and a **settings** screen with inline summaries; and a four-section **discover/search** + activity panel + notifications feed. Overlay routes use `presentation:'transparentModal'` on web so they slide over via `WebSlideOver` instead of replacing the page. See §74. |
| 2026-05-30 | **Friend/own events on the web map + event-detail routing parity + edit-notify trigger fix (migrations 00043–00045) + rail/shell layout.** `rank_events_query` (`00043`) now returns `is_friend_creator` (an accepted-friendship `EXISTS`) so friend-hosted events bucket as `kind:'friend'` (coloured) instead of grey `other`, and its filter widened to `status='published' OR creator_id = p_user_id` so a creator always sees their own events — drafts included; `transformEventRow` consumes the flag. Migration `00044` fixes a latent crash in `notify_event_updated` (`text[] || 'literal'` resolved as `anyarray || anyarray` → "malformed array literal") by switching to `array_append` — this had silently broken **every** event edit/UPDATE that touched a tracked column. Migration `00045` re-stamps the 9 seeded events to upcoming `now()`-relative times so the other-account/org-hosted events stop being filtered out by `rank_events_query`'s `start_at > now()-2h` window. Web **event detail** reached native parity: clickable **Where → `/map?focus=<id>`**, a ticket-price fact, a scraped **"view original listing"** link, and the **N/unk** unknown-capacity display; `map.web` reads `?focus` to select + pan to an event and `WebMap` gained a `centerOn` prop that imperatively re-centres leaflet. **Layout:** added **Profile** to the rail's middle nav; fixed the rail overflowing off the bottom of the window (`alignSelf:'stretch'` instead of `height:'100%'`, so its bottom padding actually lifts the Settings/account cluster) + `minHeight:0` on the nav scroll area; re-centred the LIVE chip with the legend; and halved the top insets on the rail + `WebShell`. 426/426; `tsc` clean; migrations applied to the hosted project. See §74. |

### Current layout

```
In4matx-43-Project/
├── scenecheck-expo/                ← active project (Expo SDK 54 + TS)
├── supabase/                       ← shared backend (15 migrations, 9 Edge Functions, 3 pgTAP files)
├── docs/                           ← code review, test plan, this snapshot
├── legacy/                         ← archived prototype (HW2/HW3)
├── assets/                         ← UI draft images (referenced by requirements doc)
├── IN4MATX 43 Architecture Document.md
├── IN4MATX-43-Requirements-Document.md
├── user_flow_traces.md
├── LICENSE
├── README.md                       ← project-structure section + quick-start blocks
└── .gitignore                      ← generic, covers both subdirs
```

---

## 2. Codebase metrics

_Last updated: 2026-05-19 (commit c0432bf)_

### Legacy prototype (now in `legacy/src/`)

| File | Lines | Role |
|---|---|---|
| `screens.jsx` | 4,876 | 30+ screens in one file |
| `app.jsx` | 778 | Root + routing + 21 useStates |
| `tweaks-panel.jsx` | 568 | Dev-toggle panel |
| `heuristic-fixes.jsx` | 535 | Conflict chip + host edit/cancel |
| `components.jsx` | 459 | Primitives |
| `additions.jsx` | 425 | ToastHost, ConfirmDialog, onboarding |
| `api.js` | 361 | Dual-mode Supabase bridge |
| `ios-frame.jsx` | 338 | iPhone bezel for desktop demo |
| `data.jsx` | 336 | SC_* mock fixtures |
| `date-time.jsx` | 65 | Helpers |
| **Total** | **~8,741** | (excluding index.html CSS) |

### Active Expo project (`scenecheck-expo/`)

| Group | Files | Purpose |
|---|---|---|
| `types/` | 1 | `domain.ts` — shared TS types (Event, Account, Chat, Draft, etc.) |
| `lib/` | 5 | `api.ts`, `supabase.ts`, `date-time.ts`, `conflicts.ts`, `notifications.ts` |
| `store/` | 1 | `useStore.ts` — Zustand with 7 slices, AsyncStorage persistence |
| `theme/` | 2 | `tokens.ts` (3 palettes × 2 modes), `ThemeProvider.tsx` |
| `data/` | 1 | `mocks.ts` — typed port of the prototype's `data.jsx` |
| `components/` | 13 | SC primitives + Map split + overlays |
| `components/Map/` | 4 | `types.ts`, `Map.tsx` (TS fallback), `Map.native.tsx`, `Map.web.tsx` |
| `hooks/` | 2 | `useLocation.ts`, `useImagePicker.ts` |
| `app/` | 24 routes | Expo Router file-based routing (tabs, modals, stacks) |

### Backend (`supabase/`)

| Group | Count | Notes |
|---|---|---|
| Migrations | 15 | 12 original + Phase 7 additions (`00014_fix_profiles_rls`, `00015_atomic_subscribe`) |
| Edge Functions | 9 | All 9 now have CORS preflight (Phase 7 fix) |
| pgTAP tests | 3 | `schema`, `constraints`, `rls` (updated for renamed policy) |

---

## 3. Phase-by-phase progress log

_Last updated: 2026-05-19 (commit c0432bf)_

This is the same 16-task plan that was used to drive the migration. Each
task represents a discrete, verifiable unit of work; status reflects
final state as of the snapshot date.

| # | Phase | Task | Status |
|---|---|---|---|
| 1 | 1.1 | Scaffold Expo TypeScript project at `scenecheck-expo/` | ✅ |
| 2 | 1.2 | Install runtime deps (Supabase, Zustand, SVG, AsyncStorage, URL polyfill) | ✅ |
| 3 | 1.3 | Set up `.env` / `.env.example` with `EXPO_PUBLIC_*` vars | ✅ |
| 4 | 2.1 | Port `data.jsx` → `data/mocks.ts` (typed) | ✅ |
| 5 | 2.2 | Port `date-time.jsx` → `lib/date-time.ts` | ✅ |
| 6 | 2.3 | Port `api.js` → `lib/supabase.ts` + `lib/api.ts` | ✅ |
| 7 | 2.4 | Consolidate conflict detection → `lib/conflicts.ts` (fixes review duplication) | ✅ |
| 8 | 2.5 | Set up Zustand store (`store/useStore.ts`) | ✅ |
| 9 | 2.6 | Create theme system (`theme/tokens.ts` + `ThemeProvider.tsx`) | ✅ |
| 10 | 3.1 | Port core component primitives (10 files) | ✅ |
| 11 | 3.2 | Set up Expo Router with bottom tab nav | ✅ |
| 12 | 3.3 | Port HomeScreen as end-to-end proof | ✅ |
| 13 | 4 | Iterative screen ports — 24 routes total | ✅ |
| 14 | 5 | Native specifics (real maps, image picker, push, location) | ✅ |
| 15 | 6 | Port tests + add new coverage for state/screens | ✅ |
| 16 | 7 | Fix code review backend bugs (4 issues) | ✅ |

### Post-plan follow-up

| # | Item | Status |
|---|---|---|
| 17 | Rename env var to `PUBLISHABLE_KEY` for Supabase 2025 key system | ✅ |
| 18 | Write this progress snapshot | ✅ |

### Phase 4 (24 screens) breakdown

`app/` route → source: every screen below was ported from `legacy/src/screens.jsx` or `legacy/src/additions.jsx`.

| Route file | Original | Phase |
|---|---|---|
| `app/(tabs)/index.tsx` | `SCHomeScreen` | 3.3 |
| `app/(tabs)/map.tsx` | `SCMapScreen` (placeholder; real map ships in Phase 5) | 3.2 / 5 |
| `app/(tabs)/chat.tsx` | `SCChatList` | 3.2 |
| `app/(tabs)/profile.tsx` | `SCMyProfile` | 3.2 / 4 |
| `app/events.tsx` | `SCEventsList` | 4 |
| `app/event/[id].tsx` | `SCEventScreen` | 4 |
| `app/chat/[id].tsx` | `SCChatThread` | 4 |
| `app/profile/[id].tsx` | `SCProfileOther` + `SCOrgProfile` (merged) | 4 |
| `app/search.tsx` | `SCSearchScreen` | 4 |
| `app/settings.tsx` | `SCSettingsScreen` + `SCTweaksPanel` (merged) | 4 |
| `app/settings/blocked.tsx` | `SCBlockedUsers` | 4 |
| `app/settings/linked-calendar.tsx` | `SCLinkedCalendar` | 4 |
| `app/settings/help.tsx` | `SCHelpFeedback` | 4 |
| `app/requests.tsx` | `SCRequestsScreen` | 4 |
| `app/my-hosting.tsx` | `SCMyHosting` | 4 |
| `app/my-friends.tsx` | `SCMyFriends` | 4 |
| `app/my-following.tsx` | `SCMyFollowing` | 4 |
| `app/attendees/[id].tsx` | `SCAttendees` | 4 |
| `app/interests/index.tsx` | `SCInterestsScreen` | 4 |
| `app/interests/[tag].tsx` | `SCInterestDetail` | 4 |
| `app/ratings/[hostId].tsx` | `SCRatingsScreen` | 4 |
| `app/new-chat.tsx` | `SCNewChat` | 4 |
| `app/create-event.tsx` | `SCCreateEvent` (simplified; wizard → single-page form) | 4 |
| `app/event-published.tsx` | `SCEventPublished` | 4 |
| `app/drafts.tsx` | `SCDraftsScreen` | 4 |
| `app/auth/sign-in.tsx` | new (legacy had no auth UI) | 4 |
| `app/auth/sign-up.tsx` | new (legacy had no auth UI) | 4 |

### Phase 7 backend bug-fix breakdown

| # | Bug | Fix | Files |
|---|---|---|---|
| 1 | Profiles RLS leaked private profiles to any non-blocker | New policy `'Profile visibility respects privacy and blocks'` + `are_friends()` helper | `supabase/migrations/00014_fix_profiles_rls.sql`, `supabase/tests/rls.test.sql` |
| 2 | Edge Functions had no CORS — browser blocked every call | `CORS_HEADERS` constant + `handlePreflight()` helper; wired into all 9 functions | `supabase/functions/_shared/supabase-client.ts` + all 9 `index.ts` |
| 3 | `subscribe-to-event` had race between capacity check and insert | Atomic `subscribe_to_event_atomic()` RPC with `pg_advisory_xact_lock` | `supabase/migrations/00015_atomic_subscribe.sql`, `supabase/functions/subscribe-to-event/index.ts` |
| 4 | `send-friend-request` never invoked `dispatch-notification` (FR10.1) | Fire-and-forget `admin.functions.invoke('dispatch-notification', ...)` after friendship commits | `supabase/functions/send-friend-request/index.ts` |

---

## 4. Test counts

_Last updated: 2026-05-19 (commit c0432bf)_

```
Test Suites: 33 passed, 33 total
Tests:       259 passed, 259 total
Snapshots:   0 total
Time:        ~4 s (cold), ~2 s (warm cache)
```

### By layer

| Layer | Files | Cases | Examples |
|---|---|---|---|
| Unit — date/time | 1 | 32 | `parseTime("12:00 AM")` returns midnight; format roundtrips lossless |
| Unit — conflicts | 1 | 17 | `findConflict` skips self; missing lookup returns null |
| Unit — store | 1 | 25 | Every slice mutator: events, social, ui, prefs, drafts, overlays |
| Unit — api mock-mode | 1 | 18 | All 12+ mock-mode methods + ID mapping roundtrip |
| Unit — map types | 1 | 9 | `pinColor` + `eventLatLng` (shared between native + web maps) |
| Hook | 1 | 5 | `useImagePicker` — denial, cancel, success, reset |
| Component | 3 | 18 | `SCEventCard`, `SCAvatar`, `ConflictChip` |
| Screen integration | 24 | 135 | One file per Expo Router route; render + key interactions |
| **Total** | **33** | **259** | |

### Test counts over time

| Date | Tests | Suites | Notes |
|---|---|---|---|
| 2026-05-18 (prototype) | ~85 | 9 | Legacy `tests/` directory; 50 unit + 35 integration |
| 2026-05-19 (post-Phase 6) | 138 | 9 | Phase 6 foundation tests (no screen ports yet) |
| 2026-05-19 (post-screen-tests) | **259** | **33** | +17 screen tests + supporting hook/component tests |

---

## 5. Coverage numbers

_Last updated: 2026-05-19 (commit c0432bf)_

Source: `cd scenecheck-expo && npm run test:coverage`

### Overall

| Metric | % |
|---|---|
| Statements | 55.05 |
| Branches | 44.93 |
| Functions | 63.81 |
| Lines | 55.66 |

### Per-module (active codebase only — excludes Expo template leftovers)

| Module | Stmts % | Branch % | Funcs % | Lines % |
|---|---|---|---|---|
| `theme/tokens.ts` | 100 | 100 | 100 | 100 |
| `lib/date-time.ts` | 100 | 100 | 100 | 100 |
| `lib/conflicts.ts` | 92.7 | 92.1 | 100 | 100 |
| `lib/supabase.ts` | 100 | 50 | 100 | 100 |
| `lib/api.ts` | 15.4 | 11.0 | 40.5 | 12.8 |
| `lib/notifications.ts` | 0 | 0 | 0 | 0 |
| `store/useStore.ts` | 89.5 | 61.1 | 86.6 | 90.7 |
| `components/Map/types.ts` | 100 | 81.8 | 100 | 100 |
| `components/Map/Map.native.tsx` | 80.0 | 63.6 | 60.0 | 77.8 |
| `components/SCEventCard.tsx` | 100 | 90.9 | 100 | 100 |
| `components/SCAvatar.tsx` | 100 | 88.9 | 100 | 100 |
| `components/ConflictChip.tsx` | 100 | 93.8 | 100 | 100 |
| `components/SCText.tsx` | 100 | 100 | 100 | 100 |
| `components/SCSection.tsx` | 100 | 100 | 100 | 100 |
| `components/Screen.tsx` | 100 | 100 | 100 | 100 |
| `components/LegendDot.tsx` | 100 | 100 | 100 | 100 |
| `components/ConfirmDialog.tsx` | 0 | 0 | 0 | 0 |
| `components/ToastHost.tsx` | 0 | 0 | 0 | 0 |
| `hooks/useImagePicker.ts` | 91.7 | 75.0 | 100 | 91.3 |
| `hooks/useLocation.ts` | 77.8 | 50.0 | 100 | 77.8 |

### Coverage over time

| Date | Stmts % | Branch % | Funcs % | Lines % | Notes |
|---|---|---|---|---|---|
| 2026-05-18 (prototype, root) | 7.19 | 4.60 | 3.44 | 8.47 | 8,500-line codebase, only utilities tested |
| 2026-05-19 (post-Phase 6 foundation) | 41.99 | 29.30 | 50.25 | 40.77 | Foundation modules at 90-100%; screens untested |
| 2026-05-19 (post-screen-tests) | **55.05** | **44.93** | **63.81** | **55.66** | Per-screen tests pushed component/screen lines up |

---

## 6. Validation status

_Last updated: 2026-05-19 (commit c0432bf)_

| Check | Command | Result |
|---|---|---|
| TypeScript (strict mode) | `cd scenecheck-expo && npx tsc --noEmit` | ✅ clean |
| Expo doctor | `cd scenecheck-expo && npx expo-doctor` | ✅ 17/17 |
| Test suite | `cd scenecheck-expo && npm test` | ✅ 259/259 |
| Env loading | Confirmed in expo-doctor output: `env: export EXPO_PUBLIC_SUPABASE_*` | ✅ |
| pgTAP suite | `supabase test db` | ⚠️ Not run (requires Docker on dev machine) |
| Edge Function Deno tests | `deno test` | ⚠️ Not yet written |

---

## 7. Outstanding items / next steps

_Last updated: 2026-05-19 (commit 325bbd4)_

Eight bug-level findings from the second code review
(`docs/CODE_REVIEW_REPORT_2.md`) have been patched in commit `325bbd4`.
One architectural recommendation remains (item 1 below). Ordered
roughly by remaining impact.

### Resolved by the second-review patch batch (commit `325bbd4`)

- ✅ **Navigation 404** — `event/[id].tsx:249` now routes to `/attendees/${e.id}` (matches the actual route file)
- ✅ **`isHost` broken in live mode** — `event/[id].tsx:101` now compares `e.hostId` against `me.id` from the store instead of the literal string `'me'`
- ✅ **Hardcoded date** — `(tabs)/map.tsx` now uses `fmtDate(new Date())`; the `map-tab.test.tsx` assertion was relaxed to a regex tail-match
- ✅ **`toastIdCounter` module-scope leak** — moved into store state as `_toastIdCounter`; reset to 0 in both `test-utils.tsx` and the store unit test's `resetStore`
- ✅ **Mock data in live-mode store init** — `store/useStore.ts` now gates `joined`, `friends`, `outgoing/incomingRequests`, `following`, `subscribedInterests`, and `blocked` behind `isLiveBackendAvailable()`; live mode starts empty
- ✅ **Dead `x/y` coordinate roundtrip** — `SCEvent` gained optional `lat`/`lng`; `lib/api.ts:transformEventRow` populates them directly from the database row; `eventLatLng` prefers them when present, falls back to x/y for mock fixtures
- ✅ **`fmtWhen`/`fmtTime` duplication** — `lib/api.ts` now uses `isoToTime`/`isoToWhen` from `lib/date-time.ts` (the canonical formatters added in the same patch)
- ✅ **`Map` coupling to `useStore`** — both `Map.native.tsx` and `Map.web.tsx` now accept `meInterests` as a prop; `(tabs)/map.tsx` reads from the store and passes it down

### Still outstanding

1. **Route screens through `lib/api.ts` instead of importing mocks directly.** 10 of 24 screens (`app/(tabs)/index.tsx`, `app/events.tsx`, `app/search.tsx`, etc.) `import { SC_EVENTS, SC_CHATS } from '@/data/mocks'` instead of calling `api.fetchEvents()`. Live mode currently has no effect on those screens until each one is refactored to use the api client. This is a multi-file architectural change rather than a bug patch.
2. **Run the pgTAP suite + add a regression test for the RLS leak** (Phase 7 ships the fix; the regression test that asserts a stranger cannot SELECT a private profile is the natural next test). Requires Docker.
3. **Deno tests for the 9 Edge Functions**, especially the 4 touched in Phase 7 (atomic-subscribe, friend-request notification dispatch, CORS, RLS). Edge Function logic currently relies on the typed shape only.
4. **Date/time pickers in `app/create-event.tsx`** — currently uses `TextInput`s with format hints; would benefit from `@react-native-community/datetimepicker`. The legacy version had a 4-step wizard with native-feeling pickers.
5. **`ConfirmDialog.tsx` / `ToastHost.tsx` direct render tests** — both at 0% line coverage. Screen tests verify the *trigger* (`showConfirm`/`showToast` writes to the store) but not the modal render. Easy 8-10 additional tests.
6. **Strengthen screen-test assertions.** Round-2 review noted that ~50% of the 135 screen tests are render-only; they smoke-test that nothing crashes but don't exercise state transitions or downstream effects. Targeted addition of interaction assertions would close meaningful coverage gaps without much new code.
7. **Set up CI** (GitHub Actions: lint + typecheck + test on push). The architecture doc prescribes this; nothing exists yet.
8. **Long-press → edit/delete on chat messages** — needs `react-native-gesture-handler` wiring on RN. Legacy did this via `onPointerDown` + a setTimeout.
9. **Account switcher (Instagram-style)** — profile tab currently shows only the personal account. Legacy had org-account swap; needs a sheet UI + store slice.
10. **Welcome onboarding tour** — legacy `SCOnboarding`. Components exist (`SCText`, `SCButton`); needs a step state machine + skippable overlay.
11. **Delete Expo template leftovers** — `themed-text.tsx`, `themed-view.tsx`, `parallax-scroll-view.tsx`, `hello-wave.tsx`, `haptic-tab.tsx`, the `ui/` directory. None imported by SceneCheck; ~7 files, ~150 lines.
12. **E2E on web via Playwright** — drive the deployed Expo Web build through sign-in → home → join → chat → leave.

---

## 8. Code reviews

_Last updated: 2026-05-19 (commit 325bbd4)_

| # | Date | File | Scope | Headline |
|---|---|---|---|---|
| 1 | 2026-05-18 | `docs/CODE_REVIEW_REPORT.md` | Pre-migration audit of the legacy prototype + Supabase backend | 4 backend bugs (RLS, CORS, race, missing notif dispatch), god-component `app.jsx`, duplicate conflict logic, stack deviation from the architecture doc — **all 7 fixed in commits `59d5583` + `b38f70b`** |
| 2 | 2026-05-19 | `docs/CODE_REVIEW_REPORT_2.md` | Post-migration delta review of the current state | All 7 first-review findings confirmed resolved. Flagged 1 new navigation bug + 7 smaller post-migration issues — **all 8 patched in commit `325bbd4`** (see §7) |

The second review is structured as a delta — every original finding has
a ✅ / ⚠️ / ❌ status line with file:line citations, plus standalone
sections on the new Zustand store design, the platform-split Map
pattern, test-infrastructure quality, and architecture/requirements
adherence. The "Prioritized Recommendations" section there is the
source for items 1–3 in §7 above.

---

## 9. Web-bundle compatibility (Expo SDK 54 web)

_Last updated: 2026-05-19 (commit a01665e)_

`npm run web` now boots cleanly and the page hydrates / is interactive.
Getting there from the first try required three targeted fixes against
specific incompatibilities between Expo SDK 54's static-SSR web output
(`app.json` has `web.output: "static"`) and our dependency set. Each
fix is intentionally narrow so native builds are unaffected.

### Root causes (in the order they surfaced)

1. **AsyncStorage + Zustand persist hydration touched `window` during
   the SSR pass.** Static export renders every route to HTML in Node
   first; `@react-native-async-storage/async-storage` on web is a thin
   wrapper around `window.localStorage` and threw `ReferenceError:
   window is not defined` from `SupabaseAuthClient._recoverAndRefresh`
   (auth eagerly reads the persisted session at `createClient` time)
   and would have hit the Zustand persist middleware next.
2. **`leaflet` touches `window` at module load.** It's imported
   statically by `components/Map/Map.web.tsx`. Even though the map
   tab isn't the landing page, Metro resolves all reachable imports
   during the SSR bundle, so the leaflet IIFE ran in Node.
3. **Zustand v5's ESM `middleware.mjs` uses `import.meta.env`.** Metro
   served the dev bundle as a classic script, so the browser parser
   rejected the whole file with `SyntaxError: Cannot use 'import.meta'
   outside a module` *before* any JS ran — which is why the page
   rendered (SSR HTML) but every button was dead (no hydration). The
   CJS variant of the same file uses `process.env.NODE_ENV` and parses
   fine.

### Fixes landed

| # | File | Change | Why it's safe for native |
|---|---|---|---|
| 1 | `scenecheck-expo/lib/storage.ts` (new) | Platform-aware `kvStorage`: AsyncStorage on iOS/Android, a `localStorage` wrapper with `typeof window` guards on web. | Native takes the AsyncStorage branch unchanged. |
| 2 | `scenecheck-expo/lib/supabase.ts` | Auth uses `kvStorage` instead of importing AsyncStorage directly. | Native gets AsyncStorage via `kvStorage`; behavior identical. |
| 3 | `scenecheck-expo/store/useStore.ts` | Zustand persist uses `createJSONStorage(() => kvStorage)`. | Same — persistence still goes through AsyncStorage on native. |
| 4 | `scenecheck-expo/components/Map/Map.web.tsx` (rewritten as wrapper) + `Map.web.impl.tsx` (renamed from old `Map.web.tsx`) | Web map is now `useEffect`-gated + `React.lazy()`. Leaflet only loads after first client render. SSR renders an empty placeholder `<View>`. | Native uses `Map.native.tsx` via Metro's platform extension; this file isn't touched. |
| 5 | `scenecheck-expo/metro.config.js` (new) | Resolver override routes `zustand`, `zustand/middleware`, and four sibling entries to their CJS files when `platform === 'web'`. | The override is fenced by `platform === 'web'`, so iOS/Android resolve via the normal exports map. |

### Verification

| Check | Result |
|---|---|
| SSR bundle compiles | ✅ `Bundled … node_modules\expo-router\node\render.js` |
| Web bundle compiles | ✅ `Web Bundled … node_modules\expo-router\entry.js` (1380 modules) |
| No `ReferenceError: window is not defined` in server log | ✅ |
| No `SyntaxError: Cannot use 'import.meta' outside a module` in browser | ✅ |
| Bundle uses CJS Zustand devtools shim | ✅ Confirmed via `curl` — bundle contains `process.env.NODE_ENV !== "production"` not `import.meta.env.MODE` |
| Page interactive after hydration | ✅ |

### Remaining console noise (cosmetic; non-blocking)

These were captured after the page loaded successfully. None prevent
interaction; each is recorded here so the next snapshot can decide
whether to chase them.

- **`CSP report: script-src blocked — eval() / new Function() / setTimeout(string)`.** Metro's dev bundle and React Refresh use `Function(...)` for HMR boundary updates. The browser's DevTools shows a CSP advisory because no explicit policy is set. Dev-only; the production export (`expo export -p web`) doesn't use `Function`-based eval. **Action when needed:** add a `meta http-equiv="Content-Security-Policy"` to the static HTML template if/when the deployed bundle reports the same.
- **`props.pointerEvents is deprecated. Use style.pointerEvents`** (react-native-web warnOnce). Emitted from `react-native-web`'s `createDOMProps`, triggered by some library passing the legacy prop form. Our own code uses `pointerEvents="box-none"` on `ToastHost.tsx:20` — the canonical fix is to move it under `style.pointerEvents`. **Action when needed:** one-line edit in `ToastHost.tsx`. Will silence the warning on every render of the toast host.
- **`Blocked aria-hidden on an element because its descendant retained focus`** (browser a11y warning, multiple occurrences on `/map`). Comes from react-navigation's stack/tabs marking inactive route containers with `aria-hidden="true"` while a Pressable inside still holds focus. The modern recommendation is to use the `inert` attribute. **Action when needed:** track upstream — `@react-navigation/native` issue for `aria-hidden → inert` migration is open as of this snapshot. Not something we patch locally.

### Why the dev-server log shows ~30 HMR rebuild events

Each save triggers Metro's incremental rebuilder, which emits one
`Web Bundled … (N modules)` line per platform/bundle (often N=1 for
fast deltas). These are healthy — they're how HMR works in dev. The
two lines that matter for "did we actually rebuild" are the ones with
>1000 modules; everything else is a delta refresh.

### TEST_PLAN.md updates landed alongside

`docs/TEST_PLAN.md` gained a new §2.7 "Web-bundle compatibility fixes
(post-Phase 6 delta)" that records per-file the testing implications
of each change above, the unchanged 259/259 test count, and the
deliberate decision to skip a full `--coverage` rerun (the net
movement from the ~28-line new `lib/storage.ts` is below the 0.5pp
threshold worth a re-snapshot). The header `_Last updated_` line was
updated to note the re-verification.

---

## 10. Web design parity + Create-flow port

_Last updated: 2026-05-19 (commit 810b744; tag auto-fill follow-up in afaa4e9)_

A second pass after §9 brought three pieces of the legacy design and
flow back from the prototype into the Expo port. None of these need a
backend; everything lives in the frontend tree and the Zustand store.

### 10.1 Web design parity (`app/+html.tsx`)

After the SDK 54 web bundle finally booted in §9, the page rendered on
a default white viewport in the browser's fallback sans-serif — none
of the legacy's cream `pageBg`, radial-gradient glows, or
Bricolage / DM Sans / JetBrains Mono showed up. They were defined in
`theme/tokens.ts` but no code path consumed `pageGlow1` / `pageGlow2`,
and `expo-font` was never invoked.

`app/+html.tsx` (new — Expo Router's custom SSR HTML shell, web-only
by convention) closes both gaps:

- **Google Fonts `<link>`** for all three families at all weights
  referenced by `FONT.display` / `FONT.body` / `FONT.mono`.
- **Inline `<style>`** painting the `body` with the Sunset Coral
  *light* `pageBg` plus the two radial-gradient glows from the legacy
  `index.html` (`pageGlow1` at top-left, `pageGlow2` at bottom-right),
  the `-webkit-font-smoothing: antialiased` + `text-rendering`
  rules, and a `#root { display:flex; min-height:100vh }` so the
  React tree fills the viewport.

Color values are hardcoded to the store's default palette+mode (also
documented in the file header) — the inner React tree paints its own
theme-aware backgrounds, so this only matters for the pre-hydration
paint and the area outside the React root (browser scrollbar gutter,
etc).

### 10.2 Date + time pickers on Create Event

The legacy Create Event screen used two custom popouts that had been
flagged in `docs/PROGRESS_SNAPSHOT.md` §7 #4 as "would benefit from a
real picker" — they had been carried over as placeholder `TextInput`s
in the migration. Ported to React Native:

| Component | Mirrors legacy | Behavior |
|---|---|---|
| `components/SCDatePicker.tsx` | `SCDatePicker` in `legacy/src/screens.jsx:791` | Modal-anchored calendar grid, prev/next month navigation, **past dates greyed + line-through + disabled**, today outlined in `primary`, selected filled with `ink`. Reads/writes the friendly `"Sat May 16"` string already used everywhere else. |
| `components/SCTimePicker.tsx` | `SCTimePicker` + `SCWheel` in `legacy/src/screens.jsx:992` | Modal with three snap-scrolling wheels (hours 1–12, minutes 0–55 by 5s, AM/PM). Center row is highlighted with a `subtle` band; rows further from center are depth-styled (smaller + dimmer). Reads/writes the friendly `"7:00 AM"` string. |

Both use `Modal` (not absolute-positioned overlays) so they're not
clipped by `Screen`'s outer `ScrollView`. The cross-platform Modal
backdrop dismisses on outside-press.

`app/create-event.tsx` now uses these in place of the three TextInputs
for Date / Start / End. Title, description, location, capacity stepper,
tag chips, visibility, and the save-draft / publish CTAs are
unchanged.

### 10.3 Host-only edit sheet + new create-event entry points

`components/EditEventSheet.tsx` (new — ported from the legacy
`EditEventSheet` in `legacy/src/heuristic-fixes.jsx:174`) is a
bottom-sheet `Modal` that lets the host edit title / when / where /
capacity. On SAVE CHANGES it calls
`useStore.applyEventOverride(id, patch)` (the slice that replaced the
legacy `window.SC_EVENT_OVERRIDES` global) and emits the legacy
"Saved · attendees notified of changes" success toast. Before this,
the EDIT EVENT button on `app/event/[id].tsx` toggled a local
`editOpen` state but no modal consumed it — the button was effectively
dead.

CANCEL EVENT was already wired (it uses the existing `showConfirm`
flow and emits a `cancelled · attendees notified` info toast), so no
changes were needed there.

The migration's earlier audit also showed that the only create-event
entry points outside Profile / Drafts / My-Hosting were on the
Profile tab. Two new ones land in this pass, both routing to
`/create-event`:

- **Home tab** — `+` button placed next to the existing Search button
  in the top-right of the header. Accessibility label
  `"Create a new event"`.
- **Map tab** — `+` button anchored to the top-right of the Map
  header, mirroring `legacy/src/screens.jsx:609`. Same a11y label.

### 10.4 What this section deliberately does NOT do

- Touch native font loading. `expo-font` + bundled `.ttf`s is the
  right answer on iOS/Android; web parity ships first because that's
  where the design gap was visible.
- Move palette tokens out of hardcoded color in `+html.tsx`. The
  body-background value is bound to the *default* palette+mode by
  hand and won't follow a palette swap from the Zustand store — the
  inner React tree handles the visible chrome, so this only matters
  for the pre-hydration paint. A future palette-aware client-side
  effect that syncs `document.body.style.background` to
  `useStore.getState().palette` is the polish path if it becomes a
  real concern.
- Touch the native picker dependency. `@react-native-community/
  datetimepicker` would give iOS/Android their platform-native
  spinner/calendar; the in-app pickers here render identically on
  both platforms and match the legacy design.
- Implement true event-cancel persistence. The legacy was also
  toast-only (no row deletion); a Phase 7-style backend wire-up
  (`cancel-event` Edge Function + `events.cancelled_at` column) is
  the natural follow-up and is out of scope here.

### 10.5 Verification

| Check | Result |
|---|---|
| Native test suite | ✅ 274/274, 36 suites, ~4.8s (+15 new tests on top of §9's 259) |
| Web SSR + client bundles still compile | ✅ |
| Google Fonts present in served HTML | ✅ confirmed via `curl http://localhost:8081/ \| grep -oE "Bricolage\|DM\+Sans\|JetBrains"` |
| `#ECE3D2` / `#F8E3CC` / `#F4D8C3` palette hex codes in served HTML body CSS | ✅ |
| `props.pointerEvents is deprecated` warning from our code | ✅ silenced (moved to `style.pointerEvents` in `ToastHost.tsx`, `SCTimePicker.tsx`) |
| EDIT EVENT button on hosted events opens the sheet + writes override + toasts | ✅ covered by `tests/screens/event-detail.test.tsx` and `tests/components/EditEventSheet.test.tsx` |
| Home + Map `+` buttons route to `/create-event` | ✅ covered by `tests/screens/{home,map-tab}.test.tsx` |

See `docs/TEST_PLAN.md` §2.8 for the per-file test additions that
landed alongside this work.

---

## 11. Supabase live wire-up (Home + Map, Auth bootstrap)

_Last updated: 2026-05-19 (commit c9de4bc)_

The frontend now actually talks to Supabase on two visible surfaces
(Home tab event rail + Map tab pins) and keeps the authenticated user's
profile in sync with the `profiles` table. The other 17 screens still
read from `data/mocks.ts` directly and are queued for the full
migration documented in the project plan.

### 11.1 Backend target swap (`.env`)

The previous `.env` pointed at a hosted Supabase project
(`kmlecodmifljbtzaqahm.supabase.co`); we swapped it to the local stack
started by `npx supabase start`:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

Both projects have the same 15-migration schema applied. The hosted
project is empty (no rows); the local project is pre-seeded by
`supabase/seed.sql` with five events centered on UCI (`Morning Ride`,
`Cooking Club: Dumpling Night`, `Climbing — Beginner Night`,
`Pickup Soccer @ Aldrich`, `Open Mic — Common Room`), 15 interests, and
the relations the `rank_events_query` PostGIS function needs. Studio
is at `http://127.0.0.1:54323`.

### 11.2 `AuthBootstrap` (new — `components/AuthBootstrap.tsx`)

Mounted once from `app/_layout.tsx`. Responsibilities:

1. On mount: calls `supabase.auth.getSession()`. supabase-js's
   `persistSession` is already wired through our SSR-safe `kvStorage`
   (§9), so a page reload re-hydrates from localStorage on web /
   AsyncStorage on native; this just reacts to it.
2. Subscribes to `onAuthStateChange`. On `INITIAL_SESSION` /
   `SIGNED_IN` / `TOKEN_REFRESHED` it fetches the `profiles` row and a
   joined `user_interests` row set, then writes both into the Zustand
   `me` slice via `setMe(patch)`. On `SIGNED_OUT` it resets `me` to
   the anonymous `SC_ME` placeholder so the rest of the app keeps
   rendering without crashing.
3. In mock mode (no Supabase env vars) the entire component is a
   no-op — short-circuits at `if (!supabase) return;`.

The `handle_new_user` trigger in migration `00002_create_profiles.sql`
auto-inserts a `profiles` skeleton row whenever a new `auth.users` row
appears, so sign-up needs no client-side bootstrap.

### 11.3 `useEvents` (new — `hooks/useEvents.ts`)

Thin data hook around `api.fetchEvents(lat, lng, radiusM)`. Returns
`{ events, loading, error, reload }`. Key design call:

> In mock mode it initializes `events` synchronously with `SC_EVENTS`
> via a `useState` initializer. Live mode starts empty + loading,
> resolves on the first microtask.

Why synchronous in mock: every existing screen integration test runs
under jest-expo without Supabase env vars, so `api.isMock()` is true
during tests. Without the synchronous init path, all existing Home
tab tests that assert event titles by name would have to switch to
`findByText` / `waitFor`. The synchronous init keeps them as-is.

### 11.4 Wired screens

| Screen | Before | After |
|---|---|---|
| `app/(tabs)/index.tsx` (Home) | Imported `SC_EVENTS` directly, sliced first 5 into the rail | Calls `useEvents()`. Empty-state card renders when `events.length === 0 && !loading` with a NEW EVENT button. People rail still reads `SC_VISIBLE_PEOPLE` from mocks (queued for full migration). |
| `app/(tabs)/map.tsx` (Map) | Imported `SC_EVENTS`, passed all to `<Map>` | Calls `useEvents({ lat, lng, radiusM })` so pins follow the discovery-radius chips and the user's resolved location. |
| `app/settings.tsx` (Settings) | `handleSignOut` toasted "Signed out (mock)" and pushed `/(tabs)` | Now awaits `api.signOut()` (clears Supabase session in live mode), then routes to `/auth/sign-in`. AuthBootstrap's listener resets `me` on the SIGNED_OUT event. |

### 11.5 What this section deliberately does NOT do

- Migrate the other 17 screens (`event/[id].tsx`, `chat/*`,
  `profile/*`, `attendees/[id]`, `events.tsx`, `search.tsx`,
  `interests/*`, `requests.tsx`, `my-*.tsx`, `(tabs)/profile.tsx`,
  `(tabs)/chat.tsx`, `new-chat.tsx`, `ratings/[hostId]`,
  `create-event.tsx` create-side, `event/[id]` join-side) through
  the API client. Each has its own migration story — events you
  fetch are live but everything else (chats, friends, attendees) is
  still mock fixtures.
- Add a hard auth gate that forces sign-in. The sign-in screen exists
  at `/auth/sign-in` and routes via `api.signIn()` → Supabase auth;
  unauthenticated users can still browse public events (RLS on the
  `events` table allows anonymous reads). Adding a hard redirect to
  `/auth/sign-in` is part of the full migration's first phase.
- Seed any extra test data. `supabase/seed.sql` already inserts five
  events; create-event UI can append more once you sign in.

### 11.6 Verification

| Check | Result |
|---|---|
| Local Supabase REST reachable | ✅ `curl -H "apikey: sb_publishable_AC…" "http://127.0.0.1:54321/rest/v1/events?select=id,title&limit=5"` returns the seeded rows |
| SSR + web bundles still compile after `.env` swap | ✅ |
| `npm test` | ✅ 279 / 279, 37 suites, ~4.5s (+2 over previous: new `useEvents` hook tests) |
| Sign-in / sign-up screens reachable | ✅ `/auth/sign-in`, `/auth/sign-up` — already wired to `api.signIn()` / `api.signUp()` |
| Settings → SIGN OUT triggers a real `supabase.auth.signOut()` | ✅ |

See `docs/TEST_PLAN.md` §2.9 for the test additions that landed
alongside this work.

---

## 12. Full migration — Phase 1: Hard auth gate + session hydration

_Last updated: 2026-05-19 (commit dd13452)_

Phase 1 of the 7-phase plan in
`C:\Users\david\.claude\plans\parsed-gliding-micali.md`. Builds the
auth surface every subsequent phase depends on: a hard gate that
forces sign-in for the `(tabs)` route group, plus expanded
`AuthBootstrap` hydration that loads the user's joined events +
friend graph + interest subscriptions from the matching tables.

### 12.1 What changed

| File | Change |
|---|---|
| `scenecheck-expo/store/useStore.ts` | Added `session: { userId: string; email: string \| null } \| null` slice + `setSession(...)`. `session` is the single source of truth that `AuthGate` reads to decide whether to redirect. Defaults to `null` (signed out). |
| `scenecheck-expo/components/AuthBootstrap.tsx` | Reworked. Now mirrors `onAuthStateChange` into `session`, and hydrates `joined`, `friends`, `outgoingRequests`, `incomingRequests`, `subscribedInterests` in parallel with the existing profile read. On `SIGNED_OUT` it resets `session=null` and clears every social Set back to empty. In mock mode it remains a no-op (no Supabase client). |
| `scenecheck-expo/components/AuthGate.tsx` (new) | Reads `session` from the store. When `!api.isMock() && !session` it returns `<Redirect href="/auth/sign-in" />` (expo-router 6). Otherwise it renders children. In mock mode it's a transparent pass-through — required so the 277 pre-Phase-1 tests don't need an auth fixture. |
| `scenecheck-expo/app/(tabs)/_layout.tsx` | Wraps the `<Tabs>` in `<AuthGate>`. The four tab routes (Home / Map / Chat / Profile) and everything they push to are now behind the gate. |
| `scenecheck-expo/app/auth/sign-in.tsx` | Dropped the "SKIP — EXPLORE AS GUEST" link. Sign-in is the only way into the tabs in live mode now. `SCIcon` import removed (no longer used). |
| `scenecheck-expo/tests/test-utils.tsx` | `resetStore` defaults to a stub signed-in `session`. Tests that need the signed-out branch pass `session: null` via `overrides`. |
| `scenecheck-expo/tests/screens/sign-in.test.tsx` | Replaced the "SKIP — EXPLORE AS GUEST replaces to /(tabs)" case with the inverse — "the guest-skip link is gone" — to lock in the removal. |

### 12.2 What the hydration queries do

All four reads fire in parallel from `AuthBootstrap.hydrate(userId,
email)`:

1. `profiles` — basic name / username / bio / visibility / avatar.
2. `user_interests` joined to `interests(name)` — populates both
   `me.interests` and the `subscribedInterests` Set.
3. `event_subscriptions` where `user_id = me AND status =
   'confirmed'` — populates `joined`. Waitlisted / removed /
   cancelled rows are intentionally excluded.
4. `friendships` where `from_id = me OR to_id = me` — split client-
   side into three Sets:
   - `friends` = accepted, key = the *other* user's id
   - `outgoingRequests` = pending where `from_id = me`, key = `to_id`
   - `incomingRequests` = pending where `to_id = me`, key = the
     row's `friendships.id` so the accept/decline UI has a stable
     handle (matches the legacy mocks).

### 12.3 What this section deliberately does NOT do

- Hydrate `following`. There's no `org_follows` (or equivalent)
  table in the schema yet. Adding one is its own migration; for now
  the `following` Set stays whatever the store has from mock mode.
  Phase 5 (Profiles + Social) will revisit if a table lands.
- Mock `@supabase/supabase-js` for AuthBootstrap. The component is
  a no-op in mock mode (the only mode Jest uses); the live-mode
  hydration path is exercised end-to-end in the dev server.
- Wire any of the 17 remaining screens to live data. That's Phase 2
  onward.

### 12.4 Verification

| Check | Result |
|---|---|
| `npm test` | ✅ 282 / 282, 38 suites, ~5s (+3 over Phase 0's 279) |
| SSR + web bundles compile cleanly with AuthGate in the tree | ✅ |
| Anonymous visitor hitting `localhost:8081` → redirected to `/auth/sign-in` | ✅ |
| Sign up with a fresh email → `handle_new_user` trigger creates the profile → `AuthBootstrap` loads it, lands on `/(tabs)` with `me.id` set to the new UUID | ✅ |
| Settings → SIGN OUT → returns to `/auth/sign-in`, store `session` is null, friend graph + joined Sets are cleared | ✅ |

See `docs/TEST_PLAN.md` §2.10 for the test additions.

---

## 13. Full migration — Phase 2: Event detail

_Last updated: 2026-05-19 (commit f7e2c50)_

Phase 2 of the 7-phase plan. Migrates the highest-traffic detail
screen — `app/event/[id].tsx` — and wires the host-side edit /
cancel flows + the join/leave optimistic-update path through real
Supabase mutations.

### 13.1 New API methods

| Method | Signature | DB effect |
|---|---|---|
| `api.cancelSubscription(eventId)` | `(id) → { ok: true }` | `update event_subscriptions set status='cancelled' where event_id = … and user_id = me`. Soft-delete so dispatch-notification can still find the row. |
| `api.updateEvent(eventId, patch)` | `(id, { title?, where?, cap?, desc? }) → patch` | `update events set …`. Maps the in-memory shape to DB columns: `where → location_name`, `cap → capacity`, `desc → description`. **`when` / `endTime` are intentionally NOT mapped** — they're friendly strings ("Sat May 9 · 7:00 AM") that need parsing back to ISO, which lands with a dedicated date+time editor in a later phase. The override layer still reflects the typed value locally. |
| `api.cancelEvent(eventId)` | `(id) → { ok: true }` | `update events set status='cancelled' where id = …`. `rank_events_query` filters on `status='published'`, so the event disappears from Home / Map / Search without losing the subscriber rows. |

All three short-circuit in mock mode (returning shaped responses
that match the live signature) so existing tests don't have to mock
the supabase client.

### 13.2 New hook

`hooks/useEvent.ts` — single-event wrapper around
`api.getEventById(id)`. Same shape as `useEvents` from Phase 0:

- Mock mode: `useState` initializer pulls from `SC_EVENT_BY_ID[id]`
  so the first render already has the event; existing event-detail
  tests don't need `findByText`.
- Live mode: starts with `event=null + loading=true`, populates
  after the promise resolves.
- Returns a `reload()` callback so the screen can force a re-fetch
  after a successful host edit.
- Handles `id === undefined` gracefully (Expo Router param-not-yet-
  resolved edge case).

### 13.3 `event/[id].tsx` wiring

- `SC_EVENT_BY_ID[id]` direct lookup replaced with `useEvent(id)`.
  The override layer (`s.eventOverrides[id]`) is unchanged — it
  still gets merged into the base event on render, so a host edit
  reflects instantly even before the API re-fetch lands.
- `handleToggleJoin` is now async. Optimistic local update first
  (schedulePendingLeave / joinEvent), then `await
  api.cancelSubscription(id)` or `api.subscribeToEvent(id, true)`.
  On API failure we roll the optimistic add back via
  `leaveEventStore(id)` and surface an error toast. The
  pendingLeave timer naturally undoes itself after 5s if the API
  call fails.
- `handleCancelEvent.onConfirm` now awaits `api.cancelEvent(id)`
  before navigating back. Error path stays on the screen with a
  toast.
- The `<EditEventSheet>` now receives an `onSaved` callback that
  invokes the hook's `reload()`. After save, the API has the truth,
  the override has the same shape, and the next mount fetches the
  fresh row.

### 13.4 `EditEventSheet.tsx` changes

- `handleSave` is now async: `await api.updateEvent(event.id,
  { title, where, cap })` → `applyEventOverride(...)` → emit toast
  → `onSaved?.()` → `onClose()`. Errors surface a toast and keep
  the sheet open.
- The button label switches to "SAVING…" + disables itself during
  the async call.
- New optional `onSaved` prop.

### 13.5 Tests

- `tests/hooks/useEvent.test.ts` (new, 3 cases) — mock-mode sync
  init, unknown-id returns null, undefined-id no-crash.
- `tests/components/EditEventSheet.test.tsx` — updated the SAVE
  CHANGES case to await microtasks (handleSave is now async). Also
  asserts that the new `onSaved` callback fires.
- `tests/screens/event-detail.test.tsx` — same microtask flush on
  the "saving the edit sheet writes an override" case.

### 13.6 Verification

| Check | Result |
|---|---|
| `npm test` | ✅ 291 / 291, 40 suites, ~20s (+3 over Phase 1's 288) |
| SSR + web bundles compile cleanly | ✅ |
| Live host edit → row in `public.events` reflects the new `title` / `location_name` / `capacity` | manually verifiable via Studio |
| Live JOIN EVENT inserts an `event_subscriptions` row, LEAVE flips it to `status='cancelled'` | manually verifiable via Studio |
| CANCEL EVENT flips `events.status='cancelled'`, event disappears from Home / Map after refresh | manually verifiable via Studio |

### 13.7 Out of scope (deferred to later phases)

- Editing the event's start / end time. Requires plumbing a real
  date+time editor (`SCDatePicker` + `SCTimePicker` from §10) into
  the `EditEventSheet` so we collect ISO timestamps the DB can
  store. Tracked for a follow-up — the field stays typeable today
  but doesn't reach the DB.
- A hosted "cancel-event" Edge Function. The current direct UPDATE
  is fine; an Edge Function makes sense once we want server-side
  fan-out (push notifications, group-chat cleanup), which is a
  Phase 6 / 7 concern.

---

## 14. Full migration — Phase 3: Events list, Search, My Hosting

_Last updated: 2026-05-19 (commit d3ba1c6)_

Phase 3 of the 7-phase plan. Smallest phase by code change: every
screen here was already filtering or mapping `SC_EVENTS` client-side,
so the migration is a one-import-and-one-call-site swap each.

### 14.1 What changed

| File | Change |
|---|---|
| `app/events.tsx` | `SC_EVENTS` → `useEvents()`. The filter (ALL / YOURS / FRIENDS / FOR YOU) and the count badges now read from `allEvents` instead of the static array. |
| `app/search.tsx` | Events tab: `SC_EVENTS` → `useEvents()`. People + orgs tabs stay on `SC_VISIBLE_PEOPLE` + `SC_ORGS` since those tables don't have hooks yet (Phase 5). |
| `app/my-hosting.tsx` | `SC_EVENTS.filter(e => e.hostId === 'me')` → `useEvents()` + filter on `e.kind === 'yours' \|\| e.hostId === meId`. The dual check makes the screen work for both mock string ids (`'me'`) AND live UUIDs (the new `me.id` from AuthBootstrap), since `transformEventRow` sets `kind === 'yours'` whenever `creator_id === currentUserId`. |

### 14.2 What this section deliberately does NOT do

- Add `searchEvents` or similar to `api.ts`. The filter logic is
  trivial (substring match on title / location / interests) and runs
  fine client-side over the event list the user has already loaded.
  A server-side `to_tsvector` search lands later if event volume
  grows past the point where client filtering is responsive.
- Migrate the people / orgs tabs of `search.tsx`. People come from
  the `profiles` table; orgs come from `profiles` with
  `account_type='org'`. Both need a new `api.searchProfiles` plus
  the privacy-aware RLS branch and are scheduled for Phase 5
  (Profiles + Social).
- Migrate the empty-state CTA on My Hosting. Already correct —
  routes to `/create-event` regardless of mode.

### 14.3 Verification

| Check | Result |
|---|---|
| `npm test` | ✅ 291 / 291, 40 suites, ~20s (unchanged from Phase 2) |
| `npm run web` HMR re-bundle of all three screens | ✅ |
| Live mode: create an event → it appears in `/events` filter ALL, in `/search?q=<title>`, and in `/my-hosting` | ✅ manually verifiable once you publish through the local-Supabase flow |
| Filter chips on `/events` still bin events correctly under their `kind` | ✅ same as before — pure client logic, unaffected by the swap |

### 14.4 What's NOT yet on Supabase as of Phase 3

Eleven screens still import `SC_*` directly. Phase queue:

- Phase 4 — Interests: `app/interests/index.tsx`, `app/interests/
  [tag].tsx`, the Create Event tag catalog.
- Phase 5 — Profiles + Social: `app/profile/[id].tsx`,
  `app/my-friends.tsx`, `app/my-following.tsx`, `app/requests.tsx`,
  `app/(tabs)/profile.tsx` (hosted-events count still hits mocks).
- Phase 6 — Chat: `app/(tabs)/chat.tsx`, `app/chat/[id].tsx`,
  `app/new-chat.tsx`.
- Phase 7 — Attendees + Ratings: `app/attendees/[id].tsx`,
  `app/ratings/[hostId].tsx`.

---

## 15. Full migration — Phase 4: Interests system

_Last updated: 2026-05-19 (commit d133773)_

Phase 4 of the 7-phase plan. Migrates the `interests/` screens and
the create-event tag catalog onto the live `public.interests` table.
Bonus: fixes a latent column-mapping bug in `api.searchInterests`.

### 15.1 What changed

| File | Change |
|---|---|
| `lib/api.ts` | `searchInterests` now transforms the DB result. The previous `data as Interest[]` cast was a bug — DB columns are `name` / `description` / `subscriber_count` / `similar_tags` but the in-memory type uses `tag` / `desc` / `others` / `similar`. Anything reading `.tag` on a live row would have seen `undefined`. Also added `api.getInterest(tagName)` returning `Interest \| null`. |
| `hooks/useInterests.ts` (new) | Wraps `api.searchInterests(query)`. Mock-mode `useState` initializer pulls from `SC_INTERESTS_SUGGESTED` and substring-filters synchronously, so existing screen tests keep working. Live mode hits the catalog and orders by `subscriber_count desc`. |
| `hooks/useInterest.ts` (new) | Wraps `api.getInterest(tag)`. Mock-mode sync init from `SC_INTERESTS_DETAILS[tag]`. Returns `null` for unknown tags. |
| `app/interests/index.tsx` | `SC_INTERESTS_SUGGESTED.filter(...)` → `useInterests(query)`. The screen's grouping + ADD/ADDED toggle is unchanged. |
| `app/interests/[tag].tsx` | `SC_INTERESTS_DETAILS[tag]` lookup → `useInterest(tag)`. Fallback for hand-typed tags ("A user-created interest tag.") stays so unknown tags still render. |
| `app/create-event.tsx` | The catalog union in `addableTags` now starts from `useInterests(tagQuery)` instead of `SC_INTERESTS_SUGGESTED` + `Object.keys(SC_INTERESTS_DETAILS)`. In live mode the search field now surfaces every row in `public.interests`, not just the 6 curated mocks. |

### 15.2 What this section deliberately does NOT do

- Wire `subscribeToInterest` from the UI. The Zustand store still
  owns `subscribedInterests`; the api method exists but the
  interests-screen ADD button only calls `toggleInterestSub` for
  now. Live persistence of the subscription set lands when we
  revisit profile sync in Phase 5.
- Add `api.unsubscribeFromInterest`. Same reason — the store
  toggle is local-only until Phase 5.
- Test the live-mode column transform in `searchInterests`. The
  jest-expo env doesn't have a Supabase client; the transform is
  verified manually via Studio queries (the columns + select
  string match the schema exactly).

### 15.3 Verification

| Check | Result |
|---|---|
| `npm test` | ✅ 296 / 296, 41 suites (+5 over Phase 3's 291) |
| `npm run web` HMR re-bundles clean | ✅ |
| Live mode `/interests` shows every row in `public.interests` (not just the 6 curated mocks) | manually verifiable once you sign in against the local stack |
| Live mode `/interests/cooking` shows the description + similar tags from the DB row | same |
| Live mode Create Event tag-search surfaces matches across the full catalog | same |

---

## 16. Full migration — Phase 5: Profiles + Social

_Last updated: 2026-05-19 (commit 8190d67)_

Phase 5 of the 7-phase plan. Biggest API delta so far — 4 new
methods on `lib/api.ts` + 3 new hooks — but the screen wiring is
mostly mechanical because the existing screens were already using
the Zustand friend graph as the source of truth.

### 16.1 New API methods (`lib/api.ts`)

| Method | DB effect | Notes |
|---|---|---|
| `fetchFriends()` | Two `select` queries on `friendships` joined to `profiles`, one for each direction (`from_id = me`, `to_id = me`), unioned client-side. | Mock returns the full `SC_VISIBLE_PEOPLE` array; the hook narrows by the Zustand `friends` Set. |
| `fetchFriendRequests()` | `select id, from_id, created_at from friendships where to_id = me and status = 'pending'` | Returns the legacy `FriendRequest` shape (`{ id, personId, when, note }`); the hook stitches in profile data via per-row `api.getProfile` calls. |
| `declineFriendRequest(id)` | `update friendships set status='declined' where id = …` | Soft-delete so dispatch-notification can still find the row. |
| `removeFriend(otherUserId)` | `delete from friendships where (from_id=me and to_id=other) or (from_id=other and to_id=me)` | Hard-delete; RLS allows either side to remove. |

### 16.2 New hooks (`hooks/`)

| Hook | Mock mode | Live mode |
|---|---|---|
| `useFriends()` | Filters `SC_VISIBLE_PEOPLE` by the Zustand `friends` Set; re-derives on Set change. | Calls `api.fetchFriends()`. Returns `reload()` for re-fetching after a remove. |
| `useFriendRequests()` | Filters `SC_FRIEND_REQUESTS` by `incomingRequests` Set + drops blocked senders. | `api.fetchFriendRequests()` → per-row `api.getProfile` to stitch in the requester's profile. Returns `reload()`. |
| `useProfile(id)` | Synchronous `SC_ACCOUNT_BY_ID[id]` lookup. | `api.getProfile(id)`. |

### 16.3 Screen wiring

- `app/my-friends.tsx` — `SC_VISIBLE_PEOPLE.filter(...)` → `useFriends()`. Unfriend is now optimistic: `removeFriendStore(id)` updates the Zustand Set immediately, then `await api.removeFriend(id)` commits, then `reload()` re-fetches. Errors surface via toast.
- `app/requests.tsx` — `useFriendRequests()` replaces the manual filter. Accept / decline both run the Zustand mutation first (so the row disappears), then await the api call, then `reload()`.
- `app/profile/[id].tsx` — `SC_ACCOUNT_BY_ID[id]` lookup → `useProfile(id)`. The `isVisible` gate still consults `SC_VISIBLE_PERSON_BY_ID` in mock mode; in live mode RLS already enforces visibility, so anything `useProfile` returns is implicitly visible.

### 16.4 Following — deliberately not migrated

`app/my-following.tsx` stays on the Zustand `following` Set + mock
data because the schema has no `org_follows` table. Adding one is
its own migration; out of scope for Phase 5 unless org-follow
becomes a priority.

### 16.5 Verification

| Check | Result |
|---|---|
| `npm test` | ✅ 301 / 301, 42 suites (+5 over Phase 4's 296) |
| `npm run web` HMR re-bundles clean | ✅ |
| Sign-in as A → send friend request to B → sign-in as B → B sees the row in `/requests`; ACCEPT updates `friendships.status='accepted'` in `public.friendships`; both `/my-friends` lists show the other | manually verifiable once you have two users locally |
| Unfriend in `/my-friends` → friendship row deleted from `public.friendships`; list updates instantly | same |

### 16.6 What this section deliberately does NOT do

- Live `api.subscribeToInterest` wiring. The interests ADD button
  still only toggles the Zustand `subscribedInterests` Set. Deferred
  to whenever we revisit profile preferences end-to-end.
- A `useProfileEvents(hostId)` hook for "events posted by this
  org". The profile screen still filters `SC_EVENTS` client-side;
  Phase 7 (Attendees + Ratings) will revisit if a dedicated
  endpoint becomes useful.
- Replace `SC_REVIEWS` on the profile screen with live ratings.
  That's Phase 7.

---

## 17. Full migration — Phase 6: Chat

_Last updated: 2026-05-19 (commit 73a4ae9)_

Phase 6 of the 7-phase plan. The only Realtime surface in the app:
new messages from other users flow in via a Supabase channel
subscription, deduped against the client's own optimistic inserts.

### 17.1 New API method

`api.createChat(memberIds, type, title?)` — inserts a `chats` row +
one `chat_members` row per participant (caller included). Returns
the new `{ id }` so the new-chat screen can `router.replace`
straight into the thread. In mock mode it returns the legacy
stable id pattern (`dm-<personId>` for 1-on-1, `group-<id1>-<id2>…`
for groups) so SC_THREADS lookups in the chat thread keep
working without a backend.

### 17.2 New hooks

| Hook | Mock mode | Live mode |
|---|---|---|
| `useChats()` | `SC_CHATS` synchronously. | `api.getChats()` join (`chats ⨝ chat_members ⨝ messages`). Returns `reload()`. |
| `useChatMessages(chatId)` | Initial = `SC_THREADS[chatId]` with stamped ids. `send()` mirrors the legacy 650ms timed optimistic flow so existing chat tests + the offline tweak still pass. | Initial = `api.getChatMessages(chatId)` mapped to the legacy `UIMessage` shape. Realtime subscription via `api.subscribeToChat` appends each `INSERT` payload, deduped by id against own echoes. `send()` adds optimistic with a `tmp-…` id, awaits `api.sendMessage`, swaps the id for the persisted UUID + stamps `status='sent'`. Failures stamp `status='failed'` for the existing retry CTA. |

### 17.3 Screen wiring

- `app/(tabs)/chat.tsx` — `SC_CHATS` → `useChats()`. Title fallback
  still consults `SC_ACCOUNT_BY_ID` / `SC_EVENT_BY_ID` in mock mode;
  in live mode the join already pulls everything we need.
- `app/chat/[id].tsx` — local `useState<UIMessage[]>` + manual
  setTimeout-driven send/retry → `useChatMessages(id)`. The
  `KeyboardAvoidingView` + composer markup is unchanged; only the
  data plumbing was swapped. The composer's onPress / onSubmitEditing
  now call `handleSend()` which wraps the hook's async `send()`
  with an error toast.
- `app/new-chat.tsx` — `SC_VISIBLE_PEOPLE` → `useFriends()`.
  Picker is now scoped to friends only (RLS-controlled friendships
  don't allow DMing strangers). `start()` is async — awaits
  `api.createChat(picked, type)` and replaces the route with the
  returned id. A "STARTING…" label disables the button during the
  call.

### 17.4 Realtime: what it does and how it's deduped

`api.subscribeToChat` opens a `postgres_changes` channel on the
`messages` table filtered by `chat_id`. Each `INSERT` payload's
`new` row is mapped through the same `transformRow` the initial
fetch uses, then appended to the hook's state — unless an entry
with that id is already present.

The dedupe matters for the caller's own messages: after
`api.sendMessage` resolves we swap the temp id for the persisted
UUID, so when the Realtime echo for that UUID arrives the
`prev.some(m => m.id === row.id)` check short-circuits the append.

### 17.5 Verification

| Check | Result |
|---|---|
| `npm test` | ✅ 306 / 306, 43 suites (+5 over Phase 5's 301) |
| `npm run web` HMR re-bundles clean; server returns 200 | ✅ |
| Sign-in as A → start a DM with friend B → message appears in `messages` row in `public.messages`; chat appears in `public.chats` + two `chat_members` rows | manually verifiable once you have two users |
| Sign-in as B in another browser tab → A's new message arrives within ~500ms via Realtime | same |

### 17.6 What this section deliberately does NOT do

- Realtime subscription on the chat *list* (Phase 6 only wires it
  in the thread). Adding new chats while the list is open requires
  the user to navigate or `reload()`. A future enhancement.
- Profile names on incoming "them" messages. Live-mode messages
  arrive with `who=''` (the realtime payload doesn't include the
  sender's profile). The screen handles empty `who` gracefully —
  the "X · Y" timestamp line only renders if `who` is set. A
  per-row profile lookup would be straightforward but is out of
  scope for this phase.
- Realtime publication migration. Local Supabase's
  `supabase_realtime` publication is configured by default for all
  public tables in recent CLI versions; if a future deployment
  removes that we'll need `ALTER PUBLICATION supabase_realtime ADD
  TABLE messages;` in a migration.

---

## 18. Full migration — Phase 7: Attendees + Ratings (migration complete)

_Last updated: 2026-05-19 (commit c867b5f)_

Phase 7 — final phase. Wires the last two screens still reading from
mock fixtures (`attendees/[id]` and `ratings/[hostId]`) through real
Supabase queries.

### 18.1 New API methods

| Method | DB shape | Notes |
|---|---|---|
| `api.fetchAttendees(eventId)` | `select profile:profiles!event_subscriptions_user_id_fkey(*) from event_subscriptions where event_id = … and status='confirmed'` | Returns the rows as `Account[]`. Mock mode returns `SC_VISIBLE_PEOPLE`. |
| `api.fetchRatings(hostId)` | `select event_id, user_id, stars, text, created_at, events!inner(creator_id) from ratings where events.creator_id = …` | The `ratings` table doesn't carry `host_id` directly — the host is `events.creator_id`. The `events!inner` embed both joins and filters. Result mapped to the legacy `Review` shape: composite key `${event_id}:${user_id}` as `id`, `stars → rating`, `created_at → when` (locale date string). |

### 18.2 New hooks

| Hook | Mock mode | Live mode |
|---|---|---|
| `useAttendees(eventId)` | `SC_VISIBLE_PEOPLE` synchronously. | `api.fetchAttendees(eventId)`. |
| `useRatings(hostId)` | `SC_REVIEWS.filter(r => r.hostId === hostId)` synchronously. | `api.fetchRatings(hostId)`. |

### 18.3 Screen wiring

- `app/attendees/[id].tsx` — `SC_EVENT_BY_ID[id]` → `useEvent(id)`;
  `SC_VISIBLE_PEOPLE` → `useAttendees(id)`. The "X of Y going"
  copy and per-row profile rendering are unchanged.
- `app/ratings/[hostId].tsx` — `SC_ACCOUNT_BY_ID[hostId]` →
  `useProfile(hostId)`; `SC_REVIEWS.filter(...)` →
  `useRatings(hostId)`. Star-filter chips + per-row event chip
  unchanged.

### 18.4 Migration complete

Every screen that originally imported from `data/mocks.ts` now
reads through a hook that hits Supabase in live mode and falls
through to a synchronous mock-mode initializer for tests + offline
demo. The exceptions documented along the way:

- `my-following.tsx` — no `org_follows` table in the schema, so the
  screen still reads the Zustand `following` Set + mock orgs. A
  follow-on migration would add the table.
- Profile screen's `SC_REVIEWS` lookup was never on the profile
  screen itself — the screen reads via `useRatings` through the
  separate `/ratings/[hostId]` route, which IS migrated.
- Avatar uploads still write to the Zustand `picture` slice (data
  URL in memory). A Supabase Storage migration is a separate piece
  of work documented in `docs/PROGRESS_SNAPSHOT.md` §7.

### 18.5 Verification

| Check | Result |
|---|---|
| `npm test` | ✅ 311 / 311, 44 suites (+5 over Phase 6's 306) |
| `npm run web` HMR re-bundles clean; server returns 200 | ✅ |
| Live mode: open the attendees screen on an event you joined → list reflects the `event_subscriptions` rows | manually verifiable |
| Live mode: rate an event via the existing `api.rateEvent` flow → row appears on `/ratings/<hostId>` | same |

### 18.6 What's next

Migration is done. Natural follow-on threads (not blocking):

- Real org-follow table + `useFollowing` hook (replaces the
  Zustand-only `following` Set on `my-following.tsx`).
- Supabase Storage for profile photos (replaces the in-memory
  data URL in `picture`).
- Realtime on the chat *list* so new conversations appear without
  a reload.
- An E2E layer (Playwright) so the live paths the per-hook tests
  intentionally skip get real-browser coverage.

---

## 19. Hosted Supabase swap + seeded data

_Last updated: 2026-05-19 (commit 51b44c3)_

After the 7-phase local migration was complete (§12–§18), `.env`
was swapped from the local stack back to the hosted Supabase
project so the end-to-end flow could be verified against the same
backend the team uses for demos. A new idempotent seed file was
added so the hosted DB can be (re-)populated from the Studio SQL
Editor without giving the agent direct production-DB credentials.

### 19.1 `.env` swap

```diff
- EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
+ EXPO_PUBLIC_SUPABASE_URL=https://kmlecodmifljbtzaqahm.supabase.co
+ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_rWC_j5c08XfhSz08bHl-hg_kPLrI0SO
```

The previous (local) values are preserved as a comment in the
file so the swap back is trivial.

### 19.2 `supabase/seed-hosted.sql` (new)

A copy of `supabase/seed.sql` with `ON CONFLICT (…) DO NOTHING`
appended to each `INSERT` statement. Safe to re-run; the script
is a no-op if the rows already exist.

Contents:

| Table | Rows | Notes |
|---|---|---|
| `interests` | 15 | `biking`, `cooking`, `golf`, `climbing`, `study`, `coffee`, `uci`, `informatics`, `group10`, `running`, `music`, `board-games`, `design`, `bouldering`, `yoga`. PK conflict on `id`. |
| `events` | 9 | PostGIS points centered on UCI (33.6461, -117.8427). All `creator_id=NULL` + `status='published'` so they're readable by every authenticated user via RLS but don't trigger the host-only EDIT/CANCEL UI on the detail screen. PK conflict on `id`. |
| `event_interests` | 15 | Maps the 9 events to relevant tags so the Map tab pin colors + interest-based ranking work. PK conflict on the composite `(event_id, interest_id)`. |

Deliberately NOT seeded:

- `profiles` — the `handle_new_user` trigger creates one per
  sign-up; static profile rows for "mock people" would fail the
  `auth.users` foreign key.
- `friendships`, `event_subscriptions`, `chats`, `chat_members`,
  `messages`, `ratings`, `user_interests`, `notifications` — all
  reference `profiles` (and through it `auth.users`). They have to
  come from real user activity once you sign up in the app.

### 19.3 How to apply (one-time, by the user)

The agent intentionally doesn't have credentials for the hosted
project (auto-mode classifier blocks direct REST hits to a prod
project). The user runs these steps:

1. Open the dashboard at
   <https://supabase.com/dashboard/project/kmlecodmifljbtzaqahm>.
2. Confirm migrations have been applied (Table Editor shows the
   expected tables — `events`, `interests`, `profiles`,
   `friendships`, `chats`, etc.). If not:
   ```
   npx supabase login
   npx supabase link --project-ref kmlecodmifljbtzaqahm
   npx supabase db push
   ```
3. SQL Editor → New query → paste contents of
   `supabase/seed-hosted.sql` → Run.
4. Sign up in the app at <http://localhost:8081> with a fresh
   email; the trigger creates the profile, `AuthBootstrap`
   hydrates the store, Home + Map tabs render the 9 events.

### 19.4 Why this isn't part of the test suite

The Jest run still talks to mock mode (`api.isMock()` is true
when env vars aren't set during test boot; jest-expo doesn't load
`.env`), so the 311/311 test count is unaffected by the swap. The
verification path is manual: sign in against hosted + click
through the screens.

### 19.5 To switch back to the local stack

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

(Both keys are kept in the `.env` file as comments precisely so
the swap is one-line in either direction.)

---

## 20. Hosted SMTP: Resend setup runbook

_Last updated: 2026-05-19 (commit 94d46ac)_

The hosted Supabase free tier ships a shared SMTP relay rate-
limited to ~2 emails per hour per project. That cap is fine for a
solo dev but breaks the moment a class of users tries to sign up.
The fix is to switch to a real ESP via Supabase's Custom SMTP
setting. Resend is free for the first 3,000 emails/month +
100/day, and supports a single verified sending domain on the free
tier — comfortably more than SceneCheck will use for a demo.

This section is the operational runbook. There is **no code change**
required to enable this — the entire path is configured in the
Supabase and Resend dashboards.

### 20.1 Why switch

| Symptom on the shared SMTP | Cause | Resolved by Custom SMTP |
|---|---|---|
| Sign-up "Account created" but no email arrives | Hourly cap of ~2/hr exhausted by earlier sign-up attempts | ✅ Resend free tier = 100/day |
| Confirmation emails land in Spam / Promotions | Generic `noreply@mail.supabase.io` sender has no reputation | ✅ Sending from your own verified domain |
| No way to customize the From / Reply-To address | Locked to Supabase's default sender | ✅ Free-form sender on the verified domain |
| Delivery logs are coarse | Supabase shows `email_sent` but no recipient-side delivery info | ✅ Resend Logs show open / delivered / bounced |

### 20.2 The runbook

#### Step 1 — Resend account (2 min)

1. <https://resend.com> → **Sign up**.
2. Verify the signup confirmation email.

#### Step 2 — Verify a sending domain (5–30 min)

Resend won't deliver to arbitrary addresses without a verified
domain. Two paths:

| Path | Use when | How |
|---|---|---|
| **A. Real domain** (recommended) | You have / can grab a domain. Cloudflare Registrar sells at cost (~$8/yr). Works for any recipient. | Resend → Domains → Add Domain → copy the SPF/DKIM (and optional DMARC) TXT records into your DNS registrar → click Verify. |
| **B. `onboarding@resend.dev`** | Testing only. Limitation: can only deliver to your own Resend account email. | Skip step 2 — use the built-in sender. |

#### Step 3 — API key (1 min)

1. Resend → **API Keys → Create API Key**.
2. Name: `supabase-scenecheck`.
3. Permission: `Sending access`.
4. Domain: pick the verified domain (or "All domains" for testing).
5. **Copy the `re_…` key now** — you won't see it again.

#### Step 4 — Wire into Supabase (2 min)

1. <https://supabase.com/dashboard/project/kmlecodmifljbtzaqahm/settings/auth>
2. **SMTP Settings** → toggle **Enable Custom SMTP** ON.
3. Fill in:

| Field | Value |
|---|---|
| Sender email | `auth@<verified-domain>` (Path A) or `onboarding@resend.dev` (Path B) |
| Sender name | `SceneCheck` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the `re_…` API key |
| Minimum interval | default (60s) |

4. **Save**.

#### Step 5 — Verify (3 min)

1. Resend → **Logs → Send test email** to yourself. Confirms key + domain.
2. In the app: sign out → sign up with a fresh email → confirmation arrives within seconds.
3. Watch **Supabase → Auth → Logs** for `email_sent` events.

#### Step 6 — Optional polish

- **Supabase → Auth → Email Templates → "Confirm signup"** — replace the default copy with SceneCheck-branded HTML. Keep `{{ .ConfirmationURL }}` as the link placeholder.
- **Supabase → Auth → Rate Limits** — the per-hour confirmation cap (default 4/hr) is now your bottleneck, not Supabase's shared SMTP. Raise if you expect a burst of sign-ups during the demo.

### 20.3 What this section deliberately does NOT do

- Touch any TypeScript / React Native code. The Supabase server-side
  email pipeline is fully separated from the app bundle; the
  `auth.signUp({ ..., options: { emailRedirectTo } })` call we ship
  already produces the right link format regardless of SMTP backend.
- Commit the API key. The Resend `re_…` key is a server-side
  credential that lives only in the Supabase dashboard; it's
  intentionally absent from the repo + `.env` (`.env` only carries
  the publishable client key).
- Migrate existing unconfirmed users. Anyone who signed up before
  the swap and never confirmed needs to either click the original
  link (still valid for 24h) or be deleted + re-sign-up. New
  sign-ups after the SMTP switch will receive the email via Resend
  immediately.

### 20.4 Common failures

| Symptom | Cause | Fix |
|---|---|---|
| Resend "Pending verification" forever | DNS not propagated | Check at <https://www.whatsmydns.net> — TXT records must be globally visible |
| `Domain is not verified` in Resend Logs | Sender email isn't on the verified domain | Use `something@<verified-domain>` exactly |
| Sign-up succeeds but no email arrives | Supabase cached the old SMTP | Toggle Enable Custom SMTP off → Save → on → Save |
| Email lands in Promotions/Spam | New domain has no reputation | Send a few legit messages, ask recipients to mark "Not spam"; DMARC alignment helps |
| `Rate limit exceeded` from Resend | Free tier 100/day cap | Wait or upgrade |

---

## 21. Email confirmation: the Resend pivot to no-confirmation

_Last updated: 2026-05-20 (commit 18916d1)_

This section records *why* SceneCheck ended up with email
confirmation turned off, after a detour through custom SMTP. It's
the kind of decision that looks arbitrary in the diff but had a
concrete chain of blockers behind it.

### 21.1 The chain of events

1. **Switched the dev server to the hosted Supabase project** (§19)
   so the team could verify against a shared backend. Hosted
   projects default to **"Confirm email" ON**.
2. **Sign-ups stopped completing** — the confirmation email never
   arrived. Root cause: the hosted free tier uses a *shared SMTP
   relay capped at ~2 emails/hour per project*. A few test sign-ups
   exhausted it and subsequent emails were silently dropped.
3. **Started implementing Resend** as a real ESP via Supabase's
   Custom SMTP setting (full runbook still in §20 for if we ever
   want it). Free tier is 3,000/month — plenty.
4. **Hit Resend's domain wall.** Resend (like every reputable ESP)
   refuses to send to arbitrary recipients without a
   **DNS-verified sending domain** — `onboarding@resend.dev` only
   delivers to your own Resend-account inbox. So a real domain was
   required for classmates / graders to receive confirmations.
5. **Hit a Cloudflare blocker on top of that.** The Resend
   "auto-configure DNS" path tries to OAuth into Cloudflare to
   write the records, and that login failed with an identity-
   provider mismatch ("the details for your user do not match the
   details for the identity provider"). Manual DNS entry was still
   possible, but now the cost was: buy a domain + fix a Cloudflare
   login + add DNS records + wait for propagation — all to gate
   sign-ups behind an email step that a course project doesn't
   actually need.

### 21.2 The decision

For a course project where the goal is a working demo, the
confirmation step is pure friction. We **turned off "Confirm
email"** in the Supabase dashboard (Authentication → Providers →
Email → Confirm email → off). Sign-up now returns a live session
immediately; the user lands in the app with no inbox round-trip.

Trade-off accepted: anyone can sign up with an unverified address.
For a production launch we'd revisit — either finish the Resend +
domain setup (§20 runbook is ready) or use a managed verification
provider. The code is structured so flipping confirmation back on
requires *zero code changes* (see §21.4).

### 21.3 What changed in the app

| File | Before | After |
|---|---|---|
| `components/ChangeEmailSheet.tsx` | Notice: "Supabase will email a confirmation link to both your current and new addresses…"; button `SEND CONFIRMATIONS`; toast "Confirmation sent to both your old and new email…" | Notice: "Your sign-in email changes right away…"; button `UPDATE EMAIL`; toast "Email updated." |
| `app/auth/sign-up.tsx` | Post-signup toast "Account created. Welcome!" | "Welcome to SceneCheck, &lt;first name&gt;!" straight into the tabs |
| `app/auth/sign-in.tsx` | Confirm-email banner + Resend button were live on every hosted sign-up | Same components, now **dormant** — only render when `signUp` returns no session, which doesn't happen with confirmation off |

### 21.4 Why the confirm-email scaffolding stays in the code

The `?confirmEmail` / `?confirmed` banner on sign-in, the inline +
banner Resend buttons, the `!hasSession` branch in sign-up, and
`api.resendConfirmation` are all **retained, not deleted**. They're
a defensive fallback: if "Confirm email" is ever re-enabled (going
to production, or pointing `.env` at a project that requires it),
the full confirmation UX comes back with no code change. Deleting
them would be a regression the moment confirmation matters again.

### 21.5 If a teammate needs to undo this (turn confirmation back on)

1. Supabase dashboard → Authentication → Providers → Email →
   **Confirm email → ON** → Save.
2. Make sure a working SMTP is configured (the §20 Resend runbook),
   or sign-ups will silently fail to deliver again.
3. No app code changes needed — the dormant scaffolding reactivates
   automatically because `signUp` will start returning a null
   session for unconfirmed users.

---

## 22. Map discovery range as a persisted preference (+ type/seed cleanup)

_Last updated: 2026-05-21 (commit 154d62c; §22.5 seed-date follow-up in dc79aa6)_

Three pieces in one pass: the Map tab's discovery-range control became a
real persisted preference, the long-standing PostgREST `tsc` errors were
cleared, and the social seed's "wire to your own account" block was
hardened against a foreign-key failure.

### 22.1 Discovery range now persists + syncs with Settings

`app/(tabs)/map.tsx` held its radius in local `useState` initialized to
a meters constant (`RADIUS_OPTIONS_M = [1600, 4828, 8047, 16093]`),
disconnected from `store.radius` (the miles value the Settings slider
reads/writes). The chips moved the visible circle but the value reset to
5 mi on every mount and nothing crossed a session boundary.

| Aspect | Before | After |
|---|---|---|
| Source of truth | local `useState` (meters) | `store.radius` (miles), persisted via the existing `partialize` allowlist |
| Sync with Settings | none — two independent values | one value; a chip tap is the same write the Settings slider makes |
| Presets | 1 / 3 / 5 / 10 mi (4, fixed row) | 1 / 3 / 5 / 10 / 25 / 50 mi (horizontally scrollable; top matches the slider's 50-mi ceiling) |
| Off-preset values | not representable | **Custom · N mi** button on its own row below the presets that deep-links to Settings |
| Units | radius *was* meters everywhere | `radiusM = radius * MILES_TO_METERS` converts only where `useEvents` / `<Map>` need meters |

The **Custom button** renders only when `radius` isn't one of the
presets — e.g. 7.5 mi, which the Settings slider can produce on its
0.5-mi step. It shows the live value (`CUSTOM · 7.5 MI`) with a gear
icon and routes to `/settings`, where the continuous slider gives finer
control than discrete chips can. Whole-mile values render bare;
fractional customs keep one decimal (`fmtMi`).

### 22.2 PostgREST nested-relation type errors resolved

§58 and §59 recorded 5 `tsc` errors as "pre-existing … flagged for a
separate cleanup." They came from supabase-js: with no generated
`Database` type it widens every embedded relation to an array, while
PostgREST returns a single object for a to-one embed. The inline
`.map((r: { … }) => …)` annotations described the runtime object and so
collided with the inferred array type.

Fix: declare the real shape at the query with the (non-deprecated)
`.overrideTypes<{ … }[], { merge: false }>()` and drop the now-redundant
`.map` annotations — in `components/AuthBootstrap.tsx` (the
`user_interests → interests(name)` embed) and `lib/api.ts`
(`fetchFriends` both directions, `fetchAttendees`). The 5th error was
`me.interests` (optional on `Account`) in
`tests/screens/create-event.test.tsx`, guarded with `?? []`.
`npx tsc --noEmit` is clean again.

### 22.3 Social seed FK hardening

`supabase/seed-hosted-social.sql`'s OPTIONAL "wire this graph to YOUR
own account" block inserted into `friendships` / `chat_members` keyed on
`auth.users.id`. Both columns are FKs to `profiles(user_id)`, so an
account with no `profiles` row (created before the `handle_new_user`
trigger, or via the dashboard's "Add user") failed with
`friendships_from_id_fkey … is not present in table profiles` — which
rolls back the whole script in the SQL Editor. The block now upserts the
`profiles` row first (`insert … select id, 'person' … on conflict do
nothing`) so it's self-sufficient. The seeded mock graph (all
`00000000-…` UUIDs) was never the cause — those profiles come from the
trigger firing on the seed's own `auth.users` inserts.

### 22.4 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean (the 5 errors from §58–§59 resolved) |
| `npm test` | ✅ 346 / 346, 49 suites, ~8.7s (+3 over §59's 343) |
| Map chips write `store.radius` + persist | ✅ `tests/screens/map-tab.test.tsx` asserts the store value updates on tap |
| Custom button shows the off-preset value + routes to `/settings` | ✅ same file |
| Radius survives reload | ✅ `radius` is already in the store's `partialize` allowlist (unchanged) |

See `docs/TEST_PLAN.md` §2.17 for the per-file test additions.

### 22.5 Seeded events were invisible — all dated in the past

A follow-up the same day: none of the seeded events showed on the Map
or Home feed even in live mode. Root cause was *not* the app — it was
the seed data. `rank_events_query` (the discovery RPC) filters
`AND e.start_at > now() - INTERVAL '2 hours'`, but every event in
`seed.sql` / `seed-hosted.sql` had a hardcoded `start_at` of
**2026-05-07 … 05-13**, all comfortably in the past by the time the
project was being demoed (2026-05-21). The rows existed; the RPC just
filtered all nine out.

Fix — both seed files now use **now()-relative** dates
(`now() + interval 'N days'`, spread across the next ~9 days) so the
demo events are always upcoming whenever the seed runs:

- `seed-hosted.sql` additionally swaps `ON CONFLICT (id) DO NOTHING` →
  `DO UPDATE SET start_at, end_at, status` so **re-running** un-stales
  events that were already inserted with the old fixed dates.
  `creator_id` is deliberately left out of the SET so the host
  reassignments in `seed-hosted-social.sql` (§19 / the social seed)
  survive the re-run.
- `seed.sql` (local stack, run against a fresh DB) keeps its plain
  INSERT — only the date literals changed.

Two related "not showing" reports were **by design**, not bugs, and are
called out here so they're not chased as regressions:

- **Seeded profiles** aren't in the People/Org search results because
  `app/search.tsx` still reads `SC_VISIBLE_PEOPLE` / `SC_ORGS` from
  `data/mocks.ts` (the search-to-live wiring is the open item in §7 #1).
  The seeded people *are* reachable in live mode by tapping an event's
  host (the social seed sets `creator_id` to mock hosts → host link →
  `profile/[id]` via the live `useProfile`).
- **Seeded chats/friendships** are RLS-scoped to `auth.uid()`. The
  seeded DM + group chat are between mock users, so your own account
  can't see them. Sign in **as** a mock user
  (`maya@scenecheck.dev` / `scenecheck123`) or run the OPTIONAL
  "wire to your own account" block at the bottom of
  `seed-hosted-social.sql` (now FK-safe per §22.3) to surface them for
  your account.

Also folded in here: the discovery-range **Custom button moved to its
own row below the preset chips** (was inline to the right) per a UX
follow-up.

---

## 23. Multi-account correctness pass

_Last updated: 2026-05-21 (commit dc79aa6)_

Five issues found while signing in as a seeded mock user (Maya) on the
hosted project to verify the social graph. Four were real bugs; one was
already done.

### 23.1 Profile photo leaked across accounts

The profile tab renders `picture ?? me.picture`, where the store-level
`picture` (a locally-picked data URL) and `orgPictures` are persisted to
AsyncStorage and were **never tied to a user**. Signing out and back in
as a different account kept the previous account's photo. `me.picture`
(the DB `avatar_url`) was hydrated correctly, but the stale local
override won.

Fix (`components/AuthBootstrap.tsx`): clear `picture` + `orgPictures`
(a) on `SIGNED_OUT` (`reset()`), and (b) at the top of `hydrate()` when
the incoming `userId` differs from the persisted `me.id`. Keying off the
persisted `me.id` is what makes this safe across reloads — a plain reload
(same id) keeps your photo; a different sign-in clears it. Each account
now falls back to its own `avatar_url` (initials when null).

### 23.2 You appeared in "people nearby"

The Home "PEOPLE NEARBY" rail and Search both render `SC_VISIBLE_PEOPLE`
unfiltered, so signed in as Maya (whose UUID maps to mock `p1` =
"Maya Chen") you saw yourself. New `lib/people.ts → excludeSelf(list,
meId)` drops the current user, matching on both the raw id and the
`toMockId(meId)` mapping (covers mock + live ids). Wired into
`app/(tabs)/index.tsx` and `app/search.tsx`. Unit-tested in
`tests/unit/people.test.ts`.

### 23.3 No row in the `profiles` table for your account

`profiles` rows are created by the SECURITY-DEFINER `handle_new_user`
trigger (migration 00002), which bypasses RLS — so there was never a
client-facing INSERT policy. An account created *before* that trigger
existed (or via the dashboard's "Add user") had an `auth.users` row but
**no `profiles` row**, and the client couldn't create one (RLS denies
INSERT with no matching policy). That's the same gap behind the earlier
`friendships_from_id_fkey` seed error (§22.3), and why a profile edit (an
UPDATE) silently matched zero rows.

Fix:
- `supabase/migrations/00016_profiles_self_insert.sql` — adds
  `INSERT … WITH CHECK (user_id = auth.uid())` so a user can create their
  own row.
- `components/AuthBootstrap.tsx` — when the sign-in profile read comes
  back empty, upserts a skeleton `{ user_id, account_type:'person',
  name }` (best-effort; needs the migration applied).
- `api.updateProfile` — now an **upsert** (was `.update().eq()`), so a
  save creates the row if missing instead of erroring on `.single()`.

⚠️ Migration 00016 must be applied to the hosted project (SQL Editor or
`supabase db push`) for the self-insert path to work.

### 23.4 Couldn't send friend requests to private profiles

Two problems stacked: (a) for a private account you're not friends with,
the profiles SELECT RLS (§00014) returns nothing, so `useProfile` yielded
null and `profile/[id].tsx` dead-ended at "Profile unavailable" — no
button to even try; and (b) the screen's friend action was **store-only**
(`api.sendFriendRequest` was defined but never called), so requests never
persisted in live mode.

Fix (`app/profile/[id].tsx`):
- When the full row isn't readable but the (mock) fallback identifies a
  **private** account, render a minimal request card — avatar + name +
  "This account is private" + **Send friend request** — with bio /
  interests / hosted events still hidden until they accept.
- The request now persists: `requestFriend()` does the optimistic store
  update **and** calls `api.sendFriendRequest(id)` in live mode. The
  friendships INSERT RLS (`from_id = auth.uid()`, any `to_id`) already
  permits requesting a private user, so no backend change is needed for
  the send itself.

Note: the private card's name/avatar come from the mock fixture
(`SC_ACCOUNT_BY_ID`), which is what the People/Search rows already use —
so it covers the reachable (seeded) private users today. A fully general
preview for arbitrary private accounts would want a `profile_card`
SECURITY-DEFINER RPC exposing only name/username/avatar; that's a
documented follow-up, not done here.

### 23.5 Hosting count — already dynamic

`app/(tabs)/profile.tsx` already computes the HOSTED stat from
`useHostedEvents(me.id).length` (commit 9f2b587), and `fetchEventsByHost`
passes the real UUID through `toUUID`. No change needed — it reads 0 only
until an event's `creator_id` points at the account, which the social
seed sets (re-run `seed-hosted-social.sql` if hosts show 0).

### 23.6 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 352 / 352, 50 suites (+6: people unit ×4, home self-filter, private-request) |
| Photo no longer carries across a sign-out/sign-in | ✅ AuthBootstrap clears `picture`/`orgPictures` on user change + sign-out |
| Self excluded from people nearby / search | ✅ `tests/unit/people.test.ts` + `home.test.tsx` |
| Private profile shows a Send-request card + persists | ✅ client tested in mock; live send via `api.sendFriendRequest` (needs hosted to verify) |
| `profiles` self-insert | ⚠️ code ready; **migration 00016 must be applied** to hosted |

See `docs/TEST_PLAN.md` §2.18 for the per-file test additions.

---

## 24. Create-event, map pins, attendees, interests display

_Last updated: 2026-05-21 (commit ced4ab8)_

Five issues from exercising the full create → discover → join → profile
loop on the hosted project.

### 24.1 Event publish was rejected by the Edge Function

`api.createEvent` invoked the `create-event` function with the raw
`DraftForm`, whose fields are display strings: `date: "Sat May 16"`,
`timeStart: "7:00 AM"`, `location: "Anteater Plaza"` (a name). The
function requires `start_at` (ISO), `end_at`, and `location: { lat, lng }`
(it builds a PostGIS point), plus DB-named `capacity` / `description` /
`min_subscribers` and interest **ids**. So `requireFields` /
`validateLocation` failed and publish 400'd — silently, because the error
toast was also hidden (§24.2).

Fix:
- New `lib/date-time.ts → friendlyToISO(date, time)` builds an ISO
  timestamp from the friendly strings (`parseDate` infers the year).
- `app/create-event.tsx` now reads `useLocation()` for the event point
  (UCI fallback), and `handlePublish` posts a structured payload
  (`start_at` / `end_at` / `location:{lat,lng}` / `location_name` /
  `capacity` / `min_subscribers` / `interests` names).
- `api.createEvent` resolves interest tag **names → ids** (`interests`
  table lookup) before invoking, so tags actually attach.
- `makeEmptyForm`'s default date is now `now()+2d` (was the hardcoded,
  already-past `"Sat May 16"`, which would publish straight into the
  rank_events_query past-filter).

⚠️ This makes the client send the shape the **existing** function expects
— no function change — but the `create-event` function must be deployed
to the hosted project for publish to succeed there.

### 24.2 Draft-save / publish toasts were invisible

`create-event` was registered with `presentation: 'modal'`. On native, a
modal route presents in a layer **above** the root `<ToastHost>` /
`<ConfirmDialog>` (rendered once in `app/_layout.tsx`), so every toast it
fired — "Saved to Drafts", publish errors — and the save-draft confirm
were hidden behind the modal. Switched the route to
`presentation: 'card'` (like the other stacked screens), so the overlays
sit above it. (`new-chat` is still a modal; same pattern if its toasts
ever need to show.)

### 24.3 Pins vanished from the full Map screen

A regression from §22's discovery-range change. `rank_events_query`'s
`p_radius` parameter is `INT`, but the full map computed
`radiusM = radius × 1609.34` — a float (e.g. 8046.7) — and passed it to
`fetchEvents` → the RPC. A non-integer arg makes PostgREST fail to
resolve the function, so the call errored and the map got zero events.
The Home preview still worked because it calls `useEvents()` with no
radius, falling back to the integer default `8047`. Fixed by rounding
`radiusM` in `app/(tabs)/map.tsx` and defensively in `api.fetchEvents`.
(The "see info before entering" ask is already served by the focused-pin
card — it just needed pins to render.)

### 24.4 Attendees preview is now real

Event detail hardcoded the preview to `SC_VISIBLE_PEOPLE.slice(0, 4)` and
showed the seeded `subscriber_count` as the going count. It now uses
`useAttendees(id)` (live: confirmed `event_subscriptions ⨝ profiles`;
mock: `SC_VISIBLE_PEOPLE`). The going count, the `n/cap` line, the
waitlist CTA, and the cancel-confirm copy all derive from that list, and
you're merged into it optimistically when you join (so it reflects your
RSVP before the next fetch). Empty events show "No one's joined yet".

### 24.5 Profile interests now reflect additions

The interests catalog screen toggles `subscribedInterests`, but the
profile tab (and create-event auto-fill) read `me.interests` — two
fields seeded from the same `user_interests` source that then diverged,
so adding an interest never showed on the profile. `toggleInterestSub`
now updates `me.interests` alongside the set. (DB persistence of the
toggle — `user_interests` insert/delete with name→id resolution — remains
a follow-up; the change shows immediately and persists locally, but a
live re-hydrate still reads the DB.)

### 24.6 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 356 / 356, 50 suites (+4: friendlyToISO ×2, interests-sync, dynamic-attendees) |
| Full map shows pins | ✅ radius rounded to INT; verified the RPC call resolves |
| Draft-save toast visible | ✅ create-event is now a card route |
| Attendee preview dynamic | ✅ `tests/screens/event-detail.test.tsx` asserts the count tracks the attendees list |
| Profile reflects added interests | ✅ `tests/unit/store.test.ts` |
| Publish | ⚠️ payload fixed client-side; **needs the create-event function deployed** to hosted to verify end-to-end |

See `docs/TEST_PLAN.md` §2.19 for the per-file test additions.

---

## 25. Create-event polish: location picker, stepper, default date, time-picker loop

_Last updated: 2026-05-21 (commit 86a0af4)_

Four create-event refinements from continued use.

### 25.1 Map location picker

The Location field was a name-only text input, and publish fell back to
the host's GPS for the event's coordinates — so you couldn't place an
event anywhere but where you stood. New `components/LocationPickerSheet.tsx`
is a bottom-sheet with the real interactive `<Map>` and a **fixed center
pin**: drag the map so the pin sits on the spot, and the map center
(reported via `onRegionChange`) becomes the event's `{lat,lng}`.

- `DraftForm` gained optional `lat` / `lng`; `create-event.tsx` shows a
  "Pin exact spot on map" button under the location name that opens the
  sheet and then reads "Pinned · lat, lng". Publish sends `form.lat/lng`
  when set, else the host's location.
- The sheet passes `initialCenter` (not `user`) to `<Map>`. The `user`
  prop drives a recenter effect on the web map that would fight every pan
  (an endless recenter loop); `initialCenter` seeds it once and lets the
  gesture move freely while the overlay pin marks the center.

### 25.2 Capacity stepper uses a minus

The capacity "decrease" button rendered an `x` (close) glyph. Added a
`minus` icon to `SCIcon` and used it, so − / + read as a proper stepper.

### 25.3 Default date is today

`makeEmptyForm` now defaults `date` to `fmtDate(new Date())` (the dynamic
current date) instead of a fixed offset. (Hosts should still pick a start
time later than "now", since `rank_events_query` filters out past events.)

### 25.4 Time-picker AM/PM infinite loop

Setting a time could spin forever flipping AM↔PM (repro: start 11 AM, then
nudging the end toward 12 PM). Root cause in `SCTimePicker`'s snap `Wheel`:
`handleSettle` (the `onMomentumScrollEnd` / `onScrollEndDrag` handler)
issued an **animated** `scrollTo` to snap the row — but an animated
programmatic scroll itself fires `onMomentumScrollEnd`, so the handler
re-ran, re-snapped, and re-emitted `onChange` indefinitely (amplified by
the `externalIdx` effect re-scrolling on each `onChange`).

Fix: a `programmatic` ref marks scrolls we initiate; the next settle event
is recognized as self-induced and skipped, breaking the loop. The
re-snap now also fires only when the wheel is actually off-row (a
no-movement `scrollTo` wouldn't emit the momentum-end that clears the
flag, which would otherwise swallow the user's next selection). The
tap-to-select path is unchanged, so the existing picker test still passes.

### 25.5 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 359 / 359, 51 suites (+3: LocationPickerSheet ×2, today-default) |
| Location picker returns the center coords | ✅ `tests/components/LocationPickerSheet.test.tsx` |
| New event defaults to today | ✅ `tests/screens/create-event.test.tsx` |
| Time-picker tap still emits onChange | ✅ existing `tests/components/SCTimePicker.test.tsx` (loop itself is scroll-driven — not reproducible in jsdom; verified on device) |

See `docs/TEST_PLAN.md` §2.20 for the per-file test additions.

---

## 26. Map pin colors aligned to the legend

_Last updated: 2026-05-21 (commit cc0f2e0)_

The map legend (Home + Map tab) lists four buckets — **Your events**
(`primary`), **Friends** (`accentFriend`), **Recommended** (`accentBlue`),
**Other** (`mapPinMute`) — but `components/Map/types.ts → pinColor`
didn't honor them by type. The friend branch read
`isRec ? accentFriend : mapPinMute`, so a friend's event you shared no
interest tag with rendered grey ("Other") instead of the "Friends"
colour.

`pinColor` now resolves the highest-priority bucket directly:

| Event | Colour | Legend |
|---|---|---|
| `kind === 'yours'` | `primary` | Your events |
| `kind === 'friend'` | `accentFriend` | Friends (now **always**, not gated on interests) |
| `kind === 'recommended'`, or any kind sharing one of your interests | `accentBlue` | Recommended |
| anything else (e.g. an `org` event with no shared interest) | `mapPinMute` | Other |

So every pin's colour now matches the legend swatch for its type, on both
the native and web maps (they share this resolver). `tests/unit/
map-types.test.ts` was updated: the friend case now asserts `accentFriend`
regardless of interest overlap, plus a new case covers the `mapPinMute`
("Other") bucket. 359/359.

Note: the event-detail screen's own accent still treats `org` as
`accentBlue` ("Recommended · app-created") unconditionally — it has no
"Other" concept — so an org event with no shared interest shows grey on
the map but blue in the detail header. Left as-is; the map legend is the
surface this fix targets.

---

## 27. Friend-request flow, map key, location search, message cleanup

_Last updated: 2026-05-21 (commit fd10912)_

### 27.1 Branch commit messages — `Co-Authored-By` removed

All commits on `map-discovery-range` were rewritten with
`git filter-branch --msg-filter` (a perl one-liner) to strip the
`Co-Authored-By:` trailer. New commits in this session omit it too, per
request. The branch is local/unpushed, so the history rewrite is safe;
new commit hashes resulted.

### 27.2 Map key stays visible when an event is selected

`app/(tabs)/map.tsx` previously swapped the legend out for the
focused-event card (`{focused ? card : key}`), so tapping a pin hid the
colour key. The "Key" card now renders **always**, with the focused-event
card stacked above it when a pin is selected — so pin colours stay
decodable while inspecting an event.

### 27.3 Friend request: one toast, and it persists

`api.sendFriendRequest` invoked the `send-friend-request` Edge Function;
when that wasn't deployed/working it threw, so the UI showed a "request
sent" toast (optimistic) **and** a "send failed" error. It now performs a
direct, idempotent insert into `friendships`
(`from_id = auth.uid()`, `status='pending'`, `onConflict ignoreDuplicates`)
— the INSERT RLS already permits requesting anyone (private included), so
no Edge Function is needed. `profile/[id].tsx`'s `requestFriend` is now
`async` and `await`s the call, showing exactly **one** toast (success XOR
error). (The notification fan-out the function did is dropped; persisting
the request is what the UI needs.)

### 27.4 Manage friend requests — both directions, reachable

The requests screen only showed incoming requests and was only linked
from Settings (and only for private accounts). It now has two sections:

- **Requests for you** — incoming, Accept / Decline (unchanged behaviour).
- **Sent by you** — outgoing requests, each with **Cancel** (drops the
  pending row via `api.removeFriend` + the new `cancelOutgoingRequest`
  store action).

New `hooks/useOutgoingRequests.ts` resolves the `outgoingRequests` ids to
profiles (mock fixtures / `api.getProfile` in live). The screen is now
reachable from a **Friend requests** row in the Profile tab's "My stuff"
(`N in · M sent`), not just Settings.

### 27.5 Location picker: search by name

`LocationPickerSheet` gained a search box: type a place or address, and
it geocodes via OpenStreetMap **Nominatim** (no API key, CORS-enabled,
works on web + native) and recenters the map on the result. Recentering
is done by remounting `<Map>` via a changing `key` (avoids the
`user`-prop recenter loop). Drag-to-pin still works; the center pin marks
the chosen point either way.

### 27.6 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 360 / 360, 51 suites (+1: outgoing-requests case) |
| Branch messages free of `Co-Authored-By` | ✅ `git log main..HEAD` shows none |
| Map key visible with an event focused | ✅ legend card is unconditional in `map.tsx` |
| One toast per friend request | ✅ `requestFriend` awaits a single path |
| Outgoing requests listed + cancelable | ✅ `tests/screens/requests.test.tsx` |
| Location search | ✅ wired (Nominatim is a network call — exercised on device, not under Jest) |

See `docs/TEST_PLAN.md` §2.22 for the per-file test additions.

---

## 28. Private-profile privacy gate + location search autocomplete

_Last updated: 2026-05-21 (commit 6fc7644)_

### 28.1 Private accounts no longer leak interests to non-friends

The other-profile screen only rendered the request-only card when
`useProfile` returned null. But that's a *live-RLS* artifact — in mock
mode (no RLS) the full profile (interests, bio, hosted events, message +
safety actions) rendered for everyone, and a private account viewed by a
non-friend showed all of it.

`app/profile/[id].tsx` now derives:

```ts
const privateLocked = isPrivate && !isFriend && !isSelf;
```

and renders the minimal request card whenever `privateLocked` — *before*
the full-profile branch — regardless of mock/live or whether the row was
readable. So a private account exposes only name + avatar + Send-request
to non-friends; the owner and accepted friends still see everything. This
is a client-side guarantee that backstops the `profiles` SELECT RLS
(migration 00014) in live mode and is the sole enforcement in mock mode.

`tests/screens/other-profile.test.tsx` updated: the full-profile render
tests use a public fixture (p1); a new test asserts a private non-friend
sees the card with **no** "Interests"/MESSAGE and can still send a
request, and another asserts a private *friend* sees the full profile.

### 28.2 Location picker: search autocomplete

The picker's search ran a single geocode on submit. It's now a live
**dropdown**: typing (≥3 chars, 350 ms debounce) queries OpenStreetMap
Nominatim for up to 5 matches and lists them under the search box;
tapping one recenters the map (remount via `key`) and drops the pin
there — so users don't have to know the exact place name. GO / submit
jumps to the top match. Drag-to-pin still works. A `skipNext` ref
prevents the dropdown reopening when selecting sets the input text.

### 28.3 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 361 / 361, 51 suites (+1: private-gate cases net) |
| Private non-friend sees no interests | ✅ `tests/screens/other-profile.test.tsx` |
| Private friend sees full profile | ✅ same file |
| Search autocomplete | ✅ wired (Nominatim is a network call — exercised on device, not under Jest) |

See `docs/TEST_PLAN.md` §2.23 for the per-file test additions.

---

## 29. Refine §28: private interests visible + location-biased search

_Last updated: 2026-05-21 (commit 9305632)_

Two adjustments to §28 after a follow-up.

### 29.1 Private accounts show their interests (and only their interests)

§28 hid everything from a non-friend. The intent is narrower: a private
account's **interests** are public; only bio / hosted events / ratings /
message + safety stay hidden until you're friends.

- New `api.getInterestsForUser(userId)` reads `user_interests` (RLS
  `USING (true)`, so readable for any account, private included) joined to
  `interests(name)`. New `hooks/useUserInterests(id)` wraps it
  (mock: `SC_ACCOUNT_BY_ID[id].interests`).
- `app/profile/[id].tsx` calls the hook and renders an **Interests**
  section in the private request card. The full profile now uses the same
  hook for its interests block too — which incidentally fixes interests
  never appearing in **live** mode (`getProfile` selects only the
  `profiles` row, so `person.interests` was always undefined there).

### 29.2 Location search is biased to the user

The Nominatim autocomplete previously searched globally, so matches were
"not accurate." It now sends a `viewbox` centred on the user's `coords`
(half-size `BIAS_BOX_DEG = 0.6°`, ~65 km) with `bounded=1`, so results are
restricted to the user's region. `coords` comes from `useLocation`, which
falls back to the default region (UCI) when no permission is granted — so
suggestions centre on the user, or the default when none.

### 29.3 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 361 / 361, 51 suites |
| Private non-friend sees interests, not bio/message | ✅ `tests/screens/other-profile.test.tsx` |
| Private friend still sees the full profile | ✅ same file |
| Search biased to the user / default | ✅ wired (Nominatim is a network call — exercised on device, not under Jest) |

See `docs/TEST_PLAN.md` §2.24.

---

## 30. Private bio visible, edit-bio, interest persistence

_Last updated: 2026-05-21 (commit 0730c6c)_

### 30.1 Private accounts also show their bio

Extending §29.1: a private account's **bio** is shown to non-friends too,
alongside interests. `app/profile/[id].tsx`'s private request card now
renders `subject.bio` (centred, under the name) when present; bio +
interests are the only things a non-friend sees, everything else stays
hidden until they accept.

Live note: the card's name / avatar / bio come from `subject`
(`person ?? fallback`). For a private non-friend in live mode the
`profiles` row is RLS-hidden, so `subject` is the mock fallback — which
covers the seeded/reachable accounts. A general live solution for
arbitrary private accounts (exposing name/avatar/bio publicly) still
wants a `profile_card` SECURITY-DEFINER RPC; interests already work
universally via the publicly-readable `user_interests` (§29.1).

### 30.2 Edit your bio

`components/EditProfileSheet.tsx` previously edited the display name only.
It now has a **Bio** field (multiline, 160-char cap). Save sends only the
changed columns through `api.updateProfile({ name?, bio? })` (an upsert —
`name`/`bio` are real `profiles` columns) and mirrors them into the `me`
slice, so the profile tab + your own card update instantly.

### 30.3 Interests persist across sessions

Toggling an interest was store-only. In mock mode that survives via
AsyncStorage, but in **live** mode AuthBootstrap re-hydrates interests
from `user_interests` on every launch, so changes reset.

New `api.setInterestSubscribed(tag, subscribed)`:
- resolves the tag → `interests.id` by name (`interests.name` is UNIQUE),
  creating the interest row for a brand-new custom tag (RLS allows any
  authenticated user to insert an interest);
- inserts (`upsert`, idempotent) or deletes the `user_interests` row for
  the current user (RLS scopes both to `auth.uid()`).

`app/interests/index.tsx` and `app/interests/[tag].tsx` now call it after
the optimistic store toggle (best-effort; a failure toasts). So a reload
re-hydrates the same set. Mock mode is a no-op (the store + AsyncStorage
already persist it).

### 30.4 Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 362 / 362, 51 suites (+1: edit-bio save) |
| Private non-friend sees bio + interests | ✅ `tests/screens/other-profile.test.tsx` |
| Bio edit saves into `me` | ✅ `tests/components/EditProfileSheet.test.tsx` |
| Interests persist (live) | ✅ wired via `api.setInterestSubscribed` (DB write — verified on the hosted project, not under Jest) |

See `docs/TEST_PLAN.md` §2.25.

---

## 31. Profiles row → Account mapping (fix undefined keys)

_Last updated: 2026-05-21 (commit cab3953; docs in 22c6c6a)_

A console warning — *"Each child in a list should have a unique key"* —
surfaced on the hosted backend. Root cause: the Supabase `profiles` table
keys on **`user_id`** (no `id` column) and stores `avatar_url` /
`visibility` / `account_type`, while the UI's `Account` uses `id` /
`picture` / `privacy` / `type`. `api.getProfile`, `fetchFriends`, and
`fetchAttendees` returned the raw row with a bare `as Account` cast — no
column mapping — so in **live** mode `Account.id` was `undefined`.

Symptoms (live only — mock fixtures already carry `id`, which is why
tests stayed green):
- every list keyed by `key={p.id}` (My friends, "Sent by you" requests,
  attendees, the event-detail going list) rendered `key={undefined}` →
  the unique-key warning;
- profile links navigated to `/profile/undefined`;
- the private-profile gate (`privateLocked`, which reads `person.privacy`)
  silently failed, so private profiles could render fully in live mode.

Fix: a single `transformProfileRow(row)` helper in `lib/api.ts` maps
`user_id → id`, `avatar_url → picture`, `visibility → privacy`,
`account_type → type` (plus name/username/bio/avg_rating), used by
`getProfile`, `fetchFriends`, and `fetchAttendees`. `npx tsc --noEmit`
clean; 362/362. (Verified end-to-end on the hosted project; the mapping
is a pure function but not yet unit-covered — it's module-local.)

---

## 32. Keyboard avoidance for text inputs

_Last updated: 2026-05-21 (commit a43edc4; docs in 22c6c6a)_

Typing in a text field could leave the input hidden behind the on-screen
keyboard. Now the form's bottom tracks the keyboard's top so the focused
field stays visible.

- **`components/Screen.tsx` (scroll mode)** is wrapped in
  `KeyboardAvoidingView` — `behavior="padding"` on iOS (shrinks the scroll
  area to the keyboard top); Android relies on Expo's default
  `softwareKeyboardLayoutMode: "resize"` (adjustResize), so no explicit
  behavior is needed there. Added `keyboardShouldPersistTaps="handled"` so
  buttons (e.g. PUBLISH / SAVE DRAFT) stay tappable with the keyboard up.
  This covers every scrollable form: create-event (the description text
  area), the auth screens, search, settings.
- **`hooks/useKeyboardHeight.ts`** (new) tracks the live keyboard height
  (0 when hidden; `Will*` events on iOS, `Did*` on Android; no-op on web).
- The **bottom-sheet modals** render in a `Modal` *outside* `Screen`, so
  `KeyboardAvoidingView`/adjustResize don't reach them. `EditProfileSheet`
  (bio) and `LocationPickerSheet` (place search) add
  `paddingBottom: keyboardHeight` to the sheet backdrop, seating the
  sheet's bottom edge at the keyboard's top.
- The **chat composer** (`app/chat/[id].tsx`) already used
  `KeyboardAvoidingView` — left unchanged; this work follows that pattern.

`npx tsc --noEmit` clean; 362/362. Keyboard/layout is runtime device
behavior Jest can't drive, so this is verified by the established pattern,
types, and the suite, and should be eyeballed on a device/emulator
(especially Android's adjustResize path).

See `docs/TEST_PLAN.md` §2.26–§2.27.

---

## 33. Keyboard avoidance — upper bound

_Last updated: 2026-05-21 (commit b37566d; docs in 552386b)_

Refines §32. The scrollable forms (via `Screen`'s `KeyboardAvoidingView`)
were already bounded by the ScrollView, but the **bottom-sheet modals**
lifted by the full keyboard height with no cap — so a tall sheet could
push its top *above* the top of the screen, hiding the header / fields.

Both sheets now clamp their card to
`maxHeight = windowHeight − insets.top − keyboardHeight − 8`
(via `useWindowDimensions` + `useSafeAreaInsets`), so the sheet's top can
never rise past the top safe area:

- **EditProfileSheet** — content wrapped in a `ScrollView`
  (`keyboardShouldPersistTaps="handled"`) so it scrolls within the clamp
  instead of overflowing off-screen.
- **LocationPickerSheet** — clamped, **and** the map shrinks from 260 → 130
  while the keyboard is open, so the search field, suggestions dropdown,
  and "Use this location" button all stay on-screen above the keyboard.

`tsc` clean; 362/362. (Keyboard layout is runtime device behavior Jest
can't drive — verified by reasoning + types + the suite; worth a look on a
small screen.)

---

## 34. Chat tab compose button

_Last updated: 2026-05-21 (commit 2899c01; docs in 552386b)_

The Chat tab (`app/(tabs)/chat.tsx`) had **no** create-chat affordance —
`app/new-chat.tsx` existed but nothing linked to it. Added an **edit-icon
compose button** in the header (top-right, ink fill) that routes to
`/new-chat`, mirroring the legacy `SCChatList` button
(`legacy/src/screens.jsx:2763`), plus an empty state ("Tap the compose
button above to start a chat with a friend").

The composer flow itself was already fully implemented: pick one friend
(DM) or several (group) → `api.createChat(ids, type)` inserts the
`chats` + `chat_members` rows → `router.replace('/chat/<id>')` to the
thread, with the same DM/group subtitle + CTA labels as legacy.

`tests/screens/chat-tab.test.tsx` gains a case asserting the button routes
to `/new-chat`. +1 → 363/363; `tsc` clean.

See `docs/TEST_PLAN.md` §2.28–§2.29.

---

## 35. Cleanup + de-mocking pass (deletion, identity, refresh, live data)

_Last updated: 2026-05-21 (commit 1327890)_

A six-part cleanup that finished the live-data migration and rounded out the
account lifecycle. Two decisions framed the work: account deletion = **reassign
content, then delete the row**; and live mode = **100% Supabase**, with `SC_*`
kept only as the mock/offline + test fixture (behind `isMock()`).

### 35.1 Account deletion — reassign, then delete the row

`supabase/migrations/00020_account_deletion_reassign.sql` seeds a fixed
`[deleted user]` placeholder profile (UUID `…00ff`; needs its own `auth.users`
row because `profiles.user_id` FKs `auth.users`) and adds a `SECURITY DEFINER`
RPC `reassign_then_delete_account(p_user)` that, in one transaction:
re-points `events.creator_id` → placeholder, re-points `ratings.user_id` →
placeholder (deleting any row that would collide on the `(event_id, user_id)`
PK first), then `DELETE`s the user's `profiles` row — whose cascades clear
`user_interests` / `friendships` / `chat_members` / `messages` /
`event_subscriptions` / `waitlist` / `blocks`. Execution is locked to
`service_role` (REVOKE from public/anon/authenticated) since it's a privileged,
parameterized delete.

The `delete-account` Edge Function (service role) now calls that RPC and then
`auth.admin.deleteUser(userId)` — safe once content is reassigned, and it frees
the email for re-registration (replaces the old email-tombstone approach).
Drafts are **local-only** (Zustand `drafts`, no DB table), so a new
`clearDrafts()` store action wipes them in `settings.tsx` right after
`api.deleteAccount()` succeeds.

### 35.2 Sign-up identity + stored email

`supabase/migrations/00019_profiles_identity_and_email.sql` adds a nullable
(non-unique) `profiles.email` and rewrites `handle_new_user` to populate, on
sign-up: `name` (from the `display_name` metadata `api.signUp` already stamps,
else the email prefix), a **unique** `username` (email local-part slug with a
numeric suffix on collision), and `email`. A backfill fills these for
pre-existing rows. The belt-and-suspenders client `profiles.update({name})` in
`api.signUp` is removed (the trigger is now authoritative — no more hydrate
race). `EditProfileSheet` gained a `username` field that sanitizes to the same
slug charset and maps a Postgres 23505 to "@name is already taken." Profile
SELECTs (`getProfile`, `fetchFriends`, `fetchAttendees`, the new search methods)
now list explicit columns via a shared `PROFILE_COLS` that **omits `email`**, so
it's stored for the owner but never shipped to other clients.

### 35.3 Pull-to-refresh + web refresh button

`components/Screen.tsx` gained an optional `onRefresh` prop: native gets a
`RefreshControl` on the ScrollView; web gets a small `rotate-ccw` button
top-right (RefreshControl pull-down is unreliable there). `reload()` was added
to the param-driven hooks (`useProfile`, `useHostedEvents`, `useRatings`,
`useAttendees`, `useUserInterests`) via the `reloadCounter` pattern, plus the
new `useSearch*` / `useFollowedOrgs`. Wired into Home, Search, Chat tab, the
other-profile, event detail, My-friends, Requests, and My-following.

### 35.4 De-mock — live mode reads only Supabase

New `lib/api.ts` methods: `searchPeople(query)` / `searchOrgs(query)` (query
`profiles` by `account_type` + name/username ilike; people exclude self and
private) and `getProfilesByIds(ids)`. `getChats` now embeds members (+ name) and
messages so a DM's title resolves to the **other member's name** and the last
message/time surface (it previously returned untransformed rows in live);
`fetchRatings` embeds the reviewer (name/avatar) and event title. New hooks
`useSearchPeople` / `useSearchOrgs` (mock-synchronous like `useInterests`) and
`useFollowedOrgs` (resolves the local `following` set via `getProfilesByIds`,
SC_* in mock with SC_ORGS-then-managed ordering preserved). Screens updated so
**every** `SC_*` read sits behind an `isMock()`/`mock` guard: `search.tsx`,
the Home people rail, `my-following.tsx`, the chat list + thread, `ratings/`,
`new-chat` (chips now resolve from the friend list), `profile/[id]`,
`event/[id]`. `seed-hosted-social.sql` adds the previously-missing fixtures
(p5 Priya, p6 Marco, orgC Common Room Coffee, orgD Anteater Run Club) so all
four orgs the UI shows actually exist in `profiles` — fixing the "4 orgs appear
but only 2 in the table" report. The `following` set + managed-account switching
stay local user-state (no follows table introduced).

### 35.5 Verification

`npx tsc --noEmit` clean. `npm test` → **377/377, 52 suites** (+12: searchPeople/
searchOrgs/getProfilesByIds mock shape in `api-mock.test.ts`, the delete-clears-
drafts case in `settings.test.tsx`, and a new `Screen.test.tsx` covering the
web refresh button + the no-button native/omitted paths). The live (hosted) path
needs migrations `00019`/`00020` applied + `seed-hosted-social.sql` re-run.

See `docs/TEST_PLAN.md` §2.30.

---

## 36. Interest-gated recommendations + incoming friend-request fixes

_Last updated: 2026-05-22 (commit 4cd7e47)_

Three reported issues, fixed together.

### 36.1 "Recommended" is interest-driven (per user)

Previously a scraped/app-discovered event (`source='scraped'` → `kind:'recommended'`)
was *always* highlighted as "Recommended", regardless of the viewer. The rule is
now: **an event is "Recommended" for you only when it shares at least one of your
subscribed interests** — a scraped event you have no interest in is "Other/Nearby".
Centralized in `lib/events.ts` `isRecommendedFor(event, meInterests)` and used in:
- `components/Map/types.ts` `pinColor` — dropped the `kind === 'recommended'`
  shortcut; blue ("Recommended") is now `isRecommendedFor` only.
- `app/events.tsx` — the "FOR YOU" filter / count / row label.
- `components/SCEventCard.tsx` — new `meInterests` prop; a scraped card reads
  "RECOMMENDED" (blue) when it matches, else "NEARBY" (muted). `app/(tabs)/index.tsx`
  passes `me.interests`.
- `app/event/[id].tsx` — the hero label/accent ("RECOMMENDED · APP-CREATED" only on
  a match, else "APP-CREATED").

(`transformEventRow` still sets `kind:'recommended'` for scraped events — that's the
intrinsic source marker; the *display* decision is now per-user.) Tests updated:
`map-types` (recommended needs a shared interest) and `SCEventCard` (match → RECOMMENDED,
no match → NEARBY).

### 36.2 Incoming friend requests weren't showing (live)

Root cause: the seeded incoming request comes from a **private** account (Jordan), and
the `profiles` SELECT policy (00014) hides a private non-friend's row. So
`api.getProfile(requester)` threw, and `useFriendRequests` resolved all requesters in a
single `Promise.all` with no per-item catch — one throw blanked the entire incoming list
(outgoing was fine because it already caught per item). Two-part fix:
- **Migration `00021`** — a `has_pending_request(a,b)` `SECURITY DEFINER` helper plus an
  additive permissive SELECT policy: a profile is readable when there's a *pending*
  friendship between the viewer and that profile (either direction). RLS policies are
  OR'd, so this only reveals a genuine pending counterparty (the block guard is kept).
  Fixes the same gap for outgoing requests to a private account too.
- `hooks/useFriendRequests.ts` — resolves each requester independently; a still-
  unresolvable profile falls back to a minimal placeholder so the request stays visible
  and actionable rather than dropping the whole list.

### 36.3 Friend-requests hint count was stale / inconsistent

The Profile-tab "Friend requests" row and the Settings "Follow requests" row read the
`incomingRequests`/`outgoingRequests` store-set sizes (a sign-in snapshot, and for
incoming a different source than the screen). They now derive their counts from the
same live hooks the `/requests` screen uses (`useFriendRequests` / `useOutgoingRequests`),
so the hint reflects the true current numbers and always matches that screen.

### 36.4 Verification

`npx tsc --noEmit` clean; `npm test` → **378/378, 52 suites** (+1: the SCEventCard
no-match "NEARBY" case). Live paths (the 00021 RLS, recommended-by-interest in live
mode) verified on the hosted project after applying the migration.

See `docs/TEST_PLAN.md` §2.31.

---

## 37. Fix: a friend showing twice (duplicate React key)

_Last updated: 2026-05-22 (commit 647a141)_

Signed in as one account, a friend rendered **twice** in the friends list and
React warned about two children with the same key (a profile UUID).

**Root cause.** `api.fetchFriends` builds the list by unioning two queries —
friendships where `from_id = me` (the friend is `to`) and where `to_id = me`
(the friend is `from`) — because PostgREST can't `UNION`. The friendships
`UNIQUE` constraint is on `(from_id, to_id)`, so the **mirror pair**
`(A→B)` and `(B→A)` are two distinct, allowed rows. A cross friend-request
(both sides requested each other) that then both get accepted leaves two
accepted rows, so the same friend comes back from **both** halves of the union
→ duplicate id. (`acceptFriendRequest` was innocent — it updates a single row;
the mirror gets created by `sendFriendRequest`, which only deduped on the exact
direction via `onConflict: 'from_id,to_id'`.)

**Fix (both in `lib/api.ts`).**
- `fetchFriends` dedupes the union by id (a `Map<id, Account>`), so an existing
  mirror pair no longer renders the friend twice.
- `sendFriendRequest` first checks for a pending/accepted friendship in
  **either** direction and returns a no-op if one exists — so a mirror row can't
  be created going forward.

Mock mode is unaffected (it returns `SC_VISIBLE_PEOPLE` and short-circuits
before the live insert), so the suite is unchanged at **378/378**, `tsc` clean.
The two mirror rows already in a hosted DB are now harmless (deduped on read);
an optional one-time `DELETE` can remove them if desired.

See `docs/TEST_PLAN.md` §2.32.

---

## 38. Search ALL filter + auto-selected filters, "Orgs" rename, avatars in Supabase

_Last updated: 2026-05-22 (commit 1c551d5)_

Four items from one round of feedback.

### 38.1 "Following" row → "Orgs"

The Profile-tab "MY STUFF" row labeled "Following" is renamed **"Orgs"** (it opens
`my-following`, your followed-orgs list). Label-only change in `app/(tabs)/profile.tsx`.

### 38.2 Auto-selected search filters

Opening Search can now pre-select a tab via a `?tab=` query param. `search.tsx`
reads it on mount (validated against the tab list). Wired:
- `my-following` "Browse orgs" → `/search?tab=orgs`.
- `my-friends` "Find people" + "Find more people" → `/search?tab=people`.

### 38.3 ALL search filter (combined feed)

`search.tsx` gained an **ALL** tab — now the default — that renders events,
people, and orgs in one scrolling feed (each block labeled), so you don't have
to switch filters to see everything. The EVENTS / PEOPLE / ORGS tabs still
narrow to one type. The row markup was factored into `renderEvent` /
`renderPerson` / `renderOrg` so both the ALL feed and the single-type tabs share it.

### 38.4 Profile photos stored in Supabase

Profile photos were kept only in the local Zustand store (a data URL), so they
never reached Supabase, didn't survive a reinstall / new device, and weren't
visible to others. Now:
- **Migration `00022`** creates a public `avatars` storage bucket with per-user
  RLS (objects keyed `<uid>/…`; public read; write/update/delete only within
  your own folder).
- `api.uploadAvatar(uri)` fetches the picked image's bytes (works for web
  data/blob URLs and native `file://` URIs), uploads to the bucket, and persists
  the public URL on `profiles.avatar_url`. `api.removeAvatar()` clears the column
  and best-effort deletes the objects. Mock mode echoes the local uri / no-ops.
- `app/(tabs)/profile.tsx` uploads on photo change (optimistic preview, reverts
  on failure) and writes `me.picture`; `AuthBootstrap` already hydrates
  `me.picture` from `avatar_url`, so the photo loads on every sign-in / device.

### 38.5 Verification

`npx tsc --noEmit` clean; `npm test` → **385/385, 52 suites** (+7: avatar mock
methods ×2, search ALL/`?tab=` ×3, the two nav-button cases). The live storage
upload + RLS are verified manually on the hosted project after applying `00022`
(pick a photo → it persists in the `avatars` bucket + `profiles.avatar_url` and
reloads after sign-out/in).

See `docs/TEST_PLAN.md` §2.33.

---

## 39. Cross-user chat delivery + dynamic "events attended"

_Last updated: 2026-05-22 (commit 1ccd35d)_

### 39.1 Messages now send (the root cause: RLS recursion)

Symptom: sending a message showed the failed-retry indicator and a "couldn't
send" toast reading `[object Object]`. The send was actually being **rejected**,
not just undelivered.

Root cause: `00011`'s `chat_members` SELECT policy sub-queries `chat_members`
inside its own `USING` clause:

```sql
USING (EXISTS (SELECT 1 FROM chat_members cm
               WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid()))
```

Evaluating it requires reading `chat_members`, which re-applies the same policy
→ Postgres aborts with *"infinite recursion detected in policy for relation
chat_members"*. The `chats` SELECT and `messages` SELECT/INSERT policies all
sub-query `chat_members`, so that recursion broke the chat list, message reads,
and message **sends** (the failing INSERT = the failed-retry indicator).

Fix (**migration `00023`**): a `SECURITY DEFINER` helper
`is_chat_member(chat_id, user_id)` that checks membership while bypassing RLS
(so it can't recurse), and the four chat policies (`chat_members`/`chats` SELECT,
`messages` SELECT/INSERT) rewritten to use it — same access semantics, no
recursion. Also, `api.sendMessage` now throws the real PostgREST message instead
of the raw object (no more `[object Object]`).

### 39.2 Delivery robustness (once sends work)

Two complementary improvements so the recipient reliably sees messages:

1. **Realtime auth.** RLS-scoped `postgres_changes` are only delivered to a
   Realtime socket carrying the subscriber's JWT. AuthBootstrap now calls
   `supabase.realtime.setAuth(session.access_token)` on session establish /
   `TOKEN_REFRESHED` (and `setAuth(null)` on sign-out).
2. **Refresh on open/return.** `useChatMessages` gained `reload()` (merges
   freshly-fetched rows with any still-pending optimistic ones), and the chat
   thread + chat tab re-fetch on focus — so the recipient sees the latest even
   if a realtime event was missed.

(For instant live delivery, migration `00012` — `ALTER PUBLICATION
supabase_realtime ADD TABLE messages` — must also be applied on the hosted
project.)

### 39.3 "Events attended" is dynamic

The Profile-tab ATTENDED stat showed a static `me.events_attended` field. It now
uses `joined.size` — the user's confirmed event subscriptions, which
AuthBootstrap hydrates from `event_subscriptions` (status='confirmed') in
Supabase and which updates as you join/leave. This matches how HOSTED and RATING
are already computed live.

### 39.4 Verification

`npx tsc --noEmit` clean; `npm test` → **385/385, 52 suites** (no new tests —
the chat fixes are RLS/realtime/focus behavior on the live path, exercised
manually on the hosted project; the attended count change is covered by the
existing profile-tab render test). Apply migration `00023` on the hosted
project, then: sign in as two users sharing a chat, send from one → it sends
(no more failed-retry) and appears for the other (live, and on reopening the
chat); the ATTENDED number reflects real confirmed subscriptions.

See `docs/TEST_PLAN.md` §2.34.

### 39.5 Follow-up: the profile "Message" button (commit ce09429)

After `00023` was applied, sending still failed when starting a chat from a
profile, with `invalid input syntax for type uuid: "dm-<uuid>"`. The
other-profile **Message** button (`app/profile/[id].tsx`) navigated to
`/chat/dm-${id}` — a fabricated, mock-style chat id — so in live mode that
non-UUID string was sent straight into the `messages` insert (`chat_id`). It now
calls `api.createChat([id], 'dm')` — which returns the real chat id from the
`create_chat` RPC in live mode (and the legacy `dm-<id>` stable id in mock) — and
routes to `/chat/<id>`, the same path `new-chat` uses. +1 regression test in
`other-profile.test.tsx` (MESSAGE → `createChat` → `/chat/dm-p1` in mock). 386/386.

---

## 40. Event join fixed (RPC, not Edge Function) + chat UI polish

_Last updated: 2026-05-22 (commit 36d88a9)_

### 40.1 Joining an event failed ("Failed to send a request to the Edge Function")

`api.subscribeToEvent` invoked the `subscribe-to-event` Edge Function, which
isn't deployed on the hosted project — so joining errored with "Failed to send a
request to the Edge Function" (unreachable) or "Edge Function returned a non-2xx
status code". The Edge Function only wrapped the `subscribe_to_event_atomic` RPC
(migration `00015`), so `subscribeToEvent` now calls that RPC **directly**:

```ts
const { data, error } = await sb.rpc('subscribe_to_event_atomic', {
  p_event_id: toUUID(eventId), p_user_id: user.id,
});
```

The RPC is `SECURITY DEFINER`, so it bypasses the INSERT-less
`event_subscriptions` RLS and does the capacity-check / waitlist / idempotency
in one advisory-locked statement, returning `confirmed | waitlisted | already`.
This is the same "use the RPC, drop the undeployed Edge Function" pattern as the
friend-request (direct insert) and create-chat (`create_chat` RPC) fixes.

### 40.2 Leaving an event didn't persist

`event_subscriptions` had only SELECT policies (`00011`), so
`api.cancelSubscription`'s direct `UPDATE … SET status='cancelled'` matched zero
rows under RLS — the event came back as joined on reload. Migration `00024` adds
own-row INSERT / UPDATE / DELETE policies (`user_id = auth.uid()`), so cancel
persists.

### 40.3 Chat UI polish

- `SCButton`'s `ghost` variant now draws a 1px border (`t.line`), so the profile
  **Message** action looks like a button instead of bare text.
- The chat composer's bottom padding is now `insets.bottom + 24` (was a flat
  `16`), so it clears the home indicator / screen edge instead of sitting
  cramped against it.

### 40.4 Verification

`npx tsc --noEmit` clean; `npm test` → **386/386, 52 suites** (no new tests — the
join change is a live-only RPC swap with the same mock-mode return shape, so the
existing api-mock + event-detail tests still cover the contract). Apply migration
`00024` on the hosted project (and confirm `00015` is applied) — then joining an
event confirms/waitlists without the Edge Function error, and leaving persists.

---

## 41. Compact event hero + other-profile stats + "joined events" list

_Last updated: 2026-05-22 (commits 36d88a9 hero/border, 9315610 profile/joined)_

### 41.1 Event-detail hero halved

The hero panel (`app/event/[id].tsx`) was `height: 240` with most of it empty —
now `120`. The back bar + the kind/label pill still fit; the title + detail card
move up.

### 41.2 Message button reads as a button

Following up on §40.3, the `SCButton` `ghost` border was bumped from `t.line`
(too faint) to `t.ink3`, so the profile **Message** action (and the other ghost
buttons — Sign out, Home) clearly read as tappable buttons.

### 41.3 Stats + "No bio" on other profiles

Other people's profiles (friends + public) now render the same **hosted /
attended / rating** stat row as your own profile tab (people previously had no
stat row — only orgs did). The bio block always renders now, showing
*"No bio yet."* (muted italic) when the person hasn't written one.

Attended is the one stat a viewer can't compute directly — `event_subscriptions`'
SELECT RLS only exposes your own rows. Migration `00025` adds an
`attended_count(p_user)` `SECURITY DEFINER` function that returns just the COUNT
of a user's confirmed subscriptions (no row detail), surfaced via
`api.getAttendedCount`.

### 41.4 "Events you've joined" list

There was no single place to see the events you've joined. The **ATTENDED** stat
on your profile tab is now tappable (rendered in the primary color) → a new
`app/my-events.tsx` screen (registered in `_layout` as a card route) that lists
them. Data: `api.fetchJoinedEvents()` (live: `event_subscriptions ⨝ events`
where status='confirmed') + `hooks/useJoinedEvents` (mock mode derives the list
from the local `joined` set + `SC_EVENTS`, so it's reactive to join/leave).

### 41.5 Verification

`npx tsc --noEmit` clean; `npm test` → **390/390, 53 suites** (+4: profile-tab
ATTENDED → `/my-events` navigation, and a new `my-events.test.tsx` covering the
list / tap-through / empty state). The other-profile attended count + the live
joined-events fetch are validated on the hosted project after applying migration
`00025` (and `00024` from §40).

See `docs/TEST_PLAN.md` §2.36.

---

## 42. Join/leave button state + linked event host

_Last updated: 2026-05-23 (commit 283e880)_

### 42.1 Join/joined button didn't reflect attendance (and rejoin failed)

The event-detail join/leave button is driven by the Zustand `joined` set
(`isJoined(id)`). Two bugs made it wrong in live mode:

1. **Id-space mismatch.** AuthBootstrap hydrated `joined` from raw
   `event_subscriptions.event_id` (UUIDs), but `transformEventRow` stamps every
   event id with `toMockId(row.id)` — so seeded events are `e1`…`e9` everywhere
   in the UI. `isJoined('e1')` therefore never matched the UUID in the set, and
   the button showed the wrong state for seeded events (and the Home/feed JOINED
   badge too). Fix: AuthBootstrap maps the joined ids through `toMockId`.
2. **Rejoin no-op.** `cancelSubscription` soft-deleted (`status='cancelled'`),
   but `subscribe_to_event_atomic` (00015) short-circuits to `'already'` when
   ANY subscription row exists — so after leaving, re-joining didn't re-confirm
   you. Fix: `cancelSubscription` now hard-`DELETE`s the row (own-row DELETE
   policy from `00024`; the `subscriber_count` trigger handles DELETE via
   `COALESCE(NEW.event_id, OLD.event_id)`). Re-joining then inserts a fresh
   confirmed row.

### 42.2 "Hosted by" shows the host + links to them

`transformEventRow` doesn't carry the host's name in live mode, so the row read
"Hosted by —". The event-detail screen now fetches the host via
`useProfile(baseEvent?.hostId)` and the "Hosted by" `DetailRow` shows their name
with a "View profile →" affordance, navigating to `/profile/<hostId>`.
App-created events (no creator) stay non-interactive.

### 42.3 Verification

`npx tsc --noEmit` clean; `npm test` → **390/390, 53 suites** (no new tests — the
`joined` id-mapping + cancel/rejoin are AuthBootstrap/RPC behavior on the live
path, and the host link is covered by the existing event-detail render tests).
Manual on the hosted project: join an event → button flips to JOINED and stays
on reload; leave → flips back; re-join works; "Hosted by" opens the host's
profile.

See `docs/TEST_PLAN.md` §2.37.

---

## 43. Chat list refresh, rejoin button, joined-icon colors, live conflict chip

_Last updated: 2026-05-23 (commit 4f058ad)_

### 43.1 Existing chats didn't show until you messaged the person

The Chat tab is part of the `(tabs)` group, so it **mounts** (and runs its
initial `useChats` fetch) at app start while you're on Home — i.e. unfocused.
The focus-refetch I'd added skipped the *first* focus, so the first time you
actually opened the tab it showed that stale app-start data and missed any chat
created since (e.g. one the other person started). Fix: the Chat tab now
`reload()`s on **every** focus (no skip).

### 43.2 Rejoin button/chip didn't flip

Leaving an event starts a 5s grace (`schedulePendingLeave`), and
`isJoined = joined.has(id) && !pendingLeave.has(id)`. `joinEvent` early-returned
when the id was still in `joined` (it is, during the grace) and so never cleared
`pendingLeave` — the "Joined" toast fired but the button stayed JOIN with no
chip. `joinEvent` now also removes the id from `pendingLeave`. +1 store test.

### 43.3 Joined-event icon colors

`app/my-events.tsx` drew every event icon in `accentBlue`. It now uses
`pinColor(event, tokens, meInterests)` — the same map/legend mapping — so the
icon is primary (yours) / accentFriend (friend) / accentBlue (recommended, i.e.
interest match) / mapPinMute (other).

### 43.4 Recommendation reacts to interest changes

This already worked: every recommendation surface (map `pinColor`, events-list
"FOR YOU" filter + label, `SCEventCard`, event detail) computes from
`isRecommendedFor(event, me.interests)` at render, and `toggleInterestSub`
keeps `me.interests` in sync — so adding/removing an interest reclassifies
events live. With 43.3 the joined-list icons recolor on interest change too.

### 43.5 Conflict chip in live mode

`findConflict` resolves the joined events' times via an id→event map;
`ConflictChip` only passed `SC_EVENT_BY_ID` (the seeded fixtures), so overlaps
with real (non-seeded) joined events were never detected in live. `ConflictChip`
now takes an optional `eventsById` prop; the events list and Home rail build it
from the live feed (and `SCEventCard` forwards it). Mock/back-compat default is
still `SC_EVENT_BY_ID`.

### 43.6 Verification

`npx tsc --noEmit` clean; `npm test` → **391/391, 53 suites** (+1: the store
re-join-clears-pendingLeave test). The chat-tab focus refetch + live conflict
lookup are exercised manually on the hosted project (focus refetch is a no-op in
the jest navigation mock; the conflict chip's mock path is covered by
`ConflictChip.test.tsx`). No new migrations.

See `docs/TEST_PLAN.md` §2.38.

---

## 44. Consistent event category, map "View location", past/upcoming, rating system

_Last updated: 2026-05-23 (shipped to main 2026-05-23)_

### 44.1 One source for color + label (eventCategory)

The label was derived from `event.kind` while the pin color was derived from
interest match — so they could disagree (a matching **org** event showed a blue
"Recommended" pin under an "ORG · POSTED" label; a matching scraped event vs not
was handled ad-hoc per screen). New `lib/events.eventCategory(event, meInterests)`
returns one bucket — `yours > friend > recommended (interest match) > other` —
and `EVENT_CATEGORY_LABEL` maps it to the label. `pinColor`, `SCEventCard`, the
events list, and the event-detail hero all use it, so color + label always match
and both recolor/relabel as interests change. +5 unit tests (`events.test.ts`).

**Live-mode root cause (the "NEARBY on home, RECOMMENDED on detail" bug):** the
home feed + map get events from the `rank_events_query` RPC, but a SETOF RPC's
result rows can't carry a PostgREST relation embed — so `event_interests` came
back empty and every live event classified as `other` (NEARBY). The detail page
uses `getEventById` (a direct table query that *does* embed the tags), so it
alone showed RECOMMENDED. `fetchEvents` now fetches the tags for the ranked event
ids in a follow-up query and merges them onto the rows before `transformEventRow`,
so the feed, map, and detail page agree.

### 44.2 "View location" centers the map on the event

Both Map impls computed `center = user ?? initialCenter`, so the you-are-here
location always won and `initialCenter` was ignored. Added a `centerOn` prop
that takes precedence (web pans imperatively via the existing `Recenter`; native
re-inits via a remount key). The event-detail location row now routes to
`/(tabs)/map?focus=<id>`; the Map tab consumes the param to select that event
(focused card) and center on it.

### 44.3 Joined events split past / upcoming

`transformEventRow` now carries `startAt` (raw ISO) on `SCEvent`; `app/my-events.tsx`
groups the list into **Upcoming** and **Past** sections by comparing `startAt`
to now (events without a start — mock fixtures — count as upcoming).

### 44.4 Event rating system

- **UI:** `components/RateEventSheet.tsx` — a bottom sheet with a 1–5 star picker
  + an optional review. A star button on the event-detail bottom CTA opens it
  (hidden on your own event).
- **API:** `api.rateEvent` now upserts directly into `ratings` (on the
  `(event_id, user_id)` PK) instead of calling the undeployed `rollup-rating`
  Edge Function. Migration `00026` adds the own-row UPDATE/DELETE policies so
  re-rating works (00011 only had SELECT + INSERT).
- **Link to host:** ratings carry `event_id`; `api.fetchRatings(hostId)` joins
  `ratings ⨝ events` on `events.creator_id`, so a rating automatically shows in
  the host's reviews list and their computed average (profile RATING stat). No
  separate avg column write needed — the profile computes the average live.

### 44.5 Verification

`npx tsc --noEmit` clean; `npm test` → **397/397, 54 suites** (+6: `events.test.ts`
category/recommend cases + the `rateEvent` mock). Live paths (centerOn on a real
device map, the ratings upsert) are verified on the hosted project after applying
migration `00026`.

See `docs/TEST_PLAN.md` §2.39.

---

## 45. Friend+recommended dual label, joined-list refresh, search colors, radius-driven feed

_Last updated: 2026-05-23 (shipped to main 2026-05-23)_

Follow-ups after the §44 category work, all reported from a live build.

### 45.1 A friend's event can ALSO be recommended

`eventCategory` is a single bucket and short-circuits on `friend`, so a
friend-hosted event that matched your interests stayed the friend colour with
only the "FRIEND HOSTING" label — the interest match was invisible. New
`lib/events.isAlsoRecommended(event, meInterests)` is true only for a `friend`
event that shares an interest (an `other` match is already its own
`recommended` category; your own event's recommendation is moot). When true, the
UI shows an extra **RECOMMENDED** badge alongside the friend label, keeping the
friend colour. Wired into `SCEventCard` (home), the events list, the search row,
and the event-detail hero. +3 unit tests.

### 45.2 "Events you've joined" refreshes on focus

The screen's live list comes from `api.fetchJoinedEvents()` and only fetched on
mount / when the `joined` set changed. Because it stays mounted under the nav
stack, joining or leaving an event elsewhere and navigating back left it stale
(the post-join server write also races the `joined`-triggered refetch). It now
`reload()`s on `useFocusEffect`, and hides events you're mid-leave on
(`pendingLeave`) so the list tracks the Join/Leave button immediately.

### 45.3 Search events colour by category

`app/search.tsx` rendered every event icon a fixed `accentBlue` and never passed
`meInterests`, so search never reflected recommendations and didn't react to
interest changes. The row now colours the icon via `pinColor(e, t, meInterests)`
and shows the category label + the `RECOMMENDED` badge, all derived from the live
interest set (a reactive store selector), so editing interests recolours search.

### 45.4 Discovery radius drives the home + search feed

Only the Map passed `radiusM` to `useEvents`; home and search called `useEvents()`
with no radius, so the persisted discovery-range slider didn't affect them. Both
now convert the store `radius` (miles → meters) and pass it, so changing the range
re-fetches the in-range events — and since recommendation is a client-side derive
over that list, the recommendations re-compute for exactly the events now in range
(the efficiency the user asked for: only in-radius events are ever classified).

### 45.5 Verification

`npx tsc --noEmit` clean; `npm test` → **400/400, 54 suites** (+3 `isAlsoRecommended`
cases). The live paths (radius refetch, friend+recommended on a real friend event,
search recolour) are verified on the hosted project. No new migrations.

See `docs/TEST_PLAN.md` §2.40.

---

## 46. Map focused-card chip + interests, loading skeletons, refresh indicator

_Last updated: 2026-05-23 (shipped to main 2026-05-23)_

### 46.1 Focused-event card: category chip + truncated interests

Selecting a map pin opened a focused card with only title/when/where. It now
leads with the same **category chip** the pins + legend use — a coloured dot +
`eventCategory` label (`pinColor`) and the `RECOMMENDED` badge
(`isAlsoRecommended`) — and lists the event's **interest tags** below, capped at
`MAX_FOCUSED_TAGS` (3) with a "+N" pill so the card height stays bounded.

### 46.2 Loading skeletons + gated empty states

New reusable primitives:
- `components/SCSkeleton.tsx` — a pulsing placeholder block, plus `SCListSkeleton`
  (N card rows) and `SCRailSkeleton` (horizontal event-card placeholders).
- `components/SCEmptyState.tsx` — a consistent icon + title + subtitle (+ optional
  action) "nothing came back" card.

Data screens now render `{loading && empty ? <skeleton> : empty ? <emptyState> :
<list>}`, so a still-fetching page shows a shape-matched skeleton and the empty
state shows **only after** the fetch returns nothing (it used to flash during the
live load because the empty check didn't consider `loading`). Wired into: home
(rail), events list, search, joined-events, chat, ratings, attendees. Mock mode
resolves synchronously (`loading` is false), so the fixtures/tests are unaffected.

### 46.3 Refresh indicator + rerun-all-queries

`Screen` now renders a spinning **"REFRESHING"** pill (top-centre, all platforms)
whenever a refresh is in flight — the native `RefreshControl` spinner is easy to
miss and web had no indicator at all. Refresh handlers re-run **all** of a page's
queries (e.g. profile reloads profile + hosted + reviews + interests; search
reloads events + people + orgs); the events list, map, and attendees screens that
had no refresh path now expose one (`useEvents`/`useAttendees` `reload`).

### 46.4 Verification

`npx tsc --noEmit` clean; `npm test` → **405/405, 55 suites** (+5: the new
`skeleton.test.tsx` covering `SCSkeleton`/`SCListSkeleton`/`SCRailSkeleton`/
`SCEmptyState`). The skeletons/refresh indicator only appear in live mode (or
mid-refresh), so they're verified on the hosted project. No new migrations.

See `docs/TEST_PLAN.md` §2.41.

---

## 47. Edit/delete reviews, bolder rate symbol, selected map pin

_Last updated: 2026-05-23 (shipped to main 2026-05-23)_

### 47.1 Edit / delete your own reviews

On a host's ratings screen, a review you wrote now shows a **"⋮"** button
(new `more` + `trash` icons in `SCIcon`) that opens an anchored dropdown:
- **Edit review** → reopens `RateEventSheet` seeded with your stars + text (new
  `initialStars`/`initialText` props; the sheet switches its copy to
  "EDIT/UPDATE RATING"). Submitting upserts over the existing `(event_id,
  user_id)` row.
- **Delete review** → a confirm dialog, then `api.deleteRating(eventId)` (new;
  deletes the caller's row — the own-row DELETE policy from migration `00026`),
  then reloads the list + host so the average recomputes.

"This is mine" is `api.toMockId(me.id) === r.reviewerId`: `me.id` is a raw UUID
in live mode / `'me'` in mock, and `reviewerId` is `toMockId(user_id)`, so
normalising `me.id` the same way matches in mock, live, and the seeded-self case.

### 47.2 Bolder rate-event symbol

The "rate this event" star on the event-detail CTA was a faint gold outline star
on a plain card and blended into the row. It's now a **filled gold button with a
dark star** (`backgroundColor: t.warn`, `color: t.ink`, size 22), so the review
affordance is unmistakable.

### 47.3 Selected map pin

Arriving at the map from an event's **View location** centered on the event but
left its pin looking unselected. New `Map` `selectedId` prop (fed `focused?.id`):
the matching pin renders **selected** — enlarged with a dark ring on web
(`CircleMarker` radius 13 + `t.ink` stroke), raised `zIndex` on native. Tapping
any pin sets `focused`, so a tap highlights it the same way.

### 47.4 Verification

`npx tsc --noEmit` clean; `npm test` → **406/406, 55 suites** (+1: `deleteRating`
mock). Live re-rating/deletion needs migration `00026` applied (already required
for re-rating); the selected-pin look + filled rate button are verified on the
hosted project.

See `docs/TEST_PLAN.md` §2.42.

---

## 48. Tappable reviewer, consistent follow count, EVENTS/HOSTED profile lists

_Last updated: 2026-05-23 (shipped to main 2026-05-23)_

### 48.1 Tap a reviewer to open their profile

On the ratings screen each review's avatar + name is now a `Pressable` →
`/profile/<reviewerId>` (the stars + "⋮" menu stay separate).

### 48.2 Followed-orgs count matches the list

The profile "Orgs" row showed `following.size` (the raw local set), but the
my-following screen lists only orgs that **resolve** via `getProfilesByIds` — so a
followed org that isn't in the live `profiles` table (e.g. a seeded demo org not
present in the hosted DB) was counted but never shown, giving "2" beside a 1-row
list. The profile count now derives from the same resolved list
(`useFollowedOrgs().orgs.length`), and `my-following` re-resolves on focus. The
`following` set is persisted locally (partialize/merge) as before — this aligns
the count with what's actually displayable rather than the raw id set.

### 48.3 EVENTS + HOSTED profile lists (Upcoming / Past)

- Renamed the profile **ATTENDED** stat tile to **EVENTS** (still → `/my-events`,
  the joined-events list).
- Made the **HOSTED** tile tappable → `/my-hosting`.
- `my-hosting` previously filtered the discovery feed (`useEvents`), which only
  returns published, in-range, **future** events — so past/cancelled events you
  hosted never appeared. It now uses `useHostedEvents` (→ `fetchEventsByHost`,
  all statuses/times) and splits into **Upcoming / Past** (current on top), with a
  loading skeleton + focus reload — mirroring the joined-events screen, which
  already split that way.

### 48.4 Verification

`npx tsc --noEmit` clean; `npm test` → **407/407, 55 suites** (+1: tapping the
HOSTED stat routes to `/my-hosting`; the ATTENDED→EVENTS rename updated in the
profile-tab test). No new migrations.

See `docs/TEST_PLAN.md` §2.43.

---

## 49. Dark-mode contrast fixes + darker review icon

_Last updated: 2026-05-23 (shipped to main 2026-05-23)_

### 49.1 Active-pill labels in dark mode

The "filled" toggle pills (settings palette selector, ratings star filters, events
filter chips, search tabs, map radius chips) fill the active option with `t.ink`
and drew its label in hardcoded `'white'`. In **dark mode** `ink` is near-white
(e.g. sunset `#F4ECDD`), so white text on it was invisible. The label now uses
`t.surface` — the mode-adaptive inverse of `ink` (near-white in light mode,
near-black in dark mode) — so the active option is legible in both. A token test
(`tests/unit/tokens.test.ts`) asserts `surface !== ink` for every palette/mode so
this can't regress.

Two more `'white'`-in-dark-mode fixes in the same pass: the **event-detail hero
chips** (the category label + RECOMMENDED pills) had a hardcoded `backgroundColor:
'white'` with `t.ink` text — invisible in dark mode (light ink on white). They now
use `backgroundColor: t.card`, which is white in light mode and dark in dark mode,
so the `t.ink` / `t.accentBlue` text stays legible over the colored hero in both.

### 49.2 Darker review (rate) icon + refresh icon

The event-detail rate button is a constant-gold (`warn`) fill; its star used
`t.ink`, which is dark in light mode but flips to near-white in dark mode — so the
icon washed out. New constant token **`warnInk` (`#1A1205`)** is the dark ink for
text/icons on a gold fill; the rate star uses it, staying dark in both modes.

The pull-to-refresh affordances (`Screen`'s "REFRESHING" pill icon + label and the
web refresh button) were `t.ink2` (muted) — bumped to `t.ink` so the refresh icon
is darker / more prominent in light mode (and still legible on the dark card in
dark mode).

### 49.3 Local Postgres version (config.toml)

Unrelated CLI warning: "Local database version differs from the linked project."
`supabase/config.toml` pinned `[db] major_version = 15` while the linked hosted
project runs a newer Postgres — set to **17** (the current Supabase default; match
whatever the CLI/dashboard reports). Affects only local `supabase start`, not the
hosted DB or migrations.

### 49.4 Verification

`npx tsc --noEmit` clean; `npm test` → **409/409, 56 suites** (+2 token invariants:
`warnInk` constant; `surface !== ink`). Color-only change — existing screen tests
(which assert text, not colour) are unaffected. No new migrations.

See `docs/TEST_PLAN.md` §2.44.

---

## 50. Scraper auth → new secret key + shared token

_Last updated: 2026-05-23 (shipped to main 2026-05-23)_

Supabase is deprecating the legacy `anon` / `service_role` JWT keys in favor of
`sb_publishable_…` / `sb_secret_…` (opaque, non-JWT). The FR6 scraper pipeline
relied on `service_role` being a JWT to pass `ingest-scraped`'s default
`verify_jwt` gate, so the new secret key would be rejected there.

**New design (decoupled from the key model):**
- `ingest-scraped` is deployed with `--no-verify-jwt` (the non-JWT secret key
  can't satisfy a JWT gate), and now **fails closed** on a shared secret: it
  401s unless the `x-ingest-token` header matches its `INGEST_TOKEN` function
  secret (`supabase secrets set INGEST_TOKEN=…`). That's the real auth, immune
  to the anon/service_role → publishable/secret migration.
- `scripts/scrape-events.mjs` sends the new secret key as `apikey` (project key
  for the gateway) + `x-ingest-token: INGEST_TOKEN`; it reads `SUPABASE_URL`,
  `SUPABASE_SECRET_KEY`, `INGEST_TOKEN`.
- `.github/workflows/scrape-events.yml` provides those three from repo secrets
  (`SUPABASE_SECRET_KEY` replaces `SUPABASE_SERVICE_ROLE_KEY`; add `INGEST_TOKEN`).
- The function's privileged insert still uses its **platform-injected** service
  key via `createAdminClient()` — unchanged; Supabase still injects it.

**Real scraper (replaces the stub).** `scrapeEvents()` now fetches Eventbrite's
public "events in Irvine" listing (`EVENTS_SOURCE_URL`, overridable) and parses
the schema.org **`ItemList` JSON-LD** it embeds — far more stable than DOM
scraping and dependency-free. It maps each Event to the ingest payload
(`title`←name, `start_at`/`end_at`←ISO-normalized dates, `location`←`geo`
lat/lng, `location_name`←venue, `description`→auto-tagging), skips events without
a valid title/start/geo (ingest requires lat/lng), dedupes Eventbrite's repeated
listings, and caps at `MAX_EVENTS` (40). A **`DRY_RUN=1`** mode scrapes + prints
the payloads without POSTing (and without needing credentials) for testing —
verified pulling 40 unique real Irvine events.

**Idempotent re-runs (dedupe).** Because the daily run re-sees the same source
events, `ingest-scraped` now skips inserting when a `source='scraped'` event with
the same `title` + `start_at` already exists (returns the existing id with
`deduped: true`), so repeated runs don't pile up duplicate rows. The scraper
counts these separately ("N new, M already present") and a steady-state run where
everything is already present is still a **success** (it only fails if *every*
ingest errored). Requires re-deploying the function.

**CI resilience + diagnostics.** The scraper uses a real browser User-Agent
(Eventbrite bot-blocks datacenter IPs) and, if the live source still returns
nothing, **falls back to seed events** (loudly logged) so the ingest path runs
regardless. It also prints exactly which stage failed (scrape vs every-ingest)
with the likely cause. The workflow runs a one-line **secrets sanity check**
first (fails fast with a clear message if `SUPABASE_URL` / `SUPABASE_SECRET_KEY`
/ `INGEST_TOKEN` is missing). _(During bring-up this step also printed secret
lengths + an empty-body function auth probe — `401` = INGEST_TOKEN mismatch / not
deployed `--no-verify-jwt`, `400` = auth OK, `404` = not deployed — handy to
re-add temporarily if the pipeline ever breaks.)_ Verified green in CI.

**Deploy fix.** `_shared/supabase-client.ts` imported supabase-js from
`https://esm.sh/@supabase/supabase-js@2`, which intermittently 522'd during
`supabase functions deploy` ("Import failed: 522"). Switched to Deno's native
`npm:@supabase/supabase-js@2` specifier (the current Supabase template form),
fixing bundling for every Edge Function.

CI-only change — no Jest/tsc surface, so the test count is unchanged (409/409).

---

## 51. Scraped events auto-create interests + fuzzy tag matching

_Last updated: 2026-05-24 (shipped to main 2026-05-24)_

FR6's auto-tagging (matching a scraped event's text to interest tags) was a
one-liner inside `ingest-scraped`: it lowercased the **description** only and
kept any interest whose `name` was a raw **substring** of it. Two gaps:

1. **Nothing matched → the event published with no tags at all** — so it never
   surfaced as "Recommended" for anyone and added nothing to the catalog.
2. The substring match both over- and under-fired: it ignored the **title**,
   and an interest named `art` matched the word "p**art**y"; meanwhile `bike`
   never matched an event that said "biking".

**New design — a pure, tested analyzer.** `supabase/functions/_shared/interest-matching.ts`
exposes `analyzeInterests(title, description, catalog)` returning
`{ matched, suggested }`, with the DB I/O kept in the function:

- **Match (whole-word, stemmed).** Both the event text and each interest's
  `name` + `similar_tags` are tokenized and reduced to a coarse morphological
  **stem key** (`bike`/`biking`/`bikes`/`biker` → `bik`; `run`/`running`/
  `runner`/`runs` → `run`). An interest matches when all of a term's stem keys
  appear in the text's. This is the **fuzziness that prevents duplicates**: a
  scraped "Sunday bike ride" reuses the existing `biking` interest, and
  "Spinning class" reuses it via the `spin` alias, instead of minting `bike` /
  `spinning`. Stemming is morphology-only, so distinct roots are never merged
  the way an edit-distance match would wrongly fuse `biking`/`hiking`.
- **Create on no-match.** When nothing matches, the most salient word (title
  preferred; highest **stem** frequency, then longer, then earliest; stop words
  / event-format filler / bare numbers excluded) is **singularized** for a clean
  label (`tacos` → `taco`) and returned as `suggested`. `ingest-scraped` then
  inserts it into `interests` (re-selecting on a UNIQUE conflict so a race is a
  no-op) and attaches it — so novel topics enter the catalog and the event is
  always labeled.

The function fetches `id, name, similar_tags`, runs the analyzer over
`title + description`, maps matched names → ids, or mints the derived interest,
then inserts the `event_interests` rows (all via the platform `createAdminClient`,
which bypasses RLS — though migration `00011` also lets any authenticated user
create interests).

Tested with **Deno** (`interest-matching.test.ts`, 14 cases via `deno test`):
name/alias matches, every inflected form of `bike`→`biking` and the run-family
→`running`, `Spinning`→`biking` via the alias, distinct roots staying separate,
multi-word/hyphenated phrases needing all their words, and the derive +
singularize path. Deno isn't on the Jest path, so the Jest count is unchanged
(409/409); during development the assertions were also run through Node's
type-stripping to confirm outputs. Requires re-deploying `ingest-scraped`.

---

## 52. Scraped-event source links + dark-mode refresh + bare auto-created tags

_Last updated: 2026-05-24 (shipped to main 2026-05-24)_

Three end-user polish items from review of the live scraped events, plus the
`source_url` plumbing they needed:

- **Source link in place of the host (scraped events).** A scraped event has no
  creator, so the detail card showed an inert "Hosted by App-created /
  Auto-discovered" row. New `events.source_url` (migration `00027`) carries the
  original listing URL: the scraper reads each event's schema.org **`url`** from
  the JSON-LD, `ingest-scraped` stores it, `transformEventRow` maps it to
  `SCEvent.sourceUrl`, and `app/event/[id].tsx` renders a **"View original
  listing →"** row (a `globe`-icon `DetailRow` that opens `Linking.openURL`)
  whenever `sourceUrl` is set — user-created events still show the host row.
  `getEventById` selects `*`, so the detail page gets the column; the home/map
  feed (the `rank_events_query` RPC) doesn't surface it, but it isn't needed
  there (no link on cards).
- **Refresh spinner now reads correctly in dark mode.** The native
  `RefreshControl` used `tintColor={t.ink3}` — a muted grey that washed out in
  both modes. It now uses the adaptive `t.ink` (`tintColor` for iOS, `colors`
  for the Android arrow, `progressBackgroundColor={t.card}` for its disc), so
  the pull spinner is near-black in light mode and near-white in dark. The web
  refresh button + the "REFRESHING" pill already used `t.ink`, so all refresh
  affordances are now consistent and mode-correct.
- **Auto-created interests are bare.** `ingest-scraped` previously stamped a
  `description` of `Auto-created from "<title>"` on a minted interest; it now
  inserts just the `name` (the column defaults to `''`), so a new interest reads
  cleanly with no provenance prefix.

Adds one screen test (a scraped event with `sourceUrl` shows the source link and
no host row, and tapping it calls `Linking.openURL`); the mock fixture `e4`
gained a `sourceUrl`. 410/410, `tsc` clean. **Live rollout order matters:** apply
migration `00027` first (the function writes `source_url`, so deploying before
the column exists would fail every insert), then redeploy `ingest-scraped`.

---

## 53. Auto-tag precision: stop-list, `unknown` fallback, trimmed aliases

_Last updated: 2026-05-24 (shipped to main 2026-05-24)_

The first live re-run with the fuzzy matcher (§51) produced no duplicate
interests, but the *quality* of the minted tags was mixed: commercial Eventbrite
listings with empty descriptions coined generic tags like `experience`, `orange`,
`lunch`, `show`, `professional`, and broad seed aliases over-matched (`uci` via
`irvine`, `music` via `live`, `biking` via `spin`/`running`). Three fixes:

- **Expanded stop-list.** `STOP_WORDS` in `interest-matching.ts` grew from ~80 to
  cover marketing/commercial filler (`experience`, `sale`, `launch`, `networking`,
  `conference`, `expo`, `mixer`, `showcase`, …), generic nouns (`business`,
  `professional`, `lunch`, `career`, `market`, …), and locale/time tokens
  (`orange`, `county`, `irvine`, `tustin`, season + weekday names). None of these
  can become a tag now.
- **`unknown` fallback.** Previously a text with no usable word returned `null`
  (untagged). `analyzeInterests` now returns the exported `UNKNOWN_TAG`
  (`'unknown'`) in that case, so a junk-only listing gets a single shared catch-all
  tag rather than a coined interest or no tag at all. `deriveTag` still returns
  `null` for empty input; the fallback lives in `analyzeInterests`.
- **Trimmed aliases.** Dropped `live` from `music` and `irvine` from `uci` in
  `seed.sql`, `seed-hosted.sql`, and `data/mocks.ts`. `music` still matches by its
  name; an Irvine event no longer auto-tags `uci`.

+2 Deno tests (`unknown` fallback; a real topic word surviving the bigger
stop-list). **Live rollout note:** matching fires against the **existing** catalog,
so the now-stop-worded junk interests (`experience`, `orange`, …) would keep
matching unless removed — the cleanup SQL therefore deletes the bare
(`description=''`, `subscriber_count=0`) auto-created interests and trims the two
aliases with `UPDATE`, then the scraper is re-run so legit tags are re-derived and
junk ones fall to `unknown`. (Known remaining broad aliases not trimmed here:
`biking`'s `running`/`spin`, `group10`'s `team`/`project` — left as-is unless asked.)

---

## 54. Scraper CI resilience + verified live re-tag

_Last updated: 2026-05-24 (shipped to main 2026-05-24)_

**Resilience.** `scripts/scrape-events.mjs` used to `throw` on a non-OK source
response and `exit(1)`, so when Eventbrite served the GitHub Actions runner a
`405` (it bot-blocks datacenter IPs intermittently — the same run had succeeded
days earlier) the whole workflow hard-failed. Now:

- `fetchSourceHtml()` retries the fetch `SCRAPE_RETRIES` times (default 3),
  rotating across three browser `User-Agent`s with linear backoff, and only
  throws after the last attempt.
- `main()` no longer `exit(1)`s on a scrape error — it logs loudly and falls
  through to the existing **seed-event fallback**, so the ingest path always
  runs (CI stays green even when the live source is blocked). The trade-off: a
  blocked run ingests the 3 seed events, not the live listings — re-run, or run
  from a non-datacenter IP, to get the real ones.

**Verified live re-tag (end-to-end).** With migration `00027` applied and
`ingest-scraped` redeployed with the tightened tagger (§53), the hosted catalog
was cleaned (deleted `source='scraped'` events + the bare auto-created interests,
`array_remove`'d the `live`/`irvine` aliases) and the scraper was re-run from a
non-datacenter IP. Result, confirmed by querying the hosted DB with the anon key:

- **40 / 40** events ingested, each with a **real per-event `source_url`**
  (so the detail screen's "View original listing" link works) and **≥1 tag**.
- `uci` no longer blanket-tags every Irvine event; `music` only lands on genuine
  music events; the junk tags (`experience`, `orange`, `lunch`, `show`,
  `professional`, `business`, `market`) are gone; the 7 speed-dating events all
  share a single `dating` interest. **No duplicate same-meaning interests.** The
  `unknown` fallback is deployed but didn't fire (every title had a usable word).

**Known precision gaps (deferred to later user testing — current state is "good
enough to refine"):** a handful of proper-noun / brand / filler tags still slip
through title-only parsing (`actually`, `jason`, `martin`, `thermomix`,
`networknite`, `spectrum`, `challenge`), and `biking` still over-matches via its
own `running`/`spin` aliases (only `live`/`irvine` were trimmed this pass, e.g.
"Blind Wine Tasting → biking"). Both are precision (not dedup) issues; candidate
fixes are adding those filler words to `STOP_WORDS` and trimming `biking`'s
aliases, on a future tightening pass.

Local-run note: secrets for a manual `node scripts/scrape-events.mjs` go in a
gitignored `scripts/.env.scrape` (`.gitignore` updated); it's a transient
credentials file — delete it after use (it lives under a synced folder).

---

## 55. Multiple derived tags per scraped event + share-to-friends

_Last updated: 2026-05-24 (shipped to main 2026-05-24)_

**(1) Scraped events can carry multiple *new* tags.** The matched-catalog path
was always uncapped — an event genuinely matching `yoga`, `bouldering`, and
`climbing` got all three. The gap was the *derive* path (when nothing matched):
it coined exactly one word. Now:

- `deriveTags(title, description, max = MAX_DERIVED_TAGS)` returns up to 3
  meaningful words, ranked by stem frequency (so inflected repeats reinforce a
  topic) then length then order, deduped by stem, and singularized. `deriveTag()`
  remains as a thin single-tag wrapper.
- `InterestAnalysis.suggested` changed from `string | null` to `string[]`
  (`[UNKNOWN_TAG]` when the text has no usable word; `[]` when the catalog
  matched and nothing new is minted).
- `ingest-scraped` now loops the suggested tags, creating/reusing each interest
  and attaching them all (deduping ids against the `event_interests` PK).
- The derive cap (3) keeps a wordy title from flooding the catalog; the matched
  path stays uncapped. e.g. "Pottery & Knitting" now mints both `pottery` +
  `knitting` instead of just one.

**(2) Share an event to friends.** New `components/ShareEventSheet.tsx` — a
bottom sheet that lists your friends (`useFriends`), lets you multi-select and
add an optional note, and sends the event into each friend's 1:1 DM by reusing
the existing chat plumbing: `api.createChat([friendId], 'dm')` (which dedupes to
an existing DM) + `api.sendMessage` with a body referencing the event
(`/event/<id>`). Best-effort per friend; a success toast reports the count. The
event-detail hero gained a `share` button beside the existing chat button (new
`share` glyph in `SCIcon`). No backend change — DMs + messages already exist in
both mock and live modes.

+2 tests (a scraped event with multiple derived topics; the share button opens
the sheet and sends to a friend). 411/411, `tsc` clean. Feature (1) requires an
`ingest-scraped` redeploy + a re-scrape to apply to already-ingested events;
feature (2) is client-side and ships with the next app build.

---

## 56. Curated common-word interests + safer `-er` stemming + true-contrast refresh

_Last updated: 2026-05-24 (shipped to main 2026-05-24)_

Three changes after a quality review of the multi-tag re-run:

- **Curated interests.** Added 7 common, descriptive interests to the seed —
  `career`, `dating`, `business`, `dentist`, `workshop`, `concert`, `conference`
  — each with aliases (`dentist`←`dentistry`/`dental`/`orthodontist`,
  `conference`←`summit`/`expo`/`convention`, …). Because the matcher
  short-circuits derivation when something matches, seeding these means a
  scraped "Career Fair" / "Speed Dating" / "Choir Concert" lands a stable,
  readable tag instead of a noisy derived word (`employer`, `speed`, `choir`)
  or `unknown`. This both restores good labels and reduces derive-noise. In
  `seed.sql` + `seed-hosted.sql` (mocks left as-is — these are live-catalog
  tags for the scraper, not offline fixtures).
- **Safer `-er` stemming.** Seeding `career` exposed a stemmer flaw: the `-er`
  strip + trailing-`e` drop reduced `career` → `car`, which then matched
  `care` / `cars` (so "Self-Care City Scavenger Hunt" wrongly tagged `career`).
  The `-er` strip is now gated to words **>6 chars**, so `career` stays
  `career` and `water` stays `water`, while longer derivations still collapse
  (`designer`→`design`, `teacher`→`teach`). Trade-off: short agentive forms
  (`biker`, `runner`) no longer fold into `biking`/`running` — the base forms
  still do, and this is a rarer case than the false matches it removes. (One
  residual: `dating`→`dat` still collides with `date`/`dates`; none of those
  appear in the current source set, and speed-dating events match `dating`
  correctly, so it's left as a known edge.)
- **True-contrast refresh icon.** `Screen.tsx` now colors the refresh button,
  the REFRESHING pill, and the native `RefreshControl` spinner **pure `#000` in
  light mode / `#FFF` in dark** (read from `useTheme().mode`) rather than the
  palette's tinted near-black/near-white `ink`.

411/411, `tsc` clean. The new interests require a hosted `INSERT` (idempotent on
the fixed UUIDs) + a delete/re-scrape to apply them to the already-ingested 40.

---

## 57. Title-first tag derivation

_Last updated: 2026-05-24 (shipped to main 2026-05-24)_

When a scraped event matches nothing in the catalog, `deriveTags` mints new
tags. It used to restrict candidates to the title (good) but **rank** them by
combined title+description stem frequency — so a word the description happened
to repeat could outrank, and even displace, the title's own lead words (e.g. for
"Pottery Sculpture Painting Drumming" with a description hammering "drumming",
the old ranking surfaced `drumming` and dropped `pottery`).

Now the title gets the emphasis the listing structure implies: when the title
has any usable word, the tags are taken **straight from the title in reading
order** (`takeByStem`), deduped by stem and singularized — the description is
ignored for selection. Only when the title yields no usable word do we fall back
to the **description, ranked by stem frequency** (then length, then order), so a
repeated topic word ("astronomy astronomy …") still wins there.

Catalog *matching* is unchanged and still runs first — a "Career Fair" still
matches the curated `career` interest (§56) rather than deriving. This only
changes which NEW tags are coined for un-matched events, and only their
selection/ordering — it's the "refine from the title" knob.

+1 Deno test (title order beats description frequency). Jest unchanged
(411/411), `tsc` clean. Applying it to the already-ingested events needs an
`ingest-scraped` redeploy + a delete/re-scrape.

---

## 58. More stop words + 17 curated interests + 2-word compound tags

_Last updated: 2026-05-24 (shipped to main 2026-05-24)_

Three quality knobs from continued review of the scraped tags:

- **Stop words.** Added `is`, `no`, `longer`, `optional` (`for` / `into` were
  already present) so "India Is No Longer Optional…" derives `india`, not the
  filler words.
- **17 curated interests.** Seeded `cafe`, `choir`, `church`, `fair`, `solar`,
  `free`, `digital`, `virtual`, `networking`, `wine`, `games`, `india`, `irvine`,
  `executives`, `health`, `medicine`, `acupuncture` (UUIDs 0023–0039, with
  aliases so variants match: `health`←`wellness`/`healthcare`,
  `church`←`worship`/`faith`, `medicine`←`medical`, `cafe`←`espresso`, …). Since
  catalog matching short-circuits derivation, these turn many previously-derived
  noisy tags into stable readable ones (e.g. a wellness retreat → `health`, an
  Irvine event → `irvine`, a worship service → `church`). `seed.sql` +
  `seed-hosted.sql`; the offline `data/mocks.ts` catalog is left as-is (these are
  live-scraper tags).
- **2-word compounds.** When deriving (no catalog match), the title is split into
  runs of consecutive candidate words (a stop word, comma, dash, slash, pipe, or
  "and" breaks a run); within a run the **first two words combine into one ≤2-word
  tag** so a related adjacent compound like `cold brew` / `natural medicine`
  becomes a single interest, while genuine lists stay separate. New
  `titleSegments` / `titleRuns` / `titlePhrases` / `takeTags` helpers.

+3 Deno tests; Jest unchanged (411/411); `tsc` clean. The new interests need a
hosted `INSERT` (idempotent on the fixed UUIDs) + a redeploy + re-scrape to apply
to already-ingested events. Heuristic note: the compound rule pairs *adjacent*
candidates, so it occasionally fuses a topic + format word (e.g. `beis warehouse`)
— a known "refine from there" edge.

---

## 59. Unknown-capacity scraped events: unlimited join + listing warning

_Last updated: 2026-05-24 (shipped to main 2026-05-24)_

A scraped listing rarely exposes a max-attendee number, so the scraper sends
`capacity: null` and `transformEventRow` yields `SCEvent.cap = 0`. The old event
detail rendered that as "N/0 going · waitlist" and the CTA flipped to JOIN
WAITLIST (since `goingCount >= 0` is always true) — wrong for an event that
should accept anyone.

`app/event/[id].tsx` now derives `capUnknown = e.cap <= 0` (only scraped events
hit this — a user event always has a real cap ≥ 2) and:

- the detail row shows **"N going · capacity unknown"** instead of `N/0` +
  waitlist;
- the CTA stays **JOIN EVENT** (the waitlist label is gated on
  `!capUnknown && goingCount >= e.cap`);
- joining shows an info toast — **"No listed capacity — check the original
  listing for details"** — with a **VIEW LISTING** action that opens the event's
  `sourceUrl` (the link added in §52).

No server change: `subscribe_to_event_atomic` (migration 00015) only waitlists
when `capacity IS NOT NULL AND count >= capacity`, so a null capacity already
confirms every join. Purely client-side — ships with the app build, no redeploy.
+1 screen test (override `e4.cap` to 0 → "capacity unknown", JOIN EVENT, and the
listing-warning toast on join). 412/412, `tsc` clean.

---

## 60. Multi-city scraping, listing capacity, and "/unk" display

_Last updated: 2026-05-26 (shipped to main 2026-05-26)_

**Multiple sources.** `scripts/scrape-events.mjs` scanned only Eventbrite's
Irvine listing. It now scans a `DEFAULT_SOURCES` list of **6 Orange County
cities** — Irvine, Santa Ana, Costa Mesa, Newport Beach, Anaheim, Huntington
Beach — overridable as a whole by a comma-separated **`EVENTS_SOURCE_URLS`** (the
legacy single `EVENTS_SOURCE_URL` still works). `scrapeOneSource(url)` scrapes
one listing (capped at `MAX_PER_SOURCE`, default `ceil(MAX_EVENTS / sources)` =
7), and `scrapeEvents()` **round-robin merges** across cities so the feed mixes
places instead of filling from whichever is listed first — de-duping cross-listed
events and capping at `MAX_EVENTS` (40). A source that bot-blocks (405) or changes
markup is logged and **skipped**; the others still contribute, and only an
all-sources failure falls through to the seed events. (Note: `EVENTS_SOURCE_URLS`
is read by the **Node scraper**, not the Expo app — an `EXPO_PUBLIC_*` var in
`scenecheck-expo/.env` has no effect on it, and the name is plural
`EVENTS_SOURCE_URLS`, not `EVENT_SOURCE_URLS`.)

**Listing capacity.** Each Event's schema.org **`maximumAttendeeCapacity`** is
now parsed; present + positive → the event's real `capacity`, else `null`.
Eventbrite usually omits it, so most scraped events stay capacity-unknown — but
any listing that publishes a max now gets a real cap that drives the normal
going/cap + waitlist behavior. `ingest-scraped` already forwards `body.capacity`,
so this needed **no function redeploy**.

**"/unk" display.** A capacity-unknown event (DB `capacity` null → `SCEvent.cap`
0) now renders **"/unk"** rather than "/0": the events feed shows `N/unk`
(`app/events.tsx`) and the event-detail capacity row shows `N/unk going`
(`app/event/[id].tsx`) — superseding §59's "N going · capacity unknown" label.
Joining stays unlimited and the original-listing warning toast (§59) is
unchanged. The §59 screen test was re-pointed from `capacity unknown` to
`/unk going`. 412/412; `tsc` clean. Scraper changes apply on the next re-scrape;
the UI ships with the app build.

---

## 61. Tag-quality pass: month/filler stop words + trimmed group10 aliases

_Last updated: 2026-05-26 (shipped to main 2026-05-26)_

The first multi-city live run (§60) re-surfaced the known derive-noise: `may`
appeared as a tag on 4 events (month names in titles like "May 29"), plus `one`
("turns One") and a few filler words. Separately, `group10`'s catalog alias
`project` matched an unrelated event ("The Alain Whyte Band" — its description
called the act a "side project").

Two fixes:

- **`STOP_WORDS` (analyzer).** Added all 12 month names + common abbreviations
  (`jan`…`dec`), number words (`one`/`two`/`three`), and the flagged filler
  `now`/`actually`/`learn`(`s`). These block **derivation only** — catalog
  **matching** (by name/alias stem) is a separate path and is unaffected, so the
  curated `fair`/`career`/`concert` matches still fire.
- **`group10` aliases.** Trimmed `similar_tags` from
  `['in4matx-43','team','project']` to `['in4matx-43']` in `seed.sql`,
  `seed-hosted.sql`, and `data/mocks.ts`. The generic `team`/`project` words
  matched unrelated listings; the specific `in4matx-43` tag still matches.

Verified with a Node 24 type-strip driver (months/`one`/`now`/`learn` no longer
derive; `side project` no longer matches `group10` while `IN4MATX-43` still
does). Jest 412/412, `tsc` clean. **Live effect needs**: `ingest-scraped`
redeploy (the analyzer is bundled into the function) + a hosted `UPDATE` on
`group10.similar_tags` + delete-junk-interests + re-scrape.

---

## 62. Round 3 code review + multi-agent fix sweep

_Last updated: 2026-05-27 (shipped to main 2026-05-27)_

A second full-stack audit of the working tree against the requirements +
architecture docs landed as `docs/CODE_REVIEW_REPORT_3.md`: **2 Critical
+ 10 High + 10 Medium + 18 Low**. The headline themes were UI affordances
that didn't persist (Block/Report toast-and-disappear), notifications
wired on neither end, doc drift, and no CI for lint/typecheck/tests.

The fixes shipped via **four worker agents in parallel** (file-disjoint
scopes — backend SQL+Edge Functions, app screens, app infrastructure,
scraper+CI+docs) plus a synthesis compliance agent that verified every
finding against the doc's prescribed Fix. Eight logical commits landed on
`main`:

**Backend (`supabase/`):**

- `00028_promote_waitlist_atomic.sql` — SECURITY DEFINER RPC with
  advisory lock, capacity re-check, FIFO promotion, waitlist delete,
  in-app notification insert in one transaction. `promote-waitlist`
  Edge Function gains the missing organizer-authorization check
  (verified caller == `events.creator_id`) before invoking it.
  Closes Critical C2 (broken access control).
- `00029_subscribe_event_status_check.sql` — `subscribe_to_event_atomic`
  now reads `events.status` under the lock and raises on non-published
  events, with idempotency preserved.
- `00030_profiles_birthdate_age_gate.sql` — adds `profiles.birthdate
  DATE`, `enforce_age_gate` BEFORE INSERT/UPDATE trigger raising on
  `age < 18`, and updates `handle_new_user` to read both `birthdate`
  and `account_type` from `raw_user_meta_data` (account_type read was
  added in the post-audit pass — see §63).
- `00031_ratings_server_gate.sql` — BEFORE INSERT trigger requiring
  confirmed attendance + `end_at < now()` + within-24h window.
- `00032_events_update_notify.sql` — AFTER UPDATE trigger inserting
  one in-app `notifications` row per confirmed subscriber when any
  user-visible event field changes. Guarded `source <> 'scraped'`
  so future UPSERT changes to the scraper can't spam subscribers.
- `00033_scraper_dedup_and_polish.sql` — partial unique index on
  `events(source_url) WHERE source='scraped'`, `create_chat`
  pre-validates `p_type`, and a `COMMENT ON TABLE tag_relations`
  documenting its intentionally-unread state.
- Edge Function updates: `create-event` now calls `check_publish_gate`
  via RPC (replacing the inline duplicate) and fire-and-forgets
  `dispatch-notification` for `event.published`. `organizer-remove`
  fire-and-forgets the `event.removed` dispatch.

**App screens (`scenecheck-expo/app/`):**

- `profile/[id].tsx` `handleBlock` now calls `useStore.blockUser` +
  `api.blockUser` with rollback on failure (Critical C1 — the dialog
  used to toast-then-back without persisting).
- `profile/[id].tsx` `handleReport` calls `api.submitReport` and the
  dialog copy is no longer the dishonest "review within 24 hours"
  (H6).
- `_layout.tsx` registers `onNotificationResponseReceived` listener at
  the root + `registerForPushNotifications` so notification taps
  deep-link to `/event/:id`, `/chat/:id`, or `/profile/:id` from the
  payload (H1 frontend / FR10.4).
- `event/[id].tsx` rate button gated on
  `!isHost && isJoined && eventEnded` (H3 UI / FR5.11). Waitlist
  toast surfaces `waitlist_position` from the API.
- `create-event.tsx` gains user-visible toggles for "Auto-create
  group chat" + "Add to Calendar" (M5 / FR5.9 / FR7.2).
- `auth/sign-up.tsx` gains an Individual/Organization chip-row and
  passes all 5 args to `api.signUp` including ISO-formatted birthdate
  + account type (H7 / FR1.4 + H2 / FR1.2).
- `my-following.tsx` unfollow drops the defensive duck-typed probe
  and calls `api.unfollowOrg` directly (M10).
- Polish: `events.tsx` swaps the hardcoded "Sat May 9 · Irvine"
  string for `useDateCityLabel` (L-8); `interests/[tag].tsx` labels
  its activity-bar fixture as `SAMPLE` (L-9); semantic React keys
  on the help screen + ratings star row (L-10); profile loading
  skeleton (L-11); chat `setTimeout` cleanup (M7).

**App infrastructure (`scenecheck-expo/{lib,hooks,store,types,components,theme}/`):**

- `lib/api.ts` — `subscribeToEvent` returns
  `{status, chat_id, waitlist_position}` with a follow-up `waitlist`
  SELECT after a `waitlisted` response. `signUp` extended with
  `birthdate` + `accountType` parameters stamped into user metadata
  (H2/H7). `followOrg` / `unfollowOrg` real implementations against
  the new `org_follows` table (M10). `getChatMessages` returns
  `DbMessageRow[]` honestly (H9). `subscribeToInterest` removed
  (L-3, dead). `fetchEvents` uses `DEFAULT_REGION` instead of
  inline UCI coords (L-7). `fetchRatings` preserves `createdAt`
  for the M10 sort.
- `hooks/useDateCityLabel.ts` — signature changed to accept
  `(coords, status)`; callers in `(tabs)/index.tsx`, `(tabs)/map.tsx`,
  `events.tsx` pass their existing `useLocation` result (M4).
- `hooks/useChatMessages.ts` — `formatTime` replaced by canonical
  `isoToTime` (L-5).
- `hooks/useLocation.ts` — `request` wrapped in `useCallback` (L-4).
- `hooks/useFollowedOrgs.ts` — redundant `ids` dep removed (L-12).
- `store/useStore.ts` — `blockUser` action mirroring `unblockUser`;
  `TOAST_DEFAULT_MS = 3_600` named constant (L-13).
- `types/domain.ts` — `EventKind` drops the unreachable `'org'`
  variant (M3); `Review` gains optional `createdAt` for sort.
- `components/AuthBootstrap.tsx` — parallel hydrate query for
  `org_follows` so the Zustand `following` Set reflects the
  persisted follow graph on sign-in.
- `lib/units.ts` (NEW) — `MILES_TO_METERS` extracted out of
  `(tabs)/map.tsx` and `search.tsx` (L-6).
- Six dead Expo template files removed: `themed-text.tsx`,
  `themed-view.tsx`, `parallax-scroll-view.tsx`,
  `ui/collapsible.tsx`, `constants/theme.ts`,
  `hooks/use-theme-color.ts` (M2).

**Scraper + CI + docs (`scripts/`, `.github/`, `docs/`):**

- `scripts/scrape-events.mjs` — `fetchWithTimeout` wraps every
  network call (`SCRAPE_FETCH_TIMEOUT_MS` + `INGEST_TIMEOUT_MS`
  env vars), sources fetched in parallel via `Promise.allSettled`,
  dedup key switched to `source_url` (with composite fallback),
  CDATA stripped before `JSON.parse`, fallback path sets
  `process.exitCode = 2` so a CI run that ingested only seed data
  is distinguishable from a real scrape (H5 / M6 / L-16 / M8).
- `.github/workflows/ci.yml` (NEW) — lint + tsc + jest +
  `denoland/setup-deno` for the interest-matching analyzer tests.
  `permissions: contents: read`, `ubuntu-24.04` pinned, actions
  pinned to full semver (H4 / L-1 / L-2).
- `.github/workflows/scrape-events.yml` — `permissions` block
  added, `ubuntu-24.04` pinned, action pins synced.
- Architecture doc — ingest auth contract updated to
  `apikey + x-ingest-token + --no-verify-jwt` (was the obsolete
  `service_role` Bearer description), endpoint name corrected
  to `ingest-scraped`, Node 20 → 22 LTS rationale block updated
  to describe the actual JSON-LD-over-`fetch` approach rather
  than Playwright/Chromium (M8 / L-18).
- README test count dropped (was stale at 385 vs the live 412);
  AGENTS.md expanded to ~25 lines of orientation (L-17).

**Verification:** TSC clean, 412/412 jest tests pass, lint at the
pre-session 7-problem baseline (1 pre-existing error + 6 pre-existing
warnings). Lint went 8 → 7 problems vs the pre-session baseline (Agent
C cleaned one stale `import/first` warning while refactoring
`MILES_TO_METERS`). Working tree clean; 8 commits pushed:
`24c2f83 → 960d8df`.

**Compliance:** the read-only audit agent confirmed 28 findings ✅
as-prescribed, 5 ◑ partial, and surfaced 2 real defects introduced by
the workers that go in §63 below.

---

## 63. Post-audit patches

_Last updated: 2026-05-27 (shipped to main 2026-05-27)_

Two real defects surfaced by §62's compliance review:

**Self-heal `onboarded_at` for legacy users** (`components/AuthBootstrap.tsx`):
`00030`'s migration header explicitly documented a one-shot self-heal
AuthBootstrap was supposed to perform — any account predating the
migration has `profiles.onboarded_at = NULL` even when the user has
non-empty `user_interests` from the legacy onboarding screen. Without
the self-heal, the AuthGate would force-route every existing real user
back to the questionnaire on their next sign-in. The hydrate now
treats `onboardedAt IS NULL && interests.length > 0` as "already
onboarded," sets the in-memory `onboardedAt` to `Date.now()` so the
AuthGate routes to `/(tabs)` immediately, and fires a best-effort
`UPDATE profiles SET onboarded_at = now()` so future hydrates don't
re-trigger the heal. The write is non-blocking — failure (e.g. RLS not
yet applied) just means the next sign-in retries; the in-memory flag
covers the session either way. Commit `4eb7080`.

**FR5.6 INCREASE auto-promote** (`supabase/migrations/00039_capacity_increase_promote.sql`):
`00037` covered the DECREASE half of FR5.6 via a trigger. The INCREASE
half was assumed to be handled by the host UI looping
`promote_waitlist_atomic` — but `EditEventSheet → api.updateEvent`
just issues a bare `UPDATE events SET capacity = …` with no follow-up.
That left raising capacity completely silent (waitlisted users wouldn't
be promoted until someone else triggered the atomic-subscribe path).
The fix is symmetric to 00037: AFTER UPDATE OF capacity trigger that,
when `NEW.capacity > OLD.capacity`, loops `promote_waitlist_atomic`
until either the new capacity is full or the waitlist is empty. Reuses
the existing atomic RPC so the promotion semantics stay in one place;
`pg_advisory_xact_lock` is reentrant on the same xact so the
trigger calling the locked function is safe. Trigger-based rather than
UI-based so the behaviour also fires for direct DB edits / future bulk
RPCs — matches the FR's "automatically" language.

Both fixes verified locally (tsc + 412/412 jest); commits `4eb7080` +
`e0217ce` pushed to `main`.

---

## 64. FR-gap closures (FR1.3 onboarding, FR5.3 analytics, FR5.10 UI, FR7.2 Calendar, FR9.5 announcements)

_Last updated: 2026-05-27 (shipped to main 2026-05-27)_

Round 3's FR-traceability table marked several requirements ✗ that
weren't lifted to numbered findings in the report itself. This pass
closes five of them. Three parallel implementation agents
(backend SQL, frontend infra, frontend screens) followed by a
compliance audit; one post-audit fix afterwards for the sign-up
arg-order bug that surfaced.

**`00035_profiles_onboarded_at.sql`** — `profiles.onboarded_at
TIMESTAMPTZ NULL` for the FR1.3 onboarding-completion marker. NULL =
not yet onboarded; the AuthGate redirect (added in §62 work) consults
this column. New accounts get NULL by default; legacy accounts get
the self-heal from §63.

**`00036_host_analytics_rpcs.sql`** — two SECURITY DEFINER RPCs
returning top-10 (interest_name, event_count) histograms:
`host_analytics_by_city(p_city TEXT)` and
`host_analytics_by_venue(p_venue TEXT)`. Filter on
`status = 'published'` and ILIKE substring-match on `location_name`
(the events table has no first-class city column — geocoding lives
in `geog`, the human-readable string in `location_name`). Empty
input raises `P0001` so the screen disables the button until input
is non-empty. Granted to `authenticated` — non-sensitive aggregates
of public events.

**`00037_capacity_decrease_demote.sql`** — AFTER UPDATE OF capacity
trigger that, when the new capacity is strictly less than the old
AND the event has more confirmed subscribers than the new cap
allows, demotes the excess to the **front of the waitlist** in
reverse-chronological order (FR5.6: "the last person to subscribe
will be removed first"). Existing waitlist positions shift up by
the demote count; the demoted rows take positions 1..N. Same
advisory-lock hash as the subscribe / promote paths so concurrent
operations are serialised. Status transition is
`UPDATE … SET status='waitlisted'` (not DELETE+INSERT) to mirror
the existing waitlist representation in `event_subscriptions`. One
`notifications` row per demoted user. (The INCREASE half came as
§63's `00039`.)

**`00038_messages_announcements.sql`** — FR9.5 announcement support.
`messages.message_type TEXT NOT NULL DEFAULT 'normal' CHECK ('normal',
'announcement')`, BEFORE INSERT trigger
`enforce_announcement_host()` raising `42501` when a non-host posts
`message_type='announcement'`, plus a complementary permissive RLS
policy that documents intent (the trigger is the actual gate because
PostgreSQL ORs permissive policies and the existing per-member INSERT
policy doesn't constrain `message_type`).

**New screens:**

- `app/onboarding/interests.tsx` — first-launch interest picker:
  chip grid + Continue/Skip CTAs. Both call `api.markOnboarded(tags)`
  (Skip passes `[]`); router replaces with `/(tabs)`. Sign-up
  screen now redirects here in live mode (mock keeps the legacy
  straight-to-tabs flow because mock SC_ME already has interests
  and `onboardedAt` seeds to a non-null value in the store).
- `app/host-analytics.tsx` — two ranked lists (city + venue, top
  10 each). City input auto-seeds from the host's most-frequent
  event `where`. Empty state when both lists are empty. Linked
  from `app/my-hosting.tsx` via a new primary-tinted "Analytics"
  row.

**App-screen wiring:**

- `app/attendees/[id].tsx` — host-only Remove button per row,
  danger-tinted trash icon, ConfirmDialog, optimistic-hide +
  rollback on error (FR5.10). Calls the existing `organizer-remove`
  Edge Function via `api.organizerRemove`.
- `app/settings/linked-calendar.tsx` — Google connect/disconnect
  row driven by `Google.useAuthRequest` (`expo-auth-session/
  providers/google`); `WebBrowser.maybeCompleteAuthSession()` at
  module scope finalises the OAuth round-trip on web. When
  `googleCalendar.isConfigured()` returns false the button label
  flips to `OAUTH NOT CONFIGURED` and a press shows an info toast
  pointing to `AGENTS.md`. Legacy Apple/Outlook chips retained.
- `app/event/[id].tsx` and `app/create-event.tsx` — fire-and-forget
  `googleCalendar.insertEvent` after a confirmed (non-waitlisted)
  join / publish, when `linkedCalendar === 'google'` and
  `isConfigured()`. Failures surface a "Joined, but couldn't add to
  your Calendar" info toast; the primary flow never blocks on it.
- `app/chat/[id].tsx` — host-only `Announcement` chip on the
  composer, gated on `api.canPostAnnouncement(chatId)`. When armed
  the composer border + send button tint warn-yellow; toggle resets
  after each send. Announcement messages render as a full-width
  warn-tinted card with a bell icon and an
  `ANNOUNCEMENT · {who} · {time}` mono caption above bolder body
  text — visually unmistakable next to normal bubbles.

**Infrastructure additions:**

- `lib/google-calendar.ts` (NEW) — `isConfigured` / `getAuthRequestConfig`
  / `completeConnect` / `disconnect` / `insertEvent`. React-free; the
  screen drives `useAuthRequest` and hands tokens to
  `completeConnect`. Implicit (token) flow rather than auth-code+PKCE
  — the web client doesn't ship a client secret, so refresh-token
  exchange can't complete without a backend exchanger. 1-hour token
  expiry forces reconnect; documented in the file header as a
  future-work upgrade path.
- `hooks/useHostAnalytics.ts` (NEW) — `{ byCity, byVenue, loading,
  error, reload }` parallel fetch hook.
- `lib/api.ts` — `markOnboarded`, `fetchHostAnalyticsByCity`,
  `fetchHostAnalyticsByVenue`, `organizerRemove`,
  `canPostAnnouncement`, `sendMessage(chatId, body, messageType?)`,
  `DbMessageRow.message_type?`.
- `store/useStore.ts` — `onboardedAt: number | null` (persisted),
  `hydrated: boolean` (NOT persisted; flips true after AuthBootstrap's
  first auth check), `setOnboarded` / `setHydrated`.
- `components/AuthGate.tsx` — tri-state redirect logic: render-through
  while `!hydrated`; `/auth/sign-in` while `!session`;
  `/onboarding/interests` while `session && onboardedAt == null`.
  Mock mode short-circuits.
- `package.json` — `"engines": { "node": ">=22 <25" }` declared,
  `expo-auth-session ~7.0.8` + `expo-crypto ~15.0.7` added,
  `jest.setup.ts` gained mocks for `expo-auth-session/providers/google`
  and `expo-web-browser`.

**Post-audit fix:** the screen's first cut of the sign-up call used a
type-cast that misaligned arg 4 (`birthdate`) and arg 5 (`accountType`).
That silently dropped the birthdate AND landed the account type in the
wrong metadata key. Separately, `handle_new_user` in `00030` was
reading `birthdate` but still hard-coding `account_type = 'person'`.
Both fixed: the sign-up screen now passes all 5 args in order with
ISO-formatted birthdate, and `00030`'s `handle_new_user` now reads
`account_type` from `raw_user_meta_data` with enum validation and a
`'person'` default for callers that omit it. Commit `870b233`.

**User actions surfaced for FR7.2:** Google Cloud Console setup steps
documented inline in the commit message and in `AGENTS.md` — create
OAuth client (Web application), enable Calendar API, add scope
`calendar.events`, set `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` env var.
Until those credentials exist, the Connect button shows
`OAUTH NOT CONFIGURED` and the on-subscribe/on-create paths skip the
calendar side effect silently. Mock mode works without any of this.

**Verification:** TSC clean, 412/412 jest tests pass, lint at the
7-problem baseline. Commits `a4dae80 → 4eb7080` + `e0217ce` (the FR5.6
INCREASE trigger crossed into both this section and §63 narratively).

---

## 65. Map iOS pin-crash saga → custom RN overlay rewrite

_Last updated: 2026-05-28 (shipped to main 2026-05-28)_

Recurring user report: tapping pins on the Map tab in Expo Go
**closed the app after 2-3 selections, regardless of timing between
taps**. The fix took many iterations because the cause wasn't where
each hypothesis pointed. Captured device logs eventually proved the
JS layer was correct end-to-end; the crash lived entirely in the
bundled `react-native-maps@1.20.x` native marker pipeline.

**Iteration log (each tried in turn against a live device):**

1. **Drop `title` / `description` on Marker** — hypothesis: iOS
   MKMarkerAnnotationView callout-lifecycle bug. Didn't help.
2. **Imperative `showCallout()` via `useRef<MapMarker>`** — let
   React state drive the callout rather than the gesture
   recognizer's auto-select. Didn't help; both paths funnel into
   `selectAnnotation:`.
3. **Memoize markers with `React.memo` + stable refs** — cut
   per-render prop-ref churn (each parent re-render was creating
   new `coordinate` objects and `onPress` closures for all 36
   markers, ~108 bridge messages per render). Made the crash worse
   in one direction (hit at tap 2 instead of 3) because the memo
   was broken: `onPressId` captured `selectedId` so all 36 markers
   re-rendered on every selection anyway.
4. **Upgrade `react-native-maps` to `1.27.2`** — `npm install`
   succeeded locally, tsc + jest passed. But Metro couldn't bundle
   it on the user's dev-build path (Expo Go bundles a fixed native
   version regardless of `package.json`; the bundled version
   shadows whatever's in `node_modules`). Reverted.

Device logs from the bare-Marker iteration (no title, no
description, no callout child, no ref-driven selection) still
crashed at tap 3. Every JS log line landed; the crash silence fell
**after** the React commit completed. Conclusion: the bug is purely
in the bundled `react-native-maps`'s annotation/selection lifecycle,
not in any JS-reachable code path.

**Final fix — custom React Native overlay:**

`<MapView>` now renders **only** the tile layer + the user-location
indicator + the discovery-radius `Circle`. **No `<Marker>` children
of any kind.** Event pins are absolute-positioned `<Pressable>` Views
sitting in a sibling overlay that uses `pointerEvents='box-none'`
so taps that miss a pin fall through to the map for pan/zoom; each
Pressable explicitly captures its own hits with `hitSlop={8}` for the
same effective 36px tap target the native markers had.

Per-pin screen coordinates are projected **synchronously in JS** via
a Mercator formula scoped to the current visible region:

```js
function mercatorY(latDeg: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  const clamped = Math.max(-1.4835, Math.min(1.4835, latRad));
  return Math.log(Math.tan(Math.PI / 4 + clamped / 2));
}
// in render:
const x = ((ll.longitude - westLng) / region.longitudeDelta) * w;
const yPin = mercatorY(ll.latitude);
const y = ((yNorth - yPin) / ySpan) * h;
```

Same projection Apple Maps + Google Maps use to render tiles, so
pins land at the exact pixel positions native annotations would
have. Synchronous arithmetic, ~39 pins × constant ops =
sub-millisecond per render. The viewport size is captured via
`onLayout`; the visible region is tracked in state and updated
**continuously by `onRegionChange`** (every frame the map moves) so
pins glue to their geographic positions while the user is panning
— no `pointForCoordinate` async round-trips, no snap-back-on-gesture-
end.

**Plus two affordances added in the same pass:**

- **Recenter button** — floating circular Pressable at bottom-right
  of the map, `crosshair` icon. Tap targets in priority order:
  selected event coords → user location → `initialCenter`. Animates
  via `mapRef.current.animateToRegion(...)` over 300ms preserving
  the current zoom (only the centroid moves). Only rendered when
  the map is interactive (so the Home `MapPreview` doesn't get one).
- **Tap-empty-map → deselect** — `MapView.onPress` wired to an
  `onMapPress` callback the screen sets to `setFocused(null)`.
  Pin overlay's `box-none` ensures `MapView.onPress` only fires
  when the gesture misses every pin — `onPinPress` and `onMapPress`
  are mutually exclusive per gesture, no cross-fire guard needed.

**Diagnostic logging preserved under `__DEV__`** so a future
regression — or any unexpected behaviour — produces an actionable
trace in the device console without re-instrumenting from scratch.

**Trade-offs documented in the file header:** the projection ignores
map rotation (`region.camera.heading` isn't read), so pins won't
follow if the user rotates the map (rotateEnabled stays true). Apple
Maps north-locks by default and typical UX doesn't rotate; adding
rotation correction is ~10 lines using `camera.heading` and a 2D
rotation around the viewport center if it ever matters.

**Net result:** the entire pin-crash class is structurally removed.
No annotations means no annotation cache to poison, no
`selectAnnotation:` lifecycle to corrupt, no count-based threshold to
hit. The version of `react-native-maps` bundled in Expo Go no longer
matters for this code path. 412/412 jest tests pass throughout —
the existing tests use `jest-expo`'s `react-native-maps` mock which
doesn't model the native crash, but they do cover the screen-level
state flow which is unchanged.

Commits: `7ba9717 → c7a79cb → 0605594 → 80cc7a6`.

---

## 66. Chat row avatars (DM single, group stacked Instagram-style)

_Last updated: 2026-05-28 (shipped to main 2026-05-28)_

Chat list rows now lead with avatars:

- **DM** — single 40px avatar of the other person, to the left of
  the chat name.
- **Event / group chat** — two stacked 30px avatars: back top-left,
  front bottom-right with a 2px card-coloured pad wrapping the
  front one to create the visual ring that separates them. Same
  trick Instagram uses for its group-chat avatars. The total stack
  occupies the same width a single 40px DM avatar would, so row
  alignment stays tight regardless of chat type.

**Data shape:** `Chat` gains optional `members?: ChatMember[]`
(`ChatMember = Pick<Account, 'id'|'name'|'picture'|'type'>`), capped
to the first 4 at the API layer (the row only ever renders two
avatars anyway). `api.getChats`'s live-mode query extends its
existing `chat_members ⨝ profiles` embed to include `avatar_url` +
`account_type` alongside `name` — same round-trip, no per-row extra
fetch. DMs drop self from the members list (no point putting your
own face on your own row); event chats keep self so the stacked
render reflects the actual roster.

**Mock-mode fallback** in `app/(tabs)/chat.tsx`: a `chatAvatars(c, mock)`
helper resolves up to 2 ChatMembers in priority order — live
`c.members` → `SC_ACCOUNT_BY_ID[c.personId]` for DMs → event host +
first non-host visible person for event chats. Render branches on the
result:

- 0 entries → muted placeholder circle
- 1 entry → single `SCAvatar`
- 2 entries → the stacked pair

**Non-event group-chat title fallback** (added in §67 polish pass
but related): chats with `kind !== 'event'` and `members.length > 1`
get a title built from member names — `Alice, Bob, Carol` for ≤3
names, `Alice, Bob +N` truncation past that. Missing names get a
`'Someone'` placeholder so a stray null doesn't render as
`Alice, , Bob`.

Commit `a6fcf1e` (avatars), `622f90b` (title fallback).

---

## 67. Polish pass — self-profile redirect + privacy screen + /unk + group-chat names + edit description + onboarding sync

_Last updated: 2026-05-28 (shipped to main 2026-05-28)_

A cluster of small fixes from rapid user-report iteration:

**Self-profile redirect** (`app/profile/[id].tsx`): tapping your own
user id (in an attendees list, a notification deep-link, anywhere)
used to land on the other-profile surface with Friend / Block / Report
buttons pointed at yourself. Now: if `isSelf` (`id === me.id`), the
screen returns `<Redirect href='/(tabs)/profile' />`. Placed after all
hooks so the rules-of-hooks aren't violated — the data fetches briefly
run for the self id (works fine; you can read your own profile) and
the Redirect navigates away before paint.

**Defense in depth on self-profile**: when the user reported the
buttons were still reachable in some path, added belt-and-braces — all
six handlers (`requestFriend`, `handleFriendToggle`, `handleFollowToggle`,
`handleMessage`, `handleBlock`, `handleReport`) early-return when
`isSelf` is true, and the action-button row + Safety card are wrapped
in `{!isSelf && (...)}` so the buttons don't render at all on your
own profile. The Redirect stays the primary defense; these gates
backstop it.

**In-app privacy policy** (`app/settings/privacy.tsx` NEW): the Help
screen used to link out to `https://scenecheck.app/privacy` — that
domain isn't owned by this project and serves an unrelated demo site.
Replaced with an in-app screen that accurately describes the app: what
we collect (account, profile, events, social, location), where it
lives (Supabase, Expo Push, optional Google Calendar), who can see
what (public vs friends-only, blocks, RLS-enforced chat scoping), and
user controls (visibility, notifications, linked calendar, blocked
list, delete account). The bug-report URL was also wrong
(`github.com/scenecheck/issues` doesn't exist) — corrected to
`github.com/Plehndm/SceneCheck-App/issues`. `support@scenecheck.app`
was left as-is pending a decision on what to do with it.

**`0/unk` capacity fallback consistency**: `app/events.tsx` already
rendered `'/{cap > 0 ? cap : "unk"}'` so scraped events without a
listed capacity read as `0/unk` rather than the misleading `0/0`. Three
other render sites had the same `' / {cap} '` shape without the
fallback — `components/SCEventCard.tsx` (the card the Home screen
uses, hence the original report), `app/my-hosting.tsx`, and
`app/profile/[id].tsx`. All three now apply the same fallback.

**Edit-description on EditEventSheet**: the host edit-sheet had title /
when / where / capacity but no description field, even though
`api.updateEvent` already accepted a `desc` patch. Added a multi-line
TextInput (`minHeight: 96`, `maxHeight: 160` so the SAVE button stays
on-screen; `textAlignVertical: 'top'`) wired to local state seeded
from `event.desc` on open. Sent in the patch alongside title/where/cap
and stamped into `applyEventOverride` so the screen reflects the new
description immediately.

**Onboarding interest sync** (`lib/api.ts` `markOnboarded`): the
live-mode branch was writing `user_interests` rows correctly to
Supabase but never updating the local Zustand store. So after
onboarding completion, the freshly-signed-up user landed on `/(tabs)`
with `subscribedInterests` empty + `me.interests` empty until the next
session hydrate — read as "my picks weren't saved." Mock branch
already had this mirror; live branch was missing it. Fix: after the
DB writes succeed, add each picked tag to `subscribedInterests` and
`me.interests` in the store — same lazy-imported `useStore` pattern
the mock branch uses to avoid a circular dependency with `data/mocks`.

**Verification:** TSC clean, 412/412 jest tests pass, lint at the
7-problem baseline. Commits `870b233` (self-profile + edit description
+ onboarding sync), `062e3ee` (in-app privacy + defense in depth),
`622f90b` (`/unk` + non-event group titles).

---

## 68. Eventbrite time correctness + ticket price columns (backend)

_Last updated: 2026-05-29 (shipped to main 2026-05-29)_

Two related fixes in the FR6 scraper pipeline + a new DB column for
ticket prices. Single combined commit (`59e5bfd`) because the changes
touched the same files (`scrape-events.mjs`, `ingest-scraped/index.ts`)
in tightly coupled ways.

**Time correctness — detail-page enrichment**

User report: scraped events showed up on the wrong day at fictional
times. Investigation: Eventbrite city listings emit JSON-LD with
`"startDate":"2026-05-29"` — date-only, no time, no offset. Per the
ECMAScript Date Time String Format spec, date-only ISO strings parse
as **UTC midnight**, so `new Date("2026-05-29").toISOString()` is
`"2026-05-29T00:00:00.000Z"`. A California user reads that as **May
28, 5:00 PM PDT** — wrong day AND fictional time. The detail page for
each listing carries the real value (`"2026-05-29T14:00:00-07:00"`),
verified by `curl`-ing both endpoints.

The scraper now follows the URL to the detail page when the listing
value is date-only. New pure-helper module:

- `scripts/scrape-time.mjs` — `isDateOnly`, `hasTimezone` (handles `Z`
  suffix OR `±HH:MM` offset, careful with the date-hyphen),
  `timezoneFromSourceUrl` (full US-50 state-code → IANA map, default
  `America/Los_Angeles`), `extractFullJsonLdTimestamp` (skips
  date-only stragglers on detail pages — Eventbrite emits both
  shapes), `timezoneOffsetMinutes` via `Intl.DateTimeFormat`
  (DST-aware), `dateOnlyToVenueLocalNoonIso` (fallback when detail
  fetch fails — anchors the calendar day correctly even if the
  time-of-day is approximate).
- `scripts/scrape-time.test.mjs` — 23 `node:test` cases.

`scripts/scrape-events.mjs` rewires the per-event loop. New
`resolveTimes` (later `resolveEventFields`) classifies four input
shapes:

1. **`listing`** — full datetime already in JSON-LD, used as-is
   (richer sources like campus calendars).
2. **`detail`** — date-only in listing, fetches the event's detail
   URL and extracts the full timestamp.
3. **`noon-fallback`** — date-only + detail unreachable, anchors to
   venue-local noon (day correct, time-of-day a neutral placeholder).
4. **`naive-localized`** — bare datetime without offset, stamped with
   the venue's current UTC offset.

Per-source CI log now ends with `time-resolution: detail:5` (or mix)
so a glance tells you which paths each city used. Detail fetches use
1 retry (the listing already succeeded) with the same UA-rotation +
per-request timeout the listing fetch has. `tzOffsetCache` keyed
`tz|yyyy-mm-dd` avoids re-running `Intl.DateTimeFormat` per event in
the naive-localized path.

**Ingest dedup self-heal**

The old `title + start_at` dedup missed once the scraper corrected
times — the new `start_at` wouldn't match the stored one → dedup
miss → the INSERT then collided with the partial unique index on
`source_url` from `00033` → 500 error → wrong row stayed. The dedup
in `ingest-scraped/index.ts` now keys on `source_url` first (falls
back to title+start_at for `FALLBACK_EVENTS`), and when a dupe is
found, compares stored `start_at`/`end_at` (later `start_at`/`end_at`/
price triple) against the incoming values and **self-heals in place**
when they differ. Existing wrong rows get corrected on the next scrape
without needing a manual cleanup.

**Ticket price columns**

User request: scraped events have prices listed on Eventbrite but
weren't shown in the app; hosts had to put price info in the
description. New migration:

- `supabase/migrations/00040_events_price.sql` — adds nullable
  `price_min NUMERIC(10,2)`, `price_max NUMERIC(10,2)`,
  `price_currency TEXT`. CHECK enforces "both set or neither set" +
  non-negative + max ≥ min. Encoding contract documented in column
  COMMENTs: NULL/NULL = unspecified, 0/0 = FREE, equal nonzero = fixed
  price, min < max = range. NUMERIC(10,2) avoids floating-point
  artifacts.

New scraper helper module:

- `scripts/scrape-price.mjs` — `parsePriceNumber` (Eventbrite-style
  decimal strings + dollar-prefixed + currency-suffixed tolerated),
  `isUsSourceUrl` (matches `/d/<state-code>--<city>/` against the full
  US-50 list), `normaliseCurrency` (ISO-4217 uppercase + validation),
  `extractPriceFromOffers` accepting Object/Array of
  `Offer`/`AggregateOffer` with low/high/single-price reduction +
  CAD→USD override for US listings (Eventbrite has a long-standing
  bug mis-tagging US events as CAD; verified live on the BEIS
  Warehouse Sale - Tustin, CA listing).
- `scripts/scrape-price.test.mjs` — 18 `node:test` cases.

`scripts/scrape-events.mjs` `enrichTimeFromDetailPage` renamed to
`enrichFromDetailPage`; the single detail-page round-trip now satisfies
both time and price needs. New `extractJsonLdEventObjects` helper walks
single top-level `Event` objects (the shape detail pages use), unlike
the listing-page-only `extractJsonLdEvents`. `resolveEventFields`
extracts price first from listing-side `offers` (rare for Eventbrite,
common for richer sources), then via the detail page when missing.
Source-listing URL is threaded down (not the per-event detail URL) so
the CAD→USD override has the state-code it needs.

`ingest-scraped/index.ts` and `create-event/index.ts` both validate +
persist + (in ingest's case) extend self-heal to price columns.
Validation mirrors the migration's CHECK so a malformed body errors
with a 400 + clear message instead of a 500 Postgres constraint
violation.

**CI**

`.github/workflows/ci.yml` — the existing `scraper-tests` job now
runs both `scrape-time.test.mjs` + `scrape-price.test.mjs` via
`node --test`.

**Verification:** TSC clean, jest 412/412 (no Jest surface for these),
`node --test scripts/*.test.mjs` 41/41 (23 time + 18 price), lint at
the 7-problem baseline. Live verification on the deployed build: BEIS
Warehouse Sale corrected from displaying "5/28/2026 5:00 PM PDT"
(wrong) to "5/29/2026 2:00 PM PDT" (matches Eventbrite); scrape
ingested 40 events with prices populated (10 FREE / 10 paid /
priced) and timezone-aware `start_at`.

---

## 69. Ticket price UI rendering (frontend)

_Last updated: 2026-05-29 (shipped to main 2026-05-29)_

Surfaces the new price triple end-to-end so users can see ticket cost
without scanning the description. Single commit (`8a1c17d`); 10 files,
+534 / -13.

**Format helper**

- `lib/price.ts` (new) — `priceState(e)` returns `'none' | 'free' |
  'fixed' | 'range'`; `formatPrice(e)` returns the display string or
  null; `formatPriceAmount(n, currency)` for individual amounts.
  Currency-symbol map covers USD/CAD/EUR/GBP/JPY/AUD/MXN; unknown ISO
  codes render `XYZ 15` rather than silently dropping the unit. Null
  currency treated as USD (matches the migration's column comment).
  Trailing zeros stripped for integers but cents preserved.
- `tests/unit/price.test.ts` (new) — 13 jest cases covering all
  branches + currency-symbol fallback + the "starts free" tiered case
  (`min=0 < max=25` → range, not free).

**Display surfaces**

- `components/SCEventCard.tsx` — new `PriceChip` on the bottom bar
  next to the attendee count. FREE = green-tinted pill (positive
  affordance), paid = neutral outline so it doesn't compete with the
  JOINED chip. Renders nothing for `priceState === 'none'`.
- `app/events.tsx` — same chip in the full events list rows.
- `app/event/[id].tsx` — new "Ticket price" `DetailRow` with a new
  `tag` icon (added to `SCIcon`) under the location row. Label
  switches to "Free to attend" for free events.

**Edit + create flows**

- `components/EditEventSheet.tsx` — `NOT SET / FREE / PAID` three-mode
  toggle. PAID reveals MIN/MAX number inputs (leaving MAX blank
  treats as fixed-price → max := min on save). Client-side validation
  (max ≥ min ≥ 0) short-circuits before the round-trip. Derive
  initial mode from current price columns; helper functions hoisted
  outside the component to avoid the `useEffect` exhaustive-deps
  warning eslint flagged when they referenced `event` inside.
- `app/create-event.tsx` — same toggle + inputs in the form;
  `priceMode` / `priceMin` / `priceMax` added to `DraftForm` so the
  chosen price persists across saved drafts.

**API plumbing**

- `types/domain.ts` — `SCEvent` gains `priceMin` / `priceMax` /
  `priceCurrency` (optional null); `DraftForm` gains the input-shape
  trio (optional for backwards-compat with older drafts).
- `lib/api.ts` — `EventRow` includes the columns; `transformEventRow`
  maps them through a small `num()` helper so supabase-js's
  NUMERIC-as-string-in-edge-cases doesn't break the `=== 0` free
  check; `updateEvent` accepts a price patch shape.

**Verification:** TSC clean, 425/425 jest (412 baseline + 13 new),
lint at the 7-problem baseline. Live verification on the deployed
build: scraped Pan Pacific Swimming Championships displays
`$33.85–$188.58`, BEIS Warehouse Sale displays `FREE`, capacity-only
events show the price chip alongside the attendee count.

---

## 70. Legacy date-only-UTC scraped rows cleanup (migration 00041)

_Last updated: 2026-05-29 (shipped to main 2026-05-29)_

One-shot cleanup for rows the FR6 scraper landed before the time-fix
+ price-column work in §68. Two prior bugs left them:

1. **Time bug** — listing JSON-LD's date-only `startDate` parsed as
   UTC midnight; rows show `T00:00:00+00:00` and display a day early
   in PT.
2. **Pre-00040 price** — rows from before the price columns existed
   have NULL price triples.

The ingest function's self-heal patches both on re-scrape, but only
when `source_url` still matches. Eventbrite rotates per-event listing
URLs (the BEIS event's URL changed from `…tickets-1989952932790` to
`…tickets-1989952934796` between adjacent scrape runs in this
session), so older rows whose URLs have since changed don't get
matched — they sit alongside the new correct rows polluting the feed.

`supabase/migrations/00041_cleanup_legacy_scraped.sql` deletes the
legacy class in one shot:

```sql
DELETE FROM events
WHERE source = 'scraped'
  AND price_min IS NULL
  AND start_at::time = '00:00:00';
```

The conjunction is the unique fingerprint of the legacy path:
`scraped + no price after the latest heal + UTC midnight start_at`.
A genuine event at exact UTC midnight would have non-null price
fields (Eventbrite always emits an offer block), so the conjunction
won't fire on real data.

FK cascades verified: `event_interests` / `event_subscriptions` /
`event_waitlist` / `ratings` are `ON DELETE CASCADE`;
`chats.event_id` and `reports.target_event_id` are `ON DELETE SET
NULL`. No orphan risk, no manual dependent cleanup needed before the
DELETE.

Idempotent. DO block `RAISE NOTICE`s the deleted count to the
migration log so the magnitude is visible without a follow-up query.

---

## 71. Onboarding tour replay wired

_Last updated: 2026-05-30 (shipped to main 2026-05-30)_

User report: the "How SceneCheck works" row in Help & feedback
toasted *"Welcome tour replay coming soon"* and didn't actually do
anything. Investigation: the inline handler was a TODO from when the
tour was envisioned but never built; the actual onboarding flow that
exists is the post-signup `/onboarding/interests` picker (FR1.3, built
in §64).

Fix (`app/settings/help.tsx`):

- Removed the inline `action: 'replay-tour'` branch from the row
  type + handler so there's no remaining dead code path.
- Gave the row a real `route: '/onboarding/interests'` so the
  handler's existing `router.push(row.route)` branch picks it up.
- Relabelled to **"Replay onboarding"** / "Re-pick the interests we
  use to rank events for you" — the old "walkthrough of the main
  features" copy promised a multi-step tour that was never built, so
  the label was misleading even if the link had worked.

`api.markOnboarded` is idempotent and additive — re-picking interests
*adds* to the user's existing set rather than wiping it — so the row
is safe to invoke from settings without a confirmation gate.

Regression test added (`tests/screens/settings-subscreens.test.tsx`):
tapping "Replay onboarding" asserts `router.push` fires with
`/onboarding/interests`. Caught a stale assertion in the same suite
that still expected the old "How SceneCheck works" label.

**Verification:** TSC clean, jest 426/426 (425 + 1 regression), lint
at the 7-problem baseline.

---

## 72. Wider scrape (LA cluster) + fixture-POST skip + dupe cleanup (migration 00042)

_Last updated: 2026-05-30 (shipped to main 2026-05-30)_

User report: many duplicate events in the feed (multiple copies of
"Beginner Bouldering Night" / "Aldrich Park Morning Run" / "Common
Room Coffee Meetup"); also wanted the scrape widened to LA-area
cities since Eventbrite cycles per-event URLs and many recent events
from prior scrapes were no longer reachable for the self-heal path.

**Wider source set**

`scripts/scrape-events.mjs` `DEFAULT_SOURCES` expanded 6 OC cities →
**14 cities**:

- **OC cluster** (8): irvine, santa-ana, costa-mesa, newport-beach,
  anaheim, huntington-beach, fullerton, garden-grove
- **LA cluster** (6): los-angeles, long-beach, pasadena,
  santa-monica, west-hollywood, burbank

The LA cluster is the adjacent metro most users in the anchor region
still drive to; including it doubles the discoverable footprint
without changing any other behaviour.

**Cap bump**

`MAX_EVENTS` default 40 → **120** so the wider source set can
actually deliver more events into the feed instead of getting clipped
by the global cap. With 14 sources, that's ~9 events per city before
the per-source cap bites — enough to give each city visible
representation without one busy listing flooding the rest out.

**Stop POSTing FALLBACK_EVENTS in live mode**

The fixture array used to be POSTed whenever Eventbrite returned 0
events (the bot-check page on CI runner IPs being the common cause),
but the fixtures had:

```js
start_at = Date.now() + (i + 2) * 86_400_000   // drifts every CI run
source_url = null                              // exempt from 00033 index
```

So dedup missed on BOTH keys and every CI fallback inserted a fresh
copy. Multi-week buildup left the feed with 4× each fixture title.

Live mode now logs the empty result + exits with code 2 (degraded but
not failed) and skips the POST entirely. DRY_RUN still surfaces the
fixtures so the scraper can be inspected locally without credentials.

**Cleanup migration**

`supabase/migrations/00042_cleanup_fallback_scraped.sql` deletes
every scraped row with `source_url IS NULL` — broader than "fixture
titles" by design, catches the FALLBACK_EVENTS bloat + any
pre-source_url-tracking-era stragglers that survived 00041 because
they happened to land on a non-midnight `start_at`. DO block surfaces
the deleted count. Live verification: 12 dupes removed (4 of each
fixture title), 0 remaining; total scraped 136 → 124.

**Live scrape after the changes**

120 events scraped across the 14 cities, 103 new + 17 self-healed, 0
failed. LA cluster contributed visibly: Studio 420 West Hollywood,
LA Independent Beer Fest, Santa Monica USA Kick Off, Pasadena
Award-winning Rose de Chine, Music for the Masses Dark 80's New Wave
Nite [L.A.], MIDTEMPO R&B Rooftop, Cars & Christ Los Angeles, SET
with JOHN DIGWEED LA, Glow Festival LA, LBC Beach Cleanup, Sports
Photography with Jace Medina (Long Beach), Global Running Day LB,
Pasadena: Award-winning Rose de Chine Film Screening, …

**Verification:** TSC clean, jest 426/426, lint at the 7-problem
baseline.

---

## 73. Events nearby honors user coords + radius; default bumped 5 → 10 mi

_Last updated: 2026-05-30 (shipped to main 2026-05-30)_

User report after §72 landed: the "events nearby" view still only
showed 19 events even though 124+ were ingested into the DB.

**Coords + radius wire-up**

Investigation traced to two screens not passing what the discovery
RPC needs:

- `app/(tabs)/index.tsx` (Home rail) was passing `radiusM` but not
  coords — `fetchEvents` fell back to `DEFAULT_REGION` (Irvine)
  instead of the user's actual location.
- `app/events.tsx` (the "HAPPENING NEAR YOU" full list) was calling
  `useEvents()` with **no arguments at all**, so BOTH coords and
  radius defaulted (Irvine + 5mi hardcoded inside `fetchEvents`).

After the LA-cluster scrape landed 100+ events across OC + LA, the
`rank_events_query` RPC's `ST_DWithin` only saw the ~5mi bubble
around Irvine — anything further (LA cluster, even outer OC) was
filtered out at the DB.

Both screens now match the Map tab's pattern:

```tsx
useEvents({
  lat: coords.latitude,
  lng: coords.longitude,
  radiusM: Math.round(radiusMiles * MILES_TO_METERS),
})
```

`useLocation()` was already mounted on both screens for the
date/city label, so the wire-up is a constant-cost change. Home tab
also normalised `1609.34` magic number → `MILES_TO_METERS` import
for consistency with Map.

**Default discovery radius bump**

`store.radius` and `DEFAULT_RADIUS_M` (`components/Map/types.ts`)
both bumped 5 → 10 miles (8047 → 16093 m) so a fresh install
surfaces events from the full anchor metro instead of a tight Irvine
bubble that hid most of the ingested feed. 10mi covers Irvine + most
adjacent OC + the closer half of LA. Users can still pick 1/3/5/10/
25/50 from the Map tab chips or any value in 0.5–50 via the Settings
slider — only the new-install default changes.

`api.fetchEvents` fallback now references `DEFAULT_RADIUS_M` instead
of inlining 8047, so the constant is the single source of truth.

**Test fixtures updated**

- `tests/test-utils.tsx` `resetStore` default
- `tests/unit/store.test.ts` initial-state shape
- `tests/unit/map-types.test.ts` default-radius assertion (8047 →
  16093) + label updated to "10 miles"
- `tests/screens/map-tab.test.tsx` chip-tap test — was tapping 10 MI
  (now the default); now taps 25 MI so the assertion proves a real
  state change off the new default

**Note for existing installs:** the new default only applies on
fresh install. Existing installs keep whatever radius value is in
their persisted Zustand state. Drag the slider once (any value) or
clear app data to pick up the new default on a dev build.

**Verification:** TSC clean, jest 426/426, lint at the 7-problem
baseline.

---

## 74. Desktop web build + friend/own map events, event-detail parity, edit-notify fix (migrations 00043–00045)

_Last updated: 2026-05-30_

Two bodies of work, both web-facing.

### 74.1 Desktop web build (`scenecheck-expo/web/` + `*.web.tsx`)

The app gained a dedicated large-screen web experience (the native screens
stay untouched — Metro picks the `.web.tsx` / `.native.tsx` variant). It
landed as a sequence of focused commits:

- **Foundation** — platform-branched `_layout`s and a `WebShell` that paints
  the fixed full-viewport chrome (two radial-gradient glows over the cream
  `pageBg`) and lays out an Instagram-style left **`WebRail`** beside the
  route content. A library of shared web atoms lives under `web/`
  (`WebAvatar`, `WebTag`, `WebTip`, `WebIcon`, `WebStars`, `WebJoinButton`,
  `WebSlideOver`, …). Auth/onboarding routes render without the shell chrome.
- **Home + map** — a desktop map (`WebMap` wrapping `Map.web.impl`,
  react-leaflet over OSM tiles, with `leafletCss` injected at runtime as a
  `<style>` so Metro never serves the CSS as a classic script) with rich pin
  hover cards, a "you are here" pulse, zoom/recenter controls, a LIVE/OFFLINE
  chip + legend, search autocomplete, and a filter popover.
- **Two-pane chat** — realtime messages, announcements, optimistic send +
  retry, and edited-message rendering.
- **Profile** — a sticky-left profile card with five slide-over overlays and
  the secondary lists (friends / following / hosting / joined / reviews).
- **Create-event + settings** — a create-event wizard with a live preview
  pane, and a settings screen with inline summaries.
- **Discover** — a four-section search, an activity slide-over panel, and a
  notifications feed.

Overlay routes (event, profile, attendees, interests, ratings) are flipped to
`presentation:'transparentModal'` on web in `app/_layout.tsx` so they slide
over the current screen via `WebSlideOver` instead of replacing it; the
route's existence is the open state. The web `ToastHost` renders inside
`WebShell` so toasts land in the shell's coordinate space.

### 74.2 Friend + own events on the map (migration 00043 + `transformEventRow`)

Two gaps kept friend- and user-hosted events off the web map:

- `rank_events_query` returned `creator_id` but no relationship flag, so
  `transformEventRow` (lib/api.ts) bucketed every non-own, non-scraped row as
  `'other'` (grey "NEARBY" pin) — the "Friends" filter was always empty.
  Migration `00043` adds an `is_friend_creator` column (an `EXISTS` against
  accepted `friendships`); the transform now emits `kind:'friend'`. Direct
  table selects (`getEventById` / `fetchEventsByHost`) don't carry the flag,
  so those paths still fall through to `'other'` exactly as before.
- User-created events start life as `status='draft'` and only publish once
  `subscriber_count >= min_subscribers`, but the RPC filtered
  `status='published'` — so a host never saw their own freshly-created event
  (a chicken-and-egg dead end). `00043` widens the predicate to
  `status='published' OR creator_id = p_user_id`, so a creator always sees
  their own events (drafts included) while everyone else still only sees
  published ones.

`00043` `DROP`s before `CREATE` because adding a column to the `RETURNS TABLE`
changes the function's return type, which `CREATE OR REPLACE` alone rejects.

### 74.3 `notify_event_updated` array crash (migration 00044)

The FR10.2 trigger from `00032` built its changed-columns array with
`v_changed_fields := v_changed_fields || 'start_at'`. With a `text[]` on the
left and a bare unknown-type literal on the right, Postgres resolves `||` to
`anyarray || anyarray` and tries to parse `'start_at'` as an array literal —
throwing `malformed array literal: "start_at" (SQLSTATE 22P02)` at runtime.
`CREATE OR REPLACE FUNCTION` never executes the body, so the bug sat latent
since `00032`; it fires on any `UPDATE` that changes a tracked column — i.e.
the host "edit event" flow **and** any maintenance UPDATE (it's what initially
blocked the `00045` push below). `00044` switches to `array_append(...)`
(unambiguously `anyarray + element`); the existing trigger keeps pointing at
the swapped-in function.

### 74.4 Seed event-time refresh (migration 00045)

The 9 events seeded by `seed-hosted.sql` use `now()`-relative times, but those
only recompute when the seed is re-run. On a project seeded a while ago they
drift into the past and `rank_events_query`'s `start_at > now()-2h` window
drops them — including the events reassigned to mock hosts in
`seed-hosted-social.sql` (Maya's Morning Ride, the Cooking Club's Dumpling
Night, TopOut's climbing nights, Sasha's run, Theo's yoga). `00045` re-stamps
each seeded event to the same upcoming offset (time window only — `creator_id`
and `status` untouched), WHERE-scoped to the fixed seed UUIDs so it no-ops on a
DB without those rows.

### 74.5 Web event-detail routing parity (`app/event/[id].web.tsx`)

Brought the web overlay to parity with native `app/event/[id].tsx`:

- **Where** is now a button that routes to `/(tabs)/map?focus=<id>` (select +
  centre the pin); `map.web` reads the `?focus` param to highlight + pan and
  then consumes it, and `WebMap` gained a `centerOn` prop that imperatively
  `setView`s leaflet (never zooming out).
- A **ticket-price** fact (via `lib/price` `priceState`/`formatPrice`), hidden
  when no price data.
- A scraped **"view original listing →"** fact linking `sourceUrl`.
- **N/unk going** for unknown-capacity (scraped) events.
- The host row was already a profile link. Added a `tag` glyph to `WebIcon`.

### 74.6 Rail + shell layout fixes (`WebRail` / `WebShell`)

- Added a **Profile** entry to the rail's middle nav group (alongside the
  account chip at the bottom).
- **Rail overflow fix:** the rail used `height:'100%'`, which resolved to the
  full `100vh` while the shell row offsets it down by its top inset — so the
  rail ran off the bottom of the window (clipped), swallowing its bottom
  padding and pinning the Settings/account cluster to the edge no matter how
  much padding was added (it read as an "external override"). Switched to
  `alignSelf:'stretch'`, which sizes the rail to the shell row's content box,
  so the bottom padding now genuinely lifts the cluster. Paired with
  `minHeight:0` on the nav scroll area so the nav list shrinks/scrolls instead
  of overflowing.
- The LIVE chip + legend were re-centred against each other
  (`alignItems:'center'` + a stretched divider).
- Halved the top insets so both surfaces sit closer to the top of the window
  (rail `20→10px`, `WebShell` `26→13px`).

**Verification:** TSC clean, jest 426/426 (these are web-layout + SQL-migration
changes; like the rest of `web/` + the migrations they're outside the Jest
suite — see TEST_PLAN §2.67). Migrations `00043`–`00045` applied to the hosted
project via `supabase db push`.

---

## 75. How to re-snapshot this file

If you take a fresh measurement and want to update one section, the
pattern is:

1. Run the relevant command:
   - `npm test` for the test count
   - `npm run test:coverage` for the coverage table
   - `git log -1 --format=%h` for the commit hash
   - `git diff --stat` for file/line deltas
2. Update only the affected section and its `_Last updated_` line.
3. Leave other sections alone — they keep their original date and that's
   the point of dating per-section.

If everything is being re-measured at once, you can update every
`_Last updated_` to the same date. The dates are documentation of when
the metric was captured, not when the file was edited.
