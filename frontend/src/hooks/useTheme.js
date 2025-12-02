/**
 * Theme Application Hook
 * 
 * Provides theme CSS injection for content editors and widget previews.
 * Loads complete CSS from backend's ThemeCSSGenerator instead of generating client-side.
 * Uses ThemeCSSManager for reference counting to prevent CSS removal conflicts.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { themesApi, pagesApi } from '../api'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { themeCSSManager } from '../utils/themeCSSManager'

/**
 * Hook for applying themes to content areas
 * @param {Object} options - Configuration options
 * @param {number} options.themeId - Explicit theme ID to apply
 * @param {number} options.pageId - Page ID to fetch effectiveTheme from (includes inheritance)
 * @param {string} options.scopeSelector - CSS selector to scope theme to (default: '.cms-content')
 * @param {boolean} options.enabled - Whether theme application is enabled
 * @returns {Object} Theme application utilities
 */
export const useTheme = ({
    themeId = null,
    pageId = null,
    scopeSelector = '.cms-content',
    enabled = true
} = {}) => {
    const currentThemeIdRef = useRef(null)
    const componentIdRef = useRef(`theme-user-${Math.random().toString(36).substr(2, 9)}`)

    // Fetch page data to get effectiveTheme (includes inheritance)
    const { data: pageData, isLoading: fetchingPage } = useQuery({
        queryKey: ['page-for-theme', pageId],
        queryFn: async () => {
            const response = await pagesApi.get(pageId);
            return response;
        },
        enabled: enabled && !!pageId && !themeId,
        staleTime: 5 * 60 * 1000
    });

    const pageTheme = pageData?.effectiveTheme;

    // Try to get theme from UDC if no pageId or themeId provided
    let udcTheme = null
    try {
        const { state } = useUnifiedData()

        const currentVersionId = state.metadata.currentVersionId

        if (currentVersionId) {
            const version = state.versions[currentVersionId]

            // Use effectiveTheme if available (includes inherited theme)
            if (version?.effectiveTheme) {
                udcTheme = version.effectiveTheme
            }
            // Fallback to explicit theme by ID
            else if (version?.theme) {
                const pageThemeId = version.theme
                // Try to find theme in UDC themes cache
                udcTheme = state.themes[pageThemeId]
            }
        }

        // Fallback to default theme from state
        if (!udcTheme) {
            const defaultThemeId = Object.keys(state.themes).find(id =>
                state.themes[id]?.isDefault === true
            )
            if (defaultThemeId) {
                udcTheme = state.themes[defaultThemeId]
            }
        }
    } catch (e) {
        // UDC not available (outside of provider context), continue without it
    }

    // Fetch theme data when themeId changes
    const { data: fetchedTheme, isLoading: fetchingTheme, error } = useQuery({
        queryKey: ['theme', themeId],
        queryFn: () => themesApi.get(themeId),
        enabled: enabled && !!themeId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
    })

    // Fetch default theme when no themeId or pageId provided
    const { data: defaultTheme, isLoading: fetchingDefault } = useQuery({
        queryKey: ['default-theme'],
        queryFn: async () => {
            const response = await themesApi.list();
            const themes = Array.isArray(response) ? response : response.results || [];
            return themes.find(t => t.isDefault === true);
        },
        enabled: !themeId && !pageId && enabled,
        staleTime: 5 * 60 * 1000
    });

    // PRIORITY 1: Explicit themeId (fetched)
    // PRIORITY 2: Page's effectiveTheme (from page API - includes inheritance)
    // PRIORITY 3: UDC effectiveTheme (fallback)
    // PRIORITY 4: Default theme
    const theme = fetchedTheme || pageTheme || udcTheme || defaultTheme
    const isLoading = fetchingTheme || fetchingPage || fetchingDefault

    // Fetch complete CSS from backend's ThemeCSSGenerator
    const { data: themeCSS, isLoading: fetchingCSS, error: cssError } = useQuery({
        queryKey: ['theme-css', theme?.id, 'frontend-scoped'],
        queryFn: async () => {
            if (!theme?.id) return null

            // Fetch complete CSS from backend endpoint with frontend scoping
            const url = `/api/v1/webpages/themes/${theme.id}/styles.css?frontend_scoped=true`
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Failed to fetch theme CSS: ${response.statusText}`)
            }
            return await response.text()
        },
        enabled: enabled && !!theme?.id,
        staleTime: 10 * 60 * 1000, // 10 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
    })

    // Generate component ID for reference tracking
    const componentId = useMemo(() => componentIdRef.current, [])

    /**
     * Register/unregister theme with CSS manager when theme changes
     */
    useEffect(() => {
        if (!enabled || !theme || !themeCSS || isLoading || fetchingCSS) {
            return
        }

        const newThemeId = theme.id

        // If theme changed, unregister old theme first
        if (currentThemeIdRef.current && currentThemeIdRef.current !== newThemeId) {
            themeCSSManager.unregister(currentThemeIdRef.current, componentId)
        }

        // Register new theme with CSS manager
        themeCSSManager.register(newThemeId, themeCSS, scopeSelector, componentId)
        currentThemeIdRef.current = newThemeId

        // Cleanup: unregister when component unmounts or theme changes
        return () => {
            if (currentThemeIdRef.current) {
                themeCSSManager.unregister(currentThemeIdRef.current, componentId)
            }
        }
    }, [theme, themeCSS, enabled, isLoading, fetchingCSS, scopeSelector, componentId])

    /**
     * Cleanup on disable
     */
    useEffect(() => {
        if (!enabled && currentThemeIdRef.current) {
            themeCSSManager.unregister(currentThemeIdRef.current, componentId)
            currentThemeIdRef.current = null
        }
    }, [enabled, componentId])

    /**
     * Manual theme application (for dynamic theme switching)
     * Fetches CSS from backend and applies it
     */
    const applyTheme = useCallback(async (themeData) => {
        if (!enabled || !themeData?.id) return

        try {
            // Fetch complete CSS from backend
            const response = await fetch(`/api/v1/webpages/themes/${themeData.id}/styles.css?frontend_scoped=true`)
            if (!response.ok) {
                throw new Error(`Failed to fetch theme CSS: ${response.statusText}`)
            }
            const css = await response.text()

            // Unregister old theme
            if (currentThemeIdRef.current) {
                themeCSSManager.unregister(currentThemeIdRef.current, componentId)
            }

            // Register new theme
            themeCSSManager.register(themeData.id, css, scopeSelector, componentId)
            currentThemeIdRef.current = themeData.id
        } catch (error) {
            console.error('Failed to apply theme:', error)
        }
    }, [enabled, scopeSelector, componentId])

    /**
     * Get CSS class name for theme content areas
     */
    const getThemeClassName = useCallback(() => {
        return scopeSelector.replace('.', '')
    }, [scopeSelector])

    /**
     * Remove theme CSS (for backward compatibility)
     */
    const removeTheme = useCallback(() => {
        if (currentThemeIdRef.current) {
            themeCSSManager.unregister(currentThemeIdRef.current, componentId)
            currentThemeIdRef.current = null
        }
    }, [componentId])

    return {
        theme,
        currentTheme: theme,  // Alias for backward compatibility
        isLoading: (isLoading || fetchingCSS) && enabled,
        error: error && enabled ? error : null,
        applyTheme,
        removeTheme,
        getThemeClassName,
        isThemeApplied: theme?.id ? themeCSSManager.isInjected(theme.id) : false,
        // Keep for backward compatibility but fetch from backend instead
        generateThemeCSS: async (themeData) => {
            if (!themeData?.id) return ''
            try {
                const response = await fetch(`/api/v1/webpages/themes/${themeData.id}/styles.css?frontend_scoped=true`)
                if (!response.ok) return ''
                return await response.text()
            } catch {
                return ''
            }
        }
    }
}

/**
 * Hook for applying themes specifically to widget content
 * Uses a widget-specific scope selector
 */
export const useWidgetTheme = (options = {}) => {
    return useTheme({
        scopeSelector: '.widget-content',
        ...options
    })
}

/**
 * Hook for applying themes specifically to content editors
 * Uses a content-editor-specific scope selector  
 */
export const useContentEditorTheme = (options = {}) => {
    return useTheme({
        scopeSelector: '.content-editor-theme',
        ...options
    })
}

export default useTheme
