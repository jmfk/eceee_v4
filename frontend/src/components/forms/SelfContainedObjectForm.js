/**
 * Self-Contained Object Form
 * 
 * A vanilla JavaScript object form that manages its own state and DOM,
 * providing real-time server synchronization without React rerenders.
 * 
 * Based on the proven SelfContainedWidgetForm pattern used in PageEditor.
 * 
 * Key Features:
 * - Zero React rerenders - direct DOM manipulation
 * - Real-time server sync with debouncing
 * - Automatic validation with visual feedback
 * - Central registry integration for state management
 * - Self-contained lifecycle management
 * - Handles both object fields and widget slots
 */

/**
 * Central Object Registry (Singleton)
 * Manages all active object forms and provides event broadcasting
 */
class ObjectFormRegistry {
    constructor() {
        if (ObjectFormRegistry.instance) {
            return ObjectFormRegistry.instance
        }

        this.objectForms = new Map() // objectId -> form instance
        this.listeners = new Map() // event type -> Set of listeners
        ObjectFormRegistry.instance = this
    }

    register(objectForm) {
        this.objectForms.set(objectForm.objectId, objectForm)
        this.emit('OBJECT_FORM_REGISTERED', { objectId: objectForm.objectId, objectForm })
    }

    unregister(objectId) {
        const objectForm = this.objectForms.get(objectId)
        if (objectForm) {
            this.objectForms.delete(objectId)
            this.emit('OBJECT_FORM_UNREGISTERED', { objectId, objectForm })
        }
    }

    get(objectId) {
        return this.objectForms.get(objectId)
    }

    getAll() {
        return Array.from(this.objectForms.values())
    }

    subscribe(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set())
        }
        this.listeners.get(eventType).add(callback)

        // Return unsubscribe function
        return () => {
            const eventListeners = this.listeners.get(eventType)
            if (eventListeners) {
                eventListeners.delete(callback)
            }
        }
    }

    emit(eventType, data) {
        const eventListeners = this.listeners.get(eventType)
        if (eventListeners) {
            eventListeners.forEach(callback => {
                try {
                    callback(data)
                } catch (error) {
                    console.error(`ObjectFormRegistry: Error in ${eventType} listener:`, error)
                }
            })
        }
    }

    // Utility methods
    async saveAllDirty() {
        const dirtyForms = this.getAll().filter(form => form.isDirty)
        const results = []

        for (const form of dirtyForms) {
            try {
                await form.save()
                results.push({ objectId: form.objectId, success: true })
            } catch (error) {
                results.push({ objectId: form.objectId, success: false, error: error.message })
            }
        }

        return results
    }

    getDirtyCount() {
        return this.getAll().filter(form => form.isDirty).length
    }

    hasUnsavedChanges() {
        return this.getAll().some(form => form.hasUnsavedChanges)
    }
}

/**
 * Self-Contained Object Form Class
 * Manages object data and widgets without React rerenders
 */
class SelfContainedObjectForm {
    constructor(objectData, options = {}) {
        // Core data
        this.objectId = objectData.id
        this.objectType = objectData.objectType
        this.originalData = {
            title: objectData.title || '',
            data: { ...objectData.data || {} },
            status: objectData.status || 'draft',
            widgets: { ...objectData.widgets || {} },
            metadata: { ...objectData.metadata || {} }
        }
        this.currentData = {
            title: objectData.title || '',
            data: { ...objectData.data || {} },
            status: objectData.status || 'draft',
            widgets: { ...objectData.widgets || {} },
            metadata: { ...objectData.metadata || {} }
        }

        // Schema and validation
        this.schema = objectData.objectType?.schema || null
        this.validationResults = {}
        this.isValidating = false
        this.isValid = true

        // DOM management (if needed for future direct DOM manipulation)
        this.container = null
        this.fieldElements = new Map() // fieldName -> DOM element
        this.validationElements = new Map() // fieldName -> validation display element

        // Server communication
        this.debounceTimeout = null
        this.validationTimeout = null

        // State tracking
        this.isDirty = false
        this.hasUnsavedChanges = false
        this.isDestroyed = false
        this.isInitialized = false

        // Options
        this.showValidationInline = options.showValidationInline !== false
        this.showSaveStatus = options.showSaveStatus !== false

        // Registry integration
        this.registry = options.registry || new ObjectFormRegistry()

        // Specialized operations for UnifiedDataContext
        this.titleOperations = options.titleOperations || null
        this.dataOperations = options.dataOperations || null
        this.widgetOperations = options.widgetOperations || null
        this.metadataOperations = options.metadataOperations || null
        this.statusOperations = options.statusOperations || null

        // Event handlers for cleanup
        this.eventHandlers = new Map()

        // Bind methods
        this.handleFieldChange = this.handleFieldChange.bind(this)
        this.updateField = this.updateField.bind(this)
        this.updateWidgetSlot = this.updateWidgetSlot.bind(this)
        this.save = this.save.bind(this)
    }

    /**
     * Initialize the form (replaces React mounting)
     */
    async initialize(container = null) {
        if (this.isInitialized) return

        this.container = container
        this.isInitialized = true

        // Register with registry
        this.registry.register(this)

        // Set up auto-save if enabled
        if (this.autoSaveEnabled) {
            this.setupAutoSave()
        }

        // Initialize UnifiedDataContext with current data (without dirty flag)
        if (this.hasUnifiedDataOperations()) {
            try {
                await this.syncToUnifiedContext('system') // Mark as system operation
            } catch (error) {
                console.error('SelfContainedObjectForm: Failed to initialize UnifiedDataContext:', error)
            }
        }

        this.emit('INITIALIZED', { objectId: this.objectId })
    }

    /**
     * Cleanup (replaces React unmounting)
     */
    destroy() {
        if (this.isDestroyed) return

        // Clear timeouts
        if (this.debounceTimeout) clearTimeout(this.debounceTimeout)
        if (this.validationTimeout) clearTimeout(this.validationTimeout)
        if (this.saveTimeout) clearTimeout(this.saveTimeout)

        // Unregister from registry
        this.registry.unregister(this.objectId)

        // Clean up event handlers
        this.eventHandlers.clear()

        this.isDestroyed = true
        this.emit('DESTROYED', { objectId: this.objectId })
    }

    /**
     * Real-time field updates without DOM rerendering
     */
    updateField(fieldName, value, options = {}) {
        const fieldPath = fieldName.includes('.') ? fieldName.split('.') : [fieldName]
        const oldValue = this.getFieldValue(fieldPath)

        if (oldValue === value) return // No change

        // Update current data
        this.setFieldValue(fieldPath, value)

        // Update dirty state
        this.updateDirtyState()

        // Clear existing validation for this field
        this.clearFieldValidation(fieldName)

        // Debounced validation
        this.debounceValidation()

        // Sync to UnifiedDataContext immediately
        this.syncToUnifiedContext('user')

        // Immediate registry notification (for real-time preview)
        this.emit('FIELD_CHANGE', {
            objectId: this.objectId,
            fieldName,
            value,
            currentData: { ...this.currentData },
            source: options.source || 'user'
        })
    }

    /**
     * Update widget slot data
     */
    updateWidgetSlot(slotName, widgets, options = {}) {
        const oldWidgets = this.currentData.widgets[slotName] || []
        if (JSON.stringify(oldWidgets) === JSON.stringify(widgets)) return // No change

        // Update widgets
        this.currentData.widgets[slotName] = [...widgets]

        // Update dirty state
        this.updateDirtyState()

        // Debounced server sync
        // Sync to UnifiedDataContext immediately
        this.syncToUnifiedContext('user')

        // Immediate registry notification
        this.emit('WIDGET_SLOT_CHANGE', {
            objectId: this.objectId,
            slotName,
            widgets: [...widgets],
            currentData: { ...this.currentData },
            source: options.source || 'user'
        })
    }

    /**
     * Get field value by path (supports nested fields like 'data.fieldName')
     */
    getFieldValue(fieldPath) {
        if (typeof fieldPath === 'string') {
            fieldPath = fieldPath.includes('.') ? fieldPath.split('.') : [fieldPath]
        }

        let current = this.currentData
        for (const key of fieldPath) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key]
            } else {
                return undefined
            }
        }
        return current
    }

    /**
     * Set field value by path (supports nested fields like 'data.fieldName')
     */
    setFieldValue(fieldPath, value) {
        if (typeof fieldPath === 'string') {
            fieldPath = fieldPath.includes('.') ? fieldPath.split('.') : [fieldPath]
        }

        let current = this.currentData
        for (let i = 0; i < fieldPath.length - 1; i++) {
            const key = fieldPath[i]
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {}
            }
            current = current[key]
        }
        current[fieldPath[fieldPath.length - 1]] = value
    }

    /**
     * Update dirty state
     */
    updateDirtyState() {
        const wasDirty = this.isDirty
        const wasUnsavedChanges = this.hasUnsavedChanges

        // Check if data has changed from original
        this.isDirty = !this.isDataEqual(this.originalData, this.currentData)
        this.hasUnsavedChanges = this.isDirty

        // Emit events if state changed
        if (wasDirty !== this.isDirty) {
            this.emit('DIRTY_STATE_CHANGED', {
                objectId: this.objectId,
                isDirty: this.isDirty,
                hasUnsavedChanges: this.hasUnsavedChanges
            })
        }
    }

    /**
     * Deep equality check for object data
     */
    isDataEqual(obj1, obj2) {
        return JSON.stringify(obj1) === JSON.stringify(obj2)
    }

    /**
     * Clear field validation
     */
    clearFieldValidation(fieldName) {
        if (this.validationResults[fieldName]) {
            delete this.validationResults[fieldName]
        }
    }

    /**
     * Debounced validation
     */
    debounceValidation() {
        if (this.validationTimeout) {
            clearTimeout(this.validationTimeout)
        }

        this.validationTimeout = setTimeout(() => {
            this.validateAllFields()
        }, 300)
    }

    /**
     * Validate all fields
     */
    async validateAllFields() {
        if (this.isValidating) return

        this.isValidating = true
        const errors = {}

        try {
            // Validate title
            if (this.titleOperations) {
                const titleValidation = await this.titleOperations.validateTitle(this.currentData.title);
                if (!titleValidation.success) {
                    errors.title = titleValidation.validation?.errors?.map(e => e.message) || ['Title validation failed'];
                }
            }

            // Validate status
            if (this.statusOperations) {
                const statusValidation = await this.statusOperations.validateStatusTransition(this.currentData.status);
                if (!statusValidation.success) {
                    errors.status = statusValidation.validation?.errors?.map(e => e.message) || ['Status validation failed'];
                }
            }

            // Validate data fields
            if (this.dataOperations && this.schema?.properties) {
                for (const [fieldName, value] of Object.entries(this.currentData.data)) {
                    const fieldValidation = await this.dataOperations.validateField(fieldName, value);
                    if (!fieldValidation.success) {
                        errors[fieldName] = fieldValidation.validation?.errors?.map(e => e.message) || [`${fieldName} validation failed`];
                    }
                }
            }

            // Validate widget slots
            if (this.widgetOperations) {
                for (const [slotName, widgets] of Object.entries(this.currentData.widgets)) {
                    const slotValidation = await this.widgetOperations.validateWidgetSlot(slotName, widgets);
                    if (!slotValidation.success) {
                        errors[`widgets.${slotName}`] = slotValidation.validation?.errors?.map(e => e.message) || [`Widget slot ${slotName} validation failed`];
                    }
                }
            }

            // Validate metadata
            if (this.metadataOperations) {
                const metadataValidation = await this.metadataOperations.validateMetadata(this.currentData.metadata);
                if (!metadataValidation.success) {
                    errors.metadata = metadataValidation.validation?.errors?.map(e => e.message) || ['Metadata validation failed'];
                }
            }

            this.validationResults = errors;
            this.isValid = Object.keys(errors).length === 0;

            this.emit('VALIDATION_COMPLETE', {
                objectId: this.objectId,
                isValid: this.isValid,
                errors: { ...errors }
            });

        } catch (error) {
            console.error('SelfContainedObjectForm: Validation error:', error);
            this.isValid = false;
            this.validationResults = {
                form: [error instanceof Error ? error.message : 'Validation failed']
            };
        } finally {
            this.isValidating = false;
        }
    }

    /**
     * Sync current data to UnifiedDataContext (write-only, no re-renders)
     */
    async syncToUnifiedContext(source = 'user') {
        if (!this.hasUnifiedDataOperations()) {
            console.warn('SelfContainedObjectForm: No unified data operations available for sync');
            return;
        }

        try {
            // Update title if changed
            if (this.titleOperations && this.currentData.title !== this.originalData.title) {
                const result = await this.titleOperations.updateTitle(this.currentData.title, { source });
                if (!result.success) {
                    throw new Error(result.error || 'Failed to update title');
                }
            }

            // Update status if changed
            if (this.statusOperations && this.currentData.status !== this.originalData.status) {
                const result = await this.statusOperations.updateStatus(this.currentData.status, {
                    source,
                    skipValidation: source === 'system' // Skip validation for system updates
                });
                if (!result.success) {
                    throw new Error(result.error || 'Failed to update status');
                }
            }

            // Update data fields if changed
            if (this.dataOperations) {
                for (const [fieldName, value] of Object.entries(this.currentData.data)) {
                    if (this.originalData.data[fieldName] !== value) {
                        const result = await this.dataOperations.updateField(fieldName, value, { source });
                        if (!result.success) {
                            throw new Error(result.error || `Failed to update field: ${fieldName}`);
                        }
                    }
                }
            }

            // Update widget slots if changed
            if (this.widgetOperations) {
                for (const [slotName, widgets] of Object.entries(this.currentData.widgets)) {
                    if (JSON.stringify(this.originalData.widgets[slotName]) !== JSON.stringify(widgets)) {
                        const result = await this.widgetOperations.updateWidgetSlot(slotName, widgets, { source });
                        if (!result.success) {
                            throw new Error(result.error || `Failed to update widget slot: ${slotName}`);
                        }
                    }
                }
            }

            // Update metadata if changed
            if (this.metadataOperations && JSON.stringify(this.currentData.metadata) !== JSON.stringify(this.originalData.metadata)) {
                const result = await this.metadataOperations.updateMetadata(this.currentData.metadata, { source });
                if (!result.success) {
                    throw new Error(result.error || 'Failed to update metadata');
                }
            }

            this.emit('SYNCED_TO_CONTEXT', {
                objectId: this.objectId,
                source,
                currentData: { ...this.currentData }
            })

        } catch (error) {
            console.error('SelfContainedObjectForm: Failed to sync to UnifiedDataContext:', error)
            this.emit('SYNC_ERROR', {
                objectId: this.objectId,
                error: error.message
            })
        }
    }

    /**
     * Save to server (full save operation)
     */
    async save() {
        if (!this.isDirty) return { success: true, message: 'No changes to save' }

        try {
            this.emit('SAVE_STARTED', { objectId: this.objectId })

            // Validate before saving
            await this.validateAllFields()
            if (!this.isValid) {
                throw new Error('Validation failed')
            }

            // Sync to UnifiedDataContext first
            await this.syncToUnifiedContext('user')

            // Notify parent to save to server
            this.emit('SAVED_TO_SERVER', {
                objectId: this.objectId,
                savedData: { ...this.currentData }
            })

            // Wait for parent's save operation to complete (through onSave callback)
            // The parent component will call handleSaveInternal which actually saves to server
            // When that succeeds, we can update our original data

            // Update original data to match current (mark as saved)
            this.originalData = {
                title: this.currentData.title,
                data: { ...this.currentData.data },
                status: this.currentData.status,
                widgets: { ...this.currentData.widgets },
                metadata: { ...this.currentData.metadata }
            }

            // Update dirty state
            this.updateDirtyState()

            return { success: true, message: 'Object saved successfully' }

        } catch (error) {
            console.error('SelfContainedObjectForm: Save failed:', error)

            this.emit('SAVE_ERROR', {
                objectId: this.objectId,
                error: error.message
            })

            throw error
        }
    }

    /**
     * Reset to original data
     */
    reset() {
        this.currentData = {
            title: this.originalData.title,
            data: { ...this.originalData.data },
            status: this.originalData.status,
            widgets: { ...this.originalData.widgets },
            metadata: { ...this.originalData.metadata }
        }

        this.updateDirtyState()
        this.clearAllValidations()

        this.emit('RESET', {
            objectId: this.objectId,
            resetData: { ...this.currentData }
        })
    }

    /**
     * Clear all validations
     */
    clearAllValidations() {
        this.validationResults = {}
        this.isValid = true
    }

    /**
     * Emit event through registry
     */
    emit(eventType, data) {
        this.registry.emit(eventType, data)
    }

    /**
     * Handle field change (callback for form fields)
     */
    handleFieldChange(fieldName, value, options = {}) {
        this.updateField(fieldName, value, options)
    }

    /**
     * Get current data (for external access)
     */
    getCurrentData() {
        return { ...this.currentData }
    }

    /**
     * Check if unified data operations are available
     */
    hasUnifiedDataOperations() {
        return !!(
            this.titleOperations ||
            this.dataOperations ||
            this.widgetOperations ||
            this.metadataOperations ||
            this.statusOperations
        );
    }

    /**
     * Get validation results
     */
    getValidationResults() {
        return { ...this.validationResults }
    }

    /**
     * Check if field is dirty
     */
    isFieldDirty(fieldName) {
        const currentValue = this.getFieldValue(fieldName)
        const originalValue = this.getFieldValue(fieldName, this.originalData)
        return currentValue !== originalValue
    }
}

// Export classes and create global registry instance
if (typeof window !== 'undefined') {
    window.objectFormRegistry = window.objectFormRegistry || new ObjectFormRegistry()
}

export { SelfContainedObjectForm, ObjectFormRegistry }
