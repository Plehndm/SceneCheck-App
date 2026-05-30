// ConfirmDialog (web) — centered floating dialog, the desktop-tailored
// counterpart to the native bottom-sheet `ConfirmDialog.tsx`. Same store
// contract (reads `confirm` / `dismissConfirm`), so every showConfirm caller
// (sign-out from the rail, draft delete, cancel event, …) gets the floating
// popup on web. Backdrop click + Escape dismiss (= cancel).

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { WebIcon } from '@/web/WebIcon';

export function ConfirmDialog() {
  const t = useTokens();
  const cfg = useStore(s => s.confirm);
  const dismiss = useStore(s => s.dismissConfirm);

  const handleCancel = () => {
    cfg?.onCancel?.();
    dismiss();
  };

  // Escape closes (= cancel), matching the other web overlays. Effect is
  // unconditional (hooks can't be gated); it no-ops when no dialog is open.
  useEffect(() => {
    if (!cfg) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  if (!cfg) return null;

  const isDanger = cfg.tone === 'danger';
  const confirmBg = isDanger ? t.danger : t.primary;
  const confirmFg = isDanger ? '#fff' : t.primaryInk;
  const iconBg = isDanger ? t.danger + '2E' : t.primarySoft;
  const iconFg = isDanger ? t.danger : t.primary;

  const handleConfirm = () => { cfg.onConfirm(); dismiss(); };

  return (
    <div
      onClick={handleCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: t.card, borderRadius: 20,
          border: `1px solid ${t.line}`,
          boxShadow: '0 32px 80px -24px rgba(0,0,0,0.55)',
          padding: 24,
          fontFamily: FONT.body, color: t.ink,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WebIcon name={cfg.icon ?? 'bell'} size={19} color={iconFg} />
          </div>
          <div style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '-0.03em', fontSize: 22, lineHeight: 1.05, color: t.ink }}>
            {cfg.title}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: t.ink2 }}>{cfg.body}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button type="button" onClick={handleCancel} style={{ flex: 1, height: 48, borderRadius: 13,
            border: `1px solid ${t.line}`, background: t.card, cursor: 'pointer', color: t.ink,
            fontFamily: FONT.mono, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {cfg.cancelLabel ?? 'CANCEL'}
          </button>
          <button type="button" onClick={handleConfirm} style={{ flex: 1, height: 48, borderRadius: 13,
            border: 'none', background: confirmBg, cursor: 'pointer', color: confirmFg,
            fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {cfg.confirmLabel ?? 'CONFIRM'}
          </button>
        </div>
      </div>
    </div>
  );
}
