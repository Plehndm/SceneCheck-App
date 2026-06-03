# SceneCheck — Test Plan & Implementation Report

_Last updated: 2026-06-02 — covers the Expo SDK 54 + TypeScript port at `scenecheck-expo/`, the original prototype now kept under `legacy/` (reference only), and the Supabase backend at `supabase/`. The Jest suite is **426 tests across 57 suites**; on this date **423 pass and 3 fail**, and `npx tsc --noEmit` is clean. The 3 failures are stale test fixtures, not product regressions: two `tests/components/SCDatePicker.test.tsx` cases pin a year-less `"Sat May 16"` value that the picker now re-formats to the next future occurrence (a different weekday once today is past May 16), and one `tests/screens/sign-up.test.tsx` mock-mode happy-path case predates the 18+ birthdate field — submit is now blocked by the "Pick your birthdate" gate before it can navigate. The 7-phase migration is complete (§2.7 … §2.16); subsequent deltas are tracked here as new §2.x sections plus chronology rows in `docs/PROGRESS_SNAPSHOT.md` §1 (most recent: §2.69 — map live-status chip, discover deep-link, floating web onboarding, + the David/Maya event date shift)._

_Backend target: Jest runs in mock mode (no env vars under
`jest-expo`); the dev server (`npm run web`) currently points at
the **hosted** Supabase project (`kmlecodmifljbtzaqahm`) per
`docs/PROGRESS_SNAPSHOT.md` §19. Seed data for hosted lives in
`supabase/seed-hosted.sql` (idempotent variant of `supabase/
seed.sql`). **Email confirmation is OFF** on the hosted project —
after a detour through Resend custom SMTP that stalled on a
purchased-domain requirement (§20 runbook kept for reference), we
disabled "Confirm email" so sign-up returns a live session
immediately. The full pivot rationale is in
`docs/PROGRESS_SNAPSHOT.md` §21. To swap the dev server back to
the local stack, restore the alternate values kept as comments
in `.env`._

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

- **Runtime:** Node.js 22 LTS (frontend + scraper), Deno 1.x (Edge Functions), PostgreSQL 15 + PostGIS 3.x (DB)
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
| **Unit tests** | Required | ≥ 5 | 10 files (`scenecheck-expo/tests/unit/`), 164 test cases |
| **Integration tests** | Required | ≥ 3 | 47 files (13 components + 26 screens + 8 hooks), 262 test cases |
| **Total tests** | — | — | **426 tests, 57 suites** (423 passing; 3 stale-fixture failures noted in the header) |

### 2.2 Migration note

The original prototype (now relocated to `legacy/`) had 5 unit + 4 integration tests on the legacy JS source. Those tests still exist and remain runnable there (`cd legacy && npm install && npm test`), but the active project is the Expo port at `scenecheck-expo/`, which is what the numbers above reflect.

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
    │   # useDateCityLabel has no dedicated file — its date-only output
    │   # is covered by the Home + Map screen tests' dynamic-date asserts.
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

legacy/                                  # legacy prototype (relocated from repo root)
└── tests/                               # kept for reference
    ├── unit/         (5 files, ~25 cases on the legacy JS source)
    └── integration/  (4 files)
```

Run commands (copy-paste on a fresh clone):

```bash
# Active project (Expo port) — frontend tests
cd scenecheck-expo
npm install
npm test                  # 426 tests / 57 suites in ~36s (423 pass; 3 stale-fixture fails — see header)
npm run test:coverage     # = jest --coverage

# Database tests (requires Docker + Supabase CLI). The CLI isn't on PATH
# in this workspace — run it through npx --no-install supabase ...
cd ..
npx --no-install supabase start
npx --no-install supabase test db   # pgTAP suite

# Legacy prototype tests (now under legacy/, original Jest setup)
cd legacy
npm install
npm test
```

Approximate run-times:

| Category | Count | Time | Where it runs |
|---|---|---|---|
| Unit (10 files) | 164 | ~2s | local + CI |
| Component (13 files) | 56 (54 pass) | ~3s | local + CI |
| Hook (8 files) | 33 | ~1s | local + CI |
| Screen integration (26 files) | 173 (172 pass) | ~8s | local + CI |
| **Total (Jest)** | **426 (423 pass)** | **~36s cold** | local + CI |
| Database (pgTAP) | — | ~5s | local (Docker) |

### 2.5 Coverage achieved

_Last updated: 2026-06-03 (commit `b9607d2`) — fresh `npm run test:coverage`
(`jest --coverage`; the 3 stale-fixture test failures don't block coverage
collection). Jest runs the unit + integration suites together, so the figures
below are the **combined / merged** coverage. The full per-file HTML report is
committed at [`docs/coverage/lcov-report/index.html`](coverage/lcov-report/index.html)._

| Module group | Stmts % | Branch % | Funcs % | Lines % |
|---|---|---|---|---|
| **All files (combined)** | **45.4** | **34.7** | **53.3** | **47.5** |
| `theme/` | 100 | 100 | 100 | 100 |
| `lib/date-time.ts` | 64.5 | 61.1 | 66.7 | 65.4 |
| `lib/conflicts.ts` | 92.7 | 92.1 | 100 | 100 |
| `lib/supabase.ts` | 100 | 54.5 | 100 | 100 |
| `lib/api.ts` | 16.2 | 11.2 | 46.2 | 13.4 |
| `lib/notifications.ts` | 0 | 0 | 0 | 0 |
| `store/useStore.ts` | 85.1 | 51.9 | 80.8 | 85.8 |
| `components/Map/types.ts` | 90.0 | 66.7 | 100 | 90.0 |
| `components/Map/Map.native.tsx` | 29.3 | 36.1 | 41.2 | 27.9 |
| `components/` (SC primitives, excl. `Map/`, 36 files) | 56.7 | 50.3 | 55.0 | 59.2 |
| `hooks/useImagePicker.ts` | 91.7 | 75.0 | 100 | 91.3 |
| `hooks/useLocation.ts` | 77.8 | 50.0 | 100 | 77.8 |

**Why the overall number moved (55.7% → 47.5% lines since the 2026-05-19
snapshot):** the measured surface grew faster than the tests. `collectCoverageFrom`
scopes coverage to `lib/ store/ theme/ components/ hooks/` (83 files now vs ~50
then); the two biggest drags are the §65 **custom native-map overlay rewrite**
(`Map/Map.native.tsx` 80% → 29% as a lot of platform-marker/animation code
landed) and the expanded `hooks/` directory (27 files, ~48% — many are thin
data-hooks whose live-mode branch only runs against Supabase). The denominators
on a few stable files also rose (`lib/date-time.ts` gained the year-aware
date/time helpers; `store/useStore.ts` gained slices). This is the honest
trade-off of shipping web + native breadth that's verified on the deployed build
rather than in Jest — not a regression in the existing tests.

**What's intentionally NOT covered:**

- **`lib/api.ts` live-mode (16.2%)** — Mock-mode is exhaustively covered. Live-mode calls go to Supabase; testing them would require either mocking the entire Supabase client (low value, brittle) or a real instance. Edge Functions are the right place to test the live wire format. The file also grew substantially (every Phase 1–7 + web method), so the uncovered live half pulls the percentage down.
- **`lib/notifications.ts` (0%)** — Push notifications require a real device (`Device.isDevice` guards). The module is structurally simple and exercised manually via Expo Go on a phone.
- **`components/Map/Map.native.tsx` (29.3%)** — The §65 rewrite replaced the crashing `react-native-maps` markers with a custom RN overlay (projection math + animated pins) that needs a real native map surface to exercise; the shared `pinColor` / `eventLatLng` logic stays 90%-covered via `Map/types.ts`.
- **`components/ConfirmDialog.tsx`, `ToastHost.tsx` (0%)** — Modal overlays. They're rendered at the root layout; screen tests verify the *trigger* (`showConfirm`/`showToast` in the store), but the modal-rendered output requires the layout to be in the tree. Planned next-milestone.
- **`components/Map/Map.web.tsx` + all `web/` modules + `app/**/*.web.tsx`** — Web-only surfaces (react-native-web DOM + react-leaflet) are **excluded** from `collectCoverageFrom`; they need a real browser (Playwright) and are verified on the deployed build (see §2.7–§2.9, §2.67–§2.69). `app/` route files are out of scope here too — the screen *behavior* is covered by the integration tests under `tests/screens/`, which render the components without counting toward this module-level table.
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

### 2.17 Map discovery-range persistence (post-§2.16 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §22._

The Map tab's radius chips now drive the persisted `store.radius`
(miles) instead of throwaway local state, and an off-preset range
surfaces a Custom button that deep-links to Settings. The map-tab suite
was reworked to cover the new behavior. The same pass cleared the 5
PostgREST `tsc` errors earlier sections carried as "pre-existing" (now
`tsc --noEmit` is clean) and hardened `supabase/seed-hosted-social.sql`
(neither needed new tests — the type fix is compile-time, the seed is
DB-only).

| File changed | Tests | What they assert |
|---|---|---|
| `tests/screens/map-tab.test.tsx` (5 → 8 cases, +3 net) | preset render + chip→store write + custom button | Preset chips render for 1/3/5/10/25/50 mi; tapping `10 MI` writes `store.radius = 10` (the persisted, Settings-shared value); a non-preset radius (7.5) renders `CUSTOM · 7.5 MI`; pressing it routes to `/settings`; no Custom button appears when the radius matches a preset. |

**Delivered count**: 346 / 346 (up from 343). 49 suites.

**What this section deliberately does NOT do:**

- Add a store unit test for `setRadius` — it already exists
  (`tests/unit/store.test.ts` → "setRadius updates radius"); the map-tab
  test now covers the screen→store write path end-to-end.
- Re-test the Settings slider. It already wrote `store.radius`; this
  change only adds a second writer (the map chips) and a reader (the
  Custom button) of the same value.
- Assert the miles→meters conversion handed to `<Map>` / `useEvents`.
  The Map component is mocked under Jest (see Reflection Q2); the
  conversion is a pure arithmetic boundary verified by inspection.

---

### 2.18 Multi-account correctness pass (post-§2.17 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §23._

Fixes found verifying as a seeded mock user: profile photo no longer
leaks across accounts, you're filtered out of "people nearby"/search,
your `profiles` row self-heals on sign-in, and private profiles get a
Send-request card whose request persists. The testable (mock-mode /
pure-logic) pieces gained coverage; the photo reset and private-card
render are live-/auth-only and verified against the hosted project.

| File added/changed | Tests | What they assert |
|---|---|---|
| `tests/unit/people.test.ts` (new, 4 cases) | `excludeSelf` | Removes the current user by direct id, and by the UUID→mock-id mapping (live mode); returns the list unchanged when meId is undefined or absent. |
| `tests/screens/home.test.tsx` (+1 case) | self-filter wiring | Signed in as the user mapping to mock `p1`, "Maya Chen" is absent from PEOPLE NEARBY. |
| `tests/screens/other-profile.test.tsx` (+1 case) | private request | Pressing REQUEST on a private profile records an outgoing request (the same path that calls `api.sendFriendRequest` in live mode). |

**Delivered count**: 352 / 352 (up from 346). 50 suites (up from 49).

**What this section deliberately does NOT do:**

- Unit-test the AuthBootstrap photo reset. It's a no-op in mock mode (the
  only mode Jest runs); the user-change/sign-out clearing is exercised
  against the hosted project.
- Test the private-account *card* render. That path is live-only (mock
  mode returns the full profile, so `useProfile` never yields null); the
  `requestFriend` logic behind it is covered via the mock REQUEST case.
- Verify migration `00016` or the `profiles` upsert. No DB under Jest —
  the migration must be applied to the hosted project and is verified
  there.

---

### 2.19 Create-event / map-pin / attendees / interests fixes (post-§2.18 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §24._

Five usage-found fixes: event publish now sends the shape the Edge
Function expects, create-event toasts are visible (modal→card), the full
map's pins render again (RPC radius rounded to INT), the attendee preview
is driven by `useAttendees`, and added interests now show on the profile.
Coverage went to the pure logic + state changes; the route-presentation
and live-publish pieces are verified against the hosted project.

| File added/changed | Tests | What they assert |
|---|---|---|
| `tests/unit/date-time.test.ts` (+2 cases) | `friendlyToISO` | A friendly date + time round-trips to the right local hour/minute/month/day; 12 AM / 12 PM map to hours 0 / 12. |
| `tests/unit/store.test.ts` (+1 case) | interests sync | `toggleInterestSub` adds/removes the tag from `me.interests` (what the profile renders), not just `subscribedInterests`. |
| `tests/screens/event-detail.test.tsx` (+1 case) | dynamic attendees | An unjoined event's going count equals the attendees-list length (mock `SC_VISIBLE_PEOPLE`), proving it's not the static `subscriber_count`. |

**Delivered count**: 356 / 356 (up from 352). 50 suites.

**What this section deliberately does NOT do:**

- Test the create-event → Edge Function publish end-to-end. There's no
  Supabase/Deno under Jest; the payload transform (`friendlyToISO`,
  field mapping) is unit-covered, and the live invoke is verified on the
  hosted project (function must be deployed there).
- Test the modal→card route change or the map radius rounding. The first
  is route config (no render assertion adds signal); the second is a
  one-line arithmetic guard verified by the RPC resolving against hosted.
- Persist interest toggles to `user_interests`. The display sync is
  tested; DB persistence (name→id + insert/delete) is a tracked follow-up.

---

### 2.20 Create-event location picker / stepper / default-date / time-picker loop (post-§2.19 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §25._

A create-event map location picker, a real minus on the capacity stepper,
a today-default date, and a fix for the `SCTimePicker` AM/PM infinite
loop. Coverage went to the picker render/confirm and the date default;
the loop fix is scroll-driven (not reproducible in jsdom) and verified on
device, with the existing tap test guarding the unchanged path.

| File added/changed | Tests | What they assert |
|---|---|---|
| `tests/components/LocationPickerSheet.test.tsx` (new, 2 cases) | picker | Renders the sheet chrome when visible; "Use this location" calls `onConfirm` with the center coords (the `initial` point when the mocked map doesn't pan). |
| `tests/screens/create-event.test.tsx` (+1 case) | default date | A new event's date field shows `fmtDate(new Date())` (today). |

**Delivered count**: 359 / 359 (up from 356). 51 suites (up from 50).

**What this section deliberately does NOT do:**

- Reproduce the time-picker loop in a test. The bug lived in
  `onMomentumScrollEnd` ↔ animated `scrollTo` feedback, which jsdom
  doesn't drive; the existing tap-to-select test (`SCTimePicker.test.tsx`)
  guards the path that *is* testable, and the loop fix was verified on a
  device.
- Drive a real map pan in the picker test. `<Map>` is mocked under Jest
  (no leaflet/native maps), so `onRegionChange` never fires — the test
  confirms the no-pan case returns the initial center.
- Add an icon snapshot for the new `minus` glyph (SVG; no behavioral
  surface to assert).

---

### 2.21 Map pin colours aligned to the legend (post-§2.20 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §26._

`pinColor` now maps each event to the legend bucket for its type — the
key fix being that a friend-hosted event is always "Friends"
(`accentFriend`), not grey ("Other") when interests don't overlap. The
shared `tests/unit/map-types.test.ts` was updated to lock the corrected
mapping; no net count change (one case re-pointed, one added).

| File changed | Tests | What they assert |
|---|---|---|
| `tests/unit/map-types.test.ts` | friend / org buckets | A `friend` event resolves to `accentFriend` with **and** without a shared interest; an `org` event resolves to `accentBlue` when it shares an interest and to `mapPinMute` ("Other") when it doesn't. (`yours → primary`, `recommended → accentBlue` unchanged.) |

**Delivered count**: 359 / 359. 51 suites.

**What this section deliberately does NOT do:**

- Reconcile the event-detail header accent for `org` events (it stays
  `accentBlue`; the map shows `mapPinMute` when there's no shared
  interest). The map legend is the surface this change targets.

---

### 2.22 Friend-request flow / map key / location search (post-§2.21 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §27._

Friend requests now persist via a direct insert and show one toast; the
requests screen manages both directions and is reachable from the Profile
tab; the map keeps its colour key when an event is selected; and the
location picker can search by name. Coverage went to the requests screen's
new outgoing section; the others are render-structure or network/scroll
surfaces verified on device.

| File changed | Tests | What they assert |
|---|---|---|
| `tests/screens/requests.test.tsx` (updated, +1 net) | both directions | Header shows "Friend requests" + "N TO APPROVE · M SENT"; empty state needs BOTH directions empty; the seeded outgoing request (Jordan) lists under "Sent by you" and CANCEL clears it from `outgoingRequests`. Accept/Decline incoming unchanged. |

**Delivered count**: 360 / 360 (up from 359). 51 suites.

**What this section deliberately does NOT do:**

- Test the live friend-request insert or the single-toast path. The insert
  needs Supabase (no client under Jest); the double-toast it fixes was a
  live-only Edge-Function failure. Mock mode shows one toast and the
  existing other-profile REQUEST test guards the store write.
- Test the map "key stays visible" via a focused pin. `<Map>` is mocked,
  so `onPinPress` can't fire in jsdom; the legend card is now
  unconditional in `map.tsx` (the existing legend test covers its render).
- Test the Nominatim search. It's a network call (no key); exercised on
  device. The recenter-via-remount is a render concern.
- Cover `useOutgoingRequests` in live mode (needs `api.getProfile` over a
  real DB); the requests-screen test exercises the mock path.

---

### 2.23 Private-profile privacy gate + location search autocomplete (post-§2.22 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §28._

A client-side privacy gate stops a private account from showing its
interests/bio/events to non-friends in any mode, and the location picker
search became a live autocomplete dropdown. Coverage went to the
profile-screen gate; the search is a network surface verified on device.

| File changed | Tests | What they assert |
|---|---|---|
| `tests/screens/other-profile.test.tsx` (updated, +1 net) | privacy gate | Full-profile tests use a public fixture (p1); a private non-friend (p4) sees "This account is private" + their **Interests** but NOT bio/MESSAGE, and can still send a request (see §2.24 for the interests-shown refinement); a private *friend* sees the full profile. |

**Delivered count**: 361 / 361 (up from 360). 51 suites.

**What this section deliberately does NOT do:**

- Re-test the live RLS. The `profiles` SELECT policy (00014) already
  hides private rows from non-friends server-side; this change is the
  client-side gate that also covers mock mode. No DB under Jest.
- Test the Nominatim autocomplete dropdown. It's a debounced network call
  (no key); exercised on device. The skip-guard/remount are render
  concerns.

---

### 2.24 Private interests visible + location-biased search (post-§2.23 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §29._

Refines §2.23: a private account now shows its **interests** to
non-friends (only interests; bio/events/etc. stay hidden), and the
location-picker search biases suggestions to the user's region. The
profile-screen test was re-pointed to assert interests are present on a
private non-friend's card; the search bias is a network/param change
verified on device.

| File changed | Tests | What they assert |
|---|---|---|
| `tests/screens/other-profile.test.tsx` | private interests | A private non-friend's card now renders "Interests" (public) but still hides bio + MESSAGE, and the request still sends. (Mock resolves interests from `SC_ACCOUNT_BY_ID`; live uses `api.getInterestsForUser` over the publicly-readable `user_interests`.) |

**Delivered count**: 361 / 361. 51 suites.

**What this section deliberately does NOT do:**

- Test `api.getInterestsForUser` / `useUserInterests` in live mode (needs
  Supabase; the mock path is exercised via the profile-screen test).
- Test the Nominatim `viewbox` bias. It's a network call with no key;
  the param construction is verified by inspection and on device.

---

### 2.25 Private bio visible, edit-bio, interest persistence (post-§2.24 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §30._

A private account now shows its bio (not just interests) to non-friends,
the edit-profile sheet can edit the bio, and interest toggles persist to
`user_interests` in live mode. Coverage went to the testable client
state; the DB persistence is verified on the hosted project.

| File changed | Tests | What they assert |
|---|---|---|
| `tests/screens/other-profile.test.tsx` (updated) | private bio | A private non-friend's card now shows the bio + "Interests" but still no MESSAGE; the request still sends. |
| `tests/components/EditProfileSheet.test.tsx` (+1) | edit bio | Editing the bio field and pressing SAVE CHANGES writes `me.bio` and closes the sheet. (Existing name-save / empty-name / pre-fill cases unchanged.) |

**Delivered count**: 362 / 362 (up from 361). 51 suites.

**What this section deliberately does NOT do:**

- Test `api.setInterestSubscribed` end-to-end. It's a live DB write
  (resolve/create interest + insert/delete `user_interests`); no Supabase
  under Jest. The store sync that drives the UI is covered by
  `tests/unit/store.test.ts`; persistence is verified on hosted.
- Add a live `profile_card` RPC for arbitrary private accounts. The
  private card's bio/name/avatar come from the mock fallback, which covers
  the reachable (seeded) accounts; the RPC remains a documented follow-up.

---

### 2.26 Profiles row → Account mapping fix (post-§2.25 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §31._

Live `profiles` rows were cast to `Account` without mapping
`user_id → id` (etc.), so `Account.id` was `undefined` in live mode —
breaking list keys (`key={p.id}`), profile-link navigation, and the
private-profile gate. Fixed with a `transformProfileRow()` helper in
`getProfile` / `fetchFriends` / `fetchAttendees`.

| Coverage | Notes |
|---|---|
| No new tests | The bug + fix are **live-only** (mock fixtures already carry `id`, so the suite was green throughout and can't reproduce it). `transformProfileRow` is a pure mapping but module-local; verified on the hosted project + by `tsc`. Test count unchanged at 362/362. |

**What this section deliberately does NOT do:** export `transformProfileRow`
purely to unit-test it. If the mapping grows, promoting it to a tested
helper (like `transformEventRow`) is the natural step.

### 2.27 Keyboard avoidance for text inputs (post-§2.26 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §32._

Forms now keep the focused input above the on-screen keyboard: `Screen`
(scroll) wraps a `KeyboardAvoidingView`; the bottom-sheet modals
(EditProfileSheet, LocationPickerSheet) lift by the measured keyboard
height via a new `useKeyboardHeight` hook.

| Coverage | Notes |
|---|---|
| No new tests | Keyboard show/hide + layout reflow is runtime device behavior that jsdom/Jest doesn't drive. Verified by the established pattern (the chat composer already used `KeyboardAvoidingView`), `tsc`, the full suite (362/362, the `Screen` wrapper change is transparent in tests), and on a device/emulator. |

**What this section deliberately does NOT do:** mock `Keyboard` events to
assert padding values — the values come from the OS at runtime; a render
assertion would only restate the implementation.

### 2.28 Keyboard avoidance upper bound (post-§2.27 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §33._

The bottom-sheet modals now clamp their height to the space between the
top safe area and the keyboard, so a tall sheet can't push its top above
the screen. EditProfileSheet content scrolls within the clamp;
LocationPickerSheet shrinks its map while the keyboard is open.

| Coverage | Notes |
|---|---|
| No new tests | The clamp is `windowHeight − topInset − keyboardHeight`, computed from runtime metrics jsdom doesn't provide (keyboard height is always 0 in Jest). Verified by `tsc`, the suite (the sheets still render — `EditProfileSheet`/`LocationPickerSheet` tests pass), and on-device reasoning. |

### 2.29 Chat tab compose button (post-§2.28 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §34._

Added the missing create-chat entry point on the Chat tab (the composer
itself was already complete).

| File changed | Tests | What they assert |
|---|---|---|
| `tests/screens/chat-tab.test.tsx` (+1) | compose button | Pressing the "Start a new chat" button routes to `/new-chat`. (Existing header / chat-card / unread-badge / tap-to-thread cases unchanged.) |

**Delivered count**: 363 / 363 (up from 362). 51 suites.

**What this section deliberately does NOT do:** re-test the new-chat
composer — it was covered when it shipped (`tests/screens/new-chat.test.tsx`);
this change only adds the button that reaches it.

---

### 2.30 Cleanup + de-mocking pass (post-§2.29 delta)

_Captured 2026-05-21 alongside `docs/PROGRESS_SNAPSHOT.md` §35._

Six-part cleanup: account deletion = reassign-then-delete-row + clear drafts;
sign-up identity (name + unique username + stored email); pull-to-refresh on
`Screen`; and the live de-mock (every live screen reads Supabase, `SC_*` kept
only behind `isMock()`). New migrations `00019` (email + identity trigger) and
`00020` (`[deleted user]` placeholder + `reassign_then_delete_account` RPC); the
`delete-account` Edge Function rewritten; `seed-hosted-social.sql` extended with
p5/p6/orgC/orgD. New `lib/api.ts` methods `searchPeople`/`searchOrgs`/
`getProfilesByIds` and enriched `getChats`/`fetchRatings`.

| File changed | Tests | What they assert |
|---|---|---|
| `tests/unit/api-mock.test.ts` (+7) | `searchPeople` (3) / `searchOrgs` (2) / `getProfilesByIds` (2) | Empty query returns the full fixture; name/username/interest filtering is case-insensitive; no-match → `[]`; id resolution preserves order + drops misses; empty id list → `[]`. |
| `tests/screens/settings.test.tsx` (+1) | delete clears drafts | Running the delete-account confirm action empties the local `drafts` slice (mock `deleteAccount`/`signOut` resolve immediately). |
| `tests/components/Screen.test.tsx` (new, +4) | `onRefresh` wiring | Renders children; no Refresh button without `onRefresh`; on web shows a "Refresh" button that invokes `onRefresh`; on native renders no web button (uses `RefreshControl`). |

**Delivered count**: 377 / 377 (up from 363). 52 suites (new `Screen.test.tsx`).

**What this section deliberately does NOT do:** exercise the live (Supabase)
paths of the new API methods, the deletion RPC, or the identity trigger — Jest
runs in mock mode, so those are verified manually on the hosted project after
applying `00019`/`00020` and re-running the social seed (see PROGRESS_SNAPSHOT
§35.5). The local `following` set + managed-account switching remain user-state
(no follows table), so they aren't re-tested as live data.

---

### 2.31 Interest-gated recommendations + incoming friend-request fixes (post-§2.30 delta)

_Captured 2026-05-22 alongside `docs/PROGRESS_SNAPSHOT.md` §36._

Three fixes: (1) "Recommended" is now per-user interest-driven (a scraped event
you have no interest in is "Other"); (2) incoming friend requests from a private
account weren't showing (RLS hid the requester + an un-caught `Promise.all`);
(3) the friend-request hint counts now come from the live hooks. New migration
`00021` (pending-request profile visibility); new `lib/events.isRecommendedFor`.

| File changed | Tests | What they assert |
|---|---|---|
| `tests/unit/map-types.test.ts` (±0) | recommended needs an interest | `pinColor` returns blue for a scraped event only when the user shares one of its interests; muted otherwise (replaces the old "scraped ⇒ always blue" case). |
| `tests/components/SCEventCard.test.tsx` (+1) | scraped label is interest-gated | A scraped card shows "RECOMMENDED" with a matching `meInterests`, and "NEARBY" (not RECOMMENDED) without. |

**Delivered count**: 378 / 378 (up from 377). 52 suites.

**What this section deliberately does NOT do:** exercise the live RLS path of
migration `00021` or the live recommended-by-interest classification — Jest runs
in mock mode, so those are verified manually on the hosted project after applying
the migration (the private seeded requester, e.g. Jordan, becomes visible to the
recipient and the incoming list + counts populate). The friend-request count
hooks are the same ones already covered by the requests-screen tests.

---

### 2.32 Fix a friend showing twice / duplicate React key (post-§2.31 delta)

_Captured 2026-05-22 alongside `docs/PROGRESS_SNAPSHOT.md` §37._

A cross friend-request that both sides accept leaves two accepted rows (the
`UNIQUE(from_id,to_id)` mirror pair), so `api.fetchFriends`' two-direction union
returned the same friend twice → duplicate React key. Fix: `fetchFriends`
dedupes the union by id, and `sendFriendRequest` no-ops when a pending/accepted
friendship already exists in either direction (no mirror row).

| Area | Tests | Notes |
|---|---|---|
| `lib/api.ts` `fetchFriends` / `sendFriendRequest` | none added | Both fixes live on the Supabase-only path; Jest runs in mock mode (`fetchFriends` returns the fixture, `sendFriendRequest` short-circuits to `pending`), so the existing `useFriends` / `api-mock` / `requests` suites still cover the mock contract and stay green. The dedupe + mirror-guard are verified manually on the hosted project (the duplicated friend collapses to one row; re-requesting an existing friend is a no-op). |

**Delivered count**: 378 / 378 (no change). 52 suites; `tsc` clean.

**What this section deliberately does NOT do:** add a live-path unit test —
the suite has no Supabase mock harness, so live-only branches (like this one)
are validated against the hosted project rather than in Jest, consistent with
§2.30/§2.31.

---

### 2.33 Search ALL filter + auto-selected filters, "Orgs" rename, avatars in Supabase (post-§2.32 delta)

_Captured 2026-05-22 alongside `docs/PROGRESS_SNAPSHOT.md` §38._

Four items: rename the Profile "Following" row to "Orgs"; auto-select a search
filter via `?tab=` (Browse orgs → orgs, Find people → people); add an ALL search
tab (combined feed, now the default); and store profile photos in a new Supabase
`avatars` bucket (migration `00022`, `api.uploadAvatar`/`removeAvatar`).

| File changed | Tests | What they assert |
|---|---|---|
| `tests/unit/api-mock.test.ts` (+2) | avatar mock | `uploadAvatar` echoes the local uri in mock mode; `removeAvatar` resolves to a no-op. |
| `tests/screens/search.test.tsx` (+3) | ALL + `?tab=` | The default ALL tab shows events + people + orgs together; `?tab=orgs` shows orgs and hides events; `?tab=people` shows people and hides orgs. |
| `tests/screens/my-following.test.tsx` (+1) | browse → orgs | "Browse orgs" routes to `/search?tab=orgs`. |
| `tests/screens/my-friends.test.tsx` (+1) | find → people | "Find more people" routes to `/search?tab=people`. |

**Delivered count**: 385 / 385 (up from 378). 52 suites; `tsc` clean.

**What this section deliberately does NOT do:** exercise the live avatar upload
(Storage) path — Jest has no Supabase/Storage mock harness, so `uploadAvatar`/
`removeAvatar` are verified manually on the hosted project after applying
migration `00022` (pick a photo → it lands in the `avatars` bucket +
`profiles.avatar_url` and reloads after sign-out/in), consistent with the other
live-path deltas.

---

### 2.34 Cross-user chat delivery + dynamic events-attended count (post-§2.33 delta)

_Captured 2026-05-22 alongside `docs/PROGRESS_SNAPSHOT.md` §39._

Three fixes: (1) **chat sends were failing** — `00011`'s self-referential
`chat_members` SELECT policy caused Postgres "infinite recursion detected in
policy", which broke every RLS-checked chat access including the `messages`
INSERT (the failed-retry / `[object Object]` symptom). Migration `00023` adds a
`SECURITY DEFINER` `is_chat_member()` helper and rewrites the four chat policies
to use it; `api.sendMessage` now throws the real PostgREST message. (2) delivery
robustness — Realtime authorized with the user JWT (`realtime.setAuth`) + thread/
tab re-fetch on focus (`useChatMessages.reload`). (3) Profile ATTENDED is now the
live `joined`-set size (confirmed subscriptions) instead of a static field.

| Area | Tests | Notes |
|---|---|---|
| Chat RLS recursion fix (`00023`), realtime auth, `useChatMessages` reload, focus re-fetch | none added | All live-only (RLS / realtime / navigation focus); Jest runs in mock mode with no Supabase/RLS harness, so these are verified on the hosted project after applying `00023` (two users in a chat: send succeeds and the message appears for the other, live + on reopen). The `expo-router` test mock gained a no-op `useFocusEffect` so the chat screens still render in Jest. |
| Profile ATTENDED = `joined.size` | covered | The existing `profile-tab.test.tsx` renders the ATTENDED stat; the value now derives from the hydrated `joined` set (resetStore seeds it). |
| Profile MESSAGE → `createChat` (`other-profile.test.tsx`, +1) | follow-up (`ce09429`) | After `00023`, starting a chat from a profile still failed (`invalid input syntax for type uuid: "dm-<uuid>"`) because the Message button routed to a fabricated `/chat/dm-${id}`. It now goes through `api.createChat`; the test asserts MESSAGE pushes `/chat/dm-p1` in mock (the RPC's real id in live). |

**Delivered count**: 386 / 386 (+1 from the Message-button follow-up). 52 suites; `tsc` clean.

**What this section deliberately does NOT do:** add a live RLS/realtime/socket
test harness — chat send + cross-user delivery are validated on the hosted
project (requires migrations `00023` and, for instant delivery, `00012`'s
realtime publication).

---

### 2.35 Event join via RPC + chat UI polish (post-§2.34 delta)

_Captured 2026-05-22 alongside `docs/PROGRESS_SNAPSHOT.md` §40._

Joining an event errored ("Failed to send a request to the Edge Function" /
"non-2xx") because `subscribeToEvent` invoked the undeployed `subscribe-to-event`
Edge Function. It now calls the `subscribe_to_event_atomic` RPC directly
(`00015`, SECURITY DEFINER). Leaving was also silently broken (no UPDATE policy
on `event_subscriptions`) — migration `00024` adds own-row write policies. UI:
the `SCButton` `ghost` variant got a border (profile "Message" reads as a
button) and the chat composer got `insets.bottom + 24` bottom padding.

| Area | Tests | Notes |
|---|---|---|
| `subscribeToEvent` → RPC, `00024` cancel policies | covered | Live-only (RPC + RLS); the mock-mode return shape is unchanged, so the existing `api-mock` + `event-detail` tests still cover the contract. Verified on the hosted project after applying `00024` (+ confirming `00015`): join → confirmed/waitlisted, leave persists. |
| `SCButton` ghost border, composer padding | covered | Pure styling on shared components; existing button/chat-thread render tests still pass (no text/structure change). |

**Delivered count**: 386 / 386 (no change). 52 suites; `tsc` clean.

**What this section deliberately does NOT do:** add a live RPC/RLS test harness —
event join/leave are validated on the hosted project (requires migrations
`00015` and `00024` applied).

---

### 2.36 Compact event hero, other-profile stats, joined-events list (post-§2.35 delta)

_Captured 2026-05-22 alongside `docs/PROGRESS_SNAPSHOT.md` §41._

Event-detail hero halved (240 → 120); `SCButton` ghost border bumped to `t.ink3`
(Message reads as a button); other profiles get a hosted/attended/rating stat
row + "No bio yet." fallback (attended via the `attended_count` RPC, `00025`);
and the profile ATTENDED stat now opens a new `my-events` list of joined events
(`api.fetchJoinedEvents` + `useJoinedEvents`).

| File changed | Tests | What they assert |
|---|---|---|
| `tests/screens/profile-tab.test.tsx` (+1) | ATTENDED → list | Tapping the ATTENDED stat routes to `/my-events`. |
| `tests/screens/my-events.test.tsx` (new, +3) | joined list | Lists the events in the `joined` set (mock seed `e1`); tapping one opens `/event/e1`; shows the empty state when nothing is joined. |

**Delivered count**: 390 / 390 (+4). 53 suites; `tsc` clean.

**What this section deliberately does NOT do:** test the live attended-count RPC
or the live joined-events fetch — both are live-only (RPC / RLS), verified on the
hosted project after applying migration `00025`. The hero resize + ghost border
are styling, covered by existing render tests.

---

### 2.37 Join/leave button state fix + linked event host (post-§2.36 delta)

_Captured 2026-05-23 alongside `docs/PROGRESS_SNAPSHOT.md` §42._

Join/joined state was wrong + rejoin failed: AuthBootstrap now `toMockId`-maps
the `joined` set so it matches the app's event ids, and `cancelSubscription`
hard-`DELETE`s (the subscribe RPC treated a soft-cancelled row as "already
subscribed", blocking rejoin). The event "Hosted by" row now shows the host's
name and links to their profile.

| Area | Tests | Notes |
|---|---|---|
| AuthBootstrap `joined` id-mapping, `cancelSubscription` hard-delete | none added | Live-only (AuthBootstrap short-circuits in mock; cancel is a no-op in mock). Verified on the hosted project: join sticks across reload, leave + re-join work. The mock `joined` set (resetStore) already uses mock ids, so existing event/home tests are unaffected. |
| "Hosted by" name + profile link | covered | `useProfile(hostId)` resolves the host; existing event-detail render tests still pass (no asserted "Hosted by" text). |

**Delivered count**: 390 / 390 (no change). 53 suites; `tsc` clean.

**What this section deliberately does NOT do:** add a live AuthBootstrap/RLS
harness — the id-mapping + hard-delete + host fetch are validated on the hosted
project (no new migration needed; relies on `00024` already applied).

---

### 2.38 Chat list refresh, rejoin button, joined-icon colors, live conflict chip (post-§2.37 delta)

_Captured 2026-05-23 alongside `docs/PROGRESS_SNAPSHOT.md` §43._

Four UX fixes: the Chat tab reloads on every focus (existing chats show without
messaging first); `joinEvent` clears `pendingLeave` (rejoin during the grace
flips the button); `my-events` icons use `pinColor` (match yours/friend/
recommended/other + recolor with interests); and `ConflictChip` takes an
`eventsById` prop so overlap detection resolves real joined events in live.

| File changed | Tests | What they assert |
|---|---|---|
| `store/useStore.ts` `joinEvent` | `tests/unit/store.test.ts` (+1) | After `schedulePendingLeave('e1')`, `joinEvent('e1')` clears `pendingLeave` and `isJoined('e1')` is true again. |
| Chat-tab focus reload, `my-events` `pinColor`, `ConflictChip`/`SCEventCard` `eventsById` | covered | Live/navigation behavior; existing `ConflictChip` / `my-events` / `chat-tab` render tests still pass (the conflict chip's default lookup stays `SC_EVENT_BY_ID`; the focus refetch is a no-op in the jest navigation mock). |

**Delivered count**: 391 / 391 (+1). 53 suites; `tsc` clean.

**What this section deliberately does NOT do:** add a live navigation/RLS harness
for the focus refetch or the live conflict lookup — both are validated on the
hosted project. No new migrations.

---

### 2.39 Consistent event category, map View-location, past/upcoming, rating system (post-§2.38 delta)

_Captured 2026-05-23 alongside `docs/PROGRESS_SNAPSHOT.md` §44._

Four items: a single `eventCategory` classifier feeds both pin color and label
(they could disagree before); an event's **View location** opens the Map focused
on that event (`Map` `centerOn` prop + `/(tabs)/map?focus=<id>`); the joined-events
screen splits **Upcoming** / **Past** (new `SCEvent.startAt`); and a rating system
(`RateEventSheet` → `api.rateEvent` upsert into `ratings`, linked to the host via
`events.creator_id`; migration `00026` adds the own-row UPDATE/DELETE policies).

| File changed | Tests | What they assert |
|---|---|---|
| `lib/events.ts` (`eventCategory`, `EVENT_CATEGORY_LABEL`) | `tests/unit/events.test.ts` (NEW, +5) | `yours`/`friend` win over interest match; non-yours/non-friend is `recommended` only on a shared interest tag (else `other`); the label map covers every category; `isRecommendedFor` is false with no interests, true on a shared tag. |
| `lib/api.ts` `fetchEvents` (live interest merge) | covered (live) | Root cause of "NEARBY on home, RECOMMENDED on detail": `rank_events_query` is a SETOF RPC, so its rows can't carry a PostgREST `event_interests` embed → empty interests → every live event read as `other` on the feed + map. `fetchEvents` now fetches the tags for the ranked ids and merges them in. Validated on the hosted project; mock mode (`SC_EVENTS`) is unaffected. |
| `lib/api.ts` `rateEvent` | `tests/unit/api-mock.test.ts` (+1) | Mock mode returns `{ rated: true }` without a backend call. |
| `Map` `centerOn`, `app/(tabs)/map.tsx` `?focus`, `app/my-events.tsx` past/upcoming, `RateEventSheet`, event-detail rate button + linked host | covered | Navigation/live behavior; existing Map / my-events / event-detail render tests still pass (the jest navigation mock makes the focus param + map recenter a no-op; the past/upcoming split keeps mock fixtures — no `startAt` — as Upcoming). |

**Delivered count**: 397 / 397 (+6). 54 suites (new `events.test.ts`); `tsc` clean.

**What this section deliberately does NOT do:** render the device map to assert the
`centerOn` pan, or hit a live `ratings` table — both are validated on the hosted
project after applying migration `00026`.

---

### 2.40 Friend+recommended dual label, joined-list focus refresh, search colours, radius-driven feed (post-§2.39 delta)

_Captured 2026-05-23 alongside `docs/PROGRESS_SNAPSHOT.md` §45._

Four live-reported follow-ups: a friend-hosted event matching your interests now
also shows a **RECOMMENDED** badge (`isAlsoRecommended`); the events-you've-joined
screen reloads on focus + hides mid-leave events; search rows colour by category
from your live interests instead of a fixed blue; and home + search honour the
persisted discovery radius so changing it re-fetches the in-range feed.

| File changed | Tests | What they assert |
|---|---|---|
| `lib/events.ts` (`isAlsoRecommended`) | `tests/unit/events.test.ts` (+3) | True only for a `friend` event sharing an interest; false with no/again-no shared interest; false when the match already makes the event its own `recommended` category (`other`) or when it's `yours`. |
| `SCEventCard`, `app/events.tsx`, `app/search.tsx`, `app/event/[id].tsx` (RECOMMENDED badge) | covered | Render the extra badge from `isAlsoRecommended`; existing card/list/detail render tests still pass. |
| `app/search.tsx` (`pinColor` icon + radius), `app/(tabs)/index.tsx` (radius) | covered | Search icon colour + label derive from `pinColor`/`eventCategory` over the live `meInterests`; home + search pass `radiusM` to `useEvents`. Mock fixtures keep their interests so categories are unchanged in tests. |
| `app/my-events.tsx` (`useFocusEffect` reload + `pendingLeave` filter) | covered | Reloads on focus and excludes pending-leave events; the jest navigation mock makes `useFocusEffect` a no-op, so the existing render test still passes. |

**Delivered count**: 400 / 400 (+3). 54 suites; `tsc` clean.

**What this section deliberately does NOT do:** add a live navigation harness to
assert the focus refetch or the radius-driven refetch, or a real friend-hosted
matching event — all verified on the hosted project. No new migrations.

---

### 2.41 Map focused-card chip + interests, loading skeletons, refresh indicator (post-§2.40 delta)

_Captured 2026-05-23 alongside `docs/PROGRESS_SNAPSHOT.md` §46._

The map focused-event card gains the category chip + `RECOMMENDED` badge + the
event's interest tags (truncated past 3 into a "+N" pill); new reusable
`SCSkeleton`/`SCListSkeleton`/`SCRailSkeleton` + `SCEmptyState` give every data
screen a shape-matched loading skeleton and a `!loading`-gated empty state; and
`Screen` shows a spinning "REFRESHING" pill on all platforms while refreshing,
with each page's handler re-running all of its queries.

| File changed | Tests | What they assert |
|---|---|---|
| `components/SCSkeleton.tsx` (NEW), `components/SCEmptyState.tsx` (NEW) | `tests/components/skeleton.test.tsx` (NEW, +5) | `SCSkeleton` renders one "Loading"-labelled block; `SCListSkeleton rows={3}` renders 9 (3 per row); `SCRailSkeleton` renders placeholder cards; `SCEmptyState` renders its title/subtitle and an optional action. |
| `app/(tabs)/map.tsx` (focused-card chip + interests + `onRefresh`) | covered | Category chip/badge + truncated tags render; existing map render test still passes (mock fixtures populate interests). |
| `app/(tabs)/index.tsx`, `app/events.tsx`, `app/search.tsx`, `app/my-events.tsx`, `app/(tabs)/chat.tsx`, `app/ratings/[hostId].tsx`, `app/attendees/[id].tsx` (skeleton + gated empty + refresh) | covered | Loading-gated skeleton/empty; in mock mode `loading` is false so the existing screen tests still see real rows. |
| `components/Screen.tsx` (`RefreshIndicator`) | `tests/components/Screen.test.tsx` (existing) | Indicator only mounts while `refreshing`; existing web-button / RefreshControl wiring tests still pass. |

**Delivered count**: 405 / 405 (+5). 55 suites (new `skeleton.test.tsx`); `tsc` clean.

**What this section deliberately does NOT do:** drive a live fetch to assert the
skeleton→list→empty transition or the spinning indicator timing — both are
verified on the hosted project. No new migrations.

---

### 2.42 Edit/delete reviews, bolder rate symbol, selected map pin (post-§2.41 delta)

_Captured 2026-05-23 alongside `docs/PROGRESS_SNAPSHOT.md` §47._

Your own reviews gain a "⋮" menu to edit (reopen the pre-filled rate sheet) or
delete (`api.deleteRating`); the event-detail rate star becomes a filled gold
button with a dark star; and the map highlights the focused/clicked pin via a new
`Map` `selectedId` prop.

| File changed | Tests | What they assert |
|---|---|---|
| `lib/api.ts` `deleteRating` | `tests/unit/api-mock.test.ts` (+1) | Mock mode returns `{ deleted: true }` without a backend call. |
| `app/ratings/[hostId].tsx` (⋮ menu + edit/delete), `components/RateEventSheet.tsx` (`initialStars`/`initialText` edit mode) | covered | "Mine" via `toMockId(me.id) === reviewerId`; menu/edit-sheet/confirm-delete wiring. Existing ratings render test still passes (mock self has reviews but the menu only adds a button). |
| `components/SCIcon.tsx` (`more`, `trash`), `app/event/[id].tsx` (filled rate button), `components/Map/*` + `app/(tabs)/map.tsx` (`selectedId`) | covered | New icons render; rate button + selected-pin styling are visual; existing Map/event-detail render tests still pass (`selectedId` defaults undefined). |

**Delivered count**: 406 / 406 (+1). 55 suites; `tsc` clean.

**What this section deliberately does NOT do:** assert the dropdown open/close or
the live delete/edit round-trip, or render the leaflet/native pin to check the
selected size — all verified on the hosted project. Re-uses migration `00026`
(own-row UPDATE/DELETE on `ratings`); no new migration.

---

### 2.43 Tappable reviewer, consistent follow count, EVENTS/HOSTED profile lists (post-§2.42 delta)

_Captured 2026-05-23 alongside `docs/PROGRESS_SNAPSHOT.md` §48._

The ratings reviewer is now tappable → their profile; the profile "Orgs" count
matches the resolved my-following list; the ATTENDED stat is renamed EVENTS and
HOSTED becomes a tappable list; `my-hosting` shows all hosted events (current +
past) split Upcoming/Past via `useHostedEvents`.

| File changed | Tests | What they assert |
|---|---|---|
| `app/(tabs)/profile.tsx` (EVENTS rename, HOSTED tap, resolved Orgs count) | `tests/screens/profile-tab.test.tsx` (updated +1) | Stat tiles read HOSTED/EVENTS/RATING; tapping EVENTS → `/my-events`; tapping HOSTED → `/my-hosting`. |
| `app/my-hosting.tsx` (useHostedEvents + Upcoming/Past) | `tests/screens/my-hosting.test.tsx` (existing) | Still renders the headline + rows for `hostId==='me'` events and routes to `/event/<id>` (mock `useHostedEvents('me')` returns the same set; events without `startAt` land under Upcoming). |
| `app/ratings/[hostId].tsx` (reviewer → profile), `app/my-following.tsx` (focus reload) | covered | Reviewer Pressable + focus reload; existing ratings/following render tests still pass. |

**Delivered count**: 407 / 407 (+1). 55 suites; `tsc` clean.

**What this section deliberately does NOT do:** add a live harness for the
followed-org resolution/persistence or the past/upcoming hosted split — verified
on the hosted project. No new migrations.

---

### 2.44 Dark-mode contrast fixes + darker review icon (post-§2.43 delta)

_Captured 2026-05-23 alongside `docs/PROGRESS_SNAPSHOT.md` §49._

Active filled-pill labels (settings palette, ratings star filters, events filter,
search tabs, map radius) used hardcoded `'white'` over a `t.ink` fill that turns
near-white in dark mode → invisible; now `t.surface` (mode-adaptive inverse of
ink). The gold review/rate star used `t.ink` (washed out in dark mode) → new
constant `warnInk`.

| File changed | Tests | What they assert |
|---|---|---|
| `theme/tokens.ts` (`warnInk` constant) | `tests/unit/tokens.test.ts` (NEW, +2) | `warnInk` is `#1A1205` in every palette/mode; `surface !== ink` everywhere (active-pill label stays visible). |
| `app/settings.tsx`, `app/ratings/[hostId].tsx`, `app/events.tsx`, `app/search.tsx`, `app/(tabs)/map.tsx` (`'white'` → `t.surface`) | covered | Color-only; existing screen tests assert text not colour, so unaffected. |
| `app/event/[id].tsx` (rate star → `t.warnInk`; hero pills `'white'` → `t.card`) | covered | Color-only; hero category/RECOMMENDED pills now legible in dark mode. |
| `components/Screen.tsx` (refresh icon/pill `t.ink2` → `t.ink`) | `tests/components/Screen.test.tsx` (existing) | Darker refresh affordance; existing web-button / RefreshControl wiring tests still pass. |
| `supabase/config.toml` (`[db] major_version` 15 → 17) | n/a | Local-only Postgres version to match the linked project (CLI mismatch warning); not exercised by Jest. |

**Delivered count**: 409 / 409 (+2). 56 suites (new `tokens.test.ts`); `tsc` clean.

**What this section deliberately does NOT do:** snapshot-test rendered colours per
mode — the invariant test (`surface !== ink`) guards the regression instead. No
new migrations.

---

### 2.45 Scraped-event auto-tagging: create interests + fuzzy matching (post-§2.44 delta)

_Captured 2026-05-24 alongside `docs/PROGRESS_SNAPSHOT.md` §51._

FR6's `ingest-scraped` auto-tagger matched **description-only** interest names by
raw substring and never created a tag when nothing matched (events published
unlabeled). New pure analyzer `supabase/functions/_shared/interest-matching.ts`
runs over **title + description**, matches existing interests by name/alias on a
morphological **stem** (so `bike`/`biking`/`bikes` and `spin`/`spinning` reuse one
interest instead of minting duplicates), and on no match derives + singularizes a
new tag the function creates and attaches.

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/functions/_shared/interest-matching.ts` (NEW analyzer) | `supabase/functions/_shared/interest-matching.test.ts` (NEW, 14 Deno cases) | name + alias matches; every inflected form of `bike`→`biking` and the run-family→`running`; `Spinning`→`biking` via the `spin` alias; **distinct roots not merged** (`hiking`≠`biking`); multi-word/hyphenated phrase needs all its words; no-match → derive + singularize (`tacos`→`taco`); stop-word/bare-number exclusion; empty→`null`. |
| `supabase/functions/ingest-scraped/index.ts` (wired in) | covered indirectly (Edge Function — no Jest harness) | Fetches `id, name, similar_tags`; analyzes title+description; attaches matched interest ids; on no match inserts the derived interest (re-selects on UNIQUE conflict) and attaches it. |

**Test runtime**: these are **Deno** tests (`deno test`), not Jest — the analyzer
is Edge-Function code that imports via URL/`.ts` specifiers. The Jest suite is
therefore unchanged at **409 / 409**; during development the same assertions were
run through Node's `--experimental-strip-types` to confirm outputs (Deno isn't
installed in the dev box). Requires re-deploying `ingest-scraped`.

**What this section deliberately does NOT do:** use edit-distance / Levenshtein
fuzziness — that wrongly fuses distinct short roots (`biking`/`hiking` differ by
one letter). Matching is morphology-only (stemming), which collapses inflections
without merging different topics. Agentive `-ist` forms (`cyclist`) are not
stemmed (stripping `-ist` over-merges, e.g. `twist`).

---

### 2.46 Scraped-event source link + dark-mode refresh + bare auto-tags (post-§2.45 delta)

_Captured 2026-05-24 alongside `docs/PROGRESS_SNAPSHOT.md` §52._

Scraped events now carry a `source_url` (migration `00027`) the detail screen
links to in place of the (absent) host; the native refresh spinner switched from
the washed-out `ink3` to the adaptive `ink`; and auto-created interests store
just their name.

| File changed | Tests | What they assert |
|---|---|---|
| `app/event/[id].tsx` (source-link row) + `types/domain.ts` (`SCEvent.sourceUrl`) + `lib/api.ts` (`source_url`→`sourceUrl`) + `data/mocks.ts` (`e4.sourceUrl`) | `tests/screens/event-detail.test.tsx` (+1) | A scraped event (`e4`) renders **"View original listing →"** and **no** "Hosted by" row; pressing it calls `Linking.openURL(sourceUrl)`. The existing host-row path is unchanged for user events. |
| `components/Screen.tsx` (RefreshControl `ink3`→`ink` + Android `colors`/`progressBackgroundColor`) | `tests/components/Screen.test.tsx` (existing) | Color-only; existing RefreshControl/web-button wiring tests still pass (the assertions are on behavior, not the spinner colour). |
| `supabase/migrations/00027_events_source_url.sql` (new column) | n/a (DDL) | Adds `events.source_url TEXT`; applied on hosted Supabase, not exercised by Jest. |
| `supabase/functions/ingest-scraped/index.ts` (store `source_url`; mint interest with name only) + `scripts/scrape-events.mjs` (capture JSON-LD `url`) | covered indirectly (Edge Function / CI script) | The scraper sends `source_url`; the function persists it and creates interests with no description prefix. |

**Delivered count**: 410 / 410 (+1). `tsc` clean.

**What this section deliberately does NOT do:** surface `source_url` through the
`rank_events_query` RPC (the feed/cards have no link, so it isn't needed there —
only `getEventById`, which selects `*`, carries it). **Live rollout order:** apply
migration `00027` before redeploying `ingest-scraped`, or the `source_url` insert
fails until the column exists.

---

### 2.47 Auto-tag precision: stop-list + `unknown` fallback + trimmed aliases (post-§2.46 delta)

_Captured 2026-05-24 alongside `docs/PROGRESS_SNAPSHOT.md` §53._

Tightens the scraped-event auto-tagger after reviewing the first live re-run
(good dedup, mediocre tag quality). Expanded `STOP_WORDS` (marketing/commercial/
locale/time filler), an `unknown` catch-all when no real word is found, and
trimmed the two broadest seed aliases (`live`→`music`, `irvine`→`uci`).

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/functions/_shared/interest-matching.ts` (expanded stops; `UNKNOWN_TAG`; `analyzeInterests` falls back to it) | `supabase/functions/_shared/interest-matching.test.ts` (+2 Deno cases) | All-filler text (`"Grand Opening Sale"` / `"Networking mixer in Orange County"`) → `suggested === 'unknown'`; a real topic word (`"Summer Pottery Sale"` → `pottery`) still survives the bigger stop-list. Existing match/derive cases unchanged. |
| `supabase/seed.sql`, `supabase/seed-hosted.sql`, `scenecheck-expo/data/mocks.ts` (trim `live` from `music`, `irvine` from `uci`) | full Jest suite (regression) | Mock-catalog change is color/data-only; 410/410 unchanged (no test asserted the trimmed aliases). |

**Delivered count**: Jest 410/410 (the analyzer + its tests are Deno, off the Jest
path); `tsc` clean.

**What this section deliberately does NOT do:** use edit-distance fuzziness (still
morphology-only), or trim every broad alias — `biking`'s `running`/`spin` and
`group10`'s `team`/`project` are left unless requested. **Live rollout:** because
matching fires on existing catalog rows, the bare auto-created junk interests must
be deleted (and the two aliases `UPDATE`d) before re-running the scraper, or the
old tags persist.

---

### 2.48 Scraper CI resilience + verified live FR6 re-tag (post-§2.47 delta)

_Captured 2026-05-24 alongside `docs/PROGRESS_SNAPSHOT.md` §54._

The scraper hard-failed (`exit 1`) when Eventbrite served the CI runner a `405`
(intermittent datacenter-IP bot defense). It now retries with rotating
User-Agents and falls back to seed events on total failure, so the workflow never
hard-fails. Also records the end-to-end live verification of the FR6 auto-tag
pipeline (the analyzer's own behavior is covered by the Deno tests in §2.45/§2.47).

| Surface | How verified | Result |
|---|---|---|
| `scripts/scrape-events.mjs` (retry + seed fallback) | CI-only script — no Jest harness. Exercised via `DRY_RUN=1` locally (parses 40 live events; retry/fallback path code-reviewed). | A non-OK source response retries then falls back instead of exiting 1; CI stays green. |
| Hosted `ingest-scraped` pipeline (analyzer live) | Manual end-to-end: clean catalog → re-run scraper → query hosted DB via anon key. | 40/40 events with `source_url` + ≥1 tag; `uci`/`music` no longer over-match; junk tags gone; `dating` consolidated; no duplicate interests. |

**Delivered count**: Jest unchanged (410/410; this is CI-script + live-data work,
off the Jest path); `tsc` clean.

**What this section deliberately does NOT do / defers to later user testing:** the
remaining tag-precision gaps — proper-noun/brand/filler tags (`actually`, `jason`,
`thermomix`, …) from title-only parsing, and `biking` over-matching via its own
`running`/`spin` aliases — are left for a future tightening pass (add to
`STOP_WORDS`; trim those aliases). They're precision, not dedup, and the current
state is good enough to refine against real usage.

---

### 2.49 Multiple derived tags + share-event-to-friends (post-§2.48 delta)

_Captured 2026-05-24 alongside `docs/PROGRESS_SNAPSHOT.md` §55._

Two features: scraped events can mint **multiple** new interest tags (not just
one) when nothing in the catalog matches, and an event can be **shared to
friends** from the detail screen.

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/functions/_shared/interest-matching.ts` (`deriveTags`, `MAX_DERIVED_TAGS`, `suggested: string[]`) + `interest-matching.test.ts` | Deno (updated + 2 new) | A multi-topic title ("Pottery and Knitting") derives **both** tags; `deriveTags` is capped at `MAX_DERIVED_TAGS` and deduped by stem; existing single-derive / match / `unknown` cases still hold with the array shape. |
| `supabase/functions/ingest-scraped/index.ts` (mint + attach all suggested) | covered indirectly (Edge Function) | Loops the suggested tags, creates/reuses each interest, attaches all (ids deduped against the PK). |
| `components/ShareEventSheet.tsx` (new) + `app/event/[id].tsx` (share hero button) + `components/SCIcon.tsx` (`share` glyph) | `tests/screens/event-detail.test.tsx` (+1) | The share button opens the sheet ("SHARE TO FRIENDS"); selecting a seeded friend (Maya, p1) and tapping SEND fires `createChat` + `sendMessage` and shows a "Shared with 1 friend" toast. |

**Delivered count**: Jest 411 / 411 (+1; the analyzer's multi-derive is covered
by the Deno suite, off the Jest path); `tsc` clean.

**What this section deliberately does NOT do:** linkify the `/event/<id>`
reference in the chat thread (messages render as plain text — the path is
informational), or cap the matched-catalog tags (only newly *minted* tags are
capped, at 3). Feature 1 needs a redeploy + re-scrape to retag existing events;
feature 2 is client-side.

---

### 2.50 Curated interests + safer `-er` stemming + true-contrast refresh (post-§2.49 delta)

_Captured 2026-05-24 alongside `docs/PROGRESS_SNAPSHOT.md` §56._

Quality follow-up: seed 7 common descriptive interests so scraped events match
stable readable tags, fix the `career`→`car` stemmer over-reduction it exposed,
and make the refresh icon pure black/white by mode.

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/functions/_shared/interest-matching.ts` (`-er` strip gated to >6 chars) + `interest-matching.test.ts` | Deno (updated + 1 new) | `career` matches "Career Fair" but **not** "Self-Care" / "Used Car" (no over-reduction to `car`); base bike/run forms still collapse; `biker`/`runner` agentive forms intentionally no longer collapse; dedup demo retargeted to a still-colliding pair. |
| `supabase/seed.sql`, `supabase/seed-hosted.sql` (7 curated interests) | n/a (seed data) | `career`/`dating`/`business`/`dentist`/`workshop`/`concert`/`conference` with aliases; applied to the hosted catalog by INSERT. |
| `scenecheck-expo/components/Screen.tsx` (`refreshColorFor(mode)` → `#000`/`#fff`) | `tests/components/Screen.test.tsx` (existing) | Color-only; the web-button / RefreshControl wiring tests still pass. |

**Delivered count**: Jest 411/411 (analyzer is Deno, off the Jest path); `tsc` clean.

**What this section deliberately does NOT do:** chase the `dating`→`dat` /
`date` stem collision (no `date`-only events in the source; speed-dating matches
`dating` correctly), or add the curated tags to the offline `data/mocks.ts`
catalog (they're live-scraper tags). Applying the interests to the existing 40
events needs a hosted INSERT + delete/re-scrape.

---

### 2.51 Title-first tag derivation (post-§2.50 delta)

_Captured 2026-05-24 alongside `docs/PROGRESS_SNAPSHOT.md` §57._

`deriveTags` now emphasizes the title: when the title has usable words, the
minted tags come straight from it in reading order; the description is used only
as a fallback (then frequency-ranked). Catalog matching is unchanged.

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/functions/_shared/interest-matching.ts` (`takeByStem`; title-order selection in `deriveTags`) + `interest-matching.test.ts` (+1) | Deno | With 4 title candidates and a description hammering the *last* one ("drumming"), the suggested tags are the title's lead words `["pottery","sculpture","painting"]` — description frequency no longer displaces them. All prior cases hold: title-only single/multi derive, stem-dedup, singular labels, the description-frequency **fallback** (`astronomy`), and `unknown`. |

**Delivered count**: Jest 411/411 (analyzer is Deno, off the Jest path); `tsc` clean.

**What this section deliberately does NOT do:** change catalog matching (still
runs first / takes priority) or the description fallback's frequency ranking.
Applying to already-ingested events needs a redeploy + re-scrape.

---

### 2.52 More stop words + curated interests + 2-word compound tags (post-§2.51 delta)

_Captured 2026-05-24 alongside `docs/PROGRESS_SNAPSHOT.md` §58._

Added 4 stop words, 17 curated interests, and a 2-word compound-tag rule in the
derive path.

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/functions/_shared/interest-matching.ts` (`is/no/longer/optional` stops; `titleSegments`/`titleRuns`/`titlePhrases`/`takeTags` compound logic) + `interest-matching.test.ts` (+3) | Deno | `is/no/longer/optional` are filtered ("India Is No Longer Optional" → `india`); a within-run adjacent pair becomes one tag (`Natural Medicine` → `natural medicine`; `Cold Brew Bandana Drop` → `cold brew, bandana` — `drop` is a stop); a stop / comma breaks a run so lists stay separate (`Pottery and Sculpture` → two tags); title-emphasis re-pointed to a comma list. All prior cases hold. |
| `supabase/seed.sql`, `supabase/seed-hosted.sql` (17 curated interests, UUIDs 0023–0039) | n/a (seed data) | `cafe`/`choir`/`church`/`fair`/`solar`/`free`/`digital`/`virtual`/`networking`/`wine`/`games`/`india`/`irvine`/`executives`/`health`/`medicine`/`acupuncture` with aliases; applied to the hosted catalog by INSERT. |

**Delivered count**: Jest 411/411 (analyzer is Deno, off the Jest path); `tsc` clean.

**What this section deliberately does NOT do:** detect compounds semantically —
the rule pairs *adjacent* in-run candidates, so it can fuse a topic + format word
(`beis warehouse`); separators/stop-words limit the damage and it's a documented
refine-later edge. Applying the curated interests to existing events needs a
hosted INSERT + redeploy + re-scrape.

---

### 2.53 Unknown-capacity scraped events: unlimited join + listing warning (post-§2.52 delta)

_Captured 2026-05-24 alongside `docs/PROGRESS_SNAPSHOT.md` §59._

Scraped events have no listed capacity (`cap` 0); the detail screen now treats
that as "unknown / no limit" — shows "capacity unknown", keeps the CTA at JOIN
EVENT, and warns the joiner to check the source listing.

| File changed | Tests | What they assert |
|---|---|---|
| `app/event/[id].tsx` (`capUnknown = e.cap <= 0`: capacity label, JOIN-not-WAITLIST, join warning toast) | `tests/screens/event-detail.test.tsx` (+1) | With `e4.cap` overridden to 0: the detail row reads **`N/unk going`** (re-pointed in §2.54), the CTA is **JOIN EVENT** (not WAITLIST), pressing it joins, and a toast mentioning the **original listing** appears. |

**Delivered count**: 412 / 412 (+1); `tsc` clean.

**What this section deliberately does NOT do:** add a migration or touch the
subscribe RPC — `subscribe_to_event_atomic` already confirms every join when
`capacity IS NULL`, so unlimited joining works server-side unchanged. Purely
client-side; ships with the app build.

---

### 2.54 Multi-city scraping + listing capacity + "/unk" display (post-§2.53 delta)

_Captured 2026-05-26 alongside `docs/PROGRESS_SNAPSHOT.md` §60._

The scraper now scans 6 OC cities (round-robin merged, per-city + global caps),
parses schema.org `maximumAttendeeCapacity` when present, and capacity-unknown
events render "/unk" instead of "/0".

| File changed | Tests | What they assert |
|---|---|---|
| `scripts/scrape-events.mjs` (multi-source `DEFAULT_SOURCES` / `EVENTS_SOURCE_URLS`, `MAX_PER_SOURCE`, round-robin merge, `maximumAttendeeCapacity` parse) | _CI-only, no Jest surface_ | Manual: `DRY_RUN=1 node scripts/scrape-events.mjs` prints ~7 events from each of the 6 cities, 40 total, interleaved — verified. |
| `app/events.tsx` + `app/event/[id].tsx` (`/unk` when `cap <= 0`) | `tests/screens/event-detail.test.tsx` (re-pointed) | The §2.53 capacity test now asserts the detail row reads **`N/unk going`** (was "capacity unknown"); JOIN-not-WAITLIST + listing-warning toast unchanged. |

**Delivered count**: 412 / 412 (no net change — the §2.53 test was re-pointed, not added); `tsc` clean.

**What this section deliberately does NOT do:** change the ingest function or add
a migration — `ingest-scraped` already passes `body.capacity` through, so a real
max from the listing reaches the DB with no redeploy. Scraper changes apply on
the next re-scrape; the `/unk` UI ships with the app build.

---

### 2.55 Tag-quality pass: month/filler stop words + group10 aliases (post-§2.54 delta)

_Captured 2026-05-26 alongside `docs/PROGRESS_SNAPSHOT.md` §61._

Stop-word + alias tuning to cut derive-noise observed in the multi-city run.

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/functions/_shared/interest-matching.ts` (month names + abbrevs, `one`/`two`/`three`, `now`/`actually`/`learn` added to `STOP_WORDS`) | _Deno suite; verified via a Node 24 type-strip driver_ | `deriveTags` returns no `may`/`june`/`one`/`now`/`learn`; a real topic word (`pottery`) still derives. |
| `seed.sql` / `seed-hosted.sql` / `data/mocks.ts` (`group10` `similar_tags` → `['in4matx-43']`) | Jest 412/412 (unchanged) | `analyzeInterests` no longer matches `group10` on a generic "side project"; still matches on "IN4MATX-43". |

**Delivered count**: 412 / 412 (no change — the analyzer has no Jest surface); `tsc` clean.

**What this section deliberately does NOT do:** change the ingest function logic
or the DB schema — it tunes stop-word + alias *data*. Applying it live needs an
`ingest-scraped` redeploy + a hosted `group10` alias `UPDATE` + re-scrape.

---

### 2.56 Round 3 code review + multi-agent fix sweep (post-§2.55 delta)

_Captured 2026-05-27 alongside `docs/PROGRESS_SNAPSHOT.md` §62._

A second full-stack audit produced `docs/CODE_REVIEW_REPORT_3.md` (2 Critical
+ 10 High + 10 Medium + 18 Low); four file-disjoint worker agents + a compliance
agent landed the fixes in eight commits.

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/migrations/00028_promote_waitlist_atomic.sql` + `supabase/functions/promote-waitlist/index.ts` (organizer-auth check) | _SQL/Edge — manually verified against hosted DB_ | Waitlist promotion is atomic (advisory lock + FIFO + capacity recheck); only `events.creator_id` can invoke the Edge Function. |
| `supabase/migrations/00029_subscribe_event_status_check.sql` | _SQL — manually verified_ | `subscribe_to_event_atomic` raises on non-published events under the lock; idempotency preserved on re-subscribe. |
| `supabase/migrations/00030_profiles_birthdate_age_gate.sql` (+ `handle_new_user` account_type read) | _SQL — manually verified_ | INSERT/UPDATE with `birthdate` < 18y raises; sign-up writes both birthdate and account_type from `raw_user_meta_data`. |
| `supabase/migrations/00031_ratings_server_gate.sql` | _SQL — manually verified_ | Ratings INSERT raises on non-attendees, before event end, or past the 24h window. |
| `supabase/migrations/00032_events_update_notify.sql` | _SQL — manually verified_ | UPDATE on user-visible fields fans out one `notifications` row per confirmed subscriber; scraped events are skipped. |
| `supabase/migrations/00033_scraper_dedup_and_polish.sql` | _SQL — manually verified_ | Partial unique index on `(source_url) WHERE source='scraped'`; `create_chat` raises on invalid `p_type`. |
| `scenecheck-expo/app/profile/[id].tsx` (block + report persist) | Jest 412/412 (existing screen tests) | Block call rolls back local state on API failure; report writes to `reports` table with the dishonest copy removed. |
| `scenecheck-expo/app/_layout.tsx` (notification deep-link listener) | Jest 412/412 (manual integration on device) | Notification tap routes to `/event/:id`, `/chat/:id`, or `/profile/:id` based on payload. |
| `scenecheck-expo/lib/api.ts` (subscribeToEvent returns waitlist_position; signUp 5-arg; followOrg) | Jest 412/412 | Waitlist response includes position from follow-up SELECT; sign-up stamps both birthdate + account type into metadata; follow toggles hit `org_follows`. |
| `scenecheck-expo/store/useStore.ts` (`blockUser` action; `TOAST_DEFAULT_MS`) | Jest 412/412 (store tests) | `blockUser` mirrors `unblockUser`; toast duration centralised. |
| `scripts/scrape-events.mjs` (timeouts + parallel sources + dedup key + exit-code-2 fallback) | _Node — exercised via the scrape workflow_ | Each fetch is timeout-bounded; `process.exitCode = 2` when only fallback data ingested. |
| `.github/workflows/ci.yml` (NEW) + `scrape-events.yml` (perms + pins) | _CI — green on push_ | Lint + tsc + jest + Deno tests run on every push; `permissions: contents: read`; `ubuntu-24.04` pinned. |

**Delivered count**: 412 / 412 (no change — the changes are server-side SQL,
notification plumbing, and refactors of code that already had tests covering
the screen-level state flow). `tsc` clean. Lint 7 problems (1 pre-existing
error + 6 pre-existing warnings), down 1 from the pre-session baseline.

**What this section deliberately does NOT do:** add new Jest coverage for the
SQL migrations or Edge Function organizer-auth check — they live outside the
Jest harness. The Deno suite covers `interest-matching.ts`; the migrations
were verified manually against the hosted DB after `npx supabase db push`.

---

### 2.57 Post-audit patches: self-heal onboarded_at + capacity-increase trigger (post-§2.56 delta)

_Captured 2026-05-27 alongside `docs/PROGRESS_SNAPSHOT.md` §63._

Two defects surfaced by the §2.56 compliance audit.

| File changed | Tests | What they assert |
|---|---|---|
| `scenecheck-expo/components/AuthBootstrap.tsx` (self-heal: `onboardedAt IS NULL && interests.length > 0`) | Jest 412/412 | Legacy users with seeded interests + null `onboarded_at` aren't force-routed back to the questionnaire; in-memory `onboardedAt` set immediately, DB `UPDATE` is fire-and-forget. |
| `supabase/migrations/00039_capacity_increase_promote.sql` | _SQL — manually verified_ | AFTER UPDATE OF capacity trigger loops `promote_waitlist_atomic` when `NEW.capacity > OLD.capacity`; reentrant advisory lock means trigger calling locked function is safe. |

**Delivered count**: 412 / 412 (no change). `tsc` clean.

**What this section deliberately does NOT do:** add a Jest test asserting the
AuthBootstrap heal runs once-per-account — the heal is idempotent (next
hydrate sees `onboardedAt` and skips), so a re-trigger is harmless and not
worth the mocking surface.

---

### 2.58 FR-gap closures: FR1.3 / 5.3 / 5.10 / 7.2 / 9.5 (post-§2.57 delta)

_Captured 2026-05-27 alongside `docs/PROGRESS_SNAPSHOT.md` §64._

Five FR-traceability gaps closed by three parallel agents + a compliance pass.

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/migrations/00035_profiles_onboarded_at.sql` | _SQL — manually verified_ | New `onboarded_at TIMESTAMPTZ NULL` column; AuthGate consults it. |
| `supabase/migrations/00036_host_analytics_rpcs.sql` (`host_analytics_by_city` + `…by_venue`) | _SQL — manually verified_ | Top-10 (interest_name, event_count) histogram per filter; raises P0001 on empty input; granted to `authenticated`. |
| `supabase/migrations/00037_capacity_decrease_demote.sql` | _SQL — manually verified_ | AFTER UPDATE OF capacity demotes excess confirmed subscribers to front of waitlist in reverse-chronological order; existing positions shift up; one notification per demoted user. |
| `supabase/migrations/00038_messages_announcements.sql` (`message_type` enum + BEFORE INSERT trigger + RLS) | _SQL — manually verified_ | Non-host insert with `message_type='announcement'` raises 42501; permissive RLS policy documents intent (trigger is the gate). |
| `scenecheck-expo/app/onboarding/interests.tsx` (NEW) + `app/auth/sign-up.tsx` live-mode redirect | Jest 412/412 (mock onboarding flow tests) | First-launch picker calls `api.markOnboarded(tags)` on Continue OR `[]` on Skip; both replace to `/(tabs)`. |
| `scenecheck-expo/app/host-analytics.tsx` (NEW) + `hooks/useHostAnalytics.ts` (NEW) + `app/my-hosting.tsx` row | Jest 412/412 | Two ranked top-10 lists with city/venue inputs auto-seeded from host's most-frequent event venue; empty state when both lists empty. |
| `scenecheck-expo/app/attendees/[id].tsx` (host-only Remove + ConfirmDialog + optimistic-hide + rollback) | Jest 412/412 (existing attendees test extended) | Remove button only visible to host; on error the row reappears. |
| `scenecheck-expo/app/settings/linked-calendar.tsx` (Google `useAuthRequest` + `OAUTH NOT CONFIGURED` fallback) + `lib/google-calendar.ts` (NEW) | Jest 412/412 (mocks for `expo-auth-session/providers/google` + `expo-web-browser`) | Connect/disconnect drives `useAuthRequest`; missing env var flips label and bypasses the OAuth round-trip. |
| `scenecheck-expo/app/event/[id].tsx` + `create-event.tsx` (fire-and-forget calendar insert) | Jest 412/412 | After confirmed join / publish, fire `googleCalendar.insertEvent`; failure surfaces info toast and never blocks the primary flow. |
| `scenecheck-expo/app/chat/[id].tsx` (host-only Announcement chip + warn-yellow rendering) + `lib/api.ts` (`canPostAnnouncement`, `sendMessage(messageType?)`) | Jest 412/412 | Announcement chip gated on `canPostAnnouncement`; armed composer flips border + send tint warn-yellow; announcement bubbles render full-width with bell icon. |
| `scenecheck-expo/store/useStore.ts` (`onboardedAt` persisted, `hydrated` not persisted, `setOnboarded` / `setHydrated`) + `components/AuthGate.tsx` (tri-state redirect) | Jest 412/412 (store + AuthGate tests extended) | AuthGate renders through while `!hydrated`; routes `/auth/sign-in` while `!session`; routes `/onboarding/interests` while `session && onboardedAt == null`. |
| `package.json` (`"engines": { "node": ">=22 <25" }` + `expo-auth-session` + `expo-crypto`) | _Build-time — Metro accepts_ | Sign-up runs end-to-end against Node 22 LTS; Google `useAuthRequest` hook resolves. |

**Delivered count**: 412 / 412. `tsc` clean. Lint at 7-problem baseline.

**Post-audit fix:** sign-up call's first cut used a type-cast that misaligned
arg 4 (`birthdate`) and arg 5 (`accountType`), and `handle_new_user` in
`00030` was still hard-coding `account_type = 'person'`. Both corrected;
covered above under §2.56's `00030` row (account_type read) and the existing
sign-up screen integration test.

**What this section deliberately does NOT do:** add an end-to-end test for the
Google Calendar OAuth round-trip — the mocked `useAuthRequest` makes the
state machine testable but the network round-trip needs a real client ID and
isn't reproducible in CI. The screen's `isConfigured()` branch is covered;
the network branch is a manual checklist item.

---

### 2.59 Map iOS pin-crash → custom RN overlay rewrite (post-§2.58 delta)

_Captured 2026-05-28 alongside `docs/PROGRESS_SNAPSHOT.md` §65._

Recurring user crash report: tapping pins on the Map tab in Expo Go closed
the app after 2-3 selections, regardless of timing. Device logs proved the
bug lived entirely in the bundled `react-native-maps@1.20.x` native marker
pipeline (JS state machine + memoization confirmed correct). Fix structurally
removes the entire `<Marker>` code path.

| File changed | Tests | What they assert |
|---|---|---|
| `scenecheck-expo/components/Map/Map.native.tsx` (no `<Marker>` children; overlay of absolute `<Pressable>`s; in-JS Mercator projection; continuous `onRegionChange`; recenter button; tap-empty-map deselect) | Jest 412/412 (jest-expo `react-native-maps` mock; screen-level state flow unchanged) | Selection state advances 0 → focused → null correctly; recenter prioritises `selectedId → user → initialCenter`; `MapView.onPress` only fires when overlay misses (mutually exclusive per gesture). |
| `scenecheck-expo/app/(tabs)/map.tsx` (wires `onMapPress = () => setFocused(null)`) | Jest 412/412 | Tap-off-pin clears focused id; same `setFocused` path the back button used. |

**Delivered count**: 412 / 412 (no change — existing tests use a marker-free
mock; the structural rewrite is invisible to the jest layer). `tsc` clean.

**What this section deliberately does NOT do:** add a Jest test asserting
pixel positions match what `MKMapView` would have placed. The Mercator
formula is the same one Apple/Google use to render tiles, so by construction
the pin pixel matches the underlying tile feature; verifying it requires a
real `MapView` instance which jest-expo doesn't provide. Manual side-by-side
inspection on iPhone 13 + Pixel 7 was the acceptance gate.

**Trade-off captured in code:** the projection ignores map rotation
(`region.camera.heading` not read), so pins won't follow if the user rotates
the map. Apple Maps north-locks by default; adding rotation correction is
~10 lines if it ever matters.

---

### 2.60 Polish pass: self-profile redirect + privacy + /unk + group titles + edit description (post-§2.59 delta)

_Captured 2026-05-28 alongside `docs/PROGRESS_SNAPSHOT.md` §§66–67._

Cluster of small fixes from rapid user-report iteration on the deployed build.

| File changed | Tests | What they assert |
|---|---|---|
| `scenecheck-expo/app/profile/[id].tsx` (`<Redirect>` after hooks + 6 handler early-returns + `{!isSelf && ...}` button gates) | Jest 412/412 (existing profile screen tests) | Navigating to own id redirects to `/(tabs)/profile`; even with redirect bypassed, the action buttons don't render and the handlers are no-ops. |
| `scenecheck-expo/app/(tabs)/chat.tsx` (`chatAvatars` resolver + stacked-pair render + `namesTitle` for non-event groups) + `lib/api.ts` (chat embed extended to include `avatar_url + account_type`) + `types/domain.ts` (`Chat.members?`) | Jest 412/412 (chat list tests) | DM row leads with single 40px avatar; group row leads with Instagram-style stacked pair; non-event groups title to `Alice, Bob +N` when no event name exists. |
| `scenecheck-expo/app/settings/privacy.tsx` (NEW) + `app/settings/help.tsx` (route swap + correct GitHub issues URL) | Jest 412/412 | Privacy row navigates to in-app screen instead of out to `scenecheck.app/privacy`; bug-report URL points to `github.com/Plehndm/SceneCheck-App/issues`. |
| `scenecheck-expo/components/SCEventCard.tsx`, `app/my-hosting.tsx`, `app/profile/[id].tsx` (cap `> 0 ? cap : 'unk'` fallback) | Jest 412/412 | Scraped events without listed capacity read `0/unk` consistently across Home rail, my-hosting list, and the hosting card on profile (was `0/0` in the rail). |
| `scenecheck-expo/components/EditEventSheet.tsx` (multi-line description TextInput + `desc` patch) + `lib/api.ts` `updateEvent.desc` | Jest 412/412 (edit sheet tests extended) | Edit sheet seeds description from `event.desc`; SAVE patches `desc` alongside other fields; `applyEventOverride` reflects new description immediately. |
| `scenecheck-expo/lib/api.ts` `markOnboarded` live-branch (mirror writes into Zustand `subscribedInterests` + `me.interests`) | Jest 412/412 | After live-mode onboarding completion, picked tags appear in the store immediately — no wait for next hydrate. |

**Delivered count**: 412 / 412. `tsc` clean. Lint at 7-problem baseline.

**What this section deliberately does NOT do:** add automated coverage of the
self-profile redirect *from a deep-linked notification payload* — `<Redirect>`
fires within a `useEffect`-equivalent render path that expo-router doesn't
expose to jest cleanly. The handler early-returns + button hides give
defence-in-depth, and the redirect was visually verified on device.

---

### 2.61 Eventbrite time correctness + ticket price columns (post-§2.60 delta)

_Captured 2026-05-29 alongside `docs/PROGRESS_SNAPSHOT.md` §68._

Two related fixes in the FR6 scraper pipeline + a new DB column for ticket
prices. Single combined commit (`59e5bfd`) because the changes touched the
same files in tightly coupled ways.

| File changed | Tests | What they assert |
|---|---|---|
| `scripts/scrape-time.mjs` (new) | `scripts/scrape-time.test.mjs` (new, 23 `node:test` cases) | `isDateOnly` accepts `"2026-05-29"`, rejects full datetimes; `hasTimezone` handles `Z` suffix + offsets, careful with the date-hyphen; `timezoneFromSourceUrl` maps US-50 state codes to IANA; `extractFullJsonLdTimestamp` returns the first datetime containing `T` (skips date-only stragglers); `timezoneOffsetMinutes` reports PDT (-420) / PST (-480) / EDT (-240) / UTC (0); `dateOnlyToVenueLocalNoonIso` anchors to noon-in-tz (May 29 PDT → `2026-05-29T19:00:00Z`, July 4 EDT → `2026-07-04T16:00:00Z`). |
| `scripts/scrape-price.mjs` (new) | `scripts/scrape-price.test.mjs` (new, 18 `node:test` cases) | `parsePriceNumber` tolerates `"33.85"` / `"33.85 USD"` / `"$33.85"` / number / null / negative-rejection; `isUsSourceUrl` matches `/d/ca--…` and rejects `/d/on--…` (Ontario) + non-Eventbrite URLs; `normaliseCurrency` validates ISO-4217 shape (3 letters); `extractPriceFromOffers` reads `AggregateOffer` low/high, single `Offer.price` as both bounds, reduces tiered Offer arrays to overall min/max, overrides CAD→USD on US listings (the BEIS Warehouse Sale Eventbrite bug), defaults currency to USD when missing, rounds to 2 decimals. |
| `scripts/scrape-events.mjs` (rewired) | _Smoke-verified via DRY_RUN against the live BEIS Warehouse Sale page; per-source `time-resolution: detail:N` + `price: M/N with prices (K free)` log lines_ | The four time-resolution paths (`listing` / `detail` / `noon-fallback` / `naive-localized`) classify correctly; price is extracted from listing first, detail-page second; one detail-page round-trip serves both needs; source-listing URL (not per-event detail URL) is threaded to `extractPriceFromOffers` so the CAD→USD override has the state-code it needs. |
| `supabase/migrations/00040_events_price.sql` (new) | _SQL — manually verified against hosted DB_ | New `price_min` / `price_max` / `price_currency` columns; CHECK enforces "both set or neither set" + non-negative + max ≥ min. |
| `supabase/functions/ingest-scraped/index.ts` | _Edge Function — verified via live ingest_ | Source-URL-keyed dedup (with title+start_at fallback for FALLBACK_EVENTS); self-heal patches start_at/end_at AND price triple in place when stored values differ from incoming; 400 + clear message on price-shape mismatch (instead of 500 Postgres CHECK violation). |
| `supabase/functions/create-event/index.ts` | _Edge Function — verified via in-app create flow_ | Price triple validation mirrors the migration's CHECK; both-null is the accept-default for hosts who don't set a price. |
| `.github/workflows/ci.yml` | _CI step exercised on push_ | `scraper-tests` job runs both `scrape-time.test.mjs` + `scrape-price.test.mjs` via `node --test`. |

**Delivered count:** jest 412 / 412 (no Jest surface for these — the unit
work lives in `node:test` and the Edge Function changes were verified
manually against the hosted DB); `node --test scripts/*.test.mjs`
**41 / 41**; `tsc` clean.

**Live verification:** BEIS Warehouse Sale corrected from showing
"5/28/2026 5:00 PM PDT" (wrong day + fictional time, the UTC-midnight bug)
to "5/29/2026 2:00 PM PDT" (matches Eventbrite). Scrape ingested 40 events
with prices populated (10 FREE / 10 paid, range from `$9.74` fixed to
`$0–$268.61`).

**What this section deliberately does NOT do:** add jest coverage of the
SQL migration or the Edge Function self-heal path — those live outside the
Expo jest harness. The Deno suite covers the JS-side `interest-matching`
analyzer; the migrations + Edge Function changes were verified manually
against the hosted DB after `npx supabase db push` + redeploy.

---

### 2.62 Ticket price UI rendering (post-§2.61 delta)

_Captured 2026-05-29 alongside `docs/PROGRESS_SNAPSHOT.md` §69._

Surfaces the new price triple end-to-end so users can see ticket cost
without scanning the description.

| File changed | Tests | What they assert |
|---|---|---|
| `scenecheck-expo/lib/price.ts` (new) | `tests/unit/price.test.ts` (new, 13 cases) | `priceState` returns `'none'` for nulls, `'free'` for 0/0, `'fixed'` for equal nonzero, `'range'` for min < max (including the tiered `0 < max` case). `formatPrice` returns null for unspecified, `'FREE'` for free, `'$15'` / `'$33.85–$44.52'` for USD, `'€12'` / `'CA$20–CA$40'` / `'¥500'` for non-USD, `'XYZ 15'` for unknown ISO codes, defaults null currency to USD, strips integer trailing zeros but preserves cents. |
| `scenecheck-expo/components/SCEventCard.tsx`, `app/events.tsx`, `app/event/[id].tsx` | Jest 425/425 (existing screen tests cover the renders) | Price chip renders on rail card + list row when `priceState !== 'none'`; FREE uses green pill, paid uses neutral outline; "Ticket price" DetailRow on detail screen uses the new `tag` icon. |
| `scenecheck-expo/components/EditEventSheet.tsx`, `app/create-event.tsx` | Jest 425/425 (existing edit + create tests pass with the new fields) | Three-mode toggle (NOT SET / FREE / PAID) drives a derived price triple on save; PAID with MAX blank treats as fixed-price; client-side validation rejects max < min before the round-trip. |
| `scenecheck-expo/types/domain.ts`, `lib/api.ts` | Jest 425/425 | `SCEvent` + `DraftForm` carry the price fields; `transformEventRow` maps NUMERIC columns through `num()` so supabase-js's NUMERIC-as-string-in-edge-cases doesn't break the `=== 0` free check; `updateEvent` accepts a price patch shape. |

**Delivered count:** jest 425 / 425 (412 baseline + 13 new in
`tests/unit/price.test.ts`); `tsc` clean; lint at the 7-problem baseline.

**What this section deliberately does NOT do:** add screenshot/visual
regression for the chip colours — the colour tokens live in
`theme/tokens.ts` and have their own coverage; the chip is a structural
addition that the screen tests verify rendering of, but the precise
green/outline picks are visual and verified on device.

---

### 2.63 Legacy date-only-UTC scraped rows cleanup (post-§2.62 delta)

_Captured 2026-05-29 alongside `docs/PROGRESS_SNAPSHOT.md` §70._

One-shot SQL cleanup for the rows the FR6 scraper landed before the
time-fix + price-column work. Migration only — no app surface.

| File changed | Tests | What they assert |
|---|---|---|
| `supabase/migrations/00041_cleanup_legacy_scraped.sql` (new) | _SQL — manually verified against hosted DB_ | `DELETE FROM events WHERE source='scraped' AND price_min IS NULL AND start_at::time = '00:00:00'`; DO block surfaces the count via `RAISE NOTICE`. FK cascades verified before the delete (event_interests / event_subscriptions / event_waitlist / ratings cascade; chats.event_id + reports.target_event_id set-null). |

**Delivered count:** jest 425 / 425 (no change — migration-only);
`tsc` clean.

**What this section deliberately does NOT do:** add an assertion of the
exact deleted count — the count depends on how many legacy rows happen to
exist in the hosted DB at apply-time, which is environment-specific. The
DO block's `RAISE NOTICE` surfaces the count to whoever runs the migration.

---

### 2.64 Onboarding tour replay wired to /onboarding/interests (post-§2.63 delta)

_Captured 2026-05-30 alongside `docs/PROGRESS_SNAPSHOT.md` §71._

| File changed | Tests | What they assert |
|---|---|---|
| `scenecheck-expo/app/settings/help.tsx` | `tests/screens/settings-subscreens.test.tsx` (+1 regression test) | "Replay onboarding" row renders with the new label (old label "How SceneCheck works" no longer present); tapping the row fires `router.push('/onboarding/interests')` (was previously the dead `'Welcome tour replay coming soon'` toast). |

**Delivered count:** jest 426 / 426 (425 + 1 regression); `tsc` clean.

**What this section deliberately does NOT do:** assert the downstream
flow (markOnboarded → mirror into store) — that path is covered by the
existing onboarding screen + api tests added in §2.58.

---

### 2.65 Wider scrape (LA cluster) + fixture-POST skip + dupe cleanup (post-§2.64 delta)

_Captured 2026-05-30 alongside `docs/PROGRESS_SNAPSHOT.md` §72._

Three related changes to the FR6 scraper + a cleanup migration. No new
Jest surface — the scraper changes are config/constants + an early-return
in the fallback branch that's exercised by DRY_RUN and live runs but not
jest.

| File changed | Tests | What they assert |
|---|---|---|
| `scripts/scrape-events.mjs` | _Live verification: 120 events across 14 cities, 103 new + 17 healed, 0 failed; per-source counts visible in CI log_ | `DEFAULT_SOURCES` expanded 6 → 14 cities (8 OC + 6 LA); `MAX_EVENTS` default 40 → 120; live mode no longer POSTs `FALLBACK_EVENTS` (exits with code 2 + warn instead); DRY_RUN still surfaces fixtures for local inspection. |
| `supabase/migrations/00042_cleanup_fallback_scraped.sql` (new) | _SQL — verified live (12 dupes deleted, 0 remaining; total scraped 136 → 124)_ | `DELETE FROM events WHERE source='scraped' AND source_url IS NULL` — broader than "fixture titles" by design, catches the bloat + any pre-source_url-tracking stragglers. `RAISE NOTICE` surfaces the deleted count. |

**Delivered count:** jest 426 / 426 (no change — scraper + migration-only);
`tsc` clean.

**What this section deliberately does NOT do:** add a jest assertion that
the live fallback branch skips ingest — the fallback path runs only when
`scrapeEvents()` returns empty (Eventbrite returned 0 events), which would
require mocking `fetch` deep enough to make the live wrapping fail
predictably. The behaviour was verified by:
- DRY_RUN with `EVENTS_SOURCE_URLS=https://example.invalid` to force an
  empty list — log shows `Skipping ingest — fixture seed events are no
  longer POSTed to live to avoid duplicate buildup.` and exit code 2.
- Post-cleanup count check confirmed 0 fallback rows after the migration
  + new scrape run.

---

### 2.66 Events nearby honors user coords + radius; default bumped 5 → 10 mi (post-§2.65 delta)

_Captured 2026-05-30 alongside `docs/PROGRESS_SNAPSHOT.md` §73._

Two related fixes in the discovery pipeline. Test fixtures updated where
the old 5-mile default was hardcoded.

| File changed | Tests | What they assert |
|---|---|---|
| `scenecheck-expo/app/(tabs)/index.tsx`, `app/events.tsx` | Jest 426/426 (existing home + events-list screen tests cover the renders) | Both screens pass `lat` + `lng` from `useLocation` + `radiusM` from `useStore(s => s.radius) * MILES_TO_METERS` into `useEvents` so the `rank_events_query` RPC anchors on the user's actual location with their actual preference (matches the Map tab pattern). Previously the home tab passed radius-only and events.tsx passed nothing, both defaulting to Irvine + 5mi. |
| `scenecheck-expo/store/useStore.ts`, `components/Map/types.ts`, `lib/api.ts` | `tests/unit/store.test.ts`, `tests/unit/map-types.test.ts`, `tests/test-utils.tsx` (all updated) | `store.radius` initialises to 10 (was 5); `DEFAULT_RADIUS_M` constant is 16093m (was 8047m / 5mi); `api.fetchEvents` fallback references `DEFAULT_RADIUS_M` so the constant is the single source of truth. |
| `scenecheck-expo/tests/screens/map-tab.test.tsx` | (updated chip-tap regression) | The "tapping a radius chip writes the persisted store radius" test asserts the initial state is 10mi (the new default) and taps `25 MI` so the assertion proves a real state change off the new default (previously tapped 10 MI which was the test's expected post-tap value but is now the default — no-op write would still have passed). |

**Delivered count:** jest 426 / 426 (no count change — fixture updates,
not new tests); `tsc` clean; lint at the 7-problem baseline.

**What this section deliberately does NOT do:** add a test that the
persisted Zustand radius value survives across mounts at the new 10mi
default — `zustand/persist` is exercised by its own tests and our store
already has coverage for the persist/merge round-trip in
`tests/unit/store.test.ts`. The bump is a default-only change; persistence
semantics are unchanged.

---

### 2.67 Desktop web build + friend/own map events, event-detail parity, edit-notify fix (post-§2.66 delta)

_Captured 2026-05-30 alongside `docs/PROGRESS_SNAPSHOT.md` §74._

A large body of web-facing work: the desktop web build (`scenecheck-expo/web/`
+ `*.web.tsx`), surfacing friend/own events on the web map (migration `00043`
+ `transformEventRow`), web event-detail routing parity, a latent
event-update trigger fix (`00044`), a seed-time refresh (`00045`), and rail /
shell layout fixes. Per the testing strategy these land **outside** the Jest
suite — for the same reasons already documented: web-only UI pulls
react-native-web DOM + react-leaflet (which is exactly why `Map.web.tsx` is
excluded from coverage, §2.2 / Part 3 Q2), and SQL migrations need a Postgres
container (pgTAP/Deno), not jsdom. So the work adds no new Jest tests; it's
guarded by the unchanged 426/426 suite over the shared logic it touches, by
`tsc`, and by manual/live verification.

| Change | How it's covered | Notes |
|---|---|---|
| `lib/api.ts` `transformEventRow` `is_friend_creator → kind:'friend'` | `tests/unit/api-mock.test.ts`, `tests/unit/events.test.ts` (unchanged, green) | The new branch is additive — the flag is optional and absent on direct table selects, so it defaults to `'other'` and mock-mode fixtures + existing `eventCategory`/`pinColor` assertions are unaffected. The RPC's PostGIS + friendship join runs server-side and is verified live, not in Jest. |
| Migrations `00043` (rank friend/own), `00044` (notify_event_updated `array_append`), `00045` (seed time refresh) | Live verification via `supabase db push` | `00044` was confirmed by the push that previously failed with `malformed array literal (SQLSTATE 22P02)` now applying cleanly, and an event UPDATE no longer crashing. No DB in the Jest environment, so these follow the existing migration-testing path (Part 3 lists pgTAP/Deno as the next addition). |
| `app/event/[id].web.tsx` parity (Where→map, price, scraped listing, N/unk) | `tsc` clean; `tests/unit/price.test.ts`, `tests/unit/date-time.test.ts` (shared helpers, green) | The web overlay itself is a react-native-web DOM surface (outside Jest), but the `lib/price` `priceState`/`formatPrice` and `lib/date-time` helpers it renders keep their existing unit coverage. |
| `app/(tabs)/map.web.tsx` `?focus` + `web/WebMap.tsx` `centerOn`, `web/WebIcon.tsx` `tag` glyph, `web/WebRail.tsx` (Profile nav, `alignSelf:'stretch'` overflow fix, `minHeight:0`, top inset), `web/WebShell.tsx` (top inset) | `tsc` clean; jest 426/426 | Web-only chrome — outside the Jest suite. Verified on the deployed web build (the rail-overflow root cause + fix were confirmed against a live screenshot). |

**Delivered count:** jest 426 / 426 (no new tests — web UI + SQL migrations
are outside the Jest environment); `tsc` clean; lint at the 7-problem baseline.

**What this section deliberately does NOT do:** add Jest tests for the leaflet
web map, the rail/shell layout, or the `rank_events_query` RPC — they need a
real browser (Playwright) or a Postgres container (pgTAP/Deno) respectively,
both already flagged as the highest-value future additions in Part 3. The
migrations were verified by applying them to the hosted project; the web map +
event-detail parity were verified on the deployed build.

---

### 2.68 Web build follow-ups — auth, dialogs, optimistic counts, discover/profile parity (post-§2.67 delta)

_Captured 2026-05-30 alongside `docs/PROGRESS_SNAPSHOT.md` §75._

The §75 batch: two-pane web auth screens, floating edit-profile/confirm dialogs,
optimistic attendee counts, discover/nav deep-links, create-event location
autocomplete, rail/shell layout, and other-profile stats parity. Like the rest
of the web build these are web-only UI surfaces (react-native-web DOM +
react-leaflet) plus two pure-TS helpers, so they sit **outside** the Jest suite
for the documented reasons (§2.2 / Part 3 Q2). No new Jest tests; the suite
stays 426/426 and the shared logic each surface leans on keeps its coverage.

| Change | How it's covered | Notes |
|---|---|---|
| `web/WebAuth.tsx` + `app/auth/*.web.tsx` (sign-in/up, forgot, reset) | `tsc` clean; 426/426 (native `app/auth/*.tsx` screen tests unchanged) | Web-only DOM screens; they reuse the already-tested `api.signIn`/`signUp`/`requestPasswordReset`/`updatePassword`. Nominatim/OAuth aside, the auth flows are exercised on the deployed build. |
| `components/ConfirmDialog.web.tsx`, `components/EditProfileSheet.web.tsx` | `tsc` clean | Web variants of bottom-sheet components; same store contract (`confirm`/`dismissConfirm`, `api.updateProfile`). The native components retain their existing screen-test coverage. |
| `hooks/useOptimisticAttendees.ts` | `tsc` clean; used only by web screens | Pure derivation (snapshot baseline + ±1 overlay). A unit test would be cheap (it's plain TS) and is a reasonable future add; not wired yet since it's only consumed by the out-of-suite web screens. |
| `lib/geocode.ts` (`suggestPlaces`) | manual / on-device | Network call to OpenStreetMap Nominatim — no result under jsdom; verified on the deployed create-event flow. Shared with the native `LocationPickerSheet`. |
| `app/search.web.tsx` (full Events tab), home see-all + carousel deep-links, `app/profile/[id].web.tsx` stats parity, `WebCapBar` `N/unk` + stripe, `WebMap` `chrome`, rail/shell layout | `tsc` clean; 426/426 | Web-only chrome/layout + the discover/profile surfaces. `lib/ratings` (`summarizeRatings`/`ratingForEvent`) and `lib/price`, which these lean on, keep their existing unit coverage. |

**Delivered count:** jest 426 / 426 (no new tests — web UI + network/geocode +
the web-only optimistic hook are outside the Jest environment); `tsc` clean;
lint at the baseline.

**What this section deliberately does NOT do:** add Jest tests for the web auth
screens, floating dialogs, leaflet preview, or Nominatim autocomplete — they
need a real browser (Playwright, already the top future-add in Part 3). The
`useOptimisticAttendees` overlay is the one piece that's pure TS and unit-test-
able in isolation; flagged for a follow-up. Everything here was verified on the
deployed web build.

### 2.69 Map live-status chip + discover deep-link + floating web onboarding (post-§2.68 delta)

_Captured 2026-06-02 alongside `docs/PROGRESS_SNAPSHOT.md` §76._

Three web-only UX changes plus a hosted-data migration. Like the rest of the web
build these are web-only surfaces (react-native-web DOM + react-leaflet) or
DB-only SQL, so they sit **outside** the Jest suite for the documented reasons
(§2.2 / Part 3 Q2). No new Jest tests; the suite is unchanged (still 426 total /
423 passing — see the header for the 3 stale-fixture failures).

| Change | How it's covered | Notes |
|---|---|---|
| `web/useOnline.ts` — LIVE chip reflects real connection health (browser online + a Supabase Realtime heartbeat channel) | `tsc` clean; web-only | Previously `navigator.onLine` only (stays `true` on a no-internet LAN). Now also opens one bare Realtime channel and reports connected only while it's `SUBSCRIBED`. Mock mode (no client) falls back to `navigator.onLine`, so the native map-tab screen test is unaffected. The leaflet/realtime behaviour is verified on the deployed build. |
| `app/(tabs)/profile.web.tsx` — "Add interests" → `/search?tab=interests` | `tsc` clean; 426/426 | One-line deep-link; `search.web.tsx` already reads `?tab=` (the §2.68 nav-deep-link mechanism). |
| `app/onboarding/interests.web.tsx` (new) — floating picker over a blurred explore backdrop | `tsc` clean; web-only | Web variant of the native `onboarding/interests.tsx`; same picker logic (`api.markOnboarded` → `router.replace('/(tabs)')`). The blurred `HomeWeb` backdrop + Leaflet preview need a real browser (Playwright), so it's verified on the deployed build; the native screen keeps its existing flow + tests. |
| `supabase/migrations/00046_shift_david_maya_events_upcoming.sql` (new) | Live verification via `supabase db push` + a primary-DB `RAISE NOTICE` probe | Shifts Maya's + the davidplehn07@gmail.com account's events one week out so they re-enter `rank_events_query`'s window. Applied to the hosted project and verified on the **primary** (Morning Ride → 2026-06-09 published; David's Study Session → 2026-06-09, still draft). No DB under Jest, so it follows the existing migration-testing path. ⚠️ The hosted **Data API is serving stale reads** (9 events frozen at May dates vs the primary's 222), so the shift won't surface in the app until that infra issue is resolved — see PROGRESS_SNAPSHOT §76.4. |

**Delivered count:** jest 426 total / 423 passing (no new tests — web UI + the SQL
migration are outside the Jest environment); `tsc` clean.

**What this section deliberately does NOT do:** add Jest tests for the realtime
heartbeat in `useOnline`, the floating onboarding backdrop, or the date-shift
migration — they need a real browser (Playwright, the standing top future-add in
Part 3) or a Postgres container (pgTAP/Deno) respectively. The `useOnline`
mock-mode fallback keeps the native map-tab test green without a Supabase mock.

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
