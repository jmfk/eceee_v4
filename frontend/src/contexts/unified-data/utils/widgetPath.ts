/**
 * Widget Path Utilities
 * 
 * Provides utilities for managing widget paths in nested container widgets.
 * A widget path is an alternating array of slot names and widget IDs that
 * describes the location of a widget in the hierarchy.
 * 
 * Path format: [topLevelSlot, containerId, containerSlot, containerId, ..., targetWidgetId]
 * 
 * Examples:
 *   ["main"]                                    // Top-level slot (no widgets yet)
 *   ["main", "widget-123"]                      // Widget in top-level slot
 *   ["main", "widget-123", "left"]              // Slot in container widget
 *   ["main", "widget-123", "left", "widget-456"] // Nested widget
 * 
 * Rules:
 * - Even indices (0, 2, 4...): Slot names
 * - Odd indices (1, 3, 5...): Widget IDs
 * - First item: Always a top-level slot name
 * - Last item: Widget ID (if path points to a widget) or slot name (if path points to a slot)
 */

export type WidgetPath = string[];

/**
 * Validate a widget path
 */
export function isValidPath(path: WidgetPath | null | undefined): boolean {
    if (!path || !Array.isArray(path)) {
        return false;
    }
    
    // Empty path is invalid
    if (path.length === 0) {
        return false;
    }
    
    // All elements must be non-empty strings
    return path.every(item => typeof item === 'string' && item.length > 0);
}

/**
 * Validate path and return detailed error information
 */
export function validatePath(path: WidgetPath | null | undefined): { valid: boolean; error?: string } {
    if (!path || !Array.isArray(path)) {
        return { valid: false, error: 'Path must be an array' };
    }
    
    if (path.length === 0) {
        return { valid: false, error: 'Path cannot be empty' };
    }
    
    for (let i = 0; i < path.length; i++) {
        const item = path[i];
        if (typeof item !== 'string' || item.length === 0) {
            return { 
                valid: false, 
                error: `Invalid path element at index ${i}: must be a non-empty string` 
            };
        }
    }
    
    return { valid: true };
}

/**
 * Get the top-level slot name from a path
 */
export function getTopLevelSlot(path: WidgetPath): string {
    if (!isValidPath(path)) {
        throw new Error('Invalid widget path');
    }
    return path[0];
}

/**
 * Get the target widget ID from a path (last widget ID in path)
 * Returns null if path ends with a slot name
 */
export function getTargetWidgetId(path: WidgetPath): string | null {
    if (!isValidPath(path)) {
        throw new Error('Invalid widget path');
    }
    
    // If path has odd length, last item is a widget ID
    if (path.length % 2 === 0) {
        return path[path.length - 1];
    }
    
    // Path ends with slot name, return the previous widget ID if exists
    if (path.length >= 2) {
        return path[path.length - 2];
    }
    
    return null;
}

/**
 * Get the immediate slot name (last slot in the path)
 */
export function getImmediateSlot(path: WidgetPath): string {
    if (!isValidPath(path)) {
        throw new Error('Invalid widget path');
    }
    
    // If path has odd length, last item is a slot
    if (path.length % 2 === 1) {
        return path[path.length - 1];
    }
    
    // If path has even length (ends with widget ID), get the slot before it
    if (path.length >= 2) {
        return path[path.length - 2];
    }
    
    // Single item path (just top-level slot)
    return path[0];
}

/**
 * Get the parent path (path without the last widget)
 * Returns null if there's no parent (top-level widget)
 */
export function getParentPath(path: WidgetPath): WidgetPath | null {
    if (!isValidPath(path)) {
        throw new Error('Invalid widget path');
    }
    
    // If path only has slot name, no parent
    if (path.length === 1) {
        return null;
    }
    
    // If path ends with widget ID, remove it and its slot
    if (path.length % 2 === 0) {
        return path.slice(0, -2);
    }
    
    // If path ends with slot name, remove just the slot
    return path.slice(0, -1);
}

/**
 * Build a widget path from components
 * 
 * @param topLevelSlot - The top-level slot name
 * @param parentPath - Optional parent path to extend
 * @param slotName - Optional slot name to add
 * @param widgetId - Optional widget ID to add
 */
export function buildWidgetPath(
    topLevelSlot?: string,
    parentPath?: WidgetPath,
    slotName?: string,
    widgetId?: string
): WidgetPath {
    // Start with parent path or create new path
    const path: WidgetPath = parentPath ? [...parentPath] : [];
    
    // Add top-level slot if provided and path is empty
    if (topLevelSlot && path.length === 0) {
        path.push(topLevelSlot);
    }
    
    // Add slot name if provided
    if (slotName) {
        path.push(slotName);
    }
    
    // Add widget ID if provided
    if (widgetId) {
        path.push(widgetId);
    }
    
    return path;
}

/**
 * Append a slot name to a path
 */
export function appendSlot(path: WidgetPath, slotName: string): WidgetPath {
    if (!isValidPath(path)) {
        throw new Error('Invalid widget path');
    }
    
    if (!slotName || typeof slotName !== 'string') {
        throw new Error('Slot name must be a non-empty string');
    }
    
    return [...path, slotName];
}

/**
 * Append a widget ID to a path
 */
export function appendWidget(path: WidgetPath, widgetId: string): WidgetPath {
    if (!isValidPath(path)) {
        throw new Error('Invalid widget path');
    }
    
    if (!widgetId || typeof widgetId !== 'string') {
        throw new Error('Widget ID must be a non-empty string');
    }
    
    return [...path, widgetId];
}

/**
 * Append both slot and widget to path
 */
export function appendToPath(path: WidgetPath, slotName: string, widgetId: string): WidgetPath {
    if (!isValidPath(path)) {
        throw new Error('Invalid widget path');
    }
    
    return [...path, slotName, widgetId];
}

/**
 * Check if a path points to a nested widget (has more than 2 elements)
 */
export function isNestedWidget(path: WidgetPath): boolean {
    if (!isValidPath(path)) {
        return false;
    }
    
    // Path with more than 2 elements means it's nested
    // [slot, widgetId] = top-level
    // [slot, widgetId, slot, widgetId] = nested
    return path.length > 2;
}

/**
 * Get the depth of nesting (0 = top-level, 1 = first nesting level, etc.)
 */
export function getNestingDepth(path: WidgetPath): number {
    if (!isValidPath(path)) {
        return 0;
    }
    
    // Count number of widget IDs in the path
    // Even indices are slots, odd indices are widget IDs
    return Math.floor(path.length / 2);
}

/**
 * Format path for display/debugging
 */
export function formatPath(path: WidgetPath): string {
    if (!isValidPath(path)) {
        return '<invalid path>';
    }
    
    const parts: string[] = [];
    for (let i = 0; i < path.length; i++) {
        if (i % 2 === 0) {
            parts.push(`slot:${path[i]}`);
        } else {
            parts.push(`widget:${path[i]}`);
        }
    }
    
    return parts.join(' → ');
}

/**
 * Compare two paths for equality
 */
export function pathsEqual(path1: WidgetPath | null | undefined, path2: WidgetPath | null | undefined): boolean {
    if (path1 === path2) return true;
    if (!path1 || !path2) return false;
    if (path1.length !== path2.length) return false;
    
    return path1.every((item, index) => item === path2[index]);
}
