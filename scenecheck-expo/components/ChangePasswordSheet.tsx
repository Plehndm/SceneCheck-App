// Bottom-sheet for changing the signed-in user's password. Calls
// `api.updatePassword(newPassword)` which wraps
// `supabase.auth.updateUser({ password })`. The session token is
// the auth gate; no current-password challenge by default (Supabase
// projects can flip the "Secure password change" setting to require
// re-auth — when on, our wrapper will surface the resulting error).

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

export function ChangePasswordSheet({ visible, onClose }: Props) {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setConfirm('');
      setSaving(false);
    }
  }, [visible]);

  const handleSave = async () => {
    if (!password) {
      showToast({ message: 'New password is required.', kind: 'error' });
      return;
    }
    if (password.length < 8) {
      showToast({ message: 'Password must be at least 8 characters.', kind: 'error' });
      return;
    }
    if (password !== confirm) {
      showToast({ message: "Passwords don't match.", kind: 'error' });
      return;
    }
    setSaving(true);
    try {
      await api.updatePassword(password);
      showToast({ message: 'Password updated.', kind: 'success' });
      onClose();
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : "Couldn't update password.",
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
              <SCIcon name="lock" size={16} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <SCText variant="mono" size={10} weight="600" color={t.ink3}>CHANGE PASSWORD</SCText>
              <SCText variant="displayTight" size={22}>Set a new one</SCText>
            </View>
          </View>

          <View style={{ marginBottom: 12 }}>
            <SCText variant="labelCap" style={{ marginBottom: 4 }}>New password</SCText>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={t.ink3}
              secureTextEntry
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
            <SCText variant="labelCap" style={{ marginBottom: 4 }}>Confirm</SCText>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat the password"
              placeholderTextColor={t.ink3}
              secureTextEntry
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
                {saving ? 'UPDATING…' : 'UPDATE PASSWORD'}
              </SCText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
