import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from '../SettingsManager'
import { getSettingsHelpTopic } from '../../utils/howToHelp'
import { renderWithStateProviders } from '../../test/testUtils'

const routerMocks = vi.hoisted(() => ({
    pathname: '/settings',
    searchParams: new URLSearchParams(),
    navigate: vi.fn(),
    setSearchParams: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => routerMocks.navigate,
        useLocation: () => ({
            pathname: routerMocks.pathname,
            search: routerMocks.searchParams.toString() ? `?${routerMocks.searchParams.toString()}` : '',
            hash: '',
            state: null,
        }),
        useSearchParams: () => [routerMocks.searchParams, routerMocks.setSearchParams],
    }
})

vi.mock('../../api/client.js', () => ({
    api: {
        get: vi.fn(() => Promise.resolve({ data: { results: [], count: 0 } })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}))

vi.mock('../../api/layouts', () => ({
    layoutsApi: {
        combined: {
            listAll: vi.fn(() => Promise.resolve({ codeLayouts: [] })),
        },
    },
}))

vi.mock('../../hooks/useDocumentTitle', () => ({
    useDocumentTitle: vi.fn(),
}))

vi.mock('../../components/SettingsDashboard', () => ({
    default: () => <div data-testid="settings-dashboard">Settings Dashboard</div>,
}))

vi.mock('../../components/LayoutEditor', () => ({
    default: () => <div data-testid="layout-editor">Layout Editor Component</div>,
}))

vi.mock('../../components/ThemeEditor', () => ({
    default: ({ onSave }) => (
        <div data-testid="theme-editor">
            Theme Editor Component
            <button type="button" onClick={() => onSave(() => Promise.resolve())}>
                Register Save
            </button>
        </div>
    ),
}))

vi.mock('../../components/StatusBar', () => ({
    default: ({ onSaveClick }) => (
        <div data-testid="status-bar">
            Theme status
            <button type="button" onClick={onSaveClick}>Save Theme</button>
        </div>
    ),
}))

vi.mock('../../components/WidgetManager', () => ({
    default: () => <div data-testid="widget-manager">Widget Manager</div>,
}))

vi.mock('../../components/ValueListEditor', () => ({
    default: () => <div data-testid="value-list-editor">Value List Editor</div>,
}))

vi.mock('../../components/ObjectTypeManager', () => ({
    default: () => <div data-testid="object-type-manager">Object Type Manager</div>,
}))

vi.mock('../../components/NamespaceManager', () => ({
    default: () => <div data-testid="namespace-manager">Namespace Manager</div>,
}))

vi.mock('../../components/DataConnectionsManager', () => ({
    default: () => <div data-testid="data-connections-manager">Data Connections Manager</div>,
}))

vi.mock('../../components/contentMigration/MigrationManager', () => ({
    default: () => <div data-testid="migration-manager">Migration Manager</div>,
}))

vi.mock('../../components/VersionManager', () => ({
    default: ({ pageId, onClose }) => (
        <div data-testid="version-manager">
            Version Manager for page {pageId}
            <button type="button" onClick={onClose}>Close</button>
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

const renderSettings = (path = '/settings', search = '') => {
    routerMocks.pathname = path
    routerMocks.searchParams = new URLSearchParams(search)
    routerMocks.setSearchParams = vi.fn((params) => {
        routerMocks.searchParams = params instanceof URLSearchParams
            ? params
            : new URLSearchParams(params)
    })

    return renderWithStateProviders(<Settings />)
}

describe('SettingsManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        routerMocks.pathname = '/settings'
        routerMocks.searchParams = new URLSearchParams()
    })

    it('renders the dashboard by default', () => {
        renderSettings('/settings')

        expect(screen.getByTestId('settings-dashboard')).toBeInTheDocument()
    })

    it('falls back to the dashboard for unknown settings paths', () => {
        renderSettings('/settings/unknown')

        expect(screen.getByTestId('settings-dashboard')).toBeInTheDocument()
    })

    it('renders layout management from the layouts route', () => {
        renderSettings('/settings/layouts')

        expect(screen.getByTestId('layout-editor')).toBeInTheDocument()
    })

    it('links settings sections to contextual how-to anchors', async () => {
        const user = userEvent.setup()
        renderSettings('/settings/themes')

        await user.click(screen.getByRole('button', { name: /open settings help/i }))

        expect(screen.getByRole('menuitem', { name: /edit themes/i })).toHaveAttribute(
            'href',
            '/help/how-to/settings-themes'
        )
        expect(screen.getByRole('menuitem', { name: /edit themes/i })).toHaveAttribute('target', '_blank')
    })

    it('maps active settings tabs to the expected help topics', () => {
        expect(getSettingsHelpTopic('layouts')).toBe('settings-layouts')
        expect(getSettingsHelpTopic('themes')).toBe('settings-themes')
        expect(getSettingsHelpTopic('publishing')).toBe('settings-publishing')
        expect(getSettingsHelpTopic('widgets')).toBe('widgets-edit')
        expect(getSettingsHelpTopic('unknown')).toBe('settings')
    })

    it('renders theme management for theme routes and shows the theme status bar', () => {
        renderSettings('/settings/themes/1/colors')

        expect(screen.getByTestId('theme-editor')).toBeInTheDocument()
        expect(screen.getByTestId('status-bar')).toBeInTheDocument()
    })

    it('wires the theme save callback into the status bar', async () => {
        const user = userEvent.setup()
        renderSettings('/settings/themes')

        await user.click(screen.getByRole('button', { name: /register save/i }))
        await user.click(screen.getByRole('button', { name: /save theme/i }))

        expect(screen.getByTestId('theme-editor')).toBeInTheDocument()
    })

    it('renders widget management from the widgets route', () => {
        renderSettings('/settings/widgets')

        expect(screen.getByTestId('widget-manager')).toBeInTheDocument()
    })

    it('renders value list management from the value-lists route', () => {
        renderSettings('/settings/value-lists')

        expect(screen.getByTestId('value-list-editor')).toBeInTheDocument()
    })

    it('renders object type management from the object-types route', () => {
        renderSettings('/settings/object-types')

        expect(screen.getByTestId('object-type-manager')).toBeInTheDocument()
    })

    it('renders namespace management from the namespaces route', () => {
        renderSettings('/settings/namespaces')

        expect(screen.getByTestId('namespace-manager')).toBeInTheDocument()
    })

    it('renders data connection management from nested data-connections routes', () => {
        renderSettings('/settings/data-connections/new')

        expect(screen.getByTestId('data-connections-manager')).toBeInTheDocument()
    })

    it('renders content migration from nested content-migration routes', () => {
        renderSettings('/settings/content-migration/jobs')

        expect(screen.getByTestId('migration-manager')).toBeInTheDocument()
    })

    it('renders version empty state from the versions route', () => {
        renderSettings('/settings/versions')

        expect(screen.getByText('Select a page from the Pages tab to view its version history')).toBeInTheDocument()
    })

    it('renders publishing dashboard by default on the publishing route', () => {
        renderSettings('/settings/publishing')

        expect(screen.getByTestId('publication-status-dashboard')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /status dashboard/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /publication timeline/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /bulk operations/i })).toBeInTheDocument()
    })

    it('renders the publishing timeline from search params', () => {
        renderSettings('/settings/publishing', 'publishingView=timeline')

        expect(screen.getByTestId('publication-timeline')).toBeInTheDocument()
    })

    it('renders publishing bulk operations from search params', () => {
        renderSettings('/settings/publishing', 'publishingView=bulk')

        expect(screen.getByTestId('bulk-publishing-operations')).toBeInTheDocument()
    })

    it('updates publishing search params when switching publishing tabs', async () => {
        const user = userEvent.setup()
        renderSettings('/settings/publishing')

        await user.click(screen.getByRole('button', { name: /publication timeline/i }))

        expect(routerMocks.setSearchParams).toHaveBeenCalled()
        expect(routerMocks.searchParams.get('publishingView')).toBe('timeline')
    })

    it('uses exact route matching for widgets so nested widget paths fall back', () => {
        renderSettings('/settings/widgets/extra')

        expect(screen.getByTestId('settings-dashboard')).toBeInTheDocument()
    })

    it('uses exact route matching for versions so nested version paths fall back', () => {
        renderSettings('/settings/versions/1')

        expect(screen.getByTestId('settings-dashboard')).toBeInTheDocument()
    })

    it('does not show the theme status bar outside theme routes', () => {
        renderSettings('/settings/layouts')

        expect(screen.queryByTestId('status-bar')).not.toBeInTheDocument()
    })
})
