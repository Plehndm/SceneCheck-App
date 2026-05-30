// WebSettingsSection — collapsible settings card with an inline summary
// chip in the header. Click the header row to expand / collapse with a
// 200 ms reveal animation. Used by the desktop Settings screen so a
// single scrollable column can keep every setting one click away while
// still letting the user see the current value (e.g. "Discovery · 10 mi",
// "Notifications · 4 of 6 on") without expanding.
//
// Reveal animation: we measure the body's natural height with a
// ResizeObserver and animate `max-height` between 0 and that height so
// the transition stays smooth even when the body contains a slider that
// changes height (e.g. the warning callout the discovery section pops
// in at >25 mi). Falls back to a hard show/hide if RO isn't available
// (older test environments).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { WebIcon, type WebIconName } from './WebIcon';

interface Props {
  title: string;
  /** Inline summary chip rendered on the right of the header (e.g. "10 mi"). */
  summary?: string;
  /** When true, render expanded on first mount. Defaults to false. */
  defaultOpen?: boolean;
  /** Optional leading icon shown in the header. */
  icon?: WebIconName | string;
  /** Section body — controls. */
  children: ReactNode;
  /** Tone the summary chip in the danger color (e.g. blocked = N). */
  summaryTone?: 'default' | 'accent' | 'warn';
  /** Override the wrapper styles. */
  style?: CSSProperties;
}

export function WebSettingsSection({
  title,
  summary,
  defaultOpen = false,
  icon,
  children,
  summaryTone = 'default',
  style,
}: Props) {
  const t = useTokens();
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [bodyHeight, setBodyHeight] = useState<number | null>(null);

  // Track body's natural height so the collapse can animate max-height
  // smoothly even as the body's own children resize (e.g. the discovery
  // warning callout pops in at >25 mi).
  useEffect(() => {
    if (!bodyRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setBodyHeight(r.height);
    });
    ro.observe(bodyRef.current);
    return () => ro.disconnect();
  }, []);

  const toggle = useCallback(() => setOpen(v => !v), []);

  const summaryColor =
    summaryTone === 'warn'
      ? t.warn
      : summaryTone === 'accent'
        ? t.primary
        : t.ink3;

  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        overflow: 'hidden',
        ...style,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: t.ink,
          textAlign: 'left',
          fontFamily: FONT.body,
        }}
      >
        {icon && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: t.subtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.ink2,
              flexShrink: 0,
            }}
          >
            <WebIcon name={icon} size={17} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1.15,
              color: t.ink,
            }}
          >
            {title}
          </div>
          {summary && (
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                color: summaryColor,
                marginTop: 3,
                letterSpacing: '0.04em',
              }}
            >
              {summary}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            color: t.ink3,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
        >
          <WebIcon name="chevron-down" size={18} />
        </div>
      </button>
      <div
        style={{
          // L-02 fix — before the ResizeObserver fires, `bodyHeight` is
          // null. The previous fallback of `9999 + 32 = 10031px` made
          // first-expand animate from 0 to 10031 and then snap back to
          // the real content height once the observer caught up. Using
          // 'none' until measured skips the animation only for the very
          // first paint (subsequent toggles have a measured height).
          maxHeight: open
            ? (bodyHeight != null ? bodyHeight + 32 : 'none')
            : 0,
          opacity: open ? 1 : 0,
          transition: 'max-height 220ms ease, opacity 200ms ease',
          overflow: 'hidden',
        }}
        aria-hidden={!open}
      >
        <div
          ref={bodyRef}
          style={{
            padding: '4px 18px 18px',
            borderTop: open ? `1px solid ${t.line}` : 'none',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
