import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import TreePageManager from '../TreePageManager'
import * as pagesApi from '../../api/pages'

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
    getRootPages: vi.fn(),
    getPageChildren: vi.fn(),
    movePage: vi.fn(),
    deletePage: vi.fn(),
    pageTreeUtils: {
        hasChildren: vi.fn((page) => page.children_count > 0),
        canMoveTo: vi.fn(() => true),
        calculateSortOrder: vi.fn(() => 0),
        formatPageForTree: vi.fn((page) => ({
            ...page,
            isExpanded: false,
            isLoading: false,
            children: [],
            childrenLoaded: false
        }))
    }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    },
    Toaster: () => null
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
            {component}
            <Toaster />
        </QueryClientProvider>
    )
}

describe('TreePageManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock successful API response
        pagesApi.getRootPages.mockResolvedValue(mockPages)
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

    it('calls onEditPage when New Page button is clicked', async () => {
        const mockOnEditPage = vi.fn()
        renderWithProviders(<TreePageManager onEditPage={mockOnEditPage} />)

        const newPageButton = screen.getByText('New Page')
        fireEvent.click(newPageButton)

        expect(mockOnEditPage).toHaveBeenCalledWith(null)
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

        fireEvent.click(refreshButton)
        // Verify API is called again
        expect(pagesApi.getRootPages).toHaveBeenCalledTimes(2)
    })

    it('shows expand all and collapse all buttons', async () => {
        renderWithProviders(<TreePageManager onEditPage={vi.fn()} />)

        expect(screen.getByTestId('expand-all-button')).toBeInTheDocument()
        expect(screen.getByTestId('collapse-all-button')).toBeInTheDocument()
    })
}) 