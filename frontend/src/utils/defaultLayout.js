/**
 * Utility for fetching and caching the default layout from the backend
 */

let defaultLayoutCache = null;
let defaultLayoutPromise = null;

/**
 * Fetch the default layout from the backend API
 * Results are cached to avoid repeated API calls
 * 
 * @returns {Promise<string>} The name of the default layout
 */
export async function getDefaultLayout() {
    // Return cached value if available
    if (defaultLayoutCache) {
        return defaultLayoutCache;
    }

    // Return existing promise if already fetching
    if (defaultLayoutPromise) {
        return defaultLayoutPromise;
    }

    // Start fetching
    defaultLayoutPromise = (async () => {
        try {
            const response = await fetch('/api/v1/webpages/layouts/default/', {
                headers: {
                    'Accept': 'application/json',
                },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch default layout: ${response.status}`);
            }

            const data = await response.json();
            const layoutName = data.name;

            // Cache the result
            defaultLayoutCache = layoutName;
            console.log(`Default layout fetched from backend: ${layoutName}`);

            return layoutName;
        } catch (error) {
            console.error('Failed to fetch default layout from backend:', error);
            // Fallback to main_layout if API call fails
            defaultLayoutCache = 'main_layout';
            return 'main_layout';
        } finally {
            defaultLayoutPromise = null;
        }
    })();

    return defaultLayoutPromise;
}

/**
 * Clear the cached default layout (useful for testing or when layouts change)
 */
export function clearDefaultLayoutCache() {
    defaultLayoutCache = null;
    defaultLayoutPromise = null;
}

/**
 * Synchronously get the cached default layout, or return the fallback
 * Use this when you need an immediate value (e.g., in default props)
 * 
 * @param {string} fallback - Fallback layout name if cache is empty
 * @returns {string} The cached default layout or fallback
 */
export function getDefaultLayoutSync(fallback = 'main_layout') {
    return defaultLayoutCache || fallback;
}

