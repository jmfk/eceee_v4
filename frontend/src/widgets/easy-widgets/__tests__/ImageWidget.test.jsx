import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let externalChangeCallbacks = []
const imgproxyApi = vi.hoisted(() => ({ getUrl: vi.fn() }))
const mediaCollectionsApi = vi.hoisted(() => ({ getFiles: vi.fn() }))

vi.mock('../../../hooks/useTheme', () => ({
    useTheme: () => ({ currentTheme: null })
}))

vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: vi.fn((componentId, callback) => {
            externalChangeCallbacks.push({ componentId, callback })
        }),
        publishUpdate: vi.fn(),
        getState: vi.fn()
    })
}))

vi.mock('../../../contexts/unified-data/hooks', () => ({
    useEditorContext: () => 'page'
}))

vi.mock('../../../utils/imgproxySecure', () => ({
    getImgproxyUrl: imgproxyApi.getUrl,
}))

vi.mock('../../../api/media', () => ({
    mediaCollectionsApi,
}))

vi.mock('../../../components/media/MediaSelectModal', () => ({
    default: ({ onSelect, onClose }) => <div role="dialog">
        <button onClick={() => onSelect([{ id: 'new', url: '/new.jpg', title: 'New image' }])}>Choose image</button>
        <button onClick={() => onSelect(null)}>Remove image</button>
        <button onClick={onClose}>Close</button>
    </div>
}))

import ImageWidget from '../ImageWidget'

const config = autoPlay => ({
    displayType: 'carousel',
    autoPlay,
    autoPlayInterval: 1,
    mediaItems: [
        { id: 'first', type: 'image', url: '/first.jpg', altText: 'First' },
        { id: 'second', type: 'image', url: '/second.jpg', altText: 'Second' }
    ]
})

const stateWithConfig = nextConfig => ({
    versions: {
        current: {
            widgets: {
                main: [{ id: 'image-1', type: 'easy_widgets.ImageWidget', config: nextConfig }]
            }
        }
    },
    metadata: { currentVersionId: 'current' }
})

describe('ImageWidget', () => {
    beforeEach(() => {
        externalChangeCallbacks = []
        vi.useFakeTimers()
        vi.clearAllMocks()
        imgproxyApi.getUrl.mockImplementation(sourceUrl => Promise.resolve(`/imgproxy/resize:fit/${sourceUrl}`))
        mediaCollectionsApi.getFiles.mockImplementation(() => () => Promise.resolve({ results: [] }))
    })

    it('keeps randomized images in the same order across unrelated re-renders', async () => {
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.42)
        const randomizedConfig = {
            displayType: 'gallery',
            randomize: true,
            showCaptions: true,
            mediaItems: [
                { id: 'first', type: 'image', url: '/first.jpg', altText: 'First' },
                { id: 'second', type: 'image', url: '/second.jpg', altText: 'Second' },
                { id: 'third', type: 'image', url: '/third.jpg', altText: 'Third' }
            ]
        }

        const { rerender } = render(
            <ImageWidget
                mode="editor"
                widgetId="image-1"
                slotName="main"
                config={randomizedConfig}
            />
        )
        const initialOrder = (await screen.findAllByRole('img')).map(image => image.alt)

        rerender(
            <ImageWidget
                mode="editor"
                widgetId="image-1"
                slotName="main"
                config={{
                    ...randomizedConfig,
                    showCaptions: false,
                    mediaItems: randomizedConfig.mediaItems.map(item => ({ ...item }))
                }}
            />
        )

        expect((await screen.findAllByRole('img')).map(image => image.alt)).toEqual(initialOrder)
        randomSpy.mockRestore()
    })

    it('stops carousel auto-play when the editor setting is turned off', async () => {
        const { container } = render(
            <ImageWidget
                mode="editor"
                widgetId="image-1"
                slotName="main"
                config={config(true)}
            />
        )

        expect(await screen.findByTitle('Pause slideshow')).toBeInTheDocument()
        let track = container.querySelector('.flex.transition-transform')

        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(track).toHaveStyle({ transform: 'translateX(-100%)' })

        const subscription = externalChangeCallbacks.find(
            item => item.componentId === 'imagewidget-image-1'
        )
        await act(async () => {
            subscription.callback(stateWithConfig(config(false)))
            await Promise.resolve()
        })

        expect(await screen.findByTitle('Play slideshow')).toBeInTheDocument()
        track = container.querySelector('.flex.transition-transform')
        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(track).toHaveStyle({ transform: 'translateX(-100%)' })
    })

    it('renders the canonical single image selected by ImageInput through imgproxy', async () => {
        render(
            <ImageWidget
                mode="editor"
                widgetId="image-1"
                slotName="main"
                config={{
                    image: {
                        id: 'media-1',
                        imgproxy_base_url: '/full-size.jpg',
                        thumbnail_url: '/thumbnail.jpg',
                        title: 'The power of light',
                    },
                    displayType: 'gallery',
                }}
            />
        )

        expect(await screen.findByRole('img', { name: 'The power of light' })).toHaveAttribute(
            'src',
            '/imgproxy/resize:fit//full-size.jpg'
        )
        expect(imgproxyApi.getUrl).toHaveBeenCalledWith('/full-size.jpg', {
            width: 896,
            resize_type: 'fit',
            quality: 85,
            format: 'webp',
        })
    })

    it('renders safe inline images when imgproxy returns the source unchanged', async () => {
        const inlineSvg = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E'
        imgproxyApi.getUrl.mockResolvedValue(inlineSvg)

        render(
            <ImageWidget
                mode="editor"
                widgetId="image-1"
                slotName="main"
                config={{
                    displayType: 'gallery',
                    mediaItems: [{ type: 'image', url: inlineSvg, altText: 'Error page illustration' }],
                }}
            />
        )

        expect(await screen.findByRole('img', { name: 'Error page illustration' })).toHaveAttribute('src', inlineSvg)
    })

    it('does not refetch collection files when unrelated widget config changes', async () => {
        const collectionConfig = {
            displayType: 'gallery',
            mediaItems: [],
            image: {
                id: 'collection-1',
                type: 'collection',
                namespace: 'default',
            },
        }

        render(
            <ImageWidget
                mode="editor"
                widgetId="image-1"
                slotName="main"
                config={collectionConfig}
            />
        )

        await waitFor(() => expect(mediaCollectionsApi.getFiles).toHaveBeenCalledTimes(1))

        const subscription = externalChangeCallbacks.find(
            item => item.componentId === 'imagewidget-image-1'
        )
        await act(async () => {
            subscription.callback(stateWithConfig({
                ...collectionConfig,
                showCaptions: true,
                image: { ...collectionConfig.image },
                mediaItems: [],
            }))
            await Promise.resolve()
        })

        expect(mediaCollectionsApi.getFiles).toHaveBeenCalledTimes(1)
    })

    it('renders embedded collection samples when the saved collection no longer exists', async () => {
        mediaCollectionsApi.getFiles.mockImplementation(() => () => Promise.reject(new Error('Not found')))

        render(
            <ImageWidget
                mode="editor"
                widgetId="image-1"
                slotName="main"
                config={{
                    displayType: 'gallery',
                    image: {
                        id: 'missing-collection',
                        type: 'collection',
                        namespace: 'default',
                        sample_images: [
                            { id: 'sample-1', title: 'Partner logo', imgproxy_base_url: '/partner-logo.png' },
                        ],
                    },
                    mediaItems: [],
                }}
            />
        )

        expect(await screen.findByRole('img', { name: 'Partner logo' })).toHaveAttribute(
            'src',
            '/imgproxy/resize:fit//partner-logo.png'
        )
    })
})


describe('ImageWidget inline selection', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        imgproxyApi.getUrl.mockImplementation(url => Promise.resolve(url))
    })

    it('offers image selection from the empty placeholder without a size control', async () => {
        const onConfigChange = vi.fn()
        render(<ImageWidget mode="editor" config={{}} onConfigChange={onConfigChange} />)
        expect(screen.getByRole('img', { name: 'No image selected' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Image size/ })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Image' }))
        fireEvent.click(screen.getByText('Choose image'))
        expect(await screen.findByRole('img', { name: 'New image' })).toHaveAttribute('src', '/new.jpg')
        expect(onConfigChange).toHaveBeenCalledTimes(1)
        expect(onConfigChange.mock.calls[0][0].image.id).toBe('new')
    })

    it('clears cached sources when removing an image', async () => {
        const onConfigChange = vi.fn()
        render(<ImageWidget mode="editor" config={{ image: { url: '/old.jpg' }, mediaItems: [{ url: '/stale.jpg' }], imageUrl: '/cached.jpg' }} onConfigChange={onConfigChange} />)
        fireEvent.click(screen.getByRole('button', { name: 'Image' }))
        fireEvent.click(screen.getByText('Remove image'))
        expect(await screen.findByRole('img', { name: 'No image selected' })).toBeInTheDocument()
        expect(onConfigChange).toHaveBeenCalledWith({ image: null })
    })

    it('does not publish the editor placeholder or controls', () => {
        render(<ImageWidget mode="preview" config={{}} />)
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
        expect(screen.queryByRole('img', { name: 'No image selected' })).not.toBeInTheDocument()
    })
})
