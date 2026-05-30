// WebDiscSection — small section wrapper used by the 4 panels of the
// Discover (search) page. A display-font title + optional mono count
// chip + optional "Show all" link sit above the children. Mirrors the
// WDiscSection helper from `web/web-screens-a.jsx`.
//
// Keeping this generic (children, not a fixed grid) so each section
// of the search page can pick its own layout — events use a 2-col
// `WebEventListCard` grid, interests are a wrap-row of chips, etc.

import type { CSSProperties, ReactNode } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';

interface Props {
  title: string;
  /** Optional count chip rendered next to the title (e.g. result count). */
  count?: number;
  /** When provided, a small "SHOW ALL" link in the header fires this. */
  onShowAll?: () => void;
  /** Optional override for the empty-state message. */
  emptyText?: string;
  /**
   * Renders a small skeleton row stack instead of the empty-state text
   * while data is loading. M-08 — without this, the section flickered
   * "Loading events…" as plain body text and the header chip showed "0"
   * while the fetch was still in flight. Mirrors native
   * `SCListSkeleton` shape without pulling RN into the web bundle.
   */
  loading?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
}

export function WebDiscSection({
  title,
  count,
  onShowAll,
  emptyText = 'No matches.',
  loading = false,
  children,
  style,
}: Props) {
  const t = useTokens();
  // While loading, never treat zero-count as empty — render skeletons
  // instead. Also fixes the subtle bug where `children` was swallowed
  // whenever `count === 0` even if a caller passed real content (e.g.
  // a custom empty-state component).
  const isEmpty = !loading && count === 0;
  return (
    <div style={{ marginBottom: 30, ...style }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: t.ink,
          }}
        >
          {title}
        </div>
        {count != null && !loading && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              color: t.ink3,
              fontWeight: 600,
            }}
          >
            {count}
          </span>
        )}
        {onShowAll && (
          <button
            type="button"
            onClick={onShowAll}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT.mono,
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: t.ink3,
              textTransform: 'uppercase',
            }}
          >
            Show all →
          </button>
        )}
      </div>
      {loading ? (
        <SkeletonRows count={3} />
      ) : isEmpty ? (
        <div
          style={{
            color: t.ink3,
            fontSize: 13,
            padding: '12px 0',
          }}
        >
          {emptyText}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// Inline, shimmer-less skeleton block stack. Kept inside this module
// instead of importing the native `SCListSkeleton` (which pulls
// react-native into the web bundle) — the only intent is "show a
// neutral placeholder strip per row while we wait."
function SkeletonRows({ count }: { count: number }) {
  const t = useTokens();
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 56,
            borderRadius: 12,
            background: t.subtle,
            border: `1px solid ${t.line}`,
          }}
        />
      ))}
    </div>
  );
}
