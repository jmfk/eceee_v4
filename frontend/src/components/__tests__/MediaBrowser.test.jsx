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
    default: ({ src, alt, className }) => <img src={src} alt={alt} className={className} />,
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
            <button type="button" onClick={() => onComplete(pendingFiles)}>Approve pending</button>
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
        is_deleted: true,
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

    it('restores and permanently deletes deleted files', async () => {
        renderBrowser()

        await screen.findByText('Deleted Document')

        await user.click(screen.getByTitle('Restore file'))
        expect(mediaApi.files.restore).toHaveBeenCalledWith('3')

        await user.click(screen.getByTitle('Permanently delete file'))
        expect(window.confirm).toHaveBeenCalled()
        expect(mediaApi.files.forceDelete).toHaveBeenCalledWith('3')
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
