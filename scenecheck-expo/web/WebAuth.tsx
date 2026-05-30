// WebAuth — shared chrome + form atoms for the desktop web auth screens
// (sign-in / sign-up / forgot-password / reset-password). Port of the
// standalone `SceneCheck Signin.html` design: a two-pane shell with a dark
// brand panel (decorative campus map + headline) on the left and the form
// on the right. The native auth screens (`app/auth/*.tsx`) are untouched —
// Metro serves the `.web.tsx` variants that consume these atoms on web.
//
// Themeable colors come from `useTokens()`; the brand panel is intentionally
// fixed-dark (its own palette, like `WebRail`) so it reads as the SceneCheck
// "rail" surface in every theme. Animations + the <940px brand-hide are
// injected once as a scoped <style> (inline styles can't express keyframes
// or media queries).

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { WebIcon, type WebIconName } from './WebIcon';

// Fixed brand-panel palette (dark), mirroring the design's --map-*/--rail
// tokens so the left panel is always the dark branded surface.
const BRAND = {
  rail: '#14110F',
  land: '#191510',
  park: '#222E18',
  water: '#152430',
  road: '#39301F',
  build: '#241D14',
  pinMute: '#6E6453',
  primary: '#FF5B47',
  accentBlue: '#2E7BFF',
  accentFriend: '#1A1714',
  good: '#2BB673',
  surface: '#FFFBF5',
  card: '#FFFFFF',
  line: '#ECE3D2',
  ink: '#14110F',
  ink2: '#4D453E',
  ink3: '#8A8077',
} as const;

const AUTH_STYLE = `
@keyframes scauth-pulse { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(2.3); opacity: 0; } }
@keyframes scauth-spin { to { transform: rotate(360deg); } }
.scauth-pulse { animation: scauth-pulse 2.4s ease-out infinite; }
.scauth-spin { animation: scauth-spin 0.7s linear infinite; }
@media (max-width: 940px) { .scauth-brand { display: none !important; } }
`;

// ── Provider + eye glyphs (not in WebIcon) ───────────────────────────────
export function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.2 7.9 3l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.2 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.3A12 12 0 0 1 24 36a12 12 0 0 1-11.3-8l-6.5 5A20 20 0 0 0 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.2 5.3C39.9 35.9 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
export function AppleGlyph({ size = 18, color = BRAND.ink }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8zM14.3 5.6c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3z"/>
    </svg>
  );
}
export function EyeIcon({ open, size = 18 }: { open: boolean; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return open
    ? <svg {...p}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg {...p}><path d="M9.9 4.2A11 11 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-3.2 4.2M6.6 6.6A18 18 0 0 0 1 12s4 8 11 8a11 11 0 0 0 4-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>;
}

// ── Decorative campus map (fixed-dark, pure presentation) ─────────────────
function MapArt() {
  const W = 1000, H = 700;
  const buildings: [number, number, number, number][] = [
    [0.05,0.30,0.045,0.06],[0.11,0.33,0.032,0.05],[0.05,0.42,0.05,0.045],
    [0.30,0.16,0.05,0.045],[0.37,0.14,0.04,0.055],[0.43,0.18,0.05,0.045],
    [0.61,0.16,0.045,0.055],[0.68,0.18,0.05,0.045],[0.75,0.14,0.04,0.055],
    [0.30,0.80,0.04,0.045],[0.37,0.82,0.05,0.045],[0.43,0.80,0.04,0.055],
    [0.61,0.88,0.045,0.045],[0.68,0.86,0.05,0.045],
    [0.09,0.66,0.045,0.045],[0.14,0.69,0.04,0.045],
    [0.86,0.40,0.045,0.045],[0.90,0.45,0.035,0.045],[0.87,0.30,0.04,0.04],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      <defs>
        <pattern id="scauth-grain" width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill={BRAND.land}/>
          <circle cx="1" cy="1" r="0.4" fill="rgba(0,0,0,0.045)"/>
        </pattern>
        <radialGradient id="scauth-shade" cx="50%" cy="38%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#scauth-grain)"/>
      <path d={`M0,0 L${W*0.30},0 Q${W*0.20},${H*0.16} ${W*0.27},${H*0.28} T0,${H*0.34} Z`} fill={BRAND.water}/>
      <path d={`M${W*0.86},${H} L${W},${H} L${W},${H*0.62} Q${W*0.90},${H*0.74} ${W*0.86},${H} Z`} fill={BRAND.water}/>
      <ellipse cx={W*0.5} cy={H*0.45} rx={W*0.17} ry={H*0.15} fill={BRAND.park}/>
      <ellipse cx={W*0.5} cy={H*0.45} rx={W*0.13} ry={H*0.115} fill="rgba(0,0,0,0.06)"/>
      <path d={`M${W*0.77},${H*0.80} q${W*0.06},-${H*0.06} ${W*0.13},0 q-${W*0.035},${H*0.09} -${W*0.13},0`} fill={BRAND.park}/>
      <ellipse cx={W*0.5} cy={H*0.45} rx={W*0.26} ry={H*0.235} fill="none" stroke={BRAND.road} strokeWidth="8"/>
      <path d={`M0,${H*0.80} L${W},${H*0.75}`} stroke={BRAND.road} strokeWidth="9"/>
      <path d={`M${W*0.17},0 L${W*0.21},${H}`} stroke={BRAND.road} strokeWidth="8"/>
      <path d={`M${W*0.83},0 L${W*0.79},${H}`} stroke={BRAND.road} strokeWidth="8"/>
      <path d={`M0,${H*0.18} L${W},${H*0.22}`} stroke={BRAND.road} strokeWidth="6"/>
      <path d={`M${W*0.5},${H*0.68} L${W*0.5},${H*0.96}`} stroke={BRAND.road} strokeWidth="4"/>
      {buildings.map((b, i) => <rect key={i} x={W*b[0]} y={H*b[1]} width={W*b[2]} height={H*b[3]} rx={3} fill={BRAND.build}/>)}
      <text x={W*0.5} y={H*0.46} textAnchor="middle" fontFamily={FONT.display} fontWeight="700" fontSize={W*0.022} letterSpacing="0.18em" fill="rgba(255,255,255,0.05)">ALDRICH PARK</text>
      <rect width={W} height={H} fill="url(#scauth-shade)" pointerEvents="none"/>
    </svg>
  );
}

const BRAND_PINS = [
  { x: 31, y: 30, kind: 'friend' },
  { x: 67, y: 24, kind: 'recommended' },
  { x: 74, y: 62, kind: 'yours', star: true },
  { x: 24, y: 66, kind: 'other' },
  { x: 54, y: 50, kind: 'friend' },
] as const;
function pinAccent(kind: string) {
  return kind === 'yours' ? BRAND.primary
    : kind === 'friend' ? BRAND.accentFriend
    : kind === 'recommended' ? BRAND.accentBlue
    : BRAND.pinMute;
}
function BrandPin({ pin }: { pin: typeof BRAND_PINS[number] }) {
  const accent = pinAccent(pin.kind);
  const star = 'star' in pin && pin.star;
  return (
    <div style={{ position: 'absolute', left: pin.x + '%', top: pin.y + '%', transform: 'translate(-50%, -100%)', zIndex: star ? 20 : 10 }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: star ? 'scale(1.18)' : 'scale(1)' }}>
        {star && <div className="scauth-pulse" style={{ position: 'absolute', top: 2, width: 40, height: 40, borderRadius: '50%', background: accent, opacity: 0.3 }}/>}
        <div style={{ width: 30, height: 30, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
          background: accent, border: '3px solid rgba(255,255,255,0.92)',
          boxShadow: `0 8px 22px -4px rgba(0,0,0,0.55), 0 0 16px -2px ${accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: 'rotate(45deg)', color: 'white', display: 'flex' }}>
            {star ? <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 13 }}>★</span>
              : <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }}/>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SCMark({ size = 38 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, background: BRAND.primary,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      boxShadow: `0 10px 24px -10px color-mix(in oklab, ${BRAND.primary} 75%, transparent)` }}>
      <span style={{ fontFamily: FONT.display, fontWeight: 800, fontStretch: '72%', letterSpacing: '-0.04em', fontSize: size * 0.5, color: '#fff' }}>S</span>
    </div>
  );
}

function BrandPanel({ headline }: { headline: string }) {
  return (
    <div style={{ position: 'relative', height: '100%', minHeight: '100%', overflow: 'hidden', background: BRAND.rail }}>
      <div style={{ position: 'absolute', inset: 0 }}><MapArt/></div>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(620px 460px at 78% 16%, color-mix(in oklab, ${BRAND.primary} 26%, transparent) 0%, transparent 60%)` }}/>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(158deg, rgba(20,17,15,0.55) 0%, rgba(20,17,15,0.40) 42%, rgba(20,17,15,0.92) 100%)' }}/>

      {/* you-are-here */}
      <div style={{ position: 'absolute', left: '46%', top: '47%', transform: 'translate(-50%,-50%)' }}>
        <div className="scauth-pulse" style={{ position: 'absolute', left: '50%', top: '50%', width: 52, height: 52, marginLeft: -26, marginTop: -26, borderRadius: '50%', background: BRAND.accentBlue, opacity: 0.22 }}/>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: BRAND.accentBlue, border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}/>
      </div>
      {BRAND_PINS.map((p, i) => <BrandPin key={i} pin={p}/>)}

      {/* floating event card */}
      <div style={{ position: 'absolute', left: '60%', top: '30%', width: 232, background: BRAND.card,
        border: `1px solid ${BRAND.line}`, borderRadius: 14, boxShadow: '0 26px 60px -20px rgba(0,0,0,0.5)', padding: 13, zIndex: 25 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: BRAND.accentBlue }}/>
          <span style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.15em', fontWeight: 600, color: BRAND.accentBlue }}>RECOMMENDED</span>
        </div>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, letterSpacing: '-0.025em', fontSize: 15, lineHeight: 1.15, marginBottom: 7, color: BRAND.ink }}>Pickup Soccer @ Aldrich</div>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: BRAND.ink3, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
          <span>WED · 5:00 PM</span><span style={{ opacity: 0.5 }}>·</span><span>0.4 mi</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex' }}>
            {['#FF9E80','#7E8AA0','#9ED39A'].map((c, i) => (
              <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: `2px solid ${BRAND.card}`, marginLeft: i ? -7 : 0 }}/>
            ))}
          </div>
          <span style={{ fontFamily: FONT.mono, fontSize: 10, color: BRAND.ink2, fontWeight: 600 }}>+14 going</span>
        </div>
      </div>

      {/* LIVE chip */}
      <div style={{ position: 'absolute', right: 30, top: 36, display: 'inline-flex', alignItems: 'center', gap: 9,
        padding: '9px 14px', borderRadius: 999, background: `color-mix(in oklab, ${BRAND.card} 90%, transparent)`,
        border: `1px solid ${BRAND.line}`, boxShadow: '0 10px 26px -14px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
        <span style={{ position: 'relative', display: 'flex', width: 9, height: 9 }}>
          <span className="scauth-pulse" style={{ position: 'absolute', left: -3, top: -3, width: 15, height: 15, borderRadius: '50%', background: BRAND.good, opacity: 0.5 }}/>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: BRAND.good }}/>
        </span>
        <span style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: '0.1em', fontWeight: 600, color: BRAND.ink }}>LIVE · 9 NEARBY</span>
      </div>

      {/* wordmark */}
      <div style={{ position: 'absolute', left: 38, top: 34, display: 'flex', alignItems: 'center', gap: 12 }}>
        <SCMark size={38}/>
        <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 21, color: BRAND.surface, letterSpacing: '-0.03em' }}>SceneCheck</span>
      </div>

      {/* headline */}
      <div style={{ position: 'absolute', left: 38, right: 44, bottom: 44 }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '-0.045em', fontStretch: '75%', fontSize: 44, lineHeight: 0.98, color: BRAND.surface, marginBottom: 14, maxWidth: 440 }}>{headline}</div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'rgba(244,236,221,0.62)', maxWidth: 400 }}>
          Real plans, real people, right around you. Sign in to see who&rsquo;s hosting what near campus this week.
        </p>
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────
export function WebAuthShell({
  children,
  onBackToSignIn,
  headline = 'See what’s happening around you.',
}: {
  children: ReactNode;
  /** When set, renders the top-right "Back to sign in" affordance. */
  onBackToSignIn?: () => void;
  headline?: string;
}) {
  const t = useTokens();
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', width: '100%', background: t.surface, color: t.ink, fontFamily: FONT.body }}>
      <style>{AUTH_STYLE}</style>
      <div className="scauth-brand" style={{ position: 'relative', overflow: 'hidden', flex: '0 0 56%' }}>
        <BrandPanel headline={headline}/>
      </div>
      <div style={{ flex: '1 1 auto', position: 'relative', background: t.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', overflowY: 'auto' }}>
        {onBackToSignIn && (
          <button type="button" onClick={onBackToSignIn} style={{ position: 'absolute', top: 26, right: 30, zIndex: 5,
            display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
            fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink3 }}>
            <WebIcon name="chevron-left" size={15}/> Back to sign in
          </button>
        )}
        <div style={{ width: '100%', maxWidth: 388 }}>{children}</div>
      </div>
    </div>
  );
}

// ── Form atoms ──────────────────────────────────────────────────────────
export function FormHead({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  const t = useTokens();
  return (
    <div style={{ marginBottom: 18 }}>
      {kicker && <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.ink3, fontWeight: 500, marginBottom: 12 }}>{kicker}</div>}
      <h1 style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '-0.045em', fontStretch: '75%', margin: '0 0 8px', fontSize: 34, lineHeight: 1.02, color: t.ink }}>{title}</h1>
      {sub && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: t.ink2 }}>{sub}</p>}
    </div>
  );
}

export function AuthField({
  label, type = 'text', value, onChange, placeholder, autoComplete, trailing, onTrailing, error, onEnter, min, max,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  trailing?: ReactNode;
  onTrailing?: () => void;
  error?: string | null;
  onEnter?: () => void;
  min?: string;
  max?: string;
}) {
  const t = useTokens();
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, display: 'block', marginBottom: 7, color: error ? '#C7472F' : t.ink3 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', height: 50, borderRadius: 13, background: t.card,
        border: `1.5px solid ${error ? '#E07A63' : focus ? t.primary : t.line}`,
        boxShadow: focus ? `0 0 0 4px color-mix(in oklab, ${t.primary} 16%, transparent)` : 'none',
        transition: 'border-color 140ms ease, box-shadow 140ms ease', padding: '0 6px 0 14px' }}>
        <input type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} min={min} max={max}
          onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
          style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent',
            fontFamily: FONT.body, fontSize: 15, color: t.ink, minWidth: 0, colorScheme: 'light' }}/>
        {trailing && (
          <button type="button" onClick={onTrailing} style={{ width: 38, height: 38, borderRadius: 10, border: 'none',
            background: 'transparent', color: t.ink3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {trailing}
          </button>
        )}
      </div>
      {error && <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: '#C7472F' }}>{error}</span>}
    </label>
  );
}

export function SSOButtonRow({ onProvider }: { onProvider: (p: 'google' | 'apple') => void }) {
  const t = useTokens();
  const btn: CSSProperties = { flex: 1, height: 48, borderRadius: 13, background: t.card,
    border: `1.5px solid ${t.line}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    fontFamily: FONT.body, fontSize: 14, fontWeight: 600, color: t.ink };
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button type="button" onClick={() => onProvider('google')} style={btn}><GoogleGlyph/>Google</button>
      <button type="button" onClick={() => onProvider('apple')} style={btn}><AppleGlyph color={t.ink}/>Apple</button>
    </div>
  );
}

export function OrDivider({ label = 'or use email' }: { label?: string }) {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
      <div style={{ flex: 1, height: 1, background: t.line }}/>
      <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.ink3, fontWeight: 500 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: t.line }}/>
    </div>
  );
}

export type AuthBtnState = 'idle' | 'loading' | 'done';
export function PrimaryAuthButton({
  state, idleLabel, loadingLabel, doneLabel, onClick, idleIcon = 'arrow-up-right',
}: {
  state: AuthBtnState;
  idleLabel: string;
  loadingLabel?: string;
  doneLabel?: string;
  onClick: () => void;
  idleIcon?: WebIconName;
}) {
  const t = useTokens();
  return (
    <button type="button" onClick={onClick} disabled={state === 'loading'} style={{
      width: '100%', height: 54, borderRadius: 14, border: 'none', cursor: state === 'loading' ? 'default' : 'pointer',
      background: state === 'done' ? t.good : t.primary, color: 'white',
      fontFamily: FONT.mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      boxShadow: `0 12px 26px -10px color-mix(in oklab, ${state === 'done' ? t.good : t.primary} 72%, transparent)`,
      transition: 'background 200ms ease' }}>
      {state === 'loading' && <span className="scauth-spin" style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', display: 'inline-block' }}/>}
      {state === 'idle' && <>{idleLabel} <WebIcon name={idleIcon} size={16} strokeWidth={2.4}/></>}
      {state === 'loading' && (loadingLabel ?? idleLabel)}
      {state === 'done' && <><WebIcon name="check" size={17} strokeWidth={3}/> {doneLabel ?? idleLabel}</>}
    </button>
  );
}

export function AuthLink({ children, onClick, weight = 600 }: { children: ReactNode; onClick: () => void; weight?: number }) {
  const t = useTokens();
  return (
    <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      fontFamily: FONT.body, fontSize: 13.5, fontWeight: weight, color: t.primary, whiteSpace: 'nowrap' }}>{children}</button>
  );
}

export function AuthFootRow({ prompt, action, onAction }: { prompt: string; action: string; onAction: () => void }) {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 22 }}>
      <span style={{ fontSize: 13.5, color: t.ink3 }}>{prompt}</span>
      <AuthLink onClick={onAction} weight={700}>{action}</AuthLink>
    </div>
  );
}
