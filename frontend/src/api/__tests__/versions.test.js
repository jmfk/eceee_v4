import { beforeEach, describe, expect, it, vi } from 'vitest'

const patchMock = vi.hoisted(() => vi.fn())

vi.mock('../client.js', () => ({
    api: {
        patch: patchMock
    }
}))

import { versionsApi } from '../versions.js'

describe('versionsApi', () => {
    beforeEach(() => {
        patchMock.mockReset()
        patchMock.mockResolvedValue({ data: { id: 42 } })
    })

    it('updates widgets through the canonical DRF action URL', async () => {
        const payload = { widgets: { main: [] } }

        await versionsApi.updateWidgets(42, payload)

        expect(patchMock).toHaveBeenCalledWith(
            '/api/v1/webpages/versions/42/widgets/',
            payload
        )
    })
})
