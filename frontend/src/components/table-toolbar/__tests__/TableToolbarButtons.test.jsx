import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TableToolbarButtons from '../TableToolbarButtons'

describe('Compact table toolbar', () => {
    it('keeps structure and formatting actions accessible behind icons and help', async () => {
        const onCommand = vi.fn()
        const { container } = render(<TableToolbarButtons state={{ hasSelection: true, fontStyle: 'quote' }} onCommand={onCommand} />)
        for (const button of container.querySelectorAll('button')) {
            expect(button).toHaveAccessibleName()
            expect(button.textContent).toBe('')
            expect(button.querySelector('svg')).toBeTruthy()
        }
        fireEvent.click(screen.getByRole('button', { name: 'Add Row', exact: true }))
        fireEvent.click(screen.getByRole('button', { name: 'Add Column', exact: true }))
        expect(onCommand).toHaveBeenCalledWith('addRow', 'end')
        expect(onCommand).toHaveBeenCalledWith('addColumn', 'end')
        const style = screen.getByRole('combobox', { name: 'Cell text style' })
        expect(style).toHaveValue('quote')
        fireEvent.change(style, { target: { value: 'caption' } })
        expect(onCommand).toHaveBeenCalledWith('fontStyle', 'caption')
        fireEvent.focus(screen.getByRole('button', { name: 'Add Column', exact: true }))
        await waitFor(() => expect(screen.getByText('Add Column')).toBeVisible())
    })

    it('preserves selection-dependent disabled actions', () => {
        render(<TableToolbarButtons state={{ hasSelection: false }} onCommand={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Remove Row' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Colors' })).toBeDisabled()
        expect(screen.getByRole('combobox', { name: 'Cell text style' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Add Row' })).toBeEnabled()
    })
})
