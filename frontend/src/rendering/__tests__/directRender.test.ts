import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadDirectRenderModel, loadResolvedRenderModel, parseDirectRenderPath } from '../directRender'

const clientApi = vi.hoisted(() => ({ get: vi.fn() }))
const previewResolver = vi.hoisted(() => ({ resolve: vi.fn(async (model) => model) }))
vi.mock('../../api/client', () => ({ api: clientApi }))
vi.mock('../../components/resolvePagePreviewModel', () => ({ resolvePagePreviewModel: previewResolver.resolve }))
vi.mock('../../utils/pathParser', () => ({ buildPathVariablesContext: vi.fn(async () => ({})) }))
vi.mock('../../utils/tenant', () => ({ getCurrentTenantId: () => 'summer-study' }))

describe('direct render URL', () => {
    beforeEach(() => {
        clientApi.get.mockReset()
        previewResolver.resolve.mockClear()
        vi.restoreAllMocks()
    })

    it('parses a site id and nested slug path', () => {
        expect(parseDirectRenderPath('/_render/85/for-authors/review-process/')).toEqual({
            siteId: 85,
            slugPath: 'for-authors/review-process',
        })
    })

    it('supports rendering the site root', () => {
        expect(parseDirectRenderPath('/_render/85/')).toEqual({ siteId: 85, slugPath: '' })
    })

    it('loads the saved page using the resolved tenant', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                siteId: 85,
                tenantIdentifier: 'summer-study',
                pageId: 92,
                versionId: 125,
                slugPath: 'for-authors/review-process',
            }),
            text: async () => '',
        }))
        clientApi.get
            .mockResolvedValueOnce({ data: { id: 92, cachedRootHostnames: ['summerstudy.localhost'] } })
            .mockResolvedValueOnce({ data: { id: 125, codeLayout: 'main_layout', widgets: {} } })
            .mockResolvedValueOnce({ data: { slots: {} } })

        const model = await loadDirectRenderModel({ siteId: 85, slugPath: 'for-authors/review-process' })

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('site_id=85'),
            expect.objectContaining({
                credentials: 'include',
                headers: expect.objectContaining({ 'X-Tenant-ID': 'summer-study' }),
            }),
        )
        expect(clientApi.get).toHaveBeenCalledTimes(3)
        clientApi.get.mock.calls.forEach(([, config]) => {
            expect(config).toEqual({ headers: { 'X-Tenant-ID': 'summer-study' } })
        })
        expect(model.context).toMatchObject({
            tenantId: 'summer-study',
            siteId: 85,
            siteHostnames: ['summerstudy.localhost'],
            pageId: 92,
            versionId: 125,
            renderRoutePrefix: '/_render/85',
        })
        expect(previewResolver.resolve).toHaveBeenCalledOnce()
    })

    it('loads the exact published version selected by the Designer', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }))
        clientApi.get
            .mockResolvedValueOnce({ data: { id: 42, cachedRootHostnames: ['conference.example'] } })
            .mockResolvedValueOnce({ data: { id: 9, codeLayout: 'main_layout', widgets: {} } })
            .mockResolvedValueOnce({ data: { slots: {} } })

        const model = await loadResolvedRenderModel({
            siteId: 12,
            slugPath: 'programme',
            tenantIdentifier: 'theme-tenant',
            pageId: 42,
            versionId: 9,
        })

        expect(clientApi.get.mock.calls[1][0]).toContain('/pages/42/versions/9/')
        expect(model.context).toMatchObject({ tenantId: 'theme-tenant', siteId: 12, pageId: 42, versionId: 9 })
    })
})
