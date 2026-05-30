// Minimal ambient declaration for the bits of `react-dom` we use on
// the web side (currently just `createPortal`). Keeps us from having
// to pull `@types/react-dom` into devDependencies just to type a
// single API.

declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react';
  export function createPortal(
    children: ReactNode,
    container: Element | DocumentFragment,
    key?: string | null,
  ): ReactPortal;
}
