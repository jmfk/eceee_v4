import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SaveVersionControl from '../SaveVersionControl'

describe('SaveVersionControl', () => {
    it('disables save and publish when there are no changes to act on', () => {
        const onSaveClick = vi.fn()

        render(
            <SaveVersionControl
                isDirty={false}
                onSaveClick={onSaveClick}
                onPublishClick={vi.fn()}
                onScheduleClick={vi.fn()}
                onHistoryClick={vi.fn()}
            />
        )

        const saveButton = screen.getByRole('button', { name: /^save$/i })
        const publishButton = screen.getByRole('button', { name: /publish changes/i })

        expect(saveButton).toBeDisabled()
        expect(saveButton).toHaveClass('bg-gray-100')
        expect(publishButton).toBeDisabled()
        expect(publishButton).toHaveClass('bg-gray-100')
        expect(screen.queryByText(/v3/i)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument()

        fireEvent.click(saveButton)

        expect(onSaveClick).not.toHaveBeenCalled()
    })

    it('uses the standard blue save state when there are unsaved changes', () => {
        render(
            <SaveVersionControl
                isDirty={true}
                onSaveClick={vi.fn()}
                onPublishClick={vi.fn()}
                canPublish
            />
        )

        expect(screen.getByRole('button', { name: /^save$/i })).toHaveClass('bg-blue-600')
        expect(screen.getByRole('button', { name: /publish changes/i })).toBeEnabled()
    })

    it('does not show publishing controls while creating a new page', () => {
        render(<SaveVersionControl isNewPage isDirty onSaveClick={vi.fn()} />)

        expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /publish changes/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /history/i })).not.toBeInTheDocument()
    })

    it('omits controls that the current view cannot perform', () => {
        const { container } = render(<SaveVersionControl />)

        expect(container).toBeEmptyDOMElement()
    })
})
