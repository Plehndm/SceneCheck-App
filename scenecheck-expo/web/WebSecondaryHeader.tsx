// WebSecondaryHeader — small page header used by the desktop "my-X"
// list screens. A back button + uppercase subtitle + display-font
// title + optional right slot (e.g. a count chip or action button).
// Lightweight on purpose: the secondary list screens are content-only
// columns, not the full sticky-card profile layout reserved for
// app/(tabs)/profile.web.tsx.

import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { WebIcon } from './WebIcon';

interface Props {
  subtitle?: string;
  title: string;
  hint?: string;
  right?: ReactNode;
}

export function WebSecondaryHeader({ subtitle, title, hint, right }: Props) {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '24px 4px 18px',
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Back"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: `1px solid ${t.line}`,
          background: t.card,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: t.ink,
          flexShrink: 0,
        }}
      >
        <WebIcon name="back" size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        {subtitle && (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: t.ink3,
              textTransform: 'uppercase',
            }}
          >
            {subtitle}
          </div>
        )}
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: t.ink,
            lineHeight: 1,
            marginTop: subtitle ? 4 : 0,
          }}
        >
          {title}
        </div>
        {hint && (
          <div
            style={{
              fontSize: 13,
              color: t.ink3,
              marginTop: 6,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}
