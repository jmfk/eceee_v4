import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeEditor from '../ThemeEditor'
import { renderWithStateProviders, createTestQueryClient } from '../../test/testUtils'
import { apiResponse, mockApiPending, mockAxiosInstance, resetApiMocks } from '../../test/apiMockUtils'

const routerMocks = vi.hoisted(() => ({
    params: {},
    navigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => routerMocks.navigate,
        useParams: () => routerMocks.params,
        useLocation: () => ({
            pathname: '/',
            search: '',
            hash: '',
            state: null,
        }),
    }
})

const mockThemes = [
    {
        id: 1,
        name: 'Blue Theme',
        description: 'A professional blue color scheme',
        colors: {
            primary: '#3b82f6',
            secondary: '#64748b',
            background: '#ffffff',
        },
        fonts: {},
        designGroups: { groups: [] },
        componentStyles: {},
        imageStyles: {},
        tableTemplates: {},
        isActive: true,
        isDefault: true,
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: { username: 'testuser' },
    },
    {
        id: 2,
        name: 'Dark Theme',
        description: 'A modern dark color scheme',
        colors: {
            primary: '#8b5cf6',
            background: '#111827',
            text: '#f9fafb',
        },
        fonts: {},
        designGroups: { groups: [] },
        componentStyles: {},
        imageStyles: {},
        tableTemplates: {},
        isActive: true,
        isDefault: false,
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: { username: 'testuser' },
    },
]

const listResponse = {
    count: mockThemes.length,
    next: null,
    previous: null,
    results: mockThemes,
}

const renderThemeEditor = (component = <ThemeEditor />) => {
    const queryClient = createTestQueryClient()
    return renderWithStateProviders(component, { queryClient })
}

const mockThemeRequests = () => {
    mockAxiosInstance.get.mockImplementation((url) => {
        if (url === '/api/v1/webpages/themes/1/') {
            return Promise.resolve(apiResponse(mockThemes[0]))
        }

        if (url === '/api/v1/webpages/themes/1/export_theme/') {
            return Promise.resolve(apiResponse(new Blob(['theme export'])))
        }

        return Promise.resolve(apiResponse(listResponse))
    })
}

describe('ThemeEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetApiMocks()
        routerMocks.params = {}
        mockThemeRequests()
        mockAxiosInstance.post.mockResolvedValue(apiResponse(mockThemes[0]))
        mockAxiosInstance.put.mockResolvedValue(apiResponse(mockThemes[0]))
        mockAxiosInstance.patch.mockResolvedValue(apiResponse(mockThemes[0]))
        mockAxiosInstance.delete.mockResolvedValue(apiResponse({}))
    })

    it('renders the current theme management list UI', async () => {
        renderThemeEditor()

        expect(screen.getByRole('heading', { name: 'Theme Management' })).toBeInTheDocument()
        expect(screen.getByText('Create and manage themes with fonts, colors, typography, component styles, and table templates')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /create theme/i })).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('Blue Theme')).toBeInTheDocument()
            expect(screen.getByText('Dark Theme')).toBeInTheDocument()
        })
    })

    it('filters themes by name or description', async () => {
        const user = userEvent.setup()
        renderThemeEditor()

        await screen.findByText('Blue Theme')

        await user.type(screen.getByPlaceholderText('Search themes...'), 'dark')

        expect(screen.queryByText('Blue Theme')).not.toBeInTheDocument()
        expect(screen.getByText('Dark Theme')).toBeInTheDocument()
    })

    it('shows an empty state when the search has no matches', async () => {
        const user = userEvent.setup()
        renderThemeEditor()

        await screen.findByText('Blue Theme')

        await user.type(screen.getByPlaceholderText('Search themes...'), 'missing')

        expect(screen.getByText('No themes found matching your search')).toBeInTheDocument()
    })

    it('navigates to the create route from the list', async () => {
        const user = userEvent.setup()
        renderThemeEditor()

        await user.click(screen.getByRole('button', { name: /create theme/i }))

        expect(routerMocks.navigate).toHaveBeenCalledWith('/settings/themes/new')
    })

    it('navigates to the edit route from a theme card', async () => {
        const user = userEvent.setup()
        renderThemeEditor()

        await screen.findByText('Blue Theme')
        await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

        expect(routerMocks.navigate).toHaveBeenCalledWith('/settings/themes/1')
    })

    it('renders the create route with current theme tabs and basic fields', async () => {
        routerMocks.params = { themeId: 'new' }

        renderThemeEditor()

        expect(await screen.findByRole('heading', { name: 'Create Theme' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Basic Info' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Colors' })).toBeInTheDocument()
        expect(screen.getByText('Basic Information')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('My Awesome Theme')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Brief description of this theme')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: 'Active' })).toBeChecked()
    })

    it('updates fields in the create route through the unified state provider', async () => {
        const user = userEvent.setup()
        routerMocks.params = { themeId: 'new' }

        renderThemeEditor()

        const nameInput = await screen.findByPlaceholderText('My Awesome Theme')
        await user.type(nameInput, 'Test Theme', { delay: 1 })

        await waitFor(() => {
            expect(nameInput).toHaveValue('Test Theme')
        })
    })

    it('renders an existing theme in edit mode from the current route params', async () => {
        routerMocks.params = { themeId: '1' }

        renderThemeEditor()

        expect(await screen.findByRole('heading', { name: 'Edit: Blue Theme' })).toBeInTheDocument()
        expect(screen.getByPlaceholderText('My Awesome Theme')).toHaveValue('Blue Theme')
        expect(screen.getByPlaceholderText('Brief description of this theme')).toHaveValue('A professional blue color scheme')
        expect(screen.getByRole('button', { name: /clear css cache/i })).toBeInTheDocument()
    })

    it('navigates between editor tabs using the route model', async () => {
        const user = userEvent.setup()
        routerMocks.params = { themeId: '1' }

        renderThemeEditor()

        await screen.findByRole('heading', { name: 'Edit: Blue Theme' })
        await user.click(screen.getByRole('button', { name: 'Colors' }))

        expect(routerMocks.navigate).toHaveBeenCalledWith('/settings/themes/1/colors')
    })

    it('exports a theme through the wrapped themes API', async () => {
        const user = userEvent.setup()
        const createObjectURL = vi.fn(() => 'blob:theme')
        const revokeObjectURL = vi.fn()
        const linkClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { })
        Object.defineProperty(window.URL, 'createObjectURL', {
            value: createObjectURL,
            configurable: true,
        })
        Object.defineProperty(window.URL, 'revokeObjectURL', {
            value: revokeObjectURL,
            configurable: true,
        })

        renderThemeEditor()

        await screen.findByText('Blue Theme')
        await user.click(screen.getAllByRole('button', { name: /export/i })[0])

        await waitFor(() => {
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/webpages/themes/1/export_theme/', { responseType: 'blob' })
        })
        expect(createObjectURL).toHaveBeenCalled()
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:theme')

        linkClick.mockRestore()
    })

    it('shows the loading state while themes are being fetched', () => {
        mockApiPending('get')

        renderThemeEditor()

        expect(screen.getByText('Loading themes...')).toBeInTheDocument()
    })

    it('keeps the list shell mounted when theme loading fails', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { })
        mockAxiosInstance.get.mockRejectedValue(new Error('API Error'))

        renderThemeEditor()

        expect(screen.getByRole('heading', { name: 'Theme Management' })).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.getByText('No themes created yet')).toBeInTheDocument()
        })

        consoleError.mockRestore()
    })
})
