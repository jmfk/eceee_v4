import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ImageStyleSelect from '../ImageStyleSelect'

vi.mock('../../../hooks/useTheme', () => ({
    useTheme: () => ({ currentTheme: null })
}))

vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: vi.fn(),
        getState: vi.fn()
    })
}))

describe('ImageStyleSelect', () => {
    it('shows help in an info popover beside the label', async () => {
        const user = userEvent.setup()
        render(
            <ImageStyleSelect
                value={null}
                onChange={vi.fn()}
                label="Image Style"
                description="Named image style from the current theme"
            />
        )

        const label = screen.getByText('Image Style')
        let description = screen.getByText('Named image style from the current theme')
        const field = screen.getByText('Default')
        const helpButton = screen.getByRole('button', { name: 'About Image Style' })

        expect(description).toHaveClass('sr-only')
        expect(helpButton).toHaveAttribute('aria-expanded', 'false')
        expect(label.compareDocumentPosition(helpButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(description.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        await user.click(helpButton)

        description = screen.getByRole('note')
        expect(helpButton).toHaveAttribute('aria-expanded', 'true')
        expect(description).not.toHaveClass('sr-only')
    })
})
