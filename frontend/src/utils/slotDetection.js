/**
 * HTML Slot Detection and Management Utilities
 * 
 * Provides comprehensive slot detection, validation, and management for HTML-based layouts.
 * This utility works with TemplateLayoutRenderer to detect and manage widget slots
 * in HTML templates using data-widget-slot attributes.
 */

/**
 * Slot detection configuration
 */
const SLOT_DETECTION_CONFIG = {
    // Main slot attribute for detecting slots
    slotAttribute: 'data-widget-slot',

    // Optional slot metadata attributes
    metadataAttributes: {
        title: 'data-slot-title',
        description: 'data-slot-description',
        maxWidgets: 'data-slot-max-widgets',
        allowedTypes: 'data-slot-allowed-types',
        cssClasses: 'data-slot-css-classes',
        responsive: 'data-slot-responsive'
    },

    // CSS classes added to slot elements
    cssClasses: {
        container: 'widget-slot-container',
        empty: 'widget-slot-empty',
        active: 'widget-slot-active',
        editing: 'widget-slot-editing',
        highlighted: 'widget-slot-highlighted'
    },

    // Slot validation rules
    validation: {
        minNameLength: 2,
        maxNameLength: 50,
        allowedNamePattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
        reservedNames: ['root', 'container', 'wrapper', 'main']
    }
}

/**
 * Represents a detected HTML slot with metadata
 */
export class HtmlSlot {
    constructor(element, slotName, metadata = {}) {
        this.element = element
        this.name = slotName
        this.metadata = metadata
        this.widgets = []
        this.isValid = true
        this.errors = []
        this.warnings = []

        this._validateSlot()
    }

    /**
     * Validate the slot configuration
     */
    _validateSlot() {
        const { validation } = SLOT_DETECTION_CONFIG

        // Validate slot name
        if (!this.name || this.name.length < validation.minNameLength) {
            this.errors.push(`Slot name must be at least ${validation.minNameLength} characters`)
            this.isValid = false
        }

        if (this.name && this.name.length > validation.maxNameLength) {
            this.errors.push(`Slot name cannot exceed ${validation.maxNameLength} characters`)
            this.isValid = false
        }

        if (this.name && !validation.allowedNamePattern.test(this.name)) {
            this.errors.push('Slot name must start with a letter and contain only letters, numbers, hyphens, and underscores')
            this.isValid = false
        }

        if (validation.reservedNames.includes(this.name?.toLowerCase())) {
            this.warnings.push(`Slot name "${this.name}" is reserved and may cause conflicts`)
        }

        // Validate element
        if (!this.element || !this.element.nodeType) {
            this.errors.push('Invalid DOM element for slot')
            this.isValid = false
        }

        // Validate max widgets
        if (this.metadata.maxWidgets && !Number.isInteger(this.metadata.maxWidgets)) {
            this.warnings.push('Max widgets should be an integer')
        }
    }

    /**
     * Get slot configuration compatible with existing system
     */
    getSlotConfiguration() {
        return {
            name: this.name,
            displayName: this.metadata.title || this.name,
            description: this.metadata.description || '',
            maxWidgets: this.metadata.maxWidgets || null,
            allowedWidgetTypes: this.metadata.allowedTypes || [],
            cssClasses: this.metadata.cssClasses || '',
            responsive: this.metadata.responsive || false,
            selector: `[${SLOT_DETECTION_CONFIG.slotAttribute}="${this.name}"]`,
            element: this.element,
            isValid: this.isValid,
            errors: this.errors,
            warnings: this.warnings
        }
    }

    /**
     * Update slot metadata
     */
    updateMetadata(newMetadata) {
        this.metadata = { ...this.metadata, ...newMetadata }
        this._validateSlot()
        this._updateElementAttributes()
    }

    /**
     * Update DOM element attributes based on metadata
     */
    _updateElementAttributes() {
        const { metadataAttributes } = SLOT_DETECTION_CONFIG

        if (this.metadata.title) {
            this.element.setAttribute(metadataAttributes.title, this.metadata.title)
        }

        if (this.metadata.description) {
            this.element.setAttribute(metadataAttributes.description, this.metadata.description)
        }

        if (this.metadata.maxWidgets) {
            this.element.setAttribute(metadataAttributes.maxWidgets, this.metadata.maxWidgets.toString())
        }

        if (this.metadata.cssClasses) {
            this.element.setAttribute(metadataAttributes.cssClasses, this.metadata.cssClasses)
            this.element.className = `${this.element.className} ${this.metadata.cssClasses}`.trim()
        }
    }

    /**
     * Add visual highlighting to slot
     */
    highlight() {
        this.element.classList.add(SLOT_DETECTION_CONFIG.cssClasses.highlighted)
    }

    /**
     * Remove visual highlighting from slot
     */
    unhighlight() {
        this.element.classList.remove(SLOT_DETECTION_CONFIG.cssClasses.highlighted)
    }

    /**
     * Mark slot as active (being edited)
     */
    setActive(isActive = true) {
        const { active, editing } = SLOT_DETECTION_CONFIG.cssClasses

        if (isActive) {
            this.element.classList.add(active, editing)
        } else {
            this.element.classList.remove(active, editing)
        }
    }

    /**
     * Update widget count and empty state
     */
    updateWidgetCount(widgets = []) {
        this.widgets = widgets
        const { empty } = SLOT_DETECTION_CONFIG.cssClasses

        if (widgets.length === 0) {
            this.element.classList.add(empty)
        } else {
            this.element.classList.remove(empty)
        }
    }
}

/**
 * Main HTML slot detection utility
 */
export class HtmlSlotDetector {
    constructor(containerElement, options = {}) {
        this.containerElement = containerElement
        this.options = {
            autoDetect: true,
            validateSlots: true,
            addCssClasses: true,
            observeChanges: false,
            ...options
        }

        this.slots = new Map()
        this.observer = null
        this.errors = []
        this.warnings = []

        if (this.options.autoDetect) {
            this.detectSlots()
        }

        if (this.options.observeChanges) {
            this.startObserving()
        }
    }

    /**
     * Detect all slots in the container element
     */
    detectSlots() {
        if (!this.containerElement) {
            this.errors.push('No container element provided for slot detection')
            return this.slots
        }

        this.slots.clear()
        this.errors = []
        this.warnings = []

        const { slotAttribute, metadataAttributes, cssClasses } = SLOT_DETECTION_CONFIG

        // Find all elements with slot attribute
        const slotElements = this.containerElement.querySelectorAll(`[${slotAttribute}]`)

        slotElements.forEach((element, index) => {
            try {
                const slotName = element.getAttribute(slotAttribute)

                if (!slotName) {
                    this.errors.push(`Element ${index} has slot attribute but no slot name`)
                    return
                }

                if (this.slots.has(slotName)) {
                    this.warnings.push(`Duplicate slot name "${slotName}" found - using first occurrence`)
                    return
                }

                // Extract metadata from element attributes
                const metadata = {}

                Object.entries(metadataAttributes).forEach(([key, attr]) => {
                    const value = element.getAttribute(attr)
                    if (value) {
                        switch (key) {
                            case 'maxWidgets':
                                metadata[key] = parseInt(value, 10)
                                break
                            case 'allowedTypes':
                                metadata[key] = value.split(',').map(s => s.trim()).filter(Boolean)
                                break
                            case 'responsive':
                                metadata[key] = value.toLowerCase() === 'true'
                                break
                            default:
                                metadata[key] = value
                        }
                    }
                })

                // Create HtmlSlot instance
                const slot = new HtmlSlot(element, slotName, metadata)

                // Add CSS classes if enabled
                if (this.options.addCssClasses) {
                    element.classList.add(cssClasses.container)
                    if (slot.widgets.length === 0) {
                        element.classList.add(cssClasses.empty)
                    }
                }

                this.slots.set(slotName, slot)

                // Collect validation errors and warnings
                this.errors.push(...slot.errors)
                this.warnings.push(...slot.warnings)

            } catch (error) {
                this.errors.push(`Error processing slot element ${index}: ${error.message}`)
            }
        })

        return this.slots
    }

    /**
     * Get slot by name
     */
    getSlot(slotName) {
        return this.slots.get(slotName)
    }

    /**
     * Get all slots as array
     */
    getAllSlots() {
        return Array.from(this.slots.values())
    }

    /**
     * Get slots configuration compatible with existing system
     */
    getSlotsConfiguration() {
        return this.getAllSlots().map(slot => slot.getSlotConfiguration())
    }

    /**
     * Get slot elements mapping (for portal management)
     */
    getSlotElements() {
        const slotElements = {}
        this.slots.forEach((slot, slotName) => {
            slotElements[slotName] = slot.element
        })
        return slotElements
    }

    /**
     * Update widgets for a slot
     */
    updateSlotWidgets(slotName, widgets = []) {
        const slot = this.getSlot(slotName)
        if (slot) {
            slot.updateWidgetCount(widgets)
        }
    }

    /**
     * Highlight all slots for visual editing
     */
    highlightAllSlots() {
        this.slots.forEach(slot => slot.highlight())
    }

    /**
     * Remove highlighting from all slots
     */
    unhighlightAllSlots() {
        this.slots.forEach(slot => slot.unhighlight())
    }

    /**
     * Set active slot for editing
     */
    setActiveSlot(slotName) {
        // Deactivate all slots
        this.slots.forEach(slot => slot.setActive(false))

        // Activate specific slot
        const slot = this.getSlot(slotName)
        if (slot) {
            slot.setActive(true)
        }
    }

    /**
     * Validate all detected slots
     */
    validateSlots() {
        const validation = {
            isValid: true,
            errors: [...this.errors],
            warnings: [...this.warnings],
            slotCount: this.slots.size,
            validSlots: 0,
            invalidSlots: 0
        }

        this.slots.forEach(slot => {
            if (slot.isValid) {
                validation.validSlots++
            } else {
                validation.invalidSlots++
                validation.isValid = false
                validation.errors.push(...slot.errors)
            }
            validation.warnings.push(...slot.warnings)
        })

        return validation
    }

    /**
 * Start observing DOM changes for dynamic slot detection
 */
    startObserving() {
        if (!this.containerElement || this.observer) return

        // Debounce slot detection to improve performance
        let debounceTimeout = null
        const debounceDelay = 300 // ms

        const debouncedDetectSlots = () => {
            clearTimeout(debounceTimeout)
            debounceTimeout = setTimeout(() => {
                this.detectSlots()
            }, debounceDelay)
        }

        this.observer = new MutationObserver((mutations) => {
            let shouldRedetect = false

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const { slotAttribute } = SLOT_DETECTION_CONFIG
                            if (node.hasAttribute?.(slotAttribute) ||
                                node.querySelector?.(`[${slotAttribute}]`)) {
                                shouldRedetect = true
                            }
                        }
                    })
                }

                if (mutation.type === 'attributes' &&
                    mutation.attributeName === SLOT_DETECTION_CONFIG.slotAttribute) {
                    shouldRedetect = true
                }
            })

            if (shouldRedetect) {
                debouncedDetectSlots()
            }
        })

        this.observer.observe(this.containerElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [SLOT_DETECTION_CONFIG.slotAttribute]
        })

        // Store debounce timeout for cleanup
        this._debounceTimeout = debounceTimeout
    }

    /**
     * Stop observing DOM changes
     */
    stopObserving() {
        if (this.observer) {
            this.observer.disconnect()
            this.observer = null
        }

        // Clear any pending debounced detection
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout)
            this._debounceTimeout = null
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopObserving()
        this.unhighlightAllSlots()
        this.slots.clear()

        // Clear any pending debounced detection
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout)
            this._debounceTimeout = null
        }
    }
}

/**
 * Utility functions for slot detection
 */

/**
 * Quick slot detection from HTML string
 */
export function detectSlotsFromHTML(htmlString) {
    if (!htmlString) return []

    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlString

    const detector = new HtmlSlotDetector(tempDiv, { addCssClasses: false })
    return detector.getSlotsConfiguration()
}

/**
 * Validate slot name
 */
export function validateSlotName(slotName) {
    const { validation } = SLOT_DETECTION_CONFIG
    const errors = []

    if (!slotName || slotName.length < validation.minNameLength) {
        errors.push(`Slot name must be at least ${validation.minNameLength} characters`)
    }

    if (slotName && slotName.length > validation.maxNameLength) {
        errors.push(`Slot name cannot exceed ${validation.maxNameLength} characters`)
    }

    if (slotName && !validation.allowedNamePattern.test(slotName)) {
        errors.push('Slot name must start with a letter and contain only letters, numbers, hyphens, and underscores')
    }

    if (validation.reservedNames.includes(slotName?.toLowerCase())) {
        errors.push(`Slot name "${slotName}" is reserved`)
    }

    return {
        isValid: errors.length === 0,
        errors
    }
}

/**
 * Generate slot configuration from element
 */
export function getSlotConfigFromElement(element) {
    if (!element) return null

    const { slotAttribute, metadataAttributes } = SLOT_DETECTION_CONFIG
    const slotName = element.getAttribute(slotAttribute)

    if (!slotName) return null

    const metadata = {}
    Object.entries(metadataAttributes).forEach(([key, attr]) => {
        const value = element.getAttribute(attr)
        if (value) {
            metadata[key] = value
        }
    })

    const slot = new HtmlSlot(element, slotName, metadata)
    return slot.getSlotConfiguration()
}

/**
 * Create slot element with attributes
 */
export function createSlotElement(slotConfig) {
    const element = document.createElement('div')
    const { slotAttribute, metadataAttributes } = SLOT_DETECTION_CONFIG

    element.setAttribute(slotAttribute, slotConfig.name)

    if (slotConfig.title) {
        element.setAttribute(metadataAttributes.title, slotConfig.title)
    }

    if (slotConfig.description) {
        element.setAttribute(metadataAttributes.description, slotConfig.description)
    }

    if (slotConfig.maxWidgets) {
        element.setAttribute(metadataAttributes.maxWidgets, slotConfig.maxWidgets.toString())
    }

    if (slotConfig.cssClasses) {
        element.setAttribute(metadataAttributes.cssClasses, slotConfig.cssClasses)
        element.className = slotConfig.cssClasses
    }

    return element
}

export default HtmlSlotDetector 