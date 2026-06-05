// EditEventSheet (web) — centered floating modal, the desktop counterpart to
// the native bottom-sheet `EditEventSheet.tsx`. Host-only: opened from the
// "EDIT EVENT" button on the web event-detail overlay. Same fields + same save
// path as native: `api.updateEvent(id, patch)` (writes the events row, no-op in
// mock mode) then `applyEventOverride(id, patch)` (Zustand override so the UI
// updates instantly). `onSaved` lets the detail screen reload its hook.
// Backdrop click + Escape dismiss.

import { useEffect, useState, type CSSProperties } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { WebIcon } from '@/web/WebIcon';
import type { SCEvent } from '@/types/domain';

interface Props {
  visible: boolean;
  event: SCEvent;
  onClose: () => void;
  onSaved?: () => void;
}

type PriceMode = 'none' | 'free' | 'paid';

function deriveInitialPriceMode(min?: number | null, max?: number | null): PriceMode {
  if (min == null || max == null) return 'none';
  if (min === 0 && max === 0) return 'free';
  return 'paid';
}
function formatPriceForInput(v?: number | null): string {
  if (v == null) return '';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function EditEventSheet({ visible, event, onClose, onSaved }: Props) {
  const t = useTokens();
  const applyEventOverride = useStore(s => s.applyEventOverride);
  const showToast = useStore(s => s.showToast);

  const [title, setTitle] = useState(event.title);
  const [when, setWhen] = useState(event.when);
  const [where, setWhere] = useState(event.where);
  const [desc, setDesc] = useState(event.desc ?? '');
  const [cap, setCap] = useState(event.cap);
  const [priceMode, setPriceMode] = useState<PriceMode>(deriveInitialPriceMode(event.priceMin, event.priceMax));
  const [priceMinStr, setPriceMinStr] = useState(formatPriceForInput(event.priceMin));
  const [priceMaxStr, setPriceMaxStr] = useState(formatPriceForInput(event.priceMax));
  const [saving, setSaving] = useState(false);

  // Reset local form whenever the modal (re-)opens onto a (possibly different) event.
  useEffect(() => {
    if (visible) {
      setTitle(event.title);
      setWhen(event.when);
      setWhere(event.where);
      setDesc(event.desc ?? '');
      setCap(event.cap);
      setPriceMode(deriveInitialPriceMode(event.priceMin, event.priceMax));
      setPriceMinStr(formatPriceForInput(event.priceMin));
      setPriceMaxStr(formatPriceForInput(event.priceMax));
      setSaving(false);
    }
  }, [visible, event.id, event.title, event.when, event.where, event.desc, event.cap, event.priceMin, event.priceMax]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const handleSave = async () => {
    let priceMin: number | null;
    let priceMax: number | null;
    let priceCurrency: string | null;
    if (priceMode === 'none') {
      priceMin = null; priceMax = null; priceCurrency = null;
    } else if (priceMode === 'free') {
      priceMin = 0; priceMax = 0; priceCurrency = event.priceCurrency ?? 'USD';
    } else {
      const lo = parseFloat(priceMinStr);
      const hi = parseFloat(priceMaxStr || priceMinStr);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0 || hi < lo) {
        showToast({ message: 'Enter a valid price (max must be at least the min).', kind: 'error' });
        return;
      }
      priceMin = Math.round(lo * 100) / 100;
      priceMax = Math.round(hi * 100) / 100;
      priceCurrency = event.priceCurrency ?? 'USD';
    }
    setSaving(true);
    const patch = { title, where, desc, cap, priceMin, priceMax, priceCurrency };
    try {
      await api.updateEvent(event.id, patch);
      applyEventOverride(event.id, { ...patch, when });
      showToast({ message: 'Saved · attendees notified of changes.', kind: 'success' });
      onSaved?.();
      onClose();
    } catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save.",
        kind: 'error',
      });
      setSaving(false);
    }
  };

  const labelCap: CSSProperties = { fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, color: t.ink3, display: 'block', marginBottom: 6 };
  const input: CSSProperties = { width: '100%', height: 44, border: `1px solid ${t.line}`, borderRadius: 12, background: t.surface, padding: '0 12px', fontFamily: FONT.body, fontSize: 14.5, color: t.ink, outline: 'none', boxSizing: 'border-box' };
  const field: CSSProperties = { marginBottom: 14 };
  const stepBtn: CSSProperties = { width: 40, height: 40, borderRadius: 12, border: `1px solid ${t.line}`, background: t.card, cursor: 'pointer', color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit event"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: t.card, borderRadius: 20, border: `1px solid ${t.line}`, boxShadow: '0 32px 80px -24px rgba(0,0,0,0.55)', padding: 24, fontFamily: FONT.body, color: t.ink }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: t.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WebIcon name="edit" size={18} color={t.primary} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', color: t.ink3 }}>EDIT EVENT</div>
            <div style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '-0.03em', fontSize: 22, lineHeight: 1.05, color: t.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.line}`, background: t.card, cursor: 'pointer', color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <WebIcon name="x" size={16} />
          </button>
        </div>

        {/* Notice */}
        <div style={{ background: t.subtle, borderRadius: 12, padding: '10px 12px', marginBottom: 16, fontSize: 12, lineHeight: 1.45, color: t.ink2 }}>
          Attendees will get a notification when you save changes.
        </div>

        <div style={field}>
          <span style={labelCap}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
        </div>
        <div style={field}>
          <span style={labelCap}>When</span>
          <input value={when} onChange={(e) => setWhen(e.target.value)} style={input} />
        </div>
        <div style={field}>
          <span style={labelCap}>Where</span>
          <input value={where} onChange={(e) => setWhere(e.target.value)} style={input} />
        </div>
        <div style={field}>
          <span style={labelCap}>Description</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's the event about?" rows={4}
            style={{ ...input, height: 'auto', minHeight: 92, padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        {/* Capacity */}
        <div style={field}>
          <span style={labelCap}>Capacity · {cap}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={() => setCap(c => Math.max(2, c - 1))} style={stepBtn} aria-label="Decrease capacity">
              <WebIcon name="minus" size={15} />
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: FONT.display, fontSize: 20, fontWeight: 700 }}>{cap}</div>
            <button type="button" onClick={() => setCap(c => Math.min(200, c + 1))} style={stepBtn} aria-label="Increase capacity">
              <WebIcon name="plus" size={15} />
            </button>
          </div>
        </div>

        {/* Ticket price */}
        <div style={{ marginBottom: 18 }}>
          <span style={labelCap}>Ticket price</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['none', 'free', 'paid'] as const).map(mode => {
              const active = priceMode === mode;
              return (
                <button key={mode} type="button" onClick={() => setPriceMode(mode)}
                  style={{ flex: 1, height: 36, borderRadius: 12, cursor: 'pointer', border: `1px solid ${active ? t.ink : t.line}`, background: active ? t.ink : t.card, color: active ? t.card : t.ink2, fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>
                  {mode === 'none' ? 'NOT SET' : mode === 'free' ? 'FREE' : 'PAID'}
                </button>
              );
            })}
          </div>
          {priceMode === 'paid' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ ...labelCap, fontSize: 9, marginBottom: 4 }}>Min $</span>
                <input value={priceMinStr} onChange={(e) => setPriceMinStr(e.target.value)} inputMode="decimal" placeholder="10" style={input} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ ...labelCap, fontSize: 9, marginBottom: 4 }}>Max $ (optional)</span>
                <input value={priceMaxStr} onChange={(e) => setPriceMaxStr(e.target.value)} inputMode="decimal" placeholder="25" style={input} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 13, border: `1px solid ${t.line}`, background: t.card, cursor: 'pointer', color: t.ink, fontFamily: FONT.mono, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            CANCEL
          </button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 2, height: 48, borderRadius: 13, border: 'none', background: t.primary, cursor: saving ? 'default' : 'pointer', color: t.primaryInk, opacity: saving ? 0.6 : 1, fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {saving ? 'SAVING…' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </div>
  );
}
