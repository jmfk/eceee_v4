import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TreePageManager from '../TreePageManager'
import * as pagesApi from '../../api/pages'
import { NotificationProvider } from '../NotificationManager'
import { GlobalNotificationProvider } from '../../contexts/GlobalNotificationContext'

// Mock the API client to avoid browser dependencies
vi.mock('../../api/client.js', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn()
    },
    getCsrfToken: vi.fn(() => Promise.resolve('mock-token'))
}))

// Mock the pages API
vi.mock('../../api/pages', () => ({
    getRootPages: vi.fn(() => Promise.resolve({ results: [], count: 0 })),
    getPageChildren: vi.fn(() => Promise.resolve({ results: [], count: 0 })),
    movePage: vi.fn(),
    deletePage: vi.fn(),
    searchAllPages: vi.fn(() => Promise.resolve({ results: [] })),
    pageTreeUtils: {
        hasChildren: vi.fn((page) => page.children_count > 0),
        formatPageForTree: vi.fn((page) => ({
            ...page,
            isExpanded: false,
            isLoading: false,
            children: [],
            childrenLoaded: false
        }))
    }
}))

// Mock the custom hooks
vi.mock('../../hooks/useTreeState', () => ({
    useTreeState: () => ({
        expandedPages: new Set(),
        loadedChildren: new Set(),
        pageData: new Map(),
        treeStructure: [],
        lastUpdate: Date.now(),
        addPage: vi.fn(),
        updatePage: vi.fn(),
        removePage: vi.fn(),
        expandPage: vi.fn(),
        collapsePage: vi.fn(),
        markChildrenLoaded: vi.fn(),
        updateTreeStructure: vi.fn(),
        bulkUpdatePages: vi.fn(),
        clearState: vi.fn(),
        getPage: vi.fn(),
        getAllPages: vi.fn(),
        isPageExpanded: vi.fn(),
        areChildrenLoaded: vi.fn(),
        buildTree: vi.fn((pages) => pages.map(page => ({
            ...page,
            isExpanded: false,
            childrenLoaded: false,
            children: []
        }))),
        getTreeStats: vi.fn(() => ({
            totalPages: 0,
            expandedPages: 0,
            loadedChildren: 0,
            treeStructureLength: 0,
            lastUpdate: Date.now()
        }))
    }),
    usePageUpdates: () => ({
        updatePageInCache: vi.fn(),
        invalidatePageCaches: vi.fn(),
        optimisticUpdate: vi.fn()
    }),
    useTreeRefresh: () => ({
        debouncedRefresh: vi.fn(),
        refreshPage: vi.fn(),
        refreshTree: vi.fn()
    })
}))

// Test data
const mockPages = {
    results: [
        {
            id: 1,
            title: 'Home Page',
            slug: 'home',
            publication_status: 'published',
            children_count: 2,
            sort_order: 0
        },
        {
            id: 2,
            title: 'About Page',
            slug: 'about',
            publication_status: 'published',
            children_count: 0,
            sort_order: 1
        }
    ],
    count: 2
}

const createTestQueryClient = () => {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
}

const renderWithProviders = (component) => {
    const queryClient = createTestQueryClient()

    return render(
        <QueryClientProvider client={queryClient}>
            <GlobalNotificationProvider>
                <NotificationProvider>
                    {component}
                </NotificationProvider>
            </GlobalNotificationProvider>
        </QueryClientProvider>
    )
}

describe('TreePageManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock successful API response
        pagesApi.getRootPages.mockResolvedValue(mockPages)
        pagesApi.searchAllPages.mockResolvedValue({ results: [] })
    })

    it('renders without crashing', async () => {
        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        expect(screen.getByText('Page Tree Manager')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Search pages...')).toBeInTheDocument()
    })

    it('displays loading state initially', async () => {
        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        expect(screen.getByText('Loading pages...')).toBeInTheDocument()
    })

    it('displays root pages after loading', async () => {
        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
            expect(screen.getByText('About Page')).toBeInTheDocument()
        })
    })

    it('shows page count in footer', async () => {
        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('2 root pages')).toBeInTheDocument()
        })
    })

    it('allows searching pages', async () => {
        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'home' } })

        expect(searchInput.value).toBe('home')
    })

    it('shows filters when filter button is clicked', async () => {
        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        const filterButton = screen.getByTestId('filter-button')
        fireEvent.click(filterButton)

        expect(screen.getByText('Status:')).toBeInTheDocument()
        expect(screen.getByDisplayValue('All')).toBeInTheDocument()
    })

    it('shows add root page button', async () => {
        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        const addRootPageButton = screen.getByTestId('add-root-page-button')
        expect(addRootPageButton).toBeInTheDocument()
    })

    it('handles error state gracefully', async () => {
        const mockError = new Error('API Error')
        pagesApi.getRootPages.mockRejectedValue(mockError)

        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Failed to load pages')).toBeInTheDocument()
            expect(screen.getByText('Try Again')).toBeInTheDocument()
        })
    })

    it('shows refresh button and handles refresh', async () => {
        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        const refreshButton = screen.getByTestId('refresh-button')
        expect(refreshButton).toBeInTheDocument()

        // Wait for initial load to complete
        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        // Clear the mock to track calls after initial load
        pagesApi.getRootPages.mockClear()

        // Click refresh button
        fireEvent.click(refreshButton)

        // Wait for the refetch to be called
        await waitFor(() => {
            expect(pagesApi.getRootPages).toHaveBeenCalled()
        })
    })

    it('shows create first page button when no pages exist', async () => {
        // Mock empty pages response
        pagesApi.getRootPages.mockResolvedValue({ results: [], count: 0 })

        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Create First Page')).toBeInTheDocument()
        })
    })

    it('shows no pages found message when no pages exist', async () => {
        // Mock empty pages response
        pagesApi.getRootPages.mockResolvedValue({ results: [], count: 0 })

        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('No pages found')).toBeInTheDocument()
        })
    })

    it('automatically loads children for first-level pages with children', async () => {
        // Mock pages with children
        const mockPagesWithChildren = {
            results: [
                {
                    id: 1,
                    title: 'Home Page',
                    slug: 'home',
                    publication_status: 'published',
                    children_count: 2,
                    sort_order: 0
                },
                {
                    id: 2,
                    title: 'About Page',
                    slug: 'about',
                    publication_status: 'published',
                    children_count: 0,
                    sort_order: 1
                }
            ],
            count: 2
        }

        // Mock children data
        const mockChildren = {
            results: [
                {
                    id: 3,
                    title: 'Child Page 1',
                    slug: 'child-1',
                    publication_status: 'published',
                    children_count: 0,
                    sort_order: 0
                },
                {
                    id: 4,
                    title: 'Child Page 2',
                    slug: 'child-2',
                    publication_status: 'published',
                    children_count: 0,
                    sort_order: 1
                }
            ],
            count: 2
        }

        pagesApi.getRootPages.mockResolvedValue(mockPagesWithChildren)
        pagesApi.getPageChildren.mockResolvedValue(mockChildren)

        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        // Wait for root pages to load
        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
            expect(screen.getByText('About Page')).toBeInTheDocument()
        })

        // Verify that getPageChildren was called for the page with children
        expect(pagesApi.getPageChildren).toHaveBeenCalledWith(1)

        // Verify that getPageChildren was NOT called for the page without children
        expect(pagesApi.getPageChildren).not.toHaveBeenCalledWith(2)
    })


}) 