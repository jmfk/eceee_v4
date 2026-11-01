import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ replaceFile: vi.fn(), update: vi.fn(), addNotification: vi.fn() }))

vi.mock('../../../api', () => ({
    mediaApi: { files: { replaceFile: mocks.replaceFile, update: mocks.update } },
}))
vi.mock('../../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: mocks.addNotification }),
}))
vi.mock('../../classification/ClassificationPicker', () => ({
    default: ({ onChange }) => <button type="button" onClick={() => onChange(['new-tag'])}>Add optional tag</button>,
}))

import ImageVersionUploadDialog from '../ImageVersionUploadDialog'

const file = { id: 'image-1', title: 'Annual logo', classificationIds: ['existing-tag'] }

describe('ImageVersionUploadDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.replaceFile.mockResolvedValue({ ...file, versionNumber: 2 })
        mocks.update.mockReturnValue(vi.fn().mockResolvedValue({ ...file, versionNumber: 2, classificationIds: ['existing-tag', 'new-tag'] }))
    })

    it('uploads a new version of the same image without requiring new tags', async () => {
        const user = userEvent.setup()
        const onUploaded = vi.fn()
        render(<ImageVersionUploadDialog file={file} namespace="main" onClose={vi.fn()} onUploaded={onUploaded} />)

        expect(screen.queryByRole('button', { name: 'Add optional tag' })).not.toBeInTheDocument()
        const image = new File(['image data'], 'logo-2027.png', { type: 'image/png' })
        await user.upload(screen.getByLabelText('New image'), image)
        expect(screen.getByLabelText('New image').files[0]).toBe(image)
        expect(screen.getByRole('button', { name: 'Upload new version' })).toBeEnabled()
        expect(screen.getByLabelText('New image').closest('form').checkValidity()).toBe(true)
        await user.click(screen.getByRole('button', { name: 'Upload new version' }))

        await waitFor(() => expect(mocks.replaceFile).toHaveBeenCalledWith('image-1', image))
        expect(mocks.update).not.toHaveBeenCalled()
        expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'image-1', versionNumber: 2 }))
    })

    it('adds optional tags while retaining the existing image tags', async () => {
        const user = userEvent.setup()
        render(<ImageVersionUploadDialog file={file} namespace="main" onClose={vi.fn()} onUploaded={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: 'Add tags (optional)' }))
        await user.click(screen.getByRole('button', { name: 'Add optional tag' }))
        await user.upload(screen.getByLabelText('New image'), new File(['image data'], 'logo-2027.png', { type: 'image/png' }))
        await user.click(screen.getByRole('button', { name: 'Upload new version' }))

        await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('image-1', {
            classification_ids: ['existing-tag', 'new-tag'],
        }))
    })
})
