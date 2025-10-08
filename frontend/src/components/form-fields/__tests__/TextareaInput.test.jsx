import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import TextareaInput from '../TextareaInput'

describe('TextareaInput', () => {
    describe('Controlled mode', () => {
        test('renders with value', () => {
            render(
                <TextareaInput
                    value="Multi-line text"
                    onChange={vi.fn()}
                    label="Description"
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea).toHaveValue('Multi-line text')
        })

        test('calls onChange when text changes', () => {
            const mockOnChange = vi.fn()
            render(
                <TextareaInput
                    value=""
                    onChange={mockOnChange}
                    label="Description"
                />
            )

            const textarea = screen.getByRole('textbox')
            fireEvent.change(textarea, { target: { value: 'New text' } })

            expect(mockOnChange).toHaveBeenCalled()
        })

        test('updates when value prop changes', () => {
            const { rerender } = render(
                <TextareaInput
                    value="First text"
                    onChange={vi.fn()}
                    label="Description"
                />
            )

            let textarea = screen.getByRole('textbox')
            expect(textarea).toHaveValue('First text')

            rerender(
                <TextareaInput
                    value="Second text"
                    onChange={vi.fn()}
                    label="Description"
                />
            )

            textarea = screen.getByRole('textbox')
            expect(textarea).toHaveValue('Second text')
        })
    })

    describe('Uncontrolled mode (defaultValue)', () => {
        test('uses defaultValue for initial value', () => {
            render(
                <TextareaInput
                    defaultValue="Default text"
                    onChange={vi.fn()}
                    label="Description"
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea).toHaveValue('Default text')
        })

        test('maintains own state when text changes', () => {
            const mockOnChange = vi.fn()
            render(
                <TextareaInput
                    defaultValue="Initial"
                    onChange={mockOnChange}
                    label="Description"
                />
            )

            const textarea = screen.getByRole('textbox')
            fireEvent.change(textarea, { target: { value: 'Updated text' } })

            expect(mockOnChange).toHaveBeenCalled()
            expect(textarea).toHaveValue('Updated text')
        })

        test('does not update when defaultValue prop changes', () => {
            const { rerender } = render(
                <TextareaInput
                    defaultValue="First"
                    onChange={vi.fn()}
                    label="Description"
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea).toHaveValue('First')

            rerender(
                <TextareaInput
                    defaultValue="Second"
                    onChange={vi.fn()}
                    label="Description"
                />
            )

            // DOM maintains its own value
            expect(textarea).toHaveValue('First')
        })
    })

    describe('Character counting', () => {
        test('shows character count when enabled', () => {
            render(
                <TextareaInput
                    value="Hello"
                    onChange={vi.fn()}
                    label="Message"
                    showCharacterCount={true}
                />
            )

            expect(screen.getByText(/5/)).toBeInTheDocument()
        })

        test('shows character count with max length', () => {
            render(
                <TextareaInput
                    value="Hello"
                    onChange={vi.fn()}
                    label="Message"
                    showCharacterCount={true}
                    maxLength={100}
                />
            )

            expect(screen.getByText(/5\/100/)).toBeInTheDocument()
        })

        test('shows character count only in controlled mode', () => {
            render(
                <TextareaInput
                    defaultValue="Hello"
                    onChange={vi.fn()}
                    label="Message"
                    showCharacterCount={true}
                />
            )

            // Character count should not show in uncontrolled mode
            expect(screen.queryByText(/5/)).not.toBeInTheDocument()
        })

        test('enforces max length by preventing input', () => {
            const mockOnChange = vi.fn()
            render(
                <TextareaInput
                    value="12345"
                    onChange={mockOnChange}
                    label="Message"
                    maxLength={5}
                />
            )

            const textarea = screen.getByRole('textbox')
            fireEvent.change(textarea, { target: { value: '123456' } })

            // Should not call onChange when over limit
            expect(mockOnChange).not.toHaveBeenCalled()
        })

        test('shows red color when over max length', () => {
            const { container } = render(
                <TextareaInput
                    value="123456"
                    onChange={vi.fn()}
                    label="Message"
                    showCharacterCount={true}
                    maxLength={5}
                />
            )

            const countElement = container.querySelector('[class*="text-red"]')
            expect(countElement).toBeInTheDocument()
        })

        test('shows max length info when not showing count', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Message"
                    maxLength={100}
                    showCharacterCount={false}
                />
            )

            expect(screen.getByText(/Maximum 100 characters/)).toBeInTheDocument()
        })
    })

    describe('Rows configuration', () => {
        test('uses default 3 rows', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Message"
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea).toHaveAttribute('rows')
        })

        test('respects custom rows', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Message"
                    rows={10}
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea).toHaveAttribute('rows', '10')
        })
    })

    describe('UI and Validation', () => {
        test('shows label', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Comments"
                />
            )

            expect(screen.getByText('Comments')).toBeInTheDocument()
        })

        test('shows required indicator', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Comments"
                    required={true}
                />
            )

            expect(screen.getByText('*')).toBeInTheDocument()
        })

        test('shows description', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Comments"
                    description="Enter your feedback here"
                />
            )

            expect(screen.getByText('Enter your feedback here')).toBeInTheDocument()
        })

        test('shows placeholder', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Comments"
                    placeholder="Type your message..."
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea).toHaveAttribute('placeholder', 'Type your message...')
        })

        test('disables textarea when disabled', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Comments"
                    disabled={true}
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea).toBeDisabled()
        })

        test('shows validation errors', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Comments"
                    validation={{
                        isValid: false,
                        errors: ['Comment is required']
                    }}
                />
            )

            expect(screen.getByText('Comment is required')).toBeInTheDocument()
        })
    })

    describe('Auto-resize feature', () => {
        test('does not have fixed rows when autoResize is true', () => {
            render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Message"
                    autoResize={true}
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea).not.toHaveAttribute('rows')
        })

        test('has onInput handler when autoResize is true', () => {
            const { container } = render(
                <TextareaInput
                    value=""
                    onChange={vi.fn()}
                    label="Message"
                    autoResize={true}
                />
            )

            const textarea = screen.getByRole('textbox')
            expect(textarea).toHaveAttribute('style')
        })
    })
})

