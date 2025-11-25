/**
 * Self-Contained Slot Editor
 * 
 * React component for managing container widget slots.
 * Integrates with UDC through parent widget config updates.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import PageWidgetSelectionModal from '../../editors/page-editor/PageWidgetSelectionModal.jsx';
import { useWidgets, createDefaultWidgetConfig, getWidgetDisplayName } from '../../hooks/useWidgets.js';
import PageWidgetFactory from '../../editors/page-editor/PageWidgetFactory.jsx';
import PageWidgetHeaderWithSlots from '../../editors/page-editor/PageWidgetHeaderWithSlots.jsx';

/**
 * Self-Contained Slot Editor React Component
 * Manages container widget slots with React state management
 */
const SelfContainedSlotEditor = ({
    slotName,
    slotLabel,
    widgets: initialWidgets = [],
    availableWidgetTypes = [],
    maxWidgets = null,
    parentWidgetId,
    parentSlotName, // Top-level slot where parent widget lives (legacy)
    contextType = 'page',
    onWidgetEdit,
    onOpenWidgetEditor,
    onSlotChange,
    parentComponentId,
    widgetPath = [], // Full path to parent widget (for infinite nesting)
    showAddButton = true,
    showMoveButtons = true,
    showEditButton = true,
    showRemoveButton = true,
    showClearButton = true, // Show the Clear Slot button
    compactAddButton = false, // Show just + icon without text
    emptyMessage = null,
    mode = 'editor', // Mode for nested widgets: 'editor' or 'display'
    // Selection props
    selectedWidgets,
    cutWidgets,
    onToggleWidgetSelection,
    isWidgetSelected,
    isWidgetCut,
    onDeleteCutWidgets, // Callback to delete cut widgets after paste
    buildWidgetPath,
    parseWidgetPath,
    // Paste mode props
    pasteModeActive = false,
    onPasteAtPosition,
    showPasteMarkers = true
}) => {
    // Build path for widgets in this slot: append slot name to parent path
    const slotPath = [...widgetPath, slotName];

    // Determine if this is a nested slot (inside a container widget)
    // widgetPath format: [topSlot, containerId] for nested widgets
    // For selection paths, we need: "topSlot/containerId/nestedSlot/nestedWidgetId"
    const isNestedSlot = widgetPath.length >= 2;
    const topSlot = isNestedSlot ? widgetPath[0] : null;
    const containerId = isNestedSlot ? widgetPath[1] : null;
    // Use the widgets hook for proper widget management
    const { addWidget, generateWidgetId } = useWidgets();

    // State
    const [widgets, setWidgets] = useState([...initialWidgets]);
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);

    // Refs
    const menuRef = useRef(null);

    // Computed values
    const slotId = `${parentWidgetId}-${slotName}`;
    const defaultEmptyMessage = emptyMessage || `No widgets in ${slotLabel.toLowerCase()}`;

    // Update widgets when prop changes
    useEffect(() => {
        setWidgets([...initialWidgets]);
    }, [initialWidgets]);

    /**
     * Notify parent component of slot changes
     */
    const notifySlotChange = useCallback((newWidgets) => {
        if (onSlotChange) {
            onSlotChange(slotName, [...newWidgets]);
        }
    }, [onSlotChange, slotName]);

    /**
     * Check if widgets can be added to this slot
     */
    const canAddWidget = useCallback(() => {
        return !maxWidgets || widgets.length < maxWidgets;
    }, [maxWidgets, widgets.length]);

    /**
     * Handle adding a new widget with proper configuration
     */
    const handleAddWidget = useCallback((widgetType) => {
        if (!canAddWidget()) {
            console.warn(`Cannot add widget to slot ${slotName}: slot is full`);
            return;
        }

        // Create proper widget configuration using the registry
        const widgetConfig = createDefaultWidgetConfig(widgetType);

        // Create the widget with proper structure
        const newWidget = {
            id: generateWidgetId(),
            name: getWidgetDisplayName(widgetType),
            type: widgetType,
            config: widgetConfig,
            slotName: slotName
        };

        const newWidgets = [...widgets, newWidget];
        setWidgets(newWidgets);
        notifySlotChange(newWidgets);
    }, [canAddWidget, slotName, widgets, parentWidgetId, parentComponentId, notifySlotChange, generateWidgetId]);

    /**
     * Handle removing a widget
     */
    const handleRemoveWidget = useCallback((widgetIndex) => {
        const newWidgets = widgets.filter((_, index) => index !== widgetIndex);
        setWidgets(newWidgets);
        notifySlotChange(newWidgets);
    }, [widgets, notifySlotChange]);

    /**
     * Handle moving a widget
     */
    const handleMoveWidget = useCallback((fromIndex, toIndex) => {
        if (fromIndex === toIndex || toIndex < 0 || toIndex >= widgets.length) return;

        const newWidgets = [...widgets];
        const [movedWidget] = newWidgets.splice(fromIndex, 1);
        newWidgets.splice(toIndex, 0, movedWidget);

        setWidgets(newWidgets);
        notifySlotChange(newWidgets);
    }, [widgets, notifySlotChange]);

    /**
     * Handle widget config changes (for active/inactive toggle, etc.)
     */
    const handleConfigChange = useCallback((widgetId, updatedConfig) => {
        const newWidgets = widgets.map(w => 
            w.id === widgetId ? { ...w, config: updatedConfig } : w
        );
        setWidgets(newWidgets);
        notifySlotChange(newWidgets);
    }, [widgets, notifySlotChange]);

    /**
     * Handle editing a widget
     * Note: PageWidgetFactory calls this with (slotName, index, widget)
     * 
     * For nested widgets (inside container widgets), use onOpenWidgetEditor directly
     * to bypass ReactLayoutRenderer's widget lookup
     */
    const handleEditWidget = useCallback((passedSlotName, widgetIndex, widget) => {
        // If we have onOpenWidgetEditor and this is a nested widget, use it directly
        if (onOpenWidgetEditor && widgetPath.length > 0) {
            // Call onOpenWidgetEditor directly for nested widgets
            // Use slotPath (which includes slot name) instead of widgetPath
            const fullPath = [...slotPath, widget.id];

            onOpenWidgetEditor({
                ...widget,
                slotName: passedSlotName || slotName,
                slotIndex: widgetIndex,
                parentWidgetId,
                widgetPath: fullPath, // Full path including slot name and widget ID
                context: {
                    slotName: passedSlotName || slotName,
                    contextType,
                    mode: 'edit',
                    parentWidgetId,
                    widgetId: parentWidgetId,
                    widgetPath: fullPath
                }
            });
        } else if (onWidgetEdit) {
            // Fallback to onWidgetEdit for top-level widgets
            onWidgetEdit({
                ...widget,
                slotName: passedSlotName || slotName,
                slotIndex: widgetIndex,
                parentWidgetId,
                context: {
                    slotName: passedSlotName || slotName,
                    contextType,
                    mode: 'edit',
                    parentWidgetId
                }
            });
        }
    }, [onWidgetEdit, onOpenWidgetEditor, slotName, parentWidgetId, contextType, widgetPath, slotPath]);

    /**
     * Handle clearing all widgets from slot
     */
    const handleClearSlot = useCallback(() => {
        if (widgets.length === 0) return;

        setWidgets([]);
        notifySlotChange([]);
    }, [widgets.length, notifySlotChange]);

    /**
     * Handle pasting widgets to slot
     * @param {Array} pastedWidgets - Widgets to paste
     * @param {string} mode - 'replace' or 'append'
     * @param {Object} metadata - Optional metadata for cut operations { operation: 'cut', metadata: {...} }
     */
    const handlePasteToSlot = useCallback((pastedWidgets, mode, metadata) => {
        if (!pastedWidgets || !Array.isArray(pastedWidgets)) {
            return;
        }

        let newWidgets;
        if (mode === 'replace') {
            newWidgets = pastedWidgets;
        } else {
            newWidgets = [...widgets, ...pastedWidgets];
        }

        setWidgets(newWidgets);
        notifySlotChange(newWidgets);

        // If this was a cut operation, delete the original widgets
        if (metadata && metadata.operation === 'cut' && metadata.metadata && onDeleteCutWidgets) {
            onDeleteCutWidgets(metadata.metadata).catch(() => {
                // Silently handle errors - deletion failure shouldn't break paste
            });
        }
    }, [widgets, notifySlotChange, onDeleteCutWidgets]);

    // Widget modal handlers
    const handleShowWidgetModal = useCallback(() => {
        setIsWidgetModalOpen(true);
    }, []);

    const handleCloseWidgetModal = useCallback(() => {
        setIsWidgetModalOpen(false);
    }, []);

    const handleWidgetSelection = useCallback((widgetType) => {
        handleAddWidget(widgetType);
        setIsWidgetModalOpen(false);
    }, [handleAddWidget]);

    return (
        <div className="slot-editor p-4 relative">
            <PageWidgetHeaderWithSlots
                widgetType={slotLabel}
                showControls={true}
                slotLabel={maxWidgets ? `${widgets.length}/${maxWidgets} widgets` : `${widgets.length} widgets`}
                showAddButton={showAddButton}
                showClearButton={showClearButton}
                onAddWidget={canAddWidget() ? handleShowWidgetModal : null}
                onClearSlot={handleClearSlot}
                canAddWidget={canAddWidget()}
                widgetCount={widgets.length}
                maxWidgets={maxWidgets}
                widgets={widgets}
                onPasteToSlot={handlePasteToSlot}
            />

            <div className="widgets-list">
                {widgets.length === 0 ? (
                    <div className="empty-slot text-center py-6 text-gray-500 border-2 border-dashed border-gray-300">
                        <p className="mb-2">{defaultEmptyMessage}</p>
                        {showAddButton && canAddWidget() && (
                            <button
                                className="add-first-widget text-gray-600 hover:text-gray-800 text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                onClick={handleShowWidgetModal}
                            >
                                Add first widget
                            </button>
                        )}
                    </div>
                ) : (
                    widgets.map((widget, index) => {
                        // Build full path for this nested widget: append widget ID to slot path
                        const fullWidgetPath = [...slotPath, widget.id];
                        const isLast = index === widgets.length - 1;

                        return (
                            <div key={widget.id} className={isLast ? '' : 'mb-8'}>
                                <PageWidgetFactory
                                    widget={widget}
                                    slotName={slotName}
                                    index={index}
                                    onEdit={handleEditWidget}
                                    onDelete={() => handleRemoveWidget(index)}
                                    onMoveUp={() => handleMoveWidget(index, index - 1)}
                                    onMoveDown={() => handleMoveWidget(index, index + 1)}
                                    onConfigChange={(newConfig) => handleConfigChange(widget.id, newConfig)}
                                    canMoveUp={index > 0}
                                    canMoveDown={index < widgets.length - 1}
                                    mode={mode}
                                    showControls={mode === 'editor'}
                                    widgetId={widget.id}
                                    contextType={contextType}
                                    onOpenWidgetEditor={onOpenWidgetEditor}
                                    // Pass parent context for nested widgets
                                    parentComponentId={parentComponentId}
                                    // Widget path for infinite nesting
                                    widgetPath={fullWidgetPath}
                                    // Legacy nested widget props (deprecated)
                                    nestedParentWidgetId={parentWidgetId}
                                    nestedParentSlotName={parentSlotName}
                                    // Selection props - build nested path for nested widgets
                                    selectedWidgets={selectedWidgets}
                                    cutWidgets={cutWidgets}
                                    onToggleWidgetSelection={onToggleWidgetSelection ? () => {
                                        // Build full nested path: "topSlot/containerId/nestedSlot/widgetId"
                                        if (isNestedSlot && topSlot && containerId) {
                                            // For nested widgets, nestedPath should be "nestedSlot/widgetId"
                                            const nestedPath = `${slotName}/${widget.id}`;
                                            onToggleWidgetSelection(topSlot, containerId, nestedPath);
                                        } else {
                                            // Top-level widget
                                            onToggleWidgetSelection(slotName, widget.id);
                                        }
                                    } : undefined}
                                    isWidgetSelected={isWidgetSelected ? () => {
                                        // Build full nested path for nested widgets
                                        if (isNestedSlot && topSlot && containerId) {
                                            const nestedPath = `${slotName}/${widget.id}`;
                                            return isWidgetSelected(topSlot, containerId, nestedPath);
                                        }
                                        // Top-level widget
                                        return isWidgetSelected(slotName, widget.id);
                                    } : undefined}
                                    isWidgetCut={isWidgetCut ? () => {
                                        // Build full nested path for nested widgets
                                        if (isNestedSlot && topSlot && containerId) {
                                            const nestedPath = `${slotName}/${widget.id}`;
                                            return isWidgetCut(topSlot, containerId, nestedPath);
                                        }
                                        // Top-level widget
                                        return isWidgetCut(slotName, widget.id);
                                    } : undefined}
                                    buildWidgetPath={buildWidgetPath}
                                    parseWidgetPath={parseWidgetPath}
                                    // Paste mode props
                                    pasteModeActive={pasteModeActive}
                                    onPasteAtPosition={onPasteAtPosition}
                                    showPasteMarkers={showPasteMarkers}
                                />
                            </div>
                        );
                    })
                )}
            </div>

            {/* Widget Selection Modal */}
            <PageWidgetSelectionModal
                isOpen={isWidgetModalOpen}
                onClose={handleCloseWidgetModal}
                onWidgetSelect={handleWidgetSelection}
                slotName={slotName}
                slotLabel={slotLabel}
            />
        </div>
    );
};

SelfContainedSlotEditor.propTypes = {
    slotName: PropTypes.string.isRequired,
    slotLabel: PropTypes.string.isRequired,
    widgets: PropTypes.array,
    availableWidgetTypes: PropTypes.arrayOf(PropTypes.shape({
        type: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    })),
    maxWidgets: PropTypes.number,
    parentWidgetId: PropTypes.string.isRequired,
    contextType: PropTypes.oneOf(['page', 'object']),
    onWidgetEdit: PropTypes.func,
    onOpenWidgetEditor: PropTypes.func,
    onSlotChange: PropTypes.func,
    parentComponentId: PropTypes.string,
    widgetPath: PropTypes.array,
    showAddButton: PropTypes.bool,
    showMoveButtons: PropTypes.bool,
    showEditButton: PropTypes.bool,
    showRemoveButton: PropTypes.bool,
    showClearButton: PropTypes.bool,
    compactAddButton: PropTypes.bool,
    emptyMessage: PropTypes.string,
    mode: PropTypes.oneOf(['editor', 'display'])
};

// Export the component
export { SelfContainedSlotEditor };
