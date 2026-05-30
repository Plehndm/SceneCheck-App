// Reset password (web) — the recovery-link landing, in the two-pane
// brand/form design (web/WebAuth). supabase-js auto-creates a short-lived
// session from the URL hash on load, so api.updatePassword works without a
// separate sign-in. Same session-gating + behaviors as native
// `reset-password.tsx`: show the form when a (recovery) session exists,
// otherwise offer to request a fresh link.

import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  WebAuthShell, FormHead, AuthField, PrimaryAuthButton, AuthFootRow,
  EyeIcon, type AuthBtnState,
} from '@/web/WebAuth';

type Status = 'checking' | 'ready' | 'no-session';

export default function ResetPasswordWeb() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errs, setErrs] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [state, setState] = useState<AuthBtnState>('idle');
  const [status, setStatus] = useState<Status>('checking');
  const showToast = useStore(s => s.showToast);

  useEffect(() => {
    let cancelled = false;
    if (api.isMock() || !supabase) {
      if (!cancelled) setStatus('ready');
      return () => { cancelled = true; };
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setStatus(data.session ? 'ready' : 'no-session');
    });
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    const e: typeof errs = {};
    if (!password) e.password = 'Enter a new password.';
    else if (password.length < 8) e.password = 'At least 8 characters.';
    if (password && confirm !== password) e.confirm = 'Passwords don’t match.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setState('loading');
    try {
      await api.updatePassword(password);
      showToast({ message: 'Password updated. Signed in.', kind: 'success' });
      router.replace('/(tabs)' as never);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Couldn't update password.", kind: 'error' });
      setState('idle');
    }
  };

  return (
    <WebAuthShell onBackToSignIn={() => router.replace('/auth/sign-in' as never)}>
      {status === 'no-session' ? (
        <>
          <FormHead kicker="Reset password" title="Link expired"
            sub="This recovery link expired or has already been used. Request a fresh one to set a new password."/>
          <PrimaryAuthButton state="idle" idleLabel="Request a new link" idleIcon="send"
            onClick={() => router.replace('/auth/forgot-password' as never)}/>
        </>
      ) : (
        <>
          <FormHead kicker="Reset password" title="Set a new password"
            sub="Choose a new password to finish signing back in."/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <AuthField label="New password" type={show ? 'text' : 'password'} value={password} placeholder="At least 8 characters" autoComplete="new-password"
              onChange={(v) => { setPassword(v); setErrs(s => ({ ...s, password: null })); }} error={errs.password} onEnter={submit}
              trailing={<EyeIcon open={show}/>} onTrailing={() => setShow(s => !s)}/>
            <AuthField label="Confirm password" type={show ? 'text' : 'password'} value={confirm} placeholder="Repeat the password" autoComplete="new-password"
              onChange={(v) => { setConfirm(v); setErrs(s => ({ ...s, confirm: null })); }} error={errs.confirm} onEnter={submit}/>
          </div>
          <div style={{ marginTop: 22 }}>
            <PrimaryAuthButton state={state} idleLabel="Update password" loadingLabel="Updating…" doneLabel="Updated" idleIcon="check" onClick={submit}/>
          </div>
        </>
      )}
      <AuthFootRow prompt="Done here?" action="Back to sign in" onAction={() => router.replace('/auth/sign-in' as never)}/>
    </WebAuthShell>
  );
}
