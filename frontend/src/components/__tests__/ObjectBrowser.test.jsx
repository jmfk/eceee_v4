import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ObjectBrowser from '../ObjectBrowser'
import ObjectTypeForm from '../ObjectTypeForm'
import ObjectBrowserConfiguration from '../ObjectBrowserConfiguration'
import { buildObjectTypeGroups } from '../objectBrowserGrouping'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    getMainBrowserTypes: vi.fn(),
    listObjectTypes: vi.fn(),
    getObjectType: vi.fn(),
    getBrowserConfiguration: vi.fn(),
    updateBrowserConfiguration: vi.fn(),
    filterOptions: vi.fn(),
    getRoots: vi.fn(),
    search: vi.fn(),
    deleteObject: vi.fn(),
    updateRelationships: vi.fn(),
    remoteConnections: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mocks.navigate }
})

vi.mock('../../api/objectStorage', () => ({
    objectTypesApi: {
        getMainBrowserTypes: mocks.getMainBrowserTypes,
        list: mocks.listObjectTypes,
        get: mocks.getObjectType,
        getBrowserConfiguration: mocks.getBrowserConfiguration,
        updateBrowserConfiguration: mocks.updateBrowserConfiguration,
        updateRelationships: mocks.updateRelationships,
    },
    objectInstancesApi: {
        getRoots: mocks.getRoots,
        search: mocks.search,
        filterOptions: mocks.filterOptions,
        delete: mocks.deleteObject,
    },
}))

vi.mock('../../api', () => ({
    namespacesApi: { list: vi.fn().mockResolvedValue([]) },
}))

vi.mock('../../api/designerThemes', () => ({
    designerThemesApi: { remoteConnections: mocks.remoteConnections },
}))

vi.mock('../../api/objectTransfers', () => ({
    objectTransfersApi: {
        catalog: vi.fn(),
        preflight: vi.fn(),
        createImport: vi.fn(),
        listImports: vi.fn().mockResolvedValue({ results: [] }),
        getImport: vi.fn(),
    },
}))

vi.mock('../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: vi.fn() }),
}))

vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }))
vi.mock('../help/ContextualHelpLink', () => ({ default: () => null }))
vi.mock('../media/OptimizedImage', () => ({ default: props => <img {...props} /> }))

const news = {
    id: 1,
    name: 'news',
    label: 'News Article',
    pluralLabel: 'News Articles',
    description: 'Editorial news',
    instanceCount: 12,
    isActive: true,
    hierarchyLevel: 'both',
    browserGroup: null,
}

const category = {
    id: 2,
    name: 'news_category',
    label: 'Category',
    pluralLabel: 'Categories',
    description: 'News categories',
    instanceCount: 4,
    browserGroup: { id: 1, name: 'news', label: 'News Article', pluralLabel: 'News Articles' },
}

const event = {
    id: 3,
    name: 'event',
    label: 'Event',
    pluralLabel: 'Events',
    description: 'Calendar events',
    instanceCount: 2,
    browserGroup: null,
}

const renderBrowser = (initialEntry = '/objects', routePath = '/objects') => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <QueryClientProvider client={queryClient}>
                <Routes>
                    <Route path={routePath} element={<ObjectBrowser />} />
                </Routes>
            </QueryClientProvider>
        </MemoryRouter>
    )
}

describe('buildObjectTypeGroups', () => {
    it('excludes pure sub-object types from the overview', () => {
        expect(buildObjectTypeGroups([news, { id: 9, label: 'Child', hierarchyLevel: 'sub_object_only' }])).toEqual([{ primary: news, supporting: [] }])
    })

    it('sorts main and supporting types and falls back when a group is missing', () => {
        const orphan = {
            id: 4,
            name: 'orphan',
            label: 'Archive',
            pluralLabel: 'Archives',
            browserGroup: { id: 999, label: 'Missing' },
        }

        const groups = buildObjectTypeGroups([category, news, event, orphan])

        expect(groups.map(group => group.primary.name)).toEqual(['orphan', 'event', 'news'])
        expect(groups.at(-1).supporting.map(type => type.name)).toEqual(['news_category'])
    })
})

describe('ObjectBrowser grouped type list', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getMainBrowserTypes.mockResolvedValue({ data: [category, news, event] })
        mocks.listObjectTypes.mockResolvedValue({ data: [news, category, event] })
        mocks.getRoots.mockResolvedValue({ data: { results: [] } })
        mocks.search.mockResolvedValue({ data: { results: [] } })
        mocks.getBrowserConfiguration.mockResolvedValue({ data: { config: { searchFields: [], filters: [] }, availableFilters: [] } })
        mocks.filterOptions.mockResolvedValue({ data: { results: [] } })
        mocks.updateRelationships.mockResolvedValue({ data: {} })
        mocks.remoteConnections.mockResolvedValue({ results: [] })
    })

    it('loads unpaginated browser group choices and saves the selected group', async () => {
        mocks.listObjectTypes.mockResolvedValue({ data: { results: [] } })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
                <ObjectTypeForm
                    objectType={{
                        ...category,
                        browserGroup: null,
                        allowedChildTypes: [],
                        hierarchyLevel: 'both',
                        isActive: true,
                        schema: { type: 'object', properties: {}, required: [], propertyOrder: [] },
                    }}
                    activeTab="relationships"
                    onSubmit={vi.fn()}
                    onCancel={vi.fn()}
                    onTabChange={vi.fn()}
                />
            </QueryClientProvider>
        )

        const groupSelect = await screen.findByLabelText('Main object type')
        await screen.findByRole('option', { name: 'News Articles' })
        expect(mocks.getMainBrowserTypes).toHaveBeenCalled()
        fireEvent.change(groupSelect, { target: { value: String(news.id) } })
        fireEvent.click(screen.getByRole('button', { name: 'Save Relationships' }))

        await waitFor(() => {
            expect(mocks.updateRelationships).toHaveBeenCalledWith(category.id, {
                hierarchyLevel: 'both',
                allowedChildTypes: [],
                browserGroupId: news.id,
            })
        })
    })

    it('separates main objects and supporting types grouped by category', async () => {
        renderBrowser()

        const groupList = await screen.findByRole('list', { name: 'Object type groups' })
        const eventButton = within(groupList).getByTestId('object-type-card-event')
        const newsButton = within(groupList).getByTestId('object-type-card-news')
        expect(within(groupList).queryByTestId('object-type-supporting-row-news-category')).not.toBeInTheDocument()

        expect(eventButton.compareDocumentPosition(newsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(newsButton).toHaveTextContent('News Articles')
        expect(newsButton).toHaveTextContent('12 items')
        fireEvent.click(screen.getByRole('tab', { name: 'Supporting objects' }))
        const categoryButton = screen.getByTestId('object-type-supporting-row-news-category')
        expect(screen.queryByTestId('object-type-card-news')).not.toBeInTheDocument()
        expect(categoryButton).toHaveTextContent('Categories')
        expect(categoryButton).toHaveTextContent('4 items')
        expect(screen.getByText('News Articles')).toBeInTheDocument()

        fireEvent.click(categoryButton)
        expect(mocks.navigate).toHaveBeenCalledWith('/objects/news_category')
    })

    it('hides category tabs when there are no supporting Object types', async () => {
        mocks.getMainBrowserTypes.mockResolvedValue({ data: [news, event] })
        renderBrowser()

        const groupList = await screen.findByRole('list', { name: 'Object type groups' })
        expect(await within(groupList).findByTestId('object-type-card-news')).toBeInTheDocument()
        expect(within(groupList).getByTestId('object-type-card-event')).toBeInTheDocument()
        expect(screen.queryByRole('tablist', { name: 'Object categories' })).not.toBeInTheDocument()
        expect(screen.queryByText('No supporting object types.')).not.toBeInTheDocument()
    })

    it('keeps the existing selected-type search behavior', async () => {
        renderBrowser('/objects/news', '/objects/:typeName')

        const searchInput = await screen.findByRole('searchbox', { name: 'Search News Articles' })
        await waitFor(() => expect(mocks.getRoots).toHaveBeenCalledWith({ type: 'news', page: 1, page_size: 20 }))

        fireEvent.change(searchInput, { target: { value: 'climate' } })

        await waitFor(() => {
            expect(mocks.search).toHaveBeenCalledWith('climate', { type: 'news', page: 1, page_size: 20, roots_only: 'true', browser: 'true' })
        })
    })

    it('searches the overview across Object types and shows paginated results', async () => {
        mocks.search.mockResolvedValue({ data: { results: [{ id: 18, title: 'Climate meeting', status: 'draft', objectType: event, createdAt: '2025-01-01' }], count: 1, totalPages: 1 } })
        renderBrowser()
        fireEvent.change(await screen.findByRole('searchbox', { name: 'Search all objects' }), { target: { value: 'climate' } })
        await waitFor(() => expect(mocks.search).toHaveBeenCalledWith('climate', {
            page: 1, page_size: 20, roots_only: 'true', browser: 'true',
        }))
        expect(await screen.findByText('Climate meeting')).toBeInTheDocument()
        expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument()
    })

    it('saves searchable fields and overview filters in the Object type editor', async () => {
        const user = userEvent.setup()
        const objectType = { ...news, schema: { properties: { firstName: { title: 'First name', componentType: 'text', type: 'string' } } } }
        mocks.getBrowserConfiguration.mockResolvedValue({ data: {
            config: { searchFields: [], filters: [] },
            availableFilters: [{ key: 'field:first_name', label: 'First name', kind: 'choice' }],
        } })
        mocks.updateBrowserConfiguration.mockResolvedValue({ data: { config: {
            searchFields: ['first_name'],
            filters: [{ key: 'field:first_name', label: 'First name', overview: true, control: 'checklist', quick: false }],
        } } })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={queryClient}><ObjectBrowserConfiguration objectType={objectType} /></QueryClientProvider>)
        await user.click(await screen.findByRole('checkbox', { name: 'First name' }))
        await user.click(screen.getByRole('checkbox', { name: /First name choice/ }))
        fireEvent.change(screen.getByRole('combobox', { name: 'First name filter control' }), { target: { value: 'checklist' } })
        await user.click(screen.getByRole('checkbox', { name: 'Show on overview' }))
        await user.click(screen.getByRole('checkbox', { name: 'Quick button' }))
        await user.click(screen.getByRole('button', { name: 'Save search and filters' }))
        await waitFor(() => expect(mocks.updateBrowserConfiguration).toHaveBeenCalledWith(1, {
            searchFields: ['first_name'],
            filters: [{ key: 'field:first_name', label: 'First name', overview: true, control: 'checklist', quick: true }],
        }))
    })

    it('applies a date preset from a quick button and sends its range to the server', async () => {
        mocks.getBrowserConfiguration.mockResolvedValue({ data: {
            config: { searchFields: [], filters: [{ key: 'effective_date', label: 'Publication date', overview: true, control: 'date_range', quick: true }] },
            availableFilters: [{ key: 'effective_date', label: 'Publication date', kind: 'date' }],
        } })
        renderBrowser('/objects/news', '/objects/:typeName')
        await userEvent.click(await screen.findByRole('button', { name: 'Filter by Publication date' }))
        expect(screen.getByRole('dialog', { name: 'Filter Publication date' })).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))

        const current = new Date()
        const first = new Date(current.getFullYear(), current.getMonth() - 1, 1)
        const last = new Date(current.getFullYear(), current.getMonth(), 0)
        const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        await waitFor(() => expect(mocks.getRoots).toHaveBeenCalledWith({
            type: 'news', page: 1, page_size: 20,
            browser_filters: JSON.stringify([{ key: 'effective_date', values: [format(first), format(last)] }]),
        }))
        expect(screen.queryByRole('dialog', { name: 'Filter Publication date' })).not.toBeInTheDocument()
    })

    it('requests pages of 20, 50, or 100 and resets after changing the size', async () => {
        mocks.getRoots.mockImplementation(async params => ({
            data: {
                results: [{ id: params.page, title: `Article page ${params.page}`, status: 'draft' }],
                count: 55,
                totalPages: Math.ceil(55 / params.page_size),
            },
        }))
        renderBrowser('/objects/news', '/objects/:typeName')

        expect(await screen.findByText('Showing 1–20 of 55')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        await waitFor(() => expect(mocks.getRoots).toHaveBeenCalledWith({ type: 'news', page: 2, page_size: 20 }))
        await screen.findByText('Page 2 of 3')

        fireEvent.click(screen.getByRole('combobox', { name: 'Items per page' }))
        fireEvent.click(await screen.findByRole('option', { name: '50 per page' }))
        await waitFor(() => expect(mocks.getRoots).toHaveBeenCalledWith({ type: 'news', page: 1, page_size: 50 }))
        expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('combobox', { name: 'Items per page' }))
        fireEvent.click(await screen.findByRole('option', { name: '100 per page' }))
        await waitFor(() => expect(mocks.getRoots).toHaveBeenCalledWith({ type: 'news', page: 1, page_size: 100 }))
        expect(await screen.findByText('Page 1 of 1')).toBeInTheDocument()
    })

    it('lets editors choose an import source', async () => {
        const user = userEvent.setup()
        renderBrowser()

        await user.click(await screen.findByRole('button', { name: 'Import' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Legacy import scripts' }))
        expect(mocks.navigate).toHaveBeenCalledWith('/settings/content-migration')

        await user.click(screen.getByRole('button', { name: 'Import' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Another ECEEE v4 site' }))
        expect(await screen.findByRole('dialog', { name: 'Import remote objects' })).toBeInTheDocument()
        expect(await screen.findByText(/No remote site connection is configured/)).toBeInTheDocument()
    })
})
