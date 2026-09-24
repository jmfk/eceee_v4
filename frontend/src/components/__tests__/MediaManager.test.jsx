import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

vi.mock('../media/MediaTagManager', () => ({
    default: () => <div>Tags</div>,
}))

describe('MediaManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mediaApi.pendingFiles.list.mockResolvedValue({ results: [] })
    })

    it('opens the media library in list view by default', () => {
        render(<MediaManager namespace="main" />)

        expect(screen.getByTestId('media-browser')).toHaveTextContent('Default view: list')
    })
})
