import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import MediaManager from '../media/MediaManager'
import { mediaApi } from '../../api'

vi.mock('../../api', () => ({
    mediaApi: {
        pendingFiles: {
            list: vi.fn(),
        },
    },
}))

vi.mock('../media/MediaBrowser', () => ({
    default: ({ defaultViewMode }) => (
        <div data-testid="media-browser">Default view: {defaultViewMode}</div>
    ),
}))

vi.mock('../media/PendingMediaManager', () => ({
    default: () => <div>Pending media</div>,
}))

vi.mock('../media/MediaCollectionManager', () => ({
    default: () => <div>Collections</div>,
}))

vi.mock('../classification/ClassificationManager', () => ({
    default: ({ namespace }) => <div data-testid="shared-tags">Shared tags: {namespace}</div>,
}))

describe('MediaManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mediaApi.pendingFiles.list.mockResolvedValue({ results: [] })
    })

    it('uses the shared tag register in the current media namespace', async () => {
        render(<MediaManager namespace="editorial" />)
        fireEvent.click(screen.getByRole('button', { name: 'Tags' }))
        await waitFor(() => expect(mediaApi.pendingFiles.list).toHaveBeenCalled())
        expect(screen.getByTestId('shared-tags')).toHaveTextContent('Shared tags: editorial')
    })

    it('opens the media library in list view by default', () => {
        render(<MediaManager namespace="main" />)

        expect(screen.getByTestId('media-browser')).toHaveTextContent('Default view: list')
    })
})
