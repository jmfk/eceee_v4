/**
 * useWidgetState - Advanced widget state management hooks
 * 
 * Provides hooks for managing widget state, caching, optimistic updates,
 * and advanced state synchronization patterns.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useWidgetContext } from '../context/WidgetContext'
import { validateWidgetConfig } from '../utils/validation'

/**
 * Hook for optimistic widget updates
 * @param {string} slotName - Target slot name
 * @param {Object} slotConfig - Slot configuration
 * @returns {Object} Optimistic update functions
 */
export function useOptimisticWidgets(slotName, slotConfig = {}) {
    const { widgets, updateWidget } = useWidgetContext()
    const [optimisticUpdates, setOptimisticUpdates] = useState({})
    const [pendingUpdates, setPendingUpdates] = useState(new Set())

    const slotWidgets = widgets[slotName] || []

    /**
     * Apply optimistic update
     */
    const applyOptimisticUpdate = useCallback((widgetId, updates) => {
        setOptimisticUpdates(prev => ({
            ...prev,
            [widgetId]: {
                ...prev[widgetId],
                ...updates,
                timestamp: Date.now()
            }
        }))
        setPendingUpdates(prev => new Set([...prev, widgetId]))
    }, [])

    /**
     * Commit optimistic update
     */
    const commitOptimisticUpdate = useCallback(async (widgetId) => {
        const updates = optimisticUpdates[widgetId]
        if (!updates) return

        try {
            await updateWidget(slotName, widgetId, updates, slotConfig)

            // Remove from optimistic updates
            setOptimisticUpdates(prev => {
                const newUpdates = { ...prev }
                delete newUpdates[widgetId]
                return newUpdates
            })

            setPendingUpdates(prev => {
                const newPending = new Set(prev)
                newPending.delete(widgetId)
                return newPending
            })
        } catch (error) {
            console.error('Failed to commit optimistic update:', error)
            // Revert optimistic update
            revertOptimisticUpdate(widgetId)
        }
    }, [optimisticUpdates, updateWidget, slotName, slotConfig])

    /**
     * Revert optimistic update
     */
    const revertOptimisticUpdate = useCallback((widgetId) => {
        setOptimisticUpdates(prev => {
            const newUpdates = { ...prev }
            delete newUpdates[widgetId]
            return newUpdates
        })

        setPendingUpdates(prev => {
            const newPending = new Set(prev)
            newPending.delete(widgetId)
            return newPending
        })
    }, [])

    /**
     * Get widget with optimistic updates applied
     */
    const getOptimisticWidget = useCallback((widgetId) => {
        const baseWidget = slotWidgets.find(w => w.id === widgetId)
        const updates = optimisticUpdates[widgetId]

        if (!baseWidget) return null
        if (!updates) return baseWidget

        return {
            ...baseWidget,
            config: {
                ...baseWidget.config,
                ...updates
            }
        }
    }, [slotWidgets, optimisticUpdates])

    /**
     * Get all widgets with optimistic updates
     */
    const optimisticWidgets = useMemo(() => {
        return slotWidgets.map(widget => {
            const updates = optimisticUpdates[widget.id]
            if (!updates) return widget

            return {
                ...widget,
                config: {
                    ...widget.config,
                    ...updates
                }
            }
        })
    }, [slotWidgets, optimisticUpdates])

    return {
        optimisticWidgets,
        pendingUpdates: Array.from(pendingUpdates),
        applyOptimisticUpdate,
        commitOptimisticUpdate,
        revertOptimisticUpdate,
        getOptimisticWidget,
        hasPendingUpdates: pendingUpdates.size > 0
    }
}

/**
 * Hook for widget caching and memoization
 * @param {string} slotName - Target slot name
 * @returns {Object} Cached widget data and cache management
 */
export function useWidgetCache(slotName) {
    const { widgets } = useWidgetContext()
    const cacheRef = useRef(new Map())
    const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 })

    const slotWidgets = widgets[slotName] || []

    /**
     * Get cached widget data
     */
    const getCachedWidget = useCallback((widgetId, computeFn) => {
        const cache = cacheRef.current
        const cacheKey = `${slotName}-${widgetId}`

        if (cache.has(cacheKey)) {
            setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }))
            return cache.get(cacheKey)
        }

        const result = computeFn()
        cache.set(cacheKey, result)
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }))

        return result
    }, [slotName])

    /**
     * Invalidate cache for widget
     */
    const invalidateWidget = useCallback((widgetId) => {
        const cache = cacheRef.current
        const cacheKey = `${slotName}-${widgetId}`
        cache.delete(cacheKey)
    }, [slotName])

    /**
     * Clear entire cache
     */
    const clearCache = useCallback(() => {
        cacheRef.current.clear()
        setCacheStats({ hits: 0, misses: 0 })
    }, [])

    /**
     * Get cache size
     */
    const cacheSize = cacheRef.current.size

    /**
     * Cache efficiency
     */
    const cacheEfficiency = useMemo(() => {
        const total = cacheStats.hits + cacheStats.misses
        return total > 0 ? (cacheStats.hits / total) * 100 : 0
    }, [cacheStats])

    // Auto-invalidate when widgets change
    useEffect(() => {
        const currentWidgetIds = new Set(slotWidgets.map(w => w.id))
        const cache = cacheRef.current

        // Remove cache entries for deleted widgets
        for (const [key] of cache) {
            const widgetId = key.split('-').slice(1).join('-')
            if (!currentWidgetIds.has(widgetId)) {
                cache.delete(key)
            }
        }
    }, [slotWidgets])

    return {
        getCachedWidget,
        invalidateWidget,
        clearCache,
        cacheSize,
        cacheStats,
        cacheEfficiency
    }
}

/**
 * Hook for widget state synchronization
 * @param {string} slotName - Target slot name
 * @param {Object} options - Sync options
 * @returns {Object} Sync functions and state
 */
export function useWidgetSync(slotName, options = {}) {
    const {
        autoSync = true,
        syncInterval = 5000,
        onSyncError = null
    } = options

    const { widgets, context } = useWidgetContext()
    const [syncState, setSyncState] = useState({
        lastSync: null,
        isSyncing: false,
        syncErrors: [],
        syncCount: 0
    })

    const syncTimeoutRef = useRef(null)
    const slotWidgets = widgets[slotName] || []

    /**
     * Sync widget state
     */
    const syncWidgets = useCallback(async () => {
        setSyncState(prev => ({ ...prev, isSyncing: true }))

        try {
            // Validate all widgets
            const validationPromises = slotWidgets.map(widget =>
                validateWidgetConfig(widget, { context })
            )

            const validations = await Promise.all(validationPromises)
            const errors = validations.filter(v => !v.isValid)

            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                lastSync: new Date().toISOString(),
                syncErrors: errors,
                syncCount: prev.syncCount + 1
            }))

            if (errors.length > 0 && onSyncError) {
                onSyncError(errors)
            }
        } catch (error) {
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                syncErrors: [error]
            }))

            if (onSyncError) {
                onSyncError([error])
            }
        }
    }, [slotWidgets, context, onSyncError])

    /**
     * Schedule sync
     */
    const scheduleSync = useCallback(() => {
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current)
        }

        syncTimeoutRef.current = setTimeout(syncWidgets, syncInterval)
    }, [syncWidgets, syncInterval])

    /**
     * Force immediate sync
     */
    const forceSync = useCallback(() => {
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current)
        }
        syncWidgets()
    }, [syncWidgets])

    // Auto-sync when widgets change
    useEffect(() => {
        if (autoSync) {
            scheduleSync()
        }

        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current)
            }
        }
    }, [autoSync, scheduleSync, slotWidgets])

    return {
        syncState,
        syncWidgets: forceSync,
        scheduleSync,
        isSyncing: syncState.isSyncing,
        lastSync: syncState.lastSync,
        syncErrors: syncState.syncErrors,
        hasErrors: syncState.syncErrors.length > 0
    }
}

/**
 * Hook for widget state persistence
 * @param {string} slotName - Target slot name
 * @param {Object} options - Persistence options
 * @returns {Object} Persistence functions
 */
export function useWidgetPersistence(slotName, options = {}) {
    const {
        storageKey = `widgets-${slotName}`,
        autoSave = true,
        saveDelay = 1000
    } = options

    const { widgets } = useWidgetContext()
    const [persistenceState, setPersistenceState] = useState({
        lastSaved: null,
        isSaving: false,
        saveError: null
    })

    const saveTimeoutRef = useRef(null)
    const slotWidgets = widgets[slotName] || []

    /**
     * Save widgets to storage
     */
    const saveWidgets = useCallback(async () => {
        setPersistenceState(prev => ({ ...prev, isSaving: true, saveError: null }))

        try {
            const widgetData = {
                widgets: slotWidgets,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }

            localStorage.setItem(storageKey, JSON.stringify(widgetData))

            setPersistenceState(prev => ({
                ...prev,
                isSaving: false,
                lastSaved: new Date().toISOString()
            }))
        } catch (error) {
            setPersistenceState(prev => ({
                ...prev,
                isSaving: false,
                saveError: error.message
            }))
        }
    }, [slotWidgets, storageKey])

    /**
     * Load widgets from storage
     */
    const loadWidgets = useCallback(() => {
        try {
            const stored = localStorage.getItem(storageKey)
            if (stored) {
                const data = JSON.parse(stored)
                return data.widgets || []
            }
        } catch (error) {
            console.error('Failed to load widgets:', error)
        }
        return []
    }, [storageKey])

    /**
     * Clear stored widgets
     */
    const clearStorage = useCallback(() => {
        localStorage.removeItem(storageKey)
        setPersistenceState(prev => ({
            ...prev,
            lastSaved: null
        }))
    }, [storageKey])

    /**
     * Schedule save
     */
    const scheduleSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        saveTimeoutRef.current = setTimeout(saveWidgets, saveDelay)
    }, [saveWidgets, saveDelay])

    // Auto-save when widgets change
    useEffect(() => {
        if (autoSave && slotWidgets.length > 0) {
            scheduleSave()
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [autoSave, scheduleSave, slotWidgets])

    return {
        persistenceState,
        saveWidgets,
        loadWidgets,
        clearStorage,
        scheduleSave,
        isSaving: persistenceState.isSaving,
        lastSaved: persistenceState.lastSaved,
        saveError: persistenceState.saveError
    }
}
