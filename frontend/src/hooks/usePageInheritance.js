/**
 * Unified Page Inheritance Hook
 * 
 * Provides a single interface for accessing all types of inheritance data:
 * - Widget inheritance (from parent pages)
 * - Layout inheritance (code layouts)
 * - Theme inheritance (styling)
 * 
 * This hook combines data from multiple sources:
 * - Page detail API (layout + theme inheritance info)
 * - Widget inheritance API (widget tree data)
 * 
 * Benefits:
 * - Single source of truth for inheritance data
 * - Better performance (backend computes, frontend consumes)
 * - Consistent data structure
 * - Simplified component logic
 * 
 * @module hooks/usePageInheritance
 */

import { useQuery } from '@tanstack/react-query'
import { pagesApi } from '../api'
import { useWidgetInheritance } from './useWidgetInheritance'

/**
 * Hook for accessing unified page inheritance data
 * 
 * @param {number|string} pageId - ID of the page to get inheritance for
 * @param {Object} options - Hook configuration options
 * @param {boolean} options.enabled - Whether to fetch data (default: true)
 * @param {boolean} options.includeWidgets - Whether to include widget inheritance (default: true)
 * @param {number} options.staleTime - Query stale time in ms (default: 0 for page data)
 * @returns {Object} Unified inheritance data and utilities
 */
export function usePageInheritance(pageId, options = {}) {
    const {
        enabled = true,
        includeWidgets = true,
        staleTime = 0,
    } = options

    // Get page data (includes layout + theme inheritance info)
    const pageQuery = useQuery({
        queryKey: ['page', pageId],
        queryFn: () => pagesApi.get(pageId),
        enabled: enabled && pageId && pageId !== 'new',
        staleTime: staleTime,
        retry: 1
    })

    // Get widget inheritance (separate call for freshness)
    const widgetInheritance = useWidgetInheritance(
        pageId, 
        enabled && includeWidgets
    )

    // Build unified inheritance structure
    const inheritance = {
        // Widget inheritance data
        widgets: {
            inherited: widgetInheritance.inheritedWidgets || {},
            rules: widgetInheritance.slotInheritanceRules || {},
            hasContent: widgetInheritance.hasInheritedContent || false,
            parentId: widgetInheritance.parentId || null,
            hasParent: widgetInheritance.hasParent || false,
        },

        // Layout inheritance data
        layout: {
            effective: pageQuery.data?.effectiveLayout || null,
            inheritanceInfo: pageQuery.data?.layoutInheritanceInfo || null,
            chain: pageQuery.data?.layoutInheritanceInfo?.inheritanceChain || [],
            inheritedFrom: pageQuery.data?.layoutInheritanceInfo?.inheritedFrom || null,
            type: pageQuery.data?.layoutInheritanceInfo?.layoutType || null,
        },

        // Theme inheritance data (NEW!)
        theme: {
            effective: pageQuery.data?.effectiveTheme || null,
            inheritanceInfo: pageQuery.data?.themeInheritanceInfo || null,
            chain: pageQuery.data?.themeInheritanceInfo?.inheritanceChain || [],
            inheritedFrom: pageQuery.data?.themeInheritanceInfo?.inheritedFrom || null,
            overrideOptions: pageQuery.data?.themeInheritanceInfo?.overrideOptions || [],
        },

        // Combined query state
        isLoading: pageQuery.isLoading || (includeWidgets && widgetInheritance.isLoading),
        error: pageQuery.error || (includeWidgets && widgetInheritance.error),
        
        // Refetch all data
        refetch: async () => {
            await pageQuery.refetch()
            if (includeWidgets) {
                await widgetInheritance.refetch()
            }
        },

        // Raw data access (for debugging or advanced use cases)
        _raw: {
            pageData: pageQuery.data,
            widgetData: includeWidgets ? widgetInheritance.rawData : null,
        }
    }

    return inheritance
}

/**
 * Hook variant that focuses on widget inheritance only
 * Useful when you don't need layout/theme data
 */
export function useWidgetInheritanceOnly(pageId, options = {}) {
    return usePageInheritance(pageId, {
        ...options,
        includeWidgets: true
    }).widgets
}

/**
 * Hook variant that focuses on theme inheritance only
 * Useful for theme selectors that don't need widget data
 */
export function useThemeInheritanceOnly(pageId, options = {}) {
    const result = usePageInheritance(pageId, {
        ...options,
        includeWidgets: false
    })
    
    return {
        ...result.theme,
        isLoading: result.isLoading,
        error: result.error,
        refetch: result.refetch
    }
}

/**
 * Hook variant that focuses on layout inheritance only
 * Useful for layout selectors that don't need widget data
 */
export function useLayoutInheritanceOnly(pageId, options = {}) {
    const result = usePageInheritance(pageId, {
        ...options,
        includeWidgets: false
    })
    
    return {
        ...result.layout,
        isLoading: result.isLoading,
        error: result.error,
        refetch: result.refetch
    }
}

/**
 * Get a summary of all inherited content for a page
 * Useful for displaying inheritance status badges
 */
export function useInheritanceSummary(pageId, options = {}) {
    const inheritance = usePageInheritance(pageId, options)

    return {
        hasAnyInheritedContent: 
            inheritance.widgets.hasContent ||
            !!inheritance.layout.inheritedFrom ||
            !!inheritance.theme.inheritedFrom,
        
        hasInheritedWidgets: inheritance.widgets.hasContent,
        hasInheritedLayout: !!inheritance.layout.inheritedFrom,
        hasInheritedTheme: !!inheritance.theme.inheritedFrom,
        
        parentPageId: inheritance.widgets.parentId,
        
        summary: {
            widgets: inheritance.widgets.hasContent ? 'inherited' : 'local',
            layout: inheritance.layout.inheritedFrom 
                ? `inherited from ${inheritance.layout.inheritedFrom.title}` 
                : 'local',
            theme: inheritance.theme.inheritedFrom 
                ? `inherited from ${inheritance.theme.inheritedFrom.title}` 
                : 'local',
        },

        isLoading: inheritance.isLoading,
        error: inheritance.error,
    }
}

export default usePageInheritance








