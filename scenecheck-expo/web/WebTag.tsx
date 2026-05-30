// WebTag — interest hashtag chip (port of `WTag` from web-shared.jsx).
// Three size presets, four tones. Becomes a button when `onClick` is
// supplied (Discover screen filters by tag), otherwise renders as a
// non-interactive pill.

import type { CSSProperties, MouseEventHandler } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';

export type WebTagSize = 'sm' | 'md' | 'lg';
export type WebTagTone = 'soft' | 'primary' | 'ghost' | 'outline';

interface Props {
  tag: string;
  size?: WebTagSize;
  tone?: WebTagTone;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
}

const SIZES: Record<WebTagSize, { fs: number; py: number; px: number }> = {
  sm: { fs: 12, py: 4, px: 9 },
  md: { fs: 13, py: 6, px: 11 },
  lg: { fs: 16, py: 8, px: 13 },
};

export function WebTag({ tag, size = 'md', tone = 'soft', onClick, style }: Props) {
  const t = useTokens();
  const s = SIZES[size];
  const tones: Record<
    WebTagTone,
    { bg: string; fg: string; border?: string }
  > = {
    soft: { bg: t.subtle, fg: t.ink },
    primary: { bg: t.primary, fg: t.primaryInk },
    ghost: { bg: 'transparent', fg: t.ink2 },
    outline: { bg: 'transparent', fg: t.ink, border: `1px solid ${t.line}` },
  };
  const tn = tones[tone];
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 1,
    padding: `${s.py}px ${s.px}px`,
    background: tn.bg,
    color: tn.fg,
    border: tn.border || 'none',
    borderRadius: 999,
    fontFamily: FONT.mono,
    fontSize: s.fs,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    ...style,
  };
  const contents = (
    <>
      <span style={{ opacity: 0.5 }}>#</span>
      <span>{tag}</span>
    </>
  );
  // Non-interactive tags render a plain <span> so screen readers don't
  // announce them as buttons + they don't take Tab focus. (L-01 in
  // `docs/WEB_BUILD_REVIEW.md` — matches native `SCTag` behavior.)
  if (!onClick) {
    return <span style={{ ...baseStyle, cursor: 'default' }}>{contents}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...baseStyle, cursor: 'pointer' }}
    >
      {contents}
    </button>
  );
}
