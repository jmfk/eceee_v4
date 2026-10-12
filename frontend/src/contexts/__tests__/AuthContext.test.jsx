import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

    it('uses the server workspace when another valid workspace is stale in browser storage', async () => {
        localStorage.setItem('eceee_tenant_id', 'demo')
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce({ ok: true })
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
})
