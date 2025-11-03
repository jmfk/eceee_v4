/**
 * Theme Application Hook
 * 
 * Provides theme CSS injection for content editors and widget previews.
 * Applies theme CSS variables and custom CSS only to content areas,
 * not affecting the admin interface styling.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { themesApi } from '../api'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'

/**
 * Hook for applying themes to content areas
 * @param {Object} options - Configuration options
 * @param {number} options.themeId - Theme ID to apply
 * @param {string} options.scopeSelector - CSS selector to scope theme to (default: '.theme-content')
 * @param {boolean} options.enabled - Whether theme application is enabled
 * @returns {Object} Theme application utilities
 */
export const useTheme = ({
    themeId = null,
    scopeSelector = '.theme-content',
    enabled = true
} = {}) => {
    const injectedStyleRef = useRef(null)
    const currentThemeIdRef = useRef(null)

    // Try to get theme from UDC if no themeId provided
    let udcTheme = null
    try {
        const { state } = useUnifiedData()

        const currentVersionId = state.metadata.currentVersionId
        if (currentVersionId) {
            const version = state.versions[currentVersionId]
            
            // PRIORITY 1: Use effectiveTheme if available (includes inherited theme)
            if (version?.effectiveTheme) {
                udcTheme = version.effectiveTheme
            } 
            // PRIORITY 2: Fallback to explicit theme by ID
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

    // Fetch default theme when no themeId provided
    const { data: defaultTheme, isLoading: fetchingDefault } = useQuery({
        queryKey: ['default-theme'],
        queryFn: async () => {
            const response = await themesApi.list();
            const themes = Array.isArray(response) ? response : response.results || [];
            return themes.find(t => t.isDefault === true);
        },
        enabled: !themeId && enabled,
        staleTime: 5 * 60 * 1000
    });

    // Use fetched theme if available, otherwise use UDC theme, otherwise use default theme
    const theme = fetchedTheme || udcTheme || defaultTheme
    const isLoading = fetchingTheme || fetchingDefault

    /**
     * Generate CSS content from theme data
     */
    const generateThemeCSS = useCallback((themeData, scope = '.theme-content') => {
        if (!themeData) return ''

        const { cssVariables = {}, customCss = '' } = themeData

        // Generate CSS variables scoped to content areas
        const variablesCSS = Object.keys(cssVariables).length > 0 ? `
${scope} {
${Object.entries(cssVariables)
                .map(([key, value]) => `  --${key}: ${value};`)
                .join('\n')}
}` : ''

        // Generate custom CSS scoped to content areas
        const scopedCustomCSS = customCss ?
            customCss.split('}').map(rule => {
                if (rule.trim() && !rule.includes('@')) {
                    // Add scope to regular CSS rules
                    const selector = rule.split('{')[0].trim()
                    const styles = rule.split('{')[1] || ''

                    if (selector && styles) {
                        // Scope the selector to content areas only
                        const scopedSelector = selector.split(',')
                            .map(s => s.trim())
                            .map(s => {
                                // Don't double-scope if already scoped
                                if (s.includes(scope.replace('.', ''))) return s
                                // Add scope prefix
                                return `${scope} ${s}`
                            })
                            .join(', ')

                        return `${scopedSelector} { ${styles} }`
                    }
                }
                return rule.includes('@') ? rule + '}' : '' // Keep @rules as-is
            }).filter(Boolean).join('\n') : ''

        return [variablesCSS, scopedCustomCSS].filter(Boolean).join('\n\n')
    }, [])

    /**
     * Inject theme CSS into document
     */
    const injectThemeCSS = useCallback((themeData, scope) => {
        const cssContent = generateThemeCSS(themeData, scope)

        if (!cssContent) {
            return
        }

        // Create unique style element ID
        const styleId = `theme-content-${themeData.id || 'default'}`

        // Remove existing theme styles
        const existingStyle = document.getElementById(styleId)
        if (existingStyle) {
            existingStyle.remove()
        }

        // Create and inject new style element
        const styleElement = document.createElement('style')
        styleElement.id = styleId
        styleElement.setAttribute('data-theme-styles', 'true')
        styleElement.setAttribute('data-theme-id', String(themeData.id || 'default'))
        styleElement.setAttribute('data-scope', scope)
        styleElement.textContent = cssContent

        document.head.appendChild(styleElement)
        injectedStyleRef.current = styleElement

    }, [generateThemeCSS])

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
     * Apply theme CSS when theme data changes
     */
    useEffect(() => {
        if (!enabled || !theme || isLoading) {
            return
        }

        // Skip if same theme is already applied
        if (currentThemeIdRef.current === theme.id) {
            return
        }

        // Remove previous theme CSS
        removeThemeCSS()

        // Inject new theme CSS
        injectThemeCSS(theme, scopeSelector)
        currentThemeIdRef.current = theme.id

    }, [theme, scopeSelector, enabled, isLoading, injectThemeCSS, removeThemeCSS])

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
     */
    const applyTheme = useCallback((themeData) => {
        if (!enabled || !themeData) return

        removeThemeCSS()
        injectThemeCSS(themeData, scopeSelector)
        currentThemeIdRef.current = themeData.id
    }, [enabled, scopeSelector, injectThemeCSS, removeThemeCSS])

    /**
     * Get CSS class name for theme content areas
     */
    const getThemeClassName = useCallback(() => {
        return scopeSelector.replace('.', '')
    }, [scopeSelector])

    return {
        theme,
        currentTheme: theme,  // Alias for backward compatibility
        isLoading: isLoading && enabled,
        error: error && enabled ? error : null,
        applyTheme,
        removeTheme: removeThemeCSS,
        getThemeClassName,
        isThemeApplied: !!injectedStyleRef.current,
        generateThemeCSS: (themeData) => generateThemeCSS(themeData, scopeSelector)
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
