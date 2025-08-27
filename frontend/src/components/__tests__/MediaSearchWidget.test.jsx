import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import MediaSearchWidget from '../media/MediaSearchWidget'
import { mediaApi } from '../../api'

// Mock the media API
vi.mock('../../api', () => ({
    mediaApi: {
        tags: {
            list: vi.fn(() => () => Promise.resolve({
                results: [
                    { id: 1, name: 'nature', usageCount: 5 },
                    { id: 2, name: 'landscape', usageCount: 3 }
                ]
            }))
        }
    }
}))

describe('MediaSearchWidget', () => {
    const mockOnChange = vi.fn()
    const defaultProps = {
        searchTerms: [],
        onChange: mockOnChange,
        namespace: 'test-namespace',
        placeholder: 'Search media files...'
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders with empty search terms', async () => {
        render(<MediaSearchWidget {...defaultProps} />)

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search media files...')).toBeInTheDocument()
        })
        expect(screen.getByText(/Type to search existing tags.*Multiple tags work as AND filters/)).toBeInTheDocument()
    })

    it('displays existing search terms as pills', () => {
        const searchTerms = [
            { value: 'nature', type: 'tag' },
            { value: 'vacation photos', type: 'text' }
        ]

        render(<MediaSearchWidget {...defaultProps} searchTerms={searchTerms} />)

        expect(screen.getByText('nature')).toBeInTheDocument()
        expect(screen.getByText('vacation photos')).toBeInTheDocument()
    })

    it('shows different pill colors for tags vs text', () => {
        const searchTerms = [
            { value: 'nature', type: 'tag' },
            { value: 'vacation photos', type: 'text' }
        ]

        render(<MediaSearchWidget {...defaultProps} searchTerms={searchTerms} />)

        const naturePill = screen.getByText('nature').closest('span')
        const vacationPill = screen.getByText('vacation photos').closest('span')

        // Tag pills should have blue background
        expect(naturePill).toHaveClass('bg-blue-100', 'text-blue-800')
        // Text pills should have gray background
        expect(vacationPill).toHaveClass('bg-gray-100', 'text-gray-800')
    })

    it('allows adding new search terms', async () => {
        render(<MediaSearchWidget {...defaultProps} />)

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search media files...')).toBeInTheDocument()
        })

        const input = screen.getByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'new search term' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith([
                { value: 'new search term', type: 'text' }
            ])
        })
    })

    it('allows removing search terms', () => {
        const searchTerms = [
            { value: 'nature', type: 'tag' }
        ]

        render(<MediaSearchWidget {...defaultProps} searchTerms={searchTerms} />)

        const removeButton = screen.getByRole('button', { name: '' }) // X button
        fireEvent.click(removeButton)

        expect(mockOnChange).toHaveBeenCalledWith([])
    })

    it('shows suggestions when typing', async () => {
        render(<MediaSearchWidget {...defaultProps} />)

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search media files...')).toBeInTheDocument()
        })

        const input = screen.getByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'nat' } })

        await waitFor(() => {
            expect(screen.getByText('nature')).toBeInTheDocument()
            expect(screen.getByText('landscape')).toBeInTheDocument()
        })
    })

    it('prevents duplicate search terms', async () => {
        const searchTerms = [
            { value: 'nature', type: 'tag' }
        ]

        render(<MediaSearchWidget {...defaultProps} searchTerms={searchTerms} />)

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search media files...')).toBeInTheDocument()
        })

        const input = screen.getByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'nature' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        // Should not call onChange since it's a duplicate
        expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('replaces existing text search term when adding new one', async () => {
        const searchTerms = [
            { value: 'old search', type: 'text' },
            { value: 'nature', type: 'tag' }
        ]

        render(<MediaSearchWidget {...defaultProps} searchTerms={searchTerms} />)

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search media files...')).toBeInTheDocument()
        })

        const input = screen.getByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'new search' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        // Should replace the old text term
        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith([
                { value: 'nature', type: 'tag' },
                { value: 'new search', type: 'text' }
            ])
        })
    })

    it('allows multiple tags but only one text search', async () => {
        const mockOnChange = vi.fn()
        let currentSearchTerms = []

        // Mock onChange to simulate state updates
        const handleChange = (newTerms) => {
            currentSearchTerms = newTerms
            mockOnChange(newTerms)
        }

        const { rerender } = render(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={currentSearchTerms}
                onChange={handleChange}
            />
        )

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search media files...')).toBeInTheDocument()
        })

        const input = screen.getByPlaceholderText('Search media files...')

        // Add first tag
        fireEvent.change(input, { target: { value: 'nature' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith([
                { value: 'nature', type: 'tag' }
            ])
        })

        // Re-render with updated search terms
        rerender(
            <MediaSearchWidget
                {...defaultProps}
                searchTerms={currentSearchTerms}
                onChange={handleChange}
            />
        )

        // Add second tag
        fireEvent.change(input, { target: { value: 'landscape' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenLastCalledWith([
                { value: 'nature', type: 'tag' },
                { value: 'landscape', type: 'tag' }
            ])
        })
    })

    it('handles disabled state', () => {
        render(<MediaSearchWidget {...defaultProps} disabled={true} />)

        expect(screen.queryByPlaceholderText('Search media files...')).not.toBeInTheDocument()
        expect(screen.getByText('Search terms help filter your media files')).toBeInTheDocument()
    })

    it('shows suggestions dropdown when typing', async () => {
        render(<MediaSearchWidget {...defaultProps} />)

        // Wait for initial loading to complete
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search media files...')).toBeInTheDocument()
        })

        const input = screen.getByPlaceholderText('Search media files...')
        fireEvent.change(input, { target: { value: 'test' } })

        // Should show suggestions dropdown
        await waitFor(() => {
            expect(screen.getByText('Search for:')).toBeInTheDocument()
        })
    })
})
