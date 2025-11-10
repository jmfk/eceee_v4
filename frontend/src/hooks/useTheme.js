/**
 * Theme Application Hook
 * 
 * Provides theme CSS injection for content editors and widget previews.
 * Loads complete CSS from backend's ThemeCSSGenerator instead of generating client-side.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { themesApi, pagesApi } from '../api'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'

/**
 * Hook for applying themes to content areas
 * @param {Object} options - Configuration options
 * @param {number} options.themeId - Explicit theme ID to apply
 * @param {number} options.pageId - Page ID to fetch effectiveTheme from (includes inheritance)
 * @param {string} options.scopeSelector - CSS selector to scope theme to (default: '.theme-content')
 * @param {boolean} options.enabled - Whether theme application is enabled
 * @returns {Object} Theme application utilities
 */
export const useTheme = ({
    themeId = null,
    pageId = null,
    scopeSelector = '.theme-content',
    enabled = true
} = {}) => {
    const injectedStyleRef = useRef(null)
    const currentThemeIdRef = useRef(null)

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
        queryKey: ['theme-css', theme?.id],
        queryFn: async () => {
            if (!theme?.id) return null

            // Fetch complete CSS from backend endpoint
            const url = `/api/v1/webpages/themes/${theme.id}/styles.css`
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

    /**
     * Inject theme CSS into document
     */
    const injectThemeCSS = useCallback((css, themeId) => {
        if (!css) {
            return
        }

        // Create unique style element ID
        const styleId = `theme-content-${themeId || 'default'}`

        // Remove existing theme styles
        const existingStyle = document.getElementById(styleId)
        if (existingStyle) {
            existingStyle.remove()
        }

        // Create and inject new style element
        const styleElement = document.createElement('style')
        styleElement.id = styleId
        styleElement.setAttribute('data-theme-styles', 'true')
        styleElement.setAttribute('data-theme-id', String(themeId || 'default'))
        styleElement.setAttribute('data-scope', scopeSelector)
        styleElement.textContent = css

        document.head.appendChild(styleElement)
        injectedStyleRef.current = styleElement

    }, [scopeSelector])

    /**
     * Remove theme CSS from document
     */
    const removeThemeCSS = useCallback(() => {
        if (injectedStyleRef.current) {
            injectedStyleRef.current.remove()
            injectedStyleRef.current = null
        }

        // Also remove any orphaned theme styles
        const orphanedStyles = document.querySelectorAll('[data-theme-styles="true"]')
        orphanedStyles.forEach(style => {
            const themeId = style.getAttribute('data-theme-id')
            if (themeId && themeId !== String(currentThemeIdRef.current)) {
                style.remove()
            }
        })
    }, [])

    /**
     * Apply theme CSS when theme CSS is loaded
     */
    useEffect(() => {
        if (!enabled || !theme || !themeCSS || isLoading || fetchingCSS) {
            return
        }

        // Skip if same theme is already applied
        if (currentThemeIdRef.current === theme.id) {
            return
        }

        // Remove previous theme CSS
        removeThemeCSS()

        // Inject new theme CSS
        injectThemeCSS(themeCSS, theme.id)
        currentThemeIdRef.current = theme.id

    }, [theme, themeCSS, enabled, isLoading, fetchingCSS, injectThemeCSS, removeThemeCSS])

    /**
     * Cleanup on unmount or when disabled
     */
    useEffect(() => {
        if (!enabled) {
            removeThemeCSS()
            currentThemeIdRef.current = null
        }

        return () => {
            removeThemeCSS()
            currentThemeIdRef.current = null
        }
    }, [enabled, removeThemeCSS])

    /**
     * Manual theme application (for dynamic theme switching)
     * Fetches CSS from backend and applies it
     */
    const applyTheme = useCallback(async (themeData) => {
        if (!enabled || !themeData?.id) return

        try {
            // Fetch complete CSS from backend
            const response = await fetch(`/api/v1/webpages/themes/${themeData.id}/styles.css`)
            if (!response.ok) {
                throw new Error(`Failed to fetch theme CSS: ${response.statusText}`)
            }
            const css = await response.text()

            removeThemeCSS()
            injectThemeCSS(css, themeData.id)
            currentThemeIdRef.current = themeData.id
        } catch (error) {
            // Silent fail - error already logged by React Query
        }
    }, [enabled, injectThemeCSS, removeThemeCSS])

    /**
     * Get CSS class name for theme content areas
     */
    const getThemeClassName = useCallback(() => {
        return scopeSelector.replace('.', '')
    }, [scopeSelector])

    return {
        theme,
        currentTheme: theme,  // Alias for backward compatibility
        isLoading: (isLoading || fetchingCSS) && enabled,
        error: error && enabled ? error : null,
        applyTheme,
        removeTheme: removeThemeCSS,
        getThemeClassName,
        isThemeApplied: !!injectedStyleRef.current,
        // Keep for backward compatibility but fetch from backend instead
        generateThemeCSS: async (themeData) => {
            if (!themeData?.id) return ''
            try {
                const response = await fetch(`/api/v1/webpages/themes/${themeData.id}/styles.css`)
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
