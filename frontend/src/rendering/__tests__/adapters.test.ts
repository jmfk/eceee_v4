import { describe, expect, it } from 'vitest'
import { createDesignerRenderModel, createPageRenderModel, designerPreviewImageReferences, withLayoutPreviewPlaceholders } from '../adapters'

describe('render adapters', () => {
    it('uses the current in-memory widgets for page previews', () => {
        const model = createPageRenderModel({ widgets: { main: [{ id: 'draft', type: 'easy_widgets.HeadlineWidget', config: { content: 'Unsaved heading' } }] } })
        expect(model.slots.main[0].config.content).toBe('Unsaved heading')
    })

    it('fills only empty layout slots with labelled preview placeholders', () => {
        const layout = {
            id: '8ac4db5a-492f-4977-bf00-d21b8d72f08e',
            key: 'main_layout',
            label: 'Main',
            status: 'active' as const,
            slots: { main: { label: 'Main content' }, sidebar: { label: 'Sidebar policy', dimensions: { mobile: { width: 375, height: 72 } } } },
            root: {
                id: '2d1ee676-3624-4ec8-aaf4-8874bea037f4',
                type: 'container' as const,
                children: [
                    { id: '114eff0f-f86f-4a10-8df5-27925804fc73', type: 'slot' as const, slot_key: 'main', label: 'Article', children: [] },
                    { id: 'dc79689c-c2e2-4c11-8ac4-ae67cc395e97', type: 'slot' as const, slot_key: 'sidebar', label: 'Related', children: [] },
                ],
            },
        }
        const model = createPageRenderModel({
            layoutDefinition: layout,
            widgets: { main: [{ id: 'heading', type: 'easy_widgets.HeadlineWidget', config: { content: 'Real content' } }] },
        })

        const preview = withLayoutPreviewPlaceholders(model, layout)

        expect(preview.slots.main[0].type).toBe('easy_widgets.HeadlineWidget')
        expect(preview.slots.sidebar[0]).toMatchObject({
            type: 'designer.LayoutSlotPlaceholder',
            config: { label: 'Related' },
        })
        expect(preview.designer?.guidesEnabled).toBe(false)
    })

    it('assigns placeholder shades in rendered tree order so adjacent slots differ', () => {
        const slot = (id: string, slotKey: string) => ({ id, type: 'slot' as const, slot_key: slotKey, label: slotKey, children: [] })
        const layout = {
            id: 'shade-order-layout',
            key: 'shade_order',
            label: 'Shade order',
            status: 'active' as const,
            slots: {
                header: { label: 'Header' },
                footer: { label: 'Footer' },
                navigation: { label: 'Navigation' },
                hero: { label: 'Hero' },
                main: { label: 'Main' },
            },
            root: {
                id: 'shade-order-root',
                type: 'container' as const,
                children: [
                    slot('header-slot', 'header'),
                    slot('navigation-slot', 'navigation'),
                    slot('hero-slot', 'hero'),
                    slot('main-slot', 'main'),
                    slot('footer-slot', 'footer'),
                ],
            },
        }

        const preview = withLayoutPreviewPlaceholders(createPageRenderModel({ layoutDefinition: layout }), layout)
        const renderedShades = ['header', 'navigation', 'hero', 'main', 'footer'].map((slotKey) => preview.slots[slotKey][0].config.shade)

        expect(renderedShades).toEqual([0, 1, 2, 3, 0])
        expect(renderedShades.every((shade, index) => index === 0 || shade !== renderedShades[index - 1])).toBe(true)
    })

    it('preserves sidebar section descriptors instead of normalizing them as widgets', () => {
        const section = { title: 'Related pages', type: 'list', items: [{ title: 'Programme', url: '/programme/' }] }
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'sidebar', type: 'easy_widgets.SidebarWidget', config: { widgets: [section] } }] },
        })

        expect(model.slots.main[0].config.widgets).toEqual([section])
    })

    it('builds designer pages from render fixtures instead of backend HTML', () => {
        const workspace = {
            previewContent: { views: [{ id: 'main', layout: 'main_layout', texts: {}, images: {} }] },
            catalog: {
                layouts: [{ key: 'main_layout', slots: [{ name: 'main' }] }],
                designGroups: [{ id: 'group:0', widgetTypes: ['easy_widgets.ContentWidget'], slots: ['main'] }],
            },
            assets: [],
        }
        const model = createDesignerRenderModel({ workspace, viewId: 'main' })
        expect(model.slots.main).toHaveLength(1)
        expect(model.slots.main[0].type).toBe('easy_widgets.ContentWidget')
        expect(model.designer?.catalog).toBe(workspace.catalog)
        expect(model.designer?.contentEditable).toBe(false)
    })

    it('does not inject legacy catalog layout CSS into designer previews', () => {
        const model = createDesignerRenderModel({
            workspace: {
                previewContent: { views: [{ id: 'main', layout: 'main_layout', texts: {}, images: {} }] },
                catalog: {
                    layouts: [{
                        key: 'main_layout',
                        layoutCss: '.legacy-python-layout{height:310px}',
                        slots: [{ name: 'main' }],
                    }],
                },
                themeCss: '.theme-widget{color:red}',
                assets: [],
            },
            viewId: 'main',
        })

        expect(model.themeCss).not.toContain('legacy-python-layout')
    })

    it('renders complete theme-owned preview documents instead of generated fixtures', () => {
        const workspace = {
            previewContent: { views: [{
                id: 'copied-page', kind: 'page', layout: 'main_layout',
                content: {
                    codeLayout: 'main_layout',
                    widgets: { main: [{ id: 'copied', type: 'easy_widgets.HeadlineWidget', config: { content: 'Copied heading' } }] },
                },
            }] },
            catalog: {
                layouts: [{ key: 'main_layout', slots: [{ name: 'main' }] }],
                designGroups: [{ id: 'group:0', widgetTypes: ['easy_widgets.ContentWidget'], slots: ['main'] }],
            },
            assets: [],
        }

        const model = createDesignerRenderModel({ workspace, viewId: 'copied-page' })

        expect(model.slots.main).toHaveLength(1)
        expect(model.slots.main[0]).toMatchObject({ id: 'copied', type: 'easy_widgets.HeadlineWidget' })
        expect(model.designer?.contentEditable).toBe(false)
    })

    it('renders every configured slot in a theme-owned object preview', () => {
        const workspace = {
            previewContent: { views: [{
                id: 'copied-object', kind: 'object', layout: 'main_layout',
                objectType: { slotConfiguration: { slots: [{ name: 'main_content' }, { name: 'content' }] } },
                content: {
                    data: { summary: 'Copied object summary' },
                    widgets: {
                        content: [{ id: 'second', type: 'easy_widgets.ContentWidget', config: {} }],
                        main_content: [{ id: 'first', type: 'easy_widgets.HeadlineWidget', config: {} }],
                    },
                },
            }] },
            catalog: { layouts: [{ key: 'main_layout', slots: [{ name: 'main' }] }] },
        }

        const model = createDesignerRenderModel({ workspace, viewId: 'copied-object' })

        expect(model.slots.main.map((widget) => widget.id)).toEqual(['copied-object-data', 'first', 'second'])
        expect(model.context).toMatchObject({
            objectId: 'copied-object',
            objectData: { summary: 'Copied object summary' },
            objectType: workspace.previewContent.views[0].objectType,
        })
        expect(model.designer?.contentEditable).toBe(false)
    })

    it('renders every configured slot in a live object preview', () => {
        const workspace = { catalog: { layouts: [{ key: 'main_layout', slots: [{ name: 'main' }] }] } }
        const sourceModel = {
            layout: 'main_layout',
            slots: {
                content: [{ id: 'body', type: 'easy_widgets.ContentWidget', config: {} }],
                teaser: [{ id: 'teaser', type: 'easy_widgets.HeadlineWidget', config: {} }],
            },
            context: {
                objectId: 55,
                objectType: { slotConfiguration: { slots: [{ name: 'teaser' }, { name: 'content' }] } },
            },
        }

        const model = createDesignerRenderModel({ workspace, sourceModel })

        expect(model.slots.main.map((widget) => widget.id)).toEqual(['teaser', 'body'])
    })

    it('materializes imported legacy preview images in their saved slot', () => {
        const workspace = {
            previewContent: { views: [{
                id: 'site-page', layout: 'main_layout', texts: {},
                images: { 'preview:site-page:image:hero': { url: 'https://storage.test/hero.jpg', filename: 'Hero' } },
            }] },
            catalog: { layouts: [{ key: 'main_layout', slots: [{ name: 'main' }, { name: 'hero' }] }], designGroups: [] },
        }

        const model = createDesignerRenderModel({ workspace, viewId: 'site-page' })

        expect(model.slots.hero).toHaveLength(1)
        expect(model.slots.hero[0]).toMatchObject({
            type: 'easy_widgets.ImageWidget',
            config: {
                imageUrl: 'https://storage.test/hero.jpg',
                altText: 'Hero',
                mediaItems: [{
                    url: 'https://storage.test/hero.jpg',
                    altText: 'Hero',
                }],
            },
        })
    })

    it('identifies rendered images by their persisted path instead of matching image-looking caption text', () => {
        const imageUrl = 'https://storage.test/repeated.jpg'
        const view = {
            content: {
                widgets: {
                    main: [{
                        id: 'image',
                        type: 'easy_widgets.ImageWidget',
                        config: { caption: imageUrl, imageUrl },
                    }],
                },
            },
        }

        expect(designerPreviewImageReferences(view)).toEqual([{
            sourceUrl: imageUrl,
            sourceOccurrence: 0,
            sourcePath: ['content', 'widgets', 'main', 0, 'config', 'imageUrl'],
            sourceMatchIndex: 0,
        }])
    })
})
