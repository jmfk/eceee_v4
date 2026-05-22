import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MediaField from '../form-fields/MediaField'

vi.mock('../media/OptimizedImage', () => ({
    default: ({ src, alt, className }) => <img src={src} alt={alt} className={className} />,
}))

vi.mock('../media/MediaSelectModal', () => ({
    default: ({ isOpen, onClose, onSelect, multiple, mediaTypes, namespace, currentSelection }) => {
        if (!isOpen) return null

        const mockFile = {
            id: '1',
            title: 'Test Image',
            fileUrl: 'https://example.com/test.jpg',
            fileType: 'image/jpeg',
            thumbnailUrl: 'https://example.com/test_small.jpg',
            fileSizeDisplay: '1 KB',
        }
        const mockFile2 = {
            id: '2',
            title: 'Test Video',
            fileUrl: 'https://example.com/test.mp4',
            fileType: 'video/mp4',
            fileSizeDisplay: '2 KB',
        }

        return (
            <div data-testid="media-picker-modal">
                <div data-testid="picker-props">
                    {JSON.stringify({
                        multiple,
                        mediaTypes,
                        namespace,
                        currentSelectionId: currentSelection?.id,
                    })}
                </div>
                <button
                    type="button"
                    data-testid="select-media-btn"
                    onClick={() => {
                        onSelect(multiple ? [mockFile, mockFile2] : [mockFile])
                        onClose()
                    }}
                >
                    Select Media
                </button>
                <button type="button" onClick={onClose}>
                    Close
                </button>
            </div>
        )
    },
}))

const mockSingleMediaValue = {
    id: '1',
    title: 'Existing Image',
    fileUrl: 'https://example.com/existing.jpg',
    fileType: 'image/jpeg',
    thumbnailUrl: 'https://example.com/existing_small.jpg',
    fileSizeDisplay: '1 MB',
}

const mockSnakeCaseMediaValue = {
    id: 'legacy-1',
    title: 'Legacy Image',
    file_url: 'https://example.com/legacy.jpg',
    file_type: 'image/jpeg',
    thumbnails: {
        small: 'https://example.com/legacy_small.jpg',
    },
    file_size_display: '512 KB',
}

const mockMultipleMediaValue = [
    {
        id: '1',
        title: 'Image 1',
        fileUrl: 'https://example.com/image1.jpg',
        fileType: 'image/jpeg',
        thumbnailUrl: 'https://example.com/image1_small.jpg',
        fileSizeDisplay: '1 MB',
    },
    {
        id: '2',
        title: 'Image 2',
        fileUrl: 'https://example.com/image2.png',
        fileType: 'image/png',
        thumbnailUrl: 'https://example.com/image2_small.jpg',
        fileSizeDisplay: '2 MB',
    },
]

const renderField = (props = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <MediaField label="Media Field" value={null} onChange={vi.fn()} {...props} />
        </QueryClientProvider>
    )
}

describe('MediaField', () => {
    let user

    beforeEach(() => {
        user = userEvent.setup()
        vi.clearAllMocks()
    })

    it('renders label, description, and required marker', () => {
        renderField({
            label: 'Featured Image',
            description: 'Select an image for the featured content',
            required: true,
        })

        expect(screen.getByText('Featured Image')).toBeInTheDocument()
        expect(screen.getByText('Select an image for the featured content')).toBeInTheDocument()
        expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('renders a library select button when empty', () => {
        renderField()

        expect(screen.getByRole('button', { name: /select media from library/i })).toBeInTheDocument()
    })

    it('uses file wording when image media is not allowed', () => {
        renderField({ mediaTypes: ['document'] })

        expect(screen.getByRole('button', { name: /select file from library/i })).toBeInTheDocument()
    })

    it('displays a selected image with normalized camelCase metadata', () => {
        renderField({ label: 'Single Media', value: mockSingleMediaValue })

        expect(screen.getByText('Existing Image')).toBeInTheDocument()
        expect(screen.getByAltText('Existing Image')).toHaveAttribute('src', 'https://example.com/existing_small.jpg')
        expect(screen.getByText('image/jpeg • 1 MB')).toBeInTheDocument()
    })

    it('displays legacy snake_case media payloads', () => {
        renderField({ value: mockSnakeCaseMediaValue })

        expect(screen.getByText('Legacy Image')).toBeInTheDocument()
        expect(screen.getByAltText('Legacy Image')).toHaveAttribute('src', 'https://example.com/legacy_small.jpg')
        expect(screen.getByText('image/jpeg • 512 KB')).toBeInTheDocument()
    })

    it('opens the media selector from the empty state', async () => {
        renderField()

        await user.click(screen.getByRole('button', { name: /select media/i }))

        expect(screen.getByTestId('media-picker-modal')).toBeInTheDocument()
    })

    it('passes selection constraints to the media selector', async () => {
        renderField({
            multiple: true,
            mediaTypes: ['image', 'video'],
            namespace: 'custom-namespace',
        })

        await user.click(screen.getByRole('button', { name: /select media/i }))

        expect(JSON.parse(screen.getByTestId('picker-props').textContent)).toMatchObject({
            multiple: true,
            mediaTypes: ['image', 'video'],
            namespace: 'custom-namespace',
        })
    })

    it('updates single media values from the selector', async () => {
        const onChange = vi.fn()
        renderField({ onChange })

        await user.click(screen.getByRole('button', { name: /select media/i }))
        await user.click(screen.getByTestId('select-media-btn'))

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            id: '1',
            title: 'Test Image',
            fileUrl: 'https://example.com/test.jpg',
        }))
    })

    it('shows change and remove actions for a selected single file', async () => {
        renderField({ value: mockSingleMediaValue })

        expect(screen.getByRole('button', { name: /change file/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /remove existing image/i })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /change file/i }))

        expect(screen.getByTestId('media-picker-modal')).toBeInTheDocument()
        expect(JSON.parse(screen.getByTestId('picker-props').textContent)).toMatchObject({
            currentSelectionId: '1',
        })
    })

    it('removes a selected single file', async () => {
        const onChange = vi.fn()
        renderField({ value: mockSingleMediaValue, onChange })

        await user.click(screen.getByRole('button', { name: /remove existing image/i }))

        expect(onChange).toHaveBeenCalledWith(null)
    })

    it('displays multiple selected files and count', () => {
        renderField({ value: mockMultipleMediaValue, multiple: true })

        expect(screen.getByText('Image 1')).toBeInTheDocument()
        expect(screen.getByText('Image 2')).toBeInTheDocument()
        expect(screen.getByText('Selected Medias (2)')).toBeInTheDocument()
        expect(screen.getAllByRole('img')).toHaveLength(2)
    })

    it('adds new files to an existing multiple selection', async () => {
        const onChange = vi.fn()
        renderField({
            value: [mockMultipleMediaValue[0]],
            onChange,
            multiple: true,
        })

        await user.click(screen.getByRole('button', { name: /add more media/i }))
        await user.click(screen.getByTestId('select-media-btn'))

        expect(onChange).toHaveBeenCalledWith([
            mockMultipleMediaValue[0],
            expect.objectContaining({ id: '2', title: 'Test Video' }),
        ])
    })

    it('enforces maxItems when adding multiple files', async () => {
        const onChange = vi.fn()
        renderField({
            value: [],
            onChange,
            multiple: true,
            maxItems: 1,
        })

        await user.click(screen.getByRole('button', { name: /select media from library/i }))
        await user.click(screen.getByTestId('select-media-btn'))

        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({ id: '1' }),
        ])
    })

    it('removes individual files from a multiple selection', async () => {
        const onChange = vi.fn()
        renderField({
            value: mockMultipleMediaValue,
            onChange,
            multiple: true,
        })

        await user.click(screen.getByRole('button', { name: /remove image 1/i }))

        expect(onChange).toHaveBeenCalledWith([mockMultipleMediaValue[1]])
    })

    it('hides the add button when maxItems is reached', () => {
        renderField({
            value: mockMultipleMediaValue,
            multiple: true,
            maxItems: 2,
        })

        expect(screen.queryByRole('button', { name: /add more media/i })).not.toBeInTheDocument()
        expect(screen.getByText('Maximum: 2 files')).toBeInTheDocument()
    })

    it('shows min and max item guidance', () => {
        renderField({
            value: [],
            multiple: true,
            minItems: 1,
            maxItems: 3,
        })

        expect(screen.getByText(/Minimum: 1 file/)).toBeInTheDocument()
        expect(screen.getByText(/Maximum: 3 files/)).toBeInTheDocument()
    })

    it('renders validation errors from hasError payloads', () => {
        renderField({
            validation: {
                hasError: true,
                message: 'This field is required',
            },
        })

        expect(screen.getByRole('alert')).toHaveTextContent('This field is required')
        expect(screen.getByRole('button', { name: /select media/i })).toHaveClass('error')
    })

    it('renders validation errors from isValid payloads', () => {
        renderField({
            validation: {
                isValid: false,
                message: 'Pick at least one file',
            },
        })

        expect(screen.getByRole('alert')).toHaveTextContent('Pick at least one file')
    })

    it('can hide validation display', () => {
        renderField({
            showValidation: false,
            validation: {
                hasError: true,
                message: 'Hidden error',
            },
        })

        expect(screen.queryByText('Hidden error')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /select media/i })).not.toHaveClass('error')
    })

    it('shows validating state', () => {
        renderField({ value: mockSingleMediaValue, isValidating: true })

        expect(screen.getByText('Validating...')).toBeInTheDocument()
    })

    it('connects description and error ids through aria-describedby', () => {
        renderField({
            description: 'Helpful text',
            validation: {
                hasError: true,
                message: 'This field has an error',
            },
        })

        const button = screen.getByRole('button', { name: /select media/i })
        const describedBy = button.getAttribute('aria-describedby')

        expect(describedBy).toContain(screen.getByText('Helpful text').id)
        expect(describedBy).toContain(screen.getByRole('alert').id)
    })

    it('preserves selected display across rerenders', () => {
        const { rerender } = renderField({ value: mockSingleMediaValue })

        expect(screen.getByText('Existing Image')).toBeInTheDocument()

        rerender(
            <QueryClientProvider client={new QueryClient()}>
                <MediaField label="Media Field" value={mockSingleMediaValue} onChange={vi.fn()} />
            </QueryClientProvider>
        )

        expect(screen.getByText('Existing Image')).toBeInTheDocument()
    })
})
