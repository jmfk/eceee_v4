import { afterEach, describe, expect, it } from 'vitest'

import { getCurrentTenantId, reconcileCurrentTenantId, setCurrentTenantId } from '../tenant'

describe('getCurrentTenantId', () => {
    afterEach(() => {
        setCurrentTenantId('')
        delete window.__ECEEE_TENANT_ID
    })

    it('lets the server resolve the current workspace when none was explicitly selected', () => {
        setCurrentTenantId('')
        delete window.__ECEEE_TENANT_ID

        expect(getCurrentTenantId()).toBe('')
    })

    it('uses an explicit workspace selection', () => {
        setCurrentTenantId('production-copy')

        expect(getCurrentTenantId()).toBe('production-copy')
    })
})

describe('reconcileCurrentTenantId', () => {
    afterEach(() => {
        setCurrentTenantId('')
        localStorage.removeItem('eceee_tenant_id')
    })

    it('repairs a missing browser workspace from the server session', () => {
        const identifier = reconcileCurrentTenantId(
            { id: '2', identifier: 'production-copy' },
            [{ id: '2', identifier: 'production-copy' }]
        )

        expect(identifier).toBe('production-copy')
        expect(getCurrentTenantId()).toBe('production-copy')
    })

    it('replaces and removes a stale legacy browser workspace', () => {
        localStorage.setItem('eceee_tenant_id', 'empty-workspace')

        reconcileCurrentTenantId(
            { id: '2', identifier: 'production-copy' },
            [
                { id: '1', identifier: 'empty-workspace' },
                { id: '2', identifier: 'production-copy' },
            ]
        )

        expect(getCurrentTenantId()).toBe('production-copy')
        expect(localStorage.getItem('eceee_tenant_id')).toBeNull()
    })
})
