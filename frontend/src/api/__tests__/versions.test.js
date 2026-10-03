import { beforeEach, describe, expect, it, vi } from 'vitest'

const patchMock = vi.hoisted(() => vi.fn())
const deleteMock = vi.hoisted(() => vi.fn())

vi.mock('../client.js', () => ({
    api: {
        patch: patchMock,
        delete: deleteMock,
    }
}))

import { versionsApi } from '../versions.js'

describe('versionsApi', () => {
    beforeEach(() => {
        patchMock.mockReset()
        patchMock.mockResolvedValue({ data: { id: 42 } })
        deleteMock.mockReset()
        deleteMock.mockResolvedValue({})
    })

    it('updates widgets through the canonical DRF action URL', async () => {
        const payload = { widgets: { main: [] } }

        await versionsApi.updateWidgets(42, payload)

        expect(patchMock).toHaveBeenCalledWith(
            '/api/v1/webpages/versions/42/widgets/',
            payload
        )
    })

    it('does not expose direct version creation', () => {
        expect(versionsApi.create).toBeUndefined()
    })

    it('deletes only the reviewed working-copy revision', async () => {
        await versionsApi.delete(42, '2026-10-03T10:00:00Z', 7)

        expect(deleteMock).toHaveBeenCalledWith(
            '/api/v1/webpages/versions/42/',
            {
                data: {
                    clientUpdatedAt: '2026-10-03T10:00:00Z',
                    expectedRevision: 7,
                },
            },
        )
    })
})
