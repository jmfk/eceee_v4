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
    getMediaFile: vi.fn(),
    addFiles: vi.fn(),
    removeFiles: vi.fn(),
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
        removeFiles: mocks.removeFiles,
        create: mocks.create,
        trash: mocks.trash,
        restore: mocks.restore,
        bulkRestore: mocks.bulkRestore,
        bulkDelete: mocks.bulkDelete,
    },
    mediaTagsApi: { list: mocks.listTags },
    mediaApi: { files: { get: mocks.getMediaFile } },
}))

vi.mock('../MediaBrowser', () => ({
    default: ({ onFileSelect, onApprovedFiles }) => <>
        <button onClick={() => onFileSelect({ id: 'image-1', title: 'New image' })}>Choose existing image</button>
        <button onClick={() => onApprovedFiles([{ status: 'approved', media_file_id: 'uploaded-1' }])}>Approve uploaded image</button>
    </>,
}))
vi.mock('../../classification/ClassificationPicker', () => ({
    default: ({ onChange }) => <button type="button" onClick={() => onChange(['tag-1'])}>Choose tag</button>,
}))
vi.mock('../MediaEditForm', () => ({
    default: ({ file, onSave, onCancel }) => <div>
        <span>Editing {file.title}</span>
        <span>Upload new version</span>
        <button onClick={onSave}>Save image</button>
        <button onClick={onCancel}>Cancel edit</button>
    </div>,
}))
vi.mock('../ImageVersionUploadDialog', () => ({
    default: ({ file, onClose, onUploaded }) => <div role="dialog" aria-label={`Upload new version of ${file.title}`}>
        <button onClick={() => { onUploaded(file); onClose() }}>Upload image version</button>
    </div>,
}))
vi.mock('../OptimizedImage', () => ({
    default: ({ src, alt, width, height, resizeType, actualWidth, actualHeight, className }) =>
        <img src={src} alt={alt} data-resize-type={resizeType} data-actual-width={actualWidth}
            data-actual-height={actualHeight} data-width={width} data-height={height} className={className} />,
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
        const addButton = await screen.findByRole('button', { name: 'Add images' })
        expect(screen.queryByRole('dialog', { name: 'Add images' })).not.toBeInTheDocument()
        await user.click(addButton)
        expect(screen.getByRole('dialog', { name: 'Add images' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Choose existing image' }))

        await waitFor(() => expect(mocks.addFiles).toHaveBeenCalledWith('collection-1', ['image-1']))
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add images' })).not.toBeInTheDocument())
    })

    it('uses the full image source with a contained preview in collection cards', async () => {
        mocks.getCollection.mockReturnValue(vi.fn().mockResolvedValue({ id: 'collection-1', title: 'Logos', tags: [] }))
        mocks.getFiles.mockReturnValue(vi.fn().mockResolvedValue({ results: [{
            id: 'image-1', title: 'Wide logo', fileType: 'image', width: 240, height: 80,
            thumbnailUrl: '/cropped-thumbnail', imgproxyBaseUrl: '/full-image',
        }] }))

        render(<MediaCollectionManager namespace="main" collectionId="collection-1" />)

        const preview = await screen.findByRole('img', { name: 'Wide logo' })
        expect(preview).toHaveAttribute('src', '/full-image')
        expect(preview).toHaveAttribute('data-resize-type', 'fit')
        expect(preview).toHaveAttribute('data-actual-width', '240')
        expect(preview).toHaveAttribute('data-actual-height', '80')
        expect(preview).toHaveClass('object-contain')
    })

    it('shows compact image previews in the collection list view', async () => {
        const user = userEvent.setup()
        const image = { id: 'image-1', title: 'Wide logo', fileType: 'image', fileSize: 1024,
            width: 240, height: 80, imgproxyBaseUrl: '/full-image' }
        mocks.getCollection.mockReturnValue(vi.fn().mockResolvedValue({ id: 'collection-1', title: 'Logos', tags: [] }))
        mocks.getFiles.mockReturnValue(vi.fn().mockResolvedValue({ results: [image] }))
        mocks.getMediaFile.mockReturnValue(vi.fn().mockResolvedValue(image))

        render(<MediaCollectionManager namespace="main" collectionId="collection-1" />)
        await screen.findByRole('img', { name: 'Wide logo' })
        await user.click(screen.getByRole('button', { name: 'List' }))

        const preview = screen.getByRole('button', { name: 'Edit Wide logo' })
        expect(preview).toHaveClass('h-20', 'w-24')
        expect(preview.closest('.grid-cols-12')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Wide logo' })).toHaveAttribute('data-width', '192')
        expect(screen.getByRole('img', { name: 'Wide logo' })).toHaveAttribute('data-height', '160')
        expect(screen.getByRole('img', { name: 'Wide logo' })).toHaveClass('object-contain')
        await user.click(preview)
        expect(mocks.getMediaFile).toHaveBeenCalledWith('image-1')
    })

    it('adds an approved upload to the collection and allows the dialog to be dismissed', async () => {
        const user = userEvent.setup()
        mocks.getCollection.mockReturnValue(vi.fn().mockResolvedValue({
            id: 'collection-1', title: 'Summer images', tags: [],
        }))
        mocks.getFiles.mockReturnValue(vi.fn().mockResolvedValue({ results: [] }))
        mocks.addFiles.mockReturnValue(vi.fn().mockResolvedValue({}))

        render(<MediaCollectionManager namespace="main" collectionId="collection-1" />)
        await user.click(await screen.findByRole('button', { name: 'Add images' }))
        await user.click(screen.getByRole('button', { name: 'Close image picker dialog' }))
        expect(screen.queryByRole('dialog', { name: 'Add images' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Add images' }))
        await user.click(screen.getByRole('button', { name: 'Approve uploaded image' }))
        await waitFor(() => expect(mocks.addFiles).toHaveBeenCalledWith('collection-1', ['uploaded-1']))
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add images' })).not.toBeInTheDocument())
    })

    it('edits an image from its collection card', async () => {
        const user = userEvent.setup()
        const image = { id: 'image-1', title: 'First image', fileType: 'image' }
        mocks.getCollection.mockReturnValue(vi.fn().mockResolvedValue({ id: 'collection-1', title: 'Summer images', tags: [] }))
        mocks.getFiles.mockReturnValue(vi.fn().mockResolvedValue({ results: [image] }))
        mocks.getMediaFile.mockReturnValue(vi.fn().mockResolvedValue(image))

        render(<MediaCollectionManager namespace="main" collectionId="collection-1" />)
        await user.click(await screen.findByRole('button', { name: 'Edit First image' }))

        expect(mocks.getMediaFile).toHaveBeenCalledWith('image-1')
        expect(screen.getByRole('dialog', { name: 'Edit First image' })).toBeInTheDocument()
        expect(screen.getByText('Upload new version')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Save image' }))
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit First image' })).not.toBeInTheDocument())
        expect(mocks.getFiles).toHaveBeenCalledTimes(2)
    })

    it('offers a new version from the image context menu without changing collection membership', async () => {
        const user = userEvent.setup()
        const image = { id: 'image-1', title: 'First image', fileType: 'image', imgproxyBaseUrl: '/image' }
        mocks.getCollection.mockReturnValue(vi.fn().mockResolvedValue({ id: 'collection-1', title: 'Summer images', tags: [] }))
        mocks.getFiles.mockReturnValue(vi.fn().mockResolvedValue({ results: [image] }))

        render(<MediaCollectionManager namespace="main" collectionId="collection-1" />)
        await user.pointer({ target: await screen.findByRole('img', { name: 'First image' }), keys: '[MouseRight]' })
        expect(screen.queryByRole('button', { name: 'Replace First image' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('menuitem', { name: 'Upload new version' }))
        expect(screen.getByRole('dialog', { name: 'Upload new version of First image' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Upload image version' }))

        await waitFor(() => expect(mocks.getFiles).toHaveBeenCalledTimes(2))
        expect(mocks.addFiles).not.toHaveBeenCalled()
        expect(mocks.removeFiles).not.toHaveBeenCalled()
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

        await user.click(await screen.findByRole('button', { name: 'Add images' }))
        expect(screen.getByRole('dialog', { name: 'Add images' })).toBeInTheDocument()
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

    it('supports keyboard navigation between collection and Trash tabs', async () => {
        const user = userEvent.setup()
        render(<MediaCollectionManager namespace="default" />)
        const collectionsTab = await screen.findByRole('tab', { name: 'Collections' })
        collectionsTab.focus()
        await user.keyboard('{ArrowRight}')
        expect(screen.getByRole('tab', { name: 'Trash' })).toHaveFocus()
        expect(screen.getByRole('tab', { name: 'Trash' })).toHaveAttribute('aria-selected', 'true')
    })
})
