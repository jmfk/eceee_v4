import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Notification from '../Notification'

describe('Notification', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders notification with correct content', () => {
        const error = new Error('Test error message')
        error.response = { data: { detail: 'Additional error details' } }

        render(<Notification message={error} onClose={mockOnClose} />)

        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText('Test error message')).toBeInTheDocument()
        expect(screen.getByText('Details:')).toBeInTheDocument()
        expect(screen.getByText('Additional error details')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Close notification' })).toBeInTheDocument()
    })

    it('renders warning notification with correct styling', () => {
        const error = new Error('Warning message')

        render(<Notification message={error} onClose={mockOnClose} type="warning" />)

        expect(screen.getByText('Warning')).toBeInTheDocument()
        expect(screen.getByText('Warning message')).toBeInTheDocument()
    })

    it('renders info notification with correct styling', () => {
        const error = new Error('Information message')

        render(<Notification message={error} onClose={mockOnClose} type="info" />)

        expect(screen.getByText('Information')).toBeInTheDocument()
        expect(screen.getByText('Information message')).toBeInTheDocument()
    })

    it('renders success notification with correct styling', () => {
        const message = 'Success message'

        render(<Notification message={message} onClose={mockOnClose} type="success" />)

        expect(screen.getByText('Success')).toBeInTheDocument()
        expect(screen.getByText('Success message')).toBeInTheDocument()
    })

    it('handles string messages', () => {
        render(<Notification message="Simple string message" onClose={mockOnClose} />)

        expect(screen.getByText('Simple string message')).toBeInTheDocument()
    })

    it('closes notification when X button is clicked', async () => {
        const user = userEvent.setup()
        const error = new Error('Test error')

        render(<Notification message={error} onClose={mockOnClose} />)

        const xButton = screen.getByRole('button', { name: 'Close notification' })
        await user.click(xButton)

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled()
        })
    })

    it('auto-closes after duration', async () => {
        const error = new Error('Test error')

        render(<Notification message={error} onClose={mockOnClose} duration={100} />)

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled()
        }, { timeout: 500 })
    })

    it('shows technical details in development mode', () => {
        const originalEnv = process.env.NODE_ENV
        process.env.NODE_ENV = 'development'

        const error = new Error('Test error')
        error.stack = 'Error: Test error\n    at test.js:1:1'

        render(<Notification message={error} onClose={mockOnClose} />)

        expect(screen.getByText('Show technical details')).toBeInTheDocument()

        // Restore original environment
        process.env.NODE_ENV = originalEnv
    })

    it('does not show technical details in production mode', () => {
        const originalEnv = process.env.NODE_ENV
        process.env.NODE_ENV = 'production'

        const error = new Error('Test error')
        error.stack = 'Error: Test error\n    at test.js:1:1'

        render(<Notification message={error} onClose={mockOnClose} />)

        expect(screen.queryByText('Show technical details')).not.toBeInTheDocument()

        // Restore original environment
        process.env.NODE_ENV = originalEnv
    })

    it('does not render when no message is provided', () => {
        const { container } = render(<Notification message={null} onClose={mockOnClose} />)
        expect(container.firstChild).toBeNull()
    })

    it('handles errors without response data', () => {
        const error = new Error('Simple error without response data')

        render(<Notification message={error} onClose={mockOnClose} />)

        expect(screen.getByText('Simple error without response data')).toBeInTheDocument()
        expect(screen.queryByText('Details:')).not.toBeInTheDocument()
    })
}) 