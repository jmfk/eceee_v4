import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import MediaSelectModal from '../media/MediaSelectModal'

vi.mock('../media/MediaBrowser', () => ({
    default: ({ onFileSelect, requireTags }) => <button
        type="button"
        data-require-tags={String(requireTags)}
        onClick={() => onFileSelect({ id: 'media-1', title: 'Tagged image' })}
    >
        Choose tagged image
    </button>,
}))

describe('MediaSelectModal', () => {
    it('keeps the picker open when an asynchronous selection is rejected', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        const onSelect = vi.fn().mockResolvedValue(false)
        render(<MediaSelectModal
            isOpen
            onClose={onClose}
            onSelect={onSelect}
            namespace="theme-media"
            requireTags
            allowCollections={false}
        />)

        const choice = screen.getByRole('button', { name: 'Choose tagged image' })
        expect(choice).toHaveAttribute('data-require-tags', 'true')
        await user.click(choice)
        await user.click(screen.getByRole('button', { name: 'Select (1)' }))

        await waitFor(() => expect(onSelect).toHaveBeenCalledWith([
            { id: 'media-1', title: 'Tagged image' },
        ]))
        expect(onClose).not.toHaveBeenCalled()
        expect(screen.getByRole('heading', { name: 'Select Media' })).toBeInTheDocument()
    })
})
