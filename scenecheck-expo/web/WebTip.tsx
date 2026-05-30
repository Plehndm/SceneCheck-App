// WebTip — portal-based tooltip with a hover delay. Mirrors the CSS
// tooltip helper from `SceneCheck Web.html` (`.tip` / `.tip-body`):
// ~260 ms hover delay, dark ink-on-surface chip with rounded corners
// and a subtle drop shadow. Rendered through a React Portal at
// `z-index: 9999` so it can escape transformed / overflow:hidden
// ancestors (the desktop shell uses both).
//
// Position is computed from the trigger's `getBoundingClientRect()`
// every time the tooltip opens, then placed in viewport coordinates
// so the portal can live in `document.body`. Supports the same four
// sides as the legacy CSS implementation: 'right' (default), 'top',
// 'bottom', 'left'.

import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from 'react';
// Typed via a thin local declaration (web/react-dom.d.ts) so we don't
// have to pull `@types/react-dom` into the project just for one helper.
import { createPortal } from 'react-dom';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';

export type WebTipSide = 'right' | 'top' | 'bottom' | 'left';

interface Props {
  title: string;
  desc?: string;
  side?: WebTipSide;
  gap?: number;
  /** Disable the tooltip entirely (useful when an enclosing panel
   *  collapses and shouldn't show hover hints). */
  disabled?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

/** Hover-open delay matching the legacy `.tip` CSS. */
const HOVER_DELAY_MS = 260;

export function WebTip({
  title,
  desc,
  side = 'right',
  gap = 12,
  disabled = false,
  children,
  style,
}: Props) {
  const t = useTokens();
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Re-measure each time the tooltip opens so transformed shell
  // wrappers (e.g. `useFitScale`'s `transform: scale()`) don't desync
  // the portal position. Width/height are read off the rendered
  // tooltip via ref in a layout effect.
  const tipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const compute = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tipEl = tipRef.current;
    const tw = tipEl?.offsetWidth ?? 0;
    const th = tipEl?.offsetHeight ?? 0;
    let left = 0;
    let top = 0;
    if (side === 'right') {
      left = r.right + gap;
      top = r.top + r.height / 2 - th / 2;
    } else if (side === 'left') {
      left = r.left - gap - tw;
      top = r.top + r.height / 2 - th / 2;
    } else if (side === 'top') {
      left = r.left + r.width / 2 - tw / 2;
      top = r.top - gap - th;
    } else {
      left = r.left + r.width / 2 - tw / 2;
      top = r.bottom + gap;
    }
    setPos({ left, top });
  };

  // Recompute once the tooltip mounts (so we get the real measured
  // size) and on subsequent resizes/scrolls while open.
  useEffect(() => {
    if (!open) return;
    compute();
    const onScroll = () => compute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onEnter = () => {
    if (disabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  };
  const onLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  const portalReady = typeof document !== 'undefined';
  const tip = open && portalReady ? (
    createPortal(
      <div
        ref={tipRef}
        role="tooltip"
        style={{
          position: 'fixed',
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          zIndex: 9999,
          pointerEvents: 'none',
          background: t.ink,
          color: t.surface,
          borderRadius: 10,
          padding: '8px 11px',
          boxShadow: '0 12px 30px -10px rgba(0,0,0,0.45)',
          whiteSpace: 'nowrap',
          maxWidth: 260,
          opacity: pos ? 1 : 0,
          transform: 'translateY(0) scale(1)',
          transition: 'opacity 120ms ease, transform 120ms ease',
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
          }}
        >
          {title}
        </div>
        {desc && (
          <div
            style={{
              fontSize: 11,
              color: `color-mix(in oklab, ${t.surface} 72%, ${t.ink})`,
              marginTop: 2,
              maxWidth: 220,
              whiteSpace: 'normal',
              lineHeight: 1.35,
            }}
          >
            {desc}
          </div>
        )}
      </div>,
      document.body,
    )
  ) : null;

  return (
    <span
      ref={wrapRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ display: 'inline-flex', position: 'relative', ...style }}
    >
      {children}
      {tip}
    </span>
  );
}
