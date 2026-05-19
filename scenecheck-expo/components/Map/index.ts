// Barrel for the platform-split Map. TypeScript resolves the `Map`
// re-export to Map.tsx (the stub fallback); Metro at bundle time picks
// Map.native.tsx on iOS/Android and Map.web.tsx on web.

export { Map } from './Map';
export * from './types';
