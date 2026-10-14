import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
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

    it('keeps legacy import and proceedings separate and explains the missing connection', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={client}>
                <MigrationManager />
            </QueryClientProvider>,
        )

        expect(await screen.findByText('ECEEE Legacy Import')).toBeInTheDocument()
        expect(screen.getByText('ECEEE Proceedings')).toBeInTheDocument()
        expect(await screen.findByRole('option', { name: 'Legacy News' })).toBeInTheDocument()
        expect(await screen.findByText(/A compatible connection is required/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Create connection' })).toHaveAttribute(
            'href',
            '/settings/data-connections/new?type=LEGACY_API&plugin=org.eceee.legacy_import',
        )
        expect(screen.getByRole('button', { name: 'Start import' })).toBeDisabled()
    })
})
