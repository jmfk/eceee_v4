import { api } from '../api/client'
import { endpoints } from '../api/endpoints'
import { buildQueryParams } from '../api/utils'
import { buildPathVariablesContext } from '../utils/pathParser'
import { transformInheritanceData } from '../utils/widgetMerging'
import { getCurrentTenantId } from '../utils/tenant'
import { resolvePagePreviewModel } from '../components/resolvePagePreviewModel'
import { createPageRenderModel } from './adapters'
import { googleFontsStylesheetUrl } from './primitives'
import type { RenderPageModel } from './types'

export interface DirectRenderLocation {
    siteId: number
    slugPath: string
}

export interface ResolvedRenderLocation extends DirectRenderLocation {
    tenantIdentifier: string
    pageId: number
    versionId: number
}

export const parseDirectRenderPath = (pathname: string): DirectRenderLocation | null => {
    const match = pathname.match(/^\/_render\/(\d+)(?:\/(.*))?\/?$/)
    if (!match) return null
    return {
        siteId: Number(match[1]),
        slugPath: decodeURIComponent(match[2] || '').replace(/\/$/, ''),
    }
}

export const buildResolvedRenderModel = async ({
    resolved, page, version, rawInheritance, themeCss = '',
}: {
    resolved: ResolvedRenderLocation
    page: any
    version: any
    rawInheritance: any
    themeCss?: string
}): Promise<RenderPageModel> => {
    const tenantId = resolved.tenantIdentifier
    const inheritance = transformInheritanceData(rawInheritance?.legacy || rawInheritance)
    const simulatedPath = `/${resolved.slugPath || ''}`
    const pathVariables = await buildPathVariablesContext(page, simulatedPath)
    const siteHostnames = page?.hostnames?.length
        ? page.hostnames
        : page?.cachedRootHostnames || page?.cached_root_hostnames || []
    const model = createPageRenderModel({
        layout: version?.codeLayout || page?.effectiveLayout?.name || 'main_layout',
        widgets: version?.widgets || {},
        inheritedWidgets: inheritance.inheritedWidgets,
        slotInheritanceRules: inheritance.slotInheritanceRules,
        themeCss,
        fontUrl: googleFontsStylesheetUrl(version?.effectiveTheme?.fonts || page?.effectiveTheme?.fonts),
        context: {
            tenantId,
            siteId: resolved.siteId,
            siteHostnames,
            pageId: resolved.pageId,
            versionId: resolved.versionId,
            pathVariables,
            simulatedPath,
            renderRoutePrefix: `/_render/${resolved.siteId}`,
            componentStyles: version?.effectiveTheme?.componentStyles
                || version?.effectiveTheme?.component_styles
                || {},
        },
    })
    return resolvePagePreviewModel(model)
}

export const loadResolvedRenderModel = async (resolved: ResolvedRenderLocation): Promise<RenderPageModel> => {
    const tenantId = resolved.tenantIdentifier
    const requestConfig = { headers: { 'X-Tenant-ID': tenantId } }
    const [pageResponse, versionResponse, inheritanceResponse]: any[] = await Promise.all([
        api.get(endpoints.pages.detail(resolved.pageId), requestConfig),
        api.get(endpoints.versions.pageVersionDetail(resolved.pageId, resolved.versionId), requestConfig),
        api.get(endpoints.pages.widgetInheritance(resolved.pageId), requestConfig),
    ])
    const page = pageResponse.data
    const version = versionResponse.data
    const themeId = version?.effectiveTheme?.id
        || version?.theme?.id
        || version?.theme
        || page?.effectiveTheme?.id
    let themeCss = ''
    if (themeId) {
        const response = await fetch(`/api/v1/webpages/themes/${themeId}/styles.css`, {
            credentials: 'same-origin',
            headers: { 'X-Tenant-ID': tenantId },
        })
        if (response.ok) themeCss = await response.text()
    }
    return buildResolvedRenderModel({
        resolved,
        page,
        version,
        rawInheritance: inheritanceResponse.data,
        themeCss,
    })
}

export const loadDirectRenderModel = async ({ siteId, slugPath }: DirectRenderLocation): Promise<RenderPageModel> => {
    // Resolve the site without a tenant header. A copied standalone URL can
    // be opened before an administrative tenant has been selected.
    const selectedTenantId = getCurrentTenantId()
    const resolutionResponse = await fetch(
        `${endpoints.pages.resolveRenderPath}${buildQueryParams({ site_id: siteId, path: slugPath })}`,
        {
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                ...(selectedTenantId ? { 'X-Tenant-ID': selectedTenantId } : {}),
            },
        },
    )
    const resolved: any = await resolutionResponse.json().catch(() => ({}))
    if (!resolutionResponse.ok) throw new Error(resolved.detail || 'Could not resolve this page.')
    return loadResolvedRenderModel(resolved)
}
