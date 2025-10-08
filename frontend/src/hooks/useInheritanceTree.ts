/**
 * useInheritanceTree Hook
 * 
 * Fetches and manages widget inheritance tree data for a page.
 * Replaces the old useWidgetInheritance hook with a tree-based approach.
 */

import { useQuery } from '@tanstack/react-query'
import { pagesApi } from '../api'
import { InheritanceTreeNode, TreeWidget, MergeOptions } from '../types/inheritanceTree'
import { InheritanceTreeHelpers } from '../utils/inheritanceTree'


interface UseInheritanceTreeOptions {
    enabled?: boolean           // Whether to fetch tree data
    staleTime?: number         // Cache stale time (default: 0 for immediate updates)
    refetchOnMount?: boolean   // Whether to refetch on mount
}


interface UseInheritanceTreeResult {
    // Tree data
    tree: InheritanceTreeNode | null
    helpers: InheritanceTreeHelpers | null
    
    // Legacy compatibility for existing components
    inheritedWidgets: Record<string, TreeWidget[]>
    hasInheritedContent: boolean
    parentId: number | null
    hasParent: boolean
    
    // Query state
    isLoading: boolean
    error: Error | null
    refetch: () => Promise<any>
    
    // Helper functions (for convenience)
    getAllWidgets: (slotName: string) => TreeWidget[]
    getInheritedWidgets: (slotName: string) => TreeWidget[]  
    getLocalWidgets: (slotName: string) => TreeWidget[]
    getMergedWidgets: (slotName: string, options?: MergeOptions) => TreeWidget[]
    hasInheritedContentInSlot: (slotName: string) => boolean
}


/**
 * Custom hook for fetching and managing widget inheritance tree
 * 
 * @param pageId - ID of the current page
 * @param options - Hook configuration options
 * @returns Tree data, helpers, and legacy compatibility data
 */
export function useInheritanceTree(
    pageId: number | string | null, 
    options: UseInheritanceTreeOptions = {}
): UseInheritanceTreeResult {
    
    const {
        enabled = true,
        staleTime = 0,  // Always fresh data for immediate inheritance updates
        refetchOnMount = true
    } = options
    
    const {
        data: tree,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['inheritance-tree', pageId, 'v2'], // Version to differentiate from old cache
        queryFn: async () => {
            if (!pageId || pageId === 'new') {
                return null
            }
            
            // NEW: Use tree-enabled API endpoint with caching headers
            const response = await pagesApi.getWidgetInheritance(pageId)
            
            // Check if API returned new tree format
            if (response.version === 'tree' && response.tree) {
                // Add cache metadata
                response.tree._cacheInfo = {
                    fetchedAt: Date.now(),
                    generationTimeMs: response.statistics?.generationTimeMs,
                    nodeCount: response.statistics?.nodeCount
                }
                return response.tree
            }
            
            // Fallback: Convert legacy format to tree
            return convertLegacyDataToTree(response.legacy || response)
        },
        enabled: enabled && pageId && pageId !== 'new',
        staleTime, 
        refetchOnMount,
        retry: 1,
        // Optimized cache settings for tree data
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes after last use
        refetchOnWindowFocus: false, // Tree data doesn't need frequent refetching
        select: (data) => {
            // Optimize data selection - could add tree preprocessing here
            return data
        }
    })
    
    // Create helpers instance
    const helpers = tree ? new InheritanceTreeHelpers(tree) : null
    
    // Create legacy compatibility data for existing components
    const legacyData = tree ? createLegacyCompatibilityData(tree) : {
        inheritedWidgets: {},
        hasInheritedContent: false,
        parentId: null,
        hasParent: false
    }
    
    // Convenience helper functions
    const getAllWidgets = (slotName: string): TreeWidget[] => {
        return helpers ? helpers.getAllWidgets(slotName) : []
    }
    
    const getInheritedWidgets = (slotName: string): TreeWidget[] => {
        return helpers ? helpers.getInheritedWidgets(slotName) : []
    }
    
    const getLocalWidgets = (slotName: string): TreeWidget[] => {
        return helpers ? helpers.getLocalWidgets(slotName) : []
    }
    
    const getMergedWidgets = (slotName: string, options?: MergeOptions): TreeWidget[] => {
        return helpers ? helpers.getMergedWidgets(slotName, options) : []
    }
    
    const hasInheritedContentInSlot = (slotName: string): boolean => {
        return helpers ? helpers.hasInheritedContent(slotName) : false
    }
    
    return {
        // Tree data
        tree,
        helpers,
        
        // Legacy compatibility
        inheritedWidgets: legacyData.inheritedWidgets,
        hasInheritedContent: legacyData.hasInheritedContent,
        parentId: legacyData.parentId,
        hasParent: legacyData.hasParent,
        
        // Query state
        isLoading,
        error,
        refetch,
        
        // Helper functions
        getAllWidgets,
        getInheritedWidgets,
        getLocalWidgets,  
        getMergedWidgets,
        hasInheritedContentInSlot
    }
}


/**
 * Convert legacy widget inheritance data to tree format
 * TODO: Remove this once API returns tree structure directly
 */
function convertLegacyDataToTree(legacyData: any): InheritanceTreeNode | null {
    if (!legacyData || !legacyData.slots) {
        return null
    }
    
    // This is a simplified conversion - will be replaced when backend returns tree
    const slots: Record<string, TreeWidget[]> = {}
    
    Object.entries(legacyData.slots).forEach(([slotName, slotData]: [string, any]) => {
        slots[slotName] = (slotData.inheritedWidgets || []).map((widget: any) => ({
            id: widget.id,
            type: widget.type,
            config: widget.config || {},
            order: widget.order || 0,
            depth: widget.inheritanceDepth || 1,
            inheritanceBehavior: widget.inheritanceBehavior || 'insert_after_parent',
            isPublished: widget.isPublished !== false,
            inheritanceLevel: widget.inheritanceLevel || -1,
            isLocal: false,
            isInherited: true,
            canBeOverridden: widget.canOverride !== false
        }))
    })
    
    return {
        pageId: typeof legacyData.pageId === 'number' ? legacyData.pageId : 0,
        depth: 0,
        page: {
            id: legacyData.pageId || 0,
            title: 'Current Page',
            slug: 'current',
            parent_id: legacyData.parentId
        },
        slots,
        parent: null  // Simplified - legacy data doesn't include full tree
    }
}


/**
 * Create legacy compatibility data structure for existing components
 */
function createLegacyCompatibilityData(tree: InheritanceTreeNode) {
    const inheritedWidgets: Record<string, TreeWidget[]> = {}
    
    // Extract inherited widgets for each slot
    const helpers = new InheritanceTreeHelpers(tree)
    
    for (const slotName of Object.keys(tree.slots)) {
        inheritedWidgets[slotName] = helpers.getInheritedWidgets(slotName)
    }
    
    const hasInheritedContent = Object.values(inheritedWidgets).some(widgets => widgets.length > 0)
    
    return {
        inheritedWidgets,
        hasInheritedContent,
        parentId: tree.parent?.pageId || null,
        hasParent: tree.parent !== null
    }
}


export default useInheritanceTree
