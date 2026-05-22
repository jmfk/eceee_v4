import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import MediaSearchWidget from '../media/MediaSearchWidget'
import { mediaApi } from '../../api'

vi.mock('../../api', () => ({
    mediaApi: {
        tags: {
            list: vi.fn(() => () => Promise.resolve({
                results: [
                    { id: 1, name: 'nature', usageCount: 5 },
                    { id: 2, name: 'landscape', usageCount: 3 },
                ],
            })),
        },
    },
}))

describe('MediaSearchWidget', () => {
    const mockOnChange = vi.fn()
    const defaultProps = {
        searchTerms: [],
        onChange: mockOnChange,
        namespace: 'test-namespace',
        placeholder: 'Search media files...',
        autoSearch: false,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders with empty search terms', async () => {
        render(<MediaSearchWidget {...defaultProps} />)

        expect(await screen.findByPlaceholderText('Search media files...')).toBeInTheDocument()
        expect(screen.getByText(/Type to search files by text.*Multiple tags work as AND filters/)).toBeInTheDocument()
    })

    it('loads initial tag suggestions for the namespace', async () => {
        render(<MediaSearchWidget {...defaultProps} />)

        await waitFor(() => {
            expect(mediaApi.tags.list).toHaveBeenCalledWith({
                namespace: 'test-namespace',
                page_size: 10,
            })
        })
    })

    it('displays existing tag terms as pills and existing text terms in the input', async () => {
        render(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={[
                    { value: 'nature', type: 'tag' },
                    { value: 'vacation photos', type: 'text' },
                ]}
            />
        )

        expect(await screen.findByPlaceholderText('Search media files...')).toHaveValue('vacation photos')
        expect(screen.getByText('nature')).toBeInTheDocument()
        expect(screen.queryByText('vacation photos')).not.toBeInTheDocument()
    })

    it('uses the tag pill styling for selected tags', async () => {
        render(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={[{ value: 'nature', type: 'tag' }]}
            />
        )

        await screen.findByPlaceholderText('Search media files...')
        expect(screen.getByText('nature').closest('span')).toHaveClass('bg-blue-100', 'text-blue-800')
    })

    it('adds a text search when Enter is pressed with free text', async () => {
        render(<MediaSearchWidget {...defaultProps} />)

        const input = await screen.findByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'new search term' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        expect(mockOnChange).toHaveBeenCalledWith([
            { value: 'new search term', type: 'text' },
        ])
    })

    it('replaces the existing text term while preserving tags', async () => {
        render(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={[
                    { value: 'old search', type: 'text' },
                    { value: 'nature', type: 'tag' },
                ]}
            />
        )

        const input = await screen.findByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'new search' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        expect(mockOnChange).toHaveBeenCalledWith([
            { value: 'nature', type: 'tag' },
            { value: 'new search', type: 'text' },
        ])
    })

    it('removes tag pills', async () => {
        render(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={[{ value: 'nature', type: 'tag' }]}
            />
        )

        await userEvent.click(screen.getByRole('button', { name: /remove nature/i }))

        expect(mockOnChange).toHaveBeenCalledWith([])
    })

    it('shows matching tag suggestions while typing', async () => {
        render(<MediaSearchWidget {...defaultProps} />)

        const input = await screen.findByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'nat' } })

        await waitFor(() => {
            expect(screen.getByText('nature')).toBeInTheDocument()
        })
    })

    it('adds a clicked tag suggestion and preserves existing text search', async () => {
        render(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={[{ value: 'beach', type: 'text' }]}
            />
        )

        const input = await screen.findByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'nat' } })

        await userEvent.click(await screen.findByRole('button', { name: /nature/i }))

        expect(mockOnChange).toHaveBeenCalledWith([
            { value: 'nature', type: 'tag' },
            { value: 'beach', type: 'text' },
        ])
    })

    it('prevents duplicate tag suggestions from being added', async () => {
        render(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={[{ value: 'nature', type: 'tag' }]}
            />
        )

        const input = await screen.findByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'nat' } })

        await waitFor(() => {
            const suggestionNames = screen
                .getAllByRole('button')
                .filter(button => button.textContent.includes('uses'))
                .map(button => button.textContent)

            expect(suggestionNames.some(name => name.includes('nature'))).toBe(false)
            expect(suggestionNames.some(name => name.includes('landscape'))).toBe(true)
        })
    })

    it('allows multiple tag terms', async () => {
        const handleChange = vi.fn()
        const { rerender } = render(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={[{ value: 'nature', type: 'tag' }]}
                onChange={handleChange}
            />
        )

        const input = await screen.findByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'land' } })
        await userEvent.click(await screen.findByRole('button', { name: /landscape/i }))

        expect(handleChange).toHaveBeenCalledWith([
            { value: 'nature', type: 'tag' },
            { value: 'landscape', type: 'tag' },
        ])

        rerender(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={[
                    { value: 'nature', type: 'tag' },
                    { value: 'landscape', type: 'tag' },
                ]}
                onChange={handleChange}
            />
        )

        expect(screen.getByText('nature')).toBeInTheDocument()
        expect(screen.getByText('landscape')).toBeInTheDocument()
    })

    it('handles disabled state', () => {
        render(<MediaSearchWidget {...defaultProps} disabled />)

        expect(screen.queryByPlaceholderText('Search media files...')).not.toBeInTheDocument()
        expect(screen.getByText('Search terms help filter your media files')).toBeInTheDocument()
    })

    it('shows a no-results message for unmatched tag searches', async () => {
        mediaApi.tags.list.mockImplementation((params = {}) => () => Promise.resolve({
            results: params.search ? [] : [
                { id: 1, name: 'nature', usageCount: 5 },
                { id: 2, name: 'landscape', usageCount: 3 },
            ],
        }))

        render(<MediaSearchWidget {...defaultProps} />)

        const input = await screen.findByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'missing' } })

        expect(await screen.findByText('No matching tags found. Press Enter to search text.')).toBeInTheDocument()
    })
})
