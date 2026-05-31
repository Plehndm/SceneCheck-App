// Loading placeholders for the desktop web build — the web counterpart of
// components/SCSkeleton.tsx. Same intent: while a fetch is in flight, show a
// shape-matched pulsing placeholder instead of an empty flash or a premature
// "doesn't exist" message, then swap to the real content (or an empty state)
// once loading completes.
//
// Built from raw <div>s + a CSS keyframe pulse (injected once into <head>) so
// it doesn't pull react-native's Animated into the web bundle — matching the
// inline-skeleton approach already used in WebDiscSection.

import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useTokens } from '@/theme/ThemeProvider';

const STYLE_ID = 'sc-web-skeleton-style';

// Inject the pulse keyframes once. SSR-safe (no-op without `document`) and
// idempotent (guarded by id) so every WebSkeleton instance can call it.
function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent =
    '@keyframes scSkelPulse{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}';
  document.head.appendChild(el);
}

interface BlockProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}

// Single pulsing block — the primitive every composite below is built from.
export function WebSkeleton({ width = '100%', height = 14, radius = 8, style }: BlockProps) {
  const t = useTokens();
  useEffect(ensureKeyframes, []);
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        width,
        height,
        borderRadius: radius,
        background: t.subtle,
        animation: 'scSkelPulse 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

// Vertical stack of row cards (avatar + two text lines) — friends, chat list,
// people/org search results. Matches the WebPersonRow / chat-row footprint.
export function WebSkeletonRows({ rows = 4 }: { rows?: number }) {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            border: `1px solid ${t.line}`,
            borderRadius: 14,
            background: t.card,
          }}
        >
          <WebSkeleton width={42} height={42} radius={12} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <WebSkeleton width="60%" height={13} />
            <WebSkeleton width="38%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Event-card-shaped placeholders for the Home right-column events list.
export function WebSkeletonCards({ cards = 3 }: { cards?: number }) {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: 16,
            border: `1px solid ${t.line}`,
            borderRadius: 16,
            background: t.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <WebSkeleton width="40%" height={10} />
          <WebSkeleton width="80%" height={18} />
          <WebSkeleton width="55%" height={12} />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <WebSkeleton width="45%" height={11} />
            <WebSkeleton width="30%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Alternating chat-bubble placeholders for a thread that's still loading its
// initial history. Mirrors SCMessageSkeleton on native.
export function WebMessageSkeleton({ bubbles = 6 }: { bubbles?: number }) {
  // (width, mine, tall) per bubble so the stack reads as a real conversation.
  const shapes: Array<[string, boolean, boolean]> = [
    ['58%', false, false],
    ['40%', true, false],
    ['68%', false, true],
    ['34%', true, false],
    ['50%', false, false],
    ['44%', true, true],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
      {Array.from({ length: bubbles }).map((_, i) => {
        const [w, mine, tall] = shapes[i % shapes.length];
        return (
          <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
            <WebSkeleton width={w} height={tall ? 48 : 32} radius={16} style={{ maxWidth: '70%' }} />
          </div>
        );
      })}
    </div>
  );
}

// Detail-overlay placeholder (event detail + other-profile slide-overs): a
// hero block, an avatar + name row, a CTA bar, and a few description lines.
export function WebOverlaySkeleton() {
  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <WebSkeleton height={180} radius={18} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <WebSkeleton width={52} height={52} radius={26} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <WebSkeleton width="50%" height={16} />
          <WebSkeleton width="32%" height={11} />
        </div>
      </div>
      <WebSkeleton height={44} radius={12} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <WebSkeleton width="92%" height={12} />
        <WebSkeleton width="80%" height={12} />
        <WebSkeleton width="86%" height={12} />
      </div>
    </div>
  );
}
