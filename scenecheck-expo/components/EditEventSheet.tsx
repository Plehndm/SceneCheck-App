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
  const [cap, setCap] = useState(event.cap);
  const [saving, setSaving] = useState(false);

  // Reset local form whenever the sheet (re-)opens onto a different
  // event id, so navigating between hosted events doesn't carry stale
  // edits across.
  useEffect(() => {
    if (visible) {
      setTitle(event.title);
      setWhen(event.when);
      setWhere(event.where);
      setCap(event.cap);
      setSaving(false);
    }
  }, [visible, event.id, event.title, event.when, event.where, event.cap]);

  const handleSave = async () => {
    setSaving(true);
    const patch = { title, where, cap };
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
