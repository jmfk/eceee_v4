import { describe, expect, it } from 'vitest'
import { createDesignerRenderModel, createPageRenderModel } from '../adapters'

describe('render adapters', () => {
    it('uses the current in-memory widgets for page previews', () => {
        const model = createPageRenderModel({ widgets: { main: [{ id: 'draft', type: 'easy_widgets.HeadlineWidget', config: { content: 'Unsaved heading' } }] } })
        expect(model.slots.main[0].config.content).toBe('Unsaved heading')
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
})
