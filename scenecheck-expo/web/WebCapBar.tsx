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
  const pct = Math.max(0, Math.min(1, cap > 0 ? attendees / cap : 0));
  const nearFull = pct > 0.85;
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
            width: `${pct * 100}%`,
            height: '100%',
            borderRadius: 999,
            background: nearFull ? t.warn : t.good,
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
        <span style={{ color: t.ink3 }}>/{cap}</span>
      </span>
    </div>
  );
}
