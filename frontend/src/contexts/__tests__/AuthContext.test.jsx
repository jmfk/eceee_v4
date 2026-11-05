import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from '../AuthContext'
import { getCurrentTenantId, setCurrentTenantId } from '../../utils/tenant'

const AuthState = () => {
    const { isLoading, user } = useAuth()
    return <div>{isLoading ? 'Loading' : user?.username || 'No user'}</div>
}

describe('AuthProvider workspace synchronization', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        localStorage.clear()
        setCurrentTenantId('')
    })

    afterEach(() => { vi.unstubAllEnvs() })

    it.each([true, false])('authenticates an empty CMS role without probing Pages (development=%s)', async (development) => {
        vi.stubEnv('DEV', development)
        if (!development) {
            localStorage.setItem('access_token', 'test-access')
            localStorage.setItem('refresh_token', 'test-refresh')
        }
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
            if (url === '/api/v1/utils/current-user/') return {
                ok: true,
                json: async () => ({ username: 'inbox-only', permissions: [] }),
            }
            return { ok: false, status: 403 }
        })
        const PersonalTools = () => {
            const { isLoading, isAuthenticated, user } = useAuth()
            return <div>{isLoading ? 'Loading' : isAuthenticated ? user.username : 'Login required'}</div>
        }
        render(<AuthProvider><PersonalTools /></AuthProvider>)
        expect(await screen.findByText('inbox-only')).toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/webpages/pages/', expect.anything())
    })

    it('uses the server workspace when another valid workspace is stale in browser storage', async () => {
        localStorage.setItem('eceee_tenant_id', 'demo')
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    username: 'dev_auto_user',
                    currentWorkspace: { id: 'workspace-production', identifier: 'eceee-production-copy' },
                    designerTenants: [
                        { id: 'workspace-demo', identifier: 'demo', name: 'Demo Site' },
                        {
                            id: 'workspace-production',
                            identifier: 'eceee-production-copy',
                            name: 'ECEEE Production Copy',
                        },
                    ],
                }),
            })

        render(
            <AuthProvider>
                <AuthState />
            </AuthProvider>
        )

        expect(await screen.findByText('dev_auto_user')).toBeInTheDocument()
        await waitFor(() => {
            expect(getCurrentTenantId()).toBe('eceee-production-copy')
            expect(localStorage.getItem('eceee_tenant_id')).toBeNull()
        })
    })

    it('retains the return action if a valid delegated login cannot load its workspace bootstrap', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async url => url === '/api/v1/utils/current-user/'
            ? { ok: false, status: 403 }
            : { ok: true, json: async () => ({ active: true, userPerspective: { userId: 7, username: 'restricted-user', expiresAt: 9999999999 } }) })
        const Recovery = () => {
            const { user } = useAuth()
            return <div>{user?.userPerspective ? 'Return available' : 'No recovery'}</div>
        }
        render(<AuthProvider><Recovery /></AuthProvider>)
        expect(await screen.findByText('Return available')).toBeInTheDocument()
    })

    it('rejects interrupted delegated writes instead of queueing them for administrator reauthentication', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ id: 7, username: 'reader', userPerspective: { username: 'reader' } }) })
        const reject = vi.fn()
        render(<AuthProvider><AuthState /></AuthProvider>)
        await screen.findByText('reader')
        act(() => window.dispatchEvent(new CustomEvent('session-expired', { detail: {
            config: { method: 'post', url: '/protected-write/' }, reject, resolve: vi.fn(),
        } })))
        await waitFor(() => expect(reject).toHaveBeenCalledWith(expect.any(Error)))
    })

    it('updates language without discarding an unsaved form draft', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({ username: 'editor', preferredLanguage: 'en-us' }),
        })
        const Draft = () => {
            const { language, setUser } = useAuth()
            const [draft, setDraft] = useState('')
            return <>
                <span>{language}</span>
                <input aria-label="Unsaved draft" value={draft} onChange={event => setDraft(event.target.value)} />
                <button onClick={() => setUser(user => ({ ...user, preferredLanguage: 'sv-se' }))}>Change language</button>
            </>
        }

        render(<AuthProvider><Draft /></AuthProvider>)
        expect(await screen.findByText('en-us')).toBeInTheDocument()
        fireEvent.change(screen.getByRole('textbox', { name: 'Unsaved draft' }), { target: { value: 'Keep this' } })
        fireEvent.click(screen.getByRole('button', { name: 'Change language' }))

        expect(await screen.findByText('sv-se')).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Unsaved draft' })).toHaveValue('Keep this')
        await waitFor(() => expect(document.documentElement.lang).toBe('sv-se'))
    })
})
