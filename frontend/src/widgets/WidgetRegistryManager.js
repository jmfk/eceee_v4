/**
 * Widget Registry Manager - Unified widget override system
 * 
 * This manager handles widget registration with priority-based overrides.
 * Third-party widget packages (like eceee-widgets) can override default widgets
 * by registering widgets with the same widget type.
 */

/**
 * Widget Registry Manager Class
 * Handles widget registration with priority-based overrides
 */
class WidgetRegistryManager {
    constructor() {
        this.registries = new Map(); // Map<priority, registry>
        this.priorities = {
            DEFAULT: 100,
            ECEEE: 200,
            THIRD_PARTY: 300,
            CUSTOM: 400
        };
    }

    /**
     * Register a widget registry with a specific priority
     * Higher priority numbers override lower priority numbers
     * 
     * @param {Object} registry - Widget registry object
     * @param {number} priority - Priority level (higher = more important)
     * @param {string} name - Registry name for debugging
     */
    registerRegistry(registry, priority, name = 'unnamed') {
        this.registries.set(priority, { registry, name });
        console.debug(`[WidgetRegistry] Registered ${name} registry with priority ${priority}`);
    }

    /**
     * Get widget component by type with priority-based resolution
     * Higher priority registries override lower priority ones
     * 
     * @param {string} widgetType - Widget type identifier
     * @returns {React.Component|null} Widget component or null if not found
     */
    getWidgetComponent(widgetType) {
        // Sort by priority (highest first)
        const sortedPriorities = Array.from(this.registries.keys()).sort((a, b) => b - a);

        for (const priority of sortedPriorities) {
            const { registry, name } = this.registries.get(priority);
            if (registry[widgetType]?.component) {
                console.debug(`[WidgetRegistry] Found ${widgetType} in ${name} registry (priority ${priority})`);
                return registry[widgetType].component;
            }
        }

        console.warn(`[WidgetRegistry] Widget type '${widgetType}' not found in any registry`);
        return null;
    }

    /**
     * Get widget metadata by type with priority-based resolution
     * 
     * @param {string} widgetType - Widget type identifier
     * @returns {Object|null} Widget metadata or null if not found
     */
    getWidgetMetadata(widgetType) {
        const sortedPriorities = Array.from(this.registries.keys()).sort((a, b) => b - a);

        for (const priority of sortedPriorities) {
            const { registry } = this.registries.get(priority);
            if (registry[widgetType]) {
                return registry[widgetType];
            }
        }

        return null;
    }

    /**
     * Get widget default configuration with priority-based resolution
     * 
     * @param {string} widgetType - Widget type identifier
     * @returns {Object} Default configuration object
     */
    getWidgetDefaultConfig(widgetType) {
        const metadata = this.getWidgetMetadata(widgetType);
        return metadata?.defaultConfig || {};
    }

    /**
     * Get widget display name with priority-based resolution
     * 
     * @param {string|Object} widgetTypeOrData - Widget type string or widget data object
     * @param {Array} widgetTypes - Optional array of widget type data from API
     * @returns {string} Display name
     */
    getWidgetDisplayName(widgetTypeOrData, widgetTypes = []) {
        // If widgetTypeOrData is an object (widget type data), extract name from it
        if (typeof widgetTypeOrData === 'object' && widgetTypeOrData !== null) {
            return widgetTypeOrData.name || widgetTypeOrData.label || widgetTypeOrData.display_name || widgetTypeOrData.type;
        }

        // If widgetTypeOrData is a string (widget type), look it up in registries
        if (typeof widgetTypeOrData === 'string') {
            const metadata = this.getWidgetMetadata(widgetTypeOrData);
            if (metadata) {
                return metadata.metadata?.name || metadata.displayName;
            }

            // Fallback to API data if available
            const widgetTypeData = widgetTypes.find(w => w.type === widgetTypeOrData);
            if (widgetTypeData) {
                return widgetTypeData.name || widgetTypeData.label || widgetTypeData.display_name || widgetTypeOrData;
            }

            // Last resort fallback
            return widgetTypeOrData;
        }

        return widgetTypeOrData || 'Unknown Widget';
    }

    /**
     * Check if widget type is supported in any registry
     * 
     * @param {string} widgetType - Widget type identifier
     * @returns {boolean} True if supported
     */
    isWidgetTypeSupported(widgetType) {
        return this.getWidgetComponent(widgetType) !== null;
    }

    /**
     * Get all available widget types from all registries
     * Higher priority widgets override lower priority ones with same type
     * 
     * @returns {Array} Array of widget type strings
     */
    getAvailableWidgetTypes() {
        const allTypes = new Set();

        // Process in reverse priority order so higher priority overrides are kept
        const sortedPriorities = Array.from(this.registries.keys()).sort((a, b) => a - b);

        for (const priority of sortedPriorities) {
            const { registry } = this.registries.get(priority);
            Object.keys(registry).forEach(type => allTypes.add(type));
        }

        return Array.from(allTypes);
    }

    /**
     * Get all widget metadata from all registries with override resolution
     * 
     * @returns {Object} Object mapping widget types to metadata
     */
    getAllWidgetMetadata() {
        const result = {};
        const allTypes = this.getAvailableWidgetTypes();

        for (const type of allTypes) {
            const metadata = this.getWidgetMetadata(type);
            if (metadata) {
                result[type] = metadata.metadata || metadata;
            }
        }

        return result;
    }

    /**
     * Search widgets by term across all registries
     * 
     * @param {string} searchTerm - Search term
     * @returns {Array} Array of matching widget types
     */
    searchWidgets(searchTerm = '') {
        const allTypes = this.getAvailableWidgetTypes();

        if (!searchTerm.trim()) {
            return allTypes;
        }

        const term = searchTerm.toLowerCase();
        return allTypes.filter(type => {
            const metadata = this.getWidgetMetadata(type);
            if (!metadata) return false;

            const meta = metadata.metadata || metadata;
            return (
                (meta.name && meta.name.toLowerCase().includes(term)) ||
                (meta.description && meta.description.toLowerCase().includes(term)) ||
                (meta.tags && meta.tags.some(tag => tag.toLowerCase().includes(term))) ||
                type.toLowerCase().includes(term)
            );
        });
    }

    /**
     * Filter widgets by category across all registries
     * 
     * @param {string} category - Category to filter by ('all' for no filter)
     * @returns {Array} Array of widget types in category
     */
    filterWidgetsByCategory(category = 'all') {
        const allTypes = this.getAvailableWidgetTypes();

        if (category === 'all') {
            return allTypes;
        }

        return allTypes.filter(type => {
            const metadata = this.getWidgetMetadata(type);
            const meta = metadata?.metadata || metadata;
            return meta?.category === category;
        });
    }

    /**
     * Get all available categories from all registries
     * 
     * @returns {Array} Array of category strings
     */
    getAvailableCategories() {
        const categories = new Set();
        const allTypes = this.getAvailableWidgetTypes();

        for (const type of allTypes) {
            const metadata = this.getWidgetMetadata(type);
            const meta = metadata?.metadata || metadata;
            if (meta?.category) {
                categories.add(meta.category);
            }
        }

        return Array.from(categories).sort();
    }

    /**
     * Get registry information for debugging
     * 
     * @returns {Array} Array of registry info objects
     */
    getRegistryInfo() {
        return Array.from(this.registries.entries()).map(([priority, { name, registry }]) => ({
            name,
            priority,
            widgetCount: Object.keys(registry).length,
            widgetTypes: Object.keys(registry)
        }));
    }

    /**
     * Clear all registries (useful for testing)
     */
    clearAll() {
        this.registries.clear();
    }
}

// Create singleton instance
const widgetRegistryManager = new WidgetRegistryManager();

export default widgetRegistryManager;
export { WidgetRegistryManager };
