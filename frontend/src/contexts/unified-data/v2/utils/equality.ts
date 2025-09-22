/**
 * Default equality function for comparing values
 * Improved type safety and performance
 */
export function defaultEqualityFn<T>(a: T, b: T): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && 
               a.every((item, index) => defaultEqualityFn(item, b[index]));
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
        const keysA = Object.keys(a as object);
        const keysB = Object.keys(b as object);
        
        return keysA.length === keysB.length &&
               keysA.every(key => defaultEqualityFn(
                   (a as any)[key],
                   (b as any)[key]
               ));
    }
    
    return false;
}

/**
 * Shallow equality check for simple objects
 * Improved type safety and performance
 */
export function shallowEqual<T extends object>(a: T | null, b: T | null): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => a[key as keyof T] === b[key as keyof T]);
}

/**
 * Deep equality check for nested objects
 * Use with caution on large objects as it's more expensive
 * Improved type safety
 */
export function deepEqual<T>(a: T, b: T): boolean {
    return defaultEqualityFn(a, b);
}

/**
 * Memoized equality function for better performance
 * Uses WeakMap to cache results without memory leaks
 */
export function memoizedEqualityFn<T>(): (a: T, b: T) => boolean {
    const cache = new WeakMap<any, WeakMap<any, boolean>>();
    
    return (a: T, b: T): boolean => {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== 'object' || typeof b !== 'object') return a === b;
        
        let innerCache = cache.get(a);
        if (innerCache) {
            const cachedResult = innerCache.get(b);
            if (cachedResult !== undefined) return cachedResult;
        } else {
            innerCache = new WeakMap();
            cache.set(a, innerCache);
        }
        
        const result = defaultEqualityFn(a, b);
        innerCache.set(b, result);
        return result;
    };
}

/**
 * Optimized array equality check
 * Useful for comparing arrays of primitives or simple objects
 */
export function arrayEqual<T>(a: T[], b: T[], compareFn: (a: T, b: T) => boolean = defaultEqualityFn): boolean {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    
    return a.every((item, index) => compareFn(item, b[index]));
}
