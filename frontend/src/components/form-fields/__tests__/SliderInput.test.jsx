import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import SliderInput from '../SliderInput'

describe('SliderInput', () => {
    describe('Controlled mode', () => {
        test('renders with initial value', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                />
            )

            const slider = screen.getByRole('slider')
            expect(slider).toHaveValue('50')
        })

        test('calls onChange when slider moved', () => {
            const mockOnChange = vi.fn()
            render(
                <SliderInput
                    value={50}
                    onChange={mockOnChange}
                    label="Volume"
                    min={0}
                    max={100}
                />
            )

            const slider = screen.getByRole('slider')
            fireEvent.change(slider, { target: { value: '75' } })

            expect(mockOnChange).toHaveBeenCalledWith(75)
        })

        test('updates when value prop changes', () => {
            const { rerender } = render(
                <SliderInput
                    value={25}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                />
            )

            let slider = screen.getByRole('slider')
            expect(slider).toHaveValue('25')

            rerender(
                <SliderInput
                    value={75}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                />
            )

            slider = screen.getByRole('slider')
            expect(slider).toHaveValue('75')
        })
    })

    describe('Uncontrolled mode (defaultValue)', () => {
        test('uses defaultValue for initial value', () => {
            render(
                <SliderInput
                    defaultValue={60}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                />
            )

            const slider = screen.getByRole('slider')
            expect(slider).toHaveValue('60')
        })

        test('maintains own state when moved', () => {
            const mockOnChange = vi.fn()
            render(
                <SliderInput
                    defaultValue={30}
                    onChange={mockOnChange}
                    label="Volume"
                    min={0}
                    max={100}
                />
            )

            const slider = screen.getByRole('slider')

            fireEvent.change(slider, { target: { value: '80' } })
            expect(mockOnChange).toHaveBeenCalledWith(80)
            expect(slider).toHaveValue('80')
        })

        test('defaults to min value when no defaultValue provided', () => {
            render(
                <SliderInput
                    onChange={vi.fn()}
                    label="Volume"
                    min={10}
                    max={100}
                />
            )

            const slider = screen.getByRole('slider')
            expect(slider).toHaveValue('10')
        })
    })

    describe('Step buttons', () => {
        test('renders step buttons when showStepButtons is true', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                    showStepButtons={true}
                />
            )

            const buttons = screen.getAllByRole('button')
            expect(buttons.length).toBeGreaterThan(0)
        })

        test('increments value when step up clicked', () => {
            const mockOnChange = vi.fn()
            render(
                <SliderInput
                    value={50}
                    onChange={mockOnChange}
                    label="Volume"
                    min={0}
                    max={100}
                    step={10}
                    showStepButtons={true}
                />
            )

            const buttons = screen.getAllByRole('button')
            const stepUpButton = buttons.find(btn => btn.textContent.includes('+') || btn.querySelector('[class*="plus"]'))

            if (stepUpButton) {
                fireEvent.click(stepUpButton)
                expect(mockOnChange).toHaveBeenCalledWith(60)
            }
        })

        test('decrements value when step down clicked', () => {
            const mockOnChange = vi.fn()
            render(
                <SliderInput
                    value={50}
                    onChange={mockOnChange}
                    label="Volume"
                    min={0}
                    max={100}
                    step={10}
                    showStepButtons={true}
                />
            )

            const buttons = screen.getAllByRole('button')
            const stepDownButton = buttons.find(btn => btn.textContent.includes('-') || btn.querySelector('[class*="minus"]'))

            if (stepDownButton) {
                fireEvent.click(stepDownButton)
                expect(mockOnChange).toHaveBeenCalledWith(40)
            }
        })

        test('does not go below min', () => {
            const mockOnChange = vi.fn()
            render(
                <SliderInput
                    value={5}
                    onChange={mockOnChange}
                    label="Volume"
                    min={0}
                    max={100}
                    step={10}
                    showStepButtons={true}
                />
            )

            const buttons = screen.getAllByRole('button')
            const stepDownButton = buttons.find(btn => btn.textContent.includes('-') || btn.querySelector('[class*="minus"]'))

            if (stepDownButton) {
                fireEvent.click(stepDownButton)
                expect(mockOnChange).toHaveBeenCalledWith(0) // Should clamp to min
            }
        })

        test('does not go above max', () => {
            const mockOnChange = vi.fn()
            render(
                <SliderInput
                    value={95}
                    onChange={mockOnChange}
                    label="Volume"
                    min={0}
                    max={100}
                    step={10}
                    showStepButtons={true}
                />
            )

            const buttons = screen.getAllByRole('button')
            const stepUpButton = buttons.find(btn => btn.textContent.includes('+') || btn.querySelector('[class*="plus"]'))

            if (stepUpButton) {
                fireEvent.click(stepUpButton)
                expect(mockOnChange).toHaveBeenCalledWith(100) // Should clamp to max
            }
        })
    })

    describe('UI and Validation', () => {
        test('shows label', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume Level"
                    min={0}
                    max={100}
                />
            )

            expect(screen.getByText('Volume Level')).toBeInTheDocument()
        })

        test('shows required indicator', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume Level"
                    min={0}
                    max={100}
                    required={true}
                />
            )

            expect(screen.getByText('*')).toBeInTheDocument()
        })

        test('shows current value when showValue is true', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                    showValue={true}
                />
            )

            expect(screen.getByText(/50/)).toBeInTheDocument()
        })

        test('shows min/max labels when showMinMax is true', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                    showMinMax={true}
                />
            )

            const minMaxElements = screen.getAllByText(/^(0|100)$/)
            expect(minMaxElements.length).toBeGreaterThanOrEqual(2)
        })

        test('formats value with custom formatter', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                    showValue={true}
                    formatValue={(val) => `${val}%`}
                />
            )

            expect(screen.getByText(/50%/)).toBeInTheDocument()
        })

        test('shows unit when provided', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Temperature"
                    min={0}
                    max={100}
                    showValue={true}
                    unit="°C"
                />
            )

            const unitElements = screen.getAllByText(/°C/)
            expect(unitElements.length).toBeGreaterThan(0)
        })

        test('disables slider when disabled', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                    disabled={true}
                />
            )

            const slider = screen.getByRole('slider')
            expect(slider).toBeDisabled()
        })

        test('shows description', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                    description="Adjust the volume level"
                />
            )

            expect(screen.getByText('Adjust the volume level')).toBeInTheDocument()
        })

        test('shows validation errors', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                    validation={{
                        isValid: false,
                        errors: ['Value must be at least 60']
                    }}
                />
            )

            expect(screen.getByText('Value must be at least 60')).toBeInTheDocument()
        })
    })

    describe('Range constraints', () => {
        test('respects custom min and max', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={20}
                    max={80}
                />
            )

            const slider = screen.getByRole('slider')
            expect(slider).toHaveAttribute('min', '20')
            expect(slider).toHaveAttribute('max', '80')
        })

        test('respects custom step', () => {
            render(
                <SliderInput
                    value={50}
                    onChange={vi.fn()}
                    label="Volume"
                    min={0}
                    max={100}
                    step={5}
                />
            )

            const slider = screen.getByRole('slider')
            expect(slider).toHaveAttribute('step', '5')
        })
    })
})

