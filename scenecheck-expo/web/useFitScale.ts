// useFitScale — port of the homonymous hook from the legacy
// `web/web-app.jsx`. The desktop design is laid out on a fixed
// 1440 × 900 stage; this hook returns the scale factor that fits that
// stage into the actual browser viewport (minus `pad` px of breathing
// room), clamped to a maximum of 1 so the design never zooms up past
// its native size on large monitors. The caller passes the returned
// scale into `transform: scale(...)` on a wrapper around the stage.
//
// SSR safety: Expo Router pre-renders pages in Node with
// `web.output: 'static'`, where `window` is undefined. The initial
// state defaults to 1 in that case; once the component hydrates in the
// browser, the `useEffect` runs and computes the real scale.

import { useEffect, useState } from 'react';

export function useFitScale(
  designW: number,
  designH: number,
  pad: number = 48,
): number {
  const [scale, setScale] = useState<number>(1);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const sx = (window.innerWidth - pad) / designW;
      const sy = (window.innerHeight - pad) / designH;
      setScale(Math.min(1, sx, sy));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [designW, designH, pad]);
  return scale;
}
