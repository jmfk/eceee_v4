import React from 'react'
import { render, screen } from '@testing-library/react'
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
    it('places subdued help text between the label and field', () => {
        render(
            <ImageStyleSelect
                value={null}
                onChange={vi.fn()}
                label="Image Style"
                description="Named image style from the current theme"
            />
        )

        const label = screen.getByText('Image Style')
        const description = screen.getByText('Named image style from the current theme')
        const field = screen.getByText('Default')

        expect(description).toHaveClass('italic', 'text-gray-500')
        expect(label.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(description.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
})
