import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import CheckboxInput from '../CheckboxInput'

describe('CheckboxInput', () => {
    describe('Single checkbox mode', () => {
        describe('Controlled mode', () => {
            test('renders checked when value is true', () => {
                render(
                    <CheckboxInput
                        value={true}
                        onChange={vi.fn()}
                        label="Accept Terms"
                        singleCheckbox={true}
                    />
                )

                const checkbox = screen.getByRole('checkbox')
                expect(checkbox).toBeChecked()
            })

            test('renders unchecked when value is false', () => {
                render(
                    <CheckboxInput
                        value={false}
                        onChange={vi.fn()}
                        label="Accept Terms"
                        singleCheckbox={true}
                    />
                )

                const checkbox = screen.getByRole('checkbox')
                expect(checkbox).not.toBeChecked()
            })

            test('calls onChange with boolean value', () => {
                const mockOnChange = vi.fn()
                render(
                    <CheckboxInput
                        value={false}
                        onChange={mockOnChange}
                        label="Accept Terms"
                        singleCheckbox={true}
                    />
                )

                const checkbox = screen.getByRole('checkbox')
                fireEvent.click(checkbox)

                expect(mockOnChange).toHaveBeenCalledWith(true)
            })
        })

        describe('Uncontrolled mode (defaultValue)', () => {
            test('uses defaultValue for initial state', () => {
                render(
                    <CheckboxInput
                        defaultValue={true}
                        onChange={vi.fn()}
                        label="Accept Terms"
                        singleCheckbox={true}
                    />
                )

                const checkbox = screen.getByRole('checkbox')
                expect(checkbox).toBeChecked()
            })

            test('maintains own state when toggled', () => {
                const mockOnChange = vi.fn()
                render(
                    <CheckboxInput
                        defaultValue={false}
                        onChange={mockOnChange}
                        label="Accept Terms"
                        singleCheckbox={true}
                    />
                )

                const checkbox = screen.getByRole('checkbox')

                // Toggle on
                fireEvent.click(checkbox)
                expect(mockOnChange).toHaveBeenCalledWith(true)
                expect(checkbox).toBeChecked()

                // Toggle off
                fireEvent.click(checkbox)
                expect(mockOnChange).toHaveBeenCalledWith(false)
                expect(checkbox).not.toBeChecked()
            })
        })
    })

    describe('Multiple checkbox mode', () => {
        const options = ['Option 1', 'Option 2', 'Option 3']

        describe('Controlled mode', () => {
            test('renders all options', () => {
                render(
                    <CheckboxInput
                        value={[]}
                        onChange={vi.fn()}
                        label="Select Multiple"
                        options={options}
                    />
                )

                expect(screen.getByText('Option 1')).toBeInTheDocument()
                expect(screen.getByText('Option 2')).toBeInTheDocument()
                expect(screen.getByText('Option 3')).toBeInTheDocument()
            })

            test('checks selected options', () => {
                render(
                    <CheckboxInput
                        value={['Option 1', 'Option 3']}
                        onChange={vi.fn()}
                        label="Select Multiple"
                        options={options}
                    />
                )

                const checkboxes = screen.getAllByRole('checkbox')
                expect(checkboxes[0]).toBeChecked()
                expect(checkboxes[1]).not.toBeChecked()
                expect(checkboxes[2]).toBeChecked()
            })

            test('adds option to array when checked', () => {
                const mockOnChange = vi.fn()
                render(
                    <CheckboxInput
                        value={['Option 1']}
                        onChange={mockOnChange}
                        label="Select Multiple"
                        options={options}
                    />
                )

                const checkboxes = screen.getAllByRole('checkbox')
                fireEvent.click(checkboxes[1])

                expect(mockOnChange).toHaveBeenCalledWith(['Option 1', 'Option 2'])
            })

            test('removes option from array when unchecked', () => {
                const mockOnChange = vi.fn()
                render(
                    <CheckboxInput
                        value={['Option 1', 'Option 2']}
                        onChange={mockOnChange}
                        label="Select Multiple"
                        options={options}
                    />
                )

                const checkboxes = screen.getAllByRole('checkbox')
                fireEvent.click(checkboxes[0])

                expect(mockOnChange).toHaveBeenCalledWith(['Option 2'])
            })
        })

        describe('Uncontrolled mode (defaultValue)', () => {
            test('uses defaultValue for initial state', () => {
                render(
                    <CheckboxInput
                        defaultValue={['Option 1', 'Option 3']}
                        onChange={vi.fn()}
                        label="Select Multiple"
                        options={options}
                    />
                )

                const checkboxes = screen.getAllByRole('checkbox')
                expect(checkboxes[0]).toBeChecked()
                expect(checkboxes[1]).not.toBeChecked()
                expect(checkboxes[2]).toBeChecked()
            })

            test('maintains own state when toggled', () => {
                const mockOnChange = vi.fn()
                render(
                    <CheckboxInput
                        defaultValue={['Option 1']}
                        onChange={mockOnChange}
                        label="Select Multiple"
                        options={options}
                    />
                )

                const checkboxes = screen.getAllByRole('checkbox')

                // Add Option 2
                fireEvent.click(checkboxes[1])
                expect(mockOnChange).toHaveBeenCalledWith(['Option 1', 'Option 2'])
                expect(checkboxes[1]).toBeChecked()

                // Remove Option 1
                fireEvent.click(checkboxes[0])
                expect(mockOnChange).toHaveBeenCalledWith(['Option 2'])
                expect(checkboxes[0]).not.toBeChecked()
            })
        })

        describe('Max selections', () => {
            test('enforces maxSelections limit', () => {
                const mockOnChange = vi.fn()
                render(
                    <CheckboxInput
                        value={['Option 1', 'Option 2']}
                        onChange={mockOnChange}
                        label="Select Multiple"
                        options={options}
                        maxSelections={2}
                    />
                )

                const checkboxes = screen.getAllByRole('checkbox')

                // Third checkbox should be disabled
                expect(checkboxes[2]).toBeDisabled()

                // Clicking disabled checkbox does nothing
                fireEvent.click(checkboxes[2])
                expect(mockOnChange).not.toHaveBeenCalled()
            })

            test('shows selection count', () => {
                render(
                    <CheckboxInput
                        value={['Option 1']}
                        onChange={vi.fn()}
                        label="Select Multiple"
                        options={options}
                        maxSelections={3}
                    />
                )

                expect(screen.getByText('1/3 selected')).toBeInTheDocument()
            })
        })
    })

    describe('Validation and UI', () => {
        test('shows label', () => {
            render(
                <CheckboxInput
                    value={[]}
                    onChange={vi.fn()}
                    label="Choose Options"
                    options={['Option 1']}
                />
            )

            expect(screen.getByText('Choose Options')).toBeInTheDocument()
        })

        test('shows required indicator', () => {
            render(
                <CheckboxInput
                    value={[]}
                    onChange={vi.fn()}
                    label="Required Field"
                    options={['Option 1']}
                    required={true}
                />
            )

            expect(screen.getByText('*')).toBeInTheDocument()
        })

        test('shows description', () => {
            render(
                <CheckboxInput
                    value={[]}
                    onChange={vi.fn()}
                    label="Choose Options"
                    options={['Option 1']}
                    description="Select all that apply"
                />
            )

            expect(screen.getByText('Select all that apply')).toBeInTheDocument()
        })

        test('shows validation errors', () => {
            render(
                <CheckboxInput
                    value={[]}
                    onChange={vi.fn()}
                    label="Choose Options"
                    options={['Option 1']}
                    validation={{
                        isValid: false,
                        errors: ['At least one option required']
                    }}
                />
            )

            expect(screen.getByText('At least one option required')).toBeInTheDocument()
        })

        test('disables all checkboxes when disabled', () => {
            render(
                <CheckboxInput
                    value={[]}
                    onChange={vi.fn()}
                    label="Choose Options"
                    options={['Option 1', 'Option 2']}
                    disabled={true}
                />
            )

            const checkboxes = screen.getAllByRole('checkbox')
            checkboxes.forEach(checkbox => {
                expect(checkbox).toBeDisabled()
            })
        })

        test('shows message when no options provided', () => {
            render(
                <CheckboxInput
                    value={[]}
                    onChange={vi.fn()}
                    label="Choose Options"
                    options={[]}
                />
            )

            expect(screen.getByText('No options available')).toBeInTheDocument()
        })
    })

    describe('Layout', () => {
        test('renders vertical layout by default', () => {
            const { container } = render(
                <CheckboxInput
                    value={[]}
                    onChange={vi.fn()}
                    label="Choose Options"
                    options={['Option 1', 'Option 2']}
                    layout="vertical"
                />
            )

            const layoutContainer = container.querySelector('.space-y-2')
            expect(layoutContainer).toBeInTheDocument()
        })

        test('renders horizontal layout when specified', () => {
            const { container } = render(
                <CheckboxInput
                    value={[]}
                    onChange={vi.fn()}
                    label="Choose Options"
                    options={['Option 1', 'Option 2']}
                    layout="horizontal"
                />
            )

            const layoutContainer = container.querySelector('.space-x-2')
            expect(layoutContainer).toBeInTheDocument()
        })
    })
})

