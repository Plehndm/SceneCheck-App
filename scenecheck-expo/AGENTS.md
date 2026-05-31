# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## Start here — read the project docs first

Before planning or writing any code, read these four documents in `../docs/` to understand the current state of the project and the direction it's heading. They are the source of truth for *what* is built, *what's tested*, and *what's intended* — this file only covers the *how* of the wiring.

- **`../docs/PROGRESS_SNAPSHOT.md`** — chronological log of what's been built. Its §1 timeline table + numbered detail sections are the fastest way to learn the current state and recent work. Skim the latest sections first.
- **`../docs/TEST_PLAN.md`** — what's covered (and deliberately *not* covered) by the Jest suite, plus the §2.N delta sections explaining why some web-UI / SQL / network work sits outside Jest and is verified on the deployed build instead.
- **`../docs/IN4MATX-43-Requirements-Document.md`** — the functional requirements (the `FR*.x` references used throughout the code and the other two docs). Check this for the *intended* behavior before changing a feature.
- **`../docs/IN4MATX 43 Architecture Document.md`** — the system design (cross-platform structure, Supabase backend, data flow). Check this for the *direction* the project is heading and the architectural constraints to stay within.

Keep these current as part of substantial work: when you add or change a feature, update the snapshot (and the test plan if coverage changed) so the next instance inherits an accurate picture.

## SceneCheck-Expo orientation

Quick map of the non-obvious wiring in this app so changes don't accidentally break a working invariant.

- **Mock vs live mode** is decided in `lib/supabase.ts`. When `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are unset (Jest, demos), the exported Supabase client is `null` and `api.isMock()` short-circuits every call to `data/mocks.ts`. Keep this branch — the entire test suite runs against it. `EXPO_PUBLIC_USE_MOCK=1` forces mock mode even when env vars are set.
- **Path alias `@/`** points at the `scenecheck-expo/` root and is mirrored in `tsconfig.json` + Jest's `moduleNameMapper`. Use it for cross-module imports; don't break the mirror.
- **Platform splits** (don't collapse these):
  - `components/Map/Map.web.tsx` (react-leaflet) vs `components/Map/Map.native.tsx` (react-native-maps) — Metro picks per platform.
  - `lib/storage.ts` is an SSR-safe AsyncStorage shim so the web bundle doesn't crash before hydration.
  - `hooks/use-color-scheme.web.ts` exists for the same reason.
- **Zustand store** (`store/useStore.ts`) is composed of slices (events, social, ui, preferences, drafts, overlays). `Set` values (e.g. blocked, joined) are persisted via a hand-written `partialize` / `merge` pair that serializes Sets as arrays — do not change `partialize` or `merge` without re-reading those round-trip tests.
- **Optimistic-commit pattern** is universal: store update first, API call second, error toast + rollback on failure. Match it for new mutations.
- **Hooks** all return `{data, loading, error, reload}` and use a `cancelled` flag for async-safe unmount. Keep that shape.
- **Edge Function tests** live in `supabase/functions/_shared/interest-matching.test.ts` (Deno test). They run in CI via the `deno-tests` job in `.github/workflows/ci.yml` — they are not part of the Jest suite and `npm test` won't reach them.
- **Open issues / known gaps:** see `docs/CODE_REVIEW_REPORT_3.md`. Don't re-discover findings that are already tracked there.

`CLAUDE.md` is intentionally a one-line `@AGENTS.md` include so Claude Code and other agents read this same file.
