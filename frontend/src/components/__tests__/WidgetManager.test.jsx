import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WidgetManager from '../WidgetManager'
import { widgetsApi } from '../../api'

// Mock the widgets API
vi.mock('../../api', () => ({
    widgetsApi: {
        getTypes: vi.fn()
    }
}))

const mockWidgetTypes = [
    {
        name: 'Text Block',
        slug: 'text-block',
        description: 'Rich text content block with title and formatting options',
        isActive: true,
        templateName: 'webpages/widgets/text_block.html',
        hasConfigurationModel: true,
        configurationSchema: {
            properties: {
                title: { type: 'string' },
                content: { type: 'string' }
            }
        }
    },
    {
        name: 'Image',
        slug: 'image',
        description: 'Image display with caption and sizing options',
        isActive: true,
        templateName: 'webpages/widgets/image.html',
        hasConfigurationModel: true,
        configurationSchema: {
            properties: {
                src: { type: 'string' },
                alt: { type: 'string' }
            }
        }
    },
    {
        name: 'Button',
        slug: 'button',
        description: 'Interactive button with multiple styles and customizable appearance',
        isActive: true,
        templateName: 'webpages/widgets/button.html',
        hasConfigurationModel: true,
        configurationSchema: {
            properties: {
                text: { type: 'string' },
                url: { type: 'string' }
            }
        }
    },
    {
        name: 'Inactive Widget',
        slug: 'inactive-widget',
        description: 'This widget is inactive',
        isActive: false,
        templateName: 'webpages/widgets/inactive.html',
        hasConfigurationModel: false
    }
]

const renderWithQueryClient = (component) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    )
}

describe('WidgetManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        widgetsApi.getTypes.mockResolvedValue(mockWidgetTypes)
    })

    it('renders the widget manager header', async () => {
        renderWithQueryClient(<WidgetManager />)

        await waitFor(() => {
            expect(screen.getByText('Widget Types')).toBeInTheDocument()
            expect(screen.getByText('Manage and view all registered widget types in the system')).toBeInTheDocument()
        })
    })

    it('displays search input and controls', async () => {
        renderWithQueryClient(<WidgetManager />)

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search widgets by name or description...')).toBeInTheDocument()
            expect(screen.getByText('Show inactive')).toBeInTheDocument()
            expect(screen.getByText('All Widgets')).toBeInTheDocument()
        })
    })

    it('fetches and displays widget types', async () => {
        renderWithQueryClient(<WidgetManager />)

        await waitFor(() => {
            expect(widgetsApi.getTypes).toHaveBeenCalled()
        })

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
            expect(screen.getByText('Image')).toBeInTheDocument()
            expect(screen.getByText('Button')).toBeInTheDocument()
        })
    })

    it('shows correct widget descriptions', async () => {
        renderWithQueryClient(<WidgetManager />)

        await waitFor(() => {
            expect(screen.getByText('Rich text content block with title and formatting options')).toBeInTheDocument()
            expect(screen.getByText('Image display with caption and sizing options')).toBeInTheDocument()
            expect(screen.getByText('Interactive button with multiple styles and customizable appearance')).toBeInTheDocument()
        })
    })

    it('shows active status for active widgets', async () => {
        renderWithQueryClient(<WidgetManager />)

        await waitFor(() => {
            const activeStatuses = screen.getAllByText('Active')
            expect(activeStatuses).toHaveLength(3) // Three active widgets
        })
    })

    it('does not show inactive widgets by default', async () => {
        renderWithQueryClient(<WidgetManager />)

        await waitFor(() => {
            expect(screen.queryByText('Inactive Widget')).not.toBeInTheDocument()
        })
    })

    it('shows configurable badge for widgets with configuration models', async () => {
        renderWithQueryClient(<WidgetManager />)

        await waitFor(() => {
            const configurableBadges = screen.getAllByText('Configurable')
            expect(configurableBadges).toHaveLength(3) // Three widgets with config models
        })
    })

    it('shows results summary', async () => {
        renderWithQueryClient(<WidgetManager />)

        await waitFor(() => {
            expect(screen.getByText(/Showing 3 of 4 widget types/)).toBeInTheDocument()
        })
    })

    it('handles loading state', () => {
        widgetsApi.getTypes.mockImplementation(() => new Promise(() => { })) // Never resolves

        renderWithQueryClient(<WidgetManager />)

        // Should show loading skeleton
        expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('handles error state', async () => {
        widgetsApi.getTypes.mockRejectedValue(new Error('API Error'))

        renderWithQueryClient(<WidgetManager />)

        await waitFor(() => {
            expect(screen.getByText('Failed to load widget types')).toBeInTheDocument()
        })
    })
})
