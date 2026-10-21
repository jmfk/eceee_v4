import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let rendererInstances = []
let bioRendererInstances = []
let publishUpdateMock = vi.fn()
let externalChangeCallbacks = []
let currentTheme = null

vi.mock('../SimpleTextEditorRenderer', () => ({
    SimpleTextEditorRenderer: vi.fn(function (container, options) {
        this.container = container
        this.options = { ...options }
        this.editorElement = document.createElement(options.element || 'div')
        this.editorElement.setAttribute('contenteditable', 'true')
        this.editorElement.className = options.className || ''
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
    useTheme: () => ({ currentTheme })
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
    default: ({ src, alt, className, width, height }) => <img src={src} alt={alt} className={className} width={width} height={height} />
}))

vi.mock('../../../components/media/MediaSelectModal', () => ({
    default: ({ isOpen, onSelect, onClose, customTitle }) => isOpen && <div role="dialog" aria-label={customTitle}>
        <button onClick={() => onSelect([{ url: '/selected.jpg' }])}>Select test image</button>
        <button onClick={() => onSelect(null)}>Remove test image</button>
        <button onClick={onClose}>Close picker</button>
    </div>
}))

import HeadlineWidget from '../HeadlineWidget'
import BannerWidget from '../BannerWidget'
import HeroWidget from '../HeroWidget'
import ContentCardWidget from '../ContentCardWidget'
import BioWidget from '../BioWidget'
import HeaderWidget from '../HeaderWidget'

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
        currentTheme = null
        vi.restoreAllMocks()
        vi.clearAllMocks()
    })

    it('HeaderWidget uses the same semantic root as public rendering', () => {
        const { container } = render(<HeaderWidget />)

        expect(container.querySelector('.header-widget')).toMatchObject({ tagName: 'HEADER' })
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

    it('BannerWidget display mode preserves the canonical render class contract', () => {
        const { container } = render(
            <BannerWidget
                mode="display"
                widgetId="banner-preview"
                slotName="main"
                config={{
                    bannerMode: 'text',
                    textContent: '<p>Preview banner</p>',
                    show_border: true
                }}
                context={{ pageId: '101' }}
            />
        )

        const banner = container.querySelector('.banner-widget')
        expect(banner).toHaveClass('cms-content', 'border-enabled')
        expect(banner).not.toHaveClass('container')
    })

    it.each(['editor', 'preview'])('BannerWidget only renders the active mode image in %s mode', async (mode) => {
        // jsdom drops image-set(), so also check the CSS value React assigns.
        const backgroundAssignments = vi.spyOn(CSSStyleDeclaration.prototype, 'backgroundImage', 'set')
        const config = {
            bannerMode: 'text', textContent: '<p>Text banner</p>', headerContent: 'Header banner',
            image1: { url: '/inline.jpg' }, backgroundImage: { url: '/background.jpg' }
        }
        const { container } = render(<BannerWidget mode={mode} widgetId="banner-images" slotName="main"
            config={config} context={{ pageId: '101' }} />)

        await waitFor(() => expect(container.querySelector('.banner-image')).not.toBeNull())
        expect(container.querySelector('.banner-widget').style.backgroundImage).toBe('')
        expect(screen.queryByTitle('Edit background image')).toBeNull()

        const subscription = externalChangeCallbacks.find(item => item.componentId === 'bannerwidget-banner-images')
        await act(async () => subscription.callback(stateWithWidget('banner-images', 'main', { ...config, bannerMode: 'header' })))
        expect(container.querySelector('.banner-image')).toBeNull()
        await waitFor(() => expect(backgroundAssignments).toHaveBeenCalledWith(expect.stringContaining('generated.jpg')))
        if (mode === 'editor') expect(screen.getByTitle('Edit background image')).toBeVisible()

        await act(async () => subscription.callback(stateWithWidget('banner-images', 'main', config)))
        expect(container.querySelector('.banner-widget').style.backgroundImage).toBe('')
        expect(screen.queryByTitle('Edit background image')).toBeNull()
        await waitFor(() => expect(container.querySelector('.banner-image')).not.toBeNull())
        expect(config.image1.url).toBe('/inline.jpg')
        expect(config.backgroundImage.url).toBe('/background.jpg')
        backgroundAssignments.mockRestore()
    })

    it('BannerWidget applies image restrictions immediately when its inline mode toggle is used', async () => {
        const onConfigChange = vi.fn()
        render(<BannerWidget mode="editor" widgetId="banner-toggle" slotName="main"
            config={{ bannerMode: 'header', headerContent: 'Heading', backgroundImage: { url: '/background.jpg' } }}
            onConfigChange={onConfigChange} />)

        await waitFor(() => expect(screen.getByTitle('Edit background image')).toBeVisible())
        fireEvent.click(screen.getByTitle('Switch to Text mode'))
        expect(screen.queryByTitle('Edit background image')).toBeNull()
        expect(document.querySelector('.banner-widget').style.backgroundImage).toBe('')
        expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            bannerMode: 'text', backgroundImage: { url: '/background.jpg' }
        }))
    })

    it.each(['default', 'custom', 'passthrough'].flatMap(componentStyle =>
        ['header', 'text'].flatMap(bannerMode => [false, true].map(hasImage => ({ componentStyle, bannerMode, hasImage })))
    ))('BannerWidget keeps controls reachable for $componentStyle / $bannerMode / image=$hasImage', async ({ componentStyle, bannerMode, hasImage }) => {
        currentTheme = { componentStyles: { custom: { template: '<article>{{{content}}}</article>' }, passthrough: { template: '{{passthru}}' } } }
        render(<BannerWidget mode="editor" widgetId="banner-controls" slotName="main" config={{
            componentStyle, bannerMode, headerContent: 'Heading', textContent: 'Body',
            image1: hasImage ? { url: '/inline.jpg' } : null, backgroundImage: hasImage ? { url: '/background.jpg' } : null,
        }} />)

        const toolbar = screen.getByRole('toolbar', { name: 'Banner controls' })
        const imageButton = screen.getByTitle(bannerMode === 'header' ? 'Edit background image' : 'Edit image')
        expect(imageButton).toBeVisible()
        expect(toolbar).toContainElement(imageButton)
        expect(toolbar.closest('.banner-widget')).toBeNull()
        expect(screen.queryByTitle(bannerMode === 'header' ? 'Edit image' : 'Edit background image')).toBeNull()
        expect(Boolean(screen.queryByRole('button', { name: 'Image size: Square' }))).toBe(bannerMode === 'text')

        fireEvent.click(imageButton)
        expect(screen.getByRole('dialog')).toBeVisible()
        fireEvent.click(screen.getByRole('button', { name: 'Close picker' }))
        await act(async () => {})
    })

    it.each([false, true])('BannerWidget can change image shape with image present=%s', async (hasImage) => {
        const onConfigChange = vi.fn()
        const config = { bannerMode: 'text', textContent: 'Body', imageSize: 'square',
            image1: hasImage ? { url: '/inline.jpg' } : null, backgroundImage: { url: '/stored-background.jpg' } }
        const { container } = render(<BannerWidget mode="editor" widgetId="banner-size" slotName="main"
            config={config} onConfigChange={onConfigChange} />)

        fireEvent.click(screen.getByRole('button', { name: 'Image size: Square' }))
        expect(screen.getByRole('button', { name: 'Image size: Rectangle' })).toBeVisible()
        expect(onConfigChange).toHaveBeenLastCalledWith({ ...config, imageSize: 'rectangle' })
        if (hasImage) expect(container.querySelector('.banner-image')).toHaveAttribute('width', '280')

        fireEvent.click(screen.getByRole('button', { name: 'Image size: Rectangle' }))
        expect(onConfigChange).toHaveBeenLastCalledWith(config)
        if (hasImage) expect(container.querySelector('.banner-image')).toHaveAttribute('width', '140')
        await act(async () => {})
    })

    it('BannerWidget can select and remove a text image without losing its image button', async () => {
        const onConfigChange = vi.fn()
        const { container } = render(<BannerWidget mode="editor" widgetId="banner-select" slotName="main"
            config={{ bannerMode: 'text', textContent: 'Body' }} onConfigChange={onConfigChange} />)

        fireEvent.click(screen.getByTitle('Edit image'))
        fireEvent.click(screen.getByRole('button', { name: 'Select test image' }))
        expect(container.querySelector('.banner-image')).toHaveAttribute('src', '/selected.jpg')
        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ image1: { url: '/selected.jpg' } }))
        fireEvent.click(screen.getByTitle('Edit image'))
        fireEvent.click(screen.getByRole('button', { name: 'Remove test image' }))
        expect(container.querySelector('.banner-image')).toBeNull()
        expect(screen.getByTitle('Edit image')).toBeVisible()
        await act(async () => {})
    })

    it('BannerWidget mounts its inline editor again after switching away from custom markup', async () => {
        currentTheme = { componentStyles: { custom: { template: '<article>{{{content}}}</article>' }, passthrough: { template: '{{passthru}}' } } }
        const onConfigChange = vi.fn()
        const config = { bannerMode: 'text', textContent: 'Body', componentStyle: 'custom' }
        const { container } = render(<BannerWidget mode="editor" widgetId="banner-style" slotName="main"
            config={config} onConfigChange={onConfigChange} />)
        expect(container.querySelector('[contenteditable="true"]')).toBeNull()
        const subscription = externalChangeCallbacks.find(item => item.componentId === 'bannerwidget-banner-style')

        for (const componentStyle of ['default', 'custom', 'passthrough']) {
            await act(async () => subscription.callback(stateWithWidget('banner-style', 'main', { ...config, componentStyle })))
            expect(Boolean(container.querySelector('[contenteditable="true"]'))).toBe(componentStyle !== 'custom')
        }
        await act(async () => latestRenderer().emitChange('Updated text'))
        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ textContent: 'Updated text' }))
    })

    it.each(['text', 'header'])('BannerWidget custom styles exclude inactive image data in %s mode', async (bannerMode) => {
        currentTheme = { componentStyles: { custom: { template:
            '{{#config.backgroundImage}}<span>Background image</span>{{/config.backgroundImage}}' +
            '{{#config.image1}}<span>Inline image</span>{{/config.image1}}'
        } } }
        render(<BannerWidget config={{ bannerMode, componentStyle: 'custom', headerContent: 'Heading', textContent: 'Body',
            image1: { url: '/inline.jpg' }, backgroundImage: { url: '/background.jpg' } }}
            context={{ pageId: '101' }} />)

        expect(screen.getByText(bannerMode === 'header' ? 'Background image' : 'Inline image')).toBeVisible()
        expect(screen.queryByText(bannerMode === 'header' ? 'Inline image' : 'Background image')).toBeNull()
        await act(async () => {})
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

    it('HeroWidget uses matching semantic text elements and Designer classes in editor mode', () => {
        const { container } = render(
            <HeroWidget
                mode="editor"
                widgetId="hero-1"
                slotName="main"
                config={{ header: 'Hero title', beforeText: 'Before', afterText: 'After' }}
                onConfigChange={vi.fn()}
                context={{ pageId: '101' }}
            />
        )

        expect(container.querySelector('.hero-content > div > h1.hero-header')).toHaveTextContent('Hero title')
        expect(container.querySelector('.hero-content > div > p.hero-before-text.before-text')).toHaveTextContent('Before')
        expect(container.querySelector('.hero-content > div > p.hero-after-text.after-text')).toHaveTextContent('After')
        expect([...container.querySelectorAll('.hero-content > div')].every((wrapper) => wrapper.style.display === 'contents')).toBe(true)
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

    it('ContentCardWidget exposes its card header as a heading in editor mode', () => {
        const { container } = render(
            <ContentCardWidget
                mode="editor"
                widgetId="card-1"
                slotName="main"
                config={{ header: 'Card heading', content: '<p>Card body</p>' }}
                onConfigChange={vi.fn()}
                context={{ pageId: '101' }}
            />
        )

        expect(container.querySelector('.content-card-header')).toMatchObject({ tagName: 'H2', textContent: 'Card heading' })
        expect(container.querySelector('.content-card-header')?.parentElement?.style.display).toBe('contents')
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
        const config = { bioText: '<p>Initial bio</p>', image: null, textLayout: 'column' }
        const { rerender } = render(
            <BioWidget
                mode="editor"
                widgetId="bio-1"
                slotName="main"
                config={config}
                onConfigChange={staleOnConfigChange}
                context={{ pageId: '101' }}
            />
        )

        rerender(
            <BioWidget
                mode="editor"
                widgetId="bio-1"
                slotName="main"
                config={config}
                onConfigChange={latestOnConfigChange}
                context={{ pageId: '101' }}
            />
        )

        await act(async () => {
            latestBioRenderer().emitChange('<p>Updated bio</p>')
        })

        expect(staleOnConfigChange).not.toHaveBeenCalled()
        expect(latestOnConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            bioText: '<p>Updated bio</p>'
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


describe('inline widget controls', () => {
    beforeEach(() => {
        rendererInstances = []
        bioRendererInstances = []
        externalChangeCallbacks = []
        publishUpdateMock = vi.fn()
        currentTheme = null
        vi.restoreAllMocks()
        vi.clearAllMocks()
    })
    it.each([['Content Card', ContentCardWidget, { header: 'Header', content: '<p>Body</p>' }, 'image1'],
        ['Bio', BioWidget, { bioText: '<p>Bio</p>' }, 'image']])('%s keeps image and size actions reachable after adding and removing images', async (label, Widget, config, field) => {
        const onConfigChange = vi.fn()
        render(<Widget mode="editor" widgetId="controls" slotName="main" config={config} onConfigChange={onConfigChange} />)
        const toolbar = screen.getByRole('toolbar', { name: `${label} controls` })
        expect(toolbar).toHaveClass('absolute', 'z-10', 'opacity-0', 'pointer-events-none')
        expect(toolbar.parentElement).toHaveClass('isolate')
        expect(toolbar.className).toContain('group-focus-within/widget-controls:opacity-100')
        fireEvent.click(screen.getByRole('button', { name: 'Image', exact: true }))
        fireEvent.click(screen.getByRole('button', { name: 'Select test image' }))
        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ [field]: { url: '/selected.jpg' } }))
        fireEvent.click(screen.getByRole('button', { name: /Image size:/ }))
        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ imageSize: label === 'Bio' ? 'square' : 'rectangle' }))
        fireEvent.click(screen.getByRole('button', { name: 'Image', exact: true }))
        fireEvent.click(screen.getByRole('button', { name: 'Remove test image' }))
        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ [field]: null }))
        expect(screen.getByRole('button', { name: 'Image', exact: true })).toBeInTheDocument()
        expect(publishUpdateMock).not.toHaveBeenCalled()
    })

    it.each([['Content Card', ContentCardWidget, { header: 'Header', content: '<p>Card body</p>' }, 'header', 'Changed card'],
        ['Headline', HeadlineWidget, { content: 'Headline' }, 'content', 'Changed headline']])('%s edits replacement-style text inside the widget and restores its styled preview', async (label, Widget, config, field, updated) => {
        currentTheme = { componentStyles: { replacement: { template: '<section>{{header}} {{{content}}}</section>' } } }
        const onConfigChange = vi.fn()
        render(<Widget mode="editor" widgetId="styled" slotName="main" config={{ ...config, componentStyle: 'replacement' }} onConfigChange={onConfigChange} />)
        expect(screen.getByRole('toolbar', { name: `${label} controls` })).toBeInTheDocument()
        expect(rendererInstances.filter(instance => instance.editorElement.isConnected)).toHaveLength(0)
        fireEvent.click(screen.getByRole('button', { name: 'Edit text' }))
        const active = rendererInstances.filter(instance => instance.editorElement.isConnected)
        expect(active.length).toBeGreaterThan(0)
        act(() => active[0].emitChange(updated))
        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ [field]: updated }))
        fireEvent.click(screen.getByRole('button', { name: 'Preview style' }))
        expect(screen.getByText(new RegExp(updated))).toBeInTheDocument()
        expect(rendererInstances.filter(instance => instance.editorElement.isConnected)).toHaveLength(0)
    })

    it.each([[ContentCardWidget, { header: 'Heading', content: '<p>Body</p>' }, 2],
        [HeadlineWidget, { content: 'Heading' }, 1]])('keeps text editors mounted when a passthrough theme loads asynchronously', (Widget, fields, count) => {
        const props = { mode: 'editor', widgetId: 'loading-theme', slotName: 'main',
            config: { ...fields, componentStyle: 'passthrough' }, onConfigChange: vi.fn() }
        const { rerender } = render(<Widget {...props} />)
        expect(rendererInstances.filter(instance => instance.editorElement.isConnected)).toHaveLength(count)
        currentTheme = { componentStyles: { passthrough: { template: '{{passthru}}', css: 'color: navy;' } } }
        rerender(<Widget {...props} />)
        expect(rendererInstances.filter(instance => instance.editorElement.isConnected)).toHaveLength(count)
        const editor = rendererInstances.filter(instance => instance.editorElement.isConnected)[0]
        act(() => editor.emitChange('Edited after loading'))
        expect(props.onConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            [Widget === ContentCardWidget ? 'header' : 'content']: 'Edited after loading',
        }))
        currentTheme = null
        rerender(<Widget {...props} />)
        expect(rendererInstances.filter(instance => instance.editorElement.isConnected)).toHaveLength(count)
    })

    it('keeps Headline text editable after changing the heading level', () => {
        const props = { mode: 'editor', widgetId: 'heading-level', slotName: 'main', onConfigChange: vi.fn() }
        const { rerender } = render(<HeadlineWidget {...props} config={{ content: 'Heading', headerLevel: 'h1' }} />)
        rerender(<HeadlineWidget {...props} config={{ content: 'Heading', headerLevel: 'h2' }} />)
        const active = rendererInstances.filter(instance => instance.editorElement.isConnected)
        expect(active).toHaveLength(1)
        act(() => active[0].emitChange('Edited H2'))
        expect(props.onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ content: 'Edited H2', headerLevel: 'h2' }))
    })

    it('Bio preserves original proportions by default and cycles through all shapes', () => {
        const onConfigChange = vi.fn()
        const { container } = render(<BioWidget mode="editor" config={{ image: { url: '/portrait.jpg' }, bioText: 'Bio' }} onConfigChange={onConfigChange} />)
        expect(container.querySelector('.bio-widget--image-original')).toBeInTheDocument()
        for (const shape of ['square', 'rectangle', 'original']) {
            fireEvent.click(screen.getByRole('button', { name: /Image size:/ }))
            expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ imageSize: shape }))
            expect(container.querySelector(`.bio-widget--image-${shape}`)).toBeInTheDocument()
        }
    })

    it('Bio edits captions in the WYSIWYG', () => {
        const onConfigChange = vi.fn()
        render(<BioWidget mode="editor" config={{ image: { url: '/portrait.jpg' }, caption: 'Original' }} onConfigChange={onConfigChange} />)
        const caption = rendererInstances.find(instance => instance.options.content === 'Original')
        act(() => caption.emitChange('New caption'))
        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ caption: 'New caption' }))
    })

    it.each([[ContentCardWidget, { header: 'Header' }], [BioWidget, { bioText: '<p>Bio</p>' }], [HeadlineWidget, { content: 'Headline' }]])('keeps editing controls out of preview output', (Widget, config) => {
        render(<Widget mode="preview" config={config} />)
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    })
})
