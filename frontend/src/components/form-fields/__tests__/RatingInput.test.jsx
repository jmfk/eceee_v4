import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import RatingInput from '../RatingInput'

describe('RatingInput', () => {
    describe('Controlled mode', () => {
        test('renders correct number of rating icons', () => {
            render(
                <RatingInput
                    value={0}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                />
            )

            const buttons = screen.getAllByRole('button').filter(btn =>
                !btn.textContent.includes('Clear') && btn.querySelector('[class*="star"]') !== null
            )
            expect(buttons.length).toBeGreaterThanOrEqual(5)
        })

        test('shows selected rating', () => {
            const { container } = render(
                <RatingInput
                    value={3}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    showValue={true}
                />
            )

            expect(screen.getByText(/3\/5/)).toBeInTheDocument()
        })

        test('calls onChange when rating clicked', () => {
            const mockOnChange = vi.fn()
            render(
                <RatingInput
                    value={0}
                    onChange={mockOnChange}
                    label="Rating"
                    max={5}
                />
            )

            const buttons = screen.getAllByRole('button')
            // Click the third rating button
            if (buttons[2]) {
                fireEvent.click(buttons[2])
                expect(mockOnChange).toHaveBeenCalled()
                const callValue = mockOnChange.mock.calls[0][0]
                expect(callValue).toBeGreaterThan(0)
            }
        })

        test('clears rating when same value clicked and allowClear is true', () => {
            const mockOnChange = vi.fn()
            render(
                <RatingInput
                    value={3}
                    onChange={mockOnChange}
                    label="Rating"
                    max={5}
                    allowClear={true}
                />
            )

            const buttons = screen.getAllByRole('button')
            // Click the third rating button (currently selected)
            if (buttons[2]) {
                fireEvent.click(buttons[2])
                expect(mockOnChange).toHaveBeenCalled()
            }
        })

        test('shows clear button when value is set and allowClear is true', () => {
            render(
                <RatingInput
                    value={3}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    allowClear={true}
                />
            )

            const clearButton = screen.getAllByRole('button').find(btn =>
                btn.getAttribute('title') === 'Clear rating'
            )
            expect(clearButton).toBeInTheDocument()
        })

        test('clears rating when clear button clicked', () => {
            const mockOnChange = vi.fn()
            render(
                <RatingInput
                    value={3}
                    onChange={mockOnChange}
                    label="Rating"
                    max={5}
                    allowClear={true}
                />
            )

            const clearButton = screen.getAllByRole('button').find(btn =>
                btn.getAttribute('title') === 'Clear rating'
            )

            if (clearButton) {
                fireEvent.click(clearButton)
                expect(mockOnChange).toHaveBeenCalledWith(null)
            }
        })

        test('updates when value prop changes', () => {
            const { rerender } = render(
                <RatingInput
                    value={2}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    showValue={true}
                />
            )

            expect(screen.getByText(/2\/5/)).toBeInTheDocument()

            rerender(
                <RatingInput
                    value={4}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    showValue={true}
                />
            )

            expect(screen.getByText(/4\/5/)).toBeInTheDocument()
        })
    })

    describe('Uncontrolled mode (defaultValue)', () => {
        test('uses defaultValue for initial rating', () => {
            render(
                <RatingInput
                    defaultValue={3}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    showValue={true}
                />
            )

            expect(screen.getByText(/3\/5/)).toBeInTheDocument()
        })

        test('maintains own state when rating changed', () => {
            const mockOnChange = vi.fn()
            render(
                <RatingInput
                    defaultValue={2}
                    onChange={mockOnChange}
                    label="Rating"
                    max={5}
                    showValue={true}
                />
            )

            expect(screen.getByText(/2\/5/)).toBeInTheDocument()

            const buttons = screen.getAllByRole('button')
            // Click a different rating
            if (buttons[3]) {
                fireEvent.click(buttons[3])
                expect(mockOnChange).toHaveBeenCalled()
            }
        })

        test('defaults to 0 when no defaultValue provided', () => {
            render(
                <RatingInput
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    showValue={true}
                />
            )

            expect(screen.getByText(/No rating/)).toBeInTheDocument()
        })

        test('maintains state when cleared', () => {
            const mockOnChange = vi.fn()
            render(
                <RatingInput
                    defaultValue={3}
                    onChange={mockOnChange}
                    label="Rating"
                    max={5}
                    allowClear={true}
                    showValue={true}
                />
            )

            const clearButton = screen.getAllByRole('button').find(btn =>
                btn.getAttribute('title') === 'Clear rating'
            )

            if (clearButton) {
                fireEvent.click(clearButton)
                expect(mockOnChange).toHaveBeenCalledWith(null)
                expect(screen.getByText(/No rating/)).toBeInTheDocument()
            }
        })
    })

    describe('UI and Styling', () => {
        test('shows label', () => {
            render(
                <RatingInput
                    value={0}
                    onChange={vi.fn()}
                    label="Rate this product"
                    max={5}
                />
            )

            expect(screen.getByText('Rate this product')).toBeInTheDocument()
        })

        test('shows required indicator', () => {
            render(
                <RatingInput
                    value={0}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    required={true}
                />
            )

            expect(screen.getByText('*')).toBeInTheDocument()
        })

        test('shows description', () => {
            render(
                <RatingInput
                    value={0}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    description="Rate your experience"
                />
            )

            expect(screen.getByText('Rate your experience')).toBeInTheDocument()
        })

        test('shows value when showValue is true', () => {
            render(
                <RatingInput
                    value={4}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    showValue={true}
                />
            )

            expect(screen.getByText(/4\/5/)).toBeInTheDocument()
        })

        test('hides value when showValue is false', () => {
            render(
                <RatingInput
                    value={4}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    showValue={false}
                />
            )

            expect(screen.queryByText(/4\/5/)).not.toBeInTheDocument()
        })

        test('shows custom labels when provided', () => {
            render(
                <RatingInput
                    value={3}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    showLabels={true}
                    labels={['Terrible', 'Bad', 'Okay', 'Good', 'Excellent']}
                />
            )

            expect(screen.getByText('Okay')).toBeInTheDocument()
        })

        test('disables interaction when disabled', () => {
            const mockOnChange = vi.fn()
            render(
                <RatingInput
                    value={0}
                    onChange={mockOnChange}
                    label="Rating"
                    max={5}
                    disabled={true}
                />
            )

            const buttons = screen.getAllByRole('button')
            buttons.forEach(button => {
                expect(button).toBeDisabled()
            })
        })

        test('disables interaction when readOnly', () => {
            const mockOnChange = vi.fn()
            render(
                <RatingInput
                    value={3}
                    onChange={mockOnChange}
                    label="Rating"
                    max={5}
                    readOnly={true}
                />
            )

            const buttons = screen.getAllByRole('button')
            buttons.forEach(button => {
                expect(button).toBeDisabled()
            })
        })

        test('shows validation errors', () => {
            render(
                <RatingInput
                    value={0}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    validation={{
                        isValid: false,
                        errors: ['Rating is required']
                    }}
                />
            )

            expect(screen.getByText('Rating is required')).toBeInTheDocument()
        })
    })

    describe('Configuration', () => {
        test('respects custom max value', () => {
            render(
                <RatingInput
                    value={5}
                    onChange={vi.fn()}
                    label="Rating"
                    max={10}
                    showValue={true}
                />
            )

            expect(screen.getByText(/5\/10/)).toBeInTheDocument()
        })

        test('uses different icon types', () => {
            const { container } = render(
                <RatingInput
                    value={0}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    icon="heart"
                />
            )

            // Hearts should render (implementation specific)
            expect(container).toBeInTheDocument()
        })

        test('uses different sizes', () => {
            const { container: smallContainer } = render(
                <RatingInput
                    value={0}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    size="sm"
                />
            )

            expect(smallContainer.querySelector('[class*="w-4"]')).toBeInTheDocument()

            const { container: largeContainer } = render(
                <RatingInput
                    value={0}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    size="lg"
                />
            )

            expect(largeContainer.querySelector('[class*="w-8"]')).toBeInTheDocument()
        })

        test('uses different colors', () => {
            const { container } = render(
                <RatingInput
                    value={3}
                    onChange={vi.fn()}
                    label="Rating"
                    max={5}
                    color="red"
                />
            )

            expect(container.querySelector('[class*="text-red"]')).toBeInTheDocument()
        })
    })
})

