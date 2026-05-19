// TS-only default for the Map component. Metro picks Map.web.tsx on
// web and Map.native.tsx on iOS/Android via platform-extension
// resolution — those replace this file at bundle time. This file
// only exists so TypeScript has something to resolve `./Map` to;
// it should never actually execute.

import type { MapProps } from './types';

export function Map(_props: MapProps): never {
  throw new Error(
    'Map fallback used — Metro should have picked Map.web.tsx or Map.native.tsx. ' +
    'Are you running TypeScript directly without Metro?'
  );
}
