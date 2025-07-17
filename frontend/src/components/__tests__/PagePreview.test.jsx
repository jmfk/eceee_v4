import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import PagePreview from '../PagePreview'

// Mock axios
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
    }
}))

// Type the mocked axios
const mockedAxios = vi.mocked(axios)

const mockPreviewData = {
    page: {
        id: 1,
        title: 'Test Page',
        slug: 'test-page',
        description: 'A test page for preview'
    },
    effective_layout: {
        id: 1,
        name: 'Two Column Layout',
        slot_configuration: {
            slots: [
                {
                    name: 'main',
                    display_name: 'Main Content',
                    description: 'Primary content area',
                    css_classes: 'col-span-2'
                },
                {
                    name: 'sidebar',
                    display_name: 'Sidebar',
                    description: 'Secondary content',
                    css_classes: 'col-span-1'
                }
            ]
        }
    },
    effective_theme: {
        id: 1,
        name: 'Blue Theme',
        css_variables: {
            primary: '#3b82f6',
            background: '#ffffff',
            text: '#1f2937'
        },
        custom_css: '.blue-theme { background: var(--background); }'
    },
    widgets_by_slot: {
        main: [
            {
                widget: {
                    id: 1,
                    widget_type: { name: 'TextBlock' },
                    configuration: { content: 'Sample text content' }
                },
                inherited_from: null,
                is_override: false
            }
        ],
        sidebar: []
    }
}

const mockSamplePages = [
    { id: 1, title: 'Home Page' },
    { id: 2, title: 'About Us' },
    { id: 3, title: 'Services' }
]

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

describe('PagePreview', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockedAxios.get.mockImplementation((url) => {
            if (url.includes('/preview/')) {
                return Promise.resolve({ data: mockPreviewData })
            } else if (url.includes('/pages/')) {
                return Promise.resolve({ data: mockSamplePages })
            }
            return Promise.reject(new Error('Unknown URL'))
        })
    })

    it('renders preview interface with controls', () => {
        renderWithQueryClient(<PagePreview showControls={true} />)

        expect(screen.getByTitle('Mobile')).toBeInTheDocument()
        expect(screen.getByTitle('Tablet')).toBeInTheDocument()
        expect(screen.getByTitle('Desktop')).toBeInTheDocument()
        expect(screen.getByText('Inheritance Info')).toBeInTheDocument()
    })

    it('shows select page message when no page is selected', () => {
        renderWithQueryClient(<PagePreview />)

        expect(screen.getByText('Select a page to preview')).toBeInTheDocument()
    })

    it('fetches and displays preview data when page is selected', async () => {
        renderWithQueryClient(<PagePreview pageId="1" />)

        await waitFor(() => {
            expect(screen.getByText('Test Page')).toBeInTheDocument()
            expect(screen.getByText('A test page for preview')).toBeInTheDocument()
        })
    })

    it('displays layout slots correctly', async () => {
        renderWithQueryClient(<PagePreview pageId="1" />)

        await waitFor(() => {
            expect(screen.getByText('Main Content')).toBeInTheDocument()
            expect(screen.getByText('Sidebar')).toBeInTheDocument()
            expect(screen.getByText('Primary content area')).toBeInTheDocument()
            expect(screen.getByText('Secondary content')).toBeInTheDocument()
        }, { timeout: 10000 })
    })

    it('applies theme CSS variables', async () => {
        renderWithQueryClient(<PagePreview pageId="1" />)

        await waitFor(() => {
            // Find the div that has the CSS variables applied
            const styledDiv = document.querySelector('[style*="--primary"]')
            expect(styledDiv).toHaveStyle('--primary: #3b82f6')
            expect(styledDiv).toHaveStyle('--background: #ffffff')
            expect(styledDiv).toHaveStyle('--text: #1f2937')
        })
    })

    it('shows theme information section', async () => {
        renderWithQueryClient(<PagePreview pageId="1" />)

        await waitFor(() => {
            expect(screen.getByText('Active Theme: Blue Theme')).toBeInTheDocument()
            expect(screen.getByText('--primary')).toBeInTheDocument()
            expect(screen.getByText('#3b82f6')).toBeInTheDocument()
        })
    })

    it('renders widgets in correct slots', async () => {
        renderWithQueryClient(<PagePreview pageId="1" />)

        await waitFor(() => {
            expect(screen.getByText('Sample text content')).toBeInTheDocument()
        }, { timeout: 10000 })

        // Check if sidebar slot exists (may or may not show "No widgets" message)
        expect(screen.getByText('Sidebar')).toBeInTheDocument()
    })

    it('switches between preview sizes', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PagePreview pageId="1" showControls={true} />)

        await waitFor(() => {
            expect(screen.getByText('Test Page')).toBeInTheDocument()
        })

        // Click mobile size
        const mobileButton = screen.getByTitle('Mobile')
        await user.click(mobileButton)

        // Check mobile dimensions in status bar
        expect(screen.getByText('375px × 667px')).toBeInTheDocument()

        // Click tablet size
        const tabletButton = screen.getByTitle('Tablet')
        await user.click(tabletButton)

        expect(screen.getByText('768px × 1024px')).toBeInTheDocument()
    })

    it('toggles inheritance information display', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PagePreview pageId="1" showControls={true} />)

        await waitFor(() => {
            expect(screen.getByText('Test Page')).toBeInTheDocument()
        })

        // Toggle inheritance info
        const inheritanceButton = screen.getByText('Inheritance Info')
        await user.click(inheritanceButton)

        // Inheritance details should now be visible
        expect(screen.getAllByText('Slot: main')).toHaveLength(1)
    })

    it('refreshes preview data', async () => {
        const user = userEvent.setup()

        renderWithQueryClient(<PagePreview pageId="1" showControls={true} />)

        await waitFor(() => {
            expect(screen.getByText('Test Page')).toBeInTheDocument()
        })

        // Click refresh button
        const refreshButton = screen.getByTitle('Refresh preview')
        await user.click(refreshButton)

        // API should be called again
        expect(mockedAxios.get).toHaveBeenCalledTimes(2)
    })

    it('handles layout and theme overrides', async () => {
        renderWithQueryClient(
            <PagePreview pageId="1" layoutId="2" themeId="3" />
        )

        await waitFor(() => {
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('layout_id=2&theme_id=3')
            )
        })
    })

    it('shows loading state while fetching data', async () => {
        // Mock delayed response
        mockedAxios.get.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({ data: mockPreviewData }), 100))
        )

        renderWithQueryClient(<PagePreview pageId="1" />)

        expect(screen.getByText('Loading preview...')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('Test Page')).toBeInTheDocument()
        })
    })

    it('handles inheritance display for widgets', async () => {
        const mockDataWithInheritance = {
            ...mockPreviewData,
            widgets_by_slot: {
                main: [
                    {
                        widget: {
                            id: 1,
                            widget_type: { name: 'TextBlock' },
                            configuration: { content: 'Inherited content' }
                        },
                        inherited_from: 2,
                        is_override: false
                    },
                    {
                        widget: {
                            id: 2,
                            widget_type: { name: 'Header' },
                            configuration: { title: 'Override header' }
                        },
                        inherited_from: null,
                        is_override: true
                    }
                ]
            }
        }

        mockedAxios.get.mockResolvedValue({ data: mockDataWithInheritance })

        const user = userEvent.setup()
        renderWithQueryClient(<PagePreview pageId="1" showControls={true} />)

        await waitFor(() => {
            expect(screen.getByText('Test Page')).toBeInTheDocument()
        })

        // Enable inheritance info
        const inheritanceButton = screen.getByText('Inheritance Info')
        await user.click(inheritanceButton)

        // Should show inheritance indicators
        expect(screen.getByText('Inherited from page ID: 2')).toBeInTheDocument()
        expect(screen.getByText('Overrides inherited widget')).toBeInTheDocument()
    })

    it('renders different widget types correctly', async () => {
        const mockDataWithDifferentWidgets = {
            ...mockPreviewData,
            widgets_by_slot: {
                main: [
                    {
                        widget: {
                            id: 1,
                            widget_type: { name: 'TextBlock' },
                            configuration: { content: 'Text content' }
                        },
                        inherited_from: null,
                        is_override: false
                    },
                    {
                        widget: {
                            id: 2,
                            widget_type: { name: 'Header' },
                            configuration: { title: 'Sample Header' }
                        },
                        inherited_from: null,
                        is_override: false
                    },
                    {
                        widget: {
                            id: 3,
                            widget_type: { name: 'Image' },
                            configuration: { alt_text: 'Sample Image' }
                        },
                        inherited_from: null,
                        is_override: false
                    }
                ]
            }
        }

        mockedAxios.get.mockResolvedValue({ data: mockDataWithDifferentWidgets })

        renderWithQueryClient(<PagePreview pageId="1" />)

        await waitFor(() => {
            expect(screen.getByText('Text content')).toBeInTheDocument()
            expect(screen.getByText('Sample Header')).toBeInTheDocument()
            expect(screen.getByText('📷 Sample Image')).toBeInTheDocument()
        })
    })

    it('hides controls when showControls is false', () => {
        renderWithQueryClient(<PagePreview showControls={false} />)

        expect(screen.queryByTitle('Mobile')).not.toBeInTheDocument()
        expect(screen.queryByText('Inheritance Info')).not.toBeInTheDocument()
    })

    it('shows no layout message when no layout is defined', async () => {
        const mockDataWithoutLayout = {
            ...mockPreviewData,
            effective_layout: null
        }

        mockedAxios.get.mockResolvedValue({ data: mockDataWithoutLayout })

        renderWithQueryClient(<PagePreview pageId="1" />)

        await waitFor(() => {
            expect(screen.getByText('No layout selected')).toBeInTheDocument()
            expect(screen.getByText('Choose a layout to see the structure')).toBeInTheDocument()
        })
    })

    it('opens live page when external link is clicked', async () => {
        const user = userEvent.setup()

        // Mock window.open
        window.open = vi.fn()

        renderWithQueryClient(<PagePreview pageId="1" showControls={true} />)

        await waitFor(() => {
            expect(screen.getByText('Test Page')).toBeInTheDocument()
        })

        const externalLinkButton = screen.getByTitle('Open live page')
        await user.click(externalLinkButton)

        expect(window.open).toHaveBeenCalledWith('/test-page/', '_blank')
    })

    it('displays preview status in status bar', async () => {
        renderWithQueryClient(<PagePreview pageId="1" showControls={true} />)

        await waitFor(() => {
            expect(screen.getByText('Previewing: Test Page')).toBeInTheDocument()
            expect(screen.getByText('100% × 600px')).toBeInTheDocument()
        })
    })

    it('handles API errors gracefully', async () => {
        // Mock API error
        mockedAxios.get.mockRejectedValue(new Error('API Error'))

        renderWithQueryClient(<PagePreview pageId="1" />)

        // Component should still render without crashing
        expect(screen.getByText('Loading preview...')).toBeInTheDocument()
    })
}) 