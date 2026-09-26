import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPageRenderModel } from '../../rendering/adapters'
import { resolvePagePreviewModel } from '../resolvePagePreviewModel'

const objectApi = vi.hoisted(() => ({ search: vi.fn(), get: vi.fn(), getNewsList: vi.fn() }))
const clientApi = vi.hoisted(() => ({ get: vi.fn() }))
const imgproxyApi = vi.hoisted(() => ({ getBatch: vi.fn() }))
vi.mock('../../api/objectStorage', () => ({ objectInstancesApi: objectApi }))
vi.mock('../../api/client', () => ({ api: clientApi }))
vi.mock('../../utils/imgproxySecure', () => ({ getBatchImgproxyUrls: imgproxyApi.getBatch }))

describe('page preview model resolution', () => {
    beforeEach(() => vi.clearAllMocks())

    it('resolves detail widgets from editor path variables', async () => {
        objectApi.search.mockResolvedValue({ data: { results: [{ id: 17, slug: 'selected-story' }] } })
        objectApi.get.mockResolvedValue({ data: { id: 17, slug: 'selected-story', title: 'Selected story', objectType: { id: 4 } } })
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'detail', type: 'easy_widgets.NewsDetailWidget', config: { object_types: [4], slug_variable_name: 'story' } }] },
            context: { tenantId: 'tenant-b', pathVariables: { story: 'selected-story' } },
        })

        const resolved = await resolvePagePreviewModel(model)

        const tenantConfig = { headers: { 'X-Tenant-ID': 'tenant-b' } }
        expect(objectApi.search).toHaveBeenCalledWith('selected-story', {}, tenantConfig)
        expect(objectApi.get).toHaveBeenCalledWith(17, tenantConfig)
        expect(resolved.slots.main[0].data).toMatchObject({ status: 'ready', item: { title: 'Selected story' } })
    })

    it('keeps list widgets inside the preview tenant', async () => {
        objectApi.getNewsList.mockResolvedValue({ data: { results: [] } })
        const model = createPageRenderModel({
            widgets: { main: [{ id: 'list', type: 'easy_widgets.NewsListWidget', config: { objectTypes: [4] } }] },
            context: { tenantId: 'tenant-b' },
        })

        await resolvePagePreviewModel(model)

        expect(objectApi.getNewsList).toHaveBeenCalledWith(
            [4],
            { limit: 10, sort_order: '-publish_date' },
            { headers: { 'X-Tenant-ID': 'tenant-b' } },
        )
    })

    it('resolves links before handing the model to the renderer', async () => {
        clientApi.get.mockResolvedValue({ data: { id: 69, path: '/panels/', title: 'Panels', isPublished: true, siteId: 85 } })
        const model = createPageRenderModel({
            widgets: {
                navbar: [{ id: 'nav', type: 'easy_widgets.NavbarWidget', config: { menuItems: [{ linkData: { type: 'internal', pageId: 69, label: 'Panels' } }] } }],
                main: [{ id: 'content', type: 'easy_widgets.ContentWidget', config: { content: '<a href="{&quot;type&quot;:&quot;internal&quot;,&quot;pageId&quot;:69}">Panels</a>' } }],
            },
        })

        const resolved = await resolvePagePreviewModel(model)

        expect(resolved.slots.navbar[0].config.menuItems[0].linkData).toMatchObject({ resolvedUrl: '/panels/', siteId: 85 })
        expect(resolved.slots.main[0].config.content).toContain('href="/panels/"')
    })

    it('prepares image variants before handing the model to the renderer', async () => {
        imgproxyApi.getBatch.mockResolvedValue(['/hero-1x.jpg', '/hero-2x.jpg'])
        const model = createPageRenderModel({ widgets: { hero: [{ id: 'hero', type: 'easy_widgets.HeroWidget', config: { image: { imgproxyBaseUrl: 'https://example.com/original.jpg' } } }] } })

        const resolved = await resolvePagePreviewModel(model)

        expect(resolved.slots.hero[0].config).toMatchObject({ backgroundImageUrl: '/hero-1x.jpg', backgroundImageUrl2x: '/hero-2x.jpg' })
    })
})
