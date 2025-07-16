import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import PageManagement from '../PageManagement'

// Mock axios
vi.mock('axios')
const mockedAxios = axios

// Mock child components
vi.mock('../../components/LayoutEditor', () => ({
    default: () => <div data-testid="layout-editor">Layout Editor Component</div>,
}))

vi.mock('../../components/ThemeEditor', () => ({
    default: () => <div data-testid="theme-editor">Theme Editor Component</div>,
}))

vi.mock('../../components/SlotManager', () => ({
    default: ({ pageId, layout }) => (
        <div data-testid="slot-manager">
            Slot Manager for page {pageId} with layout {layout?.name}
        </div>
    ),
}))

const mockPages = [
    {
        id: 1,
        title: 'Home Page',
        slug: 'home',
        description: 'Welcome to our website',
        publication_status: 'published',
        layout: { id: 1, name: 'Home Layout' },
        theme: { id: 1, name: 'Default Theme' },
    },
    {
        id: 2,
        title: 'About Us',
        slug: 'about',
        description: 'Learn more about our company',
        publication_status: 'unpublished',
        layout: { id: 2, name: 'Content Layout' },
        theme: null,
    },
    {
        id: 3,
        title: 'Contact',
        slug: 'contact',
        description: 'Get in touch with us',
        publication_status: 'published',
        layout: null,
        theme: { id: 1, name: 'Default Theme' },
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

describe('PageManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock the paginated API response structure
        mockedAxios.get.mockResolvedValue({
            data: {
                count: mockPages.length,
                next: null,
                previous: null,
                results: mockPages
            }
        })
    })

    it('renders page management header', () => {
        renderWithQueryClient(<PageManagement />)

        expect(screen.getByText('Page Management')).toBeInTheDocument()
        expect(screen.getByText('Manage your website pages, layouts, themes, and widgets')).toBeInTheDocument()
    })

    it('renders all navigation tabs', () => {
        renderWithQueryClient(<PageManagement />)

        // Check for navigation tabs by role
        expect(screen.getByRole('navigation')).toBeInTheDocument()
        expect(screen.getAllByText('Pages')).toHaveLength(2) // Tab and heading
        expect(screen.getByText('Layouts')).toBeInTheDocument()
        expect(screen.getByText('Themes')).toBeInTheDocument()
        expect(screen.getByText('Widgets')).toBeInTheDocument()
        expect(screen.getByText('Versions')).toBeInTheDocument()
    })

    it('shows tab descriptions', () => {
        renderWithQueryClient(<PageManagement />)

        expect(screen.getByText('Manage pages and content')).toBeInTheDocument()

        // Test other tab descriptions by clicking tabs
        fireEvent.click(screen.getByText('Versions'))
        expect(screen.getByText('Page version control and history')).toBeInTheDocument()
    })

    it('defaults to pages tab', () => {
        renderWithQueryClient(<PageManagement />)

        // Pages tab should be active (has different styling) - find the button specifically
        const navigation = screen.getByRole('navigation')
        const pagesTab = within(navigation).getByText('Pages').closest('button')
        expect(pagesTab).toHaveClass('border-blue-500', 'text-blue-600')
    })

    it('switches tabs when clicked', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        // Click on Layouts tab
        await user.click(screen.getByText('Layouts'))

        expect(screen.getByTestId('layout-editor')).toBeInTheDocument()
        expect(screen.getByText('Design page layouts and slots')).toBeInTheDocument()

        // Click on Themes tab
        await user.click(screen.getByText('Themes'))

        expect(screen.getByTestId('theme-editor')).toBeInTheDocument()
        expect(screen.getByText('Customize colors and styling')).toBeInTheDocument()
    })

    it('displays pages list with loading state', async () => {
        // Mock delayed response
        mockedAxios.get.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({ data: mockPages }), 100))
        )

        renderWithQueryClient(<PageManagement />)

        // Should show loading skeleton - check for loading elements
        const loadingElements = screen.getAllByText(/pages/i)
        expect(loadingElements.length).toBeGreaterThan(0)
    })

    it('displays pages after loading', async () => {
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        expect(screen.getByText('About Us')).toBeInTheDocument()
        expect(screen.getByText('Contact')).toBeInTheDocument()
    })

    it('shows page details when page is selected', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        // Click on Home Page
        await user.click(screen.getByText('Home Page'))

        await waitFor(() => {
            expect(screen.getByText('Page Details')).toBeInTheDocument()
            expect(screen.getByText('Welcome to our website')).toBeInTheDocument()
        })
    })

    it('filters pages by search term', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Search pages...')
        await user.type(searchInput, 'home')

        expect(screen.getByText('Home Page')).toBeInTheDocument()
        expect(screen.queryByText('About Us')).not.toBeInTheDocument()
        expect(screen.queryByText('Contact')).not.toBeInTheDocument()
    })

    it('shows page status badges', async () => {
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        expect(screen.getAllByText('published')).toHaveLength(2)
        expect(screen.getByText('unpublished')).toBeInTheDocument()
    })

    it('shows layout and theme information for pages', async () => {
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        expect(screen.getByText('Layout: Home Layout')).toBeInTheDocument()
        // Check for theme text (may be multiple instances)
        const themeElements = screen.getAllByText(/Theme: Default Theme/i)
        expect(themeElements.length).toBeGreaterThan(0)
    })

    it('shows manage widgets button for pages', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        const manageWidgetsButtons = screen.getAllByTitle('Manage widgets')
        expect(manageWidgetsButtons).toHaveLength(3) // One for each page
    })

    it('switches to widgets tab when manage widgets is clicked', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        const manageWidgetsButtons = screen.getAllByTitle('Manage widgets')
        await user.click(manageWidgetsButtons[0])

        expect(screen.getByText('Manage page widgets and content')).toBeInTheDocument()
        expect(screen.getByTestId('slot-manager')).toBeInTheDocument()
    })

    it('shows appropriate widget management state when no page selected', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        // Switch to widgets tab without selecting a page
        await user.click(screen.getByText('Widgets'))

        expect(screen.getByText('Select a page from the Pages tab to manage its widgets')).toBeInTheDocument()
    })

    it('shows message when page has no layout for widget management', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Contact')).toBeInTheDocument()
        })

        // Select Contact page (which has no layout)
        await user.click(screen.getByText('Contact'))
        await user.click(screen.getByText('Widgets'))

        expect(screen.getByText('This page has no layout assigned')).toBeInTheDocument()
    })

    it('shows empty state when no pages found', async () => {
        mockedAxios.get.mockResolvedValue({ data: [] })
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('No pages found')).toBeInTheDocument()
        })
    })

    it('shows search help when no search results', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Search pages...')
        await user.type(searchInput, 'nonexistent')

        expect(screen.getByText('No pages found')).toBeInTheDocument()
        expect(screen.getByText('Try adjusting your search terms')).toBeInTheDocument()
    })

    it('displays page URLs correctly', async () => {
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('/home')).toBeInTheDocument()
        })

        expect(screen.getByText('/about')).toBeInTheDocument()
        expect(screen.getByText('/contact')).toBeInTheDocument()
    })

    it('shows new page button', () => {
        renderWithQueryClient(<PageManagement />)

        expect(screen.getByText('New Page')).toBeInTheDocument()
    })

    it('shows preview buttons for pages', async () => {
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        const previewButtons = screen.getAllByTitle('Preview page')
        expect(previewButtons).toHaveLength(3)
    })

    it('makes correct API call to fetch pages', async () => {
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/webpages/pages/')
        })
    })

    it('updates selected page details when different page is clicked', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        // Select Home Page first
        await user.click(screen.getByText('Home Page'))

        await waitFor(() => {
            expect(screen.getByText('Welcome to our website')).toBeInTheDocument()
        })

        // Then select About Us
        await user.click(screen.getByText('About Us'))

        await waitFor(() => {
            expect(screen.getByText('Learn more about our company')).toBeInTheDocument()
            expect(screen.queryByText('Welcome to our website')).not.toBeInTheDocument()
        })
    })

    it('shows layout and theme assignment in page details', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument()
        })

        await user.click(screen.getByText('Home Page'))

        await waitFor(() => {
            expect(screen.getByText('Page Details')).toBeInTheDocument()
        })

        // Check for specific detail labels
        expect(screen.getByText('Page Title')).toBeInTheDocument()
        expect(screen.getByText('URL Slug')).toBeInTheDocument()
        expect(screen.getByText('Layout')).toBeInTheDocument()
        expect(screen.getByText('Theme')).toBeInTheDocument()
    })

    it('shows no layout/theme assigned when null', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        await waitFor(() => {
            expect(screen.getByText('Contact')).toBeInTheDocument()
        })

        await user.click(screen.getByText('Contact'))

        await waitFor(() => {
            expect(screen.getByText('No layout assigned')).toBeInTheDocument()
        })
    })
}) 