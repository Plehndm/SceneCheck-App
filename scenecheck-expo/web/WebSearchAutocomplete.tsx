// WebSearchAutocomplete — Google-Maps-style search bar with a 6-row
// dropdown. Port of the search affordance in `WHome` from
// `web/web-screens-a.jsx`. The scoring below mirrors the original
// (lowest score wins, 0 = best):
//
//   0 — title starts with the query
//   1 — title contains the query
//   2 — `where` contains the query
//   3 — any interest tag contains the query
//   4 — host name contains the query
//   9 — no match (filtered out)
//
// When the user picks a result we fire `onPick(eventId)`. The parent
// uses that to navigate (Wave B1 wires it to `/event/[id]`). Pressing
// Enter on the input picks the top suggestion. Escape clears and
// blurs. The filter button slot on the right is provided as a render
// prop so the parent can hang the WHome-style "filters" popover off
// it without this component owning that state.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import type { SCEvent } from '@/types/domain';
import { whenRange } from '@/lib/date-time';
import { useStore } from '@/store/useStore';
import { wKindMeta } from './kind';
import { WebIcon } from './WebIcon';

interface Props {
  events: SCEvent[];
  /** Event picked from the dropdown (or top suggestion via Enter). */
  onPick: (eventId: string) => void;
  /** Free-text fallback (Enter with no suggestions). Wave C2 owns /search. */
  onSearch?: (query: string) => void;
  /** Optional render-prop for the trailing filter slot (sliders icon). */
  trailing?: ReactNode;
  /** Visible width — defaults to min(500px, 64%) like the legacy header. */
  width?: number | string;
  style?: CSSProperties;
}

const MAX_SUGGESTIONS = 6;

function score(e: SCEvent, ql: string): number {
  const t = e.title.toLowerCase();
  if (t.startsWith(ql)) return 0;
  if (t.includes(ql)) return 1;
  if ((e.where || '').toLowerCase().includes(ql)) return 2;
  if ((e.interests || []).some(i => i.toLowerCase().includes(ql))) return 3;
  // The denormalized `event.host` string is the only host info we have
  // at search time without a batched profile fetch; cheaper than
  // resolving via `wHostAccount` here and matches what cards display.
  if ((e.host || '').toLowerCase().includes(ql)) return 4;
  return 9;
}

function Highlight({ text, q }: { text: string; q: string }) {
  const t = useTokens();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span
        style={{
          background: `color-mix(in oklab, ${t.primary} 24%, transparent)`,
          borderRadius: 3,
          padding: '0 1px',
        }}
      >
        {text.slice(i, i + q.length)}
      </span>
      {text.slice(i + q.length)}
    </>
  );
}

export function WebSearchAutocomplete({
  events,
  onPick,
  onSearch,
  trailing,
  width = 'min(500px, 64%)',
  style,
}: Props) {
  const t = useTokens();
  const subscribedInterests = useStore(s => s.subscribedInterests);
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  const ql = q.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!ql) return [] as SCEvent[];
    return events
      .map(e => ({ e, s: score(e, ql) }))
      .filter(x => x.s < 9)
      .sort((a, b) => a.s - b.s)
      .slice(0, MAX_SUGGESTIONS)
      .map(x => x.e);
  }, [events, ql]);

  const show = focused && ql.length > 0 && suggestions.length > 0;

  const pick = (e: SCEvent) => {
    setQ('');
    setFocused(false);
    onPick(e.id);
  };

  return (
    <div style={{ width, position: 'relative', ...style }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 48,
          padding: '0 8px 0 16px',
          background: `color-mix(in oklab, ${t.card} 94%, transparent)`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: show ? '14px 14px 0 0' : 14,
          border: `1px solid ${t.line}`,
          boxShadow: '0 12px 30px -14px rgba(0,0,0,0.35)',
        }}
      >
        <WebIcon name="search" size={18} color={t.ink3} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            // Delay so clicks inside the dropdown still register before
            // the dropdown unmounts.
            blurTimer.current = setTimeout(() => setFocused(false), 160);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (suggestions[0]) pick(suggestions[0]);
              else if (q.trim() && onSearch) {
                onSearch(q.trim());
                setQ('');
                inputRef.current?.blur();
              }
            } else if (e.key === 'Escape') {
              setQ('');
              inputRef.current?.blur();
            }
          }}
          placeholder="Search events, places, interests…"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14,
            color: t.ink,
            fontFamily: FONT.body,
          }}
        />
        {q && (
          <button
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => setQ('')}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              border: 'none',
              background: t.subtle,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: t.ink,
            }}
          >
            <WebIcon name="x" size={14} />
          </button>
        )}
        {trailing}
      </div>

      {show && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 48,
            zIndex: 46,
            background: t.card,
            border: `1px solid ${t.line}`,
            borderTop: 'none',
            borderRadius: '0 0 14px 14px',
            boxShadow: '0 24px 50px -18px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            padding: 6,
          }}
        >
          {suggestions.map(e => {
            const km = wKindMeta(e, t, subscribedInterests);
            return (
              <button
                key={e.id}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => pick(e)}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = t.subtle)}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: t.ink,
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    flexShrink: 0,
                    background: `color-mix(in oklab, ${km.accent} 16%, ${t.card})`,
                    color: km.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <WebIcon name="pin" size={15} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13.5,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <Highlight text={e.title} q={ql} />
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      color: t.ink3,
                      marginTop: 2,
                    }}
                  >
                    {whenRange(e)} · {e.where}
                  </span>
                </span>
                <WebIcon name="arrow-up-right" size={14} color={t.ink3} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
