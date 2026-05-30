// WebSlideOver — right-side panel that slides in over the current
// screen, with a blurred backdrop. Used for the overlay routes
// (event detail, person/org profile, attendees, ratings, interest
// detail) on web — these are full screens on native but should feel
// like a "drawer" on desktop.
//
// Animation matches the `slideOver` keyframes from the design's
// `SceneCheck Web.html` (320 ms cubic-bezier(.22,.8,.3,1) — translate
// from 36px + fade in). Closes on backdrop click or ESC.

import {
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { useFocusTrap } from './useFocusTrap';

interface Props {
  open: boolean;
  onClose: () => void;
  width?: number | string;
  /** Render the panel even when closed (e.g. to animate out on close).
   *  When false (default) the panel unmounts as soon as `open=false`. */
  keepMounted?: boolean;
  /** Accessible name for the dialog. Required for AT users to know
   *  what overlay is open — every consumer should pass a meaningful
   *  string (see `docs/WEB_BUILD_REVIEW.md` H-02). */
  ariaLabel?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function WebSlideOver({
  open,
  onClose,
  width = 520,
  keepMounted = false,
  ariaLabel,
  children,
  style,
}: Props) {
  const t = useTokens();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ESC closes. Bound only while open so a closed slide-over doesn't
  // intercept ESC for whatever's underneath.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Trap Tab focus inside the panel + auto-focus first focusable on
  // open. (WCAG 2.1 SC 2.4.3 — focus order.)
  useFocusTrap(open, panelRef);

  if (!open && !keepMounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.32)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
          zIndex: 70,
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width,
          maxWidth: '100%',
          background: t.surface,
          boxShadow: '-30px 0 80px -30px rgba(0,0,0,0.45)',
          borderLeft: `1px solid ${t.line}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 71,
          transform: open ? 'translateX(0)' : 'translateX(36px)',
          opacity: open ? 1 : 0,
          transition:
            'transform 320ms cubic-bezier(.22,.8,.3,1), opacity 320ms cubic-bezier(.22,.8,.3,1)',
          ...style,
        }}
      >
        {children}
      </div>
    </>
  );
}
