// Bottom-sheet for editing your own profile. Currently exposes the
// display name only — bio / username / privacy can be added here later
// without restructuring the screen. Saves go through
// `api.updateProfile(fields)` (mock-mode returns the patch unchanged)
// and reflect in the Zustand `me` slice so the rest of the UI updates
// instantly.

import { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';

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
  const [saving, setSaving] = useState(false);

  // Reset the local field whenever the sheet (re-)opens, so canceling
  // and re-opening doesn't carry edits across.
  useEffect(() => {
    if (visible) {
      setName(me.name);
      setSaving(false);
    }
  }, [visible, me.name]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast({ message: 'Display name is required.', kind: 'error' });
      return;
    }
    if (trimmed === me.name) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      // updateProfile maps Account.name → profiles.name in live mode.
      // In mock mode it just echoes the patch back.
      await api.updateProfile({ name: trimmed });
      setMe({ name: trimmed });
      showToast({ message: 'Profile updated.', kind: 'success' });
      onClose();
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : "Couldn't update profile.",
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
              <SCText variant="mono" size={10} weight="600" color={t.ink3}>EDIT PROFILE</SCText>
              <SCText variant="displayTight" size={22}>{me.name || 'You'}</SCText>
            </View>
          </View>

          <View style={{ marginBottom: 12 }}>
            <SCText variant="labelCap" style={{ marginBottom: 4 }}>Display name</SCText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={t.ink3}
              autoCapitalize="words"
              autoCorrect={false}
              style={{
                height: 44,
                backgroundColor: t.surface,
                borderColor: t.line, borderWidth: 1,
                borderRadius: RADIUS.md,
                paddingHorizontal: 12,
                color: t.ink, fontSize: 14,
              }}
            />
          </View>

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
