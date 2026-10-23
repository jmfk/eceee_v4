import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authRequest, authError } from '../../api/auth'
import { authInputClass, authButtonClass } from './AuthenticationForm'

export default function PasswordRecoveryForm({ query }) {
    const [value, setValue] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)
    const key = query.get('resetKey')
    const emailKey = query.get('emailKey')
    return <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError('')
        try {
            const path = emailKey ? '/auth/email/verify' : key ? '/auth/password/reset' : '/auth/password/request'
            const data = emailKey ? { key: emailKey } : key ? { key, password: value } : { email: value }
            const result = await authRequest(path, { method: 'POST', data })
            if (result.status >= 400 && result.status !== 401) throw new Error(authError(result))
            if (result.status === 401 && !result.data?.flows) throw new Error(authError(result))
            setMessage(emailKey ? 'Email verified. Sign in to continue.' : key ? 'Password updated. Sign in and complete two-factor verification if enabled.' : 'If this account exists, password reset instructions have been sent.')
            setValue('')
        } catch (err) { setError(err.message) }
        finally { setBusy(false) }
    }}>
        <h2 className="text-xl font-semibold">{emailKey ? 'Verify email' : key ? 'Set a new password' : 'Reset password'}</h2>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message ? <p role="status" className="text-sm text-gray-700">{message}</p> : <>
            {!emailKey && <label className="block text-sm font-medium">{key ? 'New password' : 'Account email'}
                <input required type={key ? 'password' : 'email'} autoComplete={key ? 'new-password' : 'email'} value={value} onChange={event => setValue(event.target.value)} className={`${authInputClass} mt-2`} />
            </label>}
            <button disabled={busy} className={authButtonClass}>{emailKey ? 'Verify email' : key ? 'Save password' : 'Send reset instructions'}</button>
        </>}
        <Link to="/login" className="block text-sm text-blue-700 underline">Back to sign in</Link>
    </form>
}
