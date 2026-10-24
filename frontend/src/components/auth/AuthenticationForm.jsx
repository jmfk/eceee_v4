import { useEffect, useState } from 'react'
import { authRequest, authError, clearLegacyTokens, redirectToProvider, verifyWebAuthn } from '../../api/auth'

export const authInputClass = 'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
export const authButtonClass = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50'
export const secondaryAuthButtonClass = 'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'

export function FactorForm({ onResult, reauthenticate = false, types = ['totp', 'recovery_codes', 'webauthn'] }) {
    const [code, setCode] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const run = async action => {
        setBusy(true); setError('')
        try {
            const result = await action()
            if (result.status >= 400 && !result.data?.flows?.some(flow => flow.is_pending)) setError(authError(result))
            else await onResult(result)
        } catch (err) { setError(err.message) }
        finally { setBusy(false); setCode('') }
    }
    return <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <p className="text-sm text-gray-600">Confirm with a passkey, security key, authenticator code or an unused recovery code.</p>
        {types.some(type => ['totp', 'recovery_codes'].includes(type)) && <form onSubmit={event => {
            event.preventDefault()
            run(() => authRequest(`/auth/2fa/${reauthenticate ? 'reauthenticate' : 'authenticate'}`, { method: 'POST', data: { code } }))
        }} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Authenticator or recovery code
                <input autoFocus name="code" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} required className={`${authInputClass} mt-2`} />
            </label>
            <button disabled={busy} className={authButtonClass}>Verify code</button>
        </form>}
        {types.includes('webauthn') && <button type="button" disabled={busy} onClick={() => run(() => verifyWebAuthn(reauthenticate))} className={secondaryAuthButtonClass}>Use passkey or security key</button>}
    </div>
}

export default function AuthenticationForm({ onAuthenticated, destination = '/', allowProviderRedirects = true }) {
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [code, setCode] = useState('')
    const [pending, setPending] = useState(null)
    const [providers, setProviders] = useState([])
    const [busy, setBusy] = useState(false)
    const [ready, setReady] = useState(false)
    const [error, setError] = useState(() => {
        const query = new URLSearchParams(window.location.search)
        return query.has('providerError') || query.has('error') ? 'Could not sign in with this provider. Sign in with your existing account, then connect Apple or Google in Profile.' : ''
    })
    const handleResult = async result => {
        if (result.meta?.is_authenticated && result.status === 200) {
            clearLegacyTokens()
            await onAuthenticated()
            return
        }
        const flow = result.data?.flows?.find(item => item.is_pending)
        setPending(flow || null)
        if (!flow && result.status >= 400 && result.status !== 401) setError(authError(result))
    }
    useEffect(() => {
        let active = true
        Promise.all([authRequest('/config'), authRequest('/auth/session')]).then(async ([config, session]) => {
            if (!active) return
            setProviders(config.data?.socialaccount?.providers || [])
            await handleResult(session)
        }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setReady(true) })
        return () => { active = false }
        // Authentication transitions happen through handleResult; mounting reads OAuth's pending stage.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const submit = async event => {
        event.preventDefault(); setBusy(true); setError('')
        try {
            const isEmail = pending?.id === 'verify_email'
            const data = isEmail ? { key: code } : { username: identifier, password }
            const result = await authRequest(isEmail ? '/auth/email/verify' : '/auth/login', { method: 'POST', data })
            if (result.status === 400) setError(authError(result))
            else await handleResult(result)
        } catch (err) { setError(err.message) }
        finally { setBusy(false); setPassword(''); setCode('') }
    }
    return <div className="space-y-5">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {!ready ? <p role="status" className="text-sm text-gray-600">Checking sign-in…</p> : pending?.id === 'mfa_authenticate' ?
            <FactorForm types={pending.types} onResult={handleResult} /> : <>
                <form onSubmit={submit} className="space-y-4">
                    {pending?.id === 'verify_email' ? <>
                        <p className="text-sm text-gray-600">Enter the verification code sent to your account email.</p>
                        <label className="block text-sm font-medium text-gray-700">Email verification code
                            <input autoFocus autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)} className={`${authInputClass} mt-2`} />
                        </label>
                    </> : <>
                        <label className="block text-sm font-medium text-gray-700">Username or email
                            <input name="username" autoComplete="username" required value={identifier} onChange={event => setIdentifier(event.target.value)} className={`${authInputClass} mt-2`} />
                        </label>
                        <label className="block text-sm font-medium text-gray-700">Password
                            <input name="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className={`${authInputClass} mt-2`} />
                        </label>
                    </>}
                    <button disabled={busy} className={`${authButtonClass} w-full`}>{busy ? 'Verifying…' : pending ? 'Verify email' : 'Sign in'}</button>
                </form>
                {!pending && allowProviderRedirects && providers.map(provider => <button key={provider.id} type="button" disabled={busy} className={`${secondaryAuthButtonClass} w-full`} onClick={async () => {
                    setBusy(true)
                    try { await redirectToProvider(provider.id, 'login', destination) }
                    catch (err) { setError(err.message); setBusy(false) }
                }}>Sign in with {provider.name}</button>)}
            </>}
        {pending && <button type="button" disabled={busy} className={secondaryAuthButtonClass} onClick={async () => {
            setBusy(true)
            try { await authRequest('/auth/session', { method: 'DELETE' }); setPending(null) }
            catch (err) { setError(err.message) }
            finally { setBusy(false) }
        }}>Start again</button>}
    </div>
}
