# SceneCheck (Expo app)

The active SceneCheck app — an **Expo SDK 54 + TypeScript + React Native Web**
port of the HW2/HW3 prototype. One codebase runs on **iOS, Android, and the
web** (Metro picks `.native.tsx` / `.web.tsx` variants per platform). The
backend (Postgres + Edge Functions) lives in [`../supabase`](../supabase).

For an orientation to the non-obvious wiring (mock-vs-live mode, the `@/` path
alias, platform splits, the Zustand store, the optimistic-commit pattern), read
[`AGENTS.md`](AGENTS.md) — it's the same file `CLAUDE.md` includes.

## Quick start

```bash
npm install
npm start          # interactive — press w (web), or scan the QR with Expo Go (iOS/Android)
```

- **Web:** press `w` (or `npm run web`).
- **Phone:** install [Expo Go](https://expo.dev/go), then scan the QR (iOS:
  Camera app; Android: Expo Go).

### Mock mode vs live mode

The app decides its data source from Supabase env vars (see `lib/supabase.ts`):

- **Mock mode (default with no env vars).** The Supabase client is `null`,
  `api.isMock()` short-circuits every call to the fixtures in `data/mocks.ts`,
  and the whole Jest suite runs against it. Great for demos + a zero-config
  first run. `EXPO_PUBLIC_USE_MOCK=1` forces mock mode even when env vars exist.
- **Live mode.** Point at a Supabase project by setting, in `.env`:

  ```
  EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
  ```

  (The legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` is still honored as a fallback.)
  Apply the migrations + seeds in [`../supabase`](../supabase) to the project
  first — see that folder's SQL files for the runbook.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Expo dev server (press `w` for web, `a`/`i` for emulators). |
| `npm run web` | Start straight on web. |
| `npm run android` / `npm run ios` | Start on an emulator/simulator. |
| `npm test` | Jest suite (426 tests as of this writing; runs in mock mode). |
| `npx tsc --noEmit` | TypeScript check. |
| `npm run lint` | `expo lint`. |

> The Edge Function tests are Deno tests under `supabase/functions/_shared/`
> and run in CI separately — `npm test` does not reach them.

## Project layout

| Path | What it is |
|---|---|
| `app/` | Expo Router screens. `*.web.tsx` variants are the desktop web build; `(tabs)/` is the bottom-tab group. Auth screens in `app/auth/`. |
| `web/` | Desktop web chrome + shared atoms (`WebShell`, `WebRail`, `WebMap`, `WebAuth`, cards, dialogs, …). |
| `components/` | Cross-platform UI components, including `Map/` (`Map.native` = react-native-maps, `Map.web.impl` = react-leaflet). |
| `hooks/` | Data hooks — all return `{ data, loading, error, reload }`. |
| `lib/` | `api.ts` (Supabase access + mock fallback), `supabase.ts`, geocode/date/price helpers. |
| `store/` | Zustand store (sliced; persisted). |
| `data/mocks.ts` | Fixtures that back mock mode + the Jest suite. |
| `theme/` | Design tokens + `ThemeProvider`. |

Project-level documentation (progress snapshot, test plan, architecture,
requirements, code reviews) lives in [`../docs`](../docs).
