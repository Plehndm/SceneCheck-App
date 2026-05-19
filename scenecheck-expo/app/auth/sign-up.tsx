// Sign up — display name + email + password + birthdate. The
// architecture doc's FR1.3 requires age verification; we enforce
// 18+ client-side via the picker's maxDate bound (anything younger
// is greyed out and unselectable). A server-side check on the
// Supabase auth hook is still the source of truth for production.

import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCButton } from '@/components/SCAddButton';
import { SCIcon } from '@/components/SCIcon';
import { SCDatePicker } from '@/components/SCDatePicker';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';

export default function SignUpScreen() {
  const t = useTokens();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const showToast = useStore(s => s.showToast);
  const setMe = useStore(s => s.setMe);

  // 18+ gate. The picker disables any date later than this maxDate;
  // a reasonable historic floor on minDate keeps the calendar
  // bounded (no one signing up is ~150 years old).
  const { minBirthdate, maxBirthdate } = useMemo(() => {
    const now = new Date();
    const max = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
    const min = new Date(now.getFullYear() - 120, 0, 1);
    return { minBirthdate: min, maxBirthdate: max };
  }, []);

  const submit = async () => {
    if (!displayName.trim()) {
      showToast({ message: 'Display name is required.', kind: 'error' });
      return;
    }
    if (!email || !password) {
      showToast({ message: 'Email and password are required.', kind: 'error' });
      return;
    }
    if (password.length < 8) {
      showToast({ message: 'Password must be at least 8 characters.', kind: 'error' });
      return;
    }
    if (!birthdate.trim()) {
      showToast({ message: 'Pick your birthdate to continue.', kind: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await api.signUp(email, password, displayName.trim());
      // Write the name into the store directly so the profile tab
      // reflects it immediately, even before AuthBootstrap's listener
      // re-hydrates from the profiles row.
      setMe({ name: displayName.trim() });
      showToast({ message: 'Account created. Welcome!', kind: 'success' });
      router.replace('/(tabs)' as never);
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : 'Sign-up failed.',
        kind: 'error',
      });
      setSubmitting(false);
    }
  };

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [{
          position: 'absolute', top: 20, left: 20,
          width: 38, height: 38, borderRadius: RADIUS.md,
          borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
          alignItems: 'center', justifyContent: 'center',
        }, pressed && { opacity: 0.85 }]}
      >
        <SCIcon name="back" size={18} color={t.ink} />
      </Pressable>

      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <SCText variant="displayTight" size={32}>Create account</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6, textAlign: 'center' }}>
          {api.isMock() ? 'Mock-mode: any details work' : 'You must be 18 or older.'}
        </SCText>
      </View>

      <View style={{ gap: 12 }}>
        <View>
          <SCText variant="labelCap" style={{ marginBottom: 6 }}>Display name</SCText>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How should we call you?"
            placeholderTextColor={t.ink3}
            autoCapitalize="words"
            autoCorrect={false}
            style={inputStyle(t)}
          />
        </View>
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
            placeholder="At least 8 characters"
            placeholderTextColor={t.ink3}
            secureTextEntry
            style={inputStyle(t)}
          />
        </View>
        <View>
          <SCText variant="labelCap" style={{ marginBottom: 6 }}>Birthdate</SCText>
          {/* Same calendar popover as Create Event, but year-aware and
              bounded by 18+ on the upper end. Anything more recent
              than 18 years ago renders greyed + line-through and isn't
              tappable, so the validation is enforced at picker time. */}
          <SCDatePicker
            value={birthdate}
            onChange={setBirthdate}
            withYear
            minDate={minBirthdate}
            maxDate={maxBirthdate}
            placeholder="Pick your birthdate"
          />
        </View>
      </View>

      <View style={{ marginTop: 24 }}>
        <SCButton
          label={submitting ? 'Creating account…' : 'Sign up'}
          onPress={submit}
          disabled={submitting}
          size="lg"
        />
      </View>

      <View style={{ marginTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <SCText size={13} color={t.ink3}>Already have an account?</SCText>
        <Pressable onPress={() => router.push('/auth/sign-in' as never)}>
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
