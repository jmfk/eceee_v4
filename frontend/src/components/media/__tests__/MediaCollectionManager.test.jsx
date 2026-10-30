import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    listCollections: vi.fn(),
    listTags: vi.fn(),
    fetchTags: vi.fn(),
    addNotification: vi.fn(),
}))

vi.mock('../../../api', () => ({
    mediaCollectionsApi: { list: mocks.listCollections },
    mediaTagsApi: { list: mocks.listTags },
    mediaApi: {},
}))

vi.mock('../../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: mocks.addNotification }),
}))

import MediaCollectionManager from '../MediaCollectionManager'

describe('MediaCollectionManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listCollections.mockReturnValue(vi.fn().mockResolvedValue({ results: [{
            id: 'collection-1', title: 'summerstudy 2025 logos', fileCount: 12,
            accessLevel: 'public', sampleImages: [], tags: [],
        }] }))
        mocks.fetchTags.mockResolvedValue({ results: [] })
        mocks.listTags.mockReturnValue(mocks.fetchTags)
    })

    it('loads and displays collections from the selected namespace', async () => {
        render(<MediaCollectionManager namespace="default" />)

        expect(await screen.findByRole('heading', { name: 'summerstudy 2025 logos' })).toBeInTheDocument()
        expect(screen.queryByText('No collections found')).not.toBeInTheDocument()
        await waitFor(() => expect(mocks.listCollections).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'default', ordering: '-updated_at',
        })))
        expect(mocks.fetchTags).toHaveBeenCalled()
    })
})
