import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import NumberInput from '../NumberInput'

describe('NumberInput', () => {
    describe('Controlled mode', () => {
        test('renders with numeric value', () => {
            render(
                <NumberInput
                    value={42}
                    onChange={vi.fn()}
                    label="Age"
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveValue(42)
        })

        test('calls onChange with numeric value', () => {
            const mockOnChange = vi.fn()
            render(
                <NumberInput
                    value={0}
                    onChange={mockOnChange}
                    label="Age"
                />
            )

            const input = screen.getByRole('spinbutton')
            fireEvent.change(input, { target: { value: '25' } })

            expect(mockOnChange).toHaveBeenCalledWith(25)
        })

        test('calls onChange with null for empty string', () => {
            const mockOnChange = vi.fn()
            render(
                <NumberInput
                    value={42}
                    onChange={mockOnChange}
                    label="Age"
                />
            )

            const input = screen.getByRole('spinbutton')
            fireEvent.change(input, { target: { value: '' } })

            expect(mockOnChange).toHaveBeenCalledWith(null)
        })

        test('updates when value prop changes', () => {
            const { rerender } = render(
                <NumberInput
                    value={10}
                    onChange={vi.fn()}
                    label="Age"
                />
            )

            let input = screen.getByRole('spinbutton')
            expect(input).toHaveValue(10)

            rerender(
                <NumberInput
                    value={25}
                    onChange={vi.fn()}
                    label="Age"
                />
            )

            input = screen.getByRole('spinbutton')
            expect(input).toHaveValue(25)
        })

        test('handles decimal values', () => {
            const mockOnChange = vi.fn()
            render(
                <NumberInput
                    value={0}
                    onChange={mockOnChange}
                    label="Price"
                    step="0.01"
                />
            )

            const input = screen.getByRole('spinbutton')
            fireEvent.change(input, { target: { value: '19.99' } })

            expect(mockOnChange).toHaveBeenCalledWith(19.99)
        })
    })

    describe('Uncontrolled mode (defaultValue)', () => {
        test('uses defaultValue for initial value', () => {
            render(
                <NumberInput
                    defaultValue={50}
                    onChange={vi.fn()}
                    label="Age"
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveValue(50)
        })

        test('maintains own state when changed', () => {
            const mockOnChange = vi.fn()
            render(
                <NumberInput
                    defaultValue={10}
                    onChange={mockOnChange}
                    label="Age"
                />
            )

            const input = screen.getByRole('spinbutton')
            fireEvent.change(input, { target: { value: '30' } })

            expect(mockOnChange).toHaveBeenCalledWith(30)
            expect(input).toHaveValue(30)
        })

        test('does not update when defaultValue prop changes', () => {
            const { rerender } = render(
                <NumberInput
                    defaultValue={10}
                    onChange={vi.fn()}
                    label="Age"
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveValue(10)

            rerender(
                <NumberInput
                    defaultValue={50}
                    onChange={vi.fn()}
                    label="Age"
                />
            )

            // DOM maintains its own value
            expect(input).toHaveValue(10)
        })
    })

    describe('Constraints', () => {
        test('respects min attribute', () => {
            render(
                <NumberInput
                    value={0}
                    onChange={vi.fn()}
                    label="Age"
                    min={18}
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('min', '18')
        })

        test('respects max attribute', () => {
            render(
                <NumberInput
                    value={0}
                    onChange={vi.fn()}
                    label="Age"
                    max={120}
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('max', '120')
        })

        test('respects step attribute', () => {
            render(
                <NumberInput
                    value={0}
                    onChange={vi.fn()}
                    label="Amount"
                    step={0.5}
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('step', '0.5')
        })

        test('uses step="any" by default', () => {
            render(
                <NumberInput
                    value={0}
                    onChange={vi.fn()}
                    label="Number"
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('step', 'any')
        })
    })

    describe('UI and Validation', () => {
        test('shows label', () => {
            render(
                <NumberInput
                    value={0}
                    onChange={vi.fn()}
                    label="Your Age"
                />
            )

            expect(screen.getByText('Your Age')).toBeInTheDocument()
        })

        test('shows required indicator', () => {
            render(
                <NumberInput
                    value={0}
                    onChange={vi.fn()}
                    label="Age"
                    required={true}
                />
            )

            expect(screen.getByText('*')).toBeInTheDocument()
        })

        test('shows description', () => {
            render(
                <NumberInput
                    value={0}
                    onChange={vi.fn()}
                    label="Age"
                    description="Enter your age in years"
                />
            )

            expect(screen.getByText('Enter your age in years')).toBeInTheDocument()
        })

        test('shows placeholder', () => {
            render(
                <NumberInput
                    value={null}
                    onChange={vi.fn()}
                    label="Age"
                    placeholder="Enter age..."
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('placeholder', 'Enter age...')
        })

        test('disables input when disabled', () => {
            render(
                <NumberInput
                    value={0}
                    onChange={vi.fn()}
                    label="Age"
                    disabled={true}
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toBeDisabled()
        })

        test('shows validation errors', () => {
            render(
                <NumberInput
                    value={5}
                    onChange={vi.fn()}
                    label="Age"
                    validation={{
                        isValid: false,
                        errors: ['Must be at least 18']
                    }}
                />
            )

            expect(screen.getByText('Must be at least 18')).toBeInTheDocument()
        })
    })

    describe('Edge cases', () => {
        test('handles zero value correctly', () => {
            render(
                <NumberInput
                    value={0}
                    onChange={vi.fn()}
                    label="Count"
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveValue(0)
        })

        test('handles negative values', () => {
            const mockOnChange = vi.fn()
            render(
                <NumberInput
                    value={0}
                    onChange={mockOnChange}
                    label="Temperature"
                />
            )

            const input = screen.getByRole('spinbutton')
            fireEvent.change(input, { target: { value: '-10' } })

            expect(mockOnChange).toHaveBeenCalledWith(-10)
        })

        test('handles large numbers', () => {
            const mockOnChange = vi.fn()
            render(
                <NumberInput
                    value={0}
                    onChange={mockOnChange}
                    label="Population"
                />
            )

            const input = screen.getByRole('spinbutton')
            fireEvent.change(input, { target: { value: '1000000' } })

            expect(mockOnChange).toHaveBeenCalledWith(1000000)
        })

        test('handles very small decimal values', () => {
            const mockOnChange = vi.fn()
            render(
                <NumberInput
                    value={0}
                    onChange={mockOnChange}
                    label="Precision"
                    step="0.0001"
                />
            )

            const input = screen.getByRole('spinbutton')
            fireEvent.change(input, { target: { value: '0.0123' } })

            expect(mockOnChange).toHaveBeenCalledWith(0.0123)
        })
    })
})

