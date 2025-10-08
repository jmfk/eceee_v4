import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import RadioInput from '../RadioInput'

describe('RadioInput', () => {
    const options = ['Option 1', 'Option 2', 'Option 3']
    const objectOptions = [
        { value: 'opt1', label: 'Option 1' },
        { value: 'opt2', label: 'Option 2' },
        { value: 'opt3', label: 'Option 3' }
    ]

    describe('Controlled mode', () => {
        test('renders all options', () => {
            render(
                <RadioInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            expect(screen.getByText('Option 1')).toBeInTheDocument()
            expect(screen.getByText('Option 2')).toBeInTheDocument()
            expect(screen.getByText('Option 3')).toBeInTheDocument()
        })

        test('selects initial value', () => {
            render(
                <RadioInput
                    value="Option 2"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            const radios = screen.getAllByRole('radio')
            expect(radios[1]).toBeChecked()
            expect(radios[0]).not.toBeChecked()
            expect(radios[2]).not.toBeChecked()
        })

        test('calls onChange when option selected', () => {
            const mockOnChange = vi.fn()
            render(
                <RadioInput
                    value=""
                    onChange={mockOnChange}
                    label="Choose One"
                    options={options}
                />
            )

            const radios = screen.getAllByRole('radio')
            fireEvent.click(radios[1])

            expect(mockOnChange).toHaveBeenCalledWith('Option 2')
        })

        test('works with object options', () => {
            const mockOnChange = vi.fn()
            render(
                <RadioInput
                    value="opt1"
                    onChange={mockOnChange}
                    label="Choose One"
                    options={objectOptions}
                />
            )

            const radios = screen.getAllByRole('radio')
            expect(radios[0]).toBeChecked()

            fireEvent.click(radios[2])
            expect(mockOnChange).toHaveBeenCalledWith('opt3')
        })

        test('updates when value prop changes', () => {
            const { rerender } = render(
                <RadioInput
                    value="Option 1"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            let radios = screen.getAllByRole('radio')
            expect(radios[0]).toBeChecked()

            rerender(
                <RadioInput
                    value="Option 3"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            radios = screen.getAllByRole('radio')
            expect(radios[2]).toBeChecked()
            expect(radios[0]).not.toBeChecked()
        })
    })

    describe('Uncontrolled mode (defaultValue)', () => {
        test('uses defaultValue for initial selection', () => {
            render(
                <RadioInput
                    defaultValue="Option 2"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            const radios = screen.getAllByRole('radio')
            expect(radios[1]).toBeChecked()
        })

        test('calls onChange when selected', () => {
            const mockOnChange = vi.fn()
            render(
                <RadioInput
                    defaultValue="Option 1"
                    onChange={mockOnChange}
                    label="Choose One"
                    options={options}
                />
            )

            const radios = screen.getAllByRole('radio')
            fireEvent.click(radios[2])

            expect(mockOnChange).toHaveBeenCalledWith('Option 3')
        })

        test('does not update when defaultValue prop changes', () => {
            const { rerender } = render(
                <RadioInput
                    defaultValue="Option 1"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            let radios = screen.getAllByRole('radio')
            expect(radios[0]).toBeChecked()

            // Change defaultValue - should not affect rendered value
            rerender(
                <RadioInput
                    defaultValue="Option 3"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            radios = screen.getAllByRole('radio')
            // Still checked on first option (DOM maintains state)
            expect(radios[0]).toBeChecked()
        })
    })

    describe('Layout', () => {
        test('renders vertical layout by default', () => {
            const { container } = render(
                <RadioInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                    layout="vertical"
                />
            )

            const layoutContainer = container.querySelector('.space-y-2')
            expect(layoutContainer).toBeInTheDocument()
        })

        test('renders horizontal layout when specified', () => {
            const { container } = render(
                <RadioInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                    layout="horizontal"
                />
            )

            const layoutContainer = container.querySelector('.space-x-2')
            expect(layoutContainer).toBeInTheDocument()
        })
    })

    describe('Validation and UI', () => {
        test('shows label', () => {
            render(
                <RadioInput
                    value=""
                    onChange={vi.fn()}
                    label="Select an Option"
                    options={options}
                />
            )

            expect(screen.getByText('Select an Option')).toBeInTheDocument()
        })

        test('shows required indicator', () => {
            render(
                <RadioInput
                    value=""
                    onChange={vi.fn()}
                    label="Required Field"
                    options={options}
                    required={true}
                />
            )

            expect(screen.getByText('*')).toBeInTheDocument()
        })

        test('shows description', () => {
            render(
                <RadioInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                    description="Pick your favorite option"
                />
            )

            expect(screen.getByText('Pick your favorite option')).toBeInTheDocument()
        })

        test('shows validation errors', () => {
            render(
                <RadioInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                    validation={{
                        isValid: false,
                        errors: ['Selection is required']
                    }}
                />
            )

            expect(screen.getByText('Selection is required')).toBeInTheDocument()
        })

        test('disables all options when disabled', () => {
            render(
                <RadioInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                    disabled={true}
                />
            )

            const radios = screen.getAllByRole('radio')
            radios.forEach(radio => {
                expect(radio).toBeDisabled()
            })
        })

        test('shows message when no options provided', () => {
            render(
                <RadioInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={[]}
                />
            )

            expect(screen.getByText('No options available')).toBeInTheDocument()
        })
    })
})

