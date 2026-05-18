// SceneCheck — heuristic-fix additions
// Toast host, first-run onboarding tour, confirm dialogs, inline help tip,
// skeleton + error/retry surfaces. Mounted by app.jsx.

const { useState: useStateX, useEffect: useEffectX, useRef: useRefX, useMemo: useMemoX } = React;

// ─── TOAST HOST ─────────────────────────────────────────────
// A tiny imperative toast bus: components anywhere call window.scToast(...)
// and a single host renders the stack. Auto-dismisses; supports an action.
function ToastHost() {
  const [toasts, setToasts] = useStateX([]);
  useEffectX(() => {
    let id = 0;
    window.scToast = (opts) => {
      const t = {
        id: ++id,
        message: typeof opts === 'string' ? opts : opts.message,
        kind: (typeof opts === 'object' && opts.kind) || 'info', // info | success | error
        action: typeof opts === 'object' ? opts.action : null,    // {label, onClick}
        duration: (typeof opts === 'object' && opts.duration) || 3600,
      };
      setToasts(prev => [...prev, t]);
      if (t.duration > 0) {
        setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), t.duration);
      }
      return t.id;
    };
    window.scToastDismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));
    return () => { delete window.scToast; delete window.scToastDismiss; };
  }, []);
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, bottom: 120, zIndex: 90,
      display: 'flex', flexDirection: 'column-reverse', gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const tone = t.kind === 'success'
          ? { bg: 'var(--good)',    fg: 'white' }
          : t.kind === 'error'
          ? { bg: '#C73B2B',         fg: 'white' }
          : { bg: 'var(--ink)',      fg: 'var(--card)' };
        return (
          <div key={t.id} style={{
            pointerEvents: 'auto',
            background: tone.bg, color: tone.fg,
            borderRadius: 14, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 12px 30px -10px rgba(0,0,0,0.45)',
            animation: 'fadeIn 220ms ease both',
            fontSize: 13, lineHeight: 1.3,
          }}>
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.action && (
              <button onClick={() => { t.action.onClick(); setToasts(p => p.filter(x => x.id !== t.id)); }}
                className="press" style={{
                  background: 'rgba(255,255,255,0.18)', color: tone.fg, border: 'none',
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                  padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
                }}>{t.action.label}</button>
            )}
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="press"
              style={{ background: 'transparent', border: 'none', color: tone.fg, opacity: 0.7, cursor: 'pointer', display: 'flex' }}>
              <SCIcon name="x" size={14}/>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── CONFIRM DIALOG ─────────────────────────────────────────
// Generic bottom-sheet confirm. Triggered by setting a config object;
// resolves to true/false via onConfirm/onCancel.
function SCConfirmDialog({ open, title, body, confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL',
                          tone = 'default', icon = 'bell', onConfirm, onCancel }) {
  if (!open) return null;
  const confirmBg = tone === 'danger' ? '#C73B2B' : 'var(--primary)';
  const confirmFg = tone === 'danger' ? 'white' : 'var(--primary-ink)';
  const iconBg    = tone === 'danger' ? 'color-mix(in oklch, #C73B2B 18%, transparent)' : 'var(--primary-soft)';
  const iconFg    = tone === 'danger' ? '#C73B2B' : 'var(--primary)';
  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, zIndex: 85,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--card)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        width: '100%', padding: '22px 20px 30px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        animation: 'slideUp 240ms ease both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12, background: iconBg, color: iconFg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SCIcon name={icon} size={18}/>
          </div>
          <div className="display-tight" style={{ fontSize: 22, lineHeight: 1.05 }}>{title}</div>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>{body}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onCancel} className="press" style={{
            flex: 1, height: 48, borderRadius: 14, border: '1px solid var(--line)',
            background: 'var(--card)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
          }}>{cancelLabel}</button>
          <button onClick={onConfirm} className="press" style={{
            flex: 1, height: 48, borderRadius: 14, border: 'none',
            background: confirmBg, color: confirmFg, cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── INLINE HELP TIP (?) ────────────────────────────────────
// Small circular ? button that pops a definition. Uses a React portal into
// the iOS screen container so the popover floats above scroll/card clipping
// and the bottom tab bar regardless of where the trigger lives in the tree.
function SCHelpTip({ title, body }) {
  const [open, setOpen] = useStateX(false);
  const [pos, setPos] = useStateX({ top: 0, left: 0, arrowLeft: 12 });
  const btnRef = useRefX(null);
  const popRef = useRefX(null);
  useEffectX(() => {
    if (!open) return;
    const screenEl = document.getElementById('sc-screen');
    if (btnRef.current && screenEl) {
      const sRect = screenEl.getBoundingClientRect();
      const bRect = btnRef.current.getBoundingClientRect();
      // Scale factor — the device sits inside a scaled wrapper, so dividing
      // by the on-screen width vs the design width recovers design pixels.
      const scale = sRect.width / 402; // design width
      const screenY = (bRect.bottom - sRect.top) / scale + 8;
      let screenX = (bRect.left - sRect.left) / scale - 8;
      const width = 240;
      // Clamp horizontally so the popover never spills out the right edge.
      const maxLeft = 402 - width - 8;
      const minLeft = 8;
      const clamped = Math.max(minLeft, Math.min(maxLeft, screenX));
      const arrowLeft = (bRect.left - sRect.left) / scale - clamped + 4;
      setPos({ top: screenY, left: clamped, arrowLeft: Math.max(8, Math.min(width - 16, arrowLeft)) });
    }
    const onDoc = (e) => {
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const screenEl = typeof document !== 'undefined' ? document.getElementById('sc-screen') : null;
  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className="press"
        aria-label="What is this?"
        style={{
          width: 18, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
          background: 'var(--subtle)', color: 'var(--ink-2)',
          fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginLeft: 6, verticalAlign: 'middle',
        }}>?</button>
      {open && screenEl && ReactDOM.createPortal(
        <div ref={popRef} style={{
          position: 'absolute', top: pos.top, left: pos.left,
          width: 240, zIndex: 9999,
          background: 'var(--ink)', color: 'var(--card)',
          borderRadius: 12, padding: 12,
          boxShadow: '0 18px 40px -12px rgba(0,0,0,0.45)',
          animation: 'fadeIn 180ms ease both',
          pointerEvents: 'auto',
        }}>
          <div style={{
            position: 'absolute', top: -6, left: pos.arrowLeft, width: 12, height: 12,
            background: 'var(--ink)', transform: 'rotate(45deg)',
          }}/>
          <div className="mono" style={{ fontSize: 9, letterSpacing: '0.16em', opacity: 0.55, fontWeight: 600, marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.45, position: 'relative' }}>{body}</div>
        </div>,
        screenEl
      )}
    </>
  );
}

// ─── ONBOARDING TOUR ────────────────────────────────────────
// 4-step coachmark sequence shown on first launch (and replayable from Tweaks).
const SC_ONBOARDING_STEPS = [
  {
    icon: 'pin',
    eyebrow: 'WELCOME',
    title: 'See your scene on the map',
    body: 'Pins show events near you, color-coded by source:',
    bullets: [
      { c: 'var(--primary)',        l: 'Your events — events you host'                  },
      { c: 'var(--accent-friend)',  l: "Friend hosting — a friend's event"              },
      { c: 'var(--accent-blue)',    l: 'Recommended — matches your interests'           },
      { c: 'var(--map-pin-mute)',   l: 'Other nearby events'                            },
    ],
  },
  {
    icon: 'globe',
    eyebrow: 'DISCOVERY RADIUS',
    title: 'Control how far you look',
    body: 'In Settings → Discovery, drag the radius slider from 0.5 to 50 miles. Smaller = hyper-local; larger = more variety. You can change this any time.',
  },
  {
    icon: 'switch',
    eyebrow: 'PERSONAL OR ORG',
    title: 'Host as yourself, or your group',
    body: 'You can run multiple accounts — your personal profile and any organizations you manage. Switch from Profile, then publish events as that account.',
  },
  {
    icon: 'plus',
    eyebrow: 'CREATE',
    title: 'Spin up an event in 4 steps',
    body: 'Tap the coral + button on Home. Add basics, set time and place, choose interest tags, and review. We\'ll warn you about conflicts before publish.',
  },
];

function SCOnboarding({ open, onClose }) {
  const [step, setStep] = useStateX(0);
  useEffectX(() => { if (open) setStep(0); }, [open]);
  if (!open) return null;
  const s = SC_ONBOARDING_STEPS[step];
  const isLast = step === SC_ONBOARDING_STEPS.length - 1;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 95,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', background: 'var(--card)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '22px 20px 28px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.25)',
        animation: 'slideUp 280ms ease both',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* progress dots */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {SC_ONBOARDING_STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 24 : 8, height: 8, borderRadius: 4,
                background: i === step ? 'var(--primary)' : 'var(--subtle)',
                transition: 'width 220ms ease, background 220ms ease',
              }}/>
            ))}
          </div>
          <button onClick={onClose} className="press" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em',
            color: 'var(--ink-3)',
          }}>SKIP</button>
        </div>

        {/* icon + eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--primary-soft)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SCIcon name={s.icon} size={22}/>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-3)', fontWeight: 600 }}>
              {s.eyebrow} · {step + 1} / {SC_ONBOARDING_STEPS.length}
            </div>
            <div className="display-tight" style={{ fontSize: 24, lineHeight: 1.05, marginTop: 2 }}>{s.title}</div>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)' }}>{s.body}</p>

        {s.bullets && (
          <div style={{
            background: 'var(--subtle)', borderRadius: 14, padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {s.bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: b.c, flexShrink: 0,
                  boxShadow: '0 0 0 2px var(--card)' }}/>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>{b.l}</span>
              </div>
            ))}
          </div>
        )}

        {/* nav */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={() => step === 0 ? onClose() : setStep(step - 1)} className="press" style={{
            flex: 1, height: 48, borderRadius: 14, border: '1px solid var(--line)',
            background: 'var(--card)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
          }}>{step === 0 ? 'SKIP TOUR' : '← BACK'}</button>
          <button onClick={() => isLast ? onClose() : setStep(step + 1)} className="press" style={{
            flex: 2, height: 48, borderRadius: 14, border: 'none',
            background: 'var(--ink)', color: 'var(--card)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
          }}>{isLast ? "LET'S GO →" : 'NEXT →'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── SKELETON LOADER ────────────────────────────────────────
function SCSkeleton({ height = 16, width = '100%', radius = 8, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--subtle) 0%, var(--line) 50%, var(--subtle) 100%)',
      backgroundSize: '200% 100%',
      animation: 'skShimmer 1.4s ease-in-out infinite',
      ...style,
    }}/>
  );
}

function SCEventCardSkeleton() {
  return (
    <div style={{
      flex: '0 0 232px', background: 'var(--card)', border: '1px solid var(--line)',
      borderRadius: 18, padding: 14, minHeight: 168,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <SCSkeleton width={90} height={10} radius={4}/>
      <SCSkeleton width="80%" height={18} radius={5}/>
      <SCSkeleton width="60%" height={12} radius={4}/>
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between' }}>
        <SCSkeleton width={40} height={12} radius={4}/>
        <SCSkeleton width={60} height={20} radius={10}/>
      </div>
    </div>
  );
}

// ─── ERROR / RETRY STATE ────────────────────────────────────
function SCErrorState({ title = "Can't load right now", body = 'Check your connection and try again.', onRetry, compact = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, textAlign: 'center',
      padding: compact ? '20px 18px' : '36px 18px',
      background: 'var(--card)', border: '1px dashed var(--line)', borderRadius: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: 'color-mix(in oklch, var(--warn) 22%, transparent)',
        color: 'color-mix(in oklch, var(--warn) 60%, var(--ink) 40%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <SCIcon name="bell" size={20}/>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45, maxWidth: 280 }}>{body}</div>
      {onRetry && (
        <button onClick={onRetry} className="press" style={{
          marginTop: 6, height: 38, padding: '0 18px', borderRadius: 10,
          background: 'var(--ink)', color: 'var(--card)', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <SCIcon name="rotate-ccw" size={13}/> RETRY
        </button>
      )}
    </div>
  );
}

// ─── OFFLINE BANNER ─────────────────────────────────────────
function SCOfflineBanner({ visible, onRetry }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute', top: 56, left: 12, right: 12, zIndex: 70,
      background: 'var(--ink)', color: 'var(--card)',
      borderRadius: 12, padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'fadeIn 220ms ease both',
      boxShadow: '0 10px 24px -10px rgba(0,0,0,0.4)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--warn)' }}/>
      <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.06em' }}>
        OFFLINE · Some actions may fail
      </span>
      {onRetry && (
        <button onClick={onRetry} className="press" style={{
          background: 'rgba(255,255,255,0.15)', color: 'var(--card)', border: 'none',
          padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        }}>RETRY</button>
      )}
    </div>
  );
}

// Shimmer keyframes need to be registered globally (one time).
(function injectAdditionsCSS() {
  if (document.getElementById('sc-additions-css')) return;
  const s = document.createElement('style');
  s.id = 'sc-additions-css';
  s.textContent = `
    @keyframes skShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
  `;
  document.head.appendChild(s);
})();

Object.assign(window, {
  ToastHost, SCConfirmDialog, SCHelpTip, SCOnboarding,
  SCSkeleton, SCEventCardSkeleton, SCErrorState, SCOfflineBanner,
});
