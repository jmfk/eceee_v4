import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import PageTreeNode from '../PageTreeNode'
import { NotificationProvider } from '../NotificationManager'

// Mock toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}))

// Mock utils
vi.mock('../../utils/apiValidation.js', () => ({
    getPageDisplayUrl: vi.fn(() => '/test-page'),
    isRootPage: vi.fn(() => false),
    sanitizePageData: vi.fn((page) => page)
}))

const mockPage = {
    id: 1,
    title: 'Test Page',
    slug: 'test-page',
    publicationStatus: 'published',
    childrenCount: 0,
    children: [],
    isExpanded: false,
    childrenLoaded: true
}

const renderWithProviders = (component) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <NotificationProvider>
                {component}
            </NotificationProvider>
        </QueryClientProvider>
    )
}

describe('PageTreeNode - Title Click Behavior', () => {
    let user

    beforeEach(() => {
        user = userEvent.setup()
        vi.clearAllMocks()
    })

    it('should display title as clickable text', () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onEdit={vi.fn()} />
        )

        const titleElement = screen.getByText('Test Page')
        expect(titleElement).toBeInTheDocument()
        expect(titleElement).toHaveClass('cursor-pointer')
        expect(titleElement.tagName).toBe('SPAN')
    })

    it('should call onEdit when title is clicked', async () => {
        const mockOnEdit = vi.fn()
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onEdit={mockOnEdit} />
        )

        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Should call onEdit with the page object
        expect(mockOnEdit).toHaveBeenCalledTimes(1)
        expect(mockOnEdit).toHaveBeenCalledWith(mockPage)
    })

    it('should have correct title attribute on title element', () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onEdit={vi.fn()} />
        )

        const titleElement = screen.getByText('Test Page')
        expect(titleElement).toHaveAttribute('title', 'Click to edit page')
    })

    it('should not call onEdit if not provided', async () => {
        // Should not throw error if onEdit is not provided
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} />
        )

        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Should complete without errors
        expect(titleElement).toBeInTheDocument()
    })
}) 