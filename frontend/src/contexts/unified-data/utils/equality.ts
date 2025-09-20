/**
 * Default equality function for comparing values
 */
export function defaultEqualityFn(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && 
               a.every((item, index) => defaultEqualityFn(item, b[index]));
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        
        return keysA.length === keysB.length &&
               keysA.every(key => defaultEqualityFn(a[key], b[key]));
    }
    
    return false;
}

/**
 * Shallow equality check for simple objects
 */
export function shallowEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => a[key] === b[key]);
}

/**
 * Deep equality check for nested objects
 * Use with caution on large objects as it's more expensive
 */
export function deepEqual(a: any, b: any): boolean {
    return defaultEqualityFn(a, b);
}
