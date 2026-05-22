// Bottom-sheet for editing your own profile. Currently exposes the
// display name only — bio / username / privacy can be added here later
// without restructuring the screen. Saves go through
// `api.updateProfile(fields)` (mock-mode returns the patch unchanged)
// and reflect in the Zustand `me` slice so the rest of the UI updates
// instantly.

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { RADIUS } from '@/theme/tokens';
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
  const kbHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  // Upper bound: the sheet can rise with the keyboard but never above the
  // top safe area. Clamp its height to the space between the top inset and
  // the keyboard; taller content scrolls instead of overflowing off-screen.
  const maxSheetH = winH - insets.top - kbHeight - 8;

  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio ?? '');
  const [saving, setSaving] = useState(false);

  // Reset the local fields whenever the sheet (re-)opens, so canceling
  // and re-opening doesn't carry edits across.
  useEffect(() => {
    if (visible) {
      setName(me.name);
      setBio(me.bio ?? '');
      setSaving(false);
    }
  }, [visible, me.name, me.bio]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast({ message: 'Display name is required.', kind: 'error' });
      return;
    }
    const trimmedBio = bio.trim();
    const nameChanged = trimmedName !== me.name;
    const bioChanged = trimmedBio !== (me.bio ?? '');
    if (!nameChanged && !bioChanged) {
      onClose();
      return;
    }
    // Only send what changed — `name`/`bio` are real `profiles` columns
    // (api.updateProfile upserts; mock echoes the patch back).
    const patch: Partial<Account> = {};
    if (nameChanged) patch.name = trimmedName;
    if (bioChanged) patch.bio = trimmedBio;
    setSaving(true);
    try {
      await api.updateProfile(patch);
      setMe(patch);
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
          // Raise the sheet so its bottom sits at the keyboard's top,
          // keeping the focused field (bio) visible while typing.
          paddingBottom: kbHeight,
        }}
      >
        <Pressable
          onPress={() => { /* swallow taps inside the sheet */ }}
          style={{
            backgroundColor: t.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: maxSheetH,
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 40,
            shadowOffset: { width: 0, height: -10 }, elevation: 12,
          }}
        >
         <ScrollView
           keyboardShouldPersistTaps="handled"
           showsVerticalScrollIndicator={false}
           contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30 }}
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

          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <SCText variant="labelCap">Bio</SCText>
              <SCText variant="mono" size={10} color={t.ink3}>{bio.length}/160</SCText>
            </View>
            <TextInput
              value={bio}
              onChangeText={(v) => setBio(v.slice(0, 160))}
              placeholder="A line about you"
              placeholderTextColor={t.ink3}
              multiline
              style={{
                minHeight: 72,
                backgroundColor: t.surface,
                borderColor: t.line, borderWidth: 1,
                borderRadius: RADIUS.md,
                paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
                color: t.ink, fontSize: 14, textAlignVertical: 'top',
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
         </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
