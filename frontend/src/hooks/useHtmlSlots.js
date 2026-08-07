import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HtmlSlotDetector, detectSlotsFromHTML } from '../utils/slotDetection'

const initialValidation = {
    isValid: true,
    errors: [],
    warnings: [],
    slotCount: 0,
    validSlots: 0,
    invalidSlots: 0,
}

const toSlotArray = (slots) => {
    if (!slots) return []
    if (Array.isArray(slots)) return slots
    if (slots instanceof Map) return Array.from(slots.values())
    return Object.values(slots)
}

export const useHtmlSlots = ({
    containerElement = null,
    layout = null,
    widgetsBySlot = {},
    autoDetect = false,
    observeChanges = true,
    onSlotChange,
    onSlotValidation,
    onSlotError,
} = {}) => {
    const detectorRef = useRef(null)
    const [slots, setSlots] = useState([])
    const [slotElements, setSlotElements] = useState({})
    const [slotsConfiguration, setSlotsConfiguration] = useState([])
    const [validation, setValidation] = useState(initialValidation)
    const [isDetecting, setIsDetecting] = useState(false)
    const [activeSlot, setActiveSlotState] = useState(null)

    const detectSlots = useCallback(async () => {
        if (!containerElement) {
            setSlots([])
            setSlotElements({})
            setSlotsConfiguration([])
            setValidation(initialValidation)
            return []
        }

        setIsDetecting(true)

        try {
            const detector = new HtmlSlotDetector(containerElement, {
                layout,
                widgetsBySlot,
                observeChanges,
            })
            detectorRef.current = detector

            const detectedSlots = toSlotArray(detector.detectSlots())
            const elements = detector.getSlotElements?.() || {}
            const configuration = detector.getSlotsConfiguration?.() || detectedSlots
            const validationResult = detector.validateSlots?.() || initialValidation

            setSlots(detectedSlots)
            setSlotElements(elements)
            setSlotsConfiguration(configuration)
            setValidation(validationResult)

            onSlotChange?.(detectedSlots)
            onSlotValidation?.(validationResult)

            return detectedSlots
        } catch (error) {
            onSlotError?.(error)
            setValidation({
                ...initialValidation,
                isValid: false,
                errors: [error.message],
            })
            return []
        } finally {
            setIsDetecting(false)
        }
    }, [containerElement, layout, widgetsBySlot, observeChanges, onSlotChange, onSlotValidation, onSlotError])

    useEffect(() => {
        if (!autoDetect) return undefined

        const timer = setTimeout(() => {
            detectSlots()
        }, 0)

        return () => clearTimeout(timer)
    }, [autoDetect, detectSlots, layout?.html])

    useEffect(() => {
        return () => {
            detectorRef.current?.cleanup?.()
        }
    }, [])

    const getSlot = useCallback((name) => slots.find(slot => slot.name === name) || null, [slots])
    const getSlotElement = useCallback((name) => slotElements[name] || null, [slotElements])
    const validateSlot = useCallback((name) => {
        const slot = getSlot(name)
        if (!slot) return { isValid: false, errors: ['Slot not found'], warnings: [] }
        return {
            isValid: slot.isValid !== false,
            errors: slot.errors || [],
            warnings: slot.warnings || [],
        }
    }, [getSlot])

    const getSlotsForWidgetType = useCallback((widgetType) => {
        return slotsConfiguration.filter(slot => {
            const allowedTypes = slot.allowedWidgetTypes || slot.allowed_widget_types || []
            return allowedTypes.length === 0 || allowedTypes.includes(widgetType)
        })
    }, [slotsConfiguration])

    const canSlotAcceptWidget = useCallback((slotName, widgetType = null) => {
        const slot = slotsConfiguration.find(item => item.name === slotName)
        if (!slot || slot.isValid === false) return false

        const allowedTypes = slot.allowedWidgetTypes || slot.allowed_widget_types || []
        return !widgetType || allowedTypes.length === 0 || allowedTypes.includes(widgetType)
    }, [slotsConfiguration])

    const getSlotStats = useCallback(() => {
        const totalWidgets = Object.values(widgetsBySlot || {}).reduce((total, widgets) => {
            return total + (Array.isArray(widgets) ? widgets.length : 0)
        }, 0)
        const fullSlots = slotsConfiguration.filter(slot => {
            const widgets = widgetsBySlot?.[slot.name] || []
            return widgets.length > 0
        }).length

        return {
            totalSlots: slotsConfiguration.length,
            validSlots: slotsConfiguration.filter(slot => slot.isValid !== false).length,
            invalidSlots: slotsConfiguration.filter(slot => slot.isValid === false).length,
            totalWidgets,
            emptySlots: Math.max(slotsConfiguration.length - fullSlots, 0),
            fullSlots,
        }
    }, [slotsConfiguration, widgetsBySlot])

    const highlightSlots = useCallback(() => detectorRef.current?.highlightAllSlots?.(), [])
    const unhighlightSlots = useCallback(() => detectorRef.current?.unhighlightAllSlots?.(), [])
    const setActiveSlot = useCallback((slotName) => {
        setActiveSlotState(slotName)
        detectorRef.current?.setActiveSlot?.(slotName)
    }, [])
    const updateSlotMetadata = useCallback((slotName, metadata) => {
        setSlotsConfiguration(prev => prev.map(slot =>
            slot.name === slotName ? { ...slot, ...metadata } : slot
        ))
    }, [])

    return {
        slots,
        slotElements,
        slotsConfiguration,
        validation,
        isDetecting,
        activeSlot,
        hasSlots: slotsConfiguration.length > 0,
        detectSlots,
        getSlot,
        getSlotElement,
        validateSlot,
        getSlotsForWidgetType,
        canSlotAcceptWidget,
        getSlotStats,
        highlightSlots,
        unhighlightSlots,
        setActiveSlot,
        updateSlotMetadata,
    }
}

export const useTemplateSlots = (containerElement, layout, widgetsBySlot = {}, options = {}) => {
    return useHtmlSlots({
        containerElement,
        layout,
        widgetsBySlot,
        observeChanges: false,
        ...options,
    })
}

export const useSlotPreview = (html) => {
    const [detectedSlots, setDetectedSlots] = useState([])
    const [isDetecting, setIsDetecting] = useState(false)
    const [errors, setErrors] = useState([])

    useEffect(() => {
        let cancelled = false
        setIsDetecting(true)

        Promise.resolve().then(() => {
            if (cancelled) return
            try {
                const slots = detectSlotsFromHTML(html)
                setDetectedSlots(slots)
                setErrors([])
            } catch (error) {
                setDetectedSlots([])
                setErrors([error.message])
            } finally {
                setIsDetecting(false)
            }
        })

        return () => {
            cancelled = true
        }
    }, [html])

    return useMemo(() => ({
        detectedSlots,
        hasSlots: detectedSlots.length > 0,
        isDetecting,
        errors,
    }), [detectedSlots, isDetecting, errors])
}
