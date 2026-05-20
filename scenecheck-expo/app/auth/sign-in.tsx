// Sign in — email + password via api.signIn. In mock-mode (no Supabase
// env), accepts any input and lands you in the tabs. In live-mode,
// errors from Supabase auth surface as toasts.

import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCIcon } from '@/components/SCIcon';
import { SCButton } from '@/components/SCAddButton';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';

export default function SignInScreen() {
  const t = useTokens();
  // Two query params route here:
  //   ?confirmEmail=1 — user just signed up; show the "check your email" banner
  //   ?confirmed=1    — user clicked the link in the email; show a success banner
  const params = useLocalSearchParams<{ confirmEmail?: string; confirmed?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [banner, setBanner] = useState<'check-email' | 'confirmed' | null>(() => {
    if (params.confirmEmail === '1') return 'check-email';
    if (params.confirmed === '1') return 'confirmed';
    return null;
  });
  const showToast = useStore(s => s.showToast);

  const submit = async () => {
    if (!email || !password) {
      showToast({ message: 'Email and password are required.', kind: 'error' });
      return;
    }
    setSubmitting(true);
    setNeedsConfirm(false);
    try {
      await api.signIn(email, password);
      router.replace('/(tabs)' as never);
    } catch (e) {
      // Surface a clearer message for the unconfirmed-email case.
      // Supabase's default error message is just "Email not confirmed",
      // which doesn't tell the user what to do next.
      const raw = e instanceof Error ? e.message : 'Sign-in failed.';
      const isConfirmIssue = /email.+not.+confirm/i.test(raw);
      const friendly = isConfirmIssue
        ? 'Email not confirmed yet — check your inbox for the link, or resend below.'
        : raw;
      showToast({ message: friendly, kind: 'error', duration: 8000 });
      setNeedsConfirm(isConfirmIssue);
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      showToast({ message: 'Enter your email above first.', kind: 'error' });
      return;
    }
    setResending(true);
    try {
      await api.resendConfirmation(email.trim());
      showToast({
        message: 'Confirmation email re-sent. Give it a minute and check spam too.',
        kind: 'success',
        duration: 6000,
      });
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : "Couldn't resend.",
        kind: 'error',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}>
      {banner && (
        <View
          accessibilityLabel={banner === 'check-email' ? 'Confirmation needed' : 'Email confirmed'}
          style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 10,
            padding: 14, marginBottom: 20, borderRadius: RADIUS.md,
            backgroundColor: banner === 'confirmed' ? t.good + '1F' : t.warn + '24',
            borderWidth: 1,
            borderColor: banner === 'confirmed' ? t.good + '4F' : t.warn + '5C',
          }}
        >
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: banner === 'confirmed' ? t.good : t.warn,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <SCIcon
              name={banner === 'confirmed' ? 'check' : 'mail'}
              size={14}
              color="white"
            />
          </View>
          <View style={{ flex: 1 }}>
            <SCText size={13} weight="700" style={{ marginBottom: 2 }}>
              {banner === 'confirmed' ? 'Email confirmed' : 'Confirm your email'}
            </SCText>
            <SCText size={12} color={t.ink2} style={{ lineHeight: 17 }}>
              {banner === 'confirmed'
                ? 'You can sign in now.'
                : 'Account created. Click the confirmation link we just sent you, then come back here to sign in.'}
            </SCText>
          </View>
          <Pressable onPress={() => setBanner(null)} accessibilityLabel="Dismiss">
            <SCIcon name="x" size={14} color={t.ink3} />
          </Pressable>
        </View>
      )}

      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: t.primary,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <SCText variant="displayTight" size={28} color={t.primaryInk}>SC</SCText>
        </View>
        <SCText variant="displayTight" size={32} style={{ marginTop: 18 }}>SceneCheck</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
          {api.isMock() ? 'Mock-mode: any credentials work' : 'Sign in to continue'}
        </SCText>
      </View>

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
        <View>
          <SCText variant="labelCap" style={{ marginBottom: 6 }}>Password</SCText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={t.ink3}
            secureTextEntry
            style={inputStyle(t)}
          />
        </View>
      </View>

      <View style={{ marginTop: 24 }}>
        <SCButton
          label={submitting ? 'Signing in…' : 'Sign in'}
          onPress={submit}
          disabled={submitting}
          size="lg"
        />
      </View>

      <View style={{ marginTop: 14, alignItems: 'center' }}>
        <Pressable onPress={() => router.push('/auth/forgot-password' as never)}>
          <SCText size={13} weight="600" color={t.primary}>Forgot password?</SCText>
        </Pressable>
      </View>

      {needsConfirm && (
        <View style={{ marginTop: 10, alignItems: 'center' }}>
          <Pressable onPress={handleResend} disabled={resending}>
            <SCText
              variant="mono"
              size={11}
              weight="700"
              color={resending ? t.ink3 : t.ink2}
              style={{ letterSpacing: 1.2 }}
            >
              {resending ? 'RESENDING…' : 'RESEND CONFIRMATION EMAIL'}
            </SCText>
          </Pressable>
        </View>
      )}

      <View style={{ marginTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <SCText size={13} color={t.ink3}>New here?</SCText>
        <Pressable onPress={() => router.push('/auth/sign-up' as never)}>
          <SCText size={13} weight="600" color={t.primary}>Create an account</SCText>
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
