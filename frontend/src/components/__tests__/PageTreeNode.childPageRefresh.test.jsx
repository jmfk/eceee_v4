import { render, screen } from '@testing-library/react'
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
    workflowState: 'live',
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

    it('should open page settings for a slug without refreshing children', async () => {
        renderWithProviders(
            <PageTreeNode
                page={mockCollapsedParentPage}
                level={1}
                onEdit={mockOnEdit}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        await user.click(screen.getByText('parent-page'))

        expect(mockOnEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1, editorTab: 'settings' }))
        expect(mockAxiosInstance.patch).not.toHaveBeenCalled()
        expect(mockOnRefreshChildren).not.toHaveBeenCalled()
    })

    it('keeps parent publication status informational without refreshing children', async () => {
        renderWithProviders(
            <PageTreeNode
                page={mockCollapsedParentPage}
                level={0}
                onRefreshChildren={mockOnRefreshChildren}
            />
        )

        const statusIndicator = screen.getByLabelText(/Live\. Open the page editor to change publication/i)
        await user.click(statusIndicator)

        expect(mockAxiosInstance.post).not.toHaveBeenCalled()
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

    it('updates branch controls when only childrenCount changes', () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        const page = {
            id: 4,
            title: 'Changing Page',
            slug: 'changing-page',
            publicationStatus: 'published',
            workflowState: 'live',
            childrenCount: 0,
            children: [],
            isExpanded: false,
        }
        const renderNode = (currentPage) => (
            <QueryClientProvider client={queryClient}>
                <NotificationProvider>
                    <PageTreeNode page={currentPage} />
                </NotificationProvider>
            </QueryClientProvider>
        )

        const view = render(renderNode(page))
        expect(screen.getByRole('button', { name: 'Expand Changing Page' })).toBeDisabled()

        view.rerender(renderNode({ ...page, childrenCount: 1 }))
        expect(screen.getByRole('button', { name: 'Expand Changing Page' })).toBeEnabled()

        view.rerender(renderNode(page))
        expect(screen.getByRole('button', { name: 'Expand Changing Page' })).toBeDisabled()
    })

})
