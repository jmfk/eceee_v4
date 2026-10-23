import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthenticationForm from '../AuthenticationForm'
import AccountSecurityPanel from '../AccountSecurityPanel'
import { authRequest, redirectToProvider, requireAuthResult } from '../../../api/auth'

vi.mock('../../../api/auth', () => ({
    authRequest: vi.fn(), requireAuthResult: vi.fn(), redirectToProvider: vi.fn(),
    clearLegacyTokens: vi.fn(), verifyWebAuthn: vi.fn(), webAuthnCredential: vi.fn(),
    authError: result => result.errors?.[0]?.message || 'Authentication failed',
}))

beforeEach(() => { vi.clearAllMocks() })

describe('AuthenticationForm', () => {
    it('waits for the second factor before completing login', async () => {
        const complete = vi.fn()
        authRequest.mockImplementation(async path => {
            if (path === '/config') return { status: 200, data: { socialaccount: { providers: [{ id: 'google', name: 'Google' }] } } }
            if (path === '/auth/session') return { status: 401, data: { flows: [] } }
            if (path === '/auth/login') return { status: 401, meta: { is_authenticated: false }, data: { flows: [{ id: 'mfa_authenticate', is_pending: true, types: ['totp', 'recovery_codes'] }] } }
            return { status: 200, meta: { is_authenticated: true } }
        })
        render(<AuthenticationForm onAuthenticated={complete} />)
        fireEvent.change(await screen.findByLabelText('Username or email'), { target: { value: 'editor' } })
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } })
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
        fireEvent.change(await screen.findByLabelText('Authenticator or recovery code'), { target: { value: '123456' } })
        expect(complete).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
        await waitFor(() => expect(complete).toHaveBeenCalledTimes(1))
        expect(authRequest).toHaveBeenCalledWith('/auth/2fa/authenticate', { method: 'POST', data: { code: '123456' } })
    })

    it('resumes the OAuth MFA stage after the callback', async () => {
        authRequest.mockResolvedValue({ status: 401, data: { flows: [{ id: 'mfa_authenticate', is_pending: true, types: ['webauthn'] }] } })
        render(<AuthenticationForm onAuthenticated={vi.fn()} />)
        expect(await screen.findByRole('button', { name: 'Use passkey or security key' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    })

    it('only displays configured providers and preserves the intended destination', async () => {
        authRequest.mockImplementation(async path => path === '/config' ? { status: 200, data: { socialaccount: { providers: [{ id: 'apple', name: 'Apple' }] } } } : { status: 401 })
        render(<AuthenticationForm destination="/inbox?tenant=target" onAuthenticated={vi.fn()} />)
        fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Apple' }))
        await waitFor(() => expect(redirectToProvider).toHaveBeenCalledWith('apple', 'login', '/inbox?tenant=target'))
        expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument()
    })

    it('shows invalid-code errors without authenticating', async () => {
        const complete = vi.fn()
        authRequest.mockImplementation(async path => path === '/auth/2fa/authenticate' ? { status: 400, errors: [{ message: 'Incorrect code.' }] } : { status: 401, data: { flows: [{ id: 'mfa_authenticate', is_pending: true, types: ['totp'] }] } })
        render(<AuthenticationForm onAuthenticated={complete} />)
        fireEvent.change(await screen.findByLabelText('Authenticator or recovery code'), { target: { value: 'invalid' } })
        fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect code.')
        expect(complete).not.toHaveBeenCalled()
    })
})

it('requires fresh verification before showing enrollment secrets in Profile', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ mfaEnabled: false, mfaConfigured: true, emailVerified: true }) })
    requireAuthResult.mockImplementation(async path => {
        if (path === '/account/authenticators' || path === '/account/providers') return { data: [] }
        return { data: { socialaccount: { providers: [] } } }
    })
    authRequest.mockResolvedValue({ status: 401, meta: { is_authenticated: true }, data: { flows: [{ id: 'reauthenticate' }] } })
    render(<AccountSecurityPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Set up authenticator app' }))
    expect(await screen.findByText('Confirm your identity')).toBeInTheDocument()
    expect(screen.queryByText('Manual setup key:')).not.toBeInTheDocument()
})
