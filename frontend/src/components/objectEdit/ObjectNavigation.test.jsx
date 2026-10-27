import React from 'react'
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ObjectNavigation from './ObjectNavigation'
import ObjectEditorPanel from './ObjectEditorPanel'

const api = vi.hoisted(() => ({ getPathToRoot: vi.fn(), getTree: vi.fn(), getRelatedObjects: vi.fn(), getRelatedFromObjects: vi.fn() }))
vi.mock('../../api/objectStorage', () => ({ objectInstancesApi: api, objectRelationshipsApi: api }))
const root = { id: 1, title: 'Root', parent: null }
const child = { id: 2, title: 'Child', parent: 1 }
const grandchild = { id: 3, title: 'Grandchild', parent: 2 }
const related = { id: 4, title: 'Source' }
const renderNavigation = (props = {}, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => render(
    <QueryClientProvider client={client}>
        <ObjectNavigation instanceId="3" anchorId="3" onSelect={vi.fn()} {...props} />
    </QueryClientProvider>
)

describe('Object navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        api.getPathToRoot.mockResolvedValue({ data: [grandchild, child, root] })
        api.getTree.mockResolvedValue({ data: [grandchild, root, child] })
        api.getRelatedObjects.mockResolvedValue({ data: { relatedObjects: [{ object: related }, { object: child }, { object: null }] } })
        api.getRelatedFromObjects.mockResolvedValue({ data: { relatedFromObjects: [{ object: related }] } })
    })

    it('starts at the root for direct child URLs, nests descendants and deduplicates relations', async () => {
        const onSelect = vi.fn()
        renderNavigation({ onSelect })
        const tree = await screen.findByRole('list', { name: 'Object tree' })
        expect(api.getTree).toHaveBeenCalledWith(1)
        expect(within(tree).getAllByRole('button').map(button => button.textContent)).toEqual(['Root', 'Child', 'Grandchild'])
        expect(screen.getByRole('button', { name: 'Grandchild' })).toHaveAttribute('aria-current', 'page')
        expect(await screen.findAllByRole('button', { name: 'Source' })).toHaveLength(1)
        fireEvent.click(screen.getByRole('button', { name: 'Source' }))
        expect(onSelect).toHaveBeenCalledWith(4, 1)
    })

    it('keeps the original root context when opening a related object', async () => {
        renderNavigation({ instanceId: '4', anchorId: '1' })
        await screen.findByRole('list', { name: 'Object tree' })
        expect(api.getPathToRoot).toHaveBeenCalledWith('1')
        expect(api.getRelatedObjects).toHaveBeenCalledWith(1)
    })

    it('groups related objects by type in independent accordions', async () => {
        api.getRelatedObjects.mockResolvedValue({ data: { relatedObjects: [
            { object: { id: 4, title: 'Writer A', objectTypeLabel: 'Writers' } },
            { object: { id: 5, title: 'Writer B', objectTypeLabel: 'Writers' } },
            { object: { id: 6, title: 'Event A', objectTypeLabel: 'Events' } },
        ] } })
        api.getRelatedFromObjects.mockResolvedValue({ data: { relatedFromObjects: [] } })
        renderNavigation()
        expect(await screen.findByRole('button', { name: /Writer A/ })).toBeInTheDocument()
        const writers = screen.getByRole('button', { name: 'Writers' })
        expect(writers).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(writers)
        expect(screen.queryByRole('button', { name: /Writer A/ })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Event A/ })).toBeInTheDocument()
    })

    it('refreshes a mounted tree and relations after object mutation invalidation', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        renderNavigation({}, client)
        await screen.findByRole('button', { name: 'Grandchild' })
        await screen.findByRole('button', { name: 'Source' })
        api.getTree.mockResolvedValue({ data: [root, child, { ...grandchild, title: 'Renamed' }, { id: 5, title: 'New child', parent: 1 }] })
        api.getRelatedObjects.mockResolvedValue({ data: { relatedObjects: [{ object: { ...related, title: 'Updated source' } }] } })
        api.getRelatedFromObjects.mockResolvedValue({ data: { relatedFromObjects: [] } })
        await act(() => client.invalidateQueries({ queryKey: ['objectInstances'] }))
        expect(await screen.findByRole('button', { name: 'New child' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Renamed' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Updated source' })).toBeInTheDocument()
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Grandchild' })).not.toBeInTheDocument())
    })

    it('reports a failed tree without hiding related objects', async () => {
        api.getTree.mockRejectedValue(new Error('offline'))
        renderNavigation()
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the object tree')
        expect(await screen.findByRole('button', { name: 'Source' })).toBeInTheDocument()
    })
})

describe('Object editor panels', () => {
    it.each(['left', 'right'])('resizes the %s panel with keys and preserves form state when collapsed', side => {
        render(<ObjectEditorPanel side={side} title="Test panel"><input aria-label="Draft" defaultValue="" /></ObjectEditorPanel>)
        const handle = screen.getByRole('separator')
        fireEvent.keyDown(handle, { key: side === 'left' ? 'ArrowRight' : 'ArrowLeft' })
        expect(handle).toHaveAttribute('aria-valuenow', '280')
        fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Unsaved' } })
        fireEvent.click(screen.getByRole('button', { name: 'Collapse Test panel' }))
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Expand Test panel' }))
        expect(screen.getByLabelText('Draft')).toHaveValue('Unsaved')
        expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '280')
    })
})
