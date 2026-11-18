'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ModuleWorkspace } from '../../../frontend/src/components/modules/ModuleWorkspace';

export function Services() {
  const [session, setSession] = useState<{ id: number } | null>(null);
  const [signup, setSignup] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState('');
  useEffect(() => { setCheckoutStatus(new URLSearchParams(window.location.search).get('checkout') || ''); }, []);
  async function refresh() {
    const response = await fetch('/_allauth/browser/v1/auth/session', { cache: 'no-store', credentials: 'same-origin' });
    const result = await response.json();
    setSession(result.meta?.is_authenticated && result.data?.user ? result.data.user : null);
  }
  useEffect(() => { void refresh().catch(() => setError('Sign-in is temporarily unavailable. Please retry.')); }, []);
  async function auth(path: string, data?: object) {
    const csrfResponse = await fetch('/csrf-token/', { cache: 'no-store', credentials: 'same-origin' });
    if (!csrfResponse.ok) throw new Error('Could not prepare secure sign-in. Please retry.');
    const csrf = await csrfResponse.json();
    const response = await fetch(`/_allauth/browser/v1/auth/${path}`, { method: path === 'session' ? 'DELETE' : 'POST',
      credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf.csrfToken },
      ...(data ? { body: JSON.stringify(data) } : {}) });
    const result = await response.json();
    const flow = result.data?.flows?.find((entry: { is_pending?: boolean }) => entry.is_pending);
    if (flow && ['verify_email', 'mfa_authenticate'].includes(flow.id)) { setStep(flow.id); setOpen(true); return; }
    if (response.status >= 400) {
      const messages = result.errors?.map((entry: { message: string }) => entry.message).join(' ');
      throw new Error(messages || 'Complete email verification or the required security step on the sign-in page.');
    }
    await refresh(); setStep(''); setOpen(false);
  }
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setPending(true); setError('');
    try {
      if (step === 'verify_email') await auth('email/verify', { key: data.get('code') });
      else if (step === 'mfa_authenticate') await auth('2fa/authenticate', { code: data.get('code') });
      else await auth(signup ? 'signup' : 'login', { email: data.get('email'), password: data.get('password') });
    }
    catch (error) { setError((error as Error).message); }
    finally { setPending(false); }
  }
  return <main style={{ boxSizing: 'border-box', maxWidth: 1080, margin: '0 auto', padding: '24px 20px', fontFamily: 'Inter, system-ui, sans-serif', background: 'white', color: '#111827', minHeight: '100vh' }}>
    <a href="/">Back to site</a><h1 style={{ fontSize: 26 }}>Products and member services</h1>
    <div className="eceee-modules">
      {!session ? <><p>Sign in to buy products, view your purchases or join a conversation.</p><button type="button" onClick={() => setOpen(!open)}>Sign in or create an account</button></> : <button disabled={pending} onClick={() => { setPending(true); void auth('session').catch(error => setError(error.message)).finally(() => setPending(false)); }}>Sign out</button>}
      {error && <p role="alert" className="module-error">{error} <button type="button" onClick={() => { setStep(''); setOpen(true); }}>Try signing in again</button></p>}
      {open && <form onSubmit={signIn} className="module-form">
        {step ? <label className="module-check">{step === 'verify_email' ? 'Email verification code' : 'Authenticator or recovery code'}<input name="code" autoComplete="one-time-code" required aria-label="Verification code" /></label> : <>
          <label className="module-check">Email<input name="email" type="email" autoComplete="email" required aria-label="Email" /></label>
          <label className="module-check">Password<input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required aria-label="Password" /></label>
        </>}
        <div className="module-actions"><button className="module-primary" disabled={pending}>{step ? 'Verify code' : signup ? 'Create account' : 'Sign in'}</button>{!step && <button type="button" disabled={pending} onClick={() => setSignup(!signup)}>{signup ? 'Use an existing account' : 'Create an account'}</button>}</div>
      </form>}
      <p role="status">{checkoutStatus === 'processing' ? 'Payment is being verified. Your purchases will show the confirmed status.' : checkoutStatus === 'cancelled' ? 'Checkout was cancelled. No access has been activated by this return.' : ''}</p>
    </div>
    <ModuleWorkspace key={session?.id || 'guest'} />
  </main>;
}
