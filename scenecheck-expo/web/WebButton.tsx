// WebButton — generic action button used across the desktop UI.
// Three sizes, four tones. Optional leading icon (passed by name to
// keep the icon set centralized in WebIcon).

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { WebIcon, type WebIconName } from './WebIcon';

export type WebButtonSize = 'sm' | 'md' | 'lg';
export type WebButtonTone = 'primary' | 'dark' | 'ghost' | 'soft';

interface Props {
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  tone?: WebButtonTone;
  size?: WebButtonSize;
  icon?: WebIconName | string;
  style?: CSSProperties;
  disabled?: boolean;
  title?: string;
}

const SIZES: Record<
  WebButtonSize,
  { h: number; fs: number; px: number; r: number; ic: number }
> = {
  sm: { h: 34, fs: 11, px: 12, r: 10, ic: 15 },
  md: { h: 40, fs: 12, px: 16, r: 12, ic: 16 },
  lg: { h: 48, fs: 13, px: 20, r: 14, ic: 18 },
};

export function WebButton({
  children,
  onClick,
  tone = 'ghost',
  size = 'md',
  icon,
  style,
  disabled,
  title,
}: Props) {
  const t = useTokens();
  const s = SIZES[size];
  const tones: Record<
    WebButtonTone,
    { bg: string; fg: string; bd: string; sh: string }
  > = {
    primary: {
      bg: t.primary,
      fg: t.primaryInk,
      bd: 'none',
      sh: `0 8px 18px -8px color-mix(in oklab, ${t.primary} 70%, transparent)`,
    },
    dark: { bg: t.ink, fg: t.card, bd: 'none', sh: 'none' },
    ghost: { bg: t.card, fg: t.ink, bd: `1px solid ${t.line}`, sh: 'none' },
    soft: { bg: t.subtle, fg: t.ink, bd: 'none', sh: 'none' },
  };
  const tn = tones[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        height: s.h,
        padding: `0 ${s.px}px`,
        borderRadius: s.r,
        background: tn.bg,
        color: tn.fg,
        border: tn.bd,
        boxShadow: tn.sh,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: FONT.mono,
        fontSize: s.fs,
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {icon && <WebIcon name={icon} size={s.ic} />}
      {children}
    </button>
  );
}
