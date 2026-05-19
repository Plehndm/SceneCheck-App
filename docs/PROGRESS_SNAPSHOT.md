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

_Last updated: 2026-05-19_

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

_Last updated: 2026-05-19_

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

_Last updated: 2026-05-19_

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

## 12. How to re-snapshot this file

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
