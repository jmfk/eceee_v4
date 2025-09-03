/**
 * Widget Store using Zustand
 * 
 * Centralized state management for widget data to eliminate:
 * - State synchronization issues
 * - Stale closure problems  
 * - Timing issues between components
 * - Complex prop drilling
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useWidgetStore = create(
    devtools(
        (set, get) => ({
            // State
            widgets: {}, // Object with slot names as keys, arrays of widgets as values
            pageId: null, // Current page ID for scoping

            // Initialize store for a specific page
            initializePage: (pageId, initialWidgets = {}) => {
                set({
                    pageId,
                    widgets: { ...initialWidgets }
                });
            },

            // Get widgets for a specific slot
            getSlotWidgets: (slotName) => {
                const state = get();
                return state.widgets[slotName] || [];
            },

            // Get all widgets
            getAllWidgets: () => {
                return get().widgets;
            },

            // Update a specific widget
            updateWidget: (slotName, widgetId, updatedWidget) => {
                set(state => {
                    const slotWidgets = state.widgets[slotName] || [];
                    const updatedSlotWidgets = slotWidgets.map(widget =>
                        widget.id === widgetId ? { ...widget, ...updatedWidget } : widget
                    );

                    return {
                        widgets: {
                            ...state.widgets,
                            [slotName]: updatedSlotWidgets
                        }
                    };
                });
            },

            // Add widget to slot
            addWidget: (slotName, widget) => {
                set(state => {
                    const slotWidgets = state.widgets[slotName] || [];
                    return {
                        widgets: {
                            ...state.widgets,
                            [slotName]: [...slotWidgets, widget]
                        }
                    };
                });
            },

            // Remove widget from slot
            removeWidget: (slotName, widgetId) => {
                set(state => {
                    const slotWidgets = state.widgets[slotName] || [];
                    return {
                        widgets: {
                            ...state.widgets,
                            [slotName]: slotWidgets.filter(widget => widget.id !== widgetId)
                        }
                    };
                });
            },

            // Move widget within slot
            moveWidget: (slotName, fromIndex, toIndex) => {
                set(state => {
                    const slotWidgets = [...(state.widgets[slotName] || [])];
                    const [movedWidget] = slotWidgets.splice(fromIndex, 1);
                    slotWidgets.splice(toIndex, 0, movedWidget);

                    return {
                        widgets: {
                            ...state.widgets,
                            [slotName]: slotWidgets
                        }
                    };
                });
            },

            // Clear all widgets in a slot
            clearSlot: (slotName) => {
                set(state => ({
                    widgets: {
                        ...state.widgets,
                        [slotName]: []
                    }
                }));
            },

            // Replace all widgets (for bulk updates from parent)
            replaceAllWidgets: (newWidgets) => {
                set({ widgets: { ...newWidgets } });
            },

            // Reset store
            reset: () => {
                set({ widgets: {}, pageId: null });
            }
        }),
        {
            name: 'widget-store'
        }
    )
);

export default useWidgetStore;
