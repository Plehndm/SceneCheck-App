// EditProfileSheet (web) — centered floating modal, the desktop-tailored
// counterpart to the native bottom-sheet `EditProfileSheet.tsx`. Same fields
// (display name / username / bio) and the same save path
// (api.updateProfile → setMe), including the UNIQUE-username collision
// rewrite. Backdrop click + Escape dismiss.

import { useEffect, useState, type CSSProperties } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { WebIcon } from '@/web/WebIcon';
import type { Account } from '@/types/domain';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function EditProfileSheet({ visible, onClose }: Props) {
  const t = useTokens();
  const me = useStore(s => s.me);
  const setMe = useStore(s => s.setMe);
  const showToast = useStore(s => s.showToast);

  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username ?? '');
  const [bio, setBio] = useState(me.bio ?? '');
  const [saving, setSaving] = useState(false);

  // Reset local fields whenever the modal (re-)opens.
  useEffect(() => {
    if (visible) {
      setName(me.name);
      setUsername(me.username ?? '');
      setBio(me.bio ?? '');
      setSaving(false);
    }
  }, [visible, me.name, me.username, me.bio]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { showToast({ message: 'Display name is required.', kind: 'error' }); return; }
    const trimmedUsername = username.trim();
    if (!trimmedUsername) { showToast({ message: 'Username is required.', kind: 'error' }); return; }
    const trimmedBio = bio.trim();
    const nameChanged = trimmedName !== me.name;
    const usernameChanged = trimmedUsername !== (me.username ?? '');
    const bioChanged = trimmedBio !== (me.bio ?? '');
    if (!nameChanged && !usernameChanged && !bioChanged) { onClose(); return; }
    const patch: Partial<Account> = {};
    if (nameChanged) patch.name = trimmedName;
    if (usernameChanged) patch.username = trimmedUsername;
    if (bioChanged) patch.bio = trimmedBio;
    setSaving(true);
    try {
      await api.updateProfile(patch);
      setMe(patch);
      showToast({ message: 'Profile updated.', kind: 'success' });
      onClose();
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      const raw = e instanceof Error ? e.message : '';
      const isDupUsername = code === '23505' || /duplicate|unique|already/i.test(raw);
      showToast({
        message: isDupUsername ? `@${trimmedUsername} is already taken — try another.` : raw || "Couldn't update profile.",
        kind: 'error',
      });
      setSaving(false);
    }
  };

  const fieldWrap: CSSProperties = { display: 'flex', alignItems: 'center', height: 46, background: t.surface,
    border: `1px solid ${t.line}`, borderRadius: 12, padding: '0 12px' };
  const input: CSSProperties = { flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent',
    fontFamily: FONT.body, fontSize: 14.5, color: t.ink, minWidth: 0 };
  const labelCap: CSSProperties = { fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
    fontWeight: 600, color: t.ink3, display: 'block', marginBottom: 6 };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
          background: t.card, borderRadius: 20, border: `1px solid ${t.line}`,
          boxShadow: '0 32px 80px -24px rgba(0,0,0,0.55)', padding: 24, fontFamily: FONT.body, color: t.ink }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: t.primarySoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WebIcon name="edit" size={18} color={t.primary} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', color: t.ink3 }}>EDIT PROFILE</div>
            <div style={{ fontFamily: FONT.display, fontWeight: 800, letterSpacing: '-0.03em', fontSize: 22, lineHeight: 1.05, color: t.ink }}>{me.name || 'You'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.line}`, background: t.card,
              cursor: 'pointer', color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WebIcon name="x" size={16} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <span style={labelCap}>Display name</span>
          <div style={fieldWrap}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" style={input} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <span style={labelCap}>Username</span>
          <div style={fieldWrap}>
            <span style={{ color: t.ink3, fontSize: 14.5, marginRight: 2 }}>@</span>
            <input value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username" autoComplete="off" style={input} />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={labelCap}>Bio</span>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.ink3 }}>{bio.length}/160</span>
          </div>
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} placeholder="A line about you"
            rows={3} style={{ ...input, height: 'auto', minHeight: 72, padding: '10px 12px', resize: 'vertical',
              background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, width: '100%', lineHeight: 1.45 }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 13,
            border: `1px solid ${t.line}`, background: t.card, cursor: 'pointer', color: t.ink,
            fontFamily: FONT.mono, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            CANCEL
          </button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 2, height: 48, borderRadius: 13,
            border: 'none', background: t.primary, cursor: saving ? 'default' : 'pointer', color: t.primaryInk, opacity: saving ? 0.6 : 1,
            fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {saving ? 'SAVING…' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </div>
  );
}
