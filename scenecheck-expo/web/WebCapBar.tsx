// WebCapBar — port of `WCapBar` from web-shared.jsx. Inline capacity
// bar showing attendees / cap as a progress strip with the numeric
// count on the right. Flips to `warn` (gold) when more than 85% full
// to telegraph "fills soon".

import type { CSSProperties } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';

interface Props {
  attendees: number;
  cap: number;
  style?: CSSProperties;
}

export function WebCapBar({ attendees, cap, style }: Props) {
  const t = useTokens();
  // cap <= 0 = unknown / unlisted capacity (typically scraped events). Show
  // "N/unk" — same signal the native + web event detail use — and leave the
  // bar neutral since there's no meaningful fill ratio to draw.
  const capUnknown = cap <= 0;
  const pct = Math.max(0, Math.min(1, capUnknown ? 0 : attendees / cap));
  const nearFull = !capUnknown && pct > 0.85;
  // Unknown capacity has no fill ratio, but the bar should still telegraph
  // "people are going" when there are attendees — otherwise an unknown-cap
  // event with a crowd reads identically to an empty one. Render a diagonal
  // striped (indeterminate / "no limit") fill across the track in that case;
  // a known cap keeps the normal proportional fill.
  const fill: CSSProperties = capUnknown
    ? (attendees > 0
        ? {
            width: '100%',
            background: `repeating-linear-gradient(45deg, ${t.good} 0 5px, color-mix(in oklab, ${t.good} 42%, transparent) 5px 10px)`,
          }
        : { width: '0%' })
    : { width: `${pct * 100}%`, background: nearFull ? t.warn : t.good };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        ...style,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: t.subtle,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 999,
            ...fill,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {attendees}
        <span style={{ color: t.ink3 }}>/{capUnknown ? 'unk' : cap}</span>
      </span>
    </div>
  );
}
