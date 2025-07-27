import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import Settings from '../SettingsManager'
import { GlobalNotificationProvider } from '../../contexts/GlobalNotificationContext'
import { NotificationProvider } from '../../components/NotificationManager'

// Mock axios
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(() => ({
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            interceptors: {
                request: {
                    use: vi.fn()
                },
                response: {
                    use: vi.fn()
                }
            }
        }))
    }
}))
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
            Slot Manager for page {pageId} with layout {layout?.name || 'None'}
        </div>
    ),
}))

vi.mock('../../components/VersionManager', () => ({
    default: ({ pageId, onClose }) => (
        <div data-testid="version-manager">
            Version Manager for page {pageId}
            <button onClick={onClose}>Close</button>
        </div>
    ),
}))

vi.mock('../../components/ObjectPublisher', () => ({
    default: ({ pageId, onObjectLinked, onObjectUnlinked }) => (
        <div data-testid="object-publisher">
            Object Publisher for page {pageId}
        </div>
    ),
}))

vi.mock('../../components/PublicationStatusDashboard', () => ({
    default: () => <div data-testid="publication-status-dashboard">Publication Status Dashboard</div>,
}))

vi.mock('../../components/PublicationTimeline', () => ({
    default: () => <div data-testid="publication-timeline">Publication Timeline</div>,
}))

vi.mock('../../components/BulkPublishingOperations', () => ({
    default: () => <div data-testid="bulk-publishing-operations">Bulk Publishing Operations</div>,
}))

vi.mock('../../components/TreePageManager', () => ({
    default: ({ onEditPage }) => (
        <div data-testid="tree-page-manager">
            Tree Page Manager
            <button onClick={() => onEditPage(null)}>Create Page</button>
        </div>
    ),
}))

// Mock layout utils
vi.mock('../../api/layouts', () => ({
    layoutsApi: {
        combined: {
            listAll: vi.fn()
        }
    },
    layoutUtils: {
        getPageLayoutType: vi.fn(),
        getEffectiveLayoutName: vi.fn()
    }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

describe('Settings', () => {
    let queryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
    })

    const renderWithQueryClient = (component) => {
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

    it('renders the main heading correctly', () => {
        renderWithQueryClient(<Settings />)
        expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders all navigation tabs', () => {
        renderWithQueryClient(<Settings />)
        expect(screen.getByText('Page Tree')).toBeInTheDocument()
        expect(screen.getByText('Pages')).toBeInTheDocument()
        expect(screen.getByText('Layouts')).toBeInTheDocument()
        expect(screen.getByText('Themes')).toBeInTheDocument()
        expect(screen.getByText('Widgets')).toBeInTheDocument()
        expect(screen.getByText('Versions')).toBeInTheDocument()
        expect(screen.getByText('Object Publishing')).toBeInTheDocument()
        expect(screen.getByText('Publishing Workflow')).toBeInTheDocument()
    })

    it('defaults to tree tab', () => {
        renderWithQueryClient(<Settings />)
        expect(screen.getByTestId('tree-page-manager')).toBeInTheDocument()
    })

    it('can switch between tabs', async () => {
        renderWithQueryClient(<Settings />)

        // Click on Pages tab
        await userEvent.click(screen.getByText('Pages'))
        expect(screen.getByText('Search pages...')).toBeInTheDocument()

        // Click on Layouts tab
        await userEvent.click(screen.getByText('Layouts'))
        expect(screen.getByTestId('layout-editor')).toBeInTheDocument()

        // Click on Themes tab
        await userEvent.click(screen.getByText('Themes'))
        expect(screen.getByTestId('theme-editor')).toBeInTheDocument()
    })

    it('shows empty state when no page is selected for widgets tab', async () => {
        renderWithQueryClient(<Settings />)

        // Click on Widgets tab
        await userEvent.click(screen.getByText('Widgets'))
        expect(screen.getByText('Select a page from the Pages tab to manage its widgets')).toBeInTheDocument()
    })

    it('shows empty state when no page is selected for versions tab', async () => {
        renderWithQueryClient(<Settings />)

        // Click on Versions tab
        await userEvent.click(screen.getByText('Versions'))
        expect(screen.getByText('Select a page from the Pages tab to view its version history')).toBeInTheDocument()
    })

    it('shows empty state when no page is selected for object publishing tab', async () => {
        renderWithQueryClient(<Settings />)

        // Click on Object Publishing tab
        await userEvent.click(screen.getByText('Object Publishing'))
        expect(screen.getByText('Select a page from the Pages tab to manage object publishing')).toBeInTheDocument()
    })

    describe('Pages tab functionality', () => {
        beforeEach(() => {
            mockedAxios.get.mockResolvedValue({
                data: {
                    results: [
                        {
                            id: 1,
                            title: 'Home Page',
                            slug: 'home',
                            description: 'Main homepage',
                            publication_status: 'published',
                            layout: { id: 1, name: 'Default Layout' },
                            theme: { id: 1, name: 'Default Theme' }
                        },
                        {
                            id: 2,
                            title: 'About Page',
                            slug: 'about',
                            description: 'About us page',
                            publication_status: 'unpublished',
                            layout: null,
                            theme: null
                        }
                    ]
                }
            })
        })

        it('loads and displays pages', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to pages tab
            await userEvent.click(screen.getByText('Pages'))

            // Wait for pages to load
            await waitFor(() => {
                expect(screen.getByText('Home Page')).toBeInTheDocument()
                expect(screen.getByText('About Page')).toBeInTheDocument()
            })
        })

        it('allows searching pages', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to pages tab
            await userEvent.click(screen.getByText('Pages'))

            // Wait for pages to load
            await waitFor(() => {
                expect(screen.getByText('Home Page')).toBeInTheDocument()
            })

            // Search for "home"
            const searchInput = screen.getByPlaceholderText('Search pages...')
            await userEvent.type(searchInput, 'home')

            // Should only show home page
            expect(screen.getByText('Home Page')).toBeInTheDocument()
            expect(screen.queryByText('About Page')).not.toBeInTheDocument()
        })

        it('can select a page and show its details', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to pages tab
            await userEvent.click(screen.getByText('Pages'))

            // Wait for pages to load and click on a page
            await waitFor(() => {
                expect(screen.getByText('Home Page')).toBeInTheDocument()
            })

            await userEvent.click(screen.getByText('Home Page'))

            // Should show page details
            expect(screen.getByText('Page Details')).toBeInTheDocument()
        })

        it('shows new page form when create button is clicked', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to pages tab
            await userEvent.click(screen.getByText('Pages'))

            // Click new page button
            await userEvent.click(screen.getByText('New Page'))

            // Should show create form
            expect(screen.getByText('Create New Page')).toBeInTheDocument()
            expect(screen.getByLabelText('Page Title *')).toBeInTheDocument()
        })

        it('can toggle filters', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to pages tab
            await userEvent.click(screen.getByText('Pages'))

            // Click filters button
            await userEvent.click(screen.getByText('Filters'))

            // Should show filter dropdowns
            expect(screen.getByLabelText('Status')).toBeInTheDocument()
            expect(screen.getByLabelText('Layout')).toBeInTheDocument()
        })
    })

    describe('Widget management', () => {
        beforeEach(() => {
            mockedAxios.get.mockResolvedValue({
                data: {
                    results: [
                        {
                            id: 1,
                            title: 'Test Page',
                            slug: 'test',
                            layout: { id: 1, name: 'Test Layout' }
                        }
                    ]
                }
            })
        })

        it('shows slot manager when page with layout is selected', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to pages tab and wait for data
            await userEvent.click(screen.getByText('Pages'))
            await waitFor(() => {
                expect(screen.getByText('Test Page')).toBeInTheDocument()
            })

            // Select the page
            await userEvent.click(screen.getByText('Test Page'))

            // Switch to widgets tab
            await userEvent.click(screen.getByText('Widgets'))

            // Should show slot manager
            expect(screen.getByTestId('slot-manager')).toBeInTheDocument()
        })

        it('shows no layout message when page has no layout', async () => {
            // Mock page without layout
            mockedAxios.get.mockResolvedValue({
                data: {
                    results: [
                        {
                            id: 1,
                            title: 'Test Page',
                            slug: 'test',
                            layout: null
                        }
                    ]
                }
            })

            renderWithQueryClient(<Settings />)

            // Switch to pages tab and wait for data
            await userEvent.click(screen.getByText('Pages'))
            await waitFor(() => {
                expect(screen.getByText('Test Page')).toBeInTheDocument()
            })

            // Select the page
            await userEvent.click(screen.getByText('Test Page'))

            // Switch to widgets tab
            await userEvent.click(screen.getByText('Widgets'))

            // Should show no layout message
            expect(screen.getByText('This page has no layout assigned')).toBeInTheDocument()
        })
    })

    describe('Version management', () => {
        beforeEach(() => {
            mockedAxios.get.mockResolvedValue({
                data: {
                    results: [
                        {
                            id: 1,
                            title: 'Test Page',
                            slug: 'test'
                        }
                    ]
                }
            })
        })

        it('opens version manager modal when button is clicked', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to pages tab and wait for data
            await userEvent.click(screen.getByText('Pages'))
            await waitFor(() => {
                expect(screen.getByText('Test Page')).toBeInTheDocument()
            })

            // Select the page
            await userEvent.click(screen.getByText('Test Page'))

            // Switch to versions tab
            await userEvent.click(screen.getByText('Versions'))

            // Click open version manager button
            await userEvent.click(screen.getByText('Open Version Manager'))

            // Should show version manager modal
            expect(screen.getByTestId('version-manager')).toBeInTheDocument()
        })
    })

    describe('Object publishing', () => {
        beforeEach(() => {
            mockedAxios.get.mockResolvedValue({
                data: {
                    results: [
                        {
                            id: 1,
                            title: 'Test Page',
                            slug: 'test'
                        }
                    ]
                }
            })
        })

        it('shows object publisher when page is selected', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to pages tab and wait for data
            await userEvent.click(screen.getByText('Pages'))
            await waitFor(() => {
                expect(screen.getByText('Test Page')).toBeInTheDocument()
            })

            // Select the page
            await userEvent.click(screen.getByText('Test Page'))

            // Switch to object publishing tab
            await userEvent.click(screen.getByText('Object Publishing'))

            // Should show object publisher
            expect(screen.getByTestId('object-publisher')).toBeInTheDocument()
        })
    })

    describe('Publishing workflow', () => {
        it('shows publication status dashboard by default', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to publishing workflow tab
            await userEvent.click(screen.getByText('Publishing Workflow'))

            // Should show status dashboard
            expect(screen.getByTestId('publication-status-dashboard')).toBeInTheDocument()
        })

        it('can switch between publishing workflow sub-tabs', async () => {
            renderWithQueryClient(<Settings />)

            // Switch to publishing workflow tab
            await userEvent.click(screen.getByText('Publishing Workflow'))

            // Click on timeline tab
            await userEvent.click(screen.getByText('Publication Timeline'))
            expect(screen.getByTestId('publication-timeline')).toBeInTheDocument()

            // Click on bulk operations tab
            await userEvent.click(screen.getByText('Bulk Operations'))
            expect(screen.getByTestId('bulk-publishing-operations')).toBeInTheDocument()
        })
    })
}) 