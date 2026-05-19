// Sign in — email + password via api.signIn. In mock-mode (no Supabase
// env), accepts any input and lands you in the tabs. In live-mode,
// errors from Supabase auth surface as toasts.

import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const showToast = useStore(s => s.showToast);

  const submit = async () => {
    if (!email || !password) {
      showToast({ message: 'Email and password are required.', kind: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await api.signIn(email, password);
      router.replace('/(tabs)' as never);
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : 'Sign-in failed.',
        kind: 'error',
      });
      setSubmitting(false);
    }
  };

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: t.primary,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <SCText variant="displayTight" size={28} color={t.primaryInk}>SC</SCText>
        </View>
        <SCText variant="displayTight" size={32} style={{ marginTop: 18 }}>Welcome back</SCText>
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
            placeholder="you@uci.edu"
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
            placeholder="••••••••"
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

      <View style={{ marginTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <SCText size={13} color={t.ink3}>New here?</SCText>
        <Pressable onPress={() => router.push('/auth/sign-up' as never)}>
          <SCText size={13} weight="600" color={t.primary}>Create an account</SCText>
        </Pressable>
      </View>

      <View style={{ marginTop: 32, alignItems: 'center' }}>
        <Pressable onPress={() => router.replace('/(tabs)' as never)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <SCIcon name="chevron-right" size={12} color={t.ink3} />
            <SCText variant="mono" size={11} weight="600" color={t.ink3}>
              SKIP — EXPLORE AS GUEST
            </SCText>
          </View>
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
