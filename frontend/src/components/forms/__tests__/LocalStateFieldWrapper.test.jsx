import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import LocalStateFieldWrapper from '../LocalStateFieldWrapper'
import { UnifiedDataProvider } from '../../../contexts/unified-data/v2/context/UnifiedDataContext'
import { FormCoordinationProvider } from '../../../contexts/unified-data/v2/context/FormCoordinationContext'

const TestWrapper = ({ children }) => (
    <UnifiedDataProvider>
        <FormCoordinationProvider>
            {children}
        </FormCoordinationProvider>
    </UnifiedDataProvider>
)

// Mock field component
const MockFieldComponent = React.memo(({ value, onChange, label, validation, ...props }) => (
    <div data-testid="mock-field">
        <label>{label}</label>
        <input
            data-testid="field-input"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            {...props}
        />
        {validation && !validation.isValid && (
            <div data-testid="validation-error">{validation.errors?.[0]}</div>
        )}
    </div>
))

MockFieldComponent.displayName = 'MockFieldComponent'

describe('LocalStateFieldWrapper', () => {
    const defaultProps = {
        fieldName: 'testField',
        initialValue: 'initial value',
        FieldComponent: MockFieldComponent,
        fieldProps: {
            label: 'Test Field',
            placeholder: 'Enter value...'
        },
        onFieldChange: vi.fn(),
        debounceMs: 100
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('renders field component with initial value', () => {
        render(
            <TestWrapper>
                <LocalStateFieldWrapper {...defaultProps} />
            </TestWrapper>
        )

        expect(screen.getByTestId('mock-field')).toBeInTheDocument()
        expect(screen.getByTestId('field-input')).toHaveValue('initial value')
        expect(screen.getByText('Test Field')).toBeInTheDocument()
    })

    test('manages local state independently', async () => {
        render(
            <TestWrapper>
                <LocalStateFieldWrapper {...defaultProps} />
            </TestWrapper>
        )

        const input = screen.getByTestId('field-input')

        // Change the input value
        fireEvent.change(input, { target: { value: 'new value' } })

        // Local state should update immediately
        expect(input).toHaveValue('new value')

        // Parent callback should be debounced
        expect(defaultProps.onFieldChange).not.toHaveBeenCalled()

        // Wait for debounce
        await waitFor(() => {
            expect(defaultProps.onFieldChange).toHaveBeenCalledWith('testField', 'new value')
        }, { timeout: 200 })
    })

    test('updates when initialValue prop changes', async () => {
        const { rerender } = render(
            <TestWrapper>
                <LocalStateFieldWrapper {...defaultProps} />
            </TestWrapper>
        )

        const input = screen.getByTestId('field-input')
        expect(input).toHaveValue('initial value')

        // Change initialValue prop
        rerender(
            <TestWrapper>
                <LocalStateFieldWrapper {...defaultProps} initialValue="updated value" />
            </TestWrapper>
        )

        await waitFor(() => {
            expect(input).toHaveValue('updated value')
        })
    })

    test('handles validation correctly', async () => {
        const mockValidation = vi.fn().mockResolvedValue({
            isValid: false,
            errors: ['Field is required'],
            warnings: []
        })

        render(
            <TestWrapper>
                <LocalStateFieldWrapper
                    {...defaultProps}
                    onFieldValidation={mockValidation}
                    validateOnChange={true}
                />
            </TestWrapper>
        )

        const input = screen.getByTestId('field-input')

        // Change input to trigger validation
        fireEvent.change(input, { target: { value: '' } })

        // Wait for validation
        await waitFor(() => {
            expect(screen.getByTestId('validation-error')).toHaveTextContent('Field is required')
        })
    })

    test('does not re-render parent when value changes', () => {
        let renderCount = 0
        const ParentComponent = ({ children }) => {
            renderCount++
            return <div>{children}</div>
        }

        render(
            <ParentComponent>
                <TestWrapper>
                    <LocalStateFieldWrapper {...defaultProps} />
                </TestWrapper>
            </ParentComponent>
        )

        const input = screen.getByTestId('field-input')
        const initialRenderCount = renderCount

        // Change input multiple times
        fireEvent.change(input, { target: { value: 'value 1' } })
        fireEvent.change(input, { target: { value: 'value 2' } })
        fireEvent.change(input, { target: { value: 'value 3' } })

        // Parent should not re-render due to local state changes
        expect(renderCount).toBe(initialRenderCount)
    })

    test('shows error when FieldComponent is not provided', () => {
        render(
            <TestWrapper>
                <LocalStateFieldWrapper {...defaultProps} FieldComponent={null} />
            </TestWrapper>
        )

        expect(screen.getByText(/Field component not provided/)).toBeInTheDocument()
        expect(screen.getByText(/testField/)).toBeInTheDocument()
    })

    test('filters out non-DOM props to prevent React warnings', () => {
        render(
            <TestWrapper>
                <LocalStateFieldWrapper {...defaultProps} />
            </TestWrapper>
        )

        const input = screen.getByTestId('field-input')
        // These props should be filtered out to avoid React DOM warnings
        expect(input).not.toHaveAttribute('data-field-name')
        expect(input).not.toHaveAttribute('data-local-state')
        expect(input).not.toHaveAttribute('isvalidating')
        expect(input).not.toHaveAttribute('isdirty')
        expect(input).not.toHaveAttribute('istouched')

        // But these standard props should still be present
        expect(input).toHaveAttribute('value')
        expect(input).toHaveAttribute('placeholder')
    })
})
