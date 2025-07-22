import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import TreePageManager from '../TreePageManager'
import { searchAllPages } from '../../api/pages'

// Mock axios
vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn()
        }))
    }
}))

// Mock the API modules
vi.mock('../../api/pages', () => ({
    getRootPages: vi.fn(() => Promise.resolve({ results: [] })),
    getPageChildren: vi.fn(),
    movePage: vi.fn(),
    deletePage: vi.fn(),
    searchAllPages: vi.fn(),
    pageTreeUtils: {
        hasChildren: vi.fn(),
        formatPageForTree: vi.fn((page) => ({
            ...page,
            isExpanded: false,
            isLoading: false,
            children: [],
            childrenLoaded: false
        }))
    }
}))

// Mock the API client
vi.mock('../../api/client.js', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn()
    }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}))

const createQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
    }
})

const mockSearchResults = [
    {
        id: 1,
        title: 'Home',
        slug: 'home',
        parent: null,
        children_count: 2,
        hierarchy_path: [],
        is_search_result: true
    },
    {
        id: 2,
        title: 'About',
        slug: 'about',
        parent: 1,
        children_count: 0,
        hierarchy_path: [
            { id: 1, title: 'Home', slug: 'home' }
        ],
        is_search_result: true
    },
    {
        id: 3,
        title: 'Contact',
        slug: 'contact',
        parent: 1,
        children_count: 0,
        hierarchy_path: [
            { id: 1, title: 'Home', slug: 'home' }
        ],
        is_search_result: true
    }
]

describe('TreePageManager Search Functionality', () => {
    let queryClient

    beforeEach(() => {
        queryClient = createQueryClient()
        vi.clearAllMocks()
    })

    const renderTreePageManager = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <TreePageManager onEditPage={vi.fn()} />
            </QueryClientProvider>
        )
    }

    test('should show search input and trigger search', async () => {
        searchAllPages.mockResolvedValue({
            results: mockSearchResults,
            query: 'about',
            total_count: 3
        })

        renderTreePageManager()

        // Find search input
        const searchInput = screen.getByPlaceholderText('Search pages...')
        expect(searchInput).toBeInTheDocument()

        // Type in search term
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Wait for search to be triggered
        await waitFor(() => {
            expect(searchAllPages).toHaveBeenCalledWith('about', {})
        })
    })

    test('should display search results with hierarchy', async () => {
        searchAllPages.mockResolvedValue({
            results: mockSearchResults,
            query: 'about',
            total_count: 3
        })

        renderTreePageManager()

        // Type search term
        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Wait for results to appear
        await waitFor(() => {
            expect(screen.getByText('Found 3 results for "about"')).toBeInTheDocument()
        })

        // Check that search results are displayed
        expect(screen.getAllByText('Home')).toHaveLength(2) // Root and child
        expect(screen.getByText('About')).toBeInTheDocument()
        expect(screen.getByText('Contact')).toBeInTheDocument()
    })

    test('should show clear search button', async () => {
        searchAllPages.mockResolvedValue({
            results: mockSearchResults,
            query: 'about',
            total_count: 3
        })

        renderTreePageManager()

        // Type search term
        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Wait for clear button to appear
        await waitFor(() => {
            const clearButton = screen.getByText('Clear Search')
            expect(clearButton).toBeInTheDocument()
        })

        // Click clear button
        const clearButton = screen.getByText('Clear Search')
        fireEvent.click(clearButton)

        // Check that search input is cleared
        await waitFor(() => {
            expect(searchInput.value).toBe('')
        })
    })

    test('should debounce search input', async () => {
        searchAllPages.mockResolvedValue({
            results: mockSearchResults,
            query: 'about',
            total_count: 3
        })

        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')

        // Type rapidly
        fireEvent.change(searchInput, { target: { value: 'a' } })
        fireEvent.change(searchInput, { target: { value: 'ab' } })
        fireEvent.change(searchInput, { target: { value: 'abo' } })
        fireEvent.change(searchInput, { target: { value: 'abou' } })
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Wait for debounced search
        await waitFor(() => {
            expect(searchAllPages).toHaveBeenCalledTimes(1)
            expect(searchAllPages).toHaveBeenCalledWith('about', {})
        }, { timeout: 1000 })
    })

    test('should show loading state during search', async () => {
        // Mock a delayed response
        searchAllPages.mockImplementation(() =>
            new Promise(resolve =>
                setTimeout(() => resolve({
                    results: mockSearchResults,
                    query: 'about',
                    total_count: 3
                }), 100)
            )
        )

        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Check for loading state
        await waitFor(() => {
            expect(screen.getByText('Searching pages...')).toBeInTheDocument()
        })
    })

    test('should handle search errors gracefully', async () => {
        searchAllPages.mockRejectedValue(new Error('Search failed'))

        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Wait for error to appear
        await waitFor(() => {
            expect(screen.getAllByText('Search failed')).toHaveLength(2) // Title and message
        })

        // Check for clear search button in error state
        const clearButton = screen.getByText('Clear Search')
        expect(clearButton).toBeInTheDocument()
    })

    test('should not search for terms less than 2 characters', async () => {
        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'a' } })

        // Wait to ensure no search is triggered
        await waitFor(() => {
            expect(searchAllPages).not.toHaveBeenCalled()
        }, { timeout: 1000 })
    })
}) 