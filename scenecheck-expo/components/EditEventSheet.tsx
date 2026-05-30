// Edit-event bottom sheet, ported from the legacy `EditEventSheet` in
// `legacy/src/heuristic-fixes.jsx`. Host-only: surfaces from the
// "EDIT EVENT" button on the event detail screen.
//
// Persistence has two layers since Phase 2 of the migration:
//   1. `api.updateEvent(id, patch)` — writes title / location_name /
//      capacity to the `events` table (no-op in mock mode).
//   2. `applyEventOverride(id, patch)` — Zustand override so the UI
//      reflects the change instantly without waiting for a re-fetch.
//      In mock mode this IS the persistence layer.
// `onSaved` is invoked after a successful save so the parent screen
// (event/[id].tsx) can `reload()` its `useEvent` hook and replace the
// override with the freshly-fetched DB row.

import { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';
import type { SCEvent } from '@/types/domain';

interface Props {
  visible: boolean;
  event: SCEvent;
  onClose: () => void;
  onSaved?: () => void;
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
  // Price-edit local state. `priceMode` controls which input branch the
  // sheet shows; the actual DB fields are derived from it on save.
  //   'none'  — no price specified (column nulls), no inputs visible.
  //   'free'  — host opted in to FREE (column 0/0/USD).
  //   'paid'  — host entered a price (min/max).
  // Initialised from the event's current price-column state.
  const [priceMode, setPriceMode] = useState<'none' | 'free' | 'paid'>(
    deriveInitialPriceMode(event.priceMin, event.priceMax),
  );
  const [priceMinStr, setPriceMinStr] = useState(formatPriceForInput(event.priceMin));
  const [priceMaxStr, setPriceMaxStr] = useState(formatPriceForInput(event.priceMax));
  const [saving, setSaving] = useState(false);

  // Reset local form whenever the sheet (re-)opens onto a different
  // event id, so navigating between hosted events doesn't carry stale
  // edits across.
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

  const handleSave = async () => {
    // Derive the price triple from the input mode + strings. We send
    // explicit null when the host picked 'none' so an existing price
    // can be cleared, and we validate on the client to avoid a 500
    // round-trip from the CHECK constraint when the inputs are bad.
    let priceMin: number | null;
    let priceMax: number | null;
    let priceCurrency: string | null;
    if (priceMode === 'none') {
      priceMin = null;
      priceMax = null;
      priceCurrency = null;
    } else if (priceMode === 'free') {
      priceMin = 0;
      priceMax = 0;
      priceCurrency = event.priceCurrency ?? 'USD';
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
      // `when` isn't passed to api.updateEvent — see the api.ts header.
      // It's still part of the override patch below so the local UI
      // reflects the user's typed value until a real date/time editor
      // lands.
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={() => { /* swallow taps inside the sheet */ }}
          style={{
            backgroundColor: t.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30,
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 40,
            shadowOffset: { width: 0, height: -10 }, elevation: 12,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View style={{
              width: 36, height: 36, borderRadius: RADIUS.md,
              backgroundColor: t.primarySoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <SCIcon name="edit" size={16} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <SCText variant="mono" size={10} weight="600" color={t.ink3}>EDIT EVENT</SCText>
              <SCText variant="displayTight" size={22}>{event.title}</SCText>
            </View>
          </View>

          {/* Notice strip */}
          <View style={{
            backgroundColor: t.subtle, borderRadius: RADIUS.md,
            paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
          }}>
            <SCText size={11} color={t.ink2} style={{ lineHeight: 16 }}>
              Attendees will get a notification when you save changes.
            </SCText>
          </View>

          <FormField label="Title">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={t.ink3}
              style={inputStyle(t)}
            />
          </FormField>

          <FormField label="When">
            <TextInput
              value={when}
              onChangeText={setWhen}
              placeholderTextColor={t.ink3}
              style={inputStyle(t)}
            />
          </FormField>

          <FormField label="Where">
            <TextInput
              value={where}
              onChangeText={setWhere}
              placeholderTextColor={t.ink3}
              style={inputStyle(t)}
            />
          </FormField>

          {/* Description — multi-line, auto-grows up to a sensible cap so
              the sheet doesn't push the SAVE button off the screen on a
              long edit. Larger min-height matches the create-event
              composer's description box for visual consistency. */}
          <FormField label="Description">
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="What's the event about?"
              placeholderTextColor={t.ink3}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[inputStyle(t), {
                minHeight: 96, maxHeight: 160,
                paddingTop: 10, paddingBottom: 10,
                lineHeight: 18,
              }]}
            />
          </FormField>

          {/* Capacity stepper — RN has no <input type="range">, and pulling
              in @react-native-community/slider here just for this would
              feel heavy. The +/- stepper mirrors the create-event screen's
              capacity row so the two flows feel consistent. */}
          <FormField label={`Capacity · ${cap}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={() => setCap(c => Math.max(2, c - 1))}
                style={({ pressed }) => [stepperBtn(t), pressed && { opacity: 0.85 }]}
              >
                <SCIcon name="x" size={14} color={t.ink} />
              </Pressable>
              <SCText variant="display" size={20} style={{ flex: 1, textAlign: 'center' }}>
                {cap}
              </SCText>
              <Pressable
                onPress={() => setCap(c => Math.min(200, c + 1))}
                style={({ pressed }) => [stepperBtn(t), pressed && { opacity: 0.85 }]}
              >
                <SCIcon name="plus" size={14} color={t.ink} />
              </Pressable>
            </View>
          </FormField>

          {/* Ticket price — three-mode toggle (Not specified / Free /
              Paid). Paid reveals min/max number inputs; leaving max
              blank treats it as fixed-price (max := min on save). The
              underlying DB columns require either all-null or
              consistent low/high, validated again in handleSave before
              the call. */}
          <FormField label="Ticket price">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['none', 'free', 'paid'] as const).map(mode => {
                const active = priceMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setPriceMode(mode)}
                    style={({ pressed }) => [{
                      flex: 1, height: 36,
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: active ? t.ink : t.line,
                      backgroundColor: active ? t.ink : t.card,
                      alignItems: 'center', justifyContent: 'center',
                    }, pressed && { opacity: 0.85 }]}
                  >
                    <SCText
                      variant="mono"
                      size={11}
                      weight="600"
                      color={active ? t.card : t.ink2}
                    >
                      {mode === 'none' ? 'NOT SET' : mode === 'free' ? 'FREE' : 'PAID'}
                    </SCText>
                  </Pressable>
                );
              })}
            </View>
            {priceMode === 'paid' && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <SCText variant="mono" size={9} color={t.ink3} style={{ marginBottom: 4 }}>MIN $</SCText>
                  <TextInput
                    value={priceMinStr}
                    onChangeText={setPriceMinStr}
                    placeholder="10"
                    placeholderTextColor={t.ink3}
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    style={inputStyle(t)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SCText variant="mono" size={9} color={t.ink3} style={{ marginBottom: 4 }}>MAX $ (optional)</SCText>
                  <TextInput
                    value={priceMaxStr}
                    onChangeText={setPriceMaxStr}
                    placeholder="25"
                    placeholderTextColor={t.ink3}
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    style={inputStyle(t)}
                  />
                </View>
              </View>
            )}
          </FormField>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [{
                flex: 1, height: 48, borderRadius: RADIUS.lg,
                borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
                alignItems: 'center', justifyContent: 'center',
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={12} weight="600">CANCEL</SCText>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [{
                flex: 2, height: 48, borderRadius: RADIUS.lg,
                backgroundColor: t.primary,
                alignItems: 'center', justifyContent: 'center',
                opacity: saving ? 0.6 : 1,
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={12} weight="700" color={t.primaryInk}>
                {saving ? 'SAVING…' : 'SAVE CHANGES'}
              </SCText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Initial 'none' | 'free' | 'paid' input mode derived from the event's
// current price columns. Mirrors lib/price.priceState but lifted out
// because the sheet's state initialiser runs before lib/price imports
// matter for the reducer; keeping it here avoids the circular-import
// hazard around component imports.
function deriveInitialPriceMode(
  min: number | null | undefined,
  max: number | null | undefined,
): 'none' | 'free' | 'paid' {
  if (min == null || max == null) return 'none';
  if (min === 0 && max === 0) return 'free';
  return 'paid';
}

// Seed a TextInput with the event's current price value. Stored as a
// string (RN TextInput is text-only); integers drop the .00 trailing
// zeros, fractional values keep two decimals.
function formatPriceForInput(v: number | null | undefined): string {
  if (v == null) return '';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <SCText variant="labelCap" style={{ marginBottom: 4 }}>{label}</SCText>
      {children}
    </View>
  );
}

function inputStyle(t: ReturnType<typeof useTokens>) {
  return {
    height: 44,
    backgroundColor: t.surface,
    borderColor: t.line,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    color: t.ink,
    fontSize: 14,
  };
}

function stepperBtn(t: ReturnType<typeof useTokens>) {
  return {
    width: 40, height: 40, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  };
}
