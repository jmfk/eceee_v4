import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SaveVersionControl from '../SaveVersionControl'

describe('SaveVersionControl', () => {
    it('keeps the primary save action enabled without exposing a version number', () => {
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

        expect(saveButton).toBeEnabled()
        expect(saveButton).toHaveClass('bg-green-600')
        expect(screen.queryByText(/v3/i)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /publish changes/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument()

        fireEvent.click(saveButton)

        expect(onSaveClick).toHaveBeenCalledTimes(1)
    })

    it('uses the standard blue save state when there are unsaved changes', () => {
        render(
            <SaveVersionControl
                isDirty={true}
                onSaveClick={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: /^save$/i })).toHaveClass('bg-blue-600')
    })

    it('does not show publishing controls while creating a new page', () => {
        render(<SaveVersionControl isNewPage isDirty onSaveClick={vi.fn()} />)

        expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /publish changes/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /history/i })).not.toBeInTheDocument()
    })
})
