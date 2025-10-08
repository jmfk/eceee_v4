/**
 * Widget Inheritance Tree Types
 * 
 * Shared type definitions for widget inheritance tree structure.
 * These types must match the Python dataclasses exactly.
 */

export enum WidgetInheritanceBehavior {
    OVERRIDE_PARENT = "override_parent",
    INSERT_AFTER_PARENT = "insert_after_parent", 
    INSERT_BEFORE_PARENT = "insert_before_parent"
}

export interface TreePageData {
    id: number
    title: string
    slug: string
    parent_id: number | null
    
    // Optional metadata
    description?: string
    layout?: string
    theme?: string
    hostname?: string
}

export interface TreeWidget {
    // Core widget data
    id: string
    type: string
    config: Record<string, any>
    order: number

    // Inheritance metadata
    depth: number
    inheritanceBehavior: WidgetInheritanceBehavior
    isPublished: boolean
    inheritanceLevel: number
    
    // Optional publishing fields
    publishEffectiveDate?: string
    publishExpireDate?: string
    
    // Computed fields (added during tree building)
    isLocal: boolean        // True if depth === 0
    isInherited: boolean    // True if depth > 0
    canBeOverridden: boolean // True if inheritance allows replacement
}

export interface InheritanceTreeNode {
    pageId: number
    depth: number
    page: TreePageData
    slots: Record<string, TreeWidget[]>
    parent: InheritanceTreeNode | null
}

export interface MergeOptions {
    mode?: 'edit' | 'preview'           // Display mode
    applyInheritanceBehavior?: boolean  // Apply before/after/override logic (default: true)
    respectPublishing?: boolean         // Filter by publishing status (default: true)
}

export interface SlotQueryOptions {
    includeUnpublished?: boolean        // Include unpublished widgets (default: false)
    maxDepth?: number                   // Maximum inheritance depth to consider
    respectInheritanceLevel?: boolean   // Apply widget inheritance_level limits (default: true)
}

// Predicate functions for tree traversal
export type TreeNodePredicate = (node: InheritanceTreeNode) => boolean
export type WidgetPredicate = (widget: TreeWidget) => boolean

// Error types for consistent error handling
export class InheritanceTreeError extends Error {
    public code: string
    public details?: any

    constructor(code: string, details?: any) {
        super(`InheritanceTree error: ${code}`)
        this.code = code
        this.details = details
    }
}

// Standard error codes (must match Python implementation)
export enum InheritanceTreeErrorCode {
    SLOT_NOT_FOUND = 'SLOT_NOT_FOUND',
    WIDGET_NOT_FOUND = 'WIDGET_NOT_FOUND', 
    INVALID_DEPTH = 'INVALID_DEPTH',
    TREE_GENERATION_FAILED = 'TREE_GENERATION_FAILED',
    CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE'
}

// Helper function return types
export interface InheritanceAnalysis {
    totalWidgets: number
    localWidgets: number
    inheritedWidgets: number
    depthDistribution: Record<number, number> // depth -> widget count
    typeDistribution: Record<string, number>  // type -> widget count
    behaviorDistribution: Record<WidgetInheritanceBehavior, number>
}

// Tree statistics for debugging and monitoring
export interface TreeStatistics {
    nodeCount: number           // Total nodes in tree
    maxDepth: number           // Deepest inheritance level
    totalWidgets: number       // Total widgets across all nodes
    slotUtilization: Record<string, number> // slot -> percentage utilization
    averageWidgetsPerSlot: number
    generationTimeMs?: number  // Time taken to generate tree
}
