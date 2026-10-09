import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RenderFrameRuntime from '../RenderFrameRuntime'
import { createDesignerRenderModel, createPageRenderModel } from '../adapters'

const workspace = {
    previewContent: { views: [{ id: 'page-main', layout: 'main_layout', texts: { heading: 'Overridden heading' }, images: {} }] },
    catalog: {
        layouts: [{ key: 'main_layout', slots: [{ name: 'main', label: 'Main content' }] }],
        componentStyles: [],
        designGroups: [{
            id: 'article', label: 'Article', widgetTypes: ['easy_widgets.ContentWidget'], slots: ['main'],
            parts: [{ id: 'article-body', part: 'content-widget', label: 'Body' }],
            elements: [{ id: 'heading', element: 'h1', label: 'Heading' }],
            assetKeys: [],
        }],
    },
    assets: [],
    typography: [{ targetId: 'article-body', values: { fontSize: '16px' } }],
    spacing: [{ targetId: 'heading', values: { marginTop: '10px', marginBottom: '30px', paddingLeft: '8px' } }],
    constraints: { editableTypographyProperties: ['fontSize'], editableSpacingProperties: ['marginTop', 'marginBottom', 'paddingLeft'] },
}

const sendModel = (model: ReturnType<typeof createDesignerRenderModel>) => act(() => {
    window.dispatchEvent(new MessageEvent('message', {
        source: window,
        data: { source: 'eceee-render-host', action: 'render', model },
    }))
})

describe('RenderFrameRuntime navigation', () => {
    it('rewrites and forwards internal standalone-preview navigation', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createPageRenderModel({
            widgets: { main: [{
                id: 'nav',
                type: 'easy_widgets.NavigationWidget',
                config: { menuItems: [{ label: 'Publication ethics', url: '/for-authors/publication-ethics/' }] },
            }] },
            context: {
                renderRoutePrefix: '/_render/85',
                simulatedPath: '/for-authors/review-process/',
                siteHostnames: ['summerstudy.localhost'],
            },
        }))

        const link = await screen.findByRole('link', { name: 'Publication ethics' })
        expect(link).toHaveAttribute('href', '/_render/85/for-authors/publication-ethics/')
        fireEvent.click(link)
        expect(postMessage).toHaveBeenCalledWith({
            source: 'eceee-render-frame',
            action: 'navigate',
            href: '/_render/85/for-authors/publication-ethics/',
        }, '*')
        postMessage.mockRestore()
    })

    it('continues to block links in editor and designer previews', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createPageRenderModel({
            widgets: { main: [{
                id: 'nav',
                type: 'easy_widgets.NavigationWidget',
                config: { menuItems: [{ label: 'Blocked', url: '/blocked/' }] },
            }] },
        }))

        const link = await screen.findByRole('link', { name: 'Blocked' })
        const click = new MouseEvent('click', { bubbles: true, cancelable: true })
        link.dispatchEvent(click)
        expect(click.defaultPrevented).toBe(true)
    })
})

describe('RenderFrameRuntime designer overlay', () => {
    it('adds labels, live dimensions, and layout-canvas chrome to theme layout nodes', async () => {
        const renderModel = createPageRenderModel({
            layout: 'main_layout',
            layoutDefinitionRequired: true,
            layoutDefinition: {
                id: '8ac4db5a-492f-4977-bf00-d21b8d72f08e',
                key: 'main_layout',
                label: 'Main layout',
                description: '',
                status: 'active',
                slots: { main: { label: 'Main content' } },
                root: {
                    id: '2d1ee676-3624-4ec8-aaf4-8874bea037f4',
                    type: 'container',
                    children: [{
                        id: '114eff0f-f86f-4a10-8df5-27925804fc73',
                        type: 'slot',
                        slot_key: 'main',
                        editable_parameters: ['gap'],
                        children: [],
                        styles: {},
                    }],
                    styles: { base: { width: '100%' } },
                },
            },
        })
        renderModel.designer = {
            catalog: {
                layouts: [{
                    key: 'main_layout',
                    slots: [{ name: 'main', label: 'Main content', editableSpacingProperties: ['gap'] }],
                }],
            },
            texts: {}, assets: [], guidesEnabled: true, layoutCanvas: true,
        }
        const postMessage = vi.spyOn(window, 'postMessage')

        const { container } = render(<RenderFrameRuntime />)
        sendModel(renderModel)

        const preview = await waitFor(() => container.querySelector('.layout-designer-preview'))
        const slot = container.querySelector<HTMLElement>('[data-layout-node-type="slot"]')
        expect(preview).toBeInTheDocument()
        expect(slot).toHaveAttribute('data-layout-node-label', 'Main content')
        await waitFor(() => expect(slot?.dataset.layoutNodeSize).toMatch(/^\d+ × \d+$/))

        fireEvent.click(slot!)
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'select',
            targetId: 'layout:main_layout:slot:main',
            kind: 'layoutSlot',
            layoutNodeId: '114eff0f-f86f-4a10-8df5-27925804fc73',
            editableParameters: ['gap'],
        }), '*')
        postMessage.mockRestore()
    })

    it('keeps saved positional text IDs stable when semantic targets are added', async () => {
        const sourceModel = createPageRenderModel({
            widgets: { main: [
                {
                    id: 'card',
                    type: 'easy_widgets.ContentCardWidget',
                    config: { header: 'New semantic target' },
                },
                {
                    id: 'hero',
                    type: 'easy_widgets.HeroWidget',
                    config: { header: 'Existing editable heading' },
                },
            ] },
        })
        const renderModel = createDesignerRenderModel({ workspace, sourceModel, contentEditable: true })
        renderModel.designer!.texts = { 'content:0': 'Saved heading text' }

        render(<RenderFrameRuntime />)
        sendModel(renderModel)

        const existingHeading = await screen.findByRole('heading', { name: 'Saved heading text' })
        const addedHeading = screen.getByRole('heading', { name: 'New semantic target' })
        expect(existingHeading).toHaveAttribute('data-designer-target', 'content:0')
        expect(addedHeading).toHaveAttribute('data-designer-target', 'content:1')
    })

    it('exposes image captions as editable Designer targets', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        const sourceModel = createPageRenderModel({
            widgets: { main: [{
                id: 'captioned-image',
                type: 'easy_widgets.ImageWidget',
                config: { image: { src: '/image.jpg', altText: 'Example' }, caption: 'Editable caption' },
            }] },
        })
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, sourceModel, contentEditable: true }))

        const caption = await screen.findByText('Editable caption')
        await waitFor(() => expect(caption).toHaveAttribute('data-designer-target'))
        fireEvent.click(caption)

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'select',
            label: 'Image caption',
        }), '*')
        postMessage.mockRestore()
    })

    it('binds read-only catalog targets to rendered DOM while keeping editor chrome out', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main', themeCss: '.content-widget{color:rgb(1,2,3)}' }))

        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        await waitFor(() => expect(heading).toHaveAttribute('data-designer-target', 'heading'))
        expect((heading as HTMLElement).contentEditable).not.toBe('true')
        expect(heading).toHaveAttribute('data-designer-target', 'heading')
        expect(document.querySelector('[data-designer-targets*="article"]')).toBeTruthy()
        expect(document.querySelector('[data-designer-target="layout:main_layout:slot:main"]')).toBeTruthy()
        expect(document.querySelector('.page-editor-widget,.widget-header')).toBeNull()
        expect([...document.querySelectorAll('style')].some((style) => style.textContent?.includes('rgb(1,2,3)'))).toBe(true)
    })

    it('exposes global text targets inside a structural slot for read-only content', async () => {
        const globalWorkspace = structuredClone(workspace)
        globalWorkspace.catalog.designGroups = [{
            id: 'global-type', label: 'Global typography', widgetTypes: [], slots: [], parts: [], assetKeys: [],
            elements: [{ id: 'global-heading', element: 'h1', label: 'Heading 1' }],
        }]
        globalWorkspace.catalog.layouts[0].slots = [
            { name: 'hero', label: 'Hero' },
            { name: 'main', label: 'Main content' },
        ]
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: {
                hero: [{ id: 'hero', type: 'easy_widgets.HeroWidget', config: { header: 'Selectable hero heading' } }],
                main: [],
            },
        })
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        const renderModel = createDesignerRenderModel({
            workspace: globalWorkspace,
            viewId: 'page-main',
            sourceModel,
            contentEditable: false,
        })
        sendModel(renderModel)

        const heading = await screen.findByRole('heading', { name: 'Selectable hero heading' })
        await waitFor(() => expect(heading).toHaveAttribute('data-designer-target', 'global-heading'))
        const heroSlot = heading.closest('.slot-hero') as HTMLElement
        fireEvent.click(heroSlot)

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'select',
            targetId: 'layout:main_layout:slot:hero',
            descendants: expect.arrayContaining([expect.objectContaining({
                id: 'global-heading',
                label: 'Heading 1',
                displayLabel: 'Heading 1: “Selectable hero heading”',
                parentId: 'widget:hero',
                depth: 2,
            })]),
        }), '*'))

        postMessage.mockClear()
        fireEvent.click(heading)
        expect(heading).toHaveClass('designer-selected')
        expect(heroSlot).not.toHaveClass('designer-selected')
        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'select',
            targetId: 'global-heading',
        }), '*'))

        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-render-host', action: 'highlightTarget', targetId: 'global-heading', active: true },
            source: window.parent,
        }))
        expect(heading).toHaveClass('designer-selected', 'designer-highlighted')
        expect(getComputedStyle(heading).outline).toBe('3px solid #2563eb')

        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-render-host', action: 'highlightTarget', targetId: 'global-heading', active: false },
            source: window.parent,
        }))
        expect(heading).toHaveClass('designer-selected')
        expect(heading).not.toHaveClass('designer-highlighted')

        sendModel({ ...renderModel })
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Selectable hero heading' })).toHaveClass('designer-selected'))
        postMessage.mockRestore()
    })

    it('flattens declared internal widget parts into the widget selection level', async () => {
        const structuralWorkspace = structuredClone(workspace)
        structuralWorkspace.catalog.designGroups = []
        structuralWorkspace.catalog.widgetParts = [{
            widgetType: 'easy_widgets.HeroWidget',
            label: 'Hero',
            parts: [
                { id: 'widget-part:easy_widgets.HeroWidget:hero-widget', part: 'hero-widget', label: 'Hero background', designerLevel: 'widget' },
                { id: 'widget-part:easy_widgets.HeroWidget:hero-content', part: 'hero-content', label: 'Hero content area', designerLevel: 'widget' },
            ],
        }]
        structuralWorkspace.spacing = [{
            targetId: 'widget-part:easy_widgets.HeroWidget:hero-content', scope: 'widgetPart',
            widgetType: 'easy_widgets.HeroWidget', part: 'hero-content', values: { paddingTop: '30px' },
        }]
        structuralWorkspace.constraints.editableSpacingProperties = ['paddingTop']
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: {
                main: [{ id: 'hero-1', type: 'easy_widgets.HeroWidget', config: { header: 'Structural hero' } }],
            },
        })
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        const renderModel = createDesignerRenderModel({ workspace: structuralWorkspace, sourceModel, contentEditable: false })
        expect(renderModel.designer?.editableSpacingTargets?.['widget-part:easy_widgets.HeroWidget:hero-content']).toContain('paddingTop')
        sendModel(renderModel)

        const heading = await screen.findByRole('heading', { name: 'Structural hero' })
        const content = heading.closest('.hero-content') as HTMLElement
        await waitFor(() => expect(content).toHaveAttribute('data-designer-target', 'widget-part:easy_widgets.HeroWidget:hero-content'))
        content.style.paddingTop = '30px'
        vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({
            x: 40, y: 40, left: 40, top: 40, right: 440, bottom: 240, width: 400, height: 200,
            toJSON: () => ({}),
        })
        fireEvent.click(content)

        expect(content).toHaveClass('designer-selected-widget')
        expect(content).not.toHaveClass('designer-selected-element')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'select',
            kind: 'part',
            selectionPaths: expect.objectContaining({
                widget: expect.arrayContaining([
                    expect.objectContaining({ id: 'widget-part:easy_widgets.HeroWidget:hero-content' }),
                ]),
                element: [],
            }),
        }), '*')
        fireEvent.click(screen.getByRole('button', { name: 'Edit padding top' }))
        fireEvent.input(screen.getByLabelText('padding top value'), { target: { value: '34px' } })
        expect(content).toHaveStyle({ paddingTop: '34px' })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'spacingChange', property: 'paddingTop', value: '34px',
            targetIds: expect.arrayContaining(['widget-part:easy_widgets.HeroWidget:hero-content']),
        }), '*')
        postMessage.mockRestore()
    })

    it('uses a semantic widget element instead of a generic theme element when both match', async () => {
        const semanticWorkspace = structuredClone(workspace)
        semanticWorkspace.catalog.designGroups = [{
            id: 'hero-group', label: 'Hero group', widgetTypes: ['easy_widgets.HeroWidget'], slots: ['main'],
            parts: [], elements: [{ id: 'generic-heading', element: 'h1', label: 'Heading 1' }], assetKeys: [],
        }]
        semanticWorkspace.catalog.widgetParts = [{
            widgetType: 'easy_widgets.HeroWidget', label: 'Hero',
            parts: [{
                id: 'widget-part:easy_widgets.HeroWidget:hero-header', part: 'hero-header',
                label: 'Hero header (h1)', designerLevel: 'element',
            }],
        }]
        semanticWorkspace.constraints.editableSpacingProperties = ['marginTop', 'marginBottom']
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: { main: [{ id: 'hero-1', type: 'easy_widgets.HeroWidget', config: { header: 'Semantic hero' } }] },
        })
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        const renderModel = createDesignerRenderModel({ workspace: semanticWorkspace, sourceModel, contentEditable: false })
        expect(renderModel.designer?.editableSpacingTargets?.['widget-part:easy_widgets.HeroWidget:hero-header'])
            .toBeUndefined()
        sendModel(renderModel)

        const heading = await screen.findByRole('heading', { name: 'Semantic hero' })
        heading.style.marginTop = '16px'
        heading.style.marginBottom = '16px'
        fireEvent.click(heading)

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'select',
            targetId: 'widget-part:easy_widgets.HeroWidget:hero-header',
            styleTargetId: 'widget-part:easy_widgets.HeroWidget:hero-header',
            kind: 'element',
            computedStyles: expect.objectContaining({ marginTop: '16px', marginBottom: '16px' }),
            alternatives: expect.arrayContaining([expect.objectContaining({ id: 'generic-heading' })]),
        }), '*')
        postMessage.mockRestore()
    })

    it('maps a header widget to the design group for its widget type and slot', async () => {
        const headerWorkspace = structuredClone(workspace)
        headerWorkspace.catalog.designGroups = [{
            id: 'wrong-header', label: 'Header elsewhere', widgetTypes: ['easy_widgets.HeaderWidget'], slots: ['footer'],
            parts: [{ id: 'wrong-header-part', part: 'header-widget', label: 'Wrong header' }], elements: [], assetKeys: [],
        }, {
            id: 'header-group', label: 'Page header', widgetTypes: ['easy_widgets.HeaderWidget'], slots: ['header'],
            parts: [{ id: 'header-container', part: 'header-widget', label: 'Header container' }], elements: [], assetKeys: [],
        }]
        headerWorkspace.spacing = [{ targetId: 'header-container', values: { paddingTop: '12px' } }]
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: { header: [{ id: 'header-1', type: 'easy_widgets.HeaderWidget', config: {} }] },
        })
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: headerWorkspace, sourceModel, contentEditable: false }))

        const header = document.querySelector('.header-widget') as HTMLElement
        await waitFor(() => expect(header).toHaveAttribute('data-designer-target', 'header-container'))
        fireEvent.click(header)

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'select', targetId: 'header-container',
            label: 'Header container', kind: 'part', widgetType: 'easy_widgets.HeaderWidget',
        }), '*')
        postMessage.mockRestore()
    })

    it.each([
        {
            widgetType: 'easy_widgets.TwoColumnsWidget', part: 'two-columns-widget',
            label: 'Two Columns container', slotNames: ['left', 'right'], cssClass: '.two-columns-widget',
        },
        {
            widgetType: 'easy_widgets.ThreeColumnsWidget', part: 'three-columns-widget',
            label: 'Three Columns container', slotNames: ['left', 'center', 'right'], cssClass: '.three-columns-widget',
        },
    ])('shows $label slots and makes its declared gap editable before an override exists', async ({ widgetType, part, label, slotNames, cssClass }) => {
        const columnWorkspace = structuredClone(workspace)
        columnWorkspace.catalog.designGroups = [{
            id: 'columns-group', label: 'Columns', widgetTypes: [widgetType], slots: ['main'],
            parts: [{
                id: 'columns-container', part, label,
                editableSpacingProperties: ['gap'],
            }],
            elements: [], assetKeys: [],
        }]
        columnWorkspace.spacing = []
        columnWorkspace.constraints.editableSpacingProperties = ['gap']
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: { main: [{
                id: 'columns-1', type: widgetType,
                config: { slots: Object.fromEntries(slotNames.map((name) => [name, []])) },
            }] },
        })
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: columnWorkspace, sourceModel, contentEditable: false }))

        const columns = document.querySelector(cssClass) as HTMLElement
        await waitFor(() => expect(columns).toHaveAttribute('data-designer-target', 'columns-container'))
        const widgetRoot = columns.closest<HTMLElement>('[data-widget-id]') as HTMLElement
        const slots = [...columns.querySelectorAll<HTMLElement>(':scope > [data-slot]')]
        const rect = (x: number, y: number, width: number, height: number) => ({
            x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}),
        })
        vi.spyOn(widgetRoot, 'getBoundingClientRect').mockReturnValue(rect(10, 10, 430, 160))
        vi.spyOn(columns, 'getBoundingClientRect').mockReturnValue(rect(10, 10, 430, 160))
        const slotWidth = slotNames.length === 2 ? 200 : 120
        slots.forEach((slot, index) => vi.spyOn(slot, 'getBoundingClientRect').mockReturnValue(
            rect(10 + index * (slotWidth + 30), 10, slotWidth, 160),
        ))
        columns.style.gap = '30px'
        fireEvent.click(widgetRoot)
        expect(widgetRoot).toHaveClass('designer-selected-widget')
        expect(document.querySelectorAll('.designer-column-slot-guide')).toHaveLength(slotNames.length)
        const gapLabel = [...document.querySelectorAll('.designer-spacing-gap-value')]
            .find((label) => label.textContent === '30px') as HTMLElement
        expect(gapLabel).toHaveClass('designer-spacing-level-widget')
        expect(gapLabel).toHaveAttribute('data-editable', 'true')
        fireEvent.click(gapLabel)
        fireEvent.input(screen.getByLabelText('column gap value'), { target: { value: '36px' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'spacingChange', targetId: 'columns-container',
            property: 'gap', value: '36px',
        }), '*')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'select', targetId: 'widget:columns-1',
            configurationSpacingTargets: [expect.objectContaining({
                id: 'columns-container', computedStyles: expect.objectContaining({ gap: '30px' }),
            })],
        }), '*')
        postMessage.mockRestore()
    })

    it('makes banner content selectable as an element even when the theme has no design group for it', async () => {
        const bannerWorkspace = structuredClone(workspace)
        bannerWorkspace.catalog.designGroups = []
        bannerWorkspace.catalog.widgetParts = [{
            widgetType: 'easy_widgets.BannerWidget', label: 'Banner',
            parts: [{
                id: 'widget-part:easy_widgets.BannerWidget:banner-text', part: 'banner-text',
                label: 'Banner content', designerLevel: 'element',
            }],
        }]
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: {
                main: [{
                    id: 'banner-1',
                    type: 'easy_widgets.BannerWidget',
                    config: { bannerMode: 'text', textContent: '<p>Selectable banner</p>' },
                }],
            },
        })
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({
            workspace: bannerWorkspace,
            viewId: 'page-main',
            sourceModel,
            contentEditable: false,
        }))

        const bannerText = await screen.findByText('Selectable banner')
        const bannerWidget = bannerText.closest('[data-widget-id="banner-1"]') as HTMLElement
        const bannerContent = bannerText.closest('.banner-text') as HTMLElement
        await waitFor(() => expect(bannerWidget).toHaveAttribute('data-designer-target', 'widget:banner-1'))
        expect(bannerContent).toHaveAttribute('data-designer-target', 'widget-part:easy_widgets.BannerWidget:banner-text')
        expect(bannerWidget).not.toHaveClass('designer-selected', 'designer-highlighted')
        expect(getComputedStyle(bannerWidget).outlineStyle).not.toBe('dashed')
        fireEvent.click(bannerText)

        expect(bannerWidget).toHaveClass('designer-selected-widget')
        expect(bannerContent).toHaveClass('designer-selected-element')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'select',
            targetId: 'widget-part:easy_widgets.BannerWidget:banner-text',
            kind: 'element',
            label: 'Banner content',
            widgetId: 'banner-1',
            widgetType: 'easy_widgets.BannerWidget',
        }), '*')
        postMessage.mockRestore()
    })

    it('scopes repeated design targets to the requested widget instance', async () => {
        const repeatedWorkspace = structuredClone(workspace)
        repeatedWorkspace.catalog.designGroups[0].elements = [{ id: 'paragraph', element: 'p', label: 'Paragraph' }]
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: {
                main: [
                    { id: 'first-content', type: 'easy_widgets.ContentWidget', config: { content: '<p>First copy</p>' } },
                    { id: 'second-content', type: 'easy_widgets.ContentWidget', config: { content: '<p>Second copy</p>' } },
                ],
            },
        })
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        const renderModel = createDesignerRenderModel({
            workspace: repeatedWorkspace,
            viewId: 'page-main',
            sourceModel,
            contentEditable: false,
        })
        sendModel(renderModel)

        const firstParagraph = await screen.findByText('First copy')
        const secondParagraph = await screen.findByText('Second copy')
        await waitFor(() => {
            expect(firstParagraph).toHaveAttribute('data-designer-target', 'paragraph')
            expect(secondParagraph).toHaveAttribute('data-designer-target', 'paragraph')
        })

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-render-host', action: 'selectTarget',
                targetId: 'paragraph', widgetId: 'second-content',
            },
            source: window.parent,
        }))
        expect(secondParagraph).toHaveClass('designer-selected')
        expect(firstParagraph).not.toHaveClass('designer-selected')
        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'select',
            targetId: 'paragraph', widgetId: 'second-content',
        }), '*'))

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-render-host', action: 'highlightTarget',
                targetId: 'paragraph', widgetId: 'first-content', active: true,
            },
            source: window.parent,
        }))
        expect(firstParagraph).toHaveClass('designer-highlighted')
        expect(secondParagraph).toHaveClass('designer-selected')

        sendModel({ ...renderModel })
        await waitFor(() => {
            expect(screen.getByText('First copy')).toHaveClass('designer-highlighted')
            expect(screen.getByText('Second copy')).toHaveClass('designer-selected')
        })

        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-render-host', action: 'clearTarget' },
            source: window.parent,
        }))
        expect(screen.getByText('First copy')).not.toHaveClass('designer-highlighted')
        expect(screen.getByText('Second copy')).not.toHaveClass('designer-selected')

        fireEvent.click(screen.getByText('First copy'))
        expect(screen.getByText('First copy')).toHaveClass('designer-selected')
        sendModel({ ...renderModel })
        await waitFor(() => {
            expect(screen.getByText('First copy')).not.toHaveClass('designer-highlighted')
            expect(screen.getByText('First copy')).toHaveClass('designer-selected')
        })
        postMessage.mockRestore()
    })

    it('scopes repeated design targets to the requested DOM instance inside one widget', async () => {
        const repeatedWorkspace = structuredClone(workspace)
        repeatedWorkspace.catalog.designGroups[0].elements = [{ id: 'paragraph', element: 'p', label: 'Paragraph' }]
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: {
                main: [{
                    id: 'content-1',
                    type: 'easy_widgets.ContentWidget',
                    config: { content: '<p>First paragraph</p><p>Second paragraph</p>' },
                }],
            },
        })
        render(<RenderFrameRuntime />)
        const renderModel = createDesignerRenderModel({
            workspace: repeatedWorkspace,
            viewId: 'page-main',
            sourceModel,
            contentEditable: false,
        })
        sendModel(renderModel)

        const firstParagraph = await screen.findByText('First paragraph')
        const secondParagraph = await screen.findByText('Second paragraph')
        await waitFor(() => expect(secondParagraph).toHaveAttribute('data-designer-instance'))
        const secondInstanceId = secondParagraph.getAttribute('data-designer-instance') || ''

        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-render-host', action: 'selectTarget',
                targetId: 'paragraph', widgetId: 'content-1', targetInstanceId: secondInstanceId,
            },
            source: window.parent,
        }))

        expect(secondParagraph).toHaveClass('designer-selected')
        expect(firstParagraph).not.toHaveClass('designer-selected')

        sendModel({ ...renderModel })
        await waitFor(() => {
            expect(screen.getByText('Second paragraph')).toHaveClass('designer-selected')
            expect(screen.getByText('First paragraph')).not.toHaveClass('designer-selected')
        })
    })

    it('selects the nearest slot, widget, and element while preserving their nested paths', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        const structuralWorkspace = structuredClone(workspace)
        structuralWorkspace.constraints.editableSpacingProperties.push('paddingTop')
        ;(structuralWorkspace.catalog as any).widgetSlots = [{
            widgetType: 'easy_widgets.TwoColumnsWidget',
            slots: [{ name: 'left', editableSpacingProperties: ['paddingTop'] }],
        }]
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: {
                main: [{
                    id: 'columns-1',
                    type: 'easy_widgets.TwoColumnsWidget',
                    config: {
                        slots: {
                            left: [{ id: 'headline-1', type: 'easy_widgets.HeadlineWidget', config: { content: 'Nested heading', level: 3 } }],
                            right: [],
                        },
                    },
                }],
            },
        })
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: structuralWorkspace, viewId: 'page-main', sourceModel, contentEditable: true }))

        const heading = await screen.findByRole('heading', { name: 'Nested heading' })
        const nestedWidget = heading.closest('[data-widget-id="headline-1"]') as HTMLElement
        const columnsWidget = heading.closest('[data-widget-id="columns-1"]') as HTMLElement
        const nestedSlot = heading.closest('[data-slot="left"]') as HTMLElement
        const layoutSlot = heading.closest('[data-slot-name="main"]') as HTMLElement
        const selectedElement = heading.querySelector('[data-designer-kind="element"]') as HTMLElement
        await waitFor(() => expect(nestedSlot).toHaveAttribute('data-designer-target', 'slot:columns-1:left'))
        expect(nestedSlot).toHaveAttribute('data-widget-slot', 'left')
        expect(nestedSlot).toHaveAttribute('data-owner-widget-type', 'easy_widgets.TwoColumnsWidget')
        expect(selectedElement).toBeInTheDocument()

        nestedSlot.style.paddingTop = '11px'
        nestedWidget.style.marginLeft = '12px'
        columnsWidget.style.marginRight = '14px'
        selectedElement.style.paddingBottom = '13px'
        const rect = (left: number, top: number, width: number, height: number) => ({
            x: left, y: top, left, top, right: left + width, bottom: top + height, width, height,
            toJSON: () => ({}),
        })
        vi.spyOn(nestedSlot, 'getBoundingClientRect').mockReturnValue(rect(10, 10, 500, 300))
        vi.spyOn(nestedWidget, 'getBoundingClientRect').mockReturnValue(rect(40, 50, 400, 200))
        vi.spyOn(columnsWidget, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 600, 400))
        vi.spyOn(selectedElement, 'getBoundingClientRect').mockReturnValue(rect(80, 90, 300, 80))

        fireEvent.click(selectedElement)

        expect(layoutSlot).not.toHaveClass('designer-selected-slot')
        expect(nestedSlot).toHaveClass('designer-selected-slot')
        expect(columnsWidget).not.toHaveClass('designer-selected-widget')
        expect(nestedWidget).toHaveClass('designer-selected-widget')
        expect(selectedElement).toHaveClass('designer-selected-element')
        const spacingLabel = (selector: string, value: string) => [...document.querySelectorAll(selector)]
            .find((label) => label.textContent === value)
        const slotPaddingLabel = spacingLabel('.designer-spacing-padding-value[data-side="top"]', '11px')
        expect(slotPaddingLabel).toHaveClass('designer-spacing-level-slot')
        expect(slotPaddingLabel).toHaveAttribute('data-editable', 'true')
        expect(spacingLabel('.designer-spacing-margin-value[data-side="left"]', '12px')).toHaveClass('designer-spacing-level-widget')
        expect(spacingLabel('.designer-spacing-padding-value[data-side="bottom"]', '13px')).toHaveClass('designer-spacing-level-element')
        expect(document.querySelector('.designer-spacing-content.designer-spacing-level-slot')).toHaveStyle({ left: '10px' })
        expect(document.querySelector('.designer-spacing-content.designer-spacing-level-widget')).toHaveStyle({ left: '43px' })
        expect(document.querySelector('.designer-spacing-content.designer-spacing-level-element')).toHaveStyle({ left: '81px' })

        fireEvent.click(slotPaddingLabel!)
        fireEvent.input(screen.getByLabelText('padding top value'), { target: { value: '18px' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'spacingChange', property: 'paddingTop', value: '18px',
            targetId: 'widget-slot:easy_widgets.TwoColumnsWidget:left',
            targetIds: expect.arrayContaining(['widget-slot:easy_widgets.TwoColumnsWidget:left']),
        }), '*')

        fireEvent.click(nestedWidget)
        expect(selectedElement).not.toHaveClass('designer-selected-element')
        expect(spacingLabel('.designer-spacing-padding-value[data-side="bottom"]', '13px')).toBeUndefined()
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            selectionPaths: {
                slot: [
                    expect.objectContaining({ id: 'layout:main_layout:slot:main', kind: 'layoutSlot', computedStyles: expect.objectContaining({ paddingTop: expect.any(String) }) }),
                    expect.objectContaining({ id: 'slot:columns-1:left', styleTargetId: 'widget-slot:easy_widgets.TwoColumnsWidget:left', kind: 'slot', computedStyles: expect.objectContaining({ marginLeft: expect.any(String) }) }),
                ],
                widget: [
                    expect.objectContaining({ id: 'widget:columns-1', kind: 'widget' }),
                    expect.objectContaining({ id: 'widget:headline-1', kind: 'widget' }),
                ],
                element: [expect.objectContaining({ kind: 'element' })],
            },
        }), '*')

        const elementTargetId = JSON.parse(selectedElement.dataset.designerTargets || '[]')[0].id
        fireEvent(window, new MessageEvent('message', {
            data: {
                source: 'eceee-render-host', action: 'selectTarget', targetId: 'widget:columns-1',
                selectionLevel: 'widget',
                selectedTargets: [
                    { targetId: 'slot:columns-1:left', widgetId: 'columns-1', selectionLevel: 'slot' },
                    { targetId: 'widget:columns-1', widgetId: 'columns-1', selectionLevel: 'widget' },
                    { targetId: elementTargetId, widgetId: 'headline-1', selectionLevel: 'element' },
                ],
            },
            source: window.parent,
        }))
        expect(nestedSlot).toHaveClass('designer-selected-slot')
        expect(columnsWidget).toHaveClass('designer-selected-widget')
        expect(selectedElement).toHaveClass('designer-selected-element')
        expect(spacingLabel('.designer-spacing-padding-value[data-side="top"]', '18px')).toHaveClass('designer-spacing-level-slot')
        expect(spacingLabel('.designer-spacing-margin-value[data-side="right"]', '14px')).toHaveClass('designer-spacing-level-widget')
        expect(spacingLabel('.designer-spacing-padding-value[data-side="bottom"]', '13px')).toHaveClass('designer-spacing-level-element')

        postMessage.mockRestore()
    })

    it('applies a design group only to widgets in the configured layout slots', async () => {
        const slottedWorkspace = structuredClone(workspace)
        slottedWorkspace.catalog.layouts[0].slots = [
            { name: 'main', label: 'Main content' },
            { name: 'footer', label: 'Footer' },
        ]
        slottedWorkspace.catalog.designGroups = [{
            id: 'footer-content', label: 'Content · Footer',
            widgetTypes: ['easy_widgets.ContentWidget'], slots: ['footer'],
            parts: [], elements: [], assetKeys: [],
        }]
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: {
                main: [{ id: 'main-content', type: 'easy_widgets.ContentWidget', config: { content: '<p>Main copy</p>' } }],
                footer: [{ id: 'footer-content', type: 'easy_widgets.ContentWidget', config: { content: '<p>Footer copy</p>' } }],
            },
        })
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: slottedWorkspace, viewId: 'page-main', sourceModel }))

        const mainWidget = (await screen.findByText('Main copy')).closest('[data-widget-id="main-content"]') as HTMLElement
        const footerWidget = (await screen.findByText('Footer copy')).closest('[data-widget-id="footer-content"]') as HTMLElement
        await waitFor(() => expect(footerWidget.dataset.designerTargets).toContain('footer-content'))

        expect(JSON.parse(mainWidget.dataset.designerTargets || '[]')).toEqual([
            expect.objectContaining({ id: 'widget:main-content', kind: 'widget' }),
        ])
        expect(JSON.parse(footerWidget.dataset.designerTargets || '[]')).toEqual([
            expect.objectContaining({ id: 'widget:footer-content', kind: 'widget' }),
            expect.objectContaining({ id: 'footer-content', kind: 'group' }),
        ])
    })

    it('keeps slot-only design group elements inside their configured slots', async () => {
        const slottedWorkspace = structuredClone(workspace)
        slottedWorkspace.catalog.layouts[0].slots = [
            { name: 'main', label: 'Main content' },
            { name: 'footer', label: 'Footer' },
        ]
        slottedWorkspace.catalog.designGroups = [{
            id: 'footer-text', label: 'Footer text',
            widgetTypes: [], slots: ['footer'],
            parts: [], elements: [{ id: 'footer-paragraph', element: 'p', label: 'Footer paragraph' }], assetKeys: [],
        }]
        const sourceModel = createPageRenderModel({
            layout: 'main_layout',
            widgets: {
                main: [{ id: 'main-content', type: 'easy_widgets.ContentWidget', config: { content: '<p>Main copy</p>' } }],
                footer: [{ id: 'footer-content', type: 'easy_widgets.ContentWidget', config: { content: '<p>Footer copy</p>' } }],
            },
        })
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: slottedWorkspace, viewId: 'page-main', sourceModel }))

        const mainParagraph = await screen.findByText('Main copy')
        const footerParagraph = await screen.findByText('Footer copy')
        await waitFor(() => expect(footerParagraph.dataset.designerTargets).toContain('footer-paragraph'))

        expect(mainParagraph).not.toHaveAttribute('data-designer-targets')
        expect(footerParagraph.dataset.designerTargets).toContain('footer-paragraph')
    })

    it('edits a rich text field as one sanitized HTML value after double-click', async () => {
        const editableWorkspace = structuredClone(workspace)
        editableWorkspace.previewContent.views[0].texts = { 'content:0': '<h1>Saved example heading</h1>' }
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: editableWorkspace, viewId: 'page-main', contentEditable: true }))

        const heading = await screen.findByRole('heading', { name: 'Saved example heading' })
        const richText = heading.closest('.content-widget') as HTMLElement
        expect(richText).toHaveAttribute('data-designer-target', 'content:0')
        expect(richText.contentEditable).not.toBe('true')
        fireEvent.doubleClick(heading)
        expect(richText.contentEditable).toBe('true')
        heading.textContent = 'Changed example heading'
        fireEvent.input(richText)

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'contentChange',
            targetId: 'content:0',
            label: 'Rich text',
            editable: true,
            richText: true,
            selectionPaths: expect.objectContaining({
                widget: expect.arrayContaining([expect.objectContaining({ id: 'article-body', kind: 'part' })]),
            }),
        }), '*'))

        act(() => window.dispatchEvent(new MessageEvent('message', {
            source: window,
            data: { source: 'eceee-render-host', action: 'updateText', targetId: 'content:0', text: '<h2>Inspector update</h2>' },
        })))
        expect(richText.querySelector('h2')).toHaveTextContent('Inspector update')
        postMessage.mockRestore()
    })

    it('opens element actions at the pointer and starts inline text editing', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main', contentEditable: true }))

        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        const richText = heading.closest('.content-widget') as HTMLElement
        const focus = vi.spyOn(richText, 'focus')
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-render-host', action: 'highlightTarget', targetId: 'heading', active: true },
            source: window.parent,
        }))
        expect(heading).toHaveClass('designer-highlighted')
        fireEvent.contextMenu(heading, { clientX: 48, clientY: 64 })

        const menu = screen.getByRole('menu', { name: 'Actions for Heading' })
        expect(heading).not.toHaveClass('designer-highlighted')
        expect(menu).toHaveStyle({ left: '48px', top: '64px' })
        expect(within(menu).getByRole('menuitem', { name: 'Edit text' })).toBeInTheDocument()
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Edit text' }))

        expect(focus).toHaveBeenCalled()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'editText',
            targetId: 'content:0',
        }), '*')
        postMessage.mockRestore()
    })

    it('opens theme images in the inspector instead of replacing an ambiguous breakpoint', async () => {
        const imageWorkspace = structuredClone(workspace)
        imageWorkspace.catalog.designGroups[0].assetKeys = ['design:0:content-widget:md:background']
        imageWorkspace.assets = [{
            assetKey: 'design:0:content-widget:md:background',
            displayName: 'Article background',
            part: 'content-widget',
        }]
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: imageWorkspace, viewId: 'page-main', contentEditable: true }))

        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        const contentContainer = heading.closest('.content-widget') as HTMLElement
        const originalTargets = contentContainer.dataset.designerTargets
        contentContainer.dataset.designerTargets = JSON.stringify([
            { id: 'article-body', kind: 'part', label: 'Body' },
            { id: 'asset:design:0:content-widget:md:background', kind: 'asset', label: 'Article background' },
        ])
        fireEvent.click(contentContainer)
        expect(contentContainer).toHaveClass('designer-selected-widget')
        expect(contentContainer).not.toHaveClass('designer-selected-element')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'select',
            selectionPaths: expect.objectContaining({ element: [] }),
        }), '*')
        contentContainer.dataset.designerTargets = originalTargets

        fireEvent.contextMenu(heading, { clientX: 48, clientY: 64 })

        const menu = screen.getByRole('menu')
        expect(within(menu).queryByRole('menuitem', { name: 'Replace image' })).not.toBeInTheDocument()
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Edit image in inspector' }))

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'contextAction',
            command: 'inspect',
            kind: 'asset',
            targetId: 'asset:design:0:content-widget:md:background',
        }), '*')
        postMessage.mockRestore()
    })

    it('runs rich text toolbar commands against the active field', async () => {
        const execCommand = vi.fn()
        Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main', contentEditable: true }))
        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        const richText = heading.closest('.content-widget') as HTMLElement
        fireEvent.doubleClick(heading)

        act(() => window.dispatchEvent(new MessageEvent('message', {
            source: window,
            data: { source: 'eceee-render-host', action: 'formatText', targetId: 'content:0', command: 'bold' },
        })))
        act(() => window.dispatchEvent(new MessageEvent('message', {
            source: window,
            data: { source: 'eceee-render-host', action: 'formatText', targetId: 'content:0', command: 'formatBlock', value: 'h2' },
        })))

        expect(execCommand).toHaveBeenCalledWith('bold', false, undefined)
        expect(execCommand).toHaveBeenCalledWith('formatBlock', false, '<h2>')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'contentChange', targetId: 'content:0', richText: true }), '*')
        expect(richText.contentEditable).toBe('true')
        delete (document as any).execCommand
        postMessage.mockRestore()
    })

    it('makes unconfigured visible text editable without making live content editable', async () => {
        const unconfiguredWorkspace = {
            ...structuredClone(workspace),
            previewContent: { views: [{
                id: 'plain-page', layout: 'main_layout', texts: {},
                content: { widgets: { main: [{ id: 'plain', type: 'easy_widgets.ContentWidget', config: { content: '<p>Plain copied text</p>' } }] } },
            }] },
            catalog: { ...structuredClone(workspace.catalog), designGroups: [] },
        }
        const { unmount } = render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: unconfiguredWorkspace, viewId: 'plain-page', contentEditable: true }))

        const editableParagraph = await screen.findByText('Plain copied text')
        const richText = editableParagraph.closest('.content-widget') as HTMLElement
        expect(richText).toHaveAttribute('data-designer-target', 'content:0')
        expect(richText.contentEditable).not.toBe('true')
        fireEvent.doubleClick(editableParagraph)
        expect(richText.contentEditable).toBe('true')

        unmount()
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: unconfiguredWorkspace, viewId: 'plain-page', contentEditable: false }))
        const readOnlyParagraph = await screen.findByText('Plain copied text')
        expect(readOnlyParagraph).not.toHaveAttribute('data-designer-target')
        expect((readOnlyParagraph as HTMLElement).contentEditable).not.toBe('true')
    })

    it('requires an explicit editable flag for render models outside the Designer adapter', async () => {
        const model = createDesignerRenderModel({ workspace, viewId: 'page-main', contentEditable: true })
        delete model.designer?.contentEditable
        render(<RenderFrameRuntime />)
        sendModel(model)

        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        await waitFor(() => expect(heading).toHaveAttribute('data-designer-target', 'heading'))
        expect(heading).not.toHaveAttribute('data-designer-target', 'content:0')
        expect((heading as HTMLElement).contentEditable).not.toBe('true')
    })

    it('uses one non-overlapping editable target for nested text markup', async () => {
        const nestedWorkspace = {
            ...structuredClone(workspace),
            previewContent: { views: [{
                id: 'nested-page', layout: 'main_layout', texts: {},
                content: { widgets: { main: [{
                    id: 'nested', type: 'easy_widgets.ContentWidget',
                    config: { content: '<h3><a href="#details">Linked heading</a></h3>' },
                }] } },
            }] },
            catalog: { ...structuredClone(workspace.catalog), designGroups: [] },
        }
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: nestedWorkspace, viewId: 'nested-page', contentEditable: true }))

        const link = await screen.findByRole('link', { name: 'Linked heading' })
        const heading = link.closest('h3')!
        const richText = link.closest('.content-widget') as HTMLElement
        expect(richText).toHaveAttribute('data-designer-target', 'content:0')
        expect(richText.contentEditable).not.toBe('true')
        expect((heading as HTMLElement).contentEditable).not.toBe('true')

        postMessage.mockClear()
        fireEvent.doubleClick(link)
        expect(richText.contentEditable).toBe('true')
        link.textContent = 'Changed link'
        Object.defineProperty(link, 'innerText', { configurable: true, value: 'Changed link' })
        fireEvent.input(richText)
        const changes = postMessage.mock.calls.filter(([message]) => message?.action === 'contentChange')
        expect(changes).toHaveLength(1)
        expect(changes[0][0]).toEqual(expect.objectContaining({ targetId: 'content:0', text: expect.stringContaining('Changed link'), richText: true }))
        expect(heading.querySelector('a')).toBe(link)
        postMessage.mockRestore()
    })

    it('selects and marks the closest nested Designer element when it is clicked', async () => {
        const nestedWorkspace = {
            ...structuredClone(workspace),
            previewContent: { views: [{
                id: 'nested-targets', layout: 'main_layout', texts: {},
                content: { widgets: { main: [{
                    id: 'nested-target-widget', type: 'easy_widgets.ContentWidget',
                    config: { content: '<h3>Container <a href="#details">Nested link</a></h3>' },
                }] } },
            }] },
            catalog: {
                ...structuredClone(workspace.catalog),
                designGroups: [{
                    id: 'nested-group', label: 'Nested content', widgetTypes: ['easy_widgets.ContentWidget'],
                    parts: [], assetKeys: [],
                    elements: [
                        { id: 'nested-heading', element: 'h3', label: 'Heading' },
                        { id: 'nested-link', element: 'a', label: 'Link' },
                    ],
                }],
            },
        }
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: nestedWorkspace, viewId: 'nested-targets' }))

        const link = await screen.findByRole('link', { name: 'Nested link' })
        const heading = link.closest('h3')!
        fireEvent.click(link)

        expect(link).toHaveClass('designer-selected')
        expect(heading).not.toHaveClass('designer-selected')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'select',
            targetId: 'nested-link',
            label: 'Link',
        }), '*')
        const selection = postMessage.mock.calls
            .map(([message]) => message)
            .find((message) => message?.action === 'select' && message?.targetId === 'nested-link')
        expect(selection?.path?.slice(-2).map((target: any) => target.id)).toEqual(['nested-heading', 'nested-link'])
        postMessage.mockRestore()
    })

    it('reports selection without content changes and shows spacing guides', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({
            workspace,
            viewId: 'page-main',
            themeCss: 'h1{margin:10px 20px 30px 40px;padding:5px 6px 7px 8px;border:2px solid transparent}',
        }))
        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        let headingRect = {
            x: 80, y: 100, left: 80, top: 100, right: 380, bottom: 300, width: 300, height: 200,
            toJSON: () => ({}),
        }
        vi.spyOn(heading, 'getBoundingClientRect').mockImplementation(() => headingRect)

        fireEvent.mouseOver(heading)
        expect(document.querySelector('.designer-spacing-readout')).toBeNull()
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toHaveTextContent('10px')
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toHaveAttribute('data-placement', 'outside')
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toHaveStyle({ left: '220px', top: '80px' })
        expect(document.querySelector('.designer-spacing-margin-value[data-side="bottom"]')).toHaveTextContent('30px')
        expect(document.querySelector('.designer-spacing-margin-value[data-side="bottom"]')).toHaveStyle({ left: '220px', top: '315px' })
        expect(document.querySelector('.designer-spacing-padding-value[data-side="left"]')).toHaveTextContent('8px')
        expect(document.querySelector('.designer-spacing-padding-value[data-side="left"]')).toHaveAttribute('data-placement', 'outside')
        expect(document.querySelector('.designer-spacing-padding-value[data-side="left"]')).toHaveStyle({ left: '69px', top: '199px' })
        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        const spacingInput = screen.getByLabelText('margin top value')
        const spacingEditor = screen.getByRole('form', { name: 'Edit margin top' })
        expect(window.getComputedStyle(spacingEditor).zIndex).toBe('2147483647')
        expect(window.getComputedStyle(document.querySelector('.designer-spacing-measure')! as HTMLElement).zIndex).toBe('2147483645')
        expect(spacingEditor).toHaveStyle({ top: '92px' })
        fireEvent.keyDown(spacingInput, { key: 'ArrowUp' })
        expect(spacingInput).toHaveValue('11px')
        fireEvent.keyDown(spacingInput, { key: 'ArrowDown', shiftKey: true })
        expect(spacingInput).toHaveValue('6px')
        fireEvent.click(screen.getByRole('button', { name: 'Increase margin top' }))
        expect(spacingInput).toHaveValue('7px')
        expect(heading).toHaveStyle({ marginTop: '7px' })
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toHaveTextContent('7px')

        headingRect = { ...headingRect, y: 140, top: 140, bottom: 340 }
        fireEvent.scroll(window)
        expect(spacingEditor).toHaveStyle({ top: '135px' })

        fireEvent.input(spacingInput, { target: { value: '18px' } })
        expect(heading).toHaveStyle({ marginTop: '18px' })
        fireEvent.keyDown(spacingInput, { key: 'Enter' })
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'spacingChange', property: 'marginTop', value: '18px',
            targetId: 'heading', targetIds: expect.arrayContaining(['heading']), viewportWidth: window.innerWidth,
        }), '*')
        expect(screen.queryByRole('form', { name: 'Edit margin top' })).not.toBeInTheDocument()

        const appliedChanges = () => postMessage.mock.calls.filter(([message]) => message?.action === 'spacingChange')
        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        fireEvent.change(screen.getByLabelText('margin top value'), { target: { value: '19px' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(appliedChanges().at(-1)?.[0]).toEqual(expect.objectContaining({ value: '19px' }))

        const appliedCount = appliedChanges().length
        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        fireEvent.input(screen.getByLabelText('margin top value'), { target: { value: '20px' } })
        expect(heading).toHaveStyle({ marginTop: '20px' })
        fireEvent.keyDown(screen.getByLabelText('margin top value'), { key: 'Escape' })
        expect(heading).toHaveStyle({ marginTop: '19px' })
        expect(screen.queryByRole('form', { name: 'Edit margin top' })).not.toBeInTheDocument()
        expect(appliedChanges()).toHaveLength(appliedCount)

        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        fireEvent.change(screen.getByLabelText('margin top value'), { target: { value: '21px' } })
        fireEvent.pointerDown(document.body)
        expect(screen.queryByRole('form', { name: 'Edit margin top' })).not.toBeInTheDocument()
        expect(appliedChanges()).toHaveLength(appliedCount)

        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        fireEvent.change(screen.getByLabelText('margin top value'), { target: { value: '22px' } })
        fireEvent.blur(window)
        expect(screen.queryByRole('form', { name: 'Edit margin top' })).not.toBeInTheDocument()
        expect(appliedChanges()).toHaveLength(appliedCount)
        headingRect = { ...headingRect, y: 100, top: 100, bottom: 300 }
        fireEvent.scroll(window)
        expect(document.querySelector('.designer-spacing-margin-measure[data-side="top"]')).toHaveStyle({
            left: '220px', top: '81px', height: '19px',
        })
        expect(document.querySelector('.designer-spacing-padding-measure[data-side="left"]')).toHaveStyle({
            left: '82px', top: '199px', width: '8px',
        })
        expect(heading).toHaveClass('designer-hovered')
        expect(document.querySelector('.designer-spacing-margin[data-side="bottom"]')).toHaveStyle({
            left: '40px', top: '300px', width: '360px', height: '30px',
        })
        expect(document.querySelector('.designer-spacing-padding[data-side="left"]')).toHaveStyle({
            left: '82px', top: '107px', width: '8px', height: '184px',
        })
        expect(document.querySelector('.designer-spacing-content')).toHaveStyle({
            left: '90px', top: '107px', width: '282px', height: '184px',
        })
        fireEvent.click(heading)
        const selectedMarginLabel = document.querySelector('.designer-spacing-margin-value[data-side="top"]')
        fireEvent.mouseOver(heading.closest('[data-widget-id]') as HTMLElement)
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toBe(selectedMarginLabel)

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'select', targetId: 'heading',
            computedStyles: expect.objectContaining({ fontSize: expect.any(String), marginBottom: expect.any(String) }),
            ancestors: expect.arrayContaining([expect.objectContaining({ id: 'article-body' })]),
        }), '*'))
        expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'contentChange', targetId: 'heading',
        }), '*')

        postMessage.mockClear()
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-render-host', action: 'selectTarget', targetId: 'heading' },
            source: window.parent,
        }))
        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'select', targetId: 'heading',
            alternatives: expect.any(Array), ancestors: expect.any(Array), descendants: expect.any(Array),
        }), '*'))
        fireEvent.mouseOut(heading, { relatedTarget: document.body })
        expect(heading).toHaveClass('designer-selected')
        expect(heading).toHaveClass('designer-hovered')
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toHaveTextContent('19px')
        postMessage.mockRestore()
    })

    it('shows spacing for structural layout elements without designer targets', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main' }))
        await screen.findByRole('heading', { name: 'Overridden heading' })
        const grid = document.querySelector<HTMLElement>('.main-layout-grid')!
        grid.style.padding = '30px 40px'
        vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
            x: 0, y: 100, left: 0, top: 100, right: 600, bottom: 500, width: 600, height: 400,
            toJSON: () => ({}),
        })

        fireEvent.mouseOver(grid)

        expect(grid).not.toHaveAttribute('data-designer-target')
        expect(grid).toHaveClass('designer-hovered')
        expect(document.querySelector('.designer-spacing-padding[data-side="top"]')).toHaveStyle({
            left: '0px', top: '100px', width: '600px', height: '30px',
        })
        expect(document.querySelector('.designer-spacing-padding[data-side="left"]')).toHaveStyle({
            left: '0px', top: '130px', width: '40px', height: '340px',
        })
    })

    it('centers a spacing value in the visible part of an offscreen region', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main' }))
        await screen.findByRole('heading', { name: 'Overridden heading' })
        const grid = document.querySelector<HTMLElement>('.main-layout-grid')!
        grid.style.paddingTop = '30px'
        vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
            x: -200, y: 100, left: -200, top: 100, right: 300, bottom: 500, width: 500, height: 400,
            toJSON: () => ({}),
        })

        fireEvent.mouseOver(grid)

        expect(document.querySelector('.designer-spacing-padding-value[data-side="top"]')).toHaveTextContent('30px')
        expect(document.querySelector('.designer-spacing-padding-value[data-side="top"]')).toHaveStyle({
            left: '150px', top: '115px',
        })
    })

    it('keeps a tight spacing label on the true exterior side at a viewport edge', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main' }))
        await screen.findByRole('heading', { name: 'Overridden heading' })
        const grid = document.querySelector<HTMLElement>('.main-layout-grid')!
        grid.style.paddingLeft = '20px'
        vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
            x: 0, y: 100, left: 0, top: 100, right: 300, bottom: 300, width: 300, height: 200,
            toJSON: () => ({}),
        })

        fireEvent.mouseOver(grid)

        expect(document.querySelector('.designer-spacing-padding-value[data-side="left"]')).toHaveStyle({
            left: '12px', top: '200px',
        })
        expect(document.querySelector('.designer-spacing-padding-measure[data-side="left"]')).toHaveStyle({
            left: '0px', top: '200px', width: '20px',
        })
    })

    it('returns current computed theme values for a requested target', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main' }))
        await screen.findByRole('heading', { name: 'Overridden heading' })

        act(() => window.dispatchEvent(new MessageEvent('message', {
            data: { source: 'eceee-render-host', action: 'readTargetStyles', targetId: 'heading' },
            source: window.parent,
        })))

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'targetStyles', targetId: 'heading',
            computedStyles: expect.objectContaining({ fontSize: expect.any(String), padding: expect.any(String) }),
        }), '*'))
        postMessage.mockRestore()
    })

    it('renders real page content as read-only and can hide support guides', async () => {
        const sourceModel = createPageRenderModel({
            widgets: { main: [{ id: 'real-content', type: 'easy_widgets.ContentWidget', config: { content: '<h1>Real page heading</h1>' } }] },
            context: { tenantId: 'theme-tenant', pageId: 42, versionId: 9 },
        })
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({
            workspace,
            viewId: 'page-main',
            sourceModel,
            guidesEnabled: false,
        }))

        const heading = await screen.findByRole('heading', { name: 'Real page heading' })
        await waitFor(() => expect(heading).toHaveAttribute('data-designer-target', 'heading'))
        expect((heading as HTMLElement).contentEditable).not.toBe('true')
        expect(document.querySelector('.designer-preview')).not.toHaveClass('designer-guides')
        fireEvent.mouseOver(heading)
        expect(document.querySelector('.designer-spacing-readout')).toBeNull()
    })

    it('renders copied object data without a live object', async () => {
        const objectWorkspace = {
            catalog: { layouts: [{ key: 'main_layout', slots: [{ name: 'main' }] }], componentStyles: [] },
            previewContent: { views: [{
                id: 'copied-object', kind: 'object', layout: 'main_layout',
                objectType: { schema: { properties: {
                    summary: { title: 'Summary' },
                    biography: { title: 'Biography', componentType: 'rich_text' },
                    portrait: { title: 'Portrait', componentType: 'image' },
                    tags: { title: 'Tags', type: 'array', items: { type: 'string' } },
                } } },
                content: { data: {
                    summary: 'Detached object body',
                    biography: '<p>Formatted <strong>biography</strong></p>',
                    portrait: { url: 'https://storage.test/portrait.jpg' },
                    tags: ['Research', 'Policy'],
                }, widgets: {} },
            }] },
        }
        render(<RenderFrameRuntime />)

        sendModel(createDesignerRenderModel({ workspace: objectWorkspace, viewId: 'copied-object' }))

        expect(await screen.findByText('Detached object body')).toBeInTheDocument()
        expect(screen.getByText('Summary')).toBeInTheDocument()
        expect(screen.getByText('biography', { selector: 'strong' })).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Portrait' })).toHaveAttribute('src', 'https://storage.test/portrait.jpg')
        expect(screen.getByText('Research', { selector: 'li' })).toBeInTheDocument()
    })

    it('identifies the exact repeated image imported into legacy site preview metadata', async () => {
        const imageWorkspace = {
            catalog: { layouts: [{ key: 'main_layout', slots: [{ name: 'hero' }, { name: 'main' }] }], componentStyles: [], designGroups: [] },
            previewContent: { views: [{
                id: 'site-page', layout: 'main_layout', texts: {},
                images: {
                    'preview:site-page:image:main': { url: '/theme_images/site-hero.jpg', filename: 'Site hero repeated' },
                    'preview:site-page:image:hero': { url: '/theme_images/site-hero.jpg', filename: 'Site hero' },
                },
            }] },
        }
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)

        const model = createDesignerRenderModel({ workspace: imageWorkspace, viewId: 'site-page', contentEditable: true })
        model.slots.hero[0].config.mediaItems[0].src = '/imgproxy/site-hero.jpg'
        model.slots.main[0].config.mediaItems[0].src = '/imgproxy/site-hero.jpg'
        sendModel(model)

        const image = await screen.findByRole('img', { name: 'Site hero' })
        expect(image).toHaveAttribute('src', '/imgproxy/site-hero.jpg')
        fireEvent.contextMenu(image, { clientX: 30, clientY: 40 })
        fireEvent.click(screen.getByRole('menuitem', { name: 'Replace image' }))
        const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*="image/png"]')!
        const replacement = new File(['replacement'], 'replacement.png', { type: 'image/png' })
        fireEvent.change(input, { target: { files: [replacement] } })

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'contextAction',
            command: 'replaceImage',
            targetId: 'content-image:0',
            kind: 'previewImage',
            sourceUrl: '/theme_images/site-hero.jpg',
            sourceOccurrence: 1,
            sourcePath: ['images', 'preview:site-page:image:hero', 'url'],
            sourceMatchIndex: 0,
            file: replacement,
        }), '*')
        expect(input).not.toBeInTheDocument()
        postMessage.mockRestore()
    })
})
