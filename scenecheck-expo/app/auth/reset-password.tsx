// Reset password — the user arrives here from a recovery link
// emailed by Supabase. supabase-js auto-creates a short-lived
// session from the URL hash on load, which lets
// `auth.updateUser({ password })` work without a separate sign-in.
//
// Flow:
//   1. Page mounts → check `auth.getSession()`.
//   2. If a session exists (recovery flow OR already signed in),
//      show the new-password form.
//   3. If no session, the link expired or the user landed here
//      directly — show a "request a new link" fallback.

import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCButton } from '@/components/SCAddButton';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { RADIUS } from '@/theme/tokens';

type Status = 'checking' | 'ready' | 'no-session';

export default function ResetPasswordScreen() {
  const t = useTokens();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>('checking');
  const showToast = useStore(s => s.showToast);

  useEffect(() => {
    let cancelled = false;
    if (api.isMock() || !supabase) {
      // Mock mode (jest / no env vars): allow the form to render so
      // the screen is testable and so a dev iterating without a
      // backend can still see the layout.
      if (!cancelled) setStatus('ready');
      return () => { cancelled = true; };
    }
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setStatus(data.session ? 'ready' : 'no-session');
    });
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
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
    setSubmitting(true);
    try {
      await api.updatePassword(password);
      showToast({ message: 'Password updated. Signed in.', kind: 'success' });
      router.replace('/(tabs)' as never);
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : "Couldn't update password.",
        kind: 'error',
      });
      setSubmitting(false);
    }
  };

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}>
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <SCText variant="displayTight" size={32}>New password</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6, textAlign: 'center', maxWidth: 280, lineHeight: 19 }}>
          {status === 'no-session'
            ? 'This link expired or has already been used. Request a fresh recovery email.'
            : 'Set a new password to finish signing back in.'}
        </SCText>
      </View>

      {status === 'no-session' ? (
        <SCButton
          label="Request a new link"
          onPress={() => router.replace('/auth/forgot-password' as never)}
          size="lg"
        />
      ) : (
        <>
          <View style={{ gap: 12 }}>
            <View>
              <SCText variant="labelCap" style={{ marginBottom: 6 }}>New password</SCText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={t.ink3}
                secureTextEntry
                style={inputStyle(t)}
              />
            </View>
            <View>
              <SCText variant="labelCap" style={{ marginBottom: 6 }}>Confirm</SCText>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat the password"
                placeholderTextColor={t.ink3}
                secureTextEntry
                style={inputStyle(t)}
              />
            </View>
          </View>
          <View style={{ marginTop: 24 }}>
            <SCButton
              label={submitting ? 'Updating…' : 'Update password'}
              onPress={submit}
              disabled={submitting || status !== 'ready'}
              size="lg"
            />
          </View>
        </>
      )}

      <View style={{ marginTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <Pressable onPress={() => router.replace('/auth/sign-in' as never)}>
          <SCText size={13} weight="600" color={t.primary}>Back to sign in</SCText>
        </Pressable>
      </View>
    </Screen>
  );
}

function inputStyle(t: ReturnType<typeof useTokens>) {
  return {
    height: 48,
    backgroundColor: t.card,
    borderColor: t.line,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    color: t.ink,
    fontSize: 15,
  };
}
