import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ObjectBrowser from '../ObjectBrowser'
import ObjectTypeForm from '../ObjectTypeForm'
import { buildObjectTypeGroups } from '../objectBrowserGrouping'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    getMainBrowserTypes: vi.fn(),
    listObjectTypes: vi.fn(),
    getObjectType: vi.fn(),
    getRoots: vi.fn(),
    search: vi.fn(),
    deleteObject: vi.fn(),
    updateRelationships: vi.fn(),
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
        updateRelationships: mocks.updateRelationships,
    },
    objectInstancesApi: {
        getRoots: mocks.getRoots,
        search: mocks.search,
        delete: mocks.deleteObject,
    },
}))

vi.mock('../../api', () => ({
    namespacesApi: { list: vi.fn().mockResolvedValue([]) },
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
        mocks.updateRelationships.mockResolvedValue({ data: {} })
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

    it('renders large main rows and smaller supporting rows in alphabetical groups', async () => {
        renderBrowser()

        const groupList = await screen.findByRole('list', { name: 'Object type groups' })
        const eventButton = within(groupList).getByTestId('object-type-card-event')
        const newsButton = within(groupList).getByTestId('object-type-card-news')
        const categoryButton = within(groupList).getByTestId('object-type-supporting-row-news-category')

        expect(eventButton.compareDocumentPosition(newsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(newsButton).toHaveTextContent('News Articles')
        expect(newsButton).toHaveTextContent('12 items')
        expect(categoryButton).toHaveTextContent('Categories')
        expect(categoryButton).toHaveTextContent('4 items')
        expect(screen.getByText('Supporting types')).toBeInTheDocument()

        fireEvent.click(categoryButton)
        expect(mocks.navigate).toHaveBeenCalledWith('/objects/news_category')
    })

    it('keeps the existing selected-type search behavior', async () => {
        renderBrowser('/objects/news', '/objects/:typeName')

        const searchInput = await screen.findByTestId('objects-search-input')
        await waitFor(() => expect(mocks.getRoots).toHaveBeenCalledWith({ type: 'news' }))

        fireEvent.change(searchInput, { target: { value: 'climate' } })

        await waitFor(() => {
            expect(mocks.search).toHaveBeenCalledWith('climate', { type: 'news', search: 'climate' })
        })
    })
})
