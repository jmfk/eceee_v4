import { afterEach, describe, expect, it, vi } from 'vitest'

import { Analytics } from '../analytics'
import { setCurrentTenantId } from '../tenant'

describe('Analytics tenant bootstrap', () => {
    let analytics

    afterEach(() => {
        vi.restoreAllMocks()
        if (analytics?.timer) clearInterval(analytics.timer)
        setCurrentTenantId('')
        localStorage.clear()
    })

    it('waits for authentication to resolve a workspace before initializing', () => {
        analytics = new Analytics()

        analytics.init('')
        expect(analytics.initialized).toBe(false)
        expect(analytics.queue).toEqual([])

        setCurrentTenantId('production-copy')
        analytics.init('production-copy')

        expect(analytics.initialized).toBe(true)
        expect(analytics.tenantId).toBe('production-copy')
        expect(analytics.queue).toEqual([
            expect.objectContaining({ eventType: 'pageview' }),
        ])

        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
        analytics.init('second-workspace')

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/v1/statistics/ingest/',
            expect.objectContaining({
                headers: expect.objectContaining({ 'X-Tenant-ID': 'production-copy' }),
            }),
        )
        expect(analytics.tenantId).toBe('second-workspace')
        expect(analytics.queue).toEqual([])

        analytics.track('click')
        analytics.init('')
        expect(analytics.tenantId).toBeNull()
        expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/v1/statistics/ingest/',
            expect.objectContaining({
                headers: expect.objectContaining({ 'X-Tenant-ID': 'second-workspace' }),
            }),
        )
        expect(analytics.queue).toEqual([])
    })

    it('retains events when the ingest endpoint rejects the request', async () => {
        analytics = new Analytics()
        analytics.tenantId = 'production-copy'
        analytics.track('click')
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 403 })

        await analytics.flush()

        expect(analytics.queue).toEqual([
            expect.objectContaining({ eventType: 'click' }),
        ])
    })
})
