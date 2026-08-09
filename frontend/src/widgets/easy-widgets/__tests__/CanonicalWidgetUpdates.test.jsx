import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let rendererInstances = []
let bioRendererInstances = []
let publishUpdateMock = vi.fn()
let externalChangeCallbacks = []

vi.mock('../SimpleTextEditorRenderer', () => ({
    SimpleTextEditorRenderer: vi.fn(function (container, options) {
        this.container = container
        this.options = { ...options }
        this.editorElement = document.createElement(options.element || 'div')
        this.editorElement.contentEditable = 'true'
        this.editorElement.innerHTML = options.content || ''
        this.render = vi.fn(() => {
            container.innerHTML = ''
            container.appendChild(this.editorElement)
        })
        this.updateConfig = vi.fn((nextOptions) => {
            this.options = { ...this.options, ...nextOptions }
            if (nextOptions.content !== undefined) {
                this.editorElement.innerHTML = nextOptions.content
            }
        })
        this.destroy = vi.fn(() => this.editorElement.remove())
        this.emitChange = (html) => {
            this.editorElement.innerHTML = html
            this.options.onChange?.(html)
        }
        rendererInstances.push(this)
    })
}))

vi.mock('../ContentWidgetEditorRenderer', () => ({
    default: vi.fn(function (container, options) {
        this.container = container
        this.options = { ...options }
        this.content = options.content || ''
        this.editorElement = document.createElement('div')
        this.editorElement.contentEditable = 'true'
        this.editorElement.innerHTML = this.content
        this.render = vi.fn(() => {
            container.innerHTML = ''
            container.appendChild(this.editorElement)
        })
        this.updateConfig = vi.fn((nextOptions) => {
            this.options = { ...this.options, ...nextOptions }
            if (nextOptions.content !== undefined) {
                this.content = nextOptions.content
                this.editorElement.innerHTML = nextOptions.content
            }
        })
        this.activate = vi.fn()
        this.deactivate = vi.fn()
        this.destroy = vi.fn(() => this.editorElement.remove())
        this.emitChange = (html) => {
            this.content = html
            this.editorElement.innerHTML = html
            this.options.onChange?.(html)
        }
        bioRendererInstances.push(this)
    })
}))

vi.mock('../../../hooks/useTheme', () => ({
    useTheme: () => ({ currentTheme: null })
}))

vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: vi.fn((componentId, callback) => {
            externalChangeCallbacks.push({ componentId, callback })
        }),
        publishUpdate: publishUpdateMock,
        getState: vi.fn(() => ({
            versions: {},
            metadata: { currentVersionId: 'version-1' }
        }))
    })
}))

vi.mock('../../../contexts/unified-data/hooks', () => ({
    useEditorContext: () => 'page'
}))

vi.mock('../../../utils/imgproxySecure', () => ({
    getImgproxyUrlFromImage: vi.fn(() => Promise.resolve('https://images.test/generated.jpg'))
}))

vi.mock('../../../components/media/OptimizedImage', () => ({
    default: props => <img {...props} />
}))

vi.mock('../../../components/media/MediaSelectModal', () => ({
    default: () => null
}))

import HeadlineWidget from '../HeadlineWidget'
import BannerWidget from '../BannerWidget'
import HeroWidget from '../HeroWidget'
import ContentCardWidget from '../ContentCardWidget'
import BioWidget from '../BioWidget'

const latestRenderer = () => rendererInstances[rendererInstances.length - 1]
const rendererAt = index => rendererInstances[index]
const latestBioRenderer = () => bioRendererInstances[bioRendererInstances.length - 1]

const stateWithWidget = (id, slotName, config) => ({
    versions: {
        'version-1': {
            widgets: {
                [slotName]: [
                    {
                        id,
                        type: 'easy_widgets.TestWidget',
                        config
                    }
                ]
            }
        }
    },
    metadata: { currentVersionId: 'version-1' }
})

describe('canonical widget update ownership', () => {
    beforeEach(() => {
        rendererInstances = []
        bioRendererInstances = []
        externalChangeCallbacks = []
        publishUpdateMock = vi.fn()
        vi.clearAllMocks()
    })

    it('HeadlineWidget emits one parent update and does not publish directly for user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <HeadlineWidget
                mode="editor"
                widgetId="headline-1"
                slotName="main"
                config={{ content: '<h1>Initial headline</h1>', headerLevel: 'h1', showBorder: true }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        await act(async () => {
            latestRenderer().emitChange('<h1>Updated headline</h1>')
        })

        expect(onConfigChange).toHaveBeenCalledOnce()
        expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            content: '<h1>Updated headline</h1>'
        }))
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('HeadlineWidget hydrates external UDC updates without echoing user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <HeadlineWidget
                mode="editor"
                widgetId="headline-1"
                slotName="main"
                config={{ content: '<h1>Initial headline</h1>', headerLevel: 'h1', showBorder: true }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        const widgetSubscription = externalChangeCallbacks.find(item => item.componentId === 'headlinewidget-headline-1')

        await act(async () => {
            widgetSubscription.callback(stateWithWidget('headline-1', 'main', {
                content: '<h1>External headline</h1>',
                headerLevel: 'h1',
                showBorder: true
            }))
        })

        expect(onConfigChange).not.toHaveBeenCalled()
        expect(publishUpdateMock).not.toHaveBeenCalled()
        expect(latestRenderer().updateConfig).toHaveBeenCalledWith(expect.objectContaining({
            content: '<h1>External headline</h1>'
        }))
    })

    it('BannerWidget emits one parent update and does not publish directly for user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <BannerWidget
                mode="editor"
                widgetId="banner-1"
                slotName="main"
                config={{ bannerMode: 'text', textContent: '<p>Initial banner</p>', headerContent: '' }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        await act(async () => {
            latestRenderer().emitChange('<p>Updated banner</p>')
        })

        expect(onConfigChange).toHaveBeenCalledOnce()
        expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            textContent: '<p>Updated banner</p>'
        }))
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('BannerWidget hydrates external UDC updates without echoing user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <BannerWidget
                mode="editor"
                widgetId="banner-1"
                slotName="main"
                config={{ bannerMode: 'text', textContent: '<p>Initial banner</p>', headerContent: '' }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        const widgetSubscription = externalChangeCallbacks.find(item => item.componentId === 'bannerwidget-banner-1')

        await act(async () => {
            widgetSubscription.callback(stateWithWidget('banner-1', 'main', {
                bannerMode: 'text',
                textContent: '<p>External banner</p>',
                headerContent: ''
            }))
        })

        expect(onConfigChange).not.toHaveBeenCalled()
        expect(publishUpdateMock).not.toHaveBeenCalled()
        expect(latestRenderer().updateConfig).toHaveBeenCalledWith(expect.objectContaining({
            content: '<p>External banner</p>'
        }))
    })

    it('HeroWidget emits one parent update and does not publish directly for user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <HeroWidget
                mode="editor"
                widgetId="hero-1"
                slotName="main"
                config={{ header: 'Initial hero', beforeText: '', afterText: '' }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        await act(async () => {
            rendererAt(0).emitChange('Updated hero')
        })

        expect(onConfigChange).toHaveBeenCalledOnce()
        expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            header: 'Updated hero'
        }))
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('HeroWidget hydrates external UDC updates without echoing user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <HeroWidget
                mode="editor"
                widgetId="hero-1"
                slotName="main"
                config={{ header: 'Initial hero', beforeText: '', afterText: '' }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        const widgetSubscription = externalChangeCallbacks.find(item => item.componentId === 'herowidget-hero-1')

        await act(async () => {
            widgetSubscription.callback(stateWithWidget('hero-1', 'main', {
                header: 'External hero',
                beforeText: '',
                afterText: ''
            }))
        })

        expect(onConfigChange).not.toHaveBeenCalled()
        expect(publishUpdateMock).not.toHaveBeenCalled()
        expect(rendererAt(0).updateConfig).toHaveBeenCalledWith(expect.objectContaining({
            content: 'External hero'
        }))
    })

    it('ContentCardWidget emits one parent update and does not publish directly for user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <ContentCardWidget
                mode="editor"
                widgetId="card-1"
                slotName="main"
                config={{ header: 'Initial card', content: '<p>Initial body</p>' }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        await act(async () => {
            rendererAt(1).emitChange('<p>Updated body</p>')
        })

        expect(onConfigChange).toHaveBeenCalledOnce()
        expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            content: '<p>Updated body</p>'
        }))
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('ContentCardWidget hydrates external UDC updates without echoing user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <ContentCardWidget
                mode="editor"
                widgetId="card-1"
                slotName="main"
                config={{ header: 'Initial card', content: '<p>Initial body</p>' }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        const widgetSubscription = externalChangeCallbacks.find(item => item.componentId === 'contentcardwidget-card-1')

        await act(async () => {
            widgetSubscription.callback(stateWithWidget('card-1', 'main', {
                header: 'External card',
                content: '<p>External body</p>'
            }))
        })

        expect(onConfigChange).not.toHaveBeenCalled()
        expect(publishUpdateMock).not.toHaveBeenCalled()
        expect(rendererAt(0).updateConfig).toHaveBeenCalledWith(expect.objectContaining({
            content: 'External card'
        }))
        expect(rendererAt(1).updateConfig).toHaveBeenCalledWith(expect.objectContaining({
            content: '<p>External body</p>'
        }))
    })

    it('BioWidget emits one parent update and does not publish directly for user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <BioWidget
                mode="editor"
                widgetId="bio-1"
                slotName="main"
                config={{ bioText: '<p>Initial bio</p>', textLayout: 'column' }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        await act(async () => {
            latestBioRenderer().emitChange('<p>Updated bio</p>')
        })

        expect(onConfigChange).toHaveBeenCalledOnce()
        expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            bioText: '<p>Updated bio</p>'
        }))
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it('BioWidget uses the latest parent update handler after parent rerenders', async () => {
        const staleOnConfigChange = vi.fn()
        const latestOnConfigChange = vi.fn()

        const { rerender } = render(
            <BioWidget
                mode="editor"
                widgetId="bio-1"
                slotName="main"
                config={{ bioText: '<p>Initial bio</p>', textLayout: 'column' }}
                onConfigChange={staleOnConfigChange}
                context={{ pageId: '101' }}
            />
        )

        await act(async () => {
            rerender(
                <BioWidget
                    mode="editor"
                    widgetId="bio-1"
                    slotName="main"
                    config={{ bioText: '<p>Initial bio</p>', textLayout: 'column' }}
                    onConfigChange={latestOnConfigChange}
                    context={{ pageId: '101' }}
                />
            )
        })

        await act(async () => {
            latestBioRenderer().emitChange('<p>Bio edit after sibling update</p>')
        })

        expect(staleOnConfigChange).not.toHaveBeenCalled()
        expect(latestOnConfigChange).toHaveBeenCalledOnce()
        expect(latestOnConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            bioText: '<p>Bio edit after sibling update</p>'
        }))
    })

    it('BioWidget hydrates external UDC updates without echoing user edits', async () => {
        const onConfigChange = vi.fn()

        render(
            <BioWidget
                mode="editor"
                widgetId="bio-1"
                slotName="main"
                config={{ bioText: '<p>Initial bio</p>', textLayout: 'column' }}
                onConfigChange={onConfigChange}
                context={{ pageId: '101' }}
            />
        )

        const widgetSubscription = externalChangeCallbacks.find(item => item.componentId === 'widget-bio-1')

        await act(async () => {
            widgetSubscription.callback(stateWithWidget('bio-1', 'main', {
                bioText: '<p>External bio</p>',
                textLayout: 'column'
            }))
        })

        expect(onConfigChange).not.toHaveBeenCalled()
        expect(publishUpdateMock).not.toHaveBeenCalled()
        expect(latestBioRenderer().updateConfig).toHaveBeenCalledWith(expect.objectContaining({
            content: '<p>External bio</p>'
        }))
    })
})
