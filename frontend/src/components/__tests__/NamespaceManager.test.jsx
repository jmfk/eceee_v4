import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NamespaceManager from '../NamespaceManager'
import { namespacesApi } from '../../api/namespaces'
import { renderWithProviders } from '../../test/testUtils'

vi.mock('../../api/namespaces', () => ({
    namespacesApi: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        setAsDefault: vi.fn(),
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
        namespacesApi.create.mockResolvedValue({
            id: 2,
            name: 'Imported media',
            slug: 'imported-media',
            isActive: true,
            isDefault: false,
        })
    })

    it('creates an active non-default namespace from Settings', async () => {
        const user = userEvent.setup()
        renderWithProviders(<NamespaceManager />)

        expect(await screen.findByText('Default namespace for content')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Create Namespace' }))

        const dialog = screen.getByRole('dialog', { name: 'Create Namespace' })
        expect(dialog).toBeInTheDocument()
        expect(screen.queryByRole('checkbox', { name: 'Default' })).not.toBeInTheDocument()

        await user.type(screen.getByLabelText('Name *'), 'Imported media')
        expect(screen.getByLabelText('Slug *')).toHaveValue('imported-media')
        await user.type(screen.getByLabelText('Description'), 'Media kept separate for this import')
        await user.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            expect(namespacesApi.create).toHaveBeenCalledWith({
                name: 'Imported media',
                slug: 'imported-media',
                description: 'Media kept separate for this import',
                isActive: true,
            })
        })
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('uses backend query parameter names for namespace status filters', async () => {
        const user = userEvent.setup()
        renderWithProviders(<NamespaceManager />)

        await screen.findByText('Default namespace for content')
        await user.click(screen.getByRole('button', { name: 'Filters' }))
        await user.selectOptions(screen.getByLabelText('Status'), 'default')

        await waitFor(() => {
            expect(namespacesApi.list).toHaveBeenLastCalledWith({ is_default: true })
        })
    })
})
