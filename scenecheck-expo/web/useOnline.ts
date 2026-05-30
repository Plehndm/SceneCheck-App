// useOnline — port of the homonymous hook from `web/web-app.jsx`.
// Subscribes to the browser's `online` / `offline` events and exposes a
// boolean that callers can use to flip UI between live and cached
// states (e.g. the connection chip on the rail / status bar).
//
// SSR safety: defaults to `true` when `navigator` is undefined so the
// pre-rendered HTML matches the "live" state most users will see on
// first paint. The effect re-syncs after hydration.

import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
