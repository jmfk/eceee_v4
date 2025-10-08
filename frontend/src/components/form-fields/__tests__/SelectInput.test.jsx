import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import SelectInput from '../SelectInput'

describe('SelectInput', () => {
    const options = ['Option 1', 'Option 2', 'Option 3']
    const objectOptions = [
        { value: 'opt1', label: 'Option 1' },
        { value: 'opt2', label: 'Option 2' },
        { value: 'opt3', label: 'Option 3' }
    ]

    describe('Controlled mode', () => {
        test('renders with all options', () => {
            render(
                <SelectInput
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

        test('shows selected value', () => {
            render(
                <SelectInput
                    value="Option 2"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            const select = screen.getByRole('combobox')
            expect(select).toHaveValue('Option 2')
        })

        test('calls onChange when option selected', () => {
            const mockOnChange = vi.fn()
            render(
                <SelectInput
                    value=""
                    onChange={mockOnChange}
                    label="Choose One"
                    options={options}
                />
            )

            const select = screen.getByRole('combobox')
            fireEvent.change(select, { target: { value: 'Option 3' } })

            expect(mockOnChange).toHaveBeenCalledWith('Option 3')
        })

        test('works with object options', () => {
            render(
                <SelectInput
                    value="opt2"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={objectOptions}
                />
            )

            const select = screen.getByRole('combobox')
            expect(select).toHaveValue('opt2')
            expect(screen.getByText('Option 2')).toBeInTheDocument()
        })

        test('shows placeholder option when not required', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                    placeholder="Select an option..."
                />
            )

            expect(screen.getByText('Select an option...')).toBeInTheDocument()
        })

        test('does not show placeholder when required', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                    required={true}
                    placeholder="Select an option..."
                />
            )

            expect(screen.queryByText('Select an option...')).not.toBeInTheDocument()
        })
    })

    describe('Uncontrolled mode (defaultValue)', () => {
        test('uses defaultValue for initial selection', () => {
            render(
                <SelectInput
                    defaultValue="Option 2"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            const select = screen.getByRole('combobox')
            expect(select).toHaveValue('Option 2')
        })

        test('calls onChange when selection changes', () => {
            const mockOnChange = vi.fn()
            render(
                <SelectInput
                    defaultValue="Option 1"
                    onChange={mockOnChange}
                    label="Choose One"
                    options={options}
                />
            )

            const select = screen.getByRole('combobox')
            fireEvent.change(select, { target: { value: 'Option 3' } })

            expect(mockOnChange).toHaveBeenCalledWith('Option 3')
            expect(select).toHaveValue('Option 3')
        })

        test('does not update when defaultValue prop changes', () => {
            const { rerender } = render(
                <SelectInput
                    defaultValue="Option 1"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            const select = screen.getByRole('combobox')
            expect(select).toHaveValue('Option 1')

            rerender(
                <SelectInput
                    defaultValue="Option 3"
                    onChange={vi.fn()}
                    label="Choose One"
                    options={options}
                />
            )

            // DOM maintains its own value
            expect(select).toHaveValue('Option 1')
        })
    })

    describe('UI and Validation', () => {
        test('shows label', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Country"
                    options={['USA', 'Canada']}
                />
            )

            expect(screen.getByText('Country')).toBeInTheDocument()
        })

        test('shows required indicator', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Country"
                    options={['USA']}
                    required={true}
                />
            )

            expect(screen.getByText('*')).toBeInTheDocument()
        })

        test('shows description', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Country"
                    options={['USA']}
                    description="Select your country"
                />
            )

            expect(screen.getByText('Select your country')).toBeInTheDocument()
        })

        test('disables select when disabled', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Country"
                    options={['USA']}
                    disabled={true}
                />
            )

            const select = screen.getByRole('combobox')
            expect(select).toBeDisabled()
        })

        test('shows validation errors', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Country"
                    options={['USA']}
                    validation={{
                        isValid: false,
                        errors: ['Please select a country']
                    }}
                />
            )

            expect(screen.getByText('Please select a country')).toBeInTheDocument()
        })
    })

    describe('Option normalization', () => {
        test('handles string array options', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={['A', 'B', 'C']}
                />
            )

            expect(screen.getByText('A')).toBeInTheDocument()
            expect(screen.getByText('B')).toBeInTheDocument()
            expect(screen.getByText('C')).toBeInTheDocument()
        })

        test('handles object array options', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={[
                        { value: 'a', label: 'Alpha' },
                        { value: 'b', label: 'Beta' }
                    ]}
                />
            )

            expect(screen.getByText('Alpha')).toBeInTheDocument()
            expect(screen.getByText('Beta')).toBeInTheDocument()
        })

        test('handles empty options array', () => {
            render(
                <SelectInput
                    value=""
                    onChange={vi.fn()}
                    label="Choose One"
                    options={[]}
                />
            )

            const select = screen.getByRole('combobox')
            expect(select).toBeInTheDocument()
        })
    })
})

