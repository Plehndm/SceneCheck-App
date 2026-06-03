// FR1.3 — Post-signup interest questionnaire (WEB).
//
// Desktop counterpart to the native full-screen picker in
// `interests.tsx`. Same store contract + flow (local selection set,
// committed in one batch via api.markOnboarded, then router.replace
// into the tabs), but presented as a floating dialog that hovers in
// front of a blurred, inert preview of the main explore page instead
// of a page laid out to fill the screen.
//
// The backdrop is the real `HomeWeb` explore component rendered behind a
// scrim: pointer-events disabled + aria-hidden so it's purely
// decorative, blurred + dimmed so the floating card reads as the focus.
// We mount it client-side only (after first effect) so the static
// pre-render doesn't pay for a second Leaflet map, and so there's no
// SSR/client hydration mismatch for the heavier explore tree.
//
// Everything else — why this route lives outside the (tabs) group, how
// AuthGate / sign-up reach it — is documented in `interests.tsx`.

import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useInterests } from '@/hooks/useInterests';
import { api } from '@/lib/api';
import { WebIcon } from '@/web/WebIcon';
import HomeWeb from '@/app/(tabs)/index';

export default function OnboardingInterestsWeb() {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);
  const [query, setQuery] = useState('');
  // Local selection set, committed in one batch on Continue / Skip —
  // matches the native screen so a mid-flow abandonment leaves no
  // half-saved tags.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  // Defer the (heavy) explore backdrop to the client so the static
  // pre-render stays light and the server/client markup matches.
  const [showBackdrop, setShowBackdrop] = useState(false);
  useEffect(() => { setShowBackdrop(true); }, []);

  const { interests: list, loading } = useInterests(query);

  const toggle = (tag: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const finish = async (tags: string[]) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.markOnboarded(tags);
      router.replace('/(tabs)' as never);
    } catch (e) {
      // Stay on the screen so the user can retry; AuthGate would
      // otherwise bounce them right back here on the next render.
      showToast({
        message: e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save interests.",
        kind: 'error',
      });
      setSubmitting(false);
    }
  };

  const handleContinue = () => finish(Array.from(selected));
  const handleSkip = () => finish([]);

  const labelCap: React.CSSProperties = {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: t.ink3,
    textTransform: 'uppercase',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* ── Blurred, inert explore page behind the dialog ── */}
      {showBackdrop && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            // Scale up a touch so the blur's soft edges don't reveal the
            // surface seams at the viewport border.
            transform: 'scale(1.04)',
            filter: 'blur(9px) saturate(0.92)',
          }}
        >
          <HomeWeb />
        </div>
      )}

      {/* ── Scrim: dims + frosts the backdrop so the card pops ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `color-mix(in oklab, ${t.pageBg} 30%, rgba(0,0,0,0.45))`,
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
      />

      {/* ── Floating card ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pick a few interests"
          style={{
            width: '100%',
            maxWidth: 560,
            maxHeight: 'min(86vh, 720px)',
            display: 'flex',
            flexDirection: 'column',
            background: t.card,
            borderRadius: 24,
            border: `1px solid ${t.line}`,
            boxShadow: '0 40px 100px -28px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            fontFamily: FONT.body,
            color: t.ink,
          }}
        >
          {/* Header */}
          <div style={{ padding: '26px 28px 16px' }}>
            <div style={labelCap}>Welcome</div>
            <div
              style={{
                marginTop: 8,
                fontFamily: FONT.display,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                fontSize: 30,
                lineHeight: 1.04,
                color: t.ink,
              }}
            >
              Pick a few interests
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.5, color: t.ink3 }}>
              We&apos;ll use these to recommend events near you. You can change
              them anytime from Profile&nbsp;→&nbsp;Interests.
            </p>
          </div>

          {/* Search */}
          <div style={{ padding: '0 28px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 14px',
                height: 46,
                background: t.subtle,
                borderRadius: 13,
                border: `1px solid ${t.line}`,
              }}
            >
              <WebIcon name="search" size={16} color={t.ink3} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search interests…"
                autoCapitalize="none"
                autoCorrect="off"
                style={{
                  flex: 1,
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: t.ink,
                  fontFamily: FONT.body,
                  fontSize: 14,
                }}
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}
                >
                  <WebIcon name="x" size={14} color={t.ink3} />
                </button>
              )}
            </div>
          </div>

          {/* Selection summary */}
          <div
            style={{
              padding: '16px 28px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={labelCap}>{query ? `Matching "${query}"` : 'Suggested'}</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink3 }}>
              {selected.size} selected
            </div>
          </div>

          {/* Chip grid — scrolls within the card so the header + footer
              stay pinned. Selected chips invert to the primary color. */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '4px 28px 20px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignContent: 'flex-start',
            }}
          >
            {list.map(i => {
              const isOn = selected.has(i.tag);
              return (
                <button
                  key={i.tag}
                  type="button"
                  onClick={() => toggle(i.tag)}
                  aria-pressed={isOn}
                  aria-label={`${isOn ? 'Remove' : 'Add'} ${i.tag}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 14px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    border: `1.5px solid ${isOn ? t.primary : t.line}`,
                    background: isOn ? t.primary : t.card,
                    color: isOn ? t.primaryInk : t.ink,
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {isOn && <WebIcon name="check" size={12} color={t.primaryInk} />}
                  #{i.tag}
                </button>
              );
            })}
            {!loading && list.length === 0 && (
              <div style={{ fontSize: 13, color: t.ink3, padding: '8px 0' }}>
                No tags match that search.
              </div>
            )}
          </div>

          {/* Footer CTAs — Continue commits the selection; Skip commits an
              empty list so the user lands on the home feed regardless. */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: '16px 28px 22px',
              borderTop: `1px solid ${t.line}`,
            }}
          >
            <button
              type="button"
              onClick={handleSkip}
              disabled={submitting}
              style={{
                flex: '0 0 auto',
                padding: '0 20px',
                height: 50,
                borderRadius: 14,
                border: `1px solid ${t.line}`,
                background: t.card,
                color: t.ink2,
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.5 : 1,
                fontFamily: FONT.mono,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={submitting}
              style={{
                flex: 1,
                height: 50,
                borderRadius: 14,
                border: 'none',
                background: t.primary,
                color: t.primaryInk,
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                fontFamily: FONT.mono,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {submitting ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
