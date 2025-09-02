/**
 * Editor Context - Editor-specific state management
 * 
 * Provides context for editor-specific functionality like
 * drag-and-drop, clipboard operations, and editor preferences.
 */

import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react'

/**
 * Editor actions
 */
export const EDITOR_ACTIONS = {
    SET_EDITOR_MODE: 'SET_EDITOR_MODE',
    SET_DRAG_STATE: 'SET_DRAG_STATE',
    SET_CLIPBOARD: 'SET_CLIPBOARD',
    SET_SELECTED_SLOT: 'SET_SELECTED_SLOT',
    SET_EDITOR_PREFERENCES: 'SET_EDITOR_PREFERENCES',
    SET_PREVIEW_MODE: 'SET_PREVIEW_MODE',
    TOGGLE_WIDGET_LIBRARY: 'TOGGLE_WIDGET_LIBRARY',
    SET_EDITOR_PANEL_OPEN: 'SET_EDITOR_PANEL_OPEN',
    ADD_HISTORY_ENTRY: 'ADD_HISTORY_ENTRY',
    UNDO: 'UNDO',
    REDO: 'REDO'
}

/**
 * Editor modes
 */
export const EDITOR_MODES = {
    EDIT: 'edit',
    PREVIEW: 'preview',
    DESIGN: 'design'
}

/**
 * Drag states
 */
export const DRAG_STATES = {
    IDLE: 'idle',
    DRAGGING: 'dragging',
    OVER_SLOT: 'over_slot',
    INVALID_DROP: 'invalid_drop'
}

/**
 * Initial editor state
 */
const initialState = {
    mode: EDITOR_MODES.EDIT,
    selectedSlot: null,
    dragState: {
        isDragging: false,
        draggedWidget: null,
        draggedFromSlot: null,
        draggedFromIndex: null,
        dropTarget: null,
        state: DRAG_STATES.IDLE
    },
    clipboard: {
        widget: null,
        operation: null, // 'copy' or 'cut'
        timestamp: null
    },
    preferences: {
        showWidgetBorders: true,
        showSlotBorders: true,
        showWidgetNames: true,
        autoSave: true,
        confirmDelete: true
    },
    ui: {
        isWidgetLibraryOpen: false,
        isEditorPanelOpen: false,
        previewMode: false
    },
    history: {
        entries: [],
        currentIndex: -1,
        maxEntries: 50
    }
}

/**
 * Editor state reducer
 */
function editorReducer(state, action) {
    switch (action.type) {
        case EDITOR_ACTIONS.SET_EDITOR_MODE:
            return {
                ...state,
                mode: action.payload.mode
            }

        case EDITOR_ACTIONS.SET_DRAG_STATE:
            return {
                ...state,
                dragState: {
                    ...state.dragState,
                    ...action.payload
                }
            }

        case EDITOR_ACTIONS.SET_CLIPBOARD:
            return {
                ...state,
                clipboard: {
                    widget: action.payload.widget,
                    operation: action.payload.operation,
                    timestamp: new Date().toISOString()
                }
            }

        case EDITOR_ACTIONS.SET_SELECTED_SLOT:
            return {
                ...state,
                selectedSlot: action.payload.slotName
            }

        case EDITOR_ACTIONS.SET_EDITOR_PREFERENCES:
            return {
                ...state,
                preferences: {
                    ...state.preferences,
                    ...action.payload.preferences
                }
            }

        case EDITOR_ACTIONS.SET_PREVIEW_MODE:
            return {
                ...state,
                ui: {
                    ...state.ui,
                    previewMode: action.payload.enabled
                }
            }

        case EDITOR_ACTIONS.TOGGLE_WIDGET_LIBRARY:
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isWidgetLibraryOpen: action.payload?.open ?? !state.ui.isWidgetLibraryOpen
                }
            }

        case EDITOR_ACTIONS.SET_EDITOR_PANEL_OPEN:
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isEditorPanelOpen: action.payload.open
                }
            }

        case EDITOR_ACTIONS.ADD_HISTORY_ENTRY:
            const newEntries = state.history.entries.slice(0, state.history.currentIndex + 1)
            newEntries.push(action.payload.entry)

            // Limit history size
            if (newEntries.length > state.history.maxEntries) {
                newEntries.shift()
            }

            return {
                ...state,
                history: {
                    ...state.history,
                    entries: newEntries,
                    currentIndex: newEntries.length - 1
                }
            }

        case EDITOR_ACTIONS.UNDO:
            if (state.history.currentIndex > 0) {
                return {
                    ...state,
                    history: {
                        ...state.history,
                        currentIndex: state.history.currentIndex - 1
                    }
                }
            }
            return state

        case EDITOR_ACTIONS.REDO:
            if (state.history.currentIndex < state.history.entries.length - 1) {
                return {
                    ...state,
                    history: {
                        ...state.history,
                        currentIndex: state.history.currentIndex + 1
                    }
                }
            }
            return state

        default:
            return state
    }
}

/**
 * Editor Context
 */
const EditorContext = createContext()

/**
 * Editor Context Provider
 */
export function EditorProvider({
    children,
    initialMode = EDITOR_MODES.EDIT,
    onHistoryChange
}) {
    const [state, dispatch] = useReducer(editorReducer, {
        ...initialState,
        mode: initialMode
    })

    const dragRef = useRef(null)
    const dropRef = useRef(null)

    /**
     * Set editor mode
     */
    const setEditorMode = useCallback((mode) => {
        dispatch({
            type: EDITOR_ACTIONS.SET_EDITOR_MODE,
            payload: { mode }
        })
    }, [])

    /**
     * Start drag operation
     */
    const startDrag = useCallback((widget, fromSlot, fromIndex) => {
        dispatch({
            type: EDITOR_ACTIONS.SET_DRAG_STATE,
            payload: {
                isDragging: true,
                draggedWidget: widget,
                draggedFromSlot: fromSlot,
                draggedFromIndex: fromIndex,
                state: DRAG_STATES.DRAGGING
            }
        })
    }, [])

    /**
     * End drag operation
     */
    const endDrag = useCallback(() => {
        dispatch({
            type: EDITOR_ACTIONS.SET_DRAG_STATE,
            payload: {
                isDragging: false,
                draggedWidget: null,
                draggedFromSlot: null,
                draggedFromIndex: null,
                dropTarget: null,
                state: DRAG_STATES.IDLE
            }
        })
    }, [])

    /**
     * Set drag over target
     */
    const setDragTarget = useCallback((target, isValid = true) => {
        dispatch({
            type: EDITOR_ACTIONS.SET_DRAG_STATE,
            payload: {
                dropTarget: target,
                state: isValid ? DRAG_STATES.OVER_SLOT : DRAG_STATES.INVALID_DROP
            }
        })
    }, [])

    /**
     * Copy widget to clipboard
     */
    const copyWidget = useCallback((widget) => {
        dispatch({
            type: EDITOR_ACTIONS.SET_CLIPBOARD,
            payload: {
                widget: { ...widget },
                operation: 'copy'
            }
        })
    }, [])

    /**
     * Cut widget to clipboard
     */
    const cutWidget = useCallback((widget) => {
        dispatch({
            type: EDITOR_ACTIONS.SET_CLIPBOARD,
            payload: {
                widget: { ...widget },
                operation: 'cut'
            }
        })
    }, [])

    /**
     * Clear clipboard
     */
    const clearClipboard = useCallback(() => {
        dispatch({
            type: EDITOR_ACTIONS.SET_CLIPBOARD,
            payload: {
                widget: null,
                operation: null
            }
        })
    }, [])

    /**
     * Select slot
     */
    const selectSlot = useCallback((slotName) => {
        dispatch({
            type: EDITOR_ACTIONS.SET_SELECTED_SLOT,
            payload: { slotName }
        })
    }, [])

    /**
     * Update editor preferences
     */
    const updatePreferences = useCallback((preferences) => {
        dispatch({
            type: EDITOR_ACTIONS.SET_EDITOR_PREFERENCES,
            payload: { preferences }
        })
    }, [])

    /**
     * Toggle preview mode
     */
    const togglePreview = useCallback((enabled) => {
        dispatch({
            type: EDITOR_ACTIONS.SET_PREVIEW_MODE,
            payload: { enabled }
        })
    }, [])

    /**
     * Toggle widget library
     */
    const toggleWidgetLibrary = useCallback((open) => {
        dispatch({
            type: EDITOR_ACTIONS.TOGGLE_WIDGET_LIBRARY,
            payload: { open }
        })
    }, [])

    /**
     * Set editor panel open state
     */
    const setEditorPanelOpen = useCallback((open) => {
        dispatch({
            type: EDITOR_ACTIONS.SET_EDITOR_PANEL_OPEN,
            payload: { open }
        })
    }, [])

    /**
     * Add history entry
     */
    const addHistoryEntry = useCallback((entry) => {
        dispatch({
            type: EDITOR_ACTIONS.ADD_HISTORY_ENTRY,
            payload: { entry }
        })

        if (onHistoryChange) {
            onHistoryChange(state.history.entries.length + 1, state.history.currentIndex + 1)
        }
    }, [onHistoryChange, state.history.entries.length, state.history.currentIndex])

    /**
     * Undo last action
     */
    const undo = useCallback(() => {
        if (state.history.currentIndex > 0) {
            dispatch({ type: EDITOR_ACTIONS.UNDO })
            const entry = state.history.entries[state.history.currentIndex - 1]
            return entry
        }
        return null
    }, [state.history.currentIndex, state.history.entries])

    /**
     * Redo last undone action
     */
    const redo = useCallback(() => {
        if (state.history.currentIndex < state.history.entries.length - 1) {
            dispatch({ type: EDITOR_ACTIONS.REDO })
            const entry = state.history.entries[state.history.currentIndex + 1]
            return entry
        }
        return null
    }, [state.history.currentIndex, state.history.entries])

    /**
     * Check if can undo
     */
    const canUndo = state.history.currentIndex > 0

    /**
     * Check if can redo
     */
    const canRedo = state.history.currentIndex < state.history.entries.length - 1

    const contextValue = {
        // State
        mode: state.mode,
        selectedSlot: state.selectedSlot,
        dragState: state.dragState,
        clipboard: state.clipboard,
        preferences: state.preferences,
        ui: state.ui,
        history: state.history,

        // Actions
        setEditorMode,
        startDrag,
        endDrag,
        setDragTarget,
        copyWidget,
        cutWidget,
        clearClipboard,
        selectSlot,
        updatePreferences,
        togglePreview,
        toggleWidgetLibrary,
        setEditorPanelOpen,
        addHistoryEntry,
        undo,
        redo,

        // Computed
        canUndo,
        canRedo,

        // Refs
        dragRef,
        dropRef
    }

    return (
        <EditorContext.Provider value={contextValue}>
            {children}
        </EditorContext.Provider>
    )
}

/**
 * Hook to use editor context
 */
export function useEditorContext() {
    const context = useContext(EditorContext)
    if (!context) {
        throw new Error('useEditorContext must be used within an EditorProvider')
    }
    return context
}

/**
 * Hook for drag and drop operations
 */
export function useDragAndDrop() {
    const {
        dragState,
        startDrag,
        endDrag,
        setDragTarget,
        dragRef,
        dropRef
    } = useEditorContext()

    return {
        dragState,
        startDrag,
        endDrag,
        setDragTarget,
        dragRef,
        dropRef,
        isDragging: dragState.isDragging,
        draggedWidget: dragState.draggedWidget,
        dropTarget: dragState.dropTarget
    }
}

/**
 * Hook for clipboard operations
 */
export function useClipboard() {
    const {
        clipboard,
        copyWidget,
        cutWidget,
        clearClipboard
    } = useEditorContext()

    return {
        clipboard,
        copyWidget,
        cutWidget,
        clearClipboard,
        hasClipboardContent: !!clipboard.widget,
        clipboardOperation: clipboard.operation
    }
}

/**
 * Hook for editor history/undo-redo
 */
export function useEditorHistory() {
    const {
        history,
        addHistoryEntry,
        undo,
        redo,
        canUndo,
        canRedo
    } = useEditorContext()

    return {
        history,
        addHistoryEntry,
        undo,
        redo,
        canUndo,
        canRedo,
        currentEntry: history.entries[history.currentIndex] || null
    }
}
