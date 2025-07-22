import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import PageTreeNode from '../PageTreeNode'
import { api } from '../../api/client'

// Mock the API
vi.mock('../../api/client', () => ({
    api: {
        patch: vi.fn()
    }
}))

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
    publication_status: 'published',
    children_count: 0,
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
            {component}
        </QueryClientProvider>
    )
}

describe('PageTreeNode - Inline Title Editing', () => {
    let user

    beforeEach(() => {
        user = userEvent.setup()
        vi.clearAllMocks()
    })

    it('should display title as clickable text initially', () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        const titleElement = screen.getByText('Test Page')
        expect(titleElement).toBeInTheDocument()
        expect(titleElement).toHaveClass('cursor-pointer')
        expect(titleElement.tagName).toBe('SPAN')
    })

    it('should enter edit mode when title is clicked', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Should show input field
        const inputElement = screen.getByDisplayValue('Test Page')
        expect(inputElement).toBeInTheDocument()
        expect(inputElement.tagName).toBe('INPUT')

        // Should show save and cancel buttons
        expect(screen.getByTitle('Save (Enter)')).toBeInTheDocument()
        expect(screen.getByTitle('Cancel (Escape)')).toBeInTheDocument()

        // Original title span should be hidden
        expect(screen.queryByText('Test Page')).not.toBeInTheDocument()
    })

    it('should cancel editing when cancel button is clicked', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        // Enter edit mode
        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('Test Page')
        await user.clear(inputElement)
        await user.type(inputElement, 'Modified Title')

        // Click cancel
        const cancelButton = screen.getByTitle('Cancel (Escape)')
        await user.click(cancelButton)

        // Should return to original title
        expect(screen.getByText('Test Page')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('Modified Title')).not.toBeInTheDocument()
    })

    it('should cancel editing when Escape key is pressed', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        // Enter edit mode
        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('Test Page')
        await user.clear(inputElement)
        await user.type(inputElement, 'Modified Title')

        // Press Escape
        await user.keyboard('{Escape}')

        // Should return to original title
        expect(screen.getByText('Test Page')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('Modified Title')).not.toBeInTheDocument()
    })

    it('should save title when save button is clicked', async () => {
        const mockResponse = { data: { ...mockPage, title: 'New Title' } }
        api.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        // Enter edit mode
        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('Test Page')
        await user.clear(inputElement)
        await user.type(inputElement, 'New Title')

        // Click save
        const saveButton = screen.getByTitle('Save (Enter)')
        await user.click(saveButton)

        // Should call API
        expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { title: 'New Title' })
    })

    it('should save title when Enter key is pressed', async () => {
        const mockResponse = { data: { ...mockPage, title: 'New Title' } }
        api.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        // Enter edit mode
        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Change the input value and press Enter
        const inputElement = screen.getByDisplayValue('Test Page')
        await user.clear(inputElement)
        await user.type(inputElement, 'New Title{Enter}')

        // Should call API
        expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { title: 'New Title' })
    })

    it('should not save if title is empty', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        // Enter edit mode
        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Clear the input
        const inputElement = screen.getByDisplayValue('Test Page')
        await user.clear(inputElement)

        // Click save
        const saveButton = screen.getByTitle('Save (Enter)')
        await user.click(saveButton)

        // Should not call API
        expect(api.patch).not.toHaveBeenCalled()

        // Should still be in edit mode
        expect(screen.getByDisplayValue('')).toBeInTheDocument()
    })

    it('should not save if title is unchanged', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        // Enter edit mode
        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Click save without changing anything
        const saveButton = screen.getByTitle('Save (Enter)')
        await user.click(saveButton)

        // Should not call API
        expect(api.patch).not.toHaveBeenCalled()

        // Should exit edit mode
        expect(screen.getByText('Test Page')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('Test Page')).not.toBeInTheDocument()
    })

    it('should handle API errors gracefully', async () => {
        const mockError = new Error('API Error')
        mockError.response = { data: { detail: 'Failed to update' } }
        api.patch.mockRejectedValue(mockError)

        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        // Enter edit mode
        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('Test Page')
        await user.clear(inputElement)
        await user.type(inputElement, 'New Title')

        // Click save
        const saveButton = screen.getByTitle('Save (Enter)')
        await user.click(saveButton)

        // Should call API
        expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { title: 'New Title' })

        // Should stay in edit mode on error
        await waitFor(() => {
            expect(screen.getByDisplayValue('Test Page')).toBeInTheDocument()
        })
    })

    it('should disable input and buttons while saving', async () => {
        // Mock a slow API response
        api.patch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

        renderWithProviders(
            <PageTreeNode page={mockPage} level={0} onUpdatePageData={vi.fn()} />
        )

        // Enter edit mode
        const titleElement = screen.getByText('Test Page')
        await user.click(titleElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('Test Page')
        await user.clear(inputElement)
        await user.type(inputElement, 'New Title')

        // Click save
        const saveButton = screen.getByTitle('Save (Enter)')
        await user.click(saveButton)

        // Should disable input and buttons while saving
        expect(inputElement).toBeDisabled()
        expect(saveButton).toBeDisabled()
        expect(screen.getByTitle('Cancel (Escape)')).toBeDisabled()
    })
}) 