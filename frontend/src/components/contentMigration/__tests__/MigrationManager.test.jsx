import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MigrationManager from '../MigrationManager'

const apiMocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
}))

vi.mock('../../../api/client', () => ({ api: apiMocks }))
vi.mock('../../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: vi.fn() }),
}))

const plugins = [
    {
        id: 'org.eceee.legacy_import',
        version: '1',
        label: 'ECEEE Legacy Import',
        description: 'Legacy importer',
        kind: 'import',
        active: true,
        compatible: true,
    },
    {
        id: 'org.eceee.proceedings',
        version: '1',
        label: 'ECEEE Proceedings',
        description: 'Proceedings foundation',
        kind: 'feature',
        active: false,
        compatible: true,
    },
]

const importers = [{
    id: 'org.eceee.legacy_import.news',
    pluginId: 'org.eceee.legacy_import',
    label: 'Legacy News',
    description: 'Import news and media',
    connectionKinds: ['LEGACY_API'],
    capabilities: ['includes_media', 'rewrites_links', 'resumable'],
    fields: [
        { name: 'namespace', type: 'namespace', label: 'Target namespace', options: [{ value: 'eceee', label: 'ECEEE' }] },
        { name: 'limit', type: 'integer', label: 'Latest published items', default: 100 },
    ],
}]

describe('MigrationManager plugin workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        apiMocks.get.mockImplementation((url) => {
            if (url.endsWith('/plugins/')) return Promise.resolve({ data: { results: plugins } })
            if (url.endsWith('/importers/')) return Promise.resolve({ data: { results: importers } })
            if (url.includes('/data-connections/')) return Promise.resolve({ data: { results: [] } })
            if (url.endsWith('/plugin-jobs/')) return Promise.resolve({ data: { results: [] } })
            throw new Error(`Unexpected URL: ${url}`)
        })
    })

    it('only shows import plugins and explains the missing connection', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={client}>
                <MigrationManager />
            </QueryClientProvider>,
        )

        expect(await screen.findByText('ECEEE Legacy Import')).toBeInTheDocument()
        expect(screen.queryByText('ECEEE Proceedings')).not.toBeInTheDocument()
        expect(await screen.findByRole('option', { name: 'Legacy News' })).toBeInTheDocument()
        expect(await screen.findByText(/A compatible connection is required/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Create connection' })).toHaveAttribute(
            'href',
            '/settings/data-connections/new?type=LEGACY_API&plugin=org.eceee.legacy_import',
        )
        expect(screen.getByRole('button', { name: 'Start import' })).toBeDisabled()
    })

    it('shows every active import script and automatically verifies its legacy connection', async () => {
        apiMocks.get.mockImplementation((url) => {
            if (url.endsWith('/plugins/')) return Promise.resolve({ data: { results: plugins } })
            if (url.endsWith('/importers/')) return Promise.resolve({ data: { results: importers } })
            if (url.includes('/data-connections/')) return Promise.resolve({ data: { results: [{
                id: 'legacy-connection',
                name: 'ECEEE Legacy Migration API',
                connectionType: 'LEGACY_API',
                isActive: true,
            }] } })
            if (url.endsWith('/plugin-jobs/')) return Promise.resolve({ data: { results: [] } })
            throw new Error(`Unexpected URL: ${url}`)
        })
        apiMocks.post.mockResolvedValue({ data: { status: 'ready', summary: { published: 100 } } })
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={client}>
                <MigrationManager />
            </QueryClientProvider>,
        )

        expect(await screen.findByRole('heading', { name: 'Import scripts' })).toBeInTheDocument()
        expect(await screen.findByRole('button', { name: /Legacy News/ })).toHaveAttribute('aria-pressed', 'true')
        expect(await screen.findAllByText('Legacy server connected')).not.toHaveLength(0)
        expect(screen.getByRole('combobox', { name: 'Source connection' })).toHaveValue('legacy-connection')
        expect(apiMocks.post).toHaveBeenCalledWith('/api/v1/data-connections/connections/legacy-connection/test/')
    })

    it('preserves entered options when the importer catalog refreshes', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><MigrationManager /></QueryClientProvider>)

        const limit = await screen.findByRole('spinbutton', { name: 'Latest published items' })
        fireEvent.change(limit, { target: { value: '37' } })
        await act(async () => {
            client.setQueryData(['tenant-importers'], {
                results: importers.map((importer) => ({ ...importer, description: 'Updated description' })),
            })
        })

        expect(limit).toHaveValue(37)
    })

    it('does not accept a late preflight response for options that have changed', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        client.setQueryData(['data-connections'], [{
            id: 'legacy-connection', name: 'Legacy API', connectionType: 'LEGACY_API', isActive: true,
        }])
        let finishPreflight
        apiMocks.post.mockImplementation((url) => url.endsWith('/preflight/')
            ? new Promise((resolve) => { finishPreflight = resolve })
            : Promise.resolve({ data: { status: 'ready' } }))
        render(<QueryClientProvider client={client}><MigrationManager /></QueryClientProvider>)
        const limit = await screen.findByRole('spinbutton', { name: 'Latest published items' })
        // Keep the test source stable rather than replacing it with the default empty API response.
        await act(async () => {
            client.setQueryData(['data-connections'], [{
                id: 'legacy-connection', name: 'Legacy API', connectionType: 'LEGACY_API', isActive: true,
            }])
        })
        fireEvent.click(screen.getByRole('button', { name: 'Run preflight' }))
        await waitFor(() => expect(finishPreflight).toBeTypeOf('function'))
        fireEvent.change(limit, { target: { value: '37' } })
        await act(async () => { finishPreflight({ data: { status: 'ready' } }) })
        expect(screen.getByRole('button', { name: 'Start import' })).toBeDisabled()
        expect(screen.queryByText('Ready to import')).not.toBeInTheDocument()

        finishPreflight = null
        fireEvent.click(screen.getByRole('button', { name: 'Run preflight' }))
        await waitFor(() => expect(finishPreflight).toBeTypeOf('function'))
        await act(async () => { finishPreflight({ data: { status: 'ready' } }) })
        await screen.findByText('Ready to import')
        expect(screen.getByRole('button', { name: 'Start import' })).toBeEnabled()
    })

    it('checks again after a saved connection changes and replaces stale green status', async () => {
        const connection = {
            id: 'legacy-connection', name: 'Legacy API', connectionType: 'LEGACY_API',
            isActive: true, updatedAt: '2026-10-20T08:00:00Z',
        }
        apiMocks.get.mockImplementation((url) => {
            if (url.endsWith('/plugins/')) return Promise.resolve({ data: { results: plugins } })
            if (url.endsWith('/importers/')) return Promise.resolve({ data: { results: importers } })
            if (url.includes('/data-connections/')) return Promise.resolve({ data: { results: [connection] } })
            if (url.endsWith('/plugin-jobs/')) return Promise.resolve({ data: { results: [] } })
            throw new Error(`Unexpected URL: ${url}`)
        })
        apiMocks.post.mockResolvedValueOnce({ data: { status: 'ready' } })
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><MigrationManager /></QueryClientProvider>)
        await screen.findAllByText('Legacy server connected')

        let finishCheck
        apiMocks.post.mockImplementationOnce(() => new Promise((resolve) => { finishCheck = resolve }))
        await act(async () => {
            client.setQueryData(['data-connections'], [{ ...connection, updatedAt: '2026-10-20T09:00:00Z' }])
        })
        await screen.findAllByText('Checking legacy server…')
        expect(screen.queryByText('Legacy server connected')).not.toBeInTheDocument()
        await act(async () => { finishCheck({ data: { status: 'unavailable' } }) })
        await screen.findAllByText('Legacy server unavailable')

        apiMocks.post.mockImplementationOnce(() => new Promise((resolve) => { finishCheck = resolve }))
        fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
        await screen.findAllByText('Checking legacy server…')
        expect(screen.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument()
        await act(async () => { finishCheck({ data: { status: 'ready' } }) })
        await screen.findAllByText('Legacy server connected')
        await waitFor(() => expect(apiMocks.post).toHaveBeenCalledTimes(3))
    })
})
