/**
 * Widget Inheritance Tree Utilities
 * 
 * Helper functions for querying widget inheritance trees. These functions
 * must match the Python implementation exactly for cross-platform consistency.
 */

import {
    InheritanceTreeNode,
    TreeWidget,
    WidgetInheritanceBehavior,
    MergeOptions,
    SlotQueryOptions,
    TreeNodePredicate,
    WidgetPredicate,
    InheritanceTreeError,
    InheritanceTreeErrorCode,
    InheritanceAnalysis
} from '../types/inheritanceTree'


export class InheritanceTreeHelpers {
    /**Helper functions for inheritance tree queries*/
    
    constructor(private tree: InheritanceTreeNode) {}
    
    // Core Query Functions
    
    getAllWidgets(slotName: string): TreeWidget[] {
        /**
         * Get all widgets in the specified slot from ALL tree levels.
         * 
         * @param slotName - Name of the slot to query
         * @returns List of widgets ordered by depth (current page first)
         */
        const widgets: TreeWidget[] = []
        
        const collectFromNode = (node: InheritanceTreeNode): void => {
            if (slotName in node.slots) {
                widgets.push(...node.slots[slotName])
            }
            if (node.parent) {
                collectFromNode(node.parent)
            }
        }
        
        collectFromNode(this.tree)
        
        // Sort by depth (current page first)
        widgets.sort((a, b) => a.depth - b.depth)
        
        return widgets
    }
    
    getWidgetsByType(widgetType: string, slotName?: string): TreeWidget[] {
        /**
         * Get all widgets of the specified type.
         * 
         * @param widgetType - Widget type to filter by
         * @param slotName - Optional slot name to filter by
         * @returns List of matching widgets
         */
        const widgets: TreeWidget[] = []
        
        const collectFromNode = (node: InheritanceTreeNode): void => {
            const slotsToCheck = slotName ? [slotName] : Object.keys(node.slots)
            
            for (const slot of slotsToCheck) {
                if (slot in node.slots) {
                    for (const widget of node.slots[slot]) {
                        if (widget.type === widgetType) {
                            widgets.push(widget)
                        }
                    }
                }
            }
            
            if (node.parent) {
                collectFromNode(node.parent)
            }
        }
        
        collectFromNode(this.tree)
        
        // Sort by depth, then by order
        widgets.sort((a, b) => a.depth - b.depth || a.order - b.order)
        
        return widgets
    }
    
    getInheritedWidgets(slotName: string): TreeWidget[] {
        /**
         * Get only inherited widgets (depth > 0) for the specified slot.
         * 
         * @param slotName - Name of the slot to query
         * @returns List of inherited widgets only
         */
        const allWidgets = this.getAllWidgets(slotName)
        return allWidgets.filter(w => w.isInherited)
    }
    
    getLocalWidgets(slotName: string): TreeWidget[] {
        /**
         * Get only local widgets (depth === 0) for the specified slot.
         * 
         * @param slotName - Name of the slot to query
         * @returns List of local widgets only
         */
        if (slotName in this.tree.slots) {
            return this.tree.slots[slotName].filter(w => w.isLocal)
        }
        return []
    }
    
    getWidgetsAtDepth(depth: number, slotName?: string): TreeWidget[] {
        /**
         * Get widgets from specific inheritance depth.
         * 
         * @param depth - Inheritance depth (0 = current page, 1 = parent, etc.)
         * @param slotName - Optional slot name to filter by
         * @returns List of widgets at the specified depth
         */
        const widgets: TreeWidget[] = []
        
        const collectFromNode = (node: InheritanceTreeNode): void => {
            if (node.depth === depth) {
                const slotsToCheck = slotName ? [slotName] : Object.keys(node.slots)
                for (const slot of slotsToCheck) {
                    if (slot in node.slots) {
                        widgets.push(...node.slots[slot])
                    }
                }
            }
            
            if (node.parent) {
                collectFromNode(node.parent)
            }
        }
        
        collectFromNode(this.tree)
        
        // Sort by order
        widgets.sort((a, b) => a.order - b.order)
        
        return widgets
    }
    
    // Inheritance Logic Functions
    
    getMergedWidgets(slotName: string, options?: MergeOptions): TreeWidget[] {
        /**
         * Get widgets for display, applying inheritance behavior rules.
         * 
         * @param slotName - Name of the slot
         * @param options - Merge options for behavior control
         * @returns List of widgets for display, properly ordered by inheritance behavior
         */
        const opts: MergeOptions = {
            mode: 'edit',
            applyInheritanceBehavior: true,
            respectPublishing: true,
            ...options
        }
        
        let allWidgets = this.getAllWidgets(slotName)
        
        // Apply publishing filter if requested
        if (opts.respectPublishing) {
            allWidgets = allWidgets.filter(w => w.isPublished)
        }
        
        if (!opts.applyInheritanceBehavior) {
            return allWidgets
        }
        
        // Group widgets by inheritance behavior
        const overrideWidgets = allWidgets.filter(w => w.inheritanceBehavior === WidgetInheritanceBehavior.OVERRIDE_PARENT)
        const beforeWidgets = allWidgets.filter(w => w.inheritanceBehavior === WidgetInheritanceBehavior.INSERT_BEFORE_PARENT)
        const afterWidgets = allWidgets.filter(w => w.inheritanceBehavior === WidgetInheritanceBehavior.INSERT_AFTER_PARENT)
        
        // Apply inheritance behavior logic
        if (overrideWidgets.length > 0) {
            // Override widgets replace ALL other widgets
            return overrideWidgets.sort((a, b) => a.depth - b.depth || a.order - b.order)
        }
        
        // Combine: before + inherited (after) widgets
        const result: TreeWidget[] = []
        
        // Add before widgets (sorted by depth, then order)
        result.push(...beforeWidgets.sort((a, b) => a.depth - b.depth || a.order - b.order))
        
        // Add after widgets (sorted by depth, then order)
        result.push(...afterWidgets.sort((a, b) => a.depth - b.depth || a.order - b.order))
        
        return result
    }
    
    getWidgetsByBehavior(behavior: WidgetInheritanceBehavior, slotName?: string): TreeWidget[] {
        /**
         * Get widgets with specific inheritance behavior.
         * 
         * @param behavior - Inheritance behavior to filter by
         * @param slotName - Optional slot name to filter by
         * @returns List of widgets with matching behavior
         */
        const widgets: TreeWidget[] = []
        
        const collectFromNode = (node: InheritanceTreeNode): void => {
            const slotsToCheck = slotName ? [slotName] : Object.keys(node.slots)
            
            for (const slot of slotsToCheck) {
                if (slot in node.slots) {
                    for (const widget of node.slots[slot]) {
                        if (widget.inheritanceBehavior === behavior) {
                            widgets.push(widget)
                        }
                    }
                }
            }
            
            if (node.parent) {
                collectFromNode(node.parent)
            }
        }
        
        collectFromNode(this.tree)
        
        return widgets.sort((a, b) => a.depth - b.depth || a.order - b.order)
    }
    
    // Content Check Functions
    
    hasInheritedContent(slotName: string): boolean {
        /**Check if slot has any inherited content*/
        const inherited = this.getInheritedWidgets(slotName)
        return inherited.length > 0
    }
    
    hasLocalContent(slotName: string): boolean {
        /**Check if slot has any local content*/
        const local = this.getLocalWidgets(slotName)
        return local.length > 0
    }
    
    hasContentAtDepth(slotName: string, depth: number): boolean {
        /**Check if slot has content at specific depth*/
        const widgets = this.getWidgetsAtDepth(depth, slotName)
        return widgets.length > 0
    }
    
    // Tree Navigation Functions
    
    traverseUp(predicate: TreeNodePredicate): InheritanceTreeNode | null {
        /**
         * Traverse up the tree until predicate is met.
         * 
         * @param predicate - Function that returns true when target node found
         * @returns First node matching predicate, or null if not found
         */
        let current: InheritanceTreeNode | null = this.tree
        
        while (current) {
            if (predicate(current)) {
                return current
            }
            current = current.parent
        }
        
        return null
    }
    
    getAncestors(): InheritanceTreeNode[] {
        /**Get all ancestor nodes (excluding current page)*/
        const ancestors: InheritanceTreeNode[] = []
        let current = this.tree.parent
        
        while (current) {
            ancestors.push(current)
            current = current.parent
        }
        
        return ancestors
    }
    
    getRoot(): InheritanceTreeNode {
        /**Get the root node (deepest ancestor)*/
        let current = this.tree
        
        while (current.parent) {
            current = current.parent
        }
        
        return current
    }
    
    // Advanced Query Functions
    
    findWidget(widgetId: string): TreeWidget | null {
        /**
         * Find widget by ID across entire tree.
         * 
         * @param widgetId - Widget ID to search for
         * @returns Widget if found, null otherwise
         */
        const searchNode = (node: InheritanceTreeNode): TreeWidget | null => {
            for (const slotWidgets of Object.values(node.slots)) {
                for (const widget of slotWidgets) {
                    if (widget.id === widgetId) {
                        return widget
                    }
                }
            }
            
            if (node.parent) {
                return searchNode(node.parent)
            }
            
            return null
        }
        
        return searchNode(this.tree)
    }
    
    getSlotAtDepth(slotName: string, depth: number): TreeWidget[] {
        /**
         * Get widgets from specific slot at specific depth.
         * 
         * @param slotName - Name of the slot
         * @param depth - Depth level to query
         * @returns List of widgets from that slot at that depth
         */
        const findNodeAtDepth = (node: InheritanceTreeNode): InheritanceTreeNode | null => {
            if (node.depth === depth) {
                return node
            }
            if (node.parent) {
                return findNodeAtDepth(node.parent)
            }
            return null
        }
        
        const targetNode = findNodeAtDepth(this.tree)
        if (targetNode && slotName in targetNode.slots) {
            return targetNode.slots[slotName]
        }
        
        return []
    }
    
    // Analysis Functions
    
    analyzeInheritance(slotName?: string): InheritanceAnalysis {
        /**
         * Analyze inheritance patterns for debugging and monitoring.
         * 
         * @param slotName - Optional slot to analyze, or undefined for all slots
         * @returns InheritanceAnalysis with statistics
         */
        let widgets: TreeWidget[] = []
        
        if (slotName) {
            widgets = this.getAllWidgets(slotName)
        } else {
            // Get all widgets from all slots
            const collectAll = (node: InheritanceTreeNode): void => {
                for (const slotWidgets of Object.values(node.slots)) {
                    widgets.push(...slotWidgets)
                }
                if (node.parent) {
                    collectAll(node.parent)
                }
            }
            
            collectAll(this.tree)
        }
        
        // Calculate distributions
        const depthDistribution: Record<number, number> = {}
        const typeDistribution: Record<string, number> = {}
        const behaviorDistribution: Record<WidgetInheritanceBehavior, number> = {}
        
        let localCount = 0
        let inheritedCount = 0
        
        for (const widget of widgets) {
            // Depth distribution
            depthDistribution[widget.depth] = (depthDistribution[widget.depth] || 0) + 1
            
            // Type distribution
            typeDistribution[widget.type] = (typeDistribution[widget.type] || 0) + 1
            
            // Behavior distribution
            behaviorDistribution[widget.inheritanceBehavior] = (behaviorDistribution[widget.inheritanceBehavior] || 0) + 1
            
            // Local vs inherited
            if (widget.isLocal) {
                localCount++
            } else {
                inheritedCount++
            }
        }
        
        return {
            totalWidgets: widgets.length,
            localWidgets: localCount,
            inheritedWidgets: inheritedCount,
            depthDistribution,
            typeDistribution,
            behaviorDistribution
        }
    }
}


// Convenience functions that match Python module-level functions
export function createInheritanceTreeHelpers(tree: InheritanceTreeNode): InheritanceTreeHelpers {
    /**Create helper functions for a tree*/
    return new InheritanceTreeHelpers(tree)
}


// Direct helper functions (for API compatibility)
export function getAllWidgetsFromTree(tree: InheritanceTreeNode, slotName: string): TreeWidget[] {
    /**Get all widgets for a slot from an inheritance tree*/
    const helpers = new InheritanceTreeHelpers(tree)
    return helpers.getAllWidgets(slotName)
}


export function getMergedWidgetsFromTree(tree: InheritanceTreeNode, slotName: string, options?: MergeOptions): TreeWidget[] {
    /**Get merged widgets for display from an inheritance tree*/
    const helpers = new InheritanceTreeHelpers(tree)
    return helpers.getMergedWidgets(slotName, options)
}


export function hasInheritedContentInTree(tree: InheritanceTreeNode, slotName: string): boolean {
    /**Check if tree has inherited content in slot*/
    const helpers = new InheritanceTreeHelpers(tree)
    return helpers.hasInheritedContent(slotName)
}


// Type guards for runtime type checking
export function isTreeWidget(obj: any): obj is TreeWidget {
    return obj && typeof obj === 'object' && 
           typeof obj.id === 'string' &&
           typeof obj.type === 'string' &&
           typeof obj.depth === 'number'
}


export function isInheritanceTreeNode(obj: any): obj is InheritanceTreeNode {
    return obj && typeof obj === 'object' &&
           typeof obj.pageId === 'number' &&
           typeof obj.depth === 'number' &&
           obj.slots && typeof obj.slots === 'object'
}


// Utility functions for tree manipulation
export function cloneTree(tree: InheritanceTreeNode): InheritanceTreeNode {
    /**Deep clone an inheritance tree*/
    return {
        pageId: tree.pageId,
        depth: tree.depth,
        page: { ...tree.page },
        slots: Object.fromEntries(
            Object.entries(tree.slots).map(([slotName, widgets]) => [
                slotName,
                widgets.map(w => ({ ...w, config: { ...w.config } }))
            ])
        ),
        parent: tree.parent ? cloneTree(tree.parent) : null
    }
}


export function flattenTree(tree: InheritanceTreeNode): InheritanceTreeNode[] {
    /**Convert tree to flat array of nodes (depth-first)*/
    const nodes: InheritanceTreeNode[] = [tree]
    
    if (tree.parent) {
        nodes.push(...flattenTree(tree.parent))
    }
    
    return nodes
}
