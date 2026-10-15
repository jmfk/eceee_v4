import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import NamespaceManager from '../NamespaceManager'
import { namespacesApi } from '../../api/namespaces'
import { renderWithProviders } from '../../test/testUtils'

vi.mock('../../api/namespaces', () => ({
    namespacesApi: {
        list: vi.fn(),
        getContentSummary: vi.fn(),
    },
}))

describe('NamespaceManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        namespacesApi.list.mockResolvedValue({
            results: [
                {
                    id: 1,
                    name: 'Default',
                    slug: 'default',
                    description: 'Default namespace for content',
                    isActive: true,
                    isDefault: true,
                    contentCount: 4,
                    createdAt: '2026-01-01T00:00:00Z',
                },
            ],
        })
    })

    it('presents namespaces as a read-only settings overview', async () => {
        renderWithProviders(<NamespaceManager />)

        expect(await screen.findByText('Default namespace for content')).toBeInTheDocument()
        expect(screen.getByText(/default namespace is used unless a feature creates/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /create namespace/i })).not.toBeInTheDocument()
        expect(screen.queryByTitle('Set as default')).not.toBeInTheDocument()
        expect(screen.queryByTitle('Edit namespace')).not.toBeInTheDocument()
        expect(screen.queryByTitle('Delete namespace')).not.toBeInTheDocument()
        expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument()
    })

    it('does not invite namespace creation when none is configured', async () => {
        namespacesApi.list.mockResolvedValueOnce({ results: [] })

        renderWithProviders(<NamespaceManager />)

        expect(await screen.findByText('No namespace is configured for this workspace.')).toBeInTheDocument()
        expect(screen.queryByText(/create your first namespace/i)).not.toBeInTheDocument()
    })
})
