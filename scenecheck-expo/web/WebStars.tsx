// WebStars — port of `WStars` from web-shared.jsx. Five-star rating
// glyph that fills `round(value)` stars in `warn` (gold) and leaves
// the rest as `line` color. Falls back to a "No ratings yet" string
// when `value` is null/undefined.

import type { CSSProperties } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';

interface Props {
  value: number | null | undefined;
  size?: number;
  showNum?: boolean;
  style?: CSSProperties;
}

export function WebStars({ value, size = 13, showNum = true, style }: Props) {
  const t = useTokens();
  if (value == null) {
    return (
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: size - 1,
          color: t.ink3,
          ...style,
        }}
      >
        No ratings yet
      </span>
    );
  }
  const full = Math.round(value);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            style={{
              color: i < full ? t.warn : t.line,
              fontSize: size,
              lineHeight: 1,
            }}
          >
            ★
          </span>
        ))}
      </span>
      {showNum && (
        <span style={{ fontFamily: FONT.mono, fontSize: size - 1, fontWeight: 600 }}>
          {value.toFixed(1)}
        </span>
      )}
    </span>
  );
}
