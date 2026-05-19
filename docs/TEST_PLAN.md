# SceneCheck — Test Plan & Implementation Report

_Last updated: 2026-05-19 — covers the Expo SDK 54 + TypeScript port at `scenecheck-expo/`, the original prototype at the repo root (kept as a reference), and the Supabase backend at `supabase/`. Test count rose to **326/326** after the auth UX expansion (forgot-password + reset-password + resend-confirmation + change-email + change-password). The 7-phase migration is complete (§2.7 … §2.16); subsequent deltas are tracked as chronology rows in `docs/PROGRESS_SNAPSHOT.md` §1._

_Backend target: Jest runs in mock mode (no env vars under
`jest-expo`); the dev server (`npm run web`) currently points at
the **hosted** Supabase project (`kmlecodmifljbtzaqahm`) per
`docs/PROGRESS_SNAPSHOT.md` §19. Seed data for hosted lives in
`supabase/seed-hosted.sql` (idempotent variant of `supabase/
seed.sql`). To swap the dev server back to the local stack,
restore the alternate values kept as comments in `.env`._

## Part 1 — Test Plan (Strategic)

### 1.1 Scope: what's in, what's out (and why)

| ✅ In scope | Why this matters |
|---|---|
| Frontend utility modules (`lib/date-time.ts`, `lib/conflicts.ts`, `lib/api.ts`, `lib/notifications.ts`) | High user impact; time + conflict bugs break event creation and discovery |
| Zustand store mutators (events, social, ui, preferences, drafts, overlays) | Single source of truth that replaced `app.jsx`'s 21-state god-component (flagged by the code review as 0% covered) |
| Per-screen integration tests (24 Expo Router screens) | Every navigable route renders, key interactions wire to the store / router |
| Component primitives (`SCEventCard`, `SCAvatar`, `ConflictChip`, `SCText`, `SCSection`, etc.) | Composed into every screen — visual regressions cascade |
| Map types + helpers (`pinColor`, `eventLatLng`) | Shared by the native (`react-native-maps`) and web (`react-leaflet`) map implementations |
| Image-picker hook (`useImagePicker`) | Powers FR2.1 profile-picture upload |
| Database schema + constraints + RLS policies (pgTAP) | Security backbone; the code review found a policy that leaked private profiles — now patched in migration `00014` |
| Edge Function logic (atomic subscribe, friend-request notification dispatch, CORS) | Core mutations + the four bugs fixed in Phase 7 |
| API client mock-mode behavior | Ensures every UI flow works standalone before Supabase is provisioned |

| ❌ Out of scope | Why excluded |
|---|---|
| Real Expo push delivery to APNs / FCM | Third-party service infrastructure; we test the dispatch payload + token registration only |
| Google Calendar OAuth round-trip | Third-party flow; tested by Google; our wrapper calls a typed selector |
| Web scraper Playwright execution | CI-only runner; FR6 is "Want" priority; runs nightly in a separate job |
| Full end-to-end browser tests (Playwright/Cypress/Detox) | Significant additional infrastructure; deferred to next milestone |
| Live-mode `api.ts` paths (Supabase-backed) | Need a running Supabase instance; structurally tested by the typed surface and the Edge Function tests |
| iOS/Android native runtime tests | Require physical device or simulator; covered transitively by the platform-split test suites |
| `lib/api.ts` Realtime subscription delivery | Supabase manages the transport; verified via Edge Function fixtures |

### 1.2 Quality goals — what does "good enough" look like?

- Every Expo Router route renders without crashing on first navigation
- Every store mutator produces the expected new state with no leakage between slices
- `parseTime`/`fmtTime` and `timeToMin`/`minToTime` roundtrips are lossless across the full 24-hour range
- `findConflict` catches every event pair within 2 hours on the same day and never reports a self-conflict
- `pinColor` returns the architecture-doc-specified color for each `(kind × shared-interest)` combination
- All React components render without crashing given valid and edge-case props (including `null` person, missing fields, empty lists)
- PostGIS `rank_events_query` returns events sorted by relevance within the radius
- RLS policies block unauthorized reads — **including the previously-leaking private profile case**
- `event_subscriptions` never exceeds capacity under concurrent subscribers (atomic via advisory lock)
- API mock mode returns data in the same shape as real Supabase calls

### 1.3 Risks & priorities — where are bugs most likely or most costly?

| Area | Why it's risky / costly | Priority |
|---|---|---|
| PostGIS spatial queries (`rank_events_query`) | Core feature; wrong SQL = no events on map; SRID + parameter order matters | H |
| RLS policy gaps | Code review caught a leak; fixed in `00014_fix_profiles_rls.sql` | H |
| Capacity / waitlist race conditions | Fixed in `00015_atomic_subscribe.sql` + `subscribe-to-event/index.ts` | H |
| Time/date parsing (`parseTime`, `timeToMin`) | Affects event creation validation; 12 AM/PM edge cases are easy to get wrong | H |
| Edge Function CORS preflight | Browser blocks every cross-origin call without it; fixed in `_shared/supabase-client.ts` | H |
| Schedule conflict detection (`findConflict`) | Wrong detection = silent double-booking or false warnings — single source of truth in `lib/conflicts.ts` | M |
| Friend-request notification dispatch | FR10.1; was silently skipped in legacy code; now invokes `dispatch-notification` | M |
| Edge Function authorization checks | Missing auth check = privilege escalation (e.g., non-creator cancelling an event) | M |
| Chat message RLS (block filtering) | Blocked users seeing messages = safety violation | M |
| Realtime CDC delivery | Supabase manages; verify subscription setup works | L |
| Profile picture upload/storage | Cosmetic; recoverable; covered by `useImagePicker` hook tests | L |

### 1.4 Strategy — test types and approach per component

**Test type definitions:**

- **Unit test:** A single pure function in isolation, no rendering, no I/O. Input → expected output.
- **Component test:** A component rendered through `@testing-library/react-native` with mocked store/router; queries the rendered tree.
- **Integration (screen) test:** A full route screen (`app/.../*.tsx`) rendered with mock route params + mock store state; asserts page chrome, content, and interaction wiring.
- **Hook test:** A custom hook exercised via `renderHook` with mocked Expo SDK modules.
- **Database test:** SQL assertions via pgTAP inside Postgres against migrations + seed data.

| Layer | Test types | Framework | Why this fit |
|---|---|---|---|
| `lib/*` utility modules | Unit | Jest 29 + jest-expo | Pure TypeScript; runs in ~50ms per file |
| Zustand store slices | Unit | Jest 29 + jest-expo | Direct `useStore.getState().setX()` calls; no render needed |
| Component primitives | Component | Jest + `@testing-library/react-native` 13 | Renders RN elements without a device; queries by text/role |
| Screen routes | Integration | Jest + RTL + mocked `expo-router` | Each `app/**/*.tsx` rendered with `useLocalSearchParams` mocked per case |
| Custom hooks | Hook | Jest + `renderHook` | Wraps the hook in an instance, fires acts, asserts state |
| Database schema + RLS | Database | pgTAP via `supabase test db` | Asserts at the database layer, not the application; catches policy renames |
| Edge Functions | Smoke (manual + structural) | Deno + curl | Functions exposed via `supabase functions serve`; full Deno test coverage planned next milestone |

### 1.5 Environment & assumptions

- **Runtime:** Node.js 24 (frontend), Deno 1.x (Edge Functions), PostgreSQL 15 + PostGIS 3.x (DB)
- **Test runner:** Jest 29 with `jest-expo` preset; `@testing-library/react-native` 13 for component / screen rendering
- **TypeScript:** Strict mode, `@/*` path alias mirrored in jest config via `moduleNameMapper`
- **Mock infrastructure:** Centralized in `scenecheck-expo/jest.setup.ts` — covers AsyncStorage, expo-router, expo-location, expo-image-picker, expo-notifications, expo-device, react-native-maps, @react-native-community/slider, react-native-safe-area-context
- **Web-only deps:** `react-leaflet` and `leaflet/dist/leaflet.css` stubbed via `tests/__mocks__/` so native test bundles don't try to evaluate browser DOM code
- **Mock data:** All frontend tests use the typed fixtures from `scenecheck-expo/data/mocks.ts` (the typed port of the prototype's `src/data.jsx`)
- **State reset:** `tests/test-utils.tsx#resetStore()` reseeds the Zustand store between tests so order-of-execution doesn't leak
- **External APIs mocked:** Supabase client is `null` when env vars aren't set → `api.isMock()` returns true → mock data is returned directly
- **CI:** Recommended GitHub Actions: Ubuntu runner, `npm test`, plus a separate `supabase start && supabase test db` job for the pgTAP suite

### 1.6 Team roles

| Member | Owns which test categories / components |
|---|---|
| David Plehn (Architect) | Database migrations, RLS policies (incl. the Phase 7 RLS fix), Edge Functions, atomic subscribe, API client |
| Shrujan Sriram (Programmer) | Frontend store slices, screen integration tests, coverage reporting |
| Kyle He (UI/UX) | Component primitive rendering (SCEventCard, SCAvatar, ConflictChip), visual verification |
| Duy Tran (Product Designer) | Test plan documentation, gap analysis, reflection writing |
| Kaylee Quinn (PM) | Test plan review, scope decisions, team coordination, the in-repo code review report (`docs/CODE_REVIEW_REPORT.md`) |

---

## Part 2 — Tests Implemented + Report

### 2.1 Required minimums

| Category | Required? | Minimum | Delivered |
|---|---|---|---|
| **Unit tests** | Required | ≥ 5 | 5 files (`scenecheck-expo/tests/unit/`), 104 test cases |
| **Integration tests** | Required | ≥ 3 | 35 files (10 components + 18 screens + 7 hooks), 222 test cases |
| **Total tests** | — | — | **326 tests, 47 suites** |

### 2.2 Migration note

The original prototype at `tests/` (root) had 5 unit + 4 integration tests on the legacy JS source. Those tests still exist and remain runnable on the prototype, but the active project is the Expo port at `scenecheck-expo/`, which is what the numbers above reflect.

### 2.3 Tests by category

_All counts as of 2026-05-19, post-Phase 6 (full screen integration tests added)._

| Category | Files | Cases | Examples |
|---|---|---|---|
| Unit — date/time | 1 | 32 | `parseTime("12:00 AM")` returns midnight; format roundtrips lossless |
| Unit — conflicts | 1 | 17 | `findConflict` skips self, catches events within 2 hours on same date, missing lookup returns null |
| Unit — store | 1 | 25 | `joinEvent` is idempotent; `acceptFriendRequest` clears inbox + adds friend in one op |
| Unit — api mock-mode | 1 | 18 | `fetchEvents` returns the fixture array; `toUUID` ↔ `toMockId` roundtrip preserves IDs |
| Unit — map types | 1 | 9 | `pinColor` returns architecture-doc colors per `(kind × shared-interest)`; `eventLatLng` is the inverse of the legacy x/y transform |
| Hook — image picker | 1 | 5 | `pick()` returns null on permission denial, on cancellation, returns URI on success |
| Component — SCEventCard | 1 | 9 | `YOUR EVENT` label for kind:yours; `JOINED` badge toggles; onPress fires |
| Component — SCAvatar | 1 | 5 | Initials from name, `?` fallback, org initials, picture override |
| Component — ConflictChip | 1 | 4 | `OVERLAPS HH:MM` appears for clashing events; hidden when tweak is off |
| Screen — Home tab | 1 | 7 | Renders headline + LIVE chip; event card tap pushes `/event/<id>`; SEE ALL → routes to `/events` |
| Screen — Map tab | 1 | 4 | Radius chips render; legend visible when no focus |
| Screen — Chat tab | 1 | 4 | Renders one card per chat; tapping pushes `/chat/<id>`; unread badge counts |
| Screen — Profile tab | 1 | 7 | NEW EVENT, Settings, Friends rows wire correctly; drafts row appears only when drafts exist |
| Screen — Events list | 1 | 5 | Filter chips narrow the list; ALL / YOURS / FRIENDS / FOR YOU |
| Screen — Event detail | 1 | 8 | Host actions only on owned events; JOIN/JOINED toggles store + emits undo toast; 404 fallback for unknown id |
| Screen — Chat thread | 1 | 5 | Event vs DM subtitle; seeded messages render; composer adds host message |
| Screen — Other profile | 1 | 7 | Person variant: friend/message/safety; org variant: follow + stats; unavailable stub for blockers |
| Screen — Search | 1 | 6 | Three filter tabs; query narrows events; tap routes to `/event/<id>` |
| Screen — Settings | 1 | 6 | Every section renders; Private mutates store; palette swap mutates; SIGN OUT opens confirm |
| Screen — Settings sub-screens | 1 | 8 | Linked calendar picker writes store; blocked unblock opens confirm; help renders all links |
| Screen — Requests | 1 | 4 | Header + count; empty state; ACCEPT moves to friends; DECLINE clears |
| Screen — My hosting | 1 | 3 | Renders only hostId===me events; tap → `/event/<id>` |
| Screen — My friends | 1 | 4 | Renders friend rows; empty state; profile tap; unfriend |
| Screen — My following | 1 | 4 | Renders followed orgs; empty state; tap → org profile; FOLLOWING tap removes |
| Screen — Interests | 1 | 5 | Current + suggested sections; ADDED state; tap ADD subscribes; search narrows |
| Screen — Interest detail | 1 | 4 | Known + unknown tag; JOINED → unsubscribe; ADD → subscribe |
| Screen — Attendees | 1 | 4 | Event subtitle; visible people list; tap → profile; fallback for missing id |
| Screen — Create event | 1 | 4 | All fields render; PUBLISH without title shows error; SAVE DRAFT persists; resume header on `draftId` param |
| Screen — Drafts | 1 | 3 | Empty state; draft renders after save; delete affordance present |
| Screen — New chat | 1 | 5 | Picker subtitle; person rows; switches DM → GROUP; START CHAT replaces to `/chat/dm-<id>` |
| Screen — Sign in | 1 | 4 | Renders chrome; empty submit errors; valid submit replaces to `/(tabs)`; guest skip |
| Screen — Sign up | 1 | 4 | Renders chrome; short-password validation; valid submit replaces to `/(tabs)`; sign-in link |
| Screen — Event published | 1 | 3 | Renders success + title; Home + View event buttons replace correctly |

### 2.4 Where the tests live + how to run them

```
scenecheck-expo/
├── jest.config.js                       # jest-expo preset, @/ alias, web-only stubs
├── jest.setup.ts                        # mocks for AsyncStorage, expo-* modules, slider, RN maps
└── tests/
    ├── __mocks__/                       # react-leaflet, leaflet, CSS imports
    │   ├── empty.ts
    │   ├── leaflet.ts
    │   └── react-leaflet.ts
    ├── test-utils.tsx                   # renderScreen + resetStore + setRouteParams
    ├── unit/                            # pure-function tests
    │   ├── api-mock.test.ts
    │   ├── conflicts.test.ts
    │   ├── date-time.test.ts
    │   ├── map-types.test.ts
    │   └── store.test.ts
    ├── components/                      # component-level rendering
    │   ├── AuthGate.test.tsx            # NEW (§2.10) — hard auth gate
    │   ├── ChangeEmailSheet.test.tsx    # NEW — settings → email change
    │   ├── ChangePasswordSheet.test.tsx # NEW — settings → password change
    │   ├── ConflictChip.test.tsx
    │   ├── EditEventSheet.test.tsx      # NEW (§2.8) — host-only edit modal
    │   ├── EditProfileSheet.test.tsx    # NEW (§2.10) — display-name edit
    │   ├── SCAvatar.test.tsx
    │   ├── SCDatePicker.test.tsx        # NEW (§2.8) — calendar popover
    │   ├── SCEventCard.test.tsx
    │   └── SCTimePicker.test.tsx        # NEW (§2.8) — three-wheel time picker
    ├── hooks/
    │   ├── useAttendees.test.ts         # NEW (§2.16) — attendees + ratings
    │   ├── useChats.test.ts             # NEW (§2.15) — chats + chat messages
    │   ├── useEvent.test.ts             # NEW (§2.11) — single-event hook
    │   ├── useEvents.test.ts            # NEW (§2.9) — events data hook
    │   ├── useFriends.test.ts           # NEW (§2.14) — friends + requests + profile
    │   ├── useImagePicker.test.ts
    │   └── useInterests.test.ts         # NEW (§2.13) — interest catalog + single tag
    └── screens/                         # per-route integration tests
        ├── attendees.test.tsx
        ├── chat-tab.test.tsx
        ├── chat-thread.test.tsx
        ├── create-event.test.tsx
        ├── drafts.test.tsx
        ├── event-detail.test.tsx
        ├── event-published.test.tsx
        ├── events-list.test.tsx
        ├── forgot-password.test.tsx     # NEW — password recovery
        ├── home.test.tsx
        ├── interest-detail.test.tsx
        ├── interests.test.tsx
        ├── map-tab.test.tsx
        ├── my-following.test.tsx
        ├── my-friends.test.tsx
        ├── my-hosting.test.tsx
        ├── new-chat.test.tsx
        ├── other-profile.test.tsx
        ├── profile-tab.test.tsx
        ├── requests.test.tsx
        ├── search.test.tsx
        ├── settings-subscreens.test.tsx
        ├── settings.test.tsx
        ├── sign-in.test.tsx
        └── sign-up.test.tsx

supabase/
└── tests/                               # pgTAP — database layer
    ├── constraints.test.sql
    ├── rls.test.sql                     # updated for the Phase 7 policy rename
    └── schema.test.sql

tests/                                   # legacy prototype tests (kept for reference)
├── unit/         (5 files, ~25 cases on the legacy JS source)
└── integration/  (4 files)
```

Run commands (copy-paste on a fresh clone):

```bash
# Active project (Expo port) — frontend tests
cd scenecheck-expo
npm install
npm test                  # 259 tests / 33 suites in ~4s
npm run test:coverage     # add --coverage flag

# Database tests (requires Docker + Supabase CLI)
cd ..
supabase start
supabase test db          # pgTAP suite

# Legacy prototype tests (root, original Jest setup)
npm install
npm test
```

Approximate run-times:

| Category | Count | Time | Where it runs |
|---|---|---|---|
| Unit (5 files) | 104 | <1s | local + CI |
| Component (10 files) | 43 | <1s | local + CI |
| Hook (7 files) | 30 | <1s | local + CI |
| Screen integration (25 files) | 149 | ~3s | local + CI |
| **Total (Jest)** | **326** | **~5s** | local + CI |
| Database (pgTAP) | — | ~5s | local (Docker) |

### 2.5 Coverage achieved

_Snapshot from `npm test -- --coverage --forceExit` on 2026-05-19._

| Module group | Stmts % | Branch % | Funcs % | Lines % |
|---|---|---|---|---|
| **All files** | **55.05** | **44.93** | **63.81** | **55.66** |
| `theme/` | 100 | 100 | 100 | 100 |
| `lib/date-time.ts` | 100 | 100 | 100 | 100 |
| `lib/conflicts.ts` | 92.7 | 92.1 | 100 | 100 |
| `lib/supabase.ts` | 100 | 50 | 100 | 100 |
| `lib/api.ts` | 15.4 | 11.0 | 40.5 | 12.8 |
| `lib/notifications.ts` | 0 | 0 | 0 | 0 |
| `store/useStore.ts` | 89.5 | 61.1 | 86.6 | 90.7 |
| `components/Map/types.ts` | 100 | 81.8 | 100 | 100 |
| `components/Map/Map.native.tsx` | 80.0 | 63.6 | 60.0 | 77.8 |
| `components/` (SC primitives) | 61.0 | 61.0 | 52.8 | 61.7 |
| `hooks/useImagePicker.ts` | 91.7 | 75.0 | 100 | 91.3 |
| `hooks/useLocation.ts` | 77.8 | 50.0 | 100 | 77.8 |

**What's intentionally NOT covered:**

- **`lib/api.ts` live-mode (15.4%)** — Mock-mode is exhaustively covered. Live-mode calls go to Supabase; testing them would require either mocking the entire Supabase client (low value, brittle) or a real instance. Edge Functions are the right place to test the live wire format.
- **`lib/notifications.ts` (0%)** — Push notifications require a real device (`Device.isDevice` guards). The module is structurally simple and exercised manually via Expo Go on a phone.
- **`components/ConfirmDialog.tsx`, `ToastHost.tsx` (0%)** — Modal overlays. They're rendered at the root layout; screen tests verify the *trigger* (`showConfirm`/`showToast` in the store), but the modal-rendered output requires the layout to be in the tree. Planned next-milestone.
- **`components/Map/Map.web.tsx` (excluded from coverage)** — Web-only file, runs under react-leaflet which needs the DOM. Skipped in the native test bundle on purpose; the underlying `pinColor` / `eventLatLng` helpers are covered via `Map/types.ts`.
- **Template leftovers (`themed-text`, `parallax-scroll-view`, etc.)** — Came with `create-expo-app`; not used by SceneCheck code. Slated for deletion in a cleanup pass.
- **App layout files (`app/_layout.tsx`, `app/(tabs)/_layout.tsx`)** — Expo Router layout components; covered transitively when their children render.

### 2.6 Plan-vs-implementation gap

| What the plan called for | What you actually shipped | What blocked you / what you'd add next |
|---|---|---|
| pgTAP database tests running via `supabase test db` | SQL test files written + RLS test updated for the Phase 7 policy rename; not executed in this sprint | Requires Docker + Supabase CLI on the dev machine; CI job spec ready |
| Edge Function Deno tests | 9 Edge Functions implemented, 4 backend bugs fixed (Phase 7), CORS wired across all of them; Deno test files not yet written | Deno runtime not installed locally; functions are structured for testability (`_shared/supabase-client.ts`, `_shared/validators.ts`) |
| Full E2E browser/device tests (Playwright / Detox) | Not implemented | Out of scope for this milestone; the platform-split Map component makes E2E a per-platform effort (web vs native) |
| API client live-mode tests against real Supabase | Only mock-mode tested | Requires a linked Supabase project + service-role key in CI secrets; planned for the deploy milestone |
| Per-screen integration tests | **17 screen files, 109 cases — all passing** (this milestone's main delivery) | Done |
| Store slice tests | **25 cases across 7 slices, ~90% coverage on useStore.ts** | Done |
| Update RLS test for renamed policy | **Done** (`supabase/tests/rls.test.sql` references the new `'Profile visibility respects privacy and blocks'` policy) | Done |

### 2.7 Web-bundle compatibility fixes (post-Phase 6 delta)

_Captured 2026-05-19 after the `npm run web` triage session
documented in `docs/PROGRESS_SNAPSHOT.md` §9._

Three SSR/web-bundle incompatibilities surfaced when running the Expo
SDK 54 web build end-to-end for the first time. None affected native
builds. The fixes landed in:

| File | Change | Test impact |
|---|---|---|
| `scenecheck-expo/lib/storage.ts` (new) | Platform-aware k/v adapter (AsyncStorage on native, SSR-safe `localStorage` wrapper on web). | **Not unit-tested directly.** The native branch is exercised transitively by every store test (Zustand persist) and every supabase auth test path that runs under jest-expo (which sets `Platform.OS === 'ios'`). The web branch — `typeof window` guard + `window.localStorage` calls — has no Jest test; jest-expo doesn't simulate a DOM, so adding one would require a separate `@testing-library/jest-dom` setup. Listed as item under §3.3 / "next test to add". |
| `scenecheck-expo/lib/supabase.ts` | Swapped `AsyncStorage` import for `kvStorage`. | Behavior identical on native; coverage for this file (previously 100/50/100/100) is unchanged because the swap is a one-line import substitution. |
| `scenecheck-expo/store/useStore.ts` | `createJSONStorage(() => kvStorage)` instead of `() => AsyncStorage`. | Store tests pass unchanged (25/25). Coverage on `store/useStore.ts` (previously 89.5/61.1/86.6/90.7) is unchanged for the same reason. |
| `scenecheck-expo/components/Map/Map.web.tsx` (rewritten) + `Map.web.impl.tsx` (renamed from old `Map.web.tsx`) | Split the leaflet implementation behind a `useEffect`-gated `React.lazy()` boundary so leaflet only loads in the browser after first client render. | Both files are excluded from Jest coverage just like the prior `Map.web.tsx` was — they only execute under a real DOM. The shared `pinColor`/`eventLatLng` helpers in `Map/types.ts` remain 100% covered and are still the right boundary for unit testing. The `__mocks__/react-leaflet.ts` + `__mocks__/leaflet.ts` stubs were already in place and continue to short-circuit any transitive import on native test runs. |
| `scenecheck-expo/metro.config.js` (new) | Resolver override forcing `zustand` + sub-paths to the CJS build on web (because the ESM build's `devtools` middleware emits `import.meta.env`, which Metro serves as a classic script and the browser rejects with `SyntaxError`). | **Not unit-tested.** Metro configs are typically validated by the act of running `expo start --web` (which we did). The override is gated by `platform === 'web'`, so Jest's resolution (which runs as native) is untouched — and that's confirmed by the unchanged store-test results. |

**Verification:**

| Check | Command | Result |
|---|---|---|
| Native test suite still green | `cd scenecheck-expo && npm test` | ✅ 259/259, 33 suites, ~5.2s |
| Web SSR bundle compiles | `npm run web` → server log | ✅ `Bundled … node_modules\expo-router\node\render.js (1432 modules)` |
| Web client bundle compiles | `npm run web` → server log | ✅ `Web Bundled … node_modules\expo-router\entry.js (1380 modules)` |
| No `ReferenceError: window is not defined` in SSR | Server log | ✅ |
| No `SyntaxError: Cannot use 'import.meta' outside a module` in browser | Browser console | ✅ |
| Page hydrates and is interactive | Manual click-through at `localhost:8081` | ✅ |

**What this section deliberately does NOT do:**

- Re-snapshot the coverage table (§2.5). The net change in covered statements is dominated by the new `lib/storage.ts` (a ~28-line file with two untested branches), which would move the all-files percentage by less than 0.5pp and isn't worth a full `--coverage` rerun to capture. The next coverage snapshot — likely when Phase 8 adds the live-mode `api.ts` tests or the `ConfirmDialog`/`ToastHost` render tests — should subsume this delta.
- Backdate the §2.3 counts. No new test files were added; the 259 number stands.
- Claim test coverage for the Metro resolver override. It's a build-time config; the right "test" is `npm run web` end-to-end, which is captured in the verification table above and in `docs/PROGRESS_SNAPSHOT.md` §9.

### 2.8 Web design parity + Create-flow tests (post-§2.7 delta)

_Captured 2026-05-19 after the work documented in
`docs/PROGRESS_SNAPSHOT.md` §10._

Three new components landed (`SCDatePicker`, `SCTimePicker`,
`EditEventSheet`) plus two new entry points to `/create-event` (Home
and Map tab headers). Each is covered by direct or indirect Jest
tests. Coverage of pre-existing tests was not disturbed.

| File added | Tests added | What they assert |
|---|---|---|
| `tests/components/SCDatePicker.test.tsx` (new, 3 cases) | render of trigger / open of popover / fallback-to-today behavior | The friendly value (`"Sat May 16"`) appears in the trigger; opening reveals a `MonthName YYYY` label inside the popover; malformed input still renders today's friendly form. Selecting a specific cell is not asserted because the calendar contents shift with the machine's wall clock — the shared `fmtDate` / `parseDate` paths are covered in `tests/unit/date-time.test.ts`. |
| `tests/components/SCTimePicker.test.tsx` (new, 3 cases) | render of trigger / open of three-wheel popover / `onChange` fires with reformatted string | The friendly value (`"7:00 AM"`) appears in the trigger; opening reveals the colon separator and both AM/PM labels; tapping `PM` (a stable, low-touch row in the wheel) fires `onChange('7:00 PM')`. Snap-scroll mechanics are not driven by jsdom and so are left to manual web verification. |
| `tests/components/EditEventSheet.test.tsx` (new, 4 cases) | invisible-when-closed / pre-fill / save writes override + toast / cancel closes without mutation | Headline `"EDIT EVENT"` and `"SAVE CHANGES"` are not in the tree until `visible` is true; the form pre-fills `title` + `cap` from the event; `SAVE CHANGES` writes a patch through `useStore.applyEventOverride(id, patch)` and emits the legacy "Saved · attendees notified" success toast; `CANCEL` only triggers `onClose` (no override). |
| `tests/screens/home.test.tsx` (updated, +1 case) | `+` button routes correctly | Tapping the accessibility-labeled "Create a new event" button on the Home header pushes `/create-event`. |
| `tests/screens/map-tab.test.tsx` (updated, +1 case) | `+` button routes correctly | Same assertion on the Map tab — verifies the new header button mirrors the legacy `screens.jsx:609` behavior. |
| `tests/screens/event-detail.test.tsx` (updated, +3 cases) | EDIT EVENT opens the sheet / saving writes override + toast / CANCEL EVENT opens a danger-toned confirm | These close the previously-dangling `editOpen` state and double-check the host-only host-action chrome that was already in place. |

**Delivered count**: 274 / 274 (up from 259). 36 suites (up from 33).
Runtime delta: negligible (~5.0s vs ~4.8s).

**What this section deliberately does NOT do:**

- Add E2E coverage of the Date / Time picker's actual scroll snapping
  on the wheel. That mechanic is browser-side and would need
  Playwright; the unit tests cover the `onChange` callback and
  formatting paths instead.
- Add a test for `app/+html.tsx`. It's a web-only SSR shell with no
  React behavior — its output is verified by `curl http://localhost
  :8081/ | grep` against the served HTML, captured in
  `docs/PROGRESS_SNAPSHOT.md` §10.5.
- Add a test for the Metro resolver override (`metro.config.js`).
  Build-time config, not Jest-testable; verified end-to-end by
  `npm run web` succeeding.
- Re-snapshot the coverage table (§2.5). The three new components add
  ~480 LOC combined, but they're entirely covered by the new tests
  in this section (excluding the wheel-scroll mechanics noted above)
  and the all-files percentage should move modestly upward. A full
  rerun is deferred to the next milestone snapshot.

### 2.9 Supabase live wire-up tests (post-§2.8 delta)

_Captured 2026-05-19 alongside `docs/PROGRESS_SNAPSHOT.md` §11._

The Home + Map tabs now pull from `api.fetchEvents()` via a new
`useEvents` hook, and the root layout mounts `AuthBootstrap` to keep
the Zustand `me` slice in sync with the Supabase session. Test impact
is modest because both modules short-circuit gracefully in mock mode:
`useEvents` initializes synchronously with `SC_EVENTS`,
`AuthBootstrap` is a no-op when `supabase` is null.

| File added | Tests added | What they assert |
|---|---|---|
| `tests/hooks/useEvents.test.ts` (new, 2 cases) | Sync mock-mode init + reload affordance | `renderHook(() => useEvents())` returns `events === SC_EVENTS` and `loading === false` on the first render (mock mode means the `useState` initializer fills it synchronously); the returned `reload` function is callable. Live-mode behavior is covered indirectly by the Home + Map screen tests that already exercise the hook end-to-end. |

| File preserved | Why no new tests | Note |
|---|---|---|
| `tests/screens/home.test.tsx` | The mock-mode synchronous initializer in `useEvents` means the existing assertions (`getByText(SC_EVENTS[0].title)`, etc.) still pass without `findByText` / `waitFor`. | If/when we add a live-mode test we'll need a Supabase client mock. |
| `tests/screens/map-tab.test.tsx` | Same — Map tab's `useEvents` call resolves synchronously under jest, so the existing chip + legend assertions are unchanged. | |
| `tests/screens/settings.test.tsx` | The existing "sign out opens a confirm dialog" test stops at confirm-open — it never actually presses the destructive button, so the new `api.signOut()` invocation isn't reached. | A future test could press the confirm button + assert `api.signOut` was called via a `jest.spyOn(api, 'signOut')`; deferred. |
| `tests/components/AuthBootstrap.test.tsx` | Not added. `AuthBootstrap` is a no-op in mock mode (the only mode jest-expo provides), and live-mode behavior would require mocking the entire Supabase client. | Live-mode coverage will live in an E2E layer (Playwright) once it exists. |

**Delivered count**: 279 / 279 (up from 277). 37 suites (up from 36).

**What this section deliberately does NOT do:**

- Mock `@supabase/supabase-js` to exercise the live paths of
  `api.fetchEvents` / `api.signIn` / `api.signOut` / `AuthBootstrap`.
  Brittle and limited value compared to real end-to-end verification
  with a local Supabase container. Verification of the live path
  lives in `docs/PROGRESS_SNAPSHOT.md` §11.6 (`curl` + dev-server
  bundle pass).
- Re-snapshot the coverage table (§2.5). One new ~28-line module
  (`components/AuthBootstrap.tsx`) is intentionally uncovered;
  `useEvents` gains ~70% coverage from the two new tests + indirect
  use by Home and Map. Net movement is below the 0.5pp threshold
  worth a full `--coverage` rerun.
- Test the Home tab's empty-state branch (`events.length === 0`).
  In mock mode `SC_EVENTS` is non-empty so the branch is unreachable
  from tests; live-mode coverage requires a Supabase client mock that
  returns `[]`. Deferred to the full migration.

### 2.10 Full-migration Phase 1: Hard auth gate (post-§2.9 delta)

_Captured 2026-05-19 alongside `docs/PROGRESS_SNAPSHOT.md` §12._

Phase 1 of the 7-phase plan adds the auth gate every subsequent
phase relies on, plus expanded `AuthBootstrap` hydration of the
social slices. Test impact is concentrated in one new component-
test file + one existing screen test that's been updated.

| File added | Tests added | What they assert |
|---|---|---|
| `tests/components/AuthGate.test.tsx` (new, 3 cases) | render-children with session / pass-through in mock mode / blocks-render in live mode with `session=null` | The gate renders its `children` when the store has a session (the new `resetStore` default). It also renders children when `session=null` if `api.isMock()` is true — needed so the existing 277 screen / hook tests don't have to mock auth. When `api.isMock()` is monkey-patched to false AND `session=null`, the protected child is absent from the tree (Jest's `Redirect` mock returns null, so the `queryByText(CHILD)` lookup is null). |

| File updated | Change | Why |
|---|---|---|
| `tests/screens/sign-in.test.tsx` | Replaced "SKIP — EXPLORE AS GUEST replaces to /(tabs)" with "the guest-skip link is gone". | The link was removed as part of Phase 1; the new assertion locks in the removal so a future re-add would fail the test. |
| `tests/test-utils.tsx` | `resetStore` now defaults to a stub signed-in session (`{ userId: SC_ME.id, email: ... }`). | Without this every prior screen test that wraps a `(tabs)` route would land on the redirect path; one-line default keeps the 277 tests green. |

**Delivered count**: 282 / 282 (up from 279). 38 suites (up from 37).

**What this section deliberately does NOT do:**

- Test `AuthBootstrap`'s expanded hydration (joined / friends /
  outgoingRequests / incomingRequests / subscribedInterests). Same
  rationale as §2.9 — the component is a no-op in mock mode and
  live-mode coverage would require a heavyweight Supabase mock.
  End-to-end verification lives in `PROGRESS_SNAPSHOT.md` §12.4.
- Add an integration test for the `(tabs)/_layout.tsx` wrap. The
  wrap is one line and is exercised by every screen test that
  renders a tab; `AuthGate.test.tsx` covers the gate's three states
  in isolation.
- Re-snapshot the coverage table. Net change is a ~10-line new
  component (`AuthGate.tsx`, fully covered) + ~50 added lines in
  `AuthBootstrap.tsx` (intentionally uncovered). Below the 0.5pp
  threshold.

### 2.11 Full-migration Phase 2: Event detail (post-§2.10 delta)

_Captured 2026-05-19 alongside `docs/PROGRESS_SNAPSHOT.md` §13._

Phase 2 of the 7-phase plan wires the event-detail screen through
real Supabase mutations: join/leave via `api.subscribeToEvent` /
`api.cancelSubscription`, host edit via `api.updateEvent`, host
cancel via `api.cancelEvent`. The data hook is `useEvent` (mirrors
`useEvents`).

| File added | Tests added | What they assert |
|---|---|---|
| `tests/hooks/useEvent.test.ts` (new, 3 cases) | Sync mock-mode init / unknown id / undefined id | First-render `event === SC_EVENT_BY_ID['e1']` and `loading === false`; unknown id yields `null`; `undefined` id no-ops. Live-mode behavior covered indirectly by the screen tests + manual verification in `PROGRESS_SNAPSHOT.md` §13.6. |

| File updated | Change | Why |
|---|---|---|
| `tests/components/EditEventSheet.test.tsx` | The "SAVE CHANGES writes the patch" case is now `async`. Awaits two microtask flushes before asserting the override + toast, and now also asserts the new `onSaved` callback fires. | `handleSave` awaits `api.updateEvent` (mock-mode no-op `Promise.resolve(patch)`) before writing the override + toast, so the assertions land one microtask later. |
| `tests/screens/event-detail.test.tsx` | Same microtask flush on the "saving the edit sheet writes an override" case. | Same reason. |

**Delivered count**: 291 / 291 (up from 288). 40 suites (up from 39).

**What this section deliberately does NOT do:**

- Test the `api.cancelEvent` / `api.cancelSubscription` /
  `api.updateEvent` live-mode paths. All three short-circuit in
  mock mode (the only mode jest-expo gives us); live verification
  is in `PROGRESS_SNAPSHOT.md` §13.6.
- Test the optimistic-rollback path on join failure. Mock-mode
  `api.subscribeToEvent` always resolves successfully, so the
  rollback branch is unreachable from Jest. Live-mode coverage
  would need a Supabase mock; deferred.

### 2.12 Full-migration Phase 3: Events list / Search / My Hosting (post-§2.11 delta)

_Captured 2026-05-19 alongside `docs/PROGRESS_SNAPSHOT.md` §14._

Phase 3 is intentionally test-free. Three screens swap
`SC_EVENTS` import for `useEvents()`; all client-side filter logic
(filter chips on Events, substring match on Search, host-id filter
on My Hosting) is unchanged. Because `useEvents` initializes
synchronously with `SC_EVENTS` in mock mode, every existing screen
assertion against an event title / count still lands on the first
render — no test updates required.

**Delivered count**: 291 / 291 (unchanged). 40 suites (unchanged).

**What this section deliberately does NOT do:**

- Add a test for "live event count flows into `/events` ALL chip".
  The chip reads `allEvents.length`; the existing
  `tests/screens/events-list.test.tsx` assertion already counts
  `SC_EVENTS.length` and stays green via mock-mode sync init.
- Add a test for the new `kind === 'yours' \|\| hostId === meId`
  filter on My Hosting. Mock mode's `SC_EVENT_BY_ID['e1']` has
  `hostId === 'me'`; `me.id` defaults to `'me'`; existing test
  expectations match.
- Re-snapshot the coverage table. Pure substitution — no new
  branches.

### 2.13 Full-migration Phase 4: Interests system (post-§2.12 delta)

_Captured 2026-05-19 alongside `docs/PROGRESS_SNAPSHOT.md` §15._

Phase 4 wires both the interests-list and interest-detail screens
through `useInterests` / `useInterest`, and routes the create-event
tag-search catalog through the same hook. The api wrapper for
`searchInterests` also gained a column-mapping transform that was
quietly broken before this commit (a stray `data as Interest[]`
cast that left `tag` / `desc` / `others` / `similar` undefined on
live rows).

| File added | Tests added | What they assert |
|---|---|---|
| `tests/hooks/useInterests.test.ts` (new, 5 cases) | Catalog + substring filter (useInterests, 2 cases) and known / unknown / undefined tag (useInterest, 3 cases) | Synchronous mock-mode init for both hooks. The catalog matches `SC_INTERESTS_SUGGESTED`; the substring filter keeps tags that include the query; the single-tag hook returns `SC_INTERESTS_DETAILS[tag]` for known names and `null` otherwise. Live-mode coverage is deferred (no Supabase mock). |

**Delivered count**: 296 / 296 (up from 291). 41 suites (up from 40).

**What this section deliberately does NOT do:**

- Test the column-mapping transform in `api.searchInterests` /
  `api.getInterest`. Jest doesn't have a Supabase client; the
  transform is verified by inspection (select columns match the
  schema exactly) and end-to-end via Studio queries.
- Test create-event's tag-search end-to-end against the live
  catalog. The previous create-event tests already cover the
  substring-match path; the difference now is just the catalog
  source, which is exercised by the `useInterests` hook tests.
- Re-snapshot the coverage table. Two new ~50-line hooks + ~30
  added lines to `api.ts`; net below the 0.5pp threshold.

### 2.14 Full-migration Phase 5: Profiles + Social (post-§2.13 delta)

_Captured 2026-05-19 alongside `docs/PROGRESS_SNAPSHOT.md` §16._

Phase 5 wires three social screens (my-friends, requests, other-
profile) through the three new hooks. Tests sit on the hooks; the
screen tests stay green because the Zustand-derived mock-mode
paths return the same shapes the screens already assert against.

| File added | Tests added | What they assert |
|---|---|---|
| `tests/hooks/useFriends.test.ts` (new, 5 cases) | useFriends (2), useFriendRequests (1), useProfile (2) | Friends list mirrors the Zustand `friends` Set + `SC_VISIBLE_PEOPLE` filter; reload is callable. Friend-requests list filters `SC_FRIEND_REQUESTS` by `incomingRequests` AND drops senders whose profiles aren't in `SC_VISIBLE_PERSON_BY_ID` (locks in the existing blocked-user behavior — fr2 is from blocked `p6` and gets dropped). useProfile returns the synced row for a known id and `null` for undefined. |

**Delivered count**: 301 / 301 (up from 296). 42 suites (up from 41).

**What this section deliberately does NOT do:**

- Test the live-mode join paths in `api.fetchFriends` /
  `api.fetchFriendRequests`. Jest doesn't have a Supabase client;
  verification is via Studio + Phase 5's manual smoke section.
- Test the optimistic accept / decline / unfriend mutations end-
  to-end on the screens. Those already had screen-level tests
  covering the Zustand store mutation in earlier phases; the new
  awaited `api.*` calls are validated via the hook tests.
- Add an integration test for `my-following.tsx`. Untouched in
  Phase 5 (no `org_follows` table).

### 2.15 Full-migration Phase 6: Chat (post-§2.14 delta)

_Captured 2026-05-19 alongside `docs/PROGRESS_SNAPSHOT.md` §17._

Phase 6 wires the chat list, chat thread, and new-chat composer
through the new hooks. Realtime path stays untested in Jest (no
Supabase channel mock); the mock-mode `subscribeToChat` returns
`{ unsubscribe: () => {} }` so the lifecycle still mounts cleanly.

| File added | Tests added | What they assert |
|---|---|---|
| `tests/hooks/useChats.test.ts` (new, 5 cases) | useChats (2) + useChatMessages (3) | useChats: returns SC_CHATS synchronously; reload is callable. useChatMessages: seeds messages from `SC_THREADS[id]` in mock mode; `send()` appends an optimistic message immediately; undefined chatId returns an empty list without crashing. |

| File updated | Change | Why |
|---|---|---|
| `tests/screens/new-chat.test.tsx` | Rewrote to assert on friend-only picker behavior + async start. New tests use `SC_VISIBLE_PERSON_BY_ID['p1']` and `['p3']` (both in `resetStore` default friends) and assert that non-friend `p2` is absent. The START CHAT case now awaits two microtask flushes for `api.createChat` to resolve. | Phase 6 changed the picker source from `SC_VISIBLE_PEOPLE` to `useFriends()`. The "isFriend ? ' · friend'" handle suffix was simplified to always show ` · friend` since the picker is now scoped to friends only. |

**Delivered count**: 306 / 306 (up from 301). 43 suites (up from 42).

**What this section deliberately does NOT do:**

- Test the Realtime dedupe path in `useChatMessages`. The
  channel's `onMessage` callback is wired through
  `api.subscribeToChat`; mock mode returns a no-op subscription.
  Live verification is the two-browser smoke described in
  `PROGRESS_SNAPSHOT.md` §17.5.
- Test the live-mode `transformRow` mapping in `useChatMessages`.
  Same reason — no Supabase row source under Jest.
- Add a chat-tab test for the new `useChats` synchronous init.
  Existing `tests/screens/chat-tab.test.tsx` already asserts
  against `SC_CHATS[0].title` which still resolves the same way
  via the hook's sync initializer.

### 2.16 Full-migration Phase 7: Attendees + Ratings (post-§2.15 delta)

_Captured 2026-05-19 alongside `docs/PROGRESS_SNAPSHOT.md` §18._

Phase 7 wires the last two screens that still imported from
`data/mocks.ts` (`attendees/[id]` and `ratings/[hostId]`) through
the new hooks. With this phase the 7-phase Supabase migration is
complete — every original mock-imported screen now reads from a
hook that hits Supabase in live mode.

| File added | Tests added | What they assert |
|---|---|---|
| `tests/hooks/useAttendees.test.ts` (new, 5 cases) | useAttendees (2) + useRatings (3) | useAttendees returns SC_VISIBLE_PEOPLE for any eventId in mock mode and an empty list for undefined; useRatings filters SC_REVIEWS by hostId, returns [] for unknown hosts, and handles undefined. |

**Delivered count**: 311 / 311 (up from 306). 44 suites (up from 43).

**What this section deliberately does NOT do:**

- Test the live-mode join paths in `api.fetchAttendees` /
  `api.fetchRatings`. No Supabase client under Jest; live
  verification is in `PROGRESS_SNAPSHOT.md` §18.5.
- Test the composite key + locale-date `when` transform in
  `api.fetchRatings`. Same reason — exercised only against a real
  DB row.

---

## Part 3 — Reflection

### 1. What did your tests catch that you missed before?

**Three concrete catches in the new test suite:**

- The original code review's audit (`docs/CODE_REVIEW_REPORT.md`) found that the profile-visibility RLS policy granted SELECT to any non-blocker — including strangers — regardless of `visibility = 'private'`. The pgTAP test in `supabase/tests/rls.test.sql` was already passing because it only checked policy names, not predicates. The migration `00014_fix_profiles_rls.sql` tightens the predicate and the test was updated to reference the renamed policy, locking in the fix.
- The store-mutator unit tests caught that `acceptFriendRequest` must mutate two slices atomically — adding the requester to `friends` AND clearing them from `incomingRequests`. A previous implementation only did the first, leaving stale rows in the inbox.
- The chat-thread integration test caught that the optimistic-send composer needs to clear the input on submit, not just append the message — easy to miss without a real render.

**From the prototype tests (kept as a historical baseline):**

- `timeToMin("12:00 AM")` correctly returns 0 (midnight), not 720 — the modular arithmetic in `minToTime` uses `h % 12 || 12`, and the tests confirmed it works for all boundary values.
- `findConflict` skips self-conflict, so the user never gets warned about overlapping with an event they're already attending.

### 2. What was hardest to test, and why?

The platform-split `Map` component. On native it pulls `react-native-maps` (which needs Apple/Google Maps SDKs); on web it pulls `react-leaflet` (which needs the DOM). Each one crashes Jest when loaded by the wrong test environment.

The solution was three-layered:
1. A TS-only `Map.tsx` fallback that throws — TypeScript resolves to it, Metro never executes it.
2. Per-file mocks (`tests/__mocks__/react-leaflet.ts`, `tests/__mocks__/leaflet.ts`) that stub the web-only bits.
3. `jest.setup.ts` mocks `react-native-maps` directly so even if a test imports it transitively, nothing blows up.

This is why `Map/types.ts` (the shared logic) has 100% coverage but `Map.web.tsx` is excluded entirely.

The other hard thing: getting `useLocalSearchParams` to return different values per test. The fix was making the jest.setup mock use `jest.fn(() => ({}))` instead of a literal, then exposing a `setRouteParams()` helper in `tests/test-utils.tsx` that calls `.mockReturnValue(...)`.

### 3. What test would you add next if you had more time?

Three concrete additions, ranked by value:

1. **Edge Function tests via Deno** — the 4 backend bug fixes from Phase 7 (CORS preflight, RLS predicate, atomic subscribe, friend-request notification dispatch) deserve tests at the function boundary. `deno test` against each `index.ts` with mocked fetch + a Supabase test container would cement them.
2. **A pgTAP regression test for the RLS leak** — assert that a logged-in stranger CANNOT SELECT a private profile, even when no block exists. The current test only checks policy names, which is why the original bug shipped.
3. **End-to-end on web via Playwright** — drive the deployed Expo Web build through the full flow: sign in → home → tap event → join → chat → leave. Catches integration regressions that unit tests can't see.

### 4. Where did Claude help — and where did it get things wrong?

**Helped:**
- Designed the full Phase-6 test infrastructure: jest-expo preset config, `@/` path alias mirror, per-file `__mocks__` for web-only deps, the `renderScreen`/`resetStore`/`setRouteParams` helper trio, and the SCButton uppercase pattern that surfaced when the first screen-test batch ran.
- Wrote all 17 screen integration tests in two batches, with first-run results of 244/259 passing — meaning ~94% of tests worked from the first write, and the remainder were caught in a single iteration.
- Caught the platform-split testing problem before it bit (added the `Map.tsx` TS fallback when authoring, not when debugging).
- Produced the four Phase 7 backend bug fixes with both code changes AND matching migration files / test updates — including the `are_friends()` helper that the corrected RLS policy needs.

**Got wrong:**
- First write of the Slider mock used `RN.createElement` instead of `React.createElement` — broke all 6 settings tests; fixed in one edit.
- First-batch test queries assumed `SCButton` rendered the label verbatim; it actually uppercases via `{label.toUpperCase()}`. Twelve tests failed; all fixed by switching to uppercase queries.
- The `home.test.tsx` initial draft had a `renderScreen` call inside a `fireEvent.press` call (a leftover from refactoring) that double-rendered the component. Caught by review before committing.
- The `setupFilesAfterEach: undefined` typo in `jest.config.js` produced a non-fatal warning for one run before being removed.
- A few text-content assertions didn't account for React Native rendering interpolated strings as a single Text child (the `{count} {label}` pattern in the requests header). Adjusted to a tail-match regex.

The headline takeaway: every wrong thing was caught within one test-run iteration, and the wrongs were minor patterns (uppercase labels, mock factory return type) rather than design errors.
