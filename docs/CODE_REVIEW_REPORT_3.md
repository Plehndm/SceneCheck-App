# Code Review Report — Round 3 (Full-Stack Audit)

_Date: 2026-05-27 | Reviewer: Senior Code Review (multi-agent, synthesized & spot-verified) | Scope: full working tree — `scenecheck-expo/` (Expo app), `supabase/` (12 Edge Functions, 27 migrations, seeds, pgTAP tests), `scripts/scrape-events.mjs`, `.github/workflows/`, and the governance docs. `legacy/` is out of scope._

This is the third review in the series. Round 1 (`docs/CODE_REVIEW_REPORT.md`, 2026-05-18) flagged the web-prototype-vs-React-Native deviation and 4 backend bugs. Round 2 (`docs/CODE_REVIEW_REPORT_2.md`, 2026-05-19) confirmed those fixes and reviewed the new Expo codebase. Seven weeks of work have landed since: migrations 00016–00027, a multi-city scraper with capacity extraction, ~30 hooks, and a 412-test suite. This round audits the **current** state against the **Requirements Document** (FR1–FR11) and the **Architecture Document**, across four dimensions: best practices, document adherence, cohesion/coupling, and consistency.

Every Critical/High finding with a security or "feature-claimed-but-broken" character was read and verified against the source before inclusion. One finding raised by an agent (an `is_blocked` RLS "NULL-safety leak") was **investigated and rejected** as a false alarm — see §2.

---

## 1. Executive Summary

- **The codebase is strong where it is wired, and the gaps are concentrated in a single recurring pattern: UI affordances and FRs that are *present but not connected* to a persisting backend call.** Three safety/social features — **Block (FR11.1), Report (FR11.2), and Unfollow (FR7.1)** — show a confirmation dialog and a success toast but never persist anything. This is worse than a missing feature because it actively tells the user the action succeeded.
- **The data layer remains the project's strongest asset.** The profiles-visibility RLS rewrite (00014) is correct and fail-closed; the atomic-subscribe RPC (00015) is sound; CORS, the `_shared` client, and the interest-matching analyzer are well-factored. All four Round-2-confirmed fixes are intact and un-regressed by 00016–00027.
- **Notifications (FR10) are unwired end-to-end.** `create-event` never dispatches a proximity push (FR10.3), no trigger fires on event updates (FR10.2), and the frontend never registers the notification-response listener (`lib/notifications.ts` is written but never called), so taps cannot deep-link (FR10.4). The infrastructure exists on both ends; the wire between them does not.
- **Two access-control / integrity defects in the backend:** `promote-waitlist` authenticates the caller but never checks they are the event organizer (any logged-in user can promote anyone onto any event), and its update+delete are non-atomic. `subscribe-to-event` does not check event `status`, so draft/unpublished events are subscribable.
- **The age gate (FR1.2) is client-side only.** `sign-up.tsx` sets a `maxDate` 18 years back on the date picker, but nothing on the server rejects an under-18 birthdate — trivially bypassable, and FR1.2 is a hard "shall."
- **CI does not exist for code quality.** The architecture doc mandates GitHub Actions running ESLint + Prettier + TypeScript typecheck + unit tests pre-merge. The only workflow in the repo is `scrape-events.yml`. A 412-test suite that runs in ~5s is sitting unused as a merge gate.
- **The scraper diverges from the prescribed stack** (raw `fetch` + JSON-LD regex instead of Playwright/Chromium) and has **no per-request timeout** — the one mitigation the architecture doc explicitly calls "critical." When sources are bot-blocked it silently falls back to 3 seed events and still exits 0, so a green CI badge can mean "scraped nothing live."
- **Documentation has drifted** from the running system: stale test counts (README says 385, actual 412), three different Node versions across three docs, and an architecture doc that still describes Playwright and a `service_role` Bearer auth contract the code no longer uses.

**Net:** the architecture is right, the database is genuinely good, and the screen/state layers are disciplined (consistent optimistic-commit pattern, universal async-cancellation in hooks, clean mock/live boundary). The work remaining is mostly **finishing the wires** — connecting existing UI to existing backend functions, enforcing rules server-side that are currently only enforced (or not) in the client, and standing up the CI gate the architecture already promises.

---

## 2. Status of Prior-Round Findings & One Rejected Claim

All Round-2-confirmed fixes remain intact:

| Prior finding | Status today | Evidence |
|---|---|---|
| Profiles RLS leaked private profiles | ✅ Still fixed | `00014_fix_profiles_rls.sql` — fail-closed `NOT is_blocked(...) AND (owner OR public OR (private AND are_friends))`. Later migrations (00016, 00021) add policies but never weaken it. |
| All Edge Functions missing CORS | ✅ Still fixed | `handlePreflight()` is the first line of all 12 `index.ts` files. |
| `subscribe-to-event` capacity race | ✅ Still fixed | `00015_atomic_subscribe.sql` advisory-lock RPC, called exclusively. |
| Friend-request didn't notify (FR10.1) | ✅ Still fixed | `send-friend-request/index.ts` fire-and-forgets `dispatch-notification`. |
| Round-2 attendees `/event/${id}/attendees` 404 | ✅ Fixed | `attendees/[id]` registered in `_layout.tsx`; navigated as `/attendees/${e.id}` from `event/[id].tsx:391`. |
| Round-2 UCI coordinate duplication | ✅ Mostly fixed | `transformEventRow` no longer normalizes; one magic-number residue remains (see L-7). |

**Rejected claim (investigated):** A sub-agent flagged a "High: `is_blocked` NULL-safety leak" in the profiles policy. This is **not a defect.** `is_blocked` is defined with `SELECT EXISTS(...)` (`00005_create_social.sql:23`), which always returns a boolean, never NULL, even with NULL arguments. Furthermore the policy predicate is `NOT is_blocked(...) AND (...)` — fail-closed — so a hypothetical NULL would *hide* the row, not expose it. No change needed.

---

## 3. Critical Findings

### [Critical] C1 — Block action never persists; the moderation/safety feature silently lies to the user
- **Location:** `scenecheck-expo/app/profile/[id].tsx:282-285` (verified)
- **Category:** Best practice / Doc adherence (FR11.1, FR8.3)
- **Issue:** `handleBlock`'s `onConfirm` does only this:
  ```tsx
  onConfirm: () => {
    showToast({ message: `Blocked ${person.name}.`, kind: 'info' });
    router.back();
  },
  ```
  It never calls `api.blockUser(id)` (which exists in `lib/api.ts`) and never updates the store's `blocked` set. The dialog copy promises "They won't see you in the app, and you won't see them," but on the next app launch the blocked person reappears everywhere. The full block stack exists — `blocks` table, RLS, `api.blockUser`, the `is_blocked` checks in `send-friend-request` and `messages` RLS — and is bypassed by this one screen.
- **Fix:**
  ```tsx
  onConfirm: async () => {
    useStore.getState().blockUser(id, person.name); // optimistic store update
    showToast({ message: `Blocked ${person.name}.`, kind: 'info' });
    router.back();
    try { await api.blockUser(id); }
    catch { showToast({ message: "Couldn't save block. Try again.", kind: 'error' }); }
  },
  ```
- **Reasoning:** Block is a safety feature, not a convenience toggle. Showing success for an action that did nothing is a trust and safety defect — the user believes they are protected when they are not. This is the highest-severity finding precisely because the UI masks the failure.

### [Critical] C2 — `promote-waitlist` has no authorization check and is non-atomic
- **Location:** `supabase/functions/promote-waitlist/index.ts:14-45` (verified)
- **Category:** Best practice / Security (broken access control; FR5.6)
- **Issue:** The function authenticates the caller (`getUserId` → 401 if anonymous) but **never verifies the caller owns the event.** Any authenticated user can `POST {event_id}` for *any* event and promote the next waitlisted person to `confirmed` — bypassing the organizer and the capacity gate (FR5.5). Separately, the promotion is two un-guarded statements (update `event_subscriptions`, then delete from `waitlist`) with no transaction or advisory lock, unlike the carefully atomic `subscribe_to_event_atomic`. Concurrent calls can double-promote or leave the waitlist and subscription rows inconsistent.
- **Fix:** Add an organizer check and move the mutation into a single locked RPC:
  ```ts
  const { data: ev } = await admin.from("events")
    .select("creator_id").eq("id", event_id).single();
  if (!ev || ev.creator_id !== callerId) return errorResponse("Forbidden", 403);
  // then call a SECURITY DEFINER RPC promote_waitlist_atomic(event_id)
  // that re-checks capacity, updates status, deletes the waitlist row,
  // and inserts the notification inside one transaction with
  // pg_advisory_xact_lock(hashtextextended(event_id::text, 0)).
  ```
- **Reasoning:** State-mutating endpoints must enforce *authorization*, not just authentication — this is OWASP A01 (Broken Access Control). The project already established the correct atomic pattern in 00015; `promote-waitlist` should reuse it rather than hand-rolling a racy two-step. (FR5.6 also requires capacity-decrease to demote in reverse-chronological order — that path does not exist at all; see H-8.)

---

## 4. High Findings

### [High] H1 — Notifications (FR10) are unwired end-to-end
- **Location:** `supabase/functions/create-event/index.ts` (no dispatch); no `events` UPDATE trigger in any migration; `scenecheck-expo/components/AuthBootstrap.tsx` + `lib/notifications.ts` (listener never registered — verified)
- **Category:** Doc adherence (FR10.1–10.5)
- **Issue:** FR10.1 (friend request) is the *only* notification path actually wired. `create-event` never calls `dispatch-notification`, so FR10.3 (new event in radius) never fires. No trigger or function reacts to an `events` row update, so FR10.2 (event changed/cancelled) never fires. On the client, `lib/notifications.ts` exports `registerForPushNotifications` and `onNotificationResponseReceived`, but neither is called from `AuthBootstrap` or `_layout.tsx`, so push tokens are never registered and taps cannot deep-link (FR10.4). The infrastructure is built on both ends; the connections are missing.
- **Fix:** (a) In `create-event`, after the publish gate, `void admin.functions.invoke('dispatch-notification', { body: { type: 'event.published', event_id } })`. (b) Add a migration with an `AFTER UPDATE ON events` trigger (or an explicit dispatch in the edit path) for FR10.2. (c) In `AuthBootstrap`, after session resolves:
  ```tsx
  useEffect(() => {
    registerForPushNotifications();
    const sub = onNotificationResponseReceived(r => {
      const d = r.notification.request.content.data as Record<string,string>;
      if (d?.eventId) router.push(`/event/${d.eventId}` as never);
      else if (d?.chatId) router.push(`/chat/${d.chatId}` as never);
    });
    return () => sub.remove();
  }, []);
  ```
- **Reasoning:** FR10 is a documented requirement set; the deep-link tap behavior (FR10.4) is explicitly described in the architecture doc's notification flow. Notifications are "Nice to have" priority in the use-case table, which is why this is High rather than Critical — but the asymmetry (infra written, never connected) is exactly the kind of thing a grader notices.

### [High] H2 — Age gate (FR1.2) is enforced only in the client
- **Location:** `scenecheck-expo/app/auth/sign-up.tsx` (picker `maxDate`); backend has no birthdate column/trigger
- **Category:** Doc adherence / Best practice (FR1.2)
- **Issue:** The sign-up screen computes a `maxDate` 18 years before today and passes it to `SCDatePicker` — good UX. But this is client-side only; nothing on the server stores or validates the birthdate, so a crafted request to Supabase Auth creates an under-18 account. FR1.2 says the system *shall reject* such accounts.
- **Fix:** Persist `birthdate` to `profiles` (or auth metadata) at sign-up and enforce server-side: a `CHECK`/trigger on `profiles` that raises if `age < 18`, or validation in a sign-up Edge Function. Keep the client gate as the friendly first line.
- **Reasoning:** Client-side validation is a UX nicety, never an enforcement boundary — it is trivially bypassed. A legal-age requirement in particular must live where it cannot be circumvented.

### [High] H3 — Rate-event UI is ungated; rating is not enforced server-side either (FR5.11)
- **Location:** `scenecheck-expo/app/event/[id].tsx:446-459`; `supabase/functions/rollup-rating/index.ts`
- **Category:** Doc adherence (FR5.11)
- **Issue:** The star button is shown to any non-host regardless of whether they attended or whether the event has ended; tapping opens `RateEventSheet` and submits. FR5.11 requires rating *only after attending* and *only within 24h after the event ends*. The backend `rollup-rating` enforces neither the 24h window nor attendance (it relies on the `UNIQUE(event_id, user_id)` constraint for once-only, but a never-attended stranger can still rate).
- **Fix:** Gate the button: `const canRate = !isHost && isJoined && e.endAt && new Date(e.endAt) < new Date();`. Mirror the rule server-side in `rollup-rating` / the ratings insert path: reject if no `confirmed`/`attended` subscription exists or if `now - end_at` is outside `[0, 24h]`.
- **Reasoning:** Ratings drive a host's public reputation (FR5.11 rolls them into `profiles.avg_rating`). Allowing non-attendees or pre-event ratings corrupts that signal; the rule must be enforced on the server, with the UI gate as a courtesy.

### [High] H4 — No CI workflow for lint / typecheck / tests
- **Location:** `.github/workflows/` (only `scrape-events.yml` exists)
- **Category:** Doc adherence
- **Issue:** The architecture doc's Build & CI row mandates "Ubuntu runners for ESLint, Prettier, TypeScript typecheck, and unit tests … CI catches lint/type errors pre-merge." `TEST_PLAN.md §1.5` repeats this. None of it exists. Every merge to `main` runs with no automated gate, despite a 412-test suite that runs in ~5s.
- **Fix:** Add `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npx tsc --noEmit`, and `npm test` against `scenecheck-expo/` on push + PR to `main`. Add a second job (`denoland/setup-deno@v2`) running `deno test supabase/functions/_shared/interest-matching.test.ts` so the analyzer's tests finally run automatically (see H-9 context). Optionally a pgTAP job (`supabase start && supabase test db`).
- **Reasoning:** Tests that don't run in CI are tests that drift. This is the single highest-leverage missing piece — the suite already exists; it just needs a gate. It also directly satisfies a documented architecture invariant.

### [High] H5 — Scraper `fetch` calls have no per-request timeout
- **Location:** `scripts/scrape-events.mjs` — `fetchSourceHtml` (~line 111) and `ingest` (~line 208)
- **Category:** Best practice (FR6.4)
- **Issue:** Neither network call passes an `AbortSignal`/timeout. A host that accepts the connection but never responds holds the slot until the job-level `timeout-minutes: 15` fires. With 6 sequential sources × 3 retries, one hung host can starve every later source. The architecture doc names this exact risk: "a single hanging target site can time out the entire job, making … per-fetch timeouts critical."
- **Fix:**
  ```js
  async function fetchWithTimeout(url, options = {}, ms = 15_000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try { return await fetch(url, { ...options, signal: c.signal }); }
    finally { clearTimeout(t); }
  }
  ```
  Use it in both call sites; expose `SCRAPE_FETCH_TIMEOUT_MS` / `INGEST_TIMEOUT_MS` to match the existing `SCRAPE_RETRIES` env pattern. Consider `Promise.allSettled` over the sources so a slow one can't block the others (currently sequential).
- **Reasoning:** FR6.4 requires skipping a failing source "without disrupting other functionality." A stalled socket is not caught by the retry loop (it isn't an error until the OS tears it down). A bounded timeout is what converts a hang into a catchable, skippable failure.

### [High] H6 — Report action is a no-op but promises a 24-hour review (FR11.2)
- **Location:** `scenecheck-expo/app/profile/[id].tsx:296-298` (verified)
- **Category:** Doc adherence / Best practice (FR11.2)
- **Issue:** `handleReport`'s dialog body says "Our team will review their account within 24 hours," and `onConfirm` only shows "Report submitted. Thank you." No `reports` row is written, despite the backend `reports` table + RLS existing. FR11.2 requires reports to be persisted for moderation.
- **Fix:** Call an `api.reportUser(id, reason)` (insert into `reports`). If no report endpoint exists yet, add one (the table does); until then, change the copy so it doesn't claim review will happen.
- **Reasoning:** Same class as C1 — a safety affordance that does nothing while telling the user it worked. Persisting to the existing `reports` table closes it.

### [High] H7 — Account type (Individual / Organization) cannot be chosen at sign-up (FR1.4)
- **Location:** `scenecheck-expo/app/auth/sign-up.tsx`
- **Category:** Doc adherence (FR1.4, FR2.3)
- **Issue:** Sign-up collects name/email/password/birthdate but no account type. The whole organization experience downstream (`profile/[id].tsx` branches on `type === 'org'`, org follow, org events) is reachable only if `account_type` is set directly in the DB — there's no UI path to create an org account.
- **Fix:** Add an Individual/Organization selector to sign-up (reuse the visibility-selector pattern from `create-event.tsx`) and pass it to `api.signUp` → `profiles.account_type`.
- **Reasoning:** FR1.4 is a "shall." One of the two defined user types currently cannot exist through the product.

### [High] H8 — Waitlist join is indistinguishable from a normal join; capacity-decrease demotion is unimplemented (FR5.5, FR5.6)
- **Location:** `scenecheck-expo/app/event/[id].tsx:188-189, 462-466`; `subscribe-to-event` path
- **Category:** Doc adherence (FR5.5, FR5.6)
- **Issue:** The button relabels to "JOIN WAITLIST" at capacity, but `handleToggleJoin` calls the same `api.subscribeToEvent(id, true)` and shows a generic "Joined" toast. There's no waitlist position feedback, and on the backend no path implements FR5.6's "if the limit decreases, remove subscribers in reverse-chronological order and re-queue them." `promote-waitlist` (see C2) is the only waitlist mutation and it's broken.
- **Fix:** Surface the `subscribe_to_event_atomic` return (`status: 'waitlisted'`, `waitlist_position`) to the UI — toast "You're #N on the waitlist." Implement the capacity-change handler (a trigger on `events.capacity` or logic in the edit path) that promotes/demotes atomically per FR5.6.
- **Reasoning:** Telling a user "Joined" when they were waitlisted is misleading and risks over-committing capacity in the user's mental model. FR5.5/5.6 describe a precise FIFO contract that currently has no faithful implementation.

### [High] H9 — `api.getChatMessages` returns DB rows cast to the domain `Message[]` — a type lie
- **Location:** `scenecheck-expo/lib/api.ts:938-948`
- **Category:** Best practice / Correctness
- **Issue:** The signature promises `Promise<Message[]>` (domain shape: `from`, `who`, `text`, `time`) but `return data as Message[]` returns raw DB rows (`sender_id`, `body`, `created_at`). `useChatMessages` compensates by re-casting to `DbMessageRow[]` and transforming, so the screen works — but any other caller (or a test) that trusts the declared type gets `undefined` for `.text`/`.time`. The cast defeats the type safety the architecture doc chose TypeScript for.
- **Fix:** Either (a) change the return type to `DbMessageRow[]` (honest; drop the hook's re-cast) or (b) transform inside `api.ts` and return real `Message[]`.
- **Reasoning:** A function whose declared type doesn't match its runtime value silently poisons every downstream call site — exactly the class of bug TypeScript is meant to prevent.

### [High] H10 — `subscribe-to-event` does not check event status; draft events are subscribable
- **Location:** `supabase/functions/subscribe-to-event/index.ts` / `subscribe_to_event_atomic` (00015)
- **Category:** Best practice / Doc adherence (FR5.4)
- **Issue:** The atomic subscribe checks capacity and idempotency but not the event's `status`. FR5.4 establishes a publish gate (draft → published once minimum subscribers reached); a function that lets users subscribe to a `draft`/unpublished event undercuts that lifecycle.
- **Fix:** In the RPC, `SELECT status` alongside capacity and reject (or treat as the pre-publish "exact-tag-match only" visibility) when `status <> 'published'`, per the FR5.4 rules.
- **Reasoning:** The publish gate is meaningless if the subscribe path ignores it. Enforce the state machine at the one chokepoint that mutates membership.

---

## 5. Medium Findings

### [Medium] M1 — `create-event` re-implements the publish gate inline instead of calling `check_publish_gate`
- **Location:** `supabase/functions/create-event/index.ts`; `supabase/migrations/00012_create_functions.sql` (`check_publish_gate`)
- **Category:** Cohesion/coupling (FR5.4)
- **Issue:** A `check_publish_gate` SQL function exists but `create-event` computes the gate inline, so the rule lives in two places that can diverge.
- **Fix:** Call the SQL function from the Edge Function; delete the inline duplicate.
- **Reasoning:** One rule, one home. Duplicated business logic across the TS/SQL boundary is the classic source of "fixed in one place, still broken in the other."

### [Medium] M2 — Two parallel theme systems coexist
- **Location:** `theme/ThemeProvider.tsx` + `theme/tokens.ts` + `useTokens()` (the live system) vs. `constants/theme.ts` + `hooks/use-theme-color.ts` + `useThemeColor()` (Expo scaffold), consumed only by dead template components `themed-text.tsx`, `themed-view.tsx`, `parallax-scroll-view.tsx`, `ui/collapsible.tsx`
- **Category:** Consistency / Cohesion
- **Issue:** The two systems can't agree — `Colors.light.tint` (#0a7ea4) has no counterpart in `PALETTES`, and the scaffold components ignore the user's palette/mode entirely. None of them are used by any screen.
- **Fix:** Delete the four scaffold components and `constants/theme.ts` + `use-theme-color.ts` (simplest — they're dead), or migrate them to `useTokens()`.
- **Reasoning:** A second, conflicting theming pipeline is a trap for the next contributor who reaches for the wrong hook. Removing dead code removes the ambiguity.

### [Medium] M3 — `EventKind = 'org'` is a ghost variant
- **Location:** `types/domain.ts:5`; `data/mocks.ts` (3 records); never produced by `lib/events.ts:eventCategory()` or `lib/api.ts:transformEventRow`
- **Category:** Consistency / Doc adherence
- **Issue:** `EventKind` declares `'org'`, three mock events use it, but the classifier never returns it (it folds to `'recommended'`/`'other'`), and the live transform never produces it. A reader must cross-check the type against the switch to discover one variant is unreachable.
- **Fix:** Decide intent: if `'org'` is no longer a display bucket, remove it from `EventKind` and reassign the mocks; if planned, add a comment and a real branch.
- **Reasoning:** A type that promises a case the code silently drops invites future bugs and confuses FR4.4 (user-vs-app distinction) reasoning.

### [Medium] M4 — `useDateCityLabel` mounts a second `useLocation`, double-reading GPS
- **Location:** `hooks/useDateCityLabel.ts:14`; `app/(tabs)/map.tsx:46` (already calls `useLocation`)
- **Category:** Cohesion / Best practice
- **Issue:** Hooks don't share instances; the map screen ends up with two independent `useLocation`s, each firing `getCurrentPositionAsync()` on mount. Wasteful and race-prone (header city vs. map center can briefly diverge on a slow fix).
- **Fix:** Make `useDateCityLabel(coords, status)` accept location as parameters; pass through the caller's existing `useLocation()` result. (Longer term, lift location into a single context/store slice.)
- **Reasoning:** One concern (device location) should have one source per screen. This also makes the label hook a pure, testable computation.

### [Medium] M5 — `create-event` group-chat & calendar opt-ins default to `true` with no UI (FR5.9, FR7.2)
- **Location:** `app/create-event.tsx:50-51` (`autoGroupChat: true`, `addToCalendar: true`)
- **Category:** Doc adherence (FR5.9, FR7.2)
- **Issue:** Both are defaulted on with no toggle, so the user never consents to auto-creating a chat or a calendar entry. FR5.9/FR7.2 call for opt-in controls.
- **Fix:** Add two switches below the Visibility field (reuse the settings toggle pattern).
- **Reasoning:** "Opt-in" means the user chooses; a hidden default-true is not consent.

### [Medium] M6 — Multi-source dedup key can collide across cities
- **Location:** `scripts/scrape-events.mjs` (`scrapeEvents` merge: key = `title|start_at|lat,lng`); also relevant to `ingest-scraped`
- **Category:** Best practice (FR6)
- **Issue:** The de-dup key includes coordinates, which is reasonable, but two genuinely distinct events with the same title and start time at the same venue (recurring series, or rounded coords) collapse to one. Conversely there's no DB-level uniqueness, so re-runs can insert near-duplicates if the key shifts slightly.
- **Fix:** Prefer a stable natural key — `source_url` is the most reliable per-event identity from Eventbrite's JSON-LD; de-dup on that and add a partial unique index on `(source, source_url)` for scraped rows.
- **Reasoning:** Identity should come from the source's own canonical URL, not a fuzzy title/time/coord triple.

### [Medium] M7 — `chat/[id].tsx` scroll-to-bottom `setTimeout` isn't cleaned up and under-triggers
- **Location:** `app/chat/[id].tsx:57-60`
- **Category:** Best practice
- **Issue:** `useEffect(() => { setTimeout(...50) }, [msgs.length])` — no `clearTimeout` (leaks if unmounted within 50ms) and keying on `.length` misses same-length updates (edited/replaced message).
- **Fix:** `const t = setTimeout(...); return () => clearTimeout(t);` and depend on `[msgs]`.
- **Reasoning:** Always clean up timers in effects; depend on the data, not its length.

### [Medium] M8 — Stale CI / doc signals: README test count, fallback masking, doc-vs-code auth drift
- **Location:** `README.md:37` ("385 tests" vs actual 412); `scripts/scrape-events.mjs` fallback branch (exits 0 even when only 3 seed events ingested); architecture doc ~236/~353 (still documents `Authorization: Bearer {service_role_key}` + endpoint `ingest_scraped`, code uses `apikey: sb_secret_…` + `x-ingest-token` + `--no-verify-jwt` against `ingest-scraped`)
- **Category:** Doc adherence / Consistency
- **Issue:** Three drift instances. The README undercounts tests by 27. The scraper can't be distinguished in CI between "scraped 40 live" and "fell back to 3 seeds." The architecture doc describes an auth contract the Supabase key migration made obsolete.
- **Fix:** (a) Update README to 412 (or drop the count). (b) `process.exitCode = 2` (or a `GITHUB_OUTPUT` flag + annotation) when the fallback path is taken, so a degraded run is visible. (c) Update the architecture doc's ingest section to the real `apikey + x-ingest-token + --no-verify-jwt` flow and fix the `ingest_scraped` → `ingest-scraped` name.
- **Reasoning:** Governance docs and CI signals are only useful if they describe reality. For a graded deliverable, drift between the doc and the running system costs credibility (and points).

### [Medium] M9 — `organizer-remove` sends no notification to the removed user (FR5.10/FR11.3)
- **Location:** `supabase/functions/organizer-remove/index.ts`
- **Category:** Doc adherence (FR11.3; architecture notification flow)
- **Issue:** The cascade (mark subscription removed, drop chat membership) is correct, but the architecture's notification triggers list includes "Organizer removes user from event," and no `dispatch-notification` call is made.
- **Fix:** `void admin.functions.invoke('dispatch-notification', { body: { type: 'event.removed', user_id, event_id } })` after the cascade.
- **Reasoning:** A removed user should be told; the architecture lists this as a push trigger.

### [Medium] M10 — Unfollow (FR7.1) and ratings sort are client-only / unstable
- **Location:** `app/my-following.tsx:68-72` (unfollow store-only, no API); `app/ratings/[hostId].tsx:64-66` (sort by `id.localeCompare`)
- **Category:** Best practice / Doc adherence
- **Issue:** Unfollowing toggles the store and toasts but calls no API, so it reverts on next hydrate. Reviews are sorted by review `id` — fine for mock `r1/r2`, meaningless for live UUIDs (random order, newest reviews buried).
- **Fix:** Unfollow → optimistic store update + `api.unfollowOrg(id)` with error recovery (mirror the friend-toggle pattern). Ratings → sort on a real timestamp field.
- **Reasoning:** Same persist-the-action principle as C1/H6; and user-facing ordering must be based on a meaningful field, not an opaque key.

---

## 6. Low Findings (polish)

- **L-1 — CI least-privilege:** `scrape-events.yml` has no `permissions:` block; add `permissions: { contents: read }`. (Defense in depth.)
- **L-2 — Pin CI runners/actions:** `ubuntu-latest` + `@v4` major-only tags are non-deterministic; pin `ubuntu-24.04` and full action versions.
- **L-3 — `api.subscribeToInterest` is dead:** never called (`setInterestSubscribed` is the live one) and would double-apply `toUUID`. Remove it. (`lib/api.ts:840-849`)
- **L-4 — `useLocation.request` is recreated each render:** wrap in `useCallback([])` and drop the `eslint-disable`. (`hooks/useLocation.ts:28-58`)
- **L-5 — `formatTime` duplicates `lib/date-time.ts:isoToTime`:** import the canonical helper in `useChatMessages.ts:208`.
- **L-6 — `MILES_TO_METERS` redeclared** in `map.tsx:40` and `search.tsx:28` (and inlined in `home`): extract to `lib/units.ts`.
- **L-7 — UCI default coords as magic numbers** in `api.fetchEvents` (`33.6461 / -117.8427`): import `DEFAULT_REGION` from `components/Map/types.ts` (the last residue of the Round-2 coordinate dedup).
- **L-8 — `events.tsx:85` hardcoded "Sat May 9 · Irvine"** (verified): swap for `useDateCityLabel()` like Home/Map already do — the literal is a stale, always-wrong placeholder.
- **L-9 — `interests/[tag].tsx:97` activity chart is a fixed fixture** (`[3,5,4,6,7,8,9,11,9,7,5,4]`) shown for every tag: fetch real per-tag activity or label it "sample."
- **L-10 — Index keys** in `help.tsx:50` and the `ratings/[hostId].tsx:157` star row: use semantic keys (`row.label`, `` `star-${i}` ``).
- **L-11 — `profile/[id].tsx` loading state is a blank screen:** add a skeleton like the other detail/list screens (consistency).
- **L-12 — `useFollowedOrgs` effect deps** include both `idsKey` and the redundant `ids` (`hooks/useFollowedOrgs.ts:57-59`): drop `ids`.
- **L-13 — Toast magic number** `3600` in `useStore.ts:357`: name it `TOAST_DEFAULT_MS = 3_600`.
- **L-14 — `create_chat` RPC doesn't pre-validate `p_type`** (`00017`): raise a clean error instead of leaning on the CHECK constraint message.
- **L-15 — `tag_relations` table is never read** (FR3.4): the ranker matches exact `interest_id` only; the related-tag weights table from 00003 and the doc's `recomputeTagRelations` are absent. Either wire it into `rank_events_query`'s score or mark it explicitly as a stub.
- **L-16 — JSON-LD regex is brittle** to `</script>` in string values / CDATA (`scrape-events.mjs:73`): strip CDATA before `JSON.parse`.
- **L-17 — `AGENTS.md`/`CLAUDE.md` are one line each:** add a short orientation (mock-vs-live boundary, `@/` alias, platform splits, zustand/metro workaround, Deno test location) so agents/new contributors don't break existing constraints.
- **L-18 — Node version disagreement:** docs say 24 (`TEST_PLAN §1.5`), 20 (scraper header + arch doc), workflow uses 22. Pick one (22 LTS) and align all three.

---

## 7. Requirements Traceability (consolidated backend + UI)

Legend: ✅ done · ◑ partial · ✗ missing/broken

| FR | Requirement | Backend | UI | Notes |
|---|---|---|---|---|
| FR1.1 | Email/password signup | ✅ | ✅ | Supabase Auth + `sign-up.tsx` |
| FR1.2 | Age gate ≥18 | ✗ | ◑ | Client `maxDate` only; **no server enforcement** (H2) |
| FR1.3 | First-login questionnaire | ✗ | ✗ | Goes straight to tabs; empty "FOR YOU" on first run |
| FR1.4 | Account type person/org | ✅ (column) | ✗ | No signup selector (H7) |
| FR1.5 | Location prompt | n/a | ✅ | `useLocation` + fallback banner |
| FR2.1 | Profile fields | ✅ | ✅ | + EditProfileSheet |
| FR2.2 | Visibility public/private | ✅ (RLS) | ✅ | RLS sound (00014) |
| FR2.3 | Org profile | ✅ | ◑ | Org view exists; unreachable without FR1.4 |
| FR3.1–3.3 | Subscribe / search / create tags | ✅ | ✅ | |
| FR3.4 | Related-tag matching | ◑ | ◑ | Scraper auto-tag uses `similar_tags`; ranker ignores `tag_relations` (L-15) |
| FR4.1–4.4 | Map, radius/city, search, user-vs-app pins | ✅ | ✅ | `rank_events` + `pinColor` |
| FR4.5 | Participant + waitlist counts | ◑ | ◑ | Going count shown; waitlist count not surfaced |
| FR5.1–5.2 | Create event, capacity | ✅ | ✅ | |
| FR5.3 | Host analytics | ✗ | ✗ | Not built |
| FR5.4 | Publish gate | ◑ | ◑ | Gate exists; subscribe ignores status (H10); duplicated logic (M1) |
| FR5.5 | Capacity + waitlist | ◑ | ◑ | Atomic subscribe ✅; waitlist join == normal join (H8) |
| FR5.6 | Capacity adjust promote/demote | ✗ | ✗ | No demotion; promote broken (C2) |
| FR5.7 | Edit event | ✅ | ✅ | RLS UPDATE + EditEventSheet |
| FR5.8 | Attendee list | ✅ | ✅ | |
| FR5.9 | Group-chat opt-in | ✅ | ✗ | Backend honors `join_chat`; no UI toggle (M5) |
| FR5.10/11.3 | Organizer remove | ✅ | ✗ | Function works; no remove button on attendees; no notify (M9) |
| FR5.11 | Rate after attending, ≤24h | ◑ | ✗ | UNIQUE only; no window/attendance check; UI ungated (H3) |
| FR6.1–6.4 | Scrape/auto-tag/validate/log | ✅ | n/a | Solid; no fetch timeout (H5); dedup key (M6); fallback masking (M8) |
| FR7.1 | Subscribe = attendee | ✅ | ✅ | Unfollow doesn't persist (M10) |
| FR7.2 | Google Calendar | ✗ | ◑ | Defaulted true, no toggle, OAuth not wired (M5) |
| FR7.3 | Group-chat opt-in on join | ✅ | ◑ | No explicit opt-in step in join flow |
| FR8.1–8.2 | Search users, friend req | ✅ | ✅ | |
| FR8.3 | Block prevents request | ✅ | ✗ | Backend `is_blocked` check ✅; block never persists (C1) |
| FR8.4–8.5 | Follow attendees, share events | ✅ | ✅ | |
| FR9.1–9.4 | DM / block / group / event chat | ✅ | ◑ | RLS ✅; chat opt-in flow thin |
| FR9.5 | Announcements | ✗ | ✗ | No distinguished announcement type |
| FR10.1 | Friend-request notify | ✅ | ◑ | Dispatched; tap-to-deep-link unwired (H1) |
| FR10.2 | Event update notify | ✗ | ✗ | No trigger (H1) |
| FR10.3 | Proximity new-event notify | ✗ | ✗ | `create-event` never dispatches (H1) |
| FR10.4–10.5 | Tappable deep-link / in-app+push | ✗ | ✗ | Listener never registered (H1) |
| FR11.1 | Block user | ✅ | ✗ | Persist gap (C1) |
| FR11.2 | Report | ✅ (table) | ✗ | No-op UI (H6) |

---

## 8. Cohesion / Coupling Assessment

**Strong:** The `_shared/` Edge Function module (CORS, auth, validators, client) centralizes cross-function concerns well — no copy-pasted CORS or token parsing. The interest-matching analyzer is a pure, single-responsibility module with its own test suite. On the client, the **hook layer is uniformly single-purpose** (one resource per hook, `{data, loading, error, reload}` shape, universal `cancelled`-flag cleanup), and `lib/api.ts` is a clean UI↔backend boundary — no screen talks to supabase-js directly. The Zustand store's slices are cohesive and its `Set` persistence (`partialize`/`merge`) is exactly right.

**Coupling to address:** (1) The publish-gate logic lives in both `create-event` and `check_publish_gate` (M1). (2) `useDateCityLabel` reaches into `useLocation` internally, coupling a label to a second device-GPS read (M4). (3) `mocks.ts` is imported by production hooks — acceptable because the `isMock()` guard + Metro tree-shaking keep it out of live bundles, but it's visible coupling worth a comment. (4) The scraper's ingest field contract is duplicated (implicitly) between `scrape-events.mjs` and `ingest-scraped`; a shared schema/validator would keep them in lockstep.

---

## 9. Consistency Assessment

**Strong:** The `my-*.tsx` list screens follow one template; the optimistic-then-commit interaction pattern is applied identically across join/friend/follow; route registration in `_layout.tsx` is explicit and commented; the SC* design-system components share a coherent prop API.

**Inconsistent:** (1) Two theming systems (M2). (2) A ghost `EventKind` variant (M3). (3) `chat/[id].tsx` skips the `<Screen>` wrapper every other screen uses (justified by `KeyboardAvoidingView`, but it forfeits shared bg/inset/refresh). (4) `useInterest` lacks the `reload()` every sibling hook exposes; `useUserInterests` swallows errors with no `error` in its return shape. (5) Node version stated three different ways across docs (L-18). (6) RPC naming: the architecture doc uses `snake_case` endpoints (`rank_events`, `subscribe_to_event`) while the code ships `kebab-case` Edge Functions (`rank-events`, `subscribe-to-event`) — harmless but the doc should note the convention, and several documented return shapes omit fields the code returns (`waitlist_position`).

---

## 10. Prioritized Action List

1. **C1 — Persist the block action.** (Safety; ~10 lines.)
2. **C2 — Add the organizer authorization check to `promote-waitlist` and make it atomic.** (Access control.)
3. **H2 — Enforce the age gate server-side.** (Legal "shall".)
4. **H6 — Persist the report action (or fix the copy).** (Safety/trust.)
5. **H4 — Stand up the CI workflow (lint + tsc + jest + deno test).** (Highest leverage; suite already exists.)
6. **H1 — Wire notifications end-to-end** (create-event dispatch, update trigger, client listener registration).
7. **H3 / H10 — Enforce rating gating and event-status checks server-side.**
8. **H5 — Add per-request fetch timeouts to the scraper; consider parallelizing sources.**
9. **H7 / H8 — Add the account-type selector; make the waitlist path distinct from a normal join.**
10. **Medium/Low cleanups** — M1–M10 and L-1…L-18, with the doc-drift items (M8, L-18) folded into a single documentation-sync pass.

**Bottom line:** This is a capable, well-architected project whose remaining work is overwhelmingly about *finishing connections that already have both ends built* — persist the safety actions, enforce in the backend what the client currently assumes, wire notifications, and put the existing test suite behind a CI gate. None of the Critical/High items require new architecture; they require closing the last wire on features the team has already designed correctly.
