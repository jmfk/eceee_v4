import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    listCollections: vi.fn(),
    listTags: vi.fn(),
    fetchTags: vi.fn(),
    addNotification: vi.fn(),
    getCollection: vi.fn(),
    getFiles: vi.fn(),
    addFiles: vi.fn(),
    create: vi.fn(),
    trash: vi.fn(),
    restore: vi.fn(),
    bulkRestore: vi.fn(),
    bulkDelete: vi.fn(),
}))

vi.mock('../../../api', () => ({
    mediaCollectionsApi: {
        list: mocks.listCollections,
        get: mocks.getCollection,
        getFiles: mocks.getFiles,
        addFiles: mocks.addFiles,
        create: mocks.create,
        trash: mocks.trash,
        restore: mocks.restore,
        bulkRestore: mocks.bulkRestore,
        bulkDelete: mocks.bulkDelete,
    },
    mediaTagsApi: { list: mocks.listTags },
    mediaApi: {},
}))

vi.mock('../MediaBrowser', () => ({
    default: ({ onFileSelect }) => <button onClick={() => onFileSelect({ id: 'image-1', title: 'New image' })}>Add new image</button>,
}))
vi.mock('../../classification/ClassificationPicker', () => ({
    default: ({ onChange }) => <button type="button" onClick={() => onChange(['tag-1'])}>Choose tag</button>,
}))

vi.mock('../../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: mocks.addNotification }),
}))

import MediaCollectionManager from '../MediaCollectionManager'

describe('MediaCollectionManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listCollections.mockImplementation(params => vi.fn().mockResolvedValue(params.page === 1 ? { results: [{
            id: 'collection-1', title: 'summerstudy 2025 logos', fileCount: 12,
            accessLevel: 'public', sampleImages: [], tags: [],
        }], next: '?page=2' } : { results: [{
            id: 'collection-2', title: 'other collection', fileCount: 1,
            accessLevel: 'public', sampleImages: [], tags: [],
        }], next: null }))
        mocks.fetchTags.mockResolvedValue({ results: [] })
        mocks.listTags.mockReturnValue(mocks.fetchTags)
        mocks.trash.mockReturnValue(vi.fn().mockResolvedValue({ results: [], next: null }))
        mocks.restore.mockReturnValue(vi.fn().mockResolvedValue({}))
        mocks.bulkRestore.mockReturnValue(vi.fn().mockResolvedValue({ restored_count: 1 }))
        mocks.bulkDelete.mockReturnValue(vi.fn().mockResolvedValue({ deleted_count: 2, deleted_file_count: 0 }))
    })

    it('loads and displays collections from the selected namespace', async () => {
        render(<MediaCollectionManager namespace="default" />)

        expect(await screen.findByRole('heading', { name: 'summerstudy 2025 logos' })).toBeInTheDocument()
        expect(await screen.findByRole('heading', { name: 'other collection' })).toBeInTheDocument()
        expect(screen.queryByText('No collections found')).not.toBeInTheDocument()
        await waitFor(() => expect(mocks.listCollections).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'default', ordering: '-updated_at', page: 2,
        })))
        expect(mocks.fetchTags).toHaveBeenCalled()
    })

    it('adds an image from the collection editor', async () => {
        const user = userEvent.setup()
        mocks.getCollection.mockReturnValue(vi.fn().mockResolvedValue({
            id: 'collection-1', title: 'Summer images', tags: [],
        }))
        mocks.getFiles.mockReturnValue(vi.fn().mockResolvedValue({ results: [] }))
        mocks.addFiles.mockReturnValue(vi.fn().mockResolvedValue({}))

        render(<MediaCollectionManager namespace="main" collectionId="collection-1" />)
        await user.click(await screen.findByRole('button', { name: 'Add new image' }))

        await waitFor(() => expect(mocks.addFiles).toHaveBeenCalledWith('collection-1', ['image-1']))
    })

    it('hides empty collections by default and lets editors reveal them', async () => {
        const user = userEvent.setup()
        mocks.listCollections.mockImplementation(() => vi.fn().mockResolvedValue({
            results: [
                { id: 'filled', title: 'Filled collection', fileCount: 2, tags: [] },
                { id: 'empty', title: 'Empty collection', fileCount: 0, tags: [] },
            ],
            next: null,
        }))

        render(<MediaCollectionManager namespace="main" />)

        expect(await screen.findByRole('heading', { name: 'Filled collection' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Empty collection' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('checkbox', { name: 'Show empty collections (1)' }))
        expect(screen.getByRole('heading', { name: 'Empty collection' })).toBeInTheDocument()
    })

    it('opens a newly created empty collection for adding images', async () => {
        const user = userEvent.setup()
        mocks.getFiles.mockReturnValue(vi.fn().mockResolvedValue({ results: [] }))
        mocks.create.mockReturnValue(vi.fn().mockResolvedValue({
            id: 'new-collection', title: 'New collection', fileCount: 0, tags: [],
        }))

        render(<MediaCollectionManager namespace="main" />)
        await user.click(await screen.findByRole('button', { name: 'New Collection' }))
        await user.type(screen.getByPlaceholderText('Enter collection title...'), 'New collection')
        await user.click(screen.getByRole('button', { name: 'Choose tag' }))
        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(await screen.findByRole('heading', { name: 'Add images' })).toBeInTheDocument()
        expect(mocks.create).toHaveBeenCalled()
    })

    it('selects collections and moves them to Trash without deleting files by default', async () => {
        const user = userEvent.setup()
        render(<MediaCollectionManager namespace="default" />)
        await screen.findByRole('heading', { name: 'other collection' })

        await user.click(screen.getByRole('button', { name: 'Select all visible' }))
        expect(screen.getByText('2 selected')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Delete selected' }))
        expect(screen.getByText('You can restore these items from Trash.')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Move to Trash' }))

        await waitFor(() => expect(mocks.bulkDelete).toHaveBeenCalledWith(
            ['collection-1', 'collection-2'], false, 'default',
        ))
    })

    it('offers file deletion and restores a collection from Trash', async () => {
        const user = userEvent.setup()
        mocks.trash.mockReturnValue(vi.fn().mockResolvedValue({ results: [{
            id: 'deleted-1', title: 'Deleted collection', fileCount: 0, tags: [],
        }], next: null }))
        render(<MediaCollectionManager namespace="default" />)
        await screen.findByRole('heading', { name: 'summerstudy 2025 logos' })
        await user.click(screen.getAllByRole('button', { name: 'Delete Collection' })[0])
        await user.click(screen.getByRole('checkbox', { name: /Also move their media files to Trash/ }))
        await user.click(screen.getByRole('button', { name: 'Move to Trash' }))
        await waitFor(() => expect(mocks.bulkDelete).toHaveBeenCalledWith(['collection-1'], true, 'default'))

        await user.click(screen.getByRole('tab', { name: 'Trash' }))
        await screen.findByRole('heading', { name: 'Deleted collection' })
        await user.click(screen.getByRole('button', { name: 'Restore Deleted collection' }))
        await waitFor(() => expect(mocks.bulkRestore).toHaveBeenCalledWith(['deleted-1']))
    })
})
