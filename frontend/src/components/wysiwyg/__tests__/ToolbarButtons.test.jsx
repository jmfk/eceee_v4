import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ToolbarButtons from '../ToolbarButtons'

describe('Compact WYSIWYG toolbar', () => {
    it('renders icon-only actions with accessible names and focus help', async () => {
        const { container } = render(<ToolbarButtons state={{ format: 'Paragraph', bold: true }} onCommand={vi.fn()} />)
        for (const button of container.querySelectorAll('button')) {
            expect(button).toHaveAccessibleName()
            expect(button.textContent).toBe('')
            expect(button.querySelector('svg')).toBeTruthy()
        }
        const bold = screen.getByRole('button', { name: 'Bold' })
        expect(bold).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Undo' })).not.toHaveAttribute('aria-pressed')
        fireEvent.focus(bold)
        await waitFor(() => expect(screen.getByText('Bold')).toBeVisible())
    })

    it('retains formatting choices and commands behind the compact format icon', () => {
        const onCommand = vi.fn()
        render(<ToolbarButtons state={{ format: 'Paragraph', allowedButtons: ['format'], allowedFormats: ['<p>', '<h3>'] }}
            onCommand={onCommand} />)
        fireEvent.click(screen.getByRole('button', { name: 'Text format: Paragraph' }))
        expect(screen.getByRole('button', { name: 'Paragraph', exact: true })).toBeVisible()
        expect(screen.queryByRole('button', { name: 'Heading 1' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Heading 3' }))
        expect(onCommand).toHaveBeenCalledWith('formatBlock', '<h3>')
        expect(screen.getByRole('button', { name: 'Text format: Paragraph' })).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(screen.getByRole('button', { name: 'Text format: Paragraph' }))
        fireEvent.keyDown(screen.getByRole('button', { name: 'Paragraph', exact: true }), { key: 'Escape' })
        expect(screen.getByRole('button', { name: 'Text format: Paragraph' })).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByRole('button', { name: 'Text format: Paragraph' })).toHaveFocus()
    })
})
