import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImageLibraryPicker from '../ImageLibraryPicker'

const mocks = vi.hoisted(() => ({
    addNotification: vi.fn(),
    listLibraryImages: vi.fn(),
    uploadLibraryImages: vi.fn(),
}))

vi.mock('../../../api/themes', () => ({
    themesApi: {
        listLibraryImages: mocks.listLibraryImages,
        uploadLibraryImages: mocks.uploadLibraryImages,
    },
}))

vi.mock('../../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: mocks.addNotification }),
}))

vi.mock('../../media/OptimizedImage', () => ({
    default: ({ alt }) => <div role="img" aria-label={alt} />,
}))

describe('ImageLibraryPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listLibraryImages
            .mockResolvedValueOnce({ images: [] })
            .mockResolvedValueOnce({
                images: [{ filename: 'hero image (1).jpg', publicUrl: '/media/hero image (1).jpg', size: 4096, width: 1600, height: 900 }],
            })
        mocks.uploadLibraryImages.mockResolvedValue({
            uploaded: [{ filename: 'hero image (1).jpg', publicUrl: '/media/hero image (1).jpg', size: 4096, width: 1600, height: 900 }],
            errors: [],
        })
    })

    it('uploads to the selected theme and returns the uploaded image', async () => {
        const user = userEvent.setup()
        const onSelect = vi.fn()
        const { container } = render(
            <ImageLibraryPicker themeId={42} onSelect={onSelect} onCancel={vi.fn()} />
        )

        await screen.findByText('No images in library')
        const file = new File(['image'], 'hero image (1).jpg', { type: 'image/jpeg' })
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })

        await waitFor(() => expect(mocks.uploadLibraryImages).toHaveBeenCalledWith(42, [file]))
        expect(await screen.findByText('Selected:')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Select Image' }))

        expect(onSelect).toHaveBeenCalledWith({
            url: '/media/hero%20image%20%281%29.jpg',
            filename: 'hero image (1).jpg',
            size: 4096,
            width: 1600,
            height: 900,
        })
        expect(mocks.listLibraryImages).toHaveBeenCalledTimes(2)
    })
})
