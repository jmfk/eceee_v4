/**
 * Theme CSS Manager
 * 
 * Singleton manager for theme CSS injection with reference counting.
 * Prevents CSS removal conflicts when multiple components use the same theme.
 * Only removes theme CSS when all components using it have unmounted.
 */

class ThemeCSSManager {
    constructor() {
        // Cache for theme CSS content
        this.themeCSSCache = new Map() // themeId -> cssContent

        // Track injected style elements
        this.injectedThemes = new Map() // themeId -> styleElement

        // Reference counting for each theme
        this.referenceCount = new Map() // themeId -> count

        // Track which components are using which themes (for debugging)
        this.componentRefs = new Map() // themeId -> Set of component IDs
    }

    /**
     * Register a component's use of a theme
     * Increments reference count and injects CSS if needed
     * @param {number} themeId - Theme ID
     * @param {string} cssContent - Theme CSS content
     * @param {string} scopeSelector - CSS selector to scope theme to
     * @param {string} componentId - Optional component identifier for debugging
     */
    register(themeId, cssContent, scopeSelector = '.theme-content', componentId = null) {
        if (!themeId || !cssContent) {
            console.warn('ThemeCSSManager: Cannot register theme without themeId and cssContent')
            return
        }

        // Increment reference count
        const currentCount = this.referenceCount.get(themeId) || 0
        this.referenceCount.set(themeId, currentCount + 1)

        // Track component reference
        if (componentId) {
            if (!this.componentRefs.has(themeId)) {
                this.componentRefs.set(themeId, new Set())
            }
            this.componentRefs.get(themeId).add(componentId)
        }

        // Cache CSS content
        this.themeCSSCache.set(themeId, cssContent)

        // Only inject if not already injected
        if (!this.injectedThemes.has(themeId)) {
            this.injectThemeCSS(themeId, cssContent, scopeSelector)
        }
    }

    /**
     * Unregister a component's use of a theme
     * Decrements reference count and removes CSS when count reaches zero
     * @param {number} themeId - Theme ID
     * @param {string} componentId - Optional component identifier for debugging
     */
    unregister(themeId, componentId = null) {
        if (!themeId) {
            return
        }

        // Decrement reference count
        const currentCount = this.referenceCount.get(themeId) || 0
        const newCount = Math.max(0, currentCount - 1)
        this.referenceCount.set(themeId, newCount)

        // Remove component reference
        if (componentId && this.componentRefs.has(themeId)) {
            this.componentRefs.get(themeId).delete(componentId)
        }

        // Only remove CSS when no components are using it
        if (newCount === 0) {
            this.removeThemeCSS(themeId)
            this.themeCSSCache.delete(themeId)
            this.componentRefs.delete(themeId)
        }
    }

    /**
     * Inject theme CSS into document head
     * @param {number} themeId - Theme ID
     * @param {string} cssContent - CSS content
     * @param {string} scopeSelector - CSS selector to scope theme to
     */
    injectThemeCSS(themeId, cssContent, scopeSelector = '.theme-content') {
        if (!cssContent) {
            return
        }

        const styleId = `theme-content-${themeId}`

        // Remove existing style element if present (shouldn't happen with ref counting)
        const existingStyle = document.getElementById(styleId)
        if (existingStyle) {
            existingStyle.remove()
        }

        // Create and inject new style element
        const styleElement = document.createElement('style')
        styleElement.id = styleId
        styleElement.setAttribute('data-theme-styles', 'true')
        styleElement.setAttribute('data-theme-id', String(themeId))
        styleElement.setAttribute('data-scope', scopeSelector)
        styleElement.textContent = cssContent

        document.head.appendChild(styleElement)

        // Track the injected element
        this.injectedThemes.set(themeId, styleElement)
    }

    /**
     * Remove theme CSS from document head
     * @param {number} themeId - Theme ID
     */
    removeThemeCSS(themeId) {
        const styleElement = this.injectedThemes.get(themeId)

        if (styleElement) {
            if (styleElement.parentNode) {
                styleElement.parentNode.removeChild(styleElement)
            }
            this.injectedThemes.delete(themeId)
        }
    }

    /**
     * Check if a theme is currently injected
     * @param {number} themeId - Theme ID
     * @returns {boolean}
     */
    isInjected(themeId) {
        return this.injectedThemes.has(themeId)
    }

    /**
     * Get reference count for a theme
     * @param {number} themeId - Theme ID
     * @returns {number}
     */
    getRefCount(themeId) {
        return this.referenceCount.get(themeId) || 0
    }

    /**
     * Get debug info about current state
     * @returns {Object}
     */
    getDebugInfo() {
        return {
            injectedThemes: Array.from(this.injectedThemes.keys()),
            referenceCounts: Object.fromEntries(this.referenceCount),
            componentRefs: Object.fromEntries(
                Array.from(this.componentRefs.entries()).map(([themeId, refs]) => [
                    themeId,
                    Array.from(refs)
                ])
            )
        }
    }
}

// Export singleton instance
export const themeCSSManager = new ThemeCSSManager()

// Export for debugging in console
if (typeof window !== 'undefined') {
    window.__themeCSSManager = themeCSSManager
}

