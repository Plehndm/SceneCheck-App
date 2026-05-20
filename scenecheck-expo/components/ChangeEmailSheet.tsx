// Bottom-sheet for changing the signed-in user's email. Calls
// `api.updateEmail(newEmail)` which routes through
// `supabase.auth.updateUser({ email })`.
//
// Email confirmation is currently OFF on the hosted project (see
// PROGRESS_SNAPSHOT.md §21 for why), so the change applies without
// the user clicking links in their inbox. If the project's
// "Secure email change" setting is ever turned back on, Supabase
// will require confirmation on both addresses and the change won't
// take effect until then — the copy below stays accurate either
// way by saying "updated" rather than promising instant switchover.

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

export function ChangeEmailSheet({ visible, onClose }: Props) {
  const t = useTokens();
  const currentEmail = useStore(s => s.session?.email ?? '');
  const showToast = useStore(s => s.showToast);

  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setNewEmail('');
      setSaving(false);
    }
  }, [visible]);

  const handleSave = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed) {
      showToast({ message: 'New email is required.', kind: 'error' });
      return;
    }
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      showToast({ message: "That's already your email.", kind: 'error' });
      return;
    }
    setSaving(true);
    try {
      await api.updateEmail(trimmed);
      showToast({
        message: 'Email updated.',
        kind: 'success',
      });
      onClose();
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : "Couldn't change email.",
        kind: 'error',
      });
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => { /* swallow */ }}
          style={{
            backgroundColor: t.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30,
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 40,
            shadowOffset: { width: 0, height: -10 }, elevation: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View style={{
              width: 36, height: 36, borderRadius: RADIUS.md,
              backgroundColor: t.primarySoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <SCIcon name="mail" size={16} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <SCText variant="mono" size={10} weight="600" color={t.ink3}>CHANGE EMAIL</SCText>
              <SCText variant="displayTight" size={22} numberOfLines={1}>
                {currentEmail || 'No email on file'}
              </SCText>
            </View>
          </View>

          <View style={{
            backgroundColor: t.subtle, borderRadius: RADIUS.md,
            paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
          }}>
            <SCText size={11} color={t.ink2} style={{ lineHeight: 16 }}>
              Your sign-in email changes right away. Use the new address next time you sign in.
            </SCText>
          </View>

          <View style={{ marginBottom: 12 }}>
            <SCText variant="labelCap" style={{ marginBottom: 4 }}>New email</SCText>
            <TextInput
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="Your new email"
              placeholderTextColor={t.ink3}
              keyboardType="email-address"
              autoCapitalize="none"
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
                {saving ? 'UPDATING…' : 'UPDATE EMAIL'}
              </SCText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
