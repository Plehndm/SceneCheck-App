// Custom HTML wrapper for Expo Router's web static export (`web.output:
// "static"` in app.json). This file is web-only — Expo ignores it on
// native — and is rendered once per route at build/SSR time.
//
// What it brings over from the legacy `index.html` design:
//
//   1. The cream body background + two radial-gradient "glows" that the
//      legacy design painted under every screen. These were defined in
//      `theme/tokens.ts` as `pageBg` / `pageGlow1` / `pageGlow2` but
//      were never wired up on either platform after the migration.
//
//   2. Google Fonts for the three families referenced by `theme/tokens.ts`
//      (`Bricolage Grotesque` for `FONT.display`, `DM Sans` for
//      `FONT.body`, `JetBrains Mono` for `FONT.mono`). Before this, web
//      fell back to the browser's default sans-serif, so the type set
//      looked nothing like the design.
//
//   3. The `-webkit-font-smoothing` + `text-rendering` rules from the
//      legacy `<body>` styles so type renders identically on web.
//
// Color values are hardcoded to the Sunset Coral *light* tokens — the
// store's default palette+mode (`store/useStore.ts:189-190`). After
// hydration the React tree paints its own theme-aware backgrounds on
// every Screen, so this only matters for the pre-hydration paint and
// for the area outside the React root (browser scrollbar gutters, etc).
// If/when palette-aware body styling becomes a priority, sync the body
// background to `useStore.getState().palette` via a client-side effect.

import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?' +
  'family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800' +
  '&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700' +
  '&family=JetBrains+Mono:wght@400;500;600' +
  '&display=swap';

// Sunset Coral / light — mirrors the values in `theme/tokens.ts`. Kept
// in sync by hand; the comment header above explains why.
const BODY_CSS = `
html, body {
  margin: 0;
  padding: 0;
  background: #ECE3D2;
  color: #14110F;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-family: 'DM Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
}
body {
  min-height: 100vh;
  background:
    radial-gradient(1200px 600px at 20% 10%, #F8E3CC 0%, transparent 60%),
    radial-gradient(1000px 800px at 90% 90%, #F4D8C3 0%, transparent 60%),
    #ECE3D2;
}
#root {
  display: flex;
  min-height: 100vh;
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_HREF} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BODY_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
