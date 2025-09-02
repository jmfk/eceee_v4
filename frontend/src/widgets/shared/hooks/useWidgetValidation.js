/**
 * useWidgetValidation - Advanced widget validation hooks
 * 
 * Provides comprehensive validation functionality with real-time validation,
 * error tracking, and validation state management.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useWidgetContext } from '../context/WidgetContext'
import {
    validateWidgetConfig,
    validateWidgetsInSlot,
    getValidationSummary,
    VALIDATION_SEVERITY
} from '../utils/validation'

/**
 * Hook for real-time widget validation
 * @param {string} slotName - Target slot name
 * @param {Object} slotConfig - Slot configuration
 * @param {Object} options - Validation options
 * @returns {Object} Validation state and functions
 */
export function useRealTimeValidation(slotName, slotConfig = {}, options = {}) {
    const {
        validateOnChange = true,
        validateOnBlur = true,
        debounceMs = 300,
        showWarnings = true
    } = options

    const { widgets, context } = useWidgetContext()
    const [validationState, setValidationState] = useState({})
    const [isValidating, setIsValidating] = useState(false)
    const [validationHistory, setValidationHistory] = useState([])

    const debounceTimeoutRef = useRef(null)
    const slotWidgets = widgets[slotName] || []

    /**
     * Validate a single widget
     */
    const validateWidget = useCallback(async (widget) => {
        const validation = validateWidgetConfig(widget, {
            context,
            slotConfig,
            existingWidgets: slotWidgets.filter(w => w.id !== widget.id)
        })

        setValidationState(prev => ({
            ...prev,
            [widget.id]: {
                ...validation,
                timestamp: new Date().toISOString(),
                widgetId: widget.id
            }
        }))

        return validation
    }, [context, slotConfig, slotWidgets])

    /**
     * Validate all widgets in slot
     */
    const validateSlot = useCallback(async () => {
        setIsValidating(true)

        try {
            const slotValidation = validateWidgetsInSlot(slotWidgets, slotConfig, context)

            // Update individual widget validations
            const newValidationState = {}
            Object.entries(slotValidation.widgetResults || {}).forEach(([widgetId, result]) => {
                newValidationState[widgetId] = {
                    ...result,
                    timestamp: new Date().toISOString(),
                    widgetId
                }
            })

            setValidationState(prev => ({
                ...prev,
                ...newValidationState
            }))

            // Add to validation history
            setValidationHistory(prev => [
                ...prev.slice(-9), // Keep last 10 entries
                {
                    timestamp: new Date().toISOString(),
                    slotName,
                    validation: slotValidation,
                    widgetCount: slotWidgets.length
                }
            ])

            return slotValidation
        } finally {
            setIsValidating(false)
        }
    }, [slotWidgets, slotConfig, context, slotName])

    /**
     * Debounced validation
     */
    const debouncedValidate = useCallback(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current)
        }

        debounceTimeoutRef.current = setTimeout(() => {
            validateSlot()
        }, debounceMs)
    }, [validateSlot, debounceMs])

    /**
     * Clear validation for widget
     */
    const clearWidgetValidation = useCallback((widgetId) => {
        setValidationState(prev => {
            const newState = { ...prev }
            delete newState[widgetId]
            return newState
        })
    }, [])

    /**
     * Clear all validations
     */
    const clearAllValidations = useCallback(() => {
        setValidationState({})
    }, [])

    // Auto-validate when widgets change
    useEffect(() => {
        if (validateOnChange) {
            debouncedValidate()
        }

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current)
            }
        }
    }, [validateOnChange, debouncedValidate, slotWidgets])

    /**
     * Get validation for specific widget
     */
    const getWidgetValidation = useCallback((widgetId) => {
        return validationState[widgetId] || null
    }, [validationState])

    /**
     * Check if widget has errors
     */
    const hasWidgetErrors = useCallback((widgetId) => {
        const validation = validationState[widgetId]
        return validation && !validation.isValid
    }, [validationState])

    /**
     * Check if widget has warnings
     */
    const hasWidgetWarnings = useCallback((widgetId) => {
        const validation = validationState[widgetId]
        return validation && validation.hasWarnings
    }, [validationState])

    /**
     * Get validation summary for slot
     */
    const slotValidationSummary = useMemo(() => {
        const validations = Object.values(validationState)
        const errors = validations.filter(v => !v.isValid)
        const warnings = validations.filter(v => v.hasWarnings)

        return {
            totalWidgets: slotWidgets.length,
            validatedWidgets: validations.length,
            errorCount: errors.length,
            warningCount: warnings.length,
            isValid: errors.length === 0,
            hasWarnings: warnings.length > 0,
            completionRate: slotWidgets.length > 0
                ? (validations.length / slotWidgets.length) * 100
                : 100
        }
    }, [validationState, slotWidgets.length])

    return {
        validationState,
        isValidating,
        validationHistory,
        validateWidget,
        validateSlot,
        debouncedValidate,
        clearWidgetValidation,
        clearAllValidations,
        getWidgetValidation,
        hasWidgetErrors,
        hasWidgetWarnings,
        slotValidationSummary
    }
}

/**
 * Hook for validation error tracking and reporting
 * @param {string} slotName - Target slot name
 * @returns {Object} Error tracking functions and state
 */
export function useValidationErrorTracking(slotName) {
    const [errorLog, setErrorLog] = useState([])
    const [errorStats, setErrorStats] = useState({})

    /**
     * Log validation error
     */
    const logValidationError = useCallback((widgetId, error) => {
        const errorEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            slotName,
            widgetId,
            error,
            severity: error.severity || VALIDATION_SEVERITY.ERROR
        }

        setErrorLog(prev => [errorEntry, ...prev.slice(0, 99)]) // Keep last 100 errors

        // Update error stats
        setErrorStats(prev => ({
            ...prev,
            [error.type]: (prev[error.type] || 0) + 1
        }))
    }, [slotName])

    /**
     * Clear error log
     */
    const clearErrorLog = useCallback(() => {
        setErrorLog([])
        setErrorStats({})
    }, [])

    /**
     * Get errors by severity
     */
    const getErrorsBySeverity = useCallback((severity) => {
        return errorLog.filter(entry => entry.severity === severity)
    }, [errorLog])

    /**
     * Get errors by widget
     */
    const getErrorsByWidget = useCallback((widgetId) => {
        return errorLog.filter(entry => entry.widgetId === widgetId)
    }, [errorLog])

    /**
     * Get most common errors
     */
    const getMostCommonErrors = useCallback((limit = 5) => {
        return Object.entries(errorStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([type, count]) => ({ type, count }))
    }, [errorStats])

    return {
        errorLog,
        errorStats,
        logValidationError,
        clearErrorLog,
        getErrorsBySeverity,
        getErrorsByWidget,
        getMostCommonErrors,
        totalErrors: errorLog.length,
        recentErrors: errorLog.slice(0, 10)
    }
}

/**
 * Hook for validation rule management
 * @returns {Object} Rule management functions
 */
export function useValidationRules() {
    const [customRules, setCustomRules] = useState({})
    const [ruleCache, setRuleCache] = useState({})

    /**
     * Add custom validation rule
     */
    const addCustomRule = useCallback((widgetType, ruleName, ruleFunction) => {
        setCustomRules(prev => ({
            ...prev,
            [widgetType]: {
                ...prev[widgetType],
                [ruleName]: ruleFunction
            }
        }))

        // Clear cache for this widget type
        setRuleCache(prev => {
            const newCache = { ...prev }
            delete newCache[widgetType]
            return newCache
        })
    }, [])

    /**
     * Remove custom rule
     */
    const removeCustomRule = useCallback((widgetType, ruleName) => {
        setCustomRules(prev => {
            const newRules = { ...prev }
            if (newRules[widgetType]) {
                const typeRules = { ...newRules[widgetType] }
                delete typeRules[ruleName]

                if (Object.keys(typeRules).length === 0) {
                    delete newRules[widgetType]
                } else {
                    newRules[widgetType] = typeRules
                }
            }
            return newRules
        })
    }, [])

    /**
     * Get rules for widget type
     */
    const getRulesForType = useCallback((widgetType) => {
        if (ruleCache[widgetType]) {
            return ruleCache[widgetType]
        }

        const rules = customRules[widgetType] || {}
        setRuleCache(prev => ({ ...prev, [widgetType]: rules }))

        return rules
    }, [customRules, ruleCache])

    /**
     * Validate with custom rules
     */
    const validateWithCustomRules = useCallback((widget) => {
        const rules = getRulesForType(widget.slug || widget.type)
        const results = []

        Object.entries(rules).forEach(([ruleName, ruleFunction]) => {
            try {
                const result = ruleFunction(widget)
                if (result && !result.isValid) {
                    results.push({
                        rule: ruleName,
                        message: result.message,
                        severity: result.severity || VALIDATION_SEVERITY.ERROR
                    })
                }
            } catch (error) {
                results.push({
                    rule: ruleName,
                    message: `Rule execution failed: ${error.message}`,
                    severity: VALIDATION_SEVERITY.ERROR
                })
            }
        })

        return {
            isValid: results.length === 0,
            results,
            customRuleCount: Object.keys(rules).length
        }
    }, [getRulesForType])

    return {
        customRules,
        addCustomRule,
        removeCustomRule,
        getRulesForType,
        validateWithCustomRules,
        hasCustomRules: Object.keys(customRules).length > 0
    }
}

/**
 * Hook for validation performance monitoring
 * @returns {Object} Performance monitoring data
 */
export function useValidationPerformance() {
    const [performanceData, setPerformanceData] = useState({
        validationTimes: [],
        averageTime: 0,
        slowestValidation: null,
        totalValidations: 0
    })

    /**
     * Record validation performance
     */
    const recordValidationTime = useCallback((duration, widgetId = null, validationType = 'widget') => {
        const record = {
            duration,
            widgetId,
            validationType,
            timestamp: new Date().toISOString()
        }

        setPerformanceData(prev => {
            const newTimes = [record, ...prev.validationTimes.slice(0, 99)] // Keep last 100
            const totalTime = newTimes.reduce((sum, r) => sum + r.duration, 0)
            const averageTime = totalTime / newTimes.length

            const slowest = newTimes.reduce((slowest, current) =>
                current.duration > (slowest?.duration || 0) ? current : slowest
                , null)

            return {
                validationTimes: newTimes,
                averageTime,
                slowestValidation: slowest,
                totalValidations: prev.totalValidations + 1
            }
        })
    }, [])

    /**
     * Get performance summary
     */
    const getPerformanceSummary = useCallback(() => {
        const { validationTimes, averageTime, slowestValidation, totalValidations } = performanceData

        return {
            averageTime: Math.round(averageTime * 100) / 100,
            slowestTime: slowestValidation?.duration || 0,
            fastestTime: Math.min(...validationTimes.map(r => r.duration)) || 0,
            totalValidations,
            recentValidations: validationTimes.slice(0, 10)
        }
    }, [performanceData])

    /**
     * Clear performance data
     */
    const clearPerformanceData = useCallback(() => {
        setPerformanceData({
            validationTimes: [],
            averageTime: 0,
            slowestValidation: null,
            totalValidations: 0
        })
    }, [])

    return {
        performanceData,
        recordValidationTime,
        getPerformanceSummary,
        clearPerformanceData
    }
}
