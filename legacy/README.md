# Legacy prototype

This directory is the original SceneCheck prototype from HW2 / HW3 — a static
HTML page that loads JSX directly through Babel-Standalone, with no bundler.
It's kept here as a historical reference and a side-by-side for the migrated
project at `../scenecheck-expo/`.

The active project is the Expo + TypeScript port one level up. New work goes
there; this directory is frozen.

## Run it

```bash
cd legacy
npm install          # regenerates node_modules from package.json
npm run dev          # serves the prototype on http://localhost:5173
npm test             # runs the original Jest + jsdom test suite
npm run test:coverage
```

## Layout

```
legacy/
├── src/                       # 8 JSX/JS source files (~9,000 lines)
│   ├── app.jsx                # root + routing (778 lines)
│   ├── screens.jsx            # 30+ screens (~4,900 lines)
│   ├── components.jsx         # primitives (SCEventCard, SCAvatar, ...)
│   ├── additions.jsx          # ToastHost, ConfirmDialog, onboarding
│   ├── heuristic-fixes.jsx    # conflict chip, host edit/cancel
│   ├── data.jsx               # SC_* mock fixtures
│   ├── date-time.jsx          # time/date helpers
│   ├── api.js                 # dual-mode Supabase bridge
│   ├── ios-frame.jsx          # iPhone bezel for desktop demo
│   └── tweaks-panel.jsx       # heuristic-toggle dev panel
├── tests/
│   ├── unit/                  # 5 unit-test files
│   └── integration/           # 4 component / API tests
├── index.html                 # prototype entry — loads src/ via <script type="text/babel">
├── package.json               # legacy deps (React 18, Jest 29, Babel)
├── jest.config.js
├── jest.setup.js
├── babel.config.json
└── .env / .env.example        # SC_SUPABASE_* env vars (legacy api.js)
```

## What changed in the Expo migration

- The 4,876-line `screens.jsx` was split into 24 individual route files
  under `scenecheck-expo/app/`.
- `app.jsx`'s 21 `useState` calls became typed slices of a Zustand store
  (`scenecheck-expo/store/useStore.ts`).
- `api.js` (window-globals) → `lib/api.ts` (typed imports) with a
  single source of truth for ID mapping and mock-mode behavior.
- HTML elements (`<div>`, `<button>`) → React Native primitives
  (`<View>`, `<Pressable>`) so the same code runs on iOS, Android, and Web.
- CSS custom properties → a typed theme object consumed via `useTokens()`.
- Conflict-detection logic was deduplicated (was in two places: `app.jsx`
  and `heuristic-fixes.jsx`) into `scenecheck-expo/lib/conflicts.ts`.

See `docs/CODE_REVIEW_REPORT.md` for the audit that drove most of these
changes, and `docs/TEST_PLAN.md` for the migrated test coverage.
