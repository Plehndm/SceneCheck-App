# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

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
