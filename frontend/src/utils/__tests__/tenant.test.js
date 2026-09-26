import { afterEach, describe, expect, it } from 'vitest'

import { getCurrentTenantId } from '../tenant'

describe('getCurrentTenantId', () => {
    afterEach(() => {
        localStorage.removeItem('eceee_tenant_id')
        delete window.__ECEEE_TENANT_ID
    })

    it('lets the server resolve the current workspace when none was explicitly selected', () => {
        localStorage.removeItem('eceee_tenant_id')
        delete window.__ECEEE_TENANT_ID

        expect(getCurrentTenantId()).toBe('')
    })

    it('uses an explicit workspace selection', () => {
        localStorage.setItem('eceee_tenant_id', 'production-copy')

        expect(getCurrentTenantId()).toBe('production-copy')
    })
})
