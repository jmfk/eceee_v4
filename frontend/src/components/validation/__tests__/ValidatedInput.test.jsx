import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import ValidatedInput from '../ValidatedInput'

describe('ValidatedInput', () => {
    describe('Controlled mode', () => {
        test('renders text input with value', () => {
            render(
                <ValidatedInput
                    type="text"
                    value="test value"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveValue('test value')
        })

        test('calls onChange when input changes', () => {
            const mockOnChange = vi.fn()
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={mockOnChange}
                    label="Test Field"
                />
            )

            const input = screen.getByRole('textbox')
            fireEvent.change(input, { target: { value: 'new value' } })

            expect(mockOnChange).toHaveBeenCalledWith('new value')
        })

        test('updates when value prop changes', () => {
            const { rerender } = render(
                <ValidatedInput
                    type="text"
                    value="first"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            let input = screen.getByRole('textbox')
            expect(input).toHaveValue('first')

            rerender(
                <ValidatedInput
                    type="text"
                    value="second"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            input = screen.getByRole('textbox')
            expect(input).toHaveValue('second')
        })
    })

    describe('Uncontrolled mode (defaultValue)', () => {
        test('renders text input with defaultValue', () => {
            render(
                <ValidatedInput
                    type="text"
                    defaultValue="default text"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveValue('default text')
        })

        test('calls onChange but maintains DOM state', () => {
            const mockOnChange = vi.fn()
            render(
                <ValidatedInput
                    type="text"
                    defaultValue="initial"
                    onChange={mockOnChange}
                    label="Test Field"
                />
            )

            const input = screen.getByRole('textbox')
            fireEvent.change(input, { target: { value: 'changed' } })

            expect(mockOnChange).toHaveBeenCalledWith('changed')
            expect(input).toHaveValue('changed')
        })

        test('does not update when defaultValue prop changes', () => {
            const { rerender } = render(
                <ValidatedInput
                    type="text"
                    defaultValue="first"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveValue('first')

            rerender(
                <ValidatedInput
                    type="text"
                    defaultValue="second"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            // DOM maintains its own value
            expect(input).toHaveValue('first')
        })

        test('defaults to empty string when neither value nor defaultValue provided', () => {
            render(
                <ValidatedInput
                    type="text"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveValue('')
        })
    })

    describe('Input types', () => {
        test('renders textarea when type is textarea', () => {
            render(
                <ValidatedInput
                    type="textarea"
                    value="text content"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea.tagName).toBe('TEXTAREA')
        })

        test('renders select when type is select', () => {
            render(
                <ValidatedInput
                    type="select"
                    value="option1"
                    onChange={vi.fn()}
                    label="Test Field"
                >
                    <option value="option1">Option 1</option>
                    <option value="option2">Option 2</option>
                </ValidatedInput>
            )

            const select = screen.getByRole('combobox')
            expect(select).toBeInTheDocument()
        })

        test('renders number input when type is number', () => {
            render(
                <ValidatedInput
                    type="number"
                    value="42"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('type', 'number')
        })

        test('renders email input when type is email', () => {
            render(
                <ValidatedInput
                    type="email"
                    value="test@example.com"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveAttribute('type', 'email')
        })

        test('renders password input when type is password', () => {
            const { container } = render(
                <ValidatedInput
                    type="password"
                    value="secret"
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            const input = container.querySelector('input[type="password"]')
            expect(input).toBeInTheDocument()
        })
    })

    describe('Validation states', () => {
        test('shows error border when validation fails', () => {
            const { container } = render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Test Field"
                    validation={{
                        isValid: false,
                        errors: ['This field is required']
                    }}
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveClass('border-red-300')
        })

        test('shows error message', () => {
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Test Field"
                    validation={{
                        isValid: false,
                        errors: ['This field is required']
                    }}
                />
            )

            expect(screen.getByText('This field is required')).toBeInTheDocument()
        })

        test('shows warning border when validation has warnings', () => {
            const { container } = render(
                <ValidatedInput
                    type="text"
                    value="test"
                    onChange={vi.fn()}
                    label="Test Field"
                    validation={{
                        isValid: true,
                        warnings: ['This value is unusual']
                    }}
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveClass('border-yellow-300')
        })

        test('shows validating state', () => {
            const { container } = render(
                <ValidatedInput
                    type="text"
                    value="test"
                    onChange={vi.fn()}
                    label="Test Field"
                    isValidating={true}
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveClass('border-blue-300')
        })

        test('hides validation when showValidation is false', () => {
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Test Field"
                    validation={{
                        isValid: false,
                        errors: ['Error message']
                    }}
                    showValidation={false}
                />
            )

            expect(screen.queryByText('Error message')).not.toBeInTheDocument()
        })
    })

    describe('UI features', () => {
        test('shows label', () => {
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Username"
                />
            )

            expect(screen.getByText('Username')).toBeInTheDocument()
        })

        test('shows required indicator', () => {
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Email"
                    required={true}
                />
            )

            expect(screen.getByText('*')).toBeInTheDocument()
        })

        test('shows description', () => {
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Test Field"
                    description="Enter your information here"
                />
            )

            expect(screen.getByText('Enter your information here')).toBeInTheDocument()
        })

        test('shows placeholder', () => {
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Test Field"
                    placeholder="Type here..."
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toHaveAttribute('placeholder', 'Type here...')
        })

        test('disables input when disabled', () => {
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Test Field"
                    disabled={true}
                />
            )

            const input = screen.getByRole('textbox')
            expect(input).toBeDisabled()
        })
    })

    describe('Focus states', () => {
        test('applies focus styles when focused', () => {
            const { container } = render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Test Field"
                />
            )

            const input = screen.getByRole('textbox')
            fireEvent.focus(input)

            expect(input).toHaveClass('border-blue-500')
        })

        test('calls onFocus handler', () => {
            const mockOnFocus = vi.fn()
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Test Field"
                    onFocus={mockOnFocus}
                />
            )

            const input = screen.getByRole('textbox')
            fireEvent.focus(input)

            expect(mockOnFocus).toHaveBeenCalled()
        })

        test('calls onBlur handler', () => {
            const mockOnBlur = vi.fn()
            render(
                <ValidatedInput
                    type="text"
                    value=""
                    onChange={vi.fn()}
                    label="Test Field"
                    onBlur={mockOnBlur}
                />
            )

            const input = screen.getByRole('textbox')
            fireEvent.blur(input)

            expect(mockOnBlur).toHaveBeenCalled()
        })
    })
})

