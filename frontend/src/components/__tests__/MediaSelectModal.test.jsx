import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import MediaSelectModal from '../media/MediaSelectModal'

const collectionsApi = vi.hoisted(() => ({
    list: vi.fn(() => async () => ({ results: [] })),
    get: vi.fn(),
}))

vi.mock('../../api', () => ({
    mediaCollectionsApi: collectionsApi,
    mediaApi: { tags: { list: vi.fn(() => async () => ({ results: [] })) } },
}))
vi.mock('../media/OptimizedImage', () => ({ default: ({ src, alt }) => <img src={src} alt={alt} /> }))

vi.mock('../media/MediaBrowser', () => ({
    default: ({ onFileSelect, requireTags }) => <button
        type="button"
        data-require-tags={String(requireTags)}
        onClick={() => onFileSelect({ id: 'media-1', title: 'Tagged image' })}
    >
        Choose tagged image
    </button>,
}))

describe('MediaSelectModal', () => {
    it('searches collections by name and links directly to their editor', async () => {
        const user = userEvent.setup()
        collectionsApi.list.mockImplementation(() => async () => ({ results: [
            { id: 'collection-2', title: 'Summer images', namespace: 'main', fileCount: 2 },
        ] }))
        render(<MediaSelectModal isOpen onClose={vi.fn()} onSelect={vi.fn()} namespace="main" />)

        await user.click(screen.getByRole('button', { name: 'Select Collection' }))
        expect(await screen.findByRole('link', { name: 'Edit collection' })).toHaveAttribute(
            'href', '/media?tab=collections&collection=collection-2&namespace=main'
        )
        await user.type(screen.getByPlaceholderText('Search collections by name or tags...'), 'Summer')
        await waitFor(() => expect(collectionsApi.list).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'main', search: 'Summer', tag_names: [],
        })), { timeout: 1500 })
    })

    it('hides empty collections in the picker until requested', async () => {
        const user = userEvent.setup()
        collectionsApi.list.mockImplementation(() => async () => ({ results: [
            { id: 'filled', title: 'Filled collection', fileCount: 2 },
            { id: 'empty', title: 'Empty collection', fileCount: 0 },
        ] }))
        render(<MediaSelectModal isOpen onClose={vi.fn()} onSelect={vi.fn()} namespace="main" />)

        await user.click(screen.getByRole('button', { name: 'Select Collection' }))
        expect(await screen.findByText('Filled collection')).toBeInTheDocument()
        expect(screen.queryByText('Empty collection')).not.toBeInTheDocument()
        await user.click(screen.getByRole('checkbox', { name: 'Show empty collections (1)' }))
        expect(screen.getByText('Empty collection')).toBeInTheDocument()
    })

    it('shows a collage for a saved collection reference without a files property', async () => {
        collectionsApi.get.mockImplementation(() => async () => ({
            id: 'collection-1',
            title: 'summerstudy 2025 logos',
            fileCount: 11,
            sampleImages: [1, 2, 3, 4].map(id => ({ id, imgproxyBaseUrl: `/logo-${id}.jpg` })),
        }))
        render(<MediaSelectModal
            isOpen
            onClose={vi.fn()}
            onSelect={vi.fn()}
            namespace="default"
            currentSelection={{ id: 'collection-1', type: 'collection', title: 'summerstudy 2025 logos' }}
        />)

        expect(await screen.findByText('Collection (11 images)')).toBeInTheDocument()
        expect(collectionsApi.get).toHaveBeenCalledWith('collection-1', { namespace: 'default' })
        expect(Array.from(document.querySelectorAll('img')).map(image => image.getAttribute('src'))).toEqual([
            '/logo-1.jpg', '/logo-2.jpg', '/logo-3.jpg', '/logo-4.jpg',
        ])
        expect(screen.queryByText('No image')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Edit collection' })).toHaveAttribute(
            'href', '/media?tab=collections&collection=collection-1&namespace=default'
        )
    })

    it('keeps the picker open when an asynchronous selection is rejected', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        const onSelect = vi.fn().mockResolvedValue(false)
        render(<MediaSelectModal
            isOpen
            onClose={onClose}
            onSelect={onSelect}
            namespace="theme-media"
            requireTags
            allowCollections={false}
        />)

        const choice = screen.getByRole('button', { name: 'Choose tagged image' })
        expect(choice).toHaveAttribute('data-require-tags', 'true')
        await user.click(choice)
        await user.click(screen.getByRole('button', { name: 'Select (1)' }))

        await waitFor(() => expect(onSelect).toHaveBeenCalledWith([
            { id: 'media-1', title: 'Tagged image' },
        ]))
        expect(onClose).not.toHaveBeenCalled()
        expect(screen.getByRole('heading', { name: 'Select Media' })).toBeInTheDocument()
    })
})
