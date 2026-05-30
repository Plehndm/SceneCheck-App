// Sign in (web) — two-pane brand/form design (web/WebAuth). Same Supabase
// wiring + behaviors as the native `sign-in.tsx`: api.signIn, the
// confirm-email / confirmed banner from the ?confirmEmail / ?confirmed
// params, the resend-confirmation affordance, and the friendly rewrite of
// Supabase's terse auth errors. SSO buttons are visual placeholders (the
// project has no OAuth provider configured) — they surface an info toast.

import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { WebIcon } from '@/web/WebIcon';
import {
  WebAuthShell, FormHead, AuthField, SSOButtonRow, OrDivider,
  PrimaryAuthButton, AuthLink, AuthFootRow, EyeIcon, type AuthBtnState,
} from '@/web/WebAuth';

export default function SignInWeb() {
  const t = useTokens();
  const params = useLocalSearchParams<{ confirmEmail?: string; confirmed?: string; email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errs, setErrs] = useState<{ email?: string | null; password?: string | null }>({});
  const [state, setState] = useState<AuthBtnState>('idle');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [banner, setBanner] = useState<'check-email' | 'confirmed' | null>(() => {
    if (params.confirmEmail === '1') return 'check-email';
    if (params.confirmed === '1') return 'confirmed';
    return null;
  });
  const showToast = useStore(s => s.showToast);

  const submit = async () => {
    const e: typeof errs = {};
    if (!email.trim()) e.email = 'Enter your email.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = 'That doesn’t look like an email.';
    if (!password) e.password = 'Enter your password.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setState('loading');
    setNeedsConfirm(false);
    try {
      await api.signIn(email, password);
      router.replace('/(tabs)' as never);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Sign-in failed.';
      const isConfirmIssue = /email.+not.+confirm/i.test(raw);
      const isBadCreds = /invalid.*(login|credential)/i.test(raw) || /incorrect/i.test(raw);
      const friendly = isConfirmIssue
        ? 'Email not confirmed yet — check your inbox for the link, or resend below.'
        : isBadCreds
          ? 'Your email and/or password might be incorrect.'
          : raw;
      showToast({ message: friendly, kind: 'error', duration: 8000 });
      setNeedsConfirm(isConfirmIssue);
      setState('idle');
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
      showToast({ message: 'Confirmation email re-sent. Give it a minute and check spam too.', kind: 'success', duration: 6000 });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Couldn't resend.", kind: 'error' });
    } finally {
      setResending(false);
    }
  };

  return (
    <WebAuthShell>
      {banner && (
        <div style={{ padding: 14, marginBottom: 18, borderRadius: 12,
          background: banner === 'confirmed' ? t.good + '1F' : t.warn + '24',
          border: `1px solid ${banner === 'confirmed' ? t.good + '4F' : t.warn + '5C'}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, flexShrink: 0,
              background: banner === 'confirmed' ? t.good : t.warn,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WebIcon name={banner === 'confirmed' ? 'check' : 'mail'} size={14} color="white"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: t.ink }}>
                {banner === 'confirmed' ? 'Email confirmed' : 'Confirm your email'}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: t.ink2 }}>
                {banner === 'confirmed'
                  ? 'You can sign in now.'
                  : 'Account created. Click the confirmation link we just sent you, then come back here to sign in. Email not arriving? Resend it below.'}
              </div>
            </div>
            <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.ink3, padding: 0 }}>
              <WebIcon name="x" size={14}/>
            </button>
          </div>
          {banner === 'check-email' && (
            <button type="button" onClick={handleResend} disabled={resending}
              style={{ marginTop: 12, padding: '8px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: t.ink, color: t.card, opacity: resending ? 0.6 : 1,
                fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
              {resending ? 'RESENDING…' : 'RESEND CONFIRMATION EMAIL'}
            </button>
          )}
        </div>
      )}

      <FormHead kicker="Welcome back" title="Sign in to SceneCheck"
        sub={api.isMock() ? 'Mock mode — any credentials work.' : 'Pick up where you left off — your events, friends, and chats are waiting.'}/>
      <SSOButtonRow onProvider={(p) => showToast({ message: `${p === 'google' ? 'Google' : 'Apple'} sign-in isn’t set up yet — use email for now.`, kind: 'info' })}/>
      <OrDivider/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <AuthField label="Email" type="email" value={email} placeholder="you@uci.edu" autoComplete="email"
          onChange={(v) => { setEmail(v); setErrs(s => ({ ...s, email: null })); }} error={errs.email} onEnter={submit}/>
        <AuthField label="Password" type={show ? 'text' : 'password'} value={password} placeholder="Your password" autoComplete="current-password"
          onChange={(v) => { setPassword(v); setErrs(s => ({ ...s, password: null })); }} error={errs.password} onEnter={submit}
          trailing={<EyeIcon open={show}/>} onTrailing={() => setShow(s => !s)}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '15px 0 22px' }}>
        <button type="button" onClick={() => setRemember(r => !r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 9,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: FONT.body, fontSize: 13.5, color: t.ink2 }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${remember ? t.primary : t.line}`,
            background: remember ? t.primary : t.card, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms ease' }}>
            {remember && <WebIcon name="check" size={13} color={t.primaryInk} strokeWidth={3}/>}
          </span>
          Keep me signed in
        </button>
        <AuthLink onClick={() => router.push('/auth/forgot-password' as never)}>Forgot password?</AuthLink>
      </div>
      <PrimaryAuthButton state={state} idleLabel="Sign in" loadingLabel="Signing in…" onClick={submit}/>
      {needsConfirm && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button type="button" onClick={handleResend} disabled={resending}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: resending ? t.ink3 : t.ink2,
              fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
            {resending ? 'RESENDING…' : 'RESEND CONFIRMATION EMAIL'}
          </button>
        </div>
      )}
      <AuthFootRow prompt="New to SceneCheck?" action="Create an account" onAction={() => router.push('/auth/sign-up' as never)}/>
    </WebAuthShell>
  );
}
