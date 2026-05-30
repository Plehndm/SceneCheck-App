// WebJoinButton — port of `WJoinButton` from web-shared.jsx. RSVP
// toggle button that flips between an inviting green "JOIN EVENT" pill
// and a confirmed dark "JOINED" pill (with a check icon). The actual
// join/leave call lives on the screen; this just controls the visual
// state and forwards `onToggle`.

import type { CSSProperties, MouseEventHandler } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { WebIcon } from './WebIcon';

export type WebJoinButtonSize = 'sm' | 'md' | 'lg';

interface Props {
  joined: boolean;
  onToggle?: MouseEventHandler<HTMLButtonElement>;
  label?: string;
  size?: WebJoinButtonSize;
  full?: boolean;
  style?: CSSProperties;
}

const SIZES: Record<
  WebJoinButtonSize,
  { h: number; fs: number; px: number; r: number }
> = {
  sm: { h: 34, fs: 11, px: 14, r: 10 },
  md: { h: 42, fs: 12, px: 18, r: 12 },
  lg: { h: 52, fs: 14, px: 22, r: 14 },
};

export function WebJoinButton({
  joined,
  onToggle,
  label = 'JOIN EVENT',
  size = 'md',
  full = false,
  style,
}: Props) {
  const t = useTokens();
  const s = SIZES[size];
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: full ? '100%' : 'auto',
        height: s.h,
        padding: `0 ${s.px}px`,
        borderRadius: s.r,
        background: joined ? t.ink : t.good,
        color: joined ? t.card : 'white',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: FONT.mono,
        fontSize: s.fs,
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        boxShadow: joined
          ? 'inset 0 0 0 1px rgba(255,255,255,0.12)'
          : `0 6px 16px -7px color-mix(in oklab, ${t.good} 70%, transparent)`,
        ...style,
      }}
    >
      {joined ? (
        <>
          <WebIcon name="check" size={15} /> JOINED
        </>
      ) : (
        label
      )}
    </button>
  );
}
