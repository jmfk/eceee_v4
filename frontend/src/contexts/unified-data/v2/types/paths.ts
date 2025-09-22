/**
 * Core path types for the granular unified data context
 */

export type DataType = 'object' | 'widget' | 'layout' | 'form';

export interface DataPath {
    type: DataType;
    id: string;
    field?: string;
    subPath?: string[];
}

export type PathString = string; // e.g. "object.123.title" or "widget.456.config.settings"

/**
 * Parse a path string into a DataPath object
 */
export function parsePath(path: PathString): DataPath {
    const parts = path.split('.');
    const [type, id, ...rest] = parts;
    
    return {
        type: type as DataType,
        id,
        field: rest[0],
        subPath: rest.slice(1)
    };
}

/**
 * Convert a DataPath object to a path string
 */
export function stringifyPath(path: DataPath): PathString {
    const parts = [path.type, path.id];
    if (path.field) {
        parts.push(path.field);
    }
    if (path.subPath?.length) {
        parts.push(...path.subPath);
    }
    return parts.join('.');
}

/**
 * Check if a path is a parent of another path
 */
export function isParentPath(parent: PathString, child: PathString): boolean {
    return child.startsWith(parent + '.');
}

/**
 * Get the parent path of a path
 */
export function getParentPath(path: PathString): PathString | null {
    const parts = path.split('.');
    if (parts.length <= 2) return null; // No parent for root paths (type.id)
    return parts.slice(0, -1).join('.');
}

/**
 * Get all ancestor paths of a path
 */
export function getAncestorPaths(path: PathString): PathString[] {
    const ancestors: PathString[] = [];
    let current = path;
    while (true) {
        const parent = getParentPath(current);
        if (!parent) break;
        ancestors.push(parent);
        current = parent;
    }
    return ancestors;
}
