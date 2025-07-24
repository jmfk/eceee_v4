import { useState, useEffect, useCallback, useRef } from 'react'
import HtmlSlotDetector, { detectSlotsFromHTML } from '../utils/slotDetection'

/**
 * useHtmlSlots Hook
 * 
 * React hook for managing HTML-based layout slots with automatic detection,
 * state synchronization, and widget management integration.
 * 
 * Features:
 * - Automatic slot detection from HTML templates
 * - Real-time slot validation and error handling
 * - Widget-slot synchronization
 * - Slot highlighting and visual editing support
 * - Portal element management for widget mounting
 */
export const useHtmlSlots = (options = {}) => {
    const {
        containerElement,
        layout,
        widgetsBySlot = {},
        autoDetect = true,
        observeChanges = false,
        enableHighlighting = true,
        onSlotChange,
        onSlotValidation,
        onSlotError
    } = options

    // State
    const [slots, setSlots] = useState(new Map())
    const [slotElements, setSlotElements] = useState({})
    const [slotsConfiguration, setSlotsConfiguration] = useState([])
    const [validation, setValidation] = useState({
        isValid: true,
        errors: [],
        warnings: [],
        slotCount: 0
    })
    const [isDetecting, setIsDetecting] = useState(false)
    const [activeSlot, setActiveSlot] = useState(null)

    // Refs
    const detectorRef = useRef(null)
    const previousLayoutRef = useRef(null)

    /**
     * Initialize or update slot detector
     */
    const initializeDetector = useCallback(() => {
        if (!containerElement) return

        // Cleanup previous detector
        if (detectorRef.current) {
            detectorRef.current.cleanup()
        }

        // Create new detector
        detectorRef.current = new HtmlSlotDetector(containerElement, {
            autoDetect,
            observeChanges,
            validateSlots: true,
            addCssClasses: enableHighlighting
        })

        return detectorRef.current
    }, [containerElement, autoDetect, observeChanges, enableHighlighting])

    /**
     * Detect slots and update state
     */
    const detectSlots = useCallback(async () => {
        if (!detectorRef.current || isDetecting) return

        setIsDetecting(true)

        try {
            const detectedSlots = detectorRef.current.detectSlots()
            const slotElementsMap = detectorRef.current.getSlotElements()
            const configuration = detectorRef.current.getSlotsConfiguration()
            const validationResult = detectorRef.current.validateSlots()

            // Update state
            setSlots(detectedSlots)
            setSlotElements(slotElementsMap)
            setSlotsConfiguration(configuration)
            setValidation(validationResult)

            // Notify callbacks
            if (onSlotChange) {
                onSlotChange(configuration)
            }

            if (onSlotValidation) {
                onSlotValidation(validationResult)
            }

            if (!validationResult.isValid && onSlotError) {
                onSlotError(validationResult.errors)
            }

        } catch (error) {
            const errorMessage = `Slot detection failed: ${error.message}`
            setValidation(prev => ({
                ...prev,
                isValid: false,
                errors: [...prev.errors, errorMessage]
            }))

            if (onSlotError) {
                onSlotError([errorMessage])
            }
        } finally {
            setIsDetecting(false)
        }
    }, [isDetecting, onSlotChange, onSlotValidation, onSlotError])

    /**
     * Update widget counts for slots
     */
    const updateSlotWidgets = useCallback(() => {
        if (!detectorRef.current) return

        Object.entries(widgetsBySlot).forEach(([slotName, widgets]) => {
            detectorRef.current.updateSlotWidgets(slotName, widgets)
        })
    }, [widgetsBySlot])

    /**
     * Highlight all slots for visual editing
     */
    const highlightSlots = useCallback(() => {
        if (detectorRef.current && enableHighlighting) {
            detectorRef.current.highlightAllSlots()
        }
    }, [enableHighlighting])

    /**
     * Remove slot highlighting
     */
    const unhighlightSlots = useCallback(() => {
        if (detectorRef.current) {
            detectorRef.current.unhighlightAllSlots()
        }
    }, [])

    /**
     * Set active slot for editing
     */
    const setActiveSlotName = useCallback((slotName) => {
        if (detectorRef.current) {
            detectorRef.current.setActiveSlot(slotName)
            setActiveSlot(slotName)
        }
    }, [])

    /**
     * Get slot by name
     */
    const getSlot = useCallback((slotName) => {
        return slots.get(slotName)
    }, [slots])

    /**
     * Get slot element by name
     */
    const getSlotElement = useCallback((slotName) => {
        return slotElements[slotName]
    }, [slotElements])

    /**
     * Validate specific slot
     */
    const validateSlot = useCallback((slotName) => {
        const slot = getSlot(slotName)
        if (!slot) return { isValid: false, errors: ['Slot not found'] }

        return {
            isValid: slot.isValid,
            errors: slot.errors,
            warnings: slot.warnings
        }
    }, [getSlot])

    /**
     * Update slot metadata
     */
    const updateSlotMetadata = useCallback((slotName, metadata) => {
        const slot = getSlot(slotName)
        if (slot) {
            slot.updateMetadata(metadata)

            // Trigger re-detection to update configuration
            detectSlots()
        }
    }, [getSlot, detectSlots])

    /**
     * Get slots that can accept a specific widget type
     */
    const getSlotsForWidgetType = useCallback((widgetTypeName) => {
        return slotsConfiguration.filter(slot => {
            if (!slot.allowed_widget_types || slot.allowed_widget_types.length === 0) {
                return true // No restrictions
            }
            return slot.allowed_widget_types.includes(widgetTypeName)
        })
    }, [slotsConfiguration])

    /**
     * Check if slot can accept more widgets
     */
    const canSlotAcceptWidget = useCallback((slotName) => {
        const slot = slotsConfiguration.find(s => s.name === slotName)
        if (!slot) return false

        const currentWidgets = widgetsBySlot[slotName] || []

        if (slot.max_widgets && currentWidgets.length >= slot.max_widgets) {
            return false
        }

        return true
    }, [slotsConfiguration, widgetsBySlot])

    /**
     * Get slot statistics
     */
    const getSlotStats = useCallback(() => {
        const stats = {
            totalSlots: slots.size,
            validSlots: 0,
            invalidSlots: 0,
            emptySlots: 0,
            fullSlots: 0,
            totalWidgets: 0
        }

        slotsConfiguration.forEach(slot => {
            if (slot.isValid) {
                stats.validSlots++
            } else {
                stats.invalidSlots++
            }

            const slotWidgets = widgetsBySlot[slot.name] || []
            stats.totalWidgets += slotWidgets.length

            if (slotWidgets.length === 0) {
                stats.emptySlots++
            } else {
                stats.fullSlots++
            }
        })

        return stats
    }, [slots.size, slotsConfiguration, widgetsBySlot])

    // Effects

    /**
     * Initialize detector when container element changes
     */
    useEffect(() => {
        if (containerElement) {
            initializeDetector()
        }

        return () => {
            if (detectorRef.current) {
                detectorRef.current.cleanup()
                detectorRef.current = null
            }
        }
    }, [containerElement, initializeDetector])

    /**
     * Detect slots when layout changes
     */
    useEffect(() => {
        const layoutHtml = layout?.html || layout?.template_html
        const layoutChanged = previousLayoutRef.current !== layoutHtml

        if (layoutChanged && autoDetect) {
            previousLayoutRef.current = layoutHtml

            // Small delay to ensure DOM is updated
            const timeoutId = setTimeout(() => {
                detectSlots()
            }, 100)

            return () => clearTimeout(timeoutId)
        }
    }, [layout, autoDetect, detectSlots])

    /**
     * Update widget counts when widgets change
     */
    useEffect(() => {
        updateSlotWidgets()
    }, [updateSlotWidgets])

    /**
     * Static method for quick slot detection from HTML string
     */
    const detectSlotsFromLayoutHTML = useCallback((htmlString) => {
        return detectSlotsFromHTML(htmlString)
    }, [])

    return {
        // State
        slots: Array.from(slots.values()),
        slotElements,
        slotsConfiguration,
        validation,
        isDetecting,
        activeSlot,

        // Actions
        detectSlots,
        highlightSlots,
        unhighlightSlots,
        setActiveSlot: setActiveSlotName,
        updateSlotMetadata,

        // Queries
        getSlot,
        getSlotElement,
        validateSlot,
        getSlotsForWidgetType,
        canSlotAcceptWidget,
        getSlotStats,

        // Utilities
        detectSlotsFromLayoutHTML,

        // Status
        hasSlots: slots.size > 0,
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
    }
}

/**
 * Hook variant specifically for template-based layouts
 */
export const useTemplateSlots = (templateElement, layout, widgetsBySlot, options = {}) => {
    return useHtmlSlots({
        containerElement: templateElement,
        layout,
        widgetsBySlot,
        autoDetect: true,
        observeChanges: false, // Templates usually don't change dynamically
        enableHighlighting: true,
        ...options
    })
}

/**
 * Hook for slot detection from HTML string (preview mode)
 */
export const useSlotPreview = (htmlString) => {
    const [detectedSlots, setDetectedSlots] = useState([])
    const [isDetecting, setIsDetecting] = useState(false)
    const [errors, setErrors] = useState([])

    useEffect(() => {
        if (!htmlString) {
            setDetectedSlots([])
            setErrors([])
            return
        }

        setIsDetecting(true)
        setErrors([])

        try {
            const slots = detectSlotsFromHTML(htmlString)
            setDetectedSlots(slots)
        } catch (error) {
            setErrors([`Preview detection failed: ${error.message}`])
            setDetectedSlots([])
        } finally {
            setIsDetecting(false)
        }
    }, [htmlString])

    return {
        detectedSlots,
        isDetecting,
        errors,
        hasSlots: detectedSlots.length > 0
    }
}

export default useHtmlSlots 