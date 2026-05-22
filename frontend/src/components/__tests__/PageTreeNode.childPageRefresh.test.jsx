import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import PageTreeNode from '../PageTreeNode'
import { NotificationProvider } from '../NotificationManager'
import { mockAxiosInstance, resetApiMocks } from '../../test/apiMockUtils'

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
    publicationStatus: 'published',
    childrenCount: 2,
    children: [
        {
            id: 2,
            title: 'Child Page 1',
            slug: 'child-page-1',
            publicationStatus: 'unpublished',
            childrenCount: 0,
            children: [],
            isExpanded: false,
            childrenLoaded: true
        },
        {
            id: 3,
            title: 'Child Page 2',
            slug: 'child-page-2',
            publicationStatus: 'published',
            childrenCount: 0,
            children: [],
            isExpanded: false,
            childrenLoaded: true
        }
    ],
    isExpanded: true,
    childrenLoaded: true
}

const mockCollapsedParentPage = {
    ...mockParentPage,
    isExpanded: false
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

describe('PageTreeNode - Child Page Refresh', () => {
    let user
    let mockOnRefreshChildren
    let mockOnEdit

    beforeEach(() => {
        user = userEvent.setup()
        vi.clearAllMocks()
        resetApiMocks({ results: [] })
        mockOnRefreshChildren = vi.fn()
        mockOnEdit = vi.fn()
    })

    it('should NOT call onRefreshChildren when parent page title opens editor', async () => {
        renderWithProviders(
            <PageTreeNode
                page={mockCollapsedParentPage}
                level={0}
                onEdit={mockOnEdit}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        const titleElement = screen.getByText('Parent Page')
        await user.click(titleElement)

        expect(mockOnEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1, title: 'Parent Page' }))
        expect(mockAxiosInstance.patch).not.toHaveBeenCalled()
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should NOT call onRefreshChildren when parent page slug is updated (using targeted updates)', async () => {
        const mockResponse = { data: { ...mockParentPage, slug: 'updated-parent-page' } }
        mockAxiosInstance.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockCollapsedParentPage}
                level={1}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        await user.click(screen.getByText('parent-page'))

        const slugInput = screen.getByDisplayValue('parent-page')
        await user.clear(slugInput)
        await user.type(slugInput, 'updated-parent-page')

        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        // Wait for the mutation to complete
        await waitFor(() => {
            expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { slug: 'updated-parent-page' }, {})
        })

        // Should NOT call onRefreshChildren because we use targeted updates now
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should NOT call onRefreshChildren when parent page publication status is toggled (using targeted updates)', async () => {
        const mockResponse = { data: { ...mockParentPage, publicationStatus: 'unpublished' } }
        mockAxiosInstance.post.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockCollapsedParentPage}
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
            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/webpages/pages/1/unpublish/', { mode: 'current' }, {})
        })

        // Should NOT call onRefreshChildren because we use targeted updates now
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should NOT call onRefreshChildren when child page title opens editor', async () => {
        const mockChildPage = {
            id: 2,
            title: 'Child Page 1',
            slug: 'child-page-1',
            publicationStatus: 'unpublished',
            childrenCount: 0,
            children: [],
            isExpanded: false,
            childrenLoaded: true
        }

        renderWithProviders(
            <PageTreeNode
                page={mockChildPage}
                level={1}
                onEdit={mockOnEdit}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        const titleElement = screen.getByText('Child Page 1')
        await user.click(titleElement)

        expect(mockOnEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 2, title: 'Child Page 1' }))
        expect(mockAxiosInstance.patch).not.toHaveBeenCalled()
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should NOT call onRefreshChildren when page has no children loaded', async () => {
        const mockParentWithoutChildren = {
            ...mockParentPage,
            children: [],
            childrenLoaded: false,
            isExpanded: false
        }

        const mockResponse = { data: { ...mockParentWithoutChildren, slug: 'updated-parent-page' } }
        mockAxiosInstance.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockParentWithoutChildren}
                level={1}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        await user.click(screen.getByText('parent-page'))

        const slugInput = screen.getByDisplayValue('parent-page')
        await user.clear(slugInput)
        await user.type(slugInput, 'updated-parent-page')

        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        await waitFor(() => {
            expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { slug: 'updated-parent-page' }, {})
        })

        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('should handle missing onRefreshChildren gracefully', async () => {
        const mockResponse = { data: { ...mockParentPage, slug: 'updated-parent-page' } }
        mockAxiosInstance.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode
                page={mockCollapsedParentPage}
                level={1}
            // No onRefreshChildren prop
            />
        )

        await user.click(screen.getByText('parent-page'))

        const slugInput = screen.getByDisplayValue('parent-page')
        await user.clear(slugInput)
        await user.type(slugInput, 'updated-parent-page')

        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        await waitFor(() => {
            expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { slug: 'updated-parent-page' }, {})
        })

        expect(mockAxiosInstance.patch).toHaveBeenCalledTimes(1)
    })
})
