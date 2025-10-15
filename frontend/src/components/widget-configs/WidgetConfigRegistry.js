/**
 * Widget Configuration Registry
 * 
 * Loads and manages widget configuration schemas from the backend API.
 * Provides methods to retrieve widget config metadata for building dynamic forms.
 */

import { api } from '../../api'

class WidgetConfigRegistry {
    constructor() {
        this.schemas = new Map()
        this.initialized = false
        this.initPromise = null
    }

    async initialize() {
        if (this.initialized) return
        if (this.initPromise) return this.initPromise

        this.initPromise = this._loadSchemas()
        await this.initPromise
        this.initialized = true
    }

    async _loadSchemas() {
        try {
            // Load all available widget types
            const response = await api.get('/webpages/widget-types/', {
                params: { active: true, include_template_json: false }
            })

            const widgetTypes = response.data || []

            // For each widget type, fetch its config UI schema
            const schemaPromises = widgetTypes.map(async (widgetType) => {
                try {
                    const schemaResponse = await api.get(
                        `/webpages/widget-types/${widgetType.type}/config-ui-schema/`
                    )

                    this.schemas.set(widgetType.type, {
                        widgetType: widgetType.type,
                        widgetName: widgetType.name,
                        description: widgetType.description,
                        ...schemaResponse.data
                    })

                    return schemaResponse.data
                } catch (error) {
                    console.error(`Failed to load config schema for ${widgetType.name}:`, error)
                    return null
                }
            })

            await Promise.all(schemaPromises)
            console.log(`Loaded ${this.schemas.size} widget configuration schemas`)
        } catch (error) {
            console.error('Failed to load widget schemas:', error)
            throw error
        }
    }

    /**
     * Get configuration schema for a specific widget type
     */
    getWidgetSchema(widgetType) {
        return this.schemas.get(widgetType)
    }

    /**
     * Get all widget schemas
     */
    getAllSchemas() {
        return Array.from(this.schemas.values())
    }

    /**
     * Check if a widget type has a configuration schema
     */
    hasSchema(widgetType) {
        return this.schemas.has(widgetType)
    }

    /**
     * Get fields metadata for a widget type
     */
    getFieldsMetadata(widgetType) {
        const schema = this.schemas.get(widgetType)
        return schema?.fields || {}
    }

    /**
     * Get default configuration for a widget type
     */
    getDefaults(widgetType) {
        const schema = this.schemas.get(widgetType)
        return schema?.defaults || {}
    }

    /**
     * Get required fields for a widget type
     */
    getRequiredFields(widgetType) {
        const schema = this.schemas.get(widgetType)
        return schema?.required || []
    }

    /**
     * Check if registry is initialized
     */
    isInitialized() {
        return this.initialized
    }
}

// Global instance
export const widgetConfigRegistry = new WidgetConfigRegistry()

// Convenience functions
export const initializeWidgetConfigRegistry = () => widgetConfigRegistry.initialize()
export const getWidgetSchema = (widgetType) => widgetConfigRegistry.getWidgetSchema(widgetType)
export const getWidgetFields = (widgetType) => widgetConfigRegistry.getFieldsMetadata(widgetType)
export const getWidgetDefaults = (widgetType) => widgetConfigRegistry.getDefaults(widgetType)
export const isWidgetConfigRegistryInitialized = () => widgetConfigRegistry.isInitialized()

export default widgetConfigRegistry

