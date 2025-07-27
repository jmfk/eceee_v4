import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import ThemeEditor from '../ThemeEditor'
import { GlobalNotificationProvider } from '../../contexts/GlobalNotificationContext'
import { NotificationProvider } from '../NotificationManager'

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

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    }
}))

// Type the mocked axios
const mockedAxios = vi.mocked(axios)

const mockThemes = [
    {
        id: 1,
        name: 'Blue Theme',
        description: 'A professional blue color scheme',
        css_variables: {
            primary: '#3b82f6',
            'primary-dark': '#1d4ed8',
            secondary: '#64748b',
            background: '#ffffff',
            text: '#1f2937'
        },
        custom_css: '.blue-theme { background: var(--background); }',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        created_by: { username: 'testuser' }
    },
    {
        id: 2,
        name: 'Dark Theme',
        description: 'A modern dark color scheme',
        css_variables: {
            primary: '#8b5cf6',
            background: '#111827',
            text: '#f9fafb'
        },
        custom_css: '.dark-theme { color: var(--text); }',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        created_by: { username: 'testuser' }
    }
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
            <GlobalNotificationProvider>
                <NotificationProvider>
                    {component}
                </NotificationProvider>
            </GlobalNotificationProvider>
        </QueryClientProvider>
    )
}

describe('ThemeEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock successful API responses with paginated structure
        mockedAxios.get.mockResolvedValue({
            data: {
                count: mockThemes.length,
                next: null,
                previous: null,
                results: mockThemes
            }
        })
        mockedAxios.post.mockResolvedValue({ data: mockThemes[0] })
        mockedAxios.put.mockResolvedValue({ data: mockThemes[0] })
        mockedAxios.delete.mockResolvedValue({ data: {} })
    })

    it('renders the theme editor interface', async () => {
        renderWithQueryClient(<ThemeEditor />)

        expect(screen.getByText('Theme Editor')).toBeInTheDocument()
        expect(screen.getByText('Create and manage page themes with color schemes and styling')).toBeInTheDocument()
        expect(screen.getByText('New Theme')).toBeInTheDocument()

        // Wait for themes to load
        await waitFor(() => {
            expect(screen.getByText('Available Themes')).toBeInTheDocument()
        })
    })

    it('displays list of themes with color previews', async () => {
        renderWithQueryClient(<ThemeEditor />)

        await waitFor(() => {
            expect(screen.getByText('Blue Theme')).toBeInTheDocument()
            expect(screen.getByText('Dark Theme')).toBeInTheDocument()
            expect(screen.getByText('5 variables')).toBeInTheDocument()
            expect(screen.getByText('3 variables')).toBeInTheDocument()
        })
    })

    it('shows theme status indicators', async () => {
        renderWithQueryClient(<ThemeEditor />)

        await waitFor(() => {
            const activeElements = screen.getAllByText('Active')
            expect(activeElements).toHaveLength(2) // Both themes are active
        })
    })

    it('opens theme creation form when New Theme is clicked', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<ThemeEditor />)

        const newThemeButton = screen.getByText('New Theme')
        await user.click(newThemeButton)

        expect(screen.getByText('Create New Theme')).toBeInTheDocument()
        expect(screen.getByLabelText('Theme Name')).toBeInTheDocument()
        expect(screen.getByLabelText('Description')).toBeInTheDocument()
        expect(screen.getByText('CSS Variables')).toBeInTheDocument()
    })

    it('allows selecting a theme for editing', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<ThemeEditor />)

        await waitFor(() => {
            expect(screen.getByText('Blue Theme')).toBeInTheDocument()
        })

        const themeItem = screen.getByText('Blue Theme').closest('div')
        await user.click(themeItem)

        expect(screen.getByText('Edit')).toBeInTheDocument()
        expect(screen.getByText('Delete')).toBeInTheDocument()
        expect(screen.getByText('Export')).toBeInTheDocument()
    })

    it('can add new CSS variables', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<ThemeEditor />)

        // Open creation form
        const newThemeButton = screen.getByText('New Theme')
        await user.click(newThemeButton)

        // Add a variable
        const variableNameInput = screen.getByPlaceholderText('Variable name (e.g., primary-color)')
        const variableValueInput = screen.getByPlaceholderText('Value (e.g., #3b82f6)')

        await user.type(variableNameInput, 'primary')
        await user.type(variableValueInput, '#3b82f6')

        const addButton = screen.getByRole('button', { name: /add variable/i })
        await user.click(addButton)

        expect(screen.getByDisplayValue('primary')).toBeInTheDocument()
        // Check both color input and text input exist with #3b82f6 value
        const colorInputs = screen.getAllByDisplayValue('#3b82f6')
        expect(colorInputs).toHaveLength(2)
    })

    it('applies color scheme templates', async () => {
        const user = userEvent.setup()
        const mockToast = vi.mocked(await import('react-hot-toast')).default

        renderWithQueryClient(<ThemeEditor />)

        // Open creation form
        const newThemeButton = screen.getByText('New Theme')
        await user.click(newThemeButton)

        // Apply blue theme template
        const blueThemeButtons = screen.getAllByText('Blue Theme')
        // Click the template button (should be the second one in the color scheme templates)
        await user.click(blueThemeButtons[1])

        expect(mockToast.success).toHaveBeenCalledWith('Applied Blue Theme template')
    })

    it('validates required fields when creating theme', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<ThemeEditor />)

        // Open creation form
        const newThemeButton = screen.getByText('New Theme')
        await user.click(newThemeButton)

        // Try to submit without required fields
        const createButton = screen.getByText('Create Theme')
        await user.click(createButton)

        // Form should not submit (name is required)
        const nameInput = screen.getByLabelText('Theme Name')
        expect(nameInput).toBeInvalid()
    })

    it('can remove CSS variables', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<ThemeEditor />)

        // Open creation form and add a variable
        const newThemeButton = screen.getByText('New Theme')
        await user.click(newThemeButton)

        const variableNameInput = screen.getByPlaceholderText('Variable name (e.g., primary-color)')
        const variableValueInput = screen.getByPlaceholderText('Value (e.g., #3b82f6)')

        await user.type(variableNameInput, 'primary')
        await user.type(variableValueInput, '#3b82f6')

        const addButton = screen.getByRole('button', { name: /add variable/i })
        await user.click(addButton)

        // Remove the variable
        const removeButton = screen.getByRole('button', { name: /remove variable/i })
        await user.click(removeButton)

        expect(screen.queryByDisplayValue('primary')).not.toBeInTheDocument()
    })

    it('submits theme creation form', async () => {
        const user = userEvent.setup()

        renderWithQueryClient(<ThemeEditor />)

        // Open creation form
        const newThemeButton = screen.getByText('New Theme')
        await user.click(newThemeButton)

        // Fill form
        const nameInput = screen.getByLabelText('Theme Name')
        await user.type(nameInput, 'Test Theme')

        const descriptionInput = screen.getByLabelText('Description')
        await user.type(descriptionInput, 'A test theme')

        // Add a variable
        const variableNameInput = screen.getByPlaceholderText('Variable name (e.g., primary-color)')
        const variableValueInput = screen.getByPlaceholderText('Value (e.g., #3b82f6)')

        await user.type(variableNameInput, 'primary')
        await user.type(variableValueInput, '#3b82f6')

        const addButton = screen.getByRole('button', { name: /add variable/i })
        await user.click(addButton)

        // Submit form
        const createButton = screen.getByText('Create Theme')
        await user.click(createButton)

        await waitFor(() => {
            expect(mockedAxios.post).toHaveBeenCalledWith(
                '/api/v1/webpages/themes/',
                expect.objectContaining({
                    name: 'Test Theme',
                    description: 'A test theme',
                    css_variables: expect.objectContaining({
                        primary: '#3b82f6'
                    })
                })
            )
        })
    })

    it('handles theme deletion', async () => {
        const user = userEvent.setup()

        // Mock window.confirm
        window.confirm = vi.fn(() => true)

        renderWithQueryClient(<ThemeEditor />)

        // Select a theme
        await waitFor(() => {
            expect(screen.getByText('Blue Theme')).toBeInTheDocument()
        })

        const themeItem = screen.getByText('Blue Theme').closest('div')
        await user.click(themeItem)

        // Click delete
        const deleteButton = screen.getByText('Delete')
        await user.click(deleteButton)

        expect(window.confirm).toHaveBeenCalledWith(
            'Are you sure you want to delete this theme? This action cannot be undone.'
        )

        await waitFor(() => {
            expect(mockedAxios.delete).toHaveBeenCalledWith('/api/v1/webpages/themes/1/')
        })
    })

    it('shows theme preview when requested', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<ThemeEditor />)

        // Select a theme
        await waitFor(() => {
            expect(screen.getByText('Blue Theme')).toBeInTheDocument()
        })

        const themeItem = screen.getByText('Blue Theme').closest('div')
        await user.click(themeItem)

        // Show preview
        const previewButton = screen.getByText('Show Preview')
        await user.click(previewButton)

        expect(screen.getByText('Theme Preview')).toBeInTheDocument()
        expect(screen.getByText('Sample Header')).toBeInTheDocument()
        expect(screen.getByText('Color Palette')).toBeInTheDocument()
    })

    it('exports theme data', async () => {
        const user = userEvent.setup()
        const toast = require('react-hot-toast').default

        // Mock URL.createObjectURL and related functions
        global.URL.createObjectURL = vi.fn(() => 'mock-url')
        global.URL.revokeObjectURL = vi.fn()

        // Mock document.createElement and click
        const mockLink = {
            href: '',
            download: '',
            click: vi.fn()
        }

        // Only mock createElement for 'a' elements, let React create other elements normally
        const originalCreateElement = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'a') {
                return mockLink
            }
            return originalCreateElement(tagName)
        })

        renderWithQueryClient(<ThemeEditor />)

        // Select a theme
        await waitFor(() => {
            expect(screen.getByText('Blue Theme')).toBeInTheDocument()
        })

        const themeItem = screen.getByText('Blue Theme').closest('div')
        await user.click(themeItem)

        // Export theme
        const exportButton = screen.getByText('Export')
        await user.click(exportButton)

        expect(mockLink.click).toHaveBeenCalled()

        const mockToast = vi.mocked(await import('react-hot-toast')).default
        expect(mockToast.success).toHaveBeenCalledWith('Theme exported successfully')
    })

    it('displays CSS variables correctly', async () => {
        renderWithQueryClient(<ThemeEditor />)

        // Select a theme
        await waitFor(() => {
            expect(screen.getByText('Blue Theme')).toBeInTheDocument()
        })

        const themeItem = screen.getByText('Blue Theme').closest('div')
        await userEvent.setup().click(themeItem)

        // Check CSS variables display
        expect(screen.getByText('--primary')).toBeInTheDocument()
        expect(screen.getByText('#3b82f6')).toBeInTheDocument()
        expect(screen.getByText('--background')).toBeInTheDocument()
        expect(screen.getByText('#ffffff')).toBeInTheDocument()
    })

    it('shows custom CSS when theme has it', async () => {
        renderWithQueryClient(<ThemeEditor />)

        // Select a theme
        await waitFor(() => {
            expect(screen.getByText('Blue Theme')).toBeInTheDocument()
        })

        const themeItem = screen.getByText('Blue Theme').closest('div')
        await userEvent.setup().click(themeItem)

        // Check custom CSS section
        expect(screen.getByText('Custom CSS')).toBeInTheDocument()
        expect(screen.getByText('.blue-theme { background: var(--background); }')).toBeInTheDocument()
    })

    it('handles color picker changes', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<ThemeEditor />)

        // Open creation form and add a color variable
        const newThemeButton = screen.getByText('New Theme')
        await user.click(newThemeButton)

        const variableNameInput = screen.getByPlaceholderText('Variable name (e.g., primary-color)')
        const variableValueInput = screen.getByPlaceholderText('Value (e.g., #3b82f6)')

        await user.type(variableNameInput, 'primary')
        await user.type(variableValueInput, '#3b82f6')

        const addButton = screen.getByRole('button', { name: /add variable/i })
        await user.click(addButton)

        // Color picker should be available for color values  
        const colorInputs = screen.getAllByDisplayValue('#3b82f6')
        expect(colorInputs).toHaveLength(2) // Color input and text input
    })

    it('shows CSS editor when toggled', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<ThemeEditor />)

        // Open creation form
        const newThemeButton = screen.getByText('New Theme')
        await user.click(newThemeButton)

        // Toggle CSS editor - check button changes text 
        const showCssButton = screen.getByText('Show CSS')
        await user.click(showCssButton)

        // Check that the CSS editor section appears
        expect(screen.getByText('Generated CSS Variables')).toBeInTheDocument()
        expect(screen.getByText('Hide Editor')).toBeInTheDocument()
    })

    it('handles API errors gracefully', async () => {
        // Mock API error
        mockedAxios.get.mockRejectedValue(new Error('API Error'))

        renderWithQueryClient(<ThemeEditor />)

        // Component should still render without crashing
        expect(screen.getByText('Theme Editor')).toBeInTheDocument()
    })

    it('shows loading state while fetching themes', async () => {
        // Mock delayed response with paginated structure
        mockedAxios.get.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({
                data: {
                    count: mockThemes.length,
                    next: null,
                    previous: null,
                    results: mockThemes
                }
            }), 100))
        )

        renderWithQueryClient(<ThemeEditor />)

        // Should show loading animation (skeleton)
        const loadingElements = document.querySelectorAll('.animate-pulse')
        expect(loadingElements.length).toBeGreaterThan(0)

        await waitFor(() => {
            expect(screen.getByText('Blue Theme')).toBeInTheDocument()
        })
    })
}) 