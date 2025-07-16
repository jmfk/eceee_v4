import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import WidgetLibrary from '../WidgetLibrary'

// Mock axios
vi.mock('axios')
const mockedAxios = axios

// Mock data
const mockWidgetTypes = [
    {
        id: 1,
        name: 'Text Block',
        description: 'Rich text content block with title and formatting options',
        is_active: true,
    },
    {
        id: 2,
        name: 'Image',
        description: 'Image display with caption and sizing options',
        is_active: true,
    },
    {
        id: 3,
        name: 'Button',
        description: 'Call-to-action button with customizable text and link',
        is_active: true,
    },
    {
        id: 4,
        name: 'Spacer',
        description: 'Vertical spacing element for layout control',
        is_active: false,
    },
]

const renderWithQueryClient = (component, queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
    },
})) => {
    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    )
}

describe('WidgetLibrary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock the paginated API response structure
        mockedAxios.get.mockResolvedValue({
            data: {
                count: mockWidgetTypes.length,
                next: null,
                previous: null,
                results: mockWidgetTypes
            }
        })
    })

    it('renders widget library with loading state', async () => {
        // Mock a delayed response to test loading state
        mockedAxios.get.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({
                data: {
                    count: mockWidgetTypes.length,
                    next: null,
                    previous: null,
                    results: mockWidgetTypes
                }
            }), 100))
        )

        renderWithQueryClient(<WidgetLibrary />)

        // During loading, it should show skeleton animation
        const loadingContainer = document.querySelector('.animate-pulse')
        expect(loadingContainer).toBeInTheDocument()
    })

    it('renders widget types after loading', async () => {
        renderWithQueryClient(<WidgetLibrary />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        expect(screen.getByText('Image')).toBeInTheDocument()
        expect(screen.getByText('Button')).toBeInTheDocument()
        // Inactive widget should still be shown (filtered out in component)
        expect(screen.queryByText('Spacer')).not.toBeInTheDocument()
    })

    it('filters widgets by search term', async () => {
        renderWithQueryClient(<WidgetLibrary />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Search widgets...')
        fireEvent.change(searchInput, { target: { value: 'Block' } })

        expect(screen.getByText('Text Block')).toBeInTheDocument()
        expect(screen.queryByText('Image')).not.toBeInTheDocument()
        expect(screen.queryByText('Button')).not.toBeInTheDocument()
    })

    it('filters widgets by category', async () => {
        renderWithQueryClient(<WidgetLibrary />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        const categorySelect = screen.getByDisplayValue('All Widgets')
        fireEvent.change(categorySelect, { target: { value: 'text' } })

        expect(screen.getByText('Text Block')).toBeInTheDocument()
        expect(screen.queryByText('Image')).not.toBeInTheDocument()
        expect(screen.queryByText('Button')).not.toBeInTheDocument()
    })

    it('calls onSelectWidget when widget is clicked', async () => {
        const mockOnSelectWidget = vi.fn()
        renderWithQueryClient(<WidgetLibrary onSelectWidget={mockOnSelectWidget} />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        const textBlockWidget = screen.getByText('Text Block').closest('div[role="button"], div[tabindex], div[onClick]') ||
            screen.getByText('Text Block').parentElement

        fireEvent.click(textBlockWidget)

        expect(mockOnSelectWidget).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 1,
                name: 'Text Block',
            })
        )
    })

    it('shows selected widgets with different styling', async () => {
        renderWithQueryClient(
            <WidgetLibrary selectedWidgetTypes={[1]} />
        )

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        // Find the widget container div that should have the selected styling
        const textBlockWidget = screen.getByText('Text Block').closest('[class*="bg-blue-50"]')
        expect(textBlockWidget).toBeInTheDocument()
        expect(textBlockWidget).toHaveClass('bg-blue-50')
    })

    it('handles API error gracefully', async () => {
        mockedAxios.get.mockRejectedValue(new Error('API Error'))

        renderWithQueryClient(<WidgetLibrary />)

        await waitFor(() => {
            expect(screen.getByText(/Error loading widget types/)).toBeInTheDocument()
        })
    })

    it('shows no widgets message when search returns no results', async () => {
        renderWithQueryClient(<WidgetLibrary />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Search widgets...')
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

        expect(screen.getByText('No widgets found')).toBeInTheDocument()
        expect(screen.getByText('Try adjusting your search terms or filters')).toBeInTheDocument()
    })

    it('shows widget count in footer', async () => {
        renderWithQueryClient(<WidgetLibrary />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        // Should show count of active widgets (3 out of 4 are active)
        expect(screen.getByText('3 widgets available')).toBeInTheDocument()
    })

    it('displays appropriate icons for different widget types', async () => {
        renderWithQueryClient(<WidgetLibrary />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        // Check that icons are rendered (lucide-react SVG elements should be present)
        const svgElements = document.querySelectorAll('svg')
        expect(svgElements.length).toBeGreaterThan(0)
    })

    it('makes correct API call to fetch widget types', async () => {
        renderWithQueryClient(<WidgetLibrary />)

        await waitFor(() => {
            expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/webpages/widget-types/')
        })
    })
}) 