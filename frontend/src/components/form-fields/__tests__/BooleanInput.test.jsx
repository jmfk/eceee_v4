import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import BooleanInput from '../BooleanInput'

describe('BooleanInput', () => {
    describe('Toggle variant (default)', () => {
        describe('Controlled mode', () => {
            test('renders with initial value', () => {
                render(
                    <BooleanInput
                        value={true}
                        onChange={vi.fn()}
                        label="Test Toggle"
                    />
                )

                const toggle = screen.getByRole('switch')
                expect(toggle).toHaveAttribute('aria-checked', 'true')
            })

            test('calls onChange when clicked', () => {
                const mockOnChange = vi.fn()
                render(
                    <BooleanInput
                        value={false}
                        onChange={mockOnChange}
                        label="Test Toggle"
                    />
                )

                const toggle = screen.getByRole('switch')
                fireEvent.click(toggle)

                expect(mockOnChange).toHaveBeenCalledWith(true)
            })

            test('updates when value prop changes', () => {
                const mockOnChange = vi.fn()
                const { rerender } = render(
                    <BooleanInput
                        value={false}
                        onChange={mockOnChange}
                        label="Test Toggle"
                    />
                )

                let toggle = screen.getByRole('switch')
                expect(toggle).toHaveAttribute('aria-checked', 'false')

                rerender(
                    <BooleanInput
                        value={true}
                        onChange={mockOnChange}
                        label="Test Toggle"
                    />
                )

                toggle = screen.getByRole('switch')
                expect(toggle).toHaveAttribute('aria-checked', 'true')
            })

            test('toggles between true and false', () => {
                const mockOnChange = vi.fn()
                const { rerender } = render(
                    <BooleanInput
                        value={false}
                        onChange={mockOnChange}
                        label="Test Toggle"
                    />
                )

                const toggle = screen.getByRole('switch')

                // Click to turn on
                fireEvent.click(toggle)
                expect(mockOnChange).toHaveBeenCalledWith(true)

                // Simulate parent updating value
                rerender(
                    <BooleanInput
                        value={true}
                        onChange={mockOnChange}
                        label="Test Toggle"
                    />
                )

                // Click to turn off
                fireEvent.click(toggle)
                expect(mockOnChange).toHaveBeenCalledWith(false)
            })
        })

        describe('Uncontrolled mode (defaultValue)', () => {
            test('uses defaultValue for initial state', () => {
                render(
                    <BooleanInput
                        defaultValue={true}
                        onChange={vi.fn()}
                        label="Test Toggle"
                    />
                )

                const toggle = screen.getByRole('switch')
                expect(toggle).toHaveAttribute('aria-checked', 'true')
            })

            test('maintains own state when clicked', () => {
                const mockOnChange = vi.fn()
                render(
                    <BooleanInput
                        defaultValue={false}
                        onChange={mockOnChange}
                        label="Test Toggle"
                    />
                )

                const toggle = screen.getByRole('switch')
                expect(toggle).toHaveAttribute('aria-checked', 'false')

                // Click to toggle on
                fireEvent.click(toggle)
                expect(mockOnChange).toHaveBeenCalledWith(true)
                expect(toggle).toHaveAttribute('aria-checked', 'true')

                // Click to toggle off
                fireEvent.click(toggle)
                expect(mockOnChange).toHaveBeenCalledWith(false)
                expect(toggle).toHaveAttribute('aria-checked', 'false')
            })

            test('does not update when defaultValue prop changes', () => {
                const mockOnChange = vi.fn()
                const { rerender } = render(
                    <BooleanInput
                        defaultValue={false}
                        onChange={mockOnChange}
                        label="Test Toggle"
                    />
                )

                const toggle = screen.getByRole('switch')
                expect(toggle).toHaveAttribute('aria-checked', 'false')

                // Change defaultValue - should not affect rendered value
                rerender(
                    <BooleanInput
                        defaultValue={true}
                        onChange={mockOnChange}
                        label="Test Toggle"
                    />
                )

                // Toggle maintains its own state
                expect(toggle).toHaveAttribute('aria-checked', 'false')
            })

            test('defaults to false when no defaultValue provided', () => {
                render(
                    <BooleanInput
                        onChange={vi.fn()}
                        label="Test Toggle"
                    />
                )

                const toggle = screen.getByRole('switch')
                expect(toggle).toHaveAttribute('aria-checked', 'false')
            })
        })

        test('shows label', () => {
            render(
                <BooleanInput
                    value={false}
                    onChange={vi.fn()}
                    label="Enable Feature"
                />
            )

            expect(screen.getByText('Enable Feature')).toBeInTheDocument()
        })

        test('shows required indicator', () => {
            render(
                <BooleanInput
                    value={false}
                    onChange={vi.fn()}
                    label="Required Toggle"
                    required={true}
                />
            )

            expect(screen.getByText('*')).toBeInTheDocument()
        })

        test('shows description', () => {
            render(
                <BooleanInput
                    value={false}
                    onChange={vi.fn()}
                    label="Test Toggle"
                    description="This is a helpful description"
                />
            )

            expect(screen.getByText('This is a helpful description')).toBeInTheDocument()
        })

        test('disables interaction when disabled', () => {
            const mockOnChange = vi.fn()
            render(
                <BooleanInput
                    value={false}
                    onChange={mockOnChange}
                    label="Test Toggle"
                    disabled={true}
                />
            )

            const toggle = screen.getByRole('switch')
            expect(toggle).toBeDisabled()

            fireEvent.click(toggle)
            expect(mockOnChange).not.toHaveBeenCalled()
        })

        test('shows validation errors', () => {
            render(
                <BooleanInput
                    value={false}
                    onChange={vi.fn()}
                    label="Test Toggle"
                    validation={{
                        isValid: false,
                        errors: ['This field must be enabled']
                    }}
                />
            )

            expect(screen.getByText('This field must be enabled')).toBeInTheDocument()
        })
    })

    describe('Checkbox variant', () => {
        test('renders as checkbox when specified', () => {
            render(
                <BooleanInput
                    value={false}
                    onChange={vi.fn()}
                    label="Test Checkbox"
                    variant="checkbox"
                />
            )

            const checkbox = screen.getByRole('checkbox')
            expect(checkbox).toBeInTheDocument()
        })

        test('works in controlled mode', () => {
            const mockOnChange = vi.fn()
            render(
                <BooleanInput
                    value={false}
                    onChange={mockOnChange}
                    label="Test Checkbox"
                    variant="checkbox"
                />
            )

            const checkbox = screen.getByRole('checkbox')
            fireEvent.click(checkbox)

            expect(mockOnChange).toHaveBeenCalledWith(true)
        })

        test('works in uncontrolled mode', () => {
            const mockOnChange = vi.fn()
            render(
                <BooleanInput
                    defaultValue={true}
                    onChange={mockOnChange}
                    label="Test Checkbox"
                    variant="checkbox"
                />
            )

            const checkbox = screen.getByRole('checkbox')
            expect(checkbox).toBeChecked()

            fireEvent.click(checkbox)
            expect(mockOnChange).toHaveBeenCalledWith(false)
            expect(checkbox).not.toBeChecked()
        })
    })
})

