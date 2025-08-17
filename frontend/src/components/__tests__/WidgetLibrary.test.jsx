import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import axios from 'axios'
import WidgetLibrary from '../WidgetLibrary'

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

describe('WidgetLibrary', () => {
    let queryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })

        // Setup mock axios responses for new API structure
        mockedAxios.get.mockResolvedValue({
            data: [
                {
                    name: "Text Block",
                    description: "A simple text content widget",
                    template_name: "webpages/widgets/text_block.html",
                    isActive: true,
                    configurationSchema: {
                        type: "object",
                        properties: {
                            content: { type: "string", description: "Text content" },
                            alignment: {
                                type: "string",
                                enum: ["left", "center", "right"],
                                default: "left"
                            }
                        },
                        required: ["content"]
                    }
                },
                {
                    name: "Image",
                    description: "Display an image with optional caption",
                    template_name: "webpages/widgets/image.html",
                    isActive: true,
                    configurationSchema: {
                        type: "object",
                        properties: {
                            image_url: { type: "string", description: "Image URL" },
                            alt_text: { type: "string", description: "Alt text" }
                        },
                        required: ["image_url", "alt_text"]
                    }
                },
                {
                    name: "Button",
                    description: "Interactive button widget",
                    template_name: "webpages/widgets/button.html",
                    isActive: false, // This should be filtered out
                    configurationSchema: {
                        type: "object",
                        properties: {
                            text: { type: "string", description: "Button text" },
                            url: { type: "string", description: "Target URL" }
                        },
                        required: ["text", "url"]
                    }
                }
            ]
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    const renderWithQueryClient = (component) => {
        return render(
            <QueryClientProvider client={queryClient}>
                {component}
            </QueryClientProvider>
        )
    }

    it('renders loading state initially', async () => {
        // Make the API call hang to test loading state
        mockedAxios.get.mockImplementation(() => new Promise(() => { }))

        renderWithQueryClient(<WidgetLibrary onSelectWidget={vi.fn()} />)

        expect(screen.getByText('Loading widget types...')).toBeInTheDocument()
    })

    it('renders widget types after loading', async () => {
        renderWithQueryClient(<WidgetLibrary onSelectWidget={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
            expect(screen.getByText('Image')).toBeInTheDocument()
        })

        // Should filter out inactive widgets
        expect(screen.queryByText('Button')).not.toBeInTheDocument()
    })

    it('makes correct API call', async () => {
        renderWithQueryClient(<WidgetLibrary onSelectWidget={vi.fn()} />)

        await waitFor(() => {
            expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/webpages/widget-types/')
        })
    })

    it('filters widgets by search term', async () => {
        renderWithQueryClient(<WidgetLibrary onSelectWidget={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Search widget types...')
        fireEvent.change(searchInput, { target: { value: 'image' } })

        await waitFor(() => {
            expect(screen.queryByText('Text Block')).not.toBeInTheDocument()
            expect(screen.getByText('Image')).toBeInTheDocument()
        })
    })

    it('filters widgets by category', async () => {
        renderWithQueryClient(<WidgetLibrary onSelectWidget={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
            expect(screen.getByText('Image')).toBeInTheDocument()
        })

        const categorySelect = screen.getByDisplayValue('All')
        fireEvent.change(categorySelect, { target: { value: 'media' } })

        await waitFor(() => {
            expect(screen.queryByText('Text Block')).not.toBeInTheDocument()
            expect(screen.getByText('Image')).toBeInTheDocument()
        })
    })

    it('calls onSelectWidget when widget is clicked', async () => {
        const mockOnSelectWidget = vi.fn()
        renderWithQueryClient(<WidgetLibrary onSelectWidget={mockOnSelectWidget} />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        const textBlockButton = screen.getByRole('button', { name: /Text Block/ })
        fireEvent.click(textBlockButton)

        expect(mockOnSelectWidget).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "Text Block",
                description: "A simple text content widget"
            })
        )
    })

    it('shows selected widgets as disabled', async () => {
        const selectedWidgetTypes = [{ name: "Text Block" }]

        renderWithQueryClient(
            <WidgetLibrary
                onSelectWidget={vi.fn()}
                selectedWidgetTypes={selectedWidgetTypes}
            />
        )

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        const textBlockButton = screen.getByRole('button', { name: /Text Block/ })
        expect(textBlockButton).toBeDisabled()
        expect(screen.getByText('(Selected)')).toBeInTheDocument()
    })

    it('displays error state when API call fails', async () => {
        mockedAxios.get.mockRejectedValue(new Error('API Error'))

        renderWithQueryClient(<WidgetLibrary onSelectWidget={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Error Loading Widget Types')).toBeInTheDocument()
            expect(screen.getByText('API Error')).toBeInTheDocument()
        })
    })

    it('shows empty state when no widgets match filter', async () => {
        renderWithQueryClient(<WidgetLibrary onSelectWidget={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Search widget types...')
        fireEvent.change(searchInput, { target: { value: 'nonexistent widget' } })

        await waitFor(() => {
            expect(screen.getByText('No widget types found')).toBeInTheDocument()
            expect(screen.getByText('Try adjusting your search or filter criteria')).toBeInTheDocument()
        })
    })

    it('displays code-based widgets info banner', async () => {
        renderWithQueryClient(<WidgetLibrary onSelectWidget={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Code-Based Widget Types')).toBeInTheDocument()
            expect(screen.getByText(/Widget types are now defined in code/)).toBeInTheDocument()
        })
    })
}) 