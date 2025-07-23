import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorPopupProvider, useErrorPopupContext } from '../ErrorPopupManager'

// Test component that uses the error popup context
const TestComponent = ({ showErrorOnMount = false }) => {
    const { showError, errors, removeError } = useErrorPopupContext()

    if (showErrorOnMount) {
        showError(new Error('Test error on mount'))
    }

    return (
        <div>
            <button onClick={() => showError(new Error('Test error'))}>
                Show Error
            </button>
            <button onClick={() => showError(new Error('Test warning'), 'warning')}>
                Show Warning
            </button>
            <button onClick={() => showError(new Error('Test info'), 'info')}>
                Show Info
            </button>
            <button onClick={() => errors.length > 0 && removeError(errors[0].id)}>
                Remove First Error
            </button>
            <div data-testid="error-count">{errors.length}</div>
        </div>
    )
}

describe('ErrorPopupManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('provides error popup context to children', () => {
        render(
            <ErrorPopupProvider>
                <TestComponent />
            </ErrorPopupProvider>
        )

        expect(screen.getByText('Show Error')).toBeInTheDocument()
        expect(screen.getByText('Show Warning')).toBeInTheDocument()
        expect(screen.getByText('Show Info')).toBeInTheDocument()
    })

    it('shows error popup when showError is called', async () => {
        const user = userEvent.setup()

        render(
            <ErrorPopupProvider>
                <TestComponent />
            </ErrorPopupProvider>
        )

        await user.click(screen.getByText('Show Error'))

        await waitFor(() => {
            expect(screen.getByText('Error')).toBeInTheDocument()
            expect(screen.getByText('Test error')).toBeInTheDocument()
        })
    })

    it('shows warning popup when showError is called with warning type', async () => {
        const user = userEvent.setup()

        render(
            <ErrorPopupProvider>
                <TestComponent />
            </ErrorPopupProvider>
        )

        await user.click(screen.getByText('Show Warning'))

        await waitFor(() => {
            expect(screen.getByText('Warning')).toBeInTheDocument()
            expect(screen.getByText('Test warning')).toBeInTheDocument()
        })
    })

    it('shows info popup when showError is called with info type', async () => {
        const user = userEvent.setup()

        render(
            <ErrorPopupProvider>
                <TestComponent />
            </ErrorPopupProvider>
        )

        await user.click(screen.getByText('Show Info'))

        await waitFor(() => {
            expect(screen.getByText('Information')).toBeInTheDocument()
            expect(screen.getByText('Test info')).toBeInTheDocument()
        })
    })

    it('removes error when close button is clicked', async () => {
        const user = userEvent.setup()

        render(
            <ErrorPopupProvider>
                <TestComponent />
            </ErrorPopupProvider>
        )

        // Show an error
        await user.click(screen.getByText('Show Error'))

        await waitFor(() => {
            expect(screen.getByText('Error')).toBeInTheDocument()
        })

        // Close the error
        await user.click(screen.getByRole('button', { name: 'Close' }))

        await waitFor(() => {
            expect(screen.queryByText('Error')).not.toBeInTheDocument()
        })
    })

    it('tracks error count correctly', async () => {
        const user = userEvent.setup()

        render(
            <ErrorPopupProvider>
                <TestComponent />
            </ErrorPopupProvider>
        )

        // Initially no errors
        expect(screen.getByTestId('error-count')).toHaveTextContent('0')

        // Show an error
        await user.click(screen.getByText('Show Error'))

        await waitFor(() => {
            expect(screen.getByTestId('error-count')).toHaveTextContent('1')
        })

        // Close the error
        await user.click(screen.getByRole('button', { name: 'Close' }))

        await waitFor(() => {
            expect(screen.getByTestId('error-count')).toHaveTextContent('0')
        })
    })

    it('can show multiple errors simultaneously', async () => {
        const user = userEvent.setup()

        render(
            <ErrorPopupProvider>
                <TestComponent />
            </ErrorPopupProvider>
        )

        // Show multiple errors
        await user.click(screen.getByText('Show Error'))
        await user.click(screen.getByText('Show Warning'))

        await waitFor(() => {
            expect(screen.getByTestId('error-count')).toHaveTextContent('2')
            expect(screen.getByText('Error')).toBeInTheDocument()
            expect(screen.getByText('Warning')).toBeInTheDocument()
        })
    })

    it('can remove specific errors programmatically', async () => {
        const user = userEvent.setup()

        render(
            <ErrorPopupProvider>
                <TestComponent />
            </ErrorPopupProvider>
        )

        // Show an error
        await user.click(screen.getByText('Show Error'))

        await waitFor(() => {
            expect(screen.getByTestId('error-count')).toHaveTextContent('1')
        })

        // Remove the error programmatically
        await user.click(screen.getByText('Remove First Error'))

        await waitFor(() => {
            expect(screen.getByTestId('error-count')).toHaveTextContent('0')
            expect(screen.queryByText('Error')).not.toBeInTheDocument()
        })
    })

    it('throws error when useErrorPopupContext is used outside provider', () => {
        // Suppress console.error for this test
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        expect(() => {
            render(<TestComponent />)
        }).toThrow('useErrorPopupContext must be used within an ErrorPopupProvider')

        consoleSpy.mockRestore()
    })
}) 