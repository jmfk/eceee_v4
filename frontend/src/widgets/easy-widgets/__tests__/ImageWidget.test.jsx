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
})
