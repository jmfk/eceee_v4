import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let externalChangeCallbacks = []
const imgproxyApi = vi.hoisted(() => ({ getUrl: vi.fn() }))

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
})
