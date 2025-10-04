/**
 * useWidgetInheritance Hook
 * 
 * Fetches and manages widget inheritance data for a page
 */

import { useQuery } from '@tanstack/react-query'
import { pagesApi } from '../api'
import { transformInheritanceData } from '../utils/widgetMerging'

/**
 * Custom hook for fetching and managing widget inheritance
 * 
 * @param {number} pageId - ID of the current page
 * @param {boolean} enabled - Whether to fetch inheritance data (only if page has parent)
 * @returns {Object} Inheritance data and utilities
 */
export function useWidgetInheritance(pageId, enabled = true) {
    const {
        data: rawInheritanceData,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['widget-inheritance', pageId],
        queryFn: async () => {
            if (!pageId || pageId === 'new') {
                return null
            }
            return await pagesApi.getWidgetInheritance(pageId)
        },
        enabled: enabled && pageId && pageId !== 'new',
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1
    })

    // Transform API data to component-friendly format
    const inheritanceData = rawInheritanceData
        ? transformInheritanceData(rawInheritanceData)
        : {
            inheritedWidgets: {},
            slotInheritanceRules: {},
            hasInheritedContent: false,
            parentId: null,
            hasParent: false
        }

    return {
        // Transformed data
        inheritedWidgets: inheritanceData.inheritedWidgets,
        slotInheritanceRules: inheritanceData.slotInheritanceRules,
        hasInheritedContent: inheritanceData.hasInheritedContent,
        parentId: inheritanceData.parentId,
        hasParent: inheritanceData.hasParent,

        // Query state
        isLoading,
        error,
        refetch,

        // Raw data (if needed for debugging)
        rawData: rawInheritanceData
    }
}

export default useWidgetInheritance

