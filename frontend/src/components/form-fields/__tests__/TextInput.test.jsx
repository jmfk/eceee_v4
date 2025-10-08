import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import TextInput from '../TextInput'

describe('TextInput', () => {
    test('handles event objects correctly', () => {
        const mockOnChange = vi.fn()

        render(
            <TextInput
                value=""
                onChange={mockOnChange}
                label="Test Input"
            />
        )

        const input = screen.getByRole('textbox')

        // Simulate typing - this will pass an event object
        fireEvent.change(input, { target: { value: 'test value' } })

        // Should extract the value from the event object
        expect(mockOnChange).toHaveBeenCalledWith('test value')
    })

    test('prevents [object] values from being displayed', () => {
        const mockOnChange = vi.fn()

        render(
            <TextInput
                value=""
                onChange={mockOnChange}
                label="Test Input"
            />
        )

        const input = screen.getByRole('textbox')

        // Simulate typing - this should extract the string value, not show [object]
        fireEvent.change(input, { target: { value: 'hello world' } })

        // Should extract the actual string value, not pass the event object
        expect(mockOnChange).toHaveBeenCalledWith('hello world')
        expect(mockOnChange).not.toHaveBeenCalledWith(expect.objectContaining({ target: expect.anything() }))
    })

    test('displays the correct value', () => {
        render(
            <TextInput
                value="initial value"
                onChange={vi.fn()}
                label="Test Input"
            />
        )

        const input = screen.getByRole('textbox')
        expect(input).toHaveValue('initial value')
    })

    test('shows validation errors', () => {
        render(
            <TextInput
                value=""
                onChange={vi.fn()}
                label="Test Input"
                validation={{
                    isValid: false,
                    errors: ['This field is required'],
                    warnings: []
                }}
            />
        )

        expect(screen.getByText('This field is required')).toBeInTheDocument()
    })

    describe('Uncontrolled mode (defaultValue)', () => {
        test('uses defaultValue for initial value', () => {
            const mockOnChange = vi.fn()

            render(
                <TextInput
                    defaultValue="default text"
                    onChange={mockOnChange}
                    label="Test Input"
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveValue('default text')
        })

        test('calls onChange when typing in uncontrolled mode', () => {
            const mockOnChange = vi.fn()

            render(
                <TextInput
                    defaultValue="initial"
                    onChange={mockOnChange}
                    label="Test Input"
                />
            )

            const input = screen.getByRole('textbox')
            fireEvent.change(input, { target: { value: 'updated text' } })

            expect(mockOnChange).toHaveBeenCalledWith('updated text')
        })

        test('does not re-render when defaultValue changes', () => {
            const mockOnChange = vi.fn()
            const { rerender } = render(
                <TextInput
                    defaultValue="first"
                    onChange={mockOnChange}
                    label="Test Input"
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveValue('first')

            // Changing defaultValue should not update the input (that's how uncontrolled works)
            rerender(
                <TextInput
                    defaultValue="second"
                    onChange={mockOnChange}
                    label="Test Input"
                />
            )

            // Input keeps its value (DOM is the source of truth)
            expect(input).toHaveValue('first')
        })
    })
})
