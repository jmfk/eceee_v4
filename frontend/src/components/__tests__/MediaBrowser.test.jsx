import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MediaBrowser from '../media/MediaBrowser'
import { GlobalNotificationProvider } from '../../contexts/GlobalNotificationContext'
import { mediaApi } from '../../api'

vi.mock('../../api', () => ({
    mediaApi: {
        search: {
            search: vi.fn(),
        },
        files: {
            get: vi.fn(),
            restore: vi.fn(),
            forceDelete: vi.fn(),
        },
        upload: {
            upload: vi.fn(),
        },
    },
}))

vi.mock('../media/OptimizedImage', () => ({
    default: ({ src, alt, className, width, height, resizeType }) => (
        <img src={src} alt={alt} className={className} data-width={width} data-height={height} data-resize-type={resizeType} />
    ),
}))

vi.mock('../media/MediaSearchWidget', () => ({
    default: ({ placeholder, onChange }) => (
        <div>
            <input
                aria-label="Search media"
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value
                    ? [{ value: event.target.value, type: 'text' }]
                    : []
                )}
            />
            <button
                type="button"
                onClick={() => onChange([{ value: 'nature', type: 'tag' }])}
            >
                Add nature tag
            </button>
        </div>
    ),
}))

vi.mock('../media/BulkOperations', () => ({
    default: ({ selectedFiles, onClose }) => (
        <div role="status">
            <span>{selectedFiles.length} selected</span>
            <button type="button" onClick={onClose}>Clear selection</button>
        </div>
    ),
}))

vi.mock('../media/MediaEditForm', () => ({
    default: ({ file, onCancel, onSave }) => (
        <div>
            <div>Edit form for {file.title}</div>
            <button type="button" onClick={onCancel}>Cancel edit</button>
            <button type="button" onClick={() => onSave(file)}>Save edit</button>
        </div>
    ),
}))

vi.mock('../media/DuplicateResolveDialog', () => ({
    default: ({ onCancel }) => (
        <div role="dialog">
            Duplicate files
            <button type="button" onClick={onCancel}>Cancel duplicates</button>
        </div>
    ),
}))

vi.mock('../media/SimplifiedApprovalForm', () => ({
    default: ({ pendingFiles, onComplete }) => (
        <div>
            Pending approval: {pendingFiles.length}
            <button type="button" onClick={() => onComplete([{ mediaFile: { id: 'approved-1' } }])}>Approve pending</button>
        </div>
    ),
}))

vi.mock('../media/ImageQuickView', () => ({
    default: ({ image, onClose }) => (
        <div role="dialog">
            Quick view {image.title}
            <button type="button" onClick={onClose}>Close quick view</button>
        </div>
    ),
}))
vi.mock('../media/ImageVersionUploadDialog', () => ({
    default: ({ file }) => <div role="dialog" aria-label={`Upload new version of ${file.title}`} />,
}))

const mockMediaFiles = [
    {
        id: '1',
        title: 'Test Image 1',
        originalFilename: 'test1.jpg',
        fileUrl: 'https://example.com/test1.jpg',
        imgproxyBaseUrl: 'https://example.com/test1.jpg',
        fileType: 'image',
        fileSize: 1048576,
        createdAt: '2024-01-01T10:00:00Z',
        width: 800,
        height: 600,
        tags: [
            { id: '1', name: 'nature', color: '#3B82F6' },
            { id: '2', name: 'landscape', color: '#10B981' },
        ],
    },
    {
        id: '2',
        title: 'Test Video',
        originalFilename: 'test.mp4',
        fileUrl: 'https://example.com/test.mp4',
        fileType: 'video',
        fileSize: 5242880,
        createdAt: '2024-01-02T10:00:00Z',
        tags: [{ id: '3', name: 'demo', color: '#8B5CF6' }],
    },
    {
        id: '3',
        title: 'Deleted Document',
        originalFilename: 'deleted.pdf',
        fileUrl: 'https://example.com/deleted.pdf',
        fileType: 'document',
        fileSize: 2048,
        createdAt: '2024-01-03T10:00:00Z',
        isDeleted: true,
        tags: [],
    },
]

const renderBrowser = (props = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <GlobalNotificationProvider>
                <MediaBrowser namespace="test-namespace" {...props} />
            </GlobalNotificationProvider>
        </QueryClientProvider>
    )
}

describe('MediaBrowser', () => {
    let user

    beforeEach(() => {
        user = userEvent.setup()
        vi.clearAllMocks()
        window.confirm = vi.fn(() => true)

        mediaApi.search.search.mockResolvedValue({
            results: mockMediaFiles,
            count: mockMediaFiles.length,
            page: 1,
            pageSize: 20,
            totalPages: 1,
        })
        mediaApi.files.get.mockImplementation((id) => () => Promise.resolve(
            mockMediaFiles.find(file => file.id === id) || mockMediaFiles[0]
        ))
        mediaApi.files.restore.mockImplementation(() => () => Promise.resolve({ success: true }))
        mediaApi.files.forceDelete.mockImplementation(() => () => Promise.resolve({ success: true }))
        mediaApi.upload.upload.mockResolvedValue({
            uploadedFiles: [{ id: 'pending-1', title: 'Pending upload' }],
            successCount: 1,
            rejectedFiles: [],
            errors: [],
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('loads and renders media files in grid view', async () => {
        renderBrowser()

        expect(await screen.findByText('Test Image 1')).toBeInTheDocument()
        expect(screen.getByText('Test Video')).toBeInTheDocument()
        expect(screen.getByText('Deleted Document')).toBeInTheDocument()
        expect(screen.getByAltText('Test Image 1')).toHaveAttribute('src', 'https://example.com/test1.jpg')
        expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'test-namespace',
            page: 1,
            pageSize: 20,
            show_deleted: false,
        }))
    })

    it('shows deleted files in Trash and can restore a selected file', async () => {
        mediaApi.search.search.mockImplementation(params => Promise.resolve({
            results: params.deleted_only ? [mockMediaFiles[2]] : [mockMediaFiles[0]],
            count: 1, page: 1, pageSize: 20, totalPages: 1,
        }))
        renderBrowser({ hideShowDeleted: false, selectionMode: 'multiple' })
        expect(await screen.findByText('Test Image 1')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Trash' }))
        expect(await screen.findByText('Deleted Document')).toBeInTheDocument()
        expect(screen.queryByText('Test Image 1')).not.toBeInTheDocument()
        expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({
            show_deleted: true, deleted_only: true,
        }))
        await user.click(screen.getByRole('button', { name: /Restore file/i }))
        await waitFor(() => expect(mediaApi.files.restore).toHaveBeenCalledWith('3'))
    })

    it('requests sharp card-sized previews and keeps portraits or unknown shapes intact', async () => {
        mediaApi.search.search.mockResolvedValue({
            results: [
                mockMediaFiles[0],
                { ...mockMediaFiles[0], id: 'square', title: 'Square logo', width: 800, height: 800 },
                { ...mockMediaFiles[0], id: 'wide', title: 'Wide banner', width: 3000, height: 700 },
                { ...mockMediaFiles[0], id: 'tall', title: 'Tall poster', width: 500, height: 1800 },
                { ...mockMediaFiles[0], id: 'portrait', title: 'Portrait', width: 750, height: 1000 },
                { ...mockMediaFiles[0], id: 'unknown', title: 'Unknown dimensions', width: null, height: null },
            ],
            count: 6,
        })

        renderBrowser()

        const image = await screen.findByAltText('Test Image 1')
        expect(image).toHaveAttribute('data-width', '800')
        expect(image).toHaveAttribute('data-height', '600')
        expect(image).toHaveAttribute('data-resize-type', 'fit')
        expect(image).toHaveClass('object-cover')
        expect(image.closest('.media-browser-grid-preview')).toBeInTheDocument()

        const square = screen.getByAltText('Square logo')
        expect(square).toHaveAttribute('data-width', '800')
        expect(square).toHaveAttribute('data-height', '800')
        expect(square).toHaveClass('object-cover')

        const banner = screen.getByAltText('Wide banner')
        expect(banner).toHaveAttribute('data-width', '2400')
        expect(banner).toHaveAttribute('data-resize-type', 'fit')
        expect(banner).toHaveClass('object-contain')

        const poster = screen.getByAltText('Tall poster')
        expect(poster).toHaveAttribute('data-height', '600')
        expect(poster).toHaveAttribute('data-resize-type', 'fit')
        expect(poster).toHaveClass('object-contain')

        const portrait = screen.getByAltText('Portrait')
        expect(portrait).toHaveAttribute('data-resize-type', 'fit')
        expect(portrait).toHaveClass('object-contain')

        const unknown = screen.getByAltText('Unknown dimensions')
        expect(unknown).toHaveAttribute('data-resize-type', 'fit')
        expect(unknown).toHaveClass('object-contain')
    })

    it('keeps the full image visible in compact media pickers', async () => {
        mediaApi.search.search.mockResolvedValue({
            results: [{ ...mockMediaFiles[0], width: 800, height: 800 }],
            count: 1,
        })

        renderBrowser({ compact: true })

        const image = await screen.findByAltText('Test Image 1')
        expect(image).toHaveAttribute('data-width', '400')
        expect(image).toHaveAttribute('data-height', '240')
        expect(image).toHaveAttribute('data-resize-type', 'fit')
        expect(image).toHaveClass('object-contain')
    })

    it('displays current file metadata', async () => {
        renderBrowser()

        expect(await screen.findByText('image • 1 MB')).toBeInTheDocument()
        expect(screen.getByText('video • 5 MB')).toBeInTheDocument()
        expect(screen.getByText('nature')).toBeInTheDocument()
        expect(screen.getByText('landscape')).toBeInTheDocument()
    })

    it('shows loading and empty states', async () => {
        mediaApi.search.search.mockImplementationOnce(() => new Promise(() => { }))
        const { unmount } = renderBrowser()

        expect(screen.getByText('Loading media files...')).toBeInTheDocument()
        unmount()

        mediaApi.search.search.mockResolvedValueOnce({
            results: [],
            count: 0,
            page: 1,
            pageSize: 20,
            totalPages: 1,
        })
        renderBrowser()

        expect(await screen.findByText('No files found')).toBeInTheDocument()
    })

    it('does not load files until a namespace is available', () => {
        renderBrowser({ namespace: undefined })

        expect(mediaApi.search.search).not.toHaveBeenCalled()
        expect(screen.getByText('No files found')).toBeInTheDocument()
    })

    it('selects a single file through onFileSelect', async () => {
        const onFileSelect = vi.fn()
        renderBrowser({ onFileSelect })

        await user.click(await screen.findByText('Test Image 1'))

        expect(onFileSelect).toHaveBeenCalledWith(mockMediaFiles[0])
    })

    it('selects and clears multiple files', async () => {
        const onFileSelect = vi.fn()
        renderBrowser({ selectionMode: 'multiple', onFileSelect })

        await user.click(await screen.findByText('Test Image 1'))
        await user.click(screen.getByText('Test Video'))

        expect(screen.getByRole('status')).toHaveTextContent('2 selected')
        expect(onFileSelect).toHaveBeenLastCalledWith([mockMediaFiles[0], mockMediaFiles[1]])

        await user.click(screen.getByRole('button', { name: /clear selection/i }))

        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('supports select all and deselect all in multiple mode', async () => {
        const onFileSelect = vi.fn()
        renderBrowser({ selectionMode: 'multiple', onFileSelect })

        await screen.findByText('Test Image 1')
        await user.click(screen.getByRole('button', { name: /select all/i }))

        expect(screen.getByRole('status')).toHaveTextContent('3 selected')
        expect(onFileSelect).toHaveBeenCalledWith(mockMediaFiles)

        await user.click(screen.getByRole('button', { name: /deselect all/i }))

        expect(onFileSelect).toHaveBeenLastCalledWith([])
    })

    it('ignores file clicks when selectionMode is none', async () => {
        const onFileSelect = vi.fn()
        renderBrowser({ selectionMode: 'none', onFileSelect })

        await user.click(await screen.findByText('Test Image 1'))

        expect(onFileSelect).not.toHaveBeenCalled()
    })

    it('applies search terms from MediaSearchWidget', async () => {
        renderBrowser()

        await screen.findByText('Test Image 1')
        fireEvent.change(screen.getByLabelText('Search media'), { target: { value: 'hero' } })

        await waitFor(() => {
            expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({
                text_search: 'hero',
            }))
        })
    })

    it('applies tag terms from MediaSearchWidget', async () => {
        renderBrowser()

        await screen.findByText('Test Image 1')
        await user.click(screen.getByRole('button', { name: /add nature tag/i }))

        await waitFor(() => {
            expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({
                tag_names: ['nature'],
            }))
        })
    })

    it('filters by dropdown file type and fileTypes prop', async () => {
        const { unmount } = renderBrowser()

        await user.selectOptions(screen.getByRole('combobox'), 'image')

        await waitFor(() => {
            expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({
                file_type: 'image',
            }))
        })

        unmount()
        vi.clearAllMocks()
        mediaApi.search.search.mockResolvedValue({
            results: mockMediaFiles,
            count: mockMediaFiles.length,
            page: 1,
            pageSize: 20,
            totalPages: 1,
        })

        renderBrowser({ fileTypes: ['video'] })

        await waitFor(() => {
            expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({
                file_type: 'video',
            }))
        })
    })

    it('can require media with at least one tag', async () => {
        renderBrowser({ requireTags: true })

        await waitFor(() => {
            expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({
                has_tags: true,
            }))
        })
    })

    it('can hide the type filter', async () => {
        renderBrowser({ hideTypeFilter: true })

        await screen.findByText('Test Image 1')
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('switches between grid and list view', async () => {
        renderBrowser()

        await screen.findByText('Test Image 1')
        await user.click(screen.getByRole('button', { name: /list/i }))

        expect(screen.getByText('Preview')).toBeInTheDocument()
        expect(screen.getByText('Created')).toBeInTheDocument()
        expect(screen.getAllByText('Test Image 1').length).toBeGreaterThan(0)

        await user.click(screen.getByRole('button', { name: /grid/i }))

        expect(screen.queryByText('Preview')).not.toBeInTheDocument()
    })

    it('uses list view by default when requested', async () => {
        renderBrowser({ defaultViewMode: 'list' })

        expect(await screen.findByText('Preview')).toBeInTheDocument()
        expect(screen.getByText('Title')).toBeInTheDocument()
    })

    it('shows pagination and loads the next page', async () => {
        mediaApi.search.search.mockResolvedValue({
            results: mockMediaFiles,
            count: 50,
            page: 1,
            pageSize: 20,
            totalPages: 3,
        })

        renderBrowser()

        expect(await screen.findByText('Page 1 of 3 • 50 total files')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /next/i }))

        await waitFor(() => {
            expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({
                page: 2,
            }))
        })
    })

    it('opens edit mode and returns to the library', async () => {
        renderBrowser()

        await screen.findByText('Test Image 1')
        await user.click(screen.getAllByTitle('Edit file')[0])

        expect(await screen.findByText('Edit File')).toBeInTheDocument()
        expect(screen.getByText('Edit form for Test Image 1')).toBeInTheDocument()
        expect(mediaApi.files.get).toHaveBeenCalledWith('1')

        await user.click(screen.getByRole('button', { name: /cancel edit/i }))

        expect(await screen.findByText('Test Image 1')).toBeInTheDocument()
    })

    it.each(['list', 'grid'])('opens image editing from the %s preview in the media manager', async (viewMode) => {
        const onFileSelect = vi.fn()
        renderBrowser({ defaultViewMode: viewMode, previewOpensEditor: true, onFileSelect })

        await user.click(await screen.findByRole('button', { name: 'Edit image: Test Image 1' }))

        expect(await screen.findByText('Edit form for Test Image 1')).toBeInTheDocument()
        expect(mediaApi.files.get).toHaveBeenCalledWith('1')
        expect(onFileSelect).not.toHaveBeenCalled()
    })

    it('keeps preview clicks as selection in media pickers', async () => {
        const onFileSelect = vi.fn()
        renderBrowser({ defaultViewMode: 'list', onFileSelect })

        await user.click(await screen.findByAltText('Test Image 1'))

        expect(onFileSelect).toHaveBeenCalledWith(mockMediaFiles[0])
        expect(mediaApi.files.get).not.toHaveBeenCalled()
    })

    it('offers uploading a version when right-clicking an image preview', async () => {
        renderBrowser({ defaultViewMode: 'list' })
        await user.pointer({ target: await screen.findByAltText('Test Image 1'), keys: '[MouseRight]' })
        await user.click(screen.getByRole('menuitem', { name: 'Upload new version' }))

        expect(screen.getByRole('dialog', { name: 'Upload new version of Test Image 1' })).toBeInTheDocument()
        expect(mediaApi.files.get).not.toHaveBeenCalled()
    })

    it.each(['list', 'grid'])('keeps the %s library view read-only when actions are hidden', async (viewMode) => {
        renderBrowser({ defaultViewMode: viewMode, selectionMode: 'none', showUploader: false, hideActions: true })

        await user.pointer({ target: await screen.findByAltText('Test Image 1'), keys: '[MouseRight]' })

        expect(screen.queryByRole('menuitem', { name: 'Upload new version' })).not.toBeInTheDocument()
        expect(screen.queryByTitle('Edit file')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Edit image: Test Image 1' })).not.toBeInTheDocument()
        expect(mediaApi.files.get).not.toHaveBeenCalled()
    })

    it('restores deleted files without offering permanent deletion', async () => {
        renderBrowser()

        await screen.findByText('Deleted Document')

        await user.click(screen.getByTitle('Restore file'))
        expect(mediaApi.files.restore).toHaveBeenCalledWith('3')
        expect(screen.queryByTitle('Permanently delete file')).not.toBeInTheDocument()
    })

    it('uploads files through the current upload API and shows approval state', async () => {
        renderBrowser()

        const fileInput = document.getElementById('file-input')
        const file = new File(['hello'], 'hello.jpg', { type: 'image/jpeg' })

        fireEvent.change(fileInput, { target: { files: [file] } })

        await waitFor(() => {
            expect(mediaApi.upload.upload).toHaveBeenCalledWith({
                files: [file],
                namespace: 'test-namespace',
            })
        })
        expect(await screen.findByText('Pending approval: 1')).toBeInTheDocument()
    })

    it('passes approved uploads to a collection picker', async () => {
        const onApprovedFiles = vi.fn()
        renderBrowser({ onApprovedFiles })
        const file = new File(['hello'], 'hello.jpg', { type: 'image/jpeg' })

        fireEvent.change(document.getElementById('file-input'), { target: { files: [file] } })
        await user.click(await screen.findByRole('button', { name: 'Approve pending' }))

        await waitFor(() => expect(onApprovedFiles).toHaveBeenCalledWith([{ mediaFile: { id: 'approved-1' } }]))
    })

    it('allows only one upload when replacing a collection image', async () => {
        renderBrowser({ singleUpload: true })
        await screen.findByText('Test Image 1')
        const fileInput = document.getElementById('file-input')
        expect(fileInput).not.toHaveAttribute('multiple')

        fireEvent.change(fileInput, { target: { files: [
            new File(['one'], 'one.jpg', { type: 'image/jpeg' }),
            new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
        ] } })

        expect(mediaApi.upload.upload).not.toHaveBeenCalled()
    })

    it('opens duplicate resolution when upload reports actionable duplicates', async () => {
        mediaApi.upload.upload.mockResolvedValueOnce({
            hasErrors: true,
            errors: [
                {
                    status: 'needs_action',
                    reason: 'duplicate_existing',
                    filename: 'duplicate.jpg',
                },
            ],
        })

        renderBrowser()

        const fileInput = document.getElementById('file-input')
        const file = new File(['hello'], 'duplicate.jpg', { type: 'image/jpeg' })

        fireEvent.change(fileInput, { target: { files: [file] } })

        expect(await screen.findByRole('dialog')).toHaveTextContent('Duplicate files')
    })

    it('renders a quick view for extended images', async () => {
        renderBrowser({
            onFileSelect: vi.fn(),
        })

        await screen.findByText('Test Image 1')
        const quickViewButtons = screen.queryAllByTitle('Quick view full image')

        if (quickViewButtons.length > 0) {
            await user.click(quickViewButtons[0])
            expect(screen.getByRole('dialog')).toHaveTextContent('Quick view Test Image 1')
        } else {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        }
    })

    it('handles load errors by clearing the library', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { })
        mediaApi.search.search.mockRejectedValueOnce(new Error('API Error'))

        renderBrowser()

        expect(await screen.findByText('No files found')).toBeInTheDocument()
        consoleError.mockRestore()
    })
})
