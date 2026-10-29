import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import MediaManagerPage from '../../pages/MediaManagerPage'
import { GlobalNotificationProvider } from '../../contexts/GlobalNotificationContext'
import { namespacesApi } from '../../api'

vi.mock('../../api', () => ({
    namespacesApi: {
        list: vi.fn(),
    },
}))

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 1, permissions: [] } }),
}))

vi.mock('../../hooks/useDocumentTitle', () => ({
    useDocumentTitle: vi.fn(),
}))

vi.mock('../media/MediaManager', () => ({
    default: ({ namespace, selectionMode, initialTab, collectionId, onFileSelect, onFilesLoaded }) => (
        <div data-testid="media-manager">
            Media manager for {namespace}
            <div>Selection mode: {selectionMode}</div>
            <div>Initial tab: {initialTab}</div>
            <div>Collection: {collectionId}</div>
            <button type="button" onClick={() => onFileSelect({ id: '1', title: 'Selected file' })}>
                Select file
            </button>
            <button type="button" onClick={onFilesLoaded}>
                Files loaded
            </button>
        </div>
    ),
}))

const namespaces = [
    { id: 1, name: 'Main Site', slug: 'main', isDefault: true },
    { id: 2, name: 'Archive', slug: 'archive', isDefault: false },
]

const renderPage = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <GlobalNotificationProvider>
                <BrowserRouter>
                    <MediaManagerPage />
                </BrowserRouter>
            </GlobalNotificationProvider>
        </QueryClientProvider>
    )
}

describe('MediaManagerPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        window.history.replaceState({}, '', '/media')
        namespacesApi.list.mockResolvedValue({ results: namespaces })
    })

    it('opens a collection link in its namespace and collections tab', async () => {
        window.history.replaceState({}, '', '/media?tab=collections&collection=42&namespace=archive')
        renderPage()

        const manager = await screen.findByTestId('media-manager')
        expect(manager).toHaveTextContent('Media manager for archive')
        expect(manager).toHaveTextContent('Initial tab: collections')
        expect(manager).toHaveTextContent('Collection: 42')
    })

    it('clears a linked collection when switching namespaces', async () => {
        const user = userEvent.setup()
        window.history.replaceState({}, '', '/media?tab=collections&collection=42&namespace=archive')
        renderPage()

        await screen.findByTestId('media-manager')
        await user.selectOptions(screen.getByRole('combobox', { name: /namespace/i }), 'main')

        expect(screen.getByTestId('media-manager')).toHaveTextContent('Media manager for main')
        expect(screen.getByTestId('media-manager')).toHaveTextContent('Collection:')
        expect(screen.getByTestId('media-manager')).not.toHaveTextContent('Collection: 42')
        expect(window.location.search).toBe('?tab=collections&namespace=main')
    })

    it('shows a loading state while namespaces load', () => {
        namespacesApi.list.mockImplementationOnce(() => new Promise(() => { }))

        renderPage()

        expect(screen.getByText('Loading media manager...')).toBeInTheDocument()
    })

    it('renders the page header after loading', async () => {
        renderPage()

        expect(await screen.findByRole('heading', { name: 'Media Manager' })).toBeInTheDocument()
        expect(screen.getByText('Upload, organize, and manage your media files')).toBeInTheDocument()
    })

    it('loads namespaces and selects the default namespace', async () => {
        renderPage()

        expect(await screen.findByTestId('media-manager')).toHaveTextContent('Media manager for main')
        expect(screen.getByRole('combobox', { name: /namespace/i })).toHaveValue('main')
        expect(namespacesApi.list).toHaveBeenCalled()
    })

    it('renders namespace options', async () => {
        renderPage()

        await screen.findByRole('heading', { name: 'Media Manager' })

        expect(screen.getByRole('option', { name: 'Main Site' })).toHaveValue('main')
        expect(screen.getByRole('option', { name: 'Archive' })).toHaveValue('archive')
    })

    it('switches the active namespace', async () => {
        const user = userEvent.setup()
        renderPage()

        await screen.findByTestId('media-manager')
        await user.selectOptions(screen.getByRole('combobox', { name: /namespace/i }), 'archive')

        expect(screen.getByTestId('media-manager')).toHaveTextContent('Media manager for archive')
    })

    it('passes the current media manager contract to the child manager', async () => {
        renderPage()

        expect(await screen.findByTestId('media-manager')).toHaveTextContent('Selection mode: multiple')
    })

    it('shows an empty namespace state when no namespaces exist', async () => {
        namespacesApi.list.mockResolvedValueOnce({ results: [] })

        renderPage()

        expect(await screen.findByRole('heading', { name: 'Select a Namespace' })).toBeInTheDocument()
        expect(screen.getByText('Please select a namespace to view and manage media files.')).toBeInTheDocument()
    })

    it('handles namespace load errors without crashing', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { })
        namespacesApi.list.mockRejectedValueOnce(new Error('Namespace load failed'))

        renderPage()

        expect(await screen.findByRole('heading', { name: 'Select a Namespace' })).toBeInTheDocument()
        consoleError.mockRestore()
    })
})
