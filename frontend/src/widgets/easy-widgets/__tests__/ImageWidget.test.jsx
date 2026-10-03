import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let externalChangeCallbacks = []

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
    })

    it('keeps randomized images in the same order across unrelated re-renders', () => {
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
        const initialOrder = screen.getAllByRole('img').map(image => image.alt)

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

        expect(screen.getAllByRole('img').map(image => image.alt)).toEqual(initialOrder)
        expect(randomSpy).toHaveBeenCalledTimes(1)
        randomSpy.mockRestore()
    })

    it('stops carousel auto-play when the editor setting is turned off', () => {
        const { container } = render(
            <ImageWidget
                mode="editor"
                widgetId="image-1"
                slotName="main"
                config={config(true)}
            />
        )

        const track = container.querySelector('.flex.transition-transform')
        expect(screen.getByTitle('Pause slideshow')).toBeInTheDocument()

        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(track).toHaveStyle({ transform: 'translateX(-100%)' })

        const subscription = externalChangeCallbacks.find(
            item => item.componentId === 'imagewidget-image-1'
        )
        act(() => {
            subscription.callback(stateWithConfig(config(false)))
        })

        expect(screen.getByTitle('Play slideshow')).toBeInTheDocument()
        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(track).toHaveStyle({ transform: 'translateX(-100%)' })
    })

    it('renders the canonical single image selected by ImageInput', () => {
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

        expect(screen.getByRole('img', { name: 'The power of light' })).toHaveAttribute('src', '/full-size.jpg')
    })
})
