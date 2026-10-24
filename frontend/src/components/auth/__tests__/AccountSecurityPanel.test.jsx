import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
})
