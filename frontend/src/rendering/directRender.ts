import { api } from '../api/client'
import { endpoints } from '../api/endpoints'
import { buildQueryParams } from '../api/utils'
import { buildPathVariablesContext } from '../utils/pathParser'
import { transformInheritanceData } from '../utils/widgetMerging'
import { resolvePagePreviewModel } from '../components/resolvePagePreviewModel'
import { createPageRenderModel } from './adapters'
import { compileBrowserRenderStyles } from './browserThemeStyles'
import { getCurrentTenantId } from '../utils/tenant'
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

export interface VersionRenderLocation {
    pageId: number
    versionId: number
    tenantIdentifier?: string
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

export const parseVersionRenderPath = (pathname: string, search = ''): VersionRenderLocation | null => {
    const match = pathname.match(/^\/_render-version\/(\d+)\/(\d+)\/?$/)
    if (!match) return null
    const tenantIdentifier = new URLSearchParams(search).get('workspace') || undefined
    return { pageId: Number(match[1]), versionId: Number(match[2]), ...(tenantIdentifier ? { tenantIdentifier } : {}) }
}

export const buildResolvedRenderModel = async ({
    resolved, page, version, rawInheritance,
}: {
    resolved: ResolvedRenderLocation
    page: any
    version: any
    rawInheritance: any
}): Promise<RenderPageModel> => {
    const tenantId = resolved.tenantIdentifier
    const inheritance = transformInheritanceData(rawInheritance?.legacy || rawInheritance)
    const simulatedPath = `/${resolved.slugPath || ''}`
    const pathVariables = await buildPathVariablesContext(page, resolved.pathPatternPath || simulatedPath)
    const siteHostnames = page?.hostnames?.length
        ? page.hostnames
        : page?.cachedRootHostnames || page?.cached_root_hostnames || []
    const theme = version?.effectiveTheme
        || (typeof version?.theme === 'object' ? version.theme : null)
        || page?.effectiveTheme
    const compiledStyles = await compileBrowserRenderStyles({ theme, page, version })
    const model = createPageRenderModel({
        layout: version?.layoutKey || version?.codeLayout || page?.effectiveLayout?.name || 'main_layout',
        layoutDefinition: (() => {
            const theme = version?.effectiveTheme || page?.effectiveTheme
            const key = version?.layoutKey || version?.codeLayout || page?.effectiveLayout?.name
                || theme?.layouts?.default_layout_key || theme?.layouts?.defaultLayoutKey || 'main_layout'
            return theme?.layouts?.items?.find((candidate: any) => candidate.key === key) || null
        })(),
        layoutDefinitionRequired: Boolean((version?.effectiveTheme || page?.effectiveTheme)?.layouts),
        layoutBreakpoints: version?.effectiveTheme?.breakpoints || page?.effectiveTheme?.breakpoints,
        widgets: version?.widgets || {},
        inheritedWidgets: inheritance.inheritedWidgets,
        slotInheritanceRules: inheritance.slotInheritanceRules,
        themeCss: compiledStyles.css,
        fontUrl: compiledStyles.fontUrl,
        context: {
            tenantId,
            siteId: resolved.siteId,
            siteHostnames,
            pageId: resolved.pageId,
            versionId: resolved.versionId,
            pathVariables,
            simulatedPath,
            renderRoutePrefix: `/_render/${resolved.siteId}`,
            themeWidgetTypes: theme?.widgetTypes || theme?.widget_types,
            componentStyles: theme?.componentStyles
                || theme?.component_styles
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
    return buildResolvedRenderModel({
        resolved,
        page,
        version,
        rawInheritance: inheritanceResponse.data,
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

export const loadVersionRenderModel = async ({ pageId, versionId, tenantIdentifier }: VersionRenderLocation): Promise<RenderPageModel> => {
    const tenantId = tenantIdentifier || getCurrentTenantId()
    const requestConfig = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : undefined
    const [pageResponse, versionResponse, inheritanceResponse]: any[] = await Promise.all([
        api.get(endpoints.pages.detail(pageId), requestConfig),
        api.get(endpoints.versions.pageVersionDetail(pageId, versionId), requestConfig),
        api.get(endpoints.pages.widgetInheritance(pageId, versionId), requestConfig),
    ])
    const page = pageResponse.data || pageResponse
    const version = versionResponse.data || versionResponse
    const inheritance = inheritanceResponse.data || inheritanceResponse
    const siteId = Number(
        page?.cachedRootId
        || page?.cached_root_id
        || page?.breadcrumbs?.[0]?.id
        || (!page?.parentId && !page?.parent_id ? page?.id : 0),
    )
    if (!siteId) throw new Error('Could not resolve the site for this page version.')

    const rawPath = String(page?.cachedPath || page?.cached_path || page?.absoluteUrl || page?.slug || '')
    const slugPath = rawPath.split('?')[0].replace(/^\/+|\/+$/g, '')
    const theme = inheritance?.effectiveTheme
        || version?.effectiveTheme
        || (typeof version?.theme === 'object' ? version.theme : null)
        || page?.effectiveTheme
    const renderVersion = {
        ...version,
        effectiveTheme: theme,
        layoutKey: version?.layoutKey || version?.codeLayout || inheritance?.effectiveLayoutKey,
    }
    return buildResolvedRenderModel({
        resolved: {
            tenantIdentifier: tenantId,
            siteId,
            slugPath,
            pageId,
            versionId,
        },
        page,
        version: renderVersion,
        rawInheritance: inheritance,
    })
}
