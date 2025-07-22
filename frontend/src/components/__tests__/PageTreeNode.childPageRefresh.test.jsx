import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import PageTreeNode from '../PageTreeNode'
import { api } from '../../api/client'

// Mock the API
vi.mock('../../api/client', () => ({
    api: {
        post: vi.fn(),
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

const mockParentPage = {
    id: 1,
    title: 'Parent Page',
    slug: 'parent-page',
    publication_status: 'published',
    children_count: 2,
    children: [
        {
            id: 2,
            title: 'Child Page 1',
            slug: 'child-page-1',
            publication_status: 'unpublished',
            children_count: 0,
            children: [],
            isExpanded: false,
            childrenLoaded: true
        },
        {
            id: 3,
            title: 'Child Page 2',
            slug: 'child-page-2',
            publication_status: 'published',
            children_count: 0,
            children: [],
            isExpanded: false,
            childrenLoaded: true
        }
    ],
    isExpanded: true,
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

describe('PageTreeNode - Child Page Refresh', () => {
    let user
    let mockOnRefreshChildren

    beforeEach(() => {
        user = userEvent.setup()
        vi.clearAllMocks()
        mockOnRefreshChildren = vi.fn()
    })

    it('should NOT call onRefreshChildren when parent page title is updated (using targeted updates)', async () => {
        const mockResponse = { data: { ...mockParentPage, title: 'Updated Parent Page' } }
        api.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockParentPage}
                level={0}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        // Find and click the title to enter edit mode
        const titleElement = screen.getByText('Parent Page')
        await user.click(titleElement)

        // Find the input field and update the title
        const titleInput = screen.getByDisplayValue('Parent Page')
        await user.clear(titleInput)
        await user.type(titleInput, 'Updated Parent Page')

        // Click save button
        const saveButton = screen.getByTitle('Save (Enter)')
        await user.click(saveButton)

        // Wait for the mutation to complete
        await waitFor(() => {
            expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { title: 'Updated Parent Page' })
        })

        // Should NOT call onRefreshChildren because we use targeted updates now
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should NOT call onRefreshChildren when parent page slug is updated (using targeted updates)', async () => {
        const mockResponse = { data: { ...mockParentPage, slug: 'updated-parent-page' } }
        api.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockParentPage}
                level={0}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        // Find and click the slug to enter edit mode - use getAllByText and get the first one (parent)
        const slugElements = screen.getAllByText('/test-page')
        const parentSlugElement = slugElements[0] // First one is the parent
        await user.click(parentSlugElement)

        // Find the input field and update the slug
        const slugInput = screen.getByDisplayValue('parent-page')
        await user.clear(slugInput)
        await user.type(slugInput, 'updated-parent-page')

        // Click save button
        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        // Wait for the mutation to complete
        await waitFor(() => {
            expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { slug: 'updated-parent-page' })
        })

        // Should NOT call onRefreshChildren because we use targeted updates now
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should NOT call onRefreshChildren when parent page publication status is toggled (using targeted updates)', async () => {
        const mockResponse = { data: { ...mockParentPage, publication_status: 'unpublished' } }
        api.post.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockParentPage}
                level={0}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        // Find and click the publication status icon (Globe for published)
        const statusIcon = document.querySelector('svg.lucide-globe')
        const clickableContainer = statusIcon.parentElement
        await user.click(clickableContainer)

        // Wait for the mutation to complete
        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/api/v1/webpages/pages/1/unpublish/')
        })

        // Should NOT call onRefreshChildren because we use targeted updates now
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should NOT call onRefreshChildren when child page is updated (no children)', async () => {
        const mockChildPage = {
            id: 2,
            title: 'Child Page 1',
            slug: 'child-page-1',
            publication_status: 'unpublished',
            children_count: 0,
            children: [],
            isExpanded: false,
            childrenLoaded: true
        }

        const mockResponse = { data: { ...mockChildPage, title: 'Updated Child Page' } }
        api.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockChildPage}
                level={1}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        // Find and click the title to enter edit mode
        const titleElement = screen.getByText('Child Page 1')
        await user.click(titleElement)

        // Find the input field and update the title
        const titleInput = screen.getByDisplayValue('Child Page 1')
        await user.clear(titleInput)
        await user.type(titleInput, 'Updated Child Page')

        // Click save button
        const saveButton = screen.getByTitle('Save (Enter)')
        await user.click(saveButton)

        // Wait for the mutation to complete
        await waitFor(() => {
            expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/2/', { title: 'Updated Child Page' })
        })

        // Should NOT call onRefreshChildren because child has no children
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should NOT call onRefreshChildren when page has no children loaded', async () => {
        const mockParentWithoutChildren = {
            ...mockParentPage,
            children: [],
            childrenLoaded: false
        }

        const mockResponse = { data: { ...mockParentWithoutChildren, title: 'Updated Parent Page' } }
        api.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockParentWithoutChildren}
                level={0}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        // Find and click the title to enter edit mode
        const titleElement = screen.getByText('Parent Page')
        await user.click(titleElement)

        // Find the input field and update the title
        const titleInput = screen.getByDisplayValue('Parent Page')
        await user.clear(titleInput)
        await user.type(titleInput, 'Updated Parent Page')

        // Click save button
        const saveButton = screen.getByTitle('Save (Enter)')
        await user.click(saveButton)

        // Wait for the mutation to complete
        await waitFor(() => {
            expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { title: 'Updated Parent Page' })
        })

        // Should NOT call onRefreshChildren because children are not loaded
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should handle missing onRefreshChildren gracefully', async () => {
        const mockResponse = { data: { ...mockParentPage, title: 'Updated Parent Page' } }
        api.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockParentPage}
                level={0}
            // No onRefreshChildren prop
            />
        )

        // Find and click the title to enter edit mode
        const titleElement = screen.getByText('Parent Page')
        await user.click(titleElement)

        // Find the input field and update the title
        const titleInput = screen.getByDisplayValue('Parent Page')
        await user.clear(titleInput)
        await user.type(titleInput, 'Updated Parent Page')

        // Click save button
        const saveButton = screen.getByTitle('Save (Enter)')
        await user.click(saveButton)

        // Wait for the mutation to complete
        await waitFor(() => {
            expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { title: 'Updated Parent Page' })
        })

        // Should not crash when onRefreshChildren is not provided
        // Just verify the API call was made successfully
        expect(api.patch).toHaveBeenCalledTimes(1)
    })
}) 