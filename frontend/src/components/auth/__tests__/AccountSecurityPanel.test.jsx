import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireAuthResult } from '../../../api/auth'

import AccountSecurityPanel from '../AccountSecurityPanel'

vi.mock('../../../api/auth', () => ({
    requireAuthResult: vi.fn(async path => ({ data: path === '/config' ? { socialaccount: { providers: [] } } : [] })),
    authRequest: vi.fn(),
    authError: vi.fn(),
    redirectToProvider: vi.fn(),
    webAuthnCredential: vi.fn(),
}))

describe('AccountSecurityPanel provider callback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        requireAuthResult.mockImplementation(async path => ({ data: path === '/config' ? { socialaccount: { providers: [] } } : [] }))
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({ mfaEnabled: false, mfaConfigured: true, emailVerified: true }),
        })))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        window.history.replaceState({}, '', '/')
    })

    it.each(['linked', 'reauthenticate'])('shows the %s callback error without requiring another action', async reason => {
        window.history.replaceState({}, '', `/profile?providerError=${reason}`)
        render(<AccountSecurityPanel />)
        await screen.findByRole('heading', { name: 'Connected accounts' })
        expect(screen.getByRole('alert')).toHaveTextContent('Could not connect this sign-in account')
        expect(screen.queryByRole('heading', { name: 'Confirm your identity' })).not.toBeInTheDocument()
    })

    it('does not show a provider error on an ordinary profile visit', async () => {
        render(<AccountSecurityPanel />)
        await screen.findByRole('heading', { name: 'Connected accounts' })
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
    const unverified = (accountEmail = '') => {
        fetch.mockResolvedValue({ ok: true, json: async () => ({ mfaEnabled: false, mfaConfigured: true, emailVerified: false, accountEmail }) })
    }

    it('does not send verification mail on load and requests it only on explicit action', async () => {
        unverified('editor@example.invalid')
        requireAuthResult.mockImplementation(async path => ({ data: path === '/config' ? { socialaccount: { providers: [] } } : path === '/account/email' ? [{ email: 'editor@example.invalid' }] : [] }))
        render(<AccountSecurityPanel />)
        const send = await screen.findByRole('button', { name: 'Send verification link for 2FA' })
        expect(requireAuthResult).not.toHaveBeenCalledWith('/account/email', expect.anything())
        expect(screen.getByRole('button', { name: 'Set up authenticator app' })).toBeDisabled()
        fireEvent.click(send)
        await waitFor(() => expect(requireAuthResult).toHaveBeenCalledWith('/account/email', { method: 'PUT', data: { email: 'editor@example.invalid' } }))
        expect(await screen.findByRole('status')).toHaveTextContent('Verification link sent')
    })

    it('requires an address before requesting verification for an account without one', async () => {
        unverified()
        render(<AccountSecurityPanel />)
        const send = await screen.findByRole('button', { name: 'Send verification link for 2FA' })
        expect(send).toBeDisabled()
        fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'new@example.invalid' } })
        fireEvent.click(send)
        await waitFor(() => expect(requireAuthResult).toHaveBeenCalledWith('/account/email', { method: 'POST', data: { email: 'new@example.invalid' } }))
        expect(await screen.findByRole('status')).toHaveTextContent('Email address added. Check your inbox')
        expect(screen.getByRole('status')).not.toHaveTextContent('Verification link sent')
    })

    it('enables factor setup after refreshing a completed email verification', async () => {
        unverified('editor@example.invalid')
        render(<AccountSecurityPanel />)
        const refresh = await screen.findByRole('button', { name: 'Refresh verification status' })
        expect(screen.getByRole('button', { name: 'Set up authenticator app' })).toBeDisabled()
        fetch.mockResolvedValue({ ok: true, json: async () => ({ mfaEnabled: false, mfaConfigured: true, emailVerified: true, accountEmail: 'editor@example.invalid' }) })
        fireEvent.click(refresh)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Set up authenticator app' })).toBeEnabled())
    })

})
