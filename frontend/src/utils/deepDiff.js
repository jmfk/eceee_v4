/**
 * Deep Diff Utility
 * 
 * Recursively compares nested object structures to detect changes and conflicts.
 * Maintains full path context for each difference found.
 */

/**
 * Default fields to ignore during diff comparison
 */
const DEFAULT_IGNORED_FIELDS = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'created',
    'updated',
    'modified',
    'modifiedAt',
    'version',
    'versionNumber',
    'versionId',
    'createdBy',
    'lastModifiedBy',
    'publicationStatus',
    'isPublished',
    'isCurrentPublished',
    'absoluteUrl',
    'breadcrumbs',
    'childrenCount',
    'effectiveTheme',
    'themeInheritanceInfo',
    '__typename'
]);

/**
 * Check if a value is a plain object (not array, null, or Date)
 */
function isPlainObject(value) {
    return value !== null && 
           typeof value === 'object' && 
           !Array.isArray(value) &&
           !(value instanceof Date);
}

/**
 * Format a path array into a human-readable string
 * @param {Array} path - Path array like ["widgets", 0, "config", "headline"]
 * @returns {string} - Formatted path like "widgets.0.config.headline"
 */
export function formatPath(path) {
    return path.join('.');
}

/**
 * Format a path array into a display-friendly string
 * @param {Array} path - Path array like ["widgets", 0, "config", "headline"]
 * @returns {string} - Display path like "Widgets → 0 → Config → Headline"
 */
export function formatPathForDisplay(path) {
    return path
        .map(part => {
            // If it's a number (array index), keep as is
            if (typeof part === 'number') {
                return String(part);
            }
            // Convert camelCase to Title Case
            return part
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .trim();
        })
        .join(' → ');
}

/**
 * Deep diff comparison between three versions (original, local, server)
 * 
 * @param {*} original - Original value when editor was loaded
 * @param {*} local - Current local value in editor
 * @param {*} server - Current server value
 * @param {Array} path - Current path in the object tree
 * @param {Object} options - Configuration options
 * @param {Set} options.ignoredFields - Fields to skip during comparison
 * @param {string} options.pathPrefix - Prefix for all paths (e.g., 'webpage' or 'version')
 * @returns {Array} - Array of diff items
 */
export function deepDiff(original, local, server, path = [], options = {}) {
    const {
        ignoredFields = DEFAULT_IGNORED_FIELDS,
        pathPrefix = ''
    } = options;

    const diffs = [];
    const currentPath = pathPrefix && path.length === 0 
        ? [pathPrefix] 
        : path;

    // Handle null/undefined edge cases
    const originalIsNullish = original === null || original === undefined;
    const localIsNullish = local === null || local === undefined;
    const serverIsNullish = server === null || server === undefined;

    // If all are nullish, no diff
    if (originalIsNullish && localIsNullish && serverIsNullish) {
        return diffs;
    }

    // If types don't match, treat as primitive comparison
    const originalType = Array.isArray(original) ? 'array' : typeof original;
    const localType = Array.isArray(local) ? 'array' : typeof local;
    const serverType = Array.isArray(server) ? 'array' : typeof server;

    // Serialize for comparison
    const originalStr = JSON.stringify(original);
    const localStr = JSON.stringify(local);
    const serverStr = JSON.stringify(server);

    const localChanged = localStr !== originalStr;
    const serverChanged = serverStr !== originalStr;

    // If both local and server are plain objects, recurse
    if (isPlainObject(original) || isPlainObject(local) || isPlainObject(server)) {
        const originalObj = original || {};
        const localObj = local || {};
        const serverObj = server || {};

        // Get all keys from all three versions
        const allKeys = new Set([
            ...Object.keys(originalObj),
            ...Object.keys(localObj),
            ...Object.keys(serverObj)
        ]);

        for (const key of allKeys) {
            // Skip ignored fields at any level
            if (ignoredFields.has(key)) {
                continue;
            }

            const newPath = [...currentPath, key];
            const subDiffs = deepDiff(
                originalObj[key],
                localObj[key],
                serverObj[key],
                newPath,
                options
            );
            diffs.push(...subDiffs);
        }

        return diffs;
    }

    // If both local and server are arrays, recurse through elements
    if (Array.isArray(local) || Array.isArray(server) || Array.isArray(original)) {
        const originalArr = Array.isArray(original) ? original : [];
        const localArr = Array.isArray(local) ? local : [];
        const serverArr = Array.isArray(server) ? server : [];

        const maxLength = Math.max(originalArr.length, localArr.length, serverArr.length);

        for (let i = 0; i < maxLength; i++) {
            const newPath = [...currentPath, i];
            const subDiffs = deepDiff(
                originalArr[i],
                localArr[i],
                serverArr[i],
                newPath,
                options
            );
            diffs.push(...subDiffs);
        }

        return diffs;
    }

    // Leaf node - primitive value comparison
    if (localChanged || serverChanged) {
        const hasConflict = localChanged && serverChanged && localStr !== serverStr;
        
        const diffItem = {
            path: currentPath,
            pathString: formatPath(currentPath),
            pathDisplay: formatPathForDisplay(currentPath),
            original,
            local,
            server,
            hasConflict,
            localChanged,
            serverChanged
        };

        diffs.push(diffItem);
    }

    return diffs;
}

/**
 * Check if a path matches a blocking pattern
 * @param {Array} path - Path array to check
 * @param {Array} blockingPatterns - Array of path patterns (strings or RegExp)
 * @returns {boolean} - True if path matches any blocking pattern
 */
export function matchesBlockingPath(path, blockingPatterns) {
    if (!blockingPatterns || blockingPatterns.length === 0) {
        return false;
    }

    const pathString = formatPath(path);

    for (const pattern of blockingPatterns) {
        if (pattern instanceof RegExp) {
            if (pattern.test(pathString)) {
                return true;
            }
        } else if (typeof pattern === 'string') {
            if (pathString === pattern || pathString.startsWith(pattern + '.')) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Apply a path-based value update to a nested object
 * @param {Object} obj - Object to update
 * @param {Array} path - Path to the value
 * @param {*} value - Value to set
 * @returns {Object} - New object with value set at path
 */
export function setAtPath(obj, path, value) {
    if (path.length === 0) {
        return value;
    }

    const [head, ...tail] = path;
    
    // Check if we're dealing with an array
    if (Array.isArray(obj)) {
        const arr = [...obj];
        arr[head] = tail.length > 0 ? setAtPath(arr[head], tail, value) : value;
        return arr;
    } else {
        // It's an object
        const newObj = { ...(obj || {}) };
        newObj[head] = tail.length > 0 ? setAtPath(newObj[head], tail, value) : value;
        return newObj;
    }
}

/**
 * Get a value from a nested object using a path
 * @param {Object} obj - Object to read from
 * @param {Array} path - Path to the value
 * @returns {*} - Value at path, or undefined if not found
 */
export function getAtPath(obj, path) {
    let current = obj;
    for (const key of path) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = current[key];
    }
    return current;
}

