// Forgot password — collects an email and asks Supabase to send a
// recovery link. The link lands on `/auth/reset-password` (computed
// from window.location.origin on web; native uses the app's URL
// scheme but needs the email opened in a browser to currently work).

import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCButton } from '@/components/SCAddButton';
import { SCIcon } from '@/components/SCIcon';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';

export default function ForgotPasswordScreen() {
  const t = useTokens();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const showToast = useStore(s => s.showToast);

  const submit = async () => {
    if (!email.trim()) {
      showToast({ message: 'Email is required.', kind: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await api.requestPasswordReset(email.trim());
      setSent(true);
      showToast({
        message: 'Recovery email sent. Check your inbox for the link.',
        kind: 'success',
        duration: 6000,
      });
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : "Couldn't send recovery email.",
        kind: 'error',
      });
      setSubmitting(false);
    }
  };

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Back"
        style={({ pressed }) => [{
          position: 'absolute', top: 20, left: 20,
          width: 38, height: 38, borderRadius: RADIUS.md,
          borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
          alignItems: 'center', justifyContent: 'center',
        }, pressed && { opacity: 0.85 }]}
      >
        <SCIcon name="back" size={18} color={t.ink} />
      </Pressable>

      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <SCText variant="displayTight" size={32}>Reset password</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6, textAlign: 'center', maxWidth: 280, lineHeight: 19 }}>
          {sent
            ? 'Check your inbox for a link. The link signs you in temporarily so you can set a new password.'
            : 'Enter your account email and we’ll send you a recovery link.'}
        </SCText>
      </View>

      {!sent && (
        <View style={{ gap: 12 }}>
          <View>
            <SCText variant="labelCap" style={{ marginBottom: 6 }}>Email</SCText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Your email"
              placeholderTextColor={t.ink3}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle(t)}
            />
          </View>
        </View>
      )}

      <View style={{ marginTop: 24 }}>
        {sent ? (
          <SCButton
            label="Back to sign in"
            onPress={() => router.replace('/auth/sign-in' as never)}
            size="lg"
          />
        ) : (
          <SCButton
            label={submitting ? 'Sending…' : 'Send recovery email'}
            onPress={submit}
            disabled={submitting}
            size="lg"
          />
        )}
      </View>

      <View style={{ marginTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <SCText size={13} color={t.ink3}>Remembered it?</SCText>
        <Pressable onPress={() => router.replace('/auth/sign-in' as never)}>
          <SCText size={13} weight="600" color={t.primary}>Sign in</SCText>
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
