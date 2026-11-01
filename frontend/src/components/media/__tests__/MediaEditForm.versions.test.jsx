import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    versions: vi.fn(),
    addNotification: vi.fn(),
}))

vi.mock('../../../api', () => ({
    mediaApi: { files: { versions: mocks.versions } },
    mediaTagsApi: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: mocks.addNotification }),
}))
vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { isSuperuser: false } }),
}))
vi.mock('../OptimizedImage', () => ({
    default: ({ src, alt, resizeType, className }) =>
        <img src={src} alt={alt} data-resize-type={resizeType} className={className} />,
}))
vi.mock('../MediaTagWidget', () => ({ default: () => null }))
vi.mock('../MediaReferencesDisplay', () => ({ default: () => null }))
vi.mock('../ImageVersionUploadDialog', () => ({
    default: ({ file }) => <div role="dialog" aria-label={`Upload new version of ${file.title}`} />,
}))

import MediaEditForm from '../MediaEditForm'

const file = {
    id: 'image-1', fileType: 'image', title: 'Autumn leaves', originalFilename: 'autumn.jpg',
    fileSize: 1024, imgproxyBaseUrl: '/full-image', versionNumber: 2, tags: [],
}

describe('MediaEditForm image versions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.versions.mockResolvedValue({
            protectedFromCleanup: false,
            versions: [
                { id: null, versionNumber: 2, originalFilename: 'autumn.jpg', previewUrl: '/current.jpg',
                    uploadedAt: '2026-11-01T00:00:00Z', isCurrent: true, width: 400, height: 300 },
                { id: 'old-1', versionNumber: 1, originalFilename: 'old.jpg', previewUrl: '/old.jpg',
                    uploadedAt: '2026-10-14T00:00:00Z', isCurrent: false, width: 200, height: 150 },
            ],
        })
    })

    it('shows version thumbnails in a separate, keyboard accessible tab', async () => {
        const user = userEvent.setup()
        render(<MediaEditForm file={file} namespace="main" onSave={vi.fn()} onCancel={vi.fn()} />)

        expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
        expect(mocks.versions).not.toHaveBeenCalled()
        expect(screen.getByPlaceholderText('Enter file title')).toBeVisible()

        await user.click(screen.getByRole('tab', { name: 'Image versions' }))
        await waitFor(() => expect(mocks.versions).toHaveBeenCalledWith('image-1'))
        expect(screen.getByRole('tab', { name: 'Image versions' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByPlaceholderText('Enter file title')).not.toBeVisible()
        expect(await screen.findByRole('img', { name: 'Version 2 preview' })).toHaveAttribute('src', '/current.jpg')
        expect(screen.getByRole('img', { name: 'Version 1 preview' })).toHaveAttribute('src', '/old.jpg')
        expect(screen.getByRole('img', { name: 'Version 1 preview' })).toHaveClass('object-contain')
        expect(screen.getByRole('button', { name: 'Restore' })).toBeVisible()

        await user.keyboard('{ArrowLeft}')
        expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tab', { name: 'Details' })).toHaveFocus()
        expect(screen.getByPlaceholderText('Enter file title')).toBeVisible()
    })

    it('opens a simple version upload from the image editor', async () => {
        const user = userEvent.setup()
        render(<MediaEditForm file={file} namespace="main" onSave={vi.fn()} onCancel={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: 'Upload new version' }))
        expect(screen.getByRole('dialog', { name: 'Upload new version of Autumn leaves' })).toBeInTheDocument()
    })
})
