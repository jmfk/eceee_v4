/** Theme data and editor-only stylesheet hooks. */

import { useContext, useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pagesApi } from '../api'
import { endpoints } from '../api/endpoints'
import UnifiedDataContext from '../contexts/unified-data/context/UnifiedDataContext'
import { themeCSSManager } from '../utils/themeCSSManager'

export const getFrontendThemeCSSUrl = (themeData) => {
    const params = new URLSearchParams({ frontend_scoped: 'true' })
    const version = Date.parse(themeData?.updatedAt || themeData?.updated_at)
    if (!Number.isNaN(version)) params.set('v', String(version))
    return `/api/v1/webpages/themes/${themeData.id}/styles.css?${params.toString()}`
}

export const getEditorThemeCSSUrl = (versionId) => endpoints.versions.editorStyles(versionId)

export const supportsCSSScope = () => {
    if (typeof CSSStyleSheet === 'undefined') return false
    try {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync('@scope (.scope-test) { .child { color: red; } }')
        return sheet.cssRules.length === 1 && sheet.cssRules[0].cssText.trimStart().startsWith('@scope')
    } catch {
        return false
    }
}

/** Fetch the effective theme configuration without injecting CSS. */
export const useThemeData = ({ pageId = null, enabled = true } = {}) => {
    const { data: pageData, isLoading, error } = useQuery({
        queryKey: ['page-for-theme', pageId],
        queryFn: () => pagesApi.get(pageId),
        enabled: enabled && !!pageId,
        staleTime: 5 * 60 * 1000,
    })

    const udcContext = useContext(UnifiedDataContext)
    const udcTheme = useMemo(() => {
        if (!udcContext) return null
        const { state } = udcContext
        const version = state.versions[state.metadata.currentVersionId]
        return version?.effectiveTheme || (version?.theme ? state.themes[version.theme] : null)
    }, [udcContext])

    const theme = pageData?.effectiveTheme || udcTheme
    return {
        theme,
        currentTheme: theme,
        isLoading: isLoading && enabled,
        error: error && enabled ? error : null,
    }
}

/** Fetch and inject the backend-compiled stylesheet for one page version canvas. */
export const useEditorThemeStyles = ({ versionId = null, revision = null, enabled = true } = {}) => {
    const componentIdRef = useRef(`editor-theme-${Math.random().toString(36).slice(2, 11)}`)
    const styleKey = versionId ? `version-${versionId}` : null
    const scopeSupported = supportsCSSScope()

    const unsupportedError = enabled && versionId && !scopeSupported
        ? new Error('This browser cannot safely isolate site CSS. Theme styling is disabled in the editor.')
        : null

    const { data: css, isLoading, error } = useQuery({
        queryKey: ['editor-theme-css', versionId, revision],
        queryFn: async () => {
            const response = await fetch(getEditorThemeCSSUrl(versionId))
            if (!response.ok) throw new Error(`Failed to fetch editor CSS: ${response.statusText}`)
            return response.text()
        },
        enabled: enabled && !!versionId && scopeSupported,
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
    })

    useEffect(() => {
        if (!enabled || !styleKey || !css || !scopeSupported) return undefined
        const componentId = componentIdRef.current
        themeCSSManager.register(styleKey, css, '.eceee-theme-scope', componentId)
        return () => themeCSSManager.unregister(styleKey, componentId)
    }, [css, enabled, scopeSupported, styleKey])

    return {
        isLoading: isLoading && enabled,
        error: unsupportedError || (error && enabled ? error : null),
        isThemeApplied: styleKey ? themeCSSManager.isInjected(styleKey) : false,
        scopeId: styleKey,
    }
}

/** Backwards-compatible data hook. CSS ownership now belongs to the editor canvas. */
export const useTheme = useThemeData
export const useWidgetTheme = useThemeData
export const useContentEditorTheme = useThemeData

export default useThemeData
