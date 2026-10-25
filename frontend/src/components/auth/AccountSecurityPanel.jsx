import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { authRequest, authError, requireAuthResult, redirectToProvider, webAuthnCredential } from '../../api/auth'
import { FactorForm, authInputClass, authButtonClass, secondaryAuthButtonClass } from './AuthenticationForm'

function RecentAuthentication({ mfa, types, onVerified }) {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const finish = async result => {
        if (result.status === 200) await onVerified()
        else setError(authError(result))
    }
    return <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Confirm your identity</h3>
        <p className="text-sm text-gray-600">Verify again before changing account security.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {mfa ? <FactorForm reauthenticate types={types} onResult={finish} /> : <form className="space-y-3" onSubmit={async event => {
            event.preventDefault(); setBusy(true); setError('')
            try { await finish(await authRequest('/auth/reauthenticate', { method: 'POST', data: { password } })) }
            catch (err) { setError(err.message) }
            finally { setBusy(false); setPassword('') }
        }}>
            <label className="block text-sm font-medium">Current password<input type="password" autoComplete="current-password" autoFocus required value={password} onChange={event => setPassword(event.target.value)} className={`${authInputClass} mt-2`} /></label>
            <button disabled={busy} className={authButtonClass}>Verify password</button>
        </form>}
    </div>
}

export default function AccountSecurityPanel() {
    const [state, setState] = useState(null)
    const [error, setError] = useState(() => new URLSearchParams(window.location.search).has('providerError') ? 'Could not connect this sign-in account. Verify your identity again and use an account that is not already connected to another user.' : '')
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)
    const [reauthenticate, setReauthenticate] = useState(false)
    const [totp, setTotp] = useState(null)
    const [code, setCode] = useState('')
    const [keyName, setKeyName] = useState('')
    const [email, setEmail] = useState('')
    const [recoveryCodes, setRecoveryCodes] = useState(null)
    const pendingAction = useRef(null)
    const load = async () => {
        const [response, factors, accounts, config] = await Promise.all([
            fetch('/api/v1/auth/security/', { credentials: 'same-origin', cache: 'no-store' }),
            requireAuthResult('/account/authenticators'), requireAuthResult('/account/providers'), requireAuthResult('/config'),
        ])
        if (!response.ok) throw new Error('Could not load account security. Sign in again and retry.')
        setState({ ...(await response.json()), factors: factors.data, accounts: accounts.data, providers: config.data.socialaccount?.providers || [] })
    }
    useEffect(() => { load().catch(err => setError(err.message)) }, [])
    const run = async action => {
        setBusy(true); setError(''); setMessage('')
        try { await action(); await load() }
        catch (err) {
            if (err.status === 401 && err.result?.meta?.is_authenticated) {
                pendingAction.current = action; setReauthenticate(true)
            } else setError(err.message)
        } finally { setBusy(false) }
    }
    const showRecoveryCodes = async () => {
        const result = await requireAuthResult('/account/authenticators/recovery-codes')
        if (result.data.unused_codes) setRecoveryCodes(result.data.unused_codes)
    }
    const startTotp = async () => {
        const result = await authRequest('/account/authenticators/totp')
        if (result.status === 404 && result.meta?.secret) setTotp(result.meta)
        else if (result.status >= 400) {
            const err = new Error(authError(result)); err.status = result.status; err.result = result; throw err
        }
    }
    const factors = state?.factors || []
    const totpEnabled = factors.some(factor => factor.type === 'totp')
    const keys = factors.filter(factor => factor.type === 'webauthn')
    return <section aria-labelledby="account-security-heading" className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 id="account-security-heading" className="text-xl font-semibold text-gray-900">Account security</h2>
        <p className="mt-2 text-sm text-gray-600">Connect sign-in accounts and protect access with a second factor.</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-4 text-sm text-gray-700">{message}</p>}
        {!state ? <button type="button" className={`${secondaryAuthButtonClass} mt-4`} onClick={() => run(load)}>Load security settings</button> : reauthenticate ? <div className="mt-6">
            <RecentAuthentication mfa={state.mfaEnabled} types={factors.map(factor => factor.type)} onVerified={async () => {
                setReauthenticate(false)
                const action = pendingAction.current; pendingAction.current = null
                if (action) await run(action)
            }} />
            <button type="button" className={`${secondaryAuthButtonClass} mt-3`} onClick={() => { setReauthenticate(false); pendingAction.current = null }}>Cancel</button>
        </div> : <div className="mt-6 space-y-8">
            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Connected accounts</h3>
                {state.providers.length === 0 && <p className="text-sm text-gray-600">Apple and Google sign-in have not been configured by the operator.</p>}
                {state.accounts.map(account => <div key={`${account.provider.id}:${account.uid}`} className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-gray-700">{account.provider.name}: {account.display}</span>
                    <button type="button" disabled={busy} className={secondaryAuthButtonClass} onClick={() => run(async () => {
                        await requireAuthResult('/account/providers', { method: 'DELETE', data: { provider: account.provider.id, account: account.uid } })
                        setMessage('Sign-in account disconnected.')
                    })}>Disconnect {account.provider.name}</button>
                </div>)}
                <div className="flex flex-wrap gap-3">{state.providers.map(provider => <button key={provider.id} type="button" disabled={busy} className={secondaryAuthButtonClass} onClick={() => run(async () => {
                    // Check freshness before leaving the app; the callback repeats the server check.
                    await requireAuthResult('/account/reauthenticated')
                    await redirectToProvider(provider.id, 'connect', '/profile')
                })}>Connect {provider.name}</button>)}</div>
            </div>
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Two-factor authentication: {state.mfaEnabled ? 'enabled' : 'off'}</h3>
                <p className="text-sm text-gray-600">When enabled, a second factor is required after password, Apple and Google sign-in.</p>
                {!state.mfaConfigured && <p className="text-sm text-gray-600">Two-factor authentication needs operator configuration before it can be used.</p>}
                {!state.emailVerified && <form className="space-y-3 text-xs" onSubmit={event => {
                    event.preventDefault()
                    const address = state.accountEmail || email.trim()
                    if (!address) return
                    run(async () => {
                        const addresses = await requireAuthResult('/account/email')
                        const exists = addresses.data.some(item => item.email.toLowerCase() === address.toLowerCase())
                        await requireAuthResult('/account/email', { method: exists ? 'PUT' : 'POST', data: { email: address } })
                        setMessage('Verification link sent. Open it in your email, then refresh verification status here to continue setting up two-factor authentication.')
                    })
                }}>
                    <p className="text-gray-600">Email verification is needed only to enable two-factor authentication. Request a link when you are ready to set it up.</p>
                    {state.accountEmail ? <p className="text-gray-700">Account email: {state.accountEmail}</p> : <div className="relative max-w-sm">
                        <input id="security-email" type="email" autoComplete="email" required value={email} placeholder=" " onChange={event => setEmail(event.target.value)} className="peer h-8 w-full rounded border border-gray-300 bg-white px-3 pt-1 text-xs focus:border-blue-600 focus:outline-none" />
                        <label htmlFor="security-email" className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-white px-1 text-[10px] text-gray-600 transition-all duration-150 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-xs peer-focus:top-0 peer-focus:text-[10px] motion-reduce:transition-none">Email address</label>
                    </div>}
                    <div className="flex flex-wrap gap-3">
                        <button type="submit" disabled={busy || (!state.accountEmail && !email.trim())} className="min-h-7 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Send verification link for 2FA</button>
                        <button type="button" disabled={busy} className="min-h-7 rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50" onClick={() => run(load)}>Refresh verification status</button>
                    </div>
                </form>}
                {totpEnabled ? <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-gray-700">Authenticator app connected</span>
                    <button disabled={busy} type="button" className={secondaryAuthButtonClass} onClick={() => run(async () => {
                        await requireAuthResult('/account/authenticators/totp', { method: 'DELETE' }); setTotp(null); setRecoveryCodes(null)
                    })}>Remove authenticator app</button></div> : <button disabled={busy || !state.emailVerified || !state.mfaConfigured} type="button" className={authButtonClass} onClick={() => run(startTotp)}>Set up authenticator app</button>}
                {totp && <form className="space-y-3" onSubmit={event => {
                    event.preventDefault()
                    run(async () => {
                        await requireAuthResult('/account/authenticators/totp', { method: 'POST', data: { code } })
                        setTotp(null); setCode(''); await showRecoveryCodes()
                    })
                }}>
                    <p className="text-sm text-gray-600">Scan the QR code with your authenticator, then enter its current code.</p>
                    <QRCodeSVG value={totp.totp_url} size={180} title="Authenticator setup QR code" />
                    <p className="text-sm text-gray-600">Manual setup key: <code className="break-all select-all">{totp.secret}</code></p>
                    <label className="block text-sm font-medium">Authenticator code<input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={event => setCode(event.target.value)} className={`${authInputClass} mt-2 max-w-xs`} /></label>
                    <div className="flex gap-3"><button disabled={busy} className={authButtonClass}>Activate authenticator</button><button type="button" className={secondaryAuthButtonClass} onClick={() => { setTotp(null); setCode('') }}>Cancel setup</button></div>
                </form>}
                <h4 className="font-medium text-gray-900">Passkeys and security keys</h4>
                {keys.map(key => <div key={key.id} className="flex flex-wrap items-center gap-3"><span className="text-sm text-gray-700">{key.name}</span><button type="button" disabled={busy} className={secondaryAuthButtonClass} onClick={() => run(async () => {
                    await requireAuthResult('/account/authenticators/webauthn', { method: 'DELETE', data: { authenticators: [key.id] } }); setRecoveryCodes(null)
                })}>Remove {key.name}</button></div>)}
                <label className="block max-w-sm text-sm font-medium text-gray-700">Name for new passkey or security key<input value={keyName} maxLength={100} onChange={event => setKeyName(event.target.value)} className={`${authInputClass} mt-2`} /></label>
                <button type="button" disabled={busy || !state.emailVerified || !state.mfaConfigured} className={secondaryAuthButtonClass} onClick={() => run(async () => {
                    const result = await requireAuthResult('/account/authenticators/webauthn')
                    const credential = await webAuthnCredential(result.data.creation_options, true)
                    const added = await requireAuthResult('/account/authenticators/webauthn', { method: 'POST', data: { name: keyName, credential } })
                    setKeyName('')
                    if (added.meta?.recovery_codes_generated) await showRecoveryCodes()
                })}>Add passkey or security key</button>
                {state.mfaEnabled && <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Recovery codes</h4>
                    <p className="text-sm text-gray-600">{factors.find(factor => factor.type === 'recovery_codes')?.unused_code_count || 0} unused codes. Each works once if you lose your other factors.</p>
                    <button type="button" disabled={busy} className={secondaryAuthButtonClass} onClick={() => run(async () => {
                        const result = await requireAuthResult('/account/authenticators/recovery-codes', { method: 'POST' })
                        setRecoveryCodes(result.data.unused_codes)
                    })}>Replace recovery codes</button>
                    <p className="text-sm text-gray-600">Replacing codes immediately invalidates the old set. To turn off two-factor authentication, remove all authenticator apps, passkeys and security keys after verifying your identity.</p>
                </div>}
                {recoveryCodes && <div className="space-y-3" role="region" aria-label="New recovery codes">
                    <p className="font-medium text-gray-900">Save these codes now. They will only be shown once.</p>
                    <pre className="select-all whitespace-pre-wrap text-sm text-gray-900">{recoveryCodes.join('\n')}</pre>
                    <button type="button" className={secondaryAuthButtonClass} onClick={() => setRecoveryCodes(null)}>I have saved my recovery codes</button>
                </div>}
            </div>
        </div>}
    </section>
}
