// Jest config for the Expo SceneCheck app.
//
// `jest-expo` ships the right babel transform, default mocks for the
// Expo SDK modules, and a transformIgnorePatterns regex tuned for RN
// packages that ship untranspiled ESM. We extend it with:
//   - moduleNameMapper to honor the `@/` path alias from tsconfig.json
//   - extra ignore entries for our new web-only deps (react-leaflet,
//     leaflet) so they don't get pulled into native test bundles
//   - coverage scope locked to our source dirs (not generated code)

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // react-leaflet only runs on web; stub it so native test bundles
    // don't choke on its ESM imports.
    '^react-leaflet$': '<rootDir>/tests/__mocks__/react-leaflet.ts',
    '^leaflet$': '<rootDir>/tests/__mocks__/leaflet.ts',
    '^leaflet/dist/leaflet.css$': '<rootDir>/tests/__mocks__/empty.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-maps|@supabase/.*))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/ios/', '/android/'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'store/**/*.ts',
    'theme/**/*.ts',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.ts',
    '!**/*.d.ts',
    '!components/Map/Map.web.tsx',  // web-only, separate test pass
  ],
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
};
