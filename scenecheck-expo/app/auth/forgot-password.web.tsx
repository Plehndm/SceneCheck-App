// Forgot password (web) — two-pane brand/form design (web/WebAuth). Wires
// api.requestPasswordReset (Supabase resetPasswordForEmail; the recovery
// link lands on /auth/reset-password). On success it flips to the
// "check your inbox" confirmation, mirroring native `forgot-password.tsx`.

import { useState } from 'react';
import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { WebIcon } from '@/web/WebIcon';
import {
  WebAuthShell, FormHead, AuthField, PrimaryAuthButton, AuthFootRow,
} from '@/web/WebAuth';

export default function ForgotPasswordWeb() {
  const t = useTokens();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'sent'>('idle');
  const showToast = useStore(s => s.showToast);

  const send = async (isResend = false) => {
    const trimmed = email.trim();
    if (!trimmed) { setErr('Enter your email.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) { setErr('That doesn’t look like an email.'); return; }
    setErr(null);
    if (!isResend) setState('loading');
    try {
      await api.requestPasswordReset(trimmed);
      setState('sent');
      showToast({ message: isResend ? 'Recovery email re-sent.' : 'Recovery email sent — check your inbox.', kind: 'success', duration: 6000 });
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : "Couldn't send recovery email.", kind: 'error' });
      setState('idle');
    }
  };

  return (
    <WebAuthShell onBackToSignIn={() => router.replace('/auth/sign-in' as never)}>
      {state === 'sent' ? (
        <>
          <div style={{ width: 60, height: 60, borderRadius: 18, marginBottom: 22,
            background: `color-mix(in oklab, ${t.good} 14%, ${t.card})`,
            border: `1.5px solid color-mix(in oklab, ${t.good} 40%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WebIcon name="mail" size={26} color={t.good}/>
          </div>
          <FormHead title="Check your inbox"/>
          <p style={{ margin: '0 0 8px', fontSize: 14.5, lineHeight: 1.5, color: t.ink2 }}>
            We sent a recovery link to <strong style={{ color: t.ink }}>{email.trim()}</strong>. The link signs you in temporarily so you can set a new password.
          </p>
          <p style={{ margin: '0 0 24px', fontSize: 13, lineHeight: 1.5, color: t.ink3 }}>
            Didn&rsquo;t get it? Check your spam folder, or{' '}
            <button type="button" onClick={() => send(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.primary, fontWeight: 600 }}>resend it</button>.
          </p>
          <PrimaryAuthButton state="idle" idleLabel="Back to sign in" idleIcon="back" onClick={() => router.replace('/auth/sign-in' as never)}/>
        </>
      ) : (
        <>
          <FormHead kicker="Forgot password" title="Reset your password" sub="Enter your account email and we’ll send you a recovery link."/>
          <AuthField label="Email" type="email" value={email} placeholder="you@uci.edu" autoComplete="email"
            onChange={(v) => { setEmail(v); setErr(null); }} error={err} onEnter={() => send()}/>
          <div style={{ marginTop: 22 }}>
            <PrimaryAuthButton state={state === 'loading' ? 'loading' : 'idle'} idleLabel="Send recovery email" loadingLabel="Sending…" idleIcon="send" onClick={() => send()}/>
          </div>
          <AuthFootRow prompt="Remembered it?" action="Sign in" onAction={() => router.replace('/auth/sign-in' as never)}/>
        </>
      )}
    </WebAuthShell>
  );
}
