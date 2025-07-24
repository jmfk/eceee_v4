import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import LayoutEditor from '../LayoutEditor'

// Mock axios
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    }
}))

// Type the mocked axios
const mockedAxios = vi.mocked(axios)

const mockLayoutsData = {
    results: [
        {
            name: 'two_column',
            description: 'A layout with two columns',
            type: 'code',
            slot_configuration: {
                slots: [
                    {
                        name: 'main',
                        display_name: 'Main Content',
                        description: 'Primary content area',
                        css_classes: 'col-span-2',
                        allows_multiple: true
                    },
                    {
                        name: 'sidebar',
                        display_name: 'Sidebar',
                        description: 'Secondary content area',
                        css_classes: 'col-span-1',
                        allows_multiple: false
                    }
                ]
            },
            template_name: 'layouts/two_column.html',
            created_at: '2024-01-01T00:00:00Z'
        }
    ],
    summary: {
        active_layouts: 1,
        total_layouts: 1
    }
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

const renderWithQueryClient = (component) => {
    const queryClient = createTestQueryClient()
    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    )
}

describe('LayoutEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock successful API responses - LayoutEditor expects code layouts response
        mockedAxios.get.mockResolvedValue({ data: mockLayoutsData })
        mockedAxios.post.mockResolvedValue({ data: {} })
        mockedAxios.put.mockResolvedValue({ data: {} })
        mockedAxios.delete.mockResolvedValue({ data: {} })
    })

    it('renders the layout editor interface', async () => {
        renderWithQueryClient(<LayoutEditor />)

        expect(screen.getByText('Layout Management')).toBeInTheDocument()
        expect(screen.getByText('View and manage both code-based and template-based layout templates')).toBeInTheDocument()
        expect(screen.getByText('Validate')).toBeInTheDocument()
        expect(screen.getByText('Reload')).toBeInTheDocument()

        // Wait for layouts to load
        await waitFor(() => {
            expect(screen.getByText('Available Layouts')).toBeInTheDocument()
        })
    })

    it('displays list of layouts', async () => {
        renderWithQueryClient(<LayoutEditor />)

        await waitFor(() => {
            expect(screen.getByText('two_column')).toBeInTheDocument()
            expect(screen.getByText('2 slots')).toBeInTheDocument()
        })
    })

    it('shows layout type indicators', async () => {
        renderWithQueryClient(<LayoutEditor />)

        await waitFor(() => {
            expect(screen.getByText('Code')).toBeInTheDocument()
        })
    })

    it('allows selecting a layout for viewing details', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<LayoutEditor />)

        await waitFor(() => {
            expect(screen.getByText('two_column')).toBeInTheDocument()
        })

        const layoutItem = screen.getByText('two_column').closest('div')
        await user.click(layoutItem)

        expect(screen.getByText('Show')).toBeInTheDocument()
        expect(screen.getByText('Close')).toBeInTheDocument()
    })

    it('displays layout type filter buttons', async () => {
        renderWithQueryClient(<LayoutEditor />)

        await waitFor(() => {
            expect(screen.getByText('All')).toBeInTheDocument()
            expect(screen.getByText('Code')).toBeInTheDocument()
            expect(screen.getByText('Template')).toBeInTheDocument()
        })
    })

    it('handles API errors gracefully', async () => {
        // Mock API error
        mockedAxios.get.mockRejectedValue(new Error('API Error'))

        renderWithQueryClient(<LayoutEditor />)

        // Component should still render without crashing
        expect(screen.getByText('Layout Management')).toBeInTheDocument()
    })

    it('shows loading state while fetching layouts', async () => {
        // Mock delayed response with paginated format
        mockedAxios.get.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({
                data: {
                    count: mockLayoutsData.results.length,
                    next: null,
                    previous: null,
                    results: mockLayoutsData.results
                }
            }), 100))
        )

        renderWithQueryClient(<LayoutEditor />)

        // Should show loading animation
        expect(screen.getByText('Select a Layout to View Details')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('two_column')).toBeInTheDocument()
        }, { timeout: 200 })
    })

    it('shows layout preview when requested', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<LayoutEditor />)

        // Select a layout
        await waitFor(() => {
            expect(screen.getByText('two_column')).toBeInTheDocument()
        })

        const layoutItem = screen.getByText('two_column').closest('div')
        await user.click(layoutItem)

        // Show preview
        const previewButton = screen.getByText('Show')
        await user.click(previewButton)

        expect(screen.getByText('Layout Preview')).toBeInTheDocument()
    })

    it('displays layout details correctly', async () => {
        renderWithQueryClient(<LayoutEditor />)

        // Select a layout
        await waitFor(() => {
            expect(screen.getByText('two_column')).toBeInTheDocument()
        })

        const layoutItem = screen.getByText('two_column').closest('div')
        await userEvent.setup().click(layoutItem)

        // Check layout details are shown
        expect(screen.getByText('Layout Details')).toBeInTheDocument()
        expect(screen.getByText('Close')).toBeInTheDocument()
    })
}) 