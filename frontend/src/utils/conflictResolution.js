/**
 * Conflict Resolution Utilities
 * 
 * Provides field-level conflict detection and auto-merge capabilities
 * for concurrent page editing scenarios.
 */

import { analyzeChanges } from './smartSaveUtils';
import { deepDiff, matchesBlockingPath, setAtPath, formatPathForDisplay } from './deepDiff';

/**
 * Paths that require a full page refresh rather than showing diff dialog
 * Empty for now, but infrastructure is in place to add patterns
 */
const BLOCKING_PATHS = [];

/**
 * Detect conflicts and attempt auto-merge
 * 
 * @param {Object} original - The original data when editor was loaded
 * @param {Object} local - The local changes made in the editor
 * @param {Object} server - The current server state
 * @param {string} dataType - 'webpage' or 'version' to determine field sets
 * @returns {Object} Merge result with conflicts and merged data
 */
export function detectAndMerge(original, local, server, dataType = 'version') {
    const result = {
        canAutoMerge: true,
        conflicts: [],
        mergedData: { ...server }, // Start with server data as base
        localChanges: [],
        serverChanges: [],
        autoMergedFields: [],
        autoMergedCount: 0
    };

    // Get all keys that might have changed
    const allKeys = new Set([
        ...Object.keys(original || {}),
        ...Object.keys(local || {}),
        ...Object.keys(server || {})
    ]);

    // Fields to skip (metadata that shouldn't be compared)
    const skipFields = new Set([
        'id', 'versionId', 'versionNumber', 'createdAt', 'updatedAt', 
        'createdBy', 'lastModifiedBy', 'publicationStatus', 'isPublished',
        'isCurrentPublished', 'absoluteUrl', 'breadcrumbs', 'childrenCount',
        'effectiveTheme', 'themeInheritanceInfo'
    ]);

    for (const key of allKeys) {
        if (skipFields.has(key)) {
            continue;
        }

        const originalValue = original?.[key];
        const localValue = local?.[key];
        const serverValue = server?.[key];

        // Serialize for comparison
        const originalStr = JSON.stringify(originalValue);
        const localStr = JSON.stringify(localValue);
        const serverStr = JSON.stringify(serverValue);

        const localChanged = localStr !== originalStr;
        const serverChanged = serverStr !== originalStr;

        if (localChanged && serverChanged) {
            // Both changed - check if they changed to the same value
            if (localStr === serverStr) {
                // Both made the same change - no conflict
                result.autoMergedFields.push(key);
                result.autoMergedCount++;
                continue;
            }

            // Different changes - CONFLICT
            result.conflicts.push({
                field: key,
                original: originalValue,
                local: localValue,
                server: serverValue,
                resolution: null // User must choose
            });
            result.canAutoMerge = false;

        } else if (localChanged && !serverChanged) {
            // Only local changed - use local value
            result.mergedData[key] = localValue;
            result.localChanges.push({
                field: key,
                value: localValue
            });
            result.autoMergedFields.push(key);
            result.autoMergedCount++;

        } else if (!localChanged && serverChanged) {
            // Only server changed - use server value (already in mergedData)
            result.serverChanges.push({
                field: key,
                value: serverValue
            });
            result.autoMergedFields.push(key);
            result.autoMergedCount++;

        } else {
            // Neither changed - keep server value (already in mergedData)
        }
    }

    return result;
}

/**
 * Detect conflicts between local and server page version data using deep diff
 * 
 * @param {Object} originalWebpage - Original webpage data
 * @param {Object} localWebpage - Local webpage changes
 * @param {Object} serverWebpage - Server webpage state
 * @param {Object} originalVersion - Original version data
 * @param {Object} localVersion - Local version changes
 * @param {Object} serverVersion - Server version state
 * @returns {Object} Complete conflict analysis
 */
export function detectPageConflicts(
    originalWebpage,
    localWebpage,
    serverWebpage,
    originalVersion,
    localVersion,
    serverVersion
) {
    console.log('[ConflictResolution] Starting deep diff analysis...');

    // Run deep diff on webpage data
    const webpageDiffs = deepDiff(
        originalWebpage,
        localWebpage,
        serverWebpage,
        [],
        { pathPrefix: 'webpage' }
    );

    // Run deep diff on version data
    const versionDiffs = deepDiff(
        originalVersion,
        localVersion,
        serverVersion,
        [],
        { pathPrefix: 'version' }
    );

    // Combine all diffs
    const allDiffs = [...webpageDiffs, ...versionDiffs];
    
    // Filter to only conflicts
    const conflicts = allDiffs.filter(diff => diff.hasConflict);

    // Check for blocking paths
    let requiresRefresh = false;
    for (const diff of allDiffs) {
        if (matchesBlockingPath(diff.path, BLOCKING_PATHS)) {
            requiresRefresh = true;
            break;
        }
    }

    console.log(`[ConflictResolution] Analysis complete:`, {
        totalDiffs: allDiffs.length,
        conflicts: conflicts.length,
        requiresRefresh,
        webpageDiffs: webpageDiffs.length,
        versionDiffs: versionDiffs.length
    });
    
    // Log details of all diffs for debugging
    if (allDiffs.length > 0) {
        console.log('[ConflictResolution] Diff details:');
        allDiffs.forEach(diff => {
            console.log(`  - ${diff.pathDisplay}:`, {
                hasConflict: diff.hasConflict,
                localChanged: diff.localChanged,
                serverChanged: diff.serverChanged,
                original: diff.original,
                local: diff.local,
                server: diff.server
            });
        });
    }

    // Build merged data by applying non-conflicting changes
    // Deep clone to ensure new references trigger re-renders
    let mergedWebpage = JSON.parse(JSON.stringify(serverWebpage));
    let mergedVersion = JSON.parse(JSON.stringify(serverVersion));

    // Apply local changes that don't conflict
    for (const diff of allDiffs) {
        if (!diff.hasConflict && diff.localChanged) {
            // Apply local change
            const [dataType, ...path] = diff.path;
            if (dataType === 'webpage') {
                mergedWebpage = setAtPath(mergedWebpage, path, diff.local);
            } else if (dataType === 'version') {
                mergedVersion = setAtPath(mergedVersion, path, diff.local);
            }
        }
    }

    // Legacy format for backward compatibility
    const webpageConflicts = conflicts.filter(c => c.path[0] === 'webpage');
    const versionConflicts = conflicts.filter(c => c.path[0] === 'version');

    return {
        hasConflicts: conflicts.length > 0,
        canAutoMerge: conflicts.length === 0,
        requiresRefresh,
        allDiffs,
        conflicts,
        allConflicts: conflicts.map(c => ({
            field: c.pathString,
            path: c.path,
            pathDisplay: c.pathDisplay,
            original: c.original,
            local: c.local,
            server: c.server
        })),
        webpage: {
            canAutoMerge: webpageConflicts.length === 0,
            conflicts: webpageConflicts.map(c => ({
                field: c.pathString,
                path: c.path,
                pathDisplay: c.pathDisplay,
                original: c.original,
                local: c.local,
                server: c.server
            })),
            mergedData: mergedWebpage
        },
        version: {
            canAutoMerge: versionConflicts.length === 0,
            conflicts: versionConflicts.map(c => ({
                field: c.pathString,
                path: c.path,
                pathDisplay: c.pathDisplay,
                original: c.original,
                local: c.local,
                server: c.server
            })),
            mergedData: mergedVersion
        },
        mergedWebpage,
        mergedVersion
    };
}

/**
 * Apply user's conflict resolutions
 * 
 * @param {Object} conflictResult - Result from detectPageConflicts
 * @param {Array} resolutions - Array of { field, useLocal } decisions
 * @returns {Object} Final merged data
 */
export function applyConflictResolutions(conflictResult, resolutions) {
    let resolvedWebpage = { ...conflictResult.mergedWebpage };
    let resolvedVersion = { ...conflictResult.mergedVersion };

    // Create resolution map for quick lookup
    const resolutionMap = new Map();
    resolutions.forEach(res => {
        resolutionMap.set(res.field, res.useLocal);
    });

    // Apply conflict resolutions using paths
    conflictResult.conflicts.forEach(conflict => {
        const useLocal = resolutionMap.get(conflict.field || conflict.pathString);
        if (useLocal !== undefined) {
            const value = useLocal ? conflict.local : conflict.server;
            const [dataType, ...path] = conflict.path;
            
            if (dataType === 'webpage') {
                resolvedWebpage = setAtPath(resolvedWebpage, path, value);
            } else if (dataType === 'version') {
                resolvedVersion = setAtPath(resolvedVersion, path, value);
            }
        }
    });

    return {
        webpage: resolvedWebpage,
        version: resolvedVersion
    };
}

/**
 * Format conflict for display in UI
 * 
 * @param {Object} conflict - Conflict object
 * @returns {Object} Formatted conflict with display values
 */
/**
 * Fields to ignore when comparing/diffing
 * These are typically system fields or timestamps that shouldn't be shown to users
 */
const IGNORED_DIFF_FIELDS = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'created',
    'updated',
    'modified',
    'modifiedAt',
    'version',
    '__typename'
]);

/**
 * Flatten nested objects for better diff display
 * Converts { pageData: { title: "A" } } to { "pageData.title": "A" }
 */
function flattenObject(obj, prefix = '', result = {}) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
    }

    for (const [key, value] of Object.entries(obj)) {
        // Skip ignored fields
        if (IGNORED_DIFF_FIELDS.has(key)) {
            continue;
        }

        const newKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively flatten nested objects
            flattenObject(value, newKey, result);
        } else {
            // Leaf value - add to result
            result[newKey] = value;
        }
    }

    return result;
}

/**
 * Extract individual text differences from complex objects
 * Returns array of sub-conflicts for each differing field
 */
function extractTextDifferences(field, original, local, server) {
    const subConflicts = [];

    // If all are simple values, return as-is
    if (
        (typeof local !== 'object' || local === null) &&
        (typeof server !== 'object' || server === null)
    ) {
        return [{ field, original, local, server }];
    }

    // Flatten the objects
    const flatOriginal = flattenObject(original) || {};
    const flatLocal = flattenObject(local) || {};
    const flatServer = flattenObject(server) || {};

    // Get all keys from all versions
    const allKeys = new Set([
        ...Object.keys(flatLocal),
        ...Object.keys(flatServer),
        ...Object.keys(flatOriginal)
    ]);

    // Create sub-conflicts for each key that differs
    for (const key of allKeys) {
        if (IGNORED_DIFF_FIELDS.has(key)) continue;

        const origVal = flatOriginal[key];
        const localVal = flatLocal[key];
        const serverVal = flatServer[key];

        // Only include if there's an actual difference
        const localStr = JSON.stringify(localVal);
        const serverStr = JSON.stringify(serverVal);

        if (localStr !== serverStr) {
            subConflicts.push({
                field: `${field}.${key}`,
                original: origVal,
                local: localVal,
                server: serverVal
            });
        }
    }

    // If no sub-conflicts found, return the original conflict
    return subConflicts.length > 0 ? subConflicts : [{ field, original, local, server }];
}

export function formatConflictForDisplay(conflict) {
    const { field, path, pathDisplay, original, local, server } = conflict;

    // Check if a string contains HTML tags
    const isHtml = (str) => {
        if (typeof str !== 'string') return false;
        return /<[^>]+>/.test(str);
    };

    // Helper to format value for display
    const formatValue = (value) => {
        if (value === null || value === undefined) {
            return '(empty)';
        }
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) return '(empty array)';
            return JSON.stringify(value, null, 2);
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        if (typeof value === 'string') {
            if (value.length === 0) return '(empty)';
            // Don't truncate HTML - let it render
            if (!isHtml(value) && value.length > 500) {
                return value.substring(0, 500) + '... (truncated)';
            }
            return value;
        }
        return String(value);
    };

    // Use pathDisplay if available, otherwise generate from field/path
    let fieldLabel;
    if (pathDisplay) {
        fieldLabel = pathDisplay;
    } else if (path && Array.isArray(path)) {
        fieldLabel = formatPathForDisplay(path);
    } else if (field) {
        fieldLabel = field
            .split('.')
            .map(part => 
                part
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase())
                    .trim()
            )
            .join(' → ');
    } else {
        fieldLabel = 'Unknown Field';
    }

    // Determine if this is a complex object or simple text
    const isLocalComplex = local && typeof local === 'object';
    const isServerComplex = server && typeof server === 'object';
    const isComplexObject = isLocalComplex || isServerComplex;

    // Check if values are HTML content
    const isLocalHtml = isHtml(local);
    const isServerHtml = isHtml(server);
    const isHtmlContent = isLocalHtml || isServerHtml;

    return {
        ...conflict,
        fieldLabel,
        localDisplay: formatValue(local),
        serverDisplay: formatValue(server),
        originalDisplay: formatValue(original),
        isComplexObject,
        isHtmlContent,
        localValue: local,
        serverValue: server,
        originalValue: original
    };
}

/**
 * Process conflicts to extract text-level differences
 * This expands complex object conflicts into individual field conflicts
 */
export function expandConflictsForDiff(conflicts) {
    const expanded = [];

    for (const conflict of conflicts) {
        const subConflicts = extractTextDifferences(
            conflict.field,
            conflict.original,
            conflict.local,
            conflict.server
        );
        expanded.push(...subConflicts);
    }

    return expanded;
}

/**
 * Get summary of conflict analysis
 * 
 * @param {Object} conflictResult - Result from detectPageConflicts
 * @returns {string} Human-readable summary
 */
export function getConflictSummary(conflictResult) {
    if (!conflictResult.hasConflicts) {
        const totalDiffs = conflictResult.allDiffs?.length || 0;
        
        if (totalDiffs > 0) {
            return `Successfully auto-merged ${totalDiffs} change(s) with no conflicts`;
        }
        return 'No conflicts detected';
    }

    const conflictCount = conflictResult.allConflicts?.length || 0;
    const fields = (conflictResult.allConflicts || [])
        .map(c => c.pathDisplay || c.field)
        .slice(0, 3)
        .join(', ');
    
    const more = conflictCount > 3 ? ` and ${conflictCount - 3} more` : '';
    
    return `${conflictCount} conflict(s) detected in: ${fields}${more}`;
}


