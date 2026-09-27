import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
}))

vi.mock('../client.js', () => ({ api: mocks }))

import { themesApi } from '../themes.js'

describe('themesApi preview content', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.get.mockResolvedValue({ data: { pages: [], objects: [] } })
        mocks.post.mockResolvedValue({ data: { designerPreview: { views: [] } } })
    })

    it('loads preview content sources for a theme', async () => {
        await themesApi.previewContentSources(7)

        expect(mocks.get).toHaveBeenCalledWith('/api/v1/webpages/themes/7/preview-content/sources/')
    })

    it('copies a selected source into theme preview content', async () => {
        await themesApi.importPreviewContent(7, 'page', 12)

        expect(mocks.post).toHaveBeenCalledWith(
            '/api/v1/webpages/themes/7/preview-content/import/',
            { sourceKind: 'page', sourceId: 12 },
        )
    })
})
