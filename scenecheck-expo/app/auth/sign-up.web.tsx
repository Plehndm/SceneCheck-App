// Create account (web) — two-pane brand/form design (web/WebAuth). Same
// Supabase wiring + behaviors as native `sign-up.tsx`:
// api.signUp(email, password, displayName, isoBirthdate, accountType), the
// 18+ gate, the dormant "check your email" fallback when confirmation is on,
// and the live-mode → /onboarding/interests redirect (mock → /(tabs)).
//
// Birthdate uses a native <input type="date">, which yields an ISO
// YYYY-MM-DD string directly — exactly what api.signUp wants — so the
// native screen's parseDateWithYear conversion isn't needed here.

import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { WebIcon } from '@/web/WebIcon';
import {
  WebAuthShell, FormHead, AuthField, SSOButtonRow, OrDivider,
  PrimaryAuthButton, AuthFootRow, EyeIcon, type AuthBtnState,
} from '@/web/WebAuth';
import type { AccountType } from '@/types/domain';

export default function SignUpWeb() {
  const t = useTokens();
  const [acct, setAcct] = useState<AccountType>('person');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [birth, setBirth] = useState('');
  const [errs, setErrs] = useState<Record<string, string | null>>({});
  const [state, setState] = useState<AuthBtnState>('idle');
  const showToast = useStore(s => s.showToast);
  const setMe = useStore(s => s.setMe);

  // 18+ upper bound + a sane 120-year lower bound, as ISO for the date input.
  const { minBirth, maxBirth } = useMemo(() => {
    const n = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      maxBirth: iso(new Date(n.getFullYear() - 18, n.getMonth(), n.getDate())),
      minBirth: iso(new Date(n.getFullYear() - 120, 0, 1)),
    };
  }, []);

  const submit = async () => {
    const e: Record<string, string | null> = {};
    if (!name.trim()) e.name = acct === 'org' ? 'Tell us the organization name.' : 'Tell us what to call you.';
    if (!email.trim()) e.email = 'Enter your email.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = 'That doesn’t look like an email.';
    if (!password) e.password = 'Choose a password.';
    else if (password.length < 8) e.password = 'At least 8 characters.';
    if (!birth) e.birth = 'Pick your birthdate.';
    else if (birth > maxBirth) e.birth = 'You must be 18 or older.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setState('loading');
    try {
      // birth is already ISO (YYYY-MM-DD) from the date input.
      const result = await api.signUp(email, password, name.trim(), birth, acct);
      setMe({ name: name.trim() });

      // Defensive fallback (dormant: confirmation is OFF on the hosted
      // project): no session means email confirmation is required.
      const hasSession = !!(result as { session?: unknown } | null)?.session;
      if (!hasSession && !api.isMock()) {
        showToast({ message: 'Check your email to confirm.', kind: 'info', duration: 6000 });
        setState('idle');
        router.replace({ pathname: '/auth/sign-in', params: { confirmEmail: '1', email: email.trim() } } as never);
        return;
      }

      setState('done');
      showToast({ message: `Welcome to SceneCheck, ${name.trim().split(' ')[0]}!`, kind: 'success' });
      // Live signups land on the interest picker first so the feed has
      // something to rank against; mock seeds skip straight to the tabs.
      if (api.isMock()) router.replace('/(tabs)' as never);
      else router.replace('/onboarding/interests' as never);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Sign-up failed.', kind: 'error' });
      setState('idle');
    }
  };

  const chips: [AccountType, string, 'profile' | 'building'][] = [
    ['person', 'Individual', 'profile'],
    ['org', 'Organization', 'building'],
  ];

  return (
    <WebAuthShell onBackToSignIn={() => router.replace('/auth/sign-in' as never)}>
      <FormHead kicker="Get started" title="Create your account"
        sub={api.isMock() ? 'Mock mode — any details work.' : 'Join what’s happening near campus. You must be 18 or older to sign up.'}/>
      <SSOButtonRow onProvider={(p) => showToast({ message: `${p === 'google' ? 'Google' : 'Apple'} sign-in isn’t set up yet — use email for now.`, kind: 'info' })}/>
      <OrDivider/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div>
          <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.ink3, fontWeight: 500, display: 'block', marginBottom: 7 }}>Account type</span>
          <div style={{ display: 'flex', gap: 10 }}>
            {chips.map(([v, label, icon]) => {
              const sel = acct === v;
              return (
                <button key={v} type="button" onClick={() => setAcct(v)} style={{ flex: 1, height: 48, borderRadius: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: sel ? `color-mix(in oklab, ${t.primary} 9%, ${t.card})` : t.card,
                  border: `1.5px solid ${sel ? t.primary : t.line}`,
                  fontFamily: FONT.body, fontSize: 14, fontWeight: sel ? 700 : 500, color: sel ? t.ink : t.ink2 }}>
                  <WebIcon name={icon} size={16} color={sel ? t.primary : t.ink3}/>{label}
                </button>
              );
            })}
          </div>
        </div>
        <AuthField label={acct === 'org' ? 'Organization name' : 'Display name'} value={name} autoComplete="name"
          placeholder={acct === 'org' ? 'e.g. Anteater Run Club' : 'How should we call you?'}
          onChange={(v) => { setName(v); setErrs(s => ({ ...s, name: null })); }} error={errs.name} onEnter={submit}/>
        <AuthField label="Email" type="email" value={email} placeholder="you@uci.edu" autoComplete="email"
          onChange={(v) => { setEmail(v); setErrs(s => ({ ...s, email: null })); }} error={errs.email} onEnter={submit}/>
        <AuthField label="Password" type={show ? 'text' : 'password'} value={password} placeholder="At least 8 characters" autoComplete="new-password"
          onChange={(v) => { setPassword(v); setErrs(s => ({ ...s, password: null })); }} error={errs.password} onEnter={submit}
          trailing={<EyeIcon open={show}/>} onTrailing={() => setShow(s => !s)}/>
        <AuthField label="Birthdate" type="date" value={birth} min={minBirth} max={maxBirth}
          onChange={(v) => { setBirth(v); setErrs(s => ({ ...s, birth: null })); }} error={errs.birth} onEnter={submit}/>
      </div>
      <div style={{ marginTop: 16 }}>
        <PrimaryAuthButton state={state} idleLabel="Create account" loadingLabel="Creating account…" doneLabel="Account created" onClick={submit}/>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11.5, lineHeight: 1.5, color: t.ink3, textAlign: 'center' }}>
        By creating an account you agree to SceneCheck&rsquo;s{' '}
        <span style={{ color: t.ink2, textDecoration: 'underline' }}>Terms</span> &amp;{' '}
        <span style={{ color: t.ink2, textDecoration: 'underline' }}>Privacy Policy</span>.
      </p>
      <AuthFootRow prompt="Already have an account?" action="Sign in" onAction={() => router.replace('/auth/sign-in' as never)}/>
    </WebAuthShell>
  );
}
