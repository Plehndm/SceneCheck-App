// useOnline — connection-health signal for the LIVE/OFFLINE chip.
//
// The chip claims the app is "live" and updating in real time, so this
// hook has to report more than the browser's coarse `navigator.onLine`
// flag. `navigator.onLine` only knows whether *a* network interface
// exists — it stays `true` on a Wi-Fi network whose router can't reach
// the internet, behind a captive portal, or when the backend itself is
// down. That's exactly why the old chip showed LIVE while the app had
// no usable connection. We combine two signals instead:
//
//   1. `navigator.onLine` + the window `online`/`offline` events — a
//      fast, zero-cost "the device has no network at all" detector that
//      flips the chip the instant the OS reports a hard disconnect.
//   2. The health of the app's Supabase Realtime websocket — the same
//      socket the chat + notification channels ride on. We open one
//      bare heartbeat channel and treat the app as connected only while
//      it reports `SUBSCRIBED`. A channel that errors, times out, or
//      closes (backend unreachable even though the LAN is up) flips the
//      chip to OFFLINE; the client auto-reconnects and re-fires
//      `SUBSCRIBED` on recovery, flipping it back.
//
// Mock mode (no Supabase client — Jest, demos): there's no backend to
// probe, so the realtime signal stays healthy and the result follows
// `navigator.onLine` alone. This preserves the prior behaviour the test
// suite (which runs in mock mode) relies on.
//
// SSR safety: defaults to `true` when `navigator` is undefined so the
// pre-rendered HTML matches the "live" state; the effects re-sync after
// hydration.

import { useEffect, useId, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnline(): boolean {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  // Optimistic until the heartbeat channel says otherwise, so the chip
  // shows LIVE on first paint instead of flashing OFFLINE during the
  // socket's initial join. In mock mode this never changes (no client),
  // leaving the result equal to `browserOnline`.
  const [realtimeOnline, setRealtimeOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Unique per hook instance: `client.channel(topic)` returns the SAME
  // instance for a repeated topic (see hooks/useNotifications.ts), so a
  // shared name would let one consumer's unmount tear down another's
  // live channel. A per-instance topic keeps the heartbeats independent.
  const topic = `app-health:${useId()}`;

  useEffect(() => {
    const client = supabase;
    if (!client) return; // mock mode — no backend to probe
    let active = true;
    const channel = client.channel(topic).subscribe((status) => {
      if (!active) return;
      // 'SUBSCRIBED' = joined + healthy. 'CHANNEL_ERROR' / 'TIMED_OUT'
      // / 'CLOSED' = the socket can't reach the backend right now.
      setRealtimeOnline(status === 'SUBSCRIBED');
    });
    return () => {
      active = false;
      client.removeChannel(channel);
    };
  }, [topic]);

  return browserOnline && realtimeOnline;
}
