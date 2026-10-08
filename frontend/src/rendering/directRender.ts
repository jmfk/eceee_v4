import { api } from '../api/client'
import { endpoints } from '../api/endpoints'
import { buildQueryParams } from '../api/utils'
import { buildPathVariablesContext } from '../utils/pathParser'
import { transformInheritanceData } from '../utils/widgetMerging'
import { resolvePagePreviewModel } from '../components/resolvePagePreviewModel'
import { createPageRenderModel } from './adapters'
import { buildThemeCSS } from '../utils/editorThemeCSS'
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
    pathPatternPath?: string
}

export const parseDirectRenderPath = (pathname: string): DirectRenderLocation | null => {
    const match = pathname.match(/^\/_render\/(\d+)(?:\/(.*))?\/?$/)
    if (!match) return null
    try {
        return {
            siteId: Number(match[1]),
            slugPath: decodeURIComponent(match[2] || '').replace(/\/$/, ''),
        }
    } catch {
        return null
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
    const pathVariables = await buildPathVariablesContext(page, resolved.pathPatternPath || simulatedPath)
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
    const theme = version?.effectiveTheme
        || (typeof version?.theme === 'object' ? version.theme : null)
        || page?.effectiveTheme
    const themeCss = buildThemeCSS({
        theme,
        pageCssVariables: page?.pageCssVariables ?? page?.page_css_variables
            ?? version?.pageCssVariables ?? version?.page_css_variables,
        pageCustomCss: page?.pageCustomCss ?? page?.page_custom_css
            ?? version?.pageCustomCss ?? version?.page_custom_css,
        enableCssInjection: page?.enableCssInjection ?? page?.enable_css_injection
            ?? version?.enableCssInjection ?? version?.enable_css_injection ?? true,
    })
    return buildResolvedRenderModel({
        resolved,
        page,
        version,
        rawInheritance: inheritanceResponse.data,
        themeCss,
    })
}

export const loadDirectRenderModel = async ({ siteId, slugPath }: DirectRenderLocation): Promise<RenderPageModel> => {
    try {
        const response: any = await api.get(
            `${endpoints.pages.resolveRenderPath}${buildQueryParams({ site_id: siteId, path: slugPath })}`,
            {
                skipSessionQueue: true,
                skipTenantHeader: true,
            },
        )
        return loadResolvedRenderModel(response?.data || response)
    } catch (error: any) {
        throw new Error(error?.response?.data?.detail || 'Could not resolve this page.')
    }
}
