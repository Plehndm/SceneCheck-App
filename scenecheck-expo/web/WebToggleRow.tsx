// WebToggleRow — desktop iOS-style toggle row used inside settings
// sections and the Create-event flow. Label + optional sub + animated
// switch. Web-only (uses raw <div>/<button>) so it composes naturally
// with the rest of the @/web/* surface.
//
// Visual contract mirrors the prototype `WToggleRow` from
// web-screens-c.jsx: 14 px gap, 12 px vertical padding, 14 px corner
// radius, card background with a 1 px line border. The switch track is
// 46 × 28 with a 22 × 22 thumb that slides between left = 3 and
// right = 21 over 160 ms.

import type { CSSProperties } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { WebIcon, type WebIconName } from './WebIcon';

interface Props {
  label: string;
  /** Subdued helper text shown under the label. */
  sub?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  /** Optional leading icon (e.g. 'bell', 'chat'). */
  icon?: WebIconName | string;
  /** Override the wrapper styles when composing the row in another card. */
  style?: CSSProperties;
}

export function WebToggleRow({ label, sub, value, onChange, icon, style }: Props) {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        background: t.card,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            background: t.subtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: value ? t.primary : t.ink3,
            flexShrink: 0,
          }}
        >
          <WebIcon name={icon} size={16} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: t.ink,
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 11.5,
              color: t.ink3,
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        style={{
          width: 46,
          height: 28,
          borderRadius: 999,
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: 0,
          background: value ? t.good : t.line,
          transition: 'background 160ms ease',
          fontFamily: FONT.body,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: value ? 21 : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'white',
            transition: 'left 160ms ease',
            boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
          }}
        />
      </button>
    </div>
  );
}
