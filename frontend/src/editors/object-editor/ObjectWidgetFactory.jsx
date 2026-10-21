/**
 * ObjectEditor Widget Factory
 * 
 * This is the ObjectEditor-specific widget factory that wraps shared widget
 * implementations with ObjectEditor-specific behaviors and integrations.
 */
import React, { useState, useRef, useMemo } from 'react'
import { Layout, Settings, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { getWidgetComponent, getWidgetDisplayName } from '../../widgets'
import ObjectWidgetHeader from './ObjectWidgetHeader'
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal'
import { useClipboard } from '../../contexts/ClipboardContext'

/**
 * ObjectEditor Widget Factory - Slot-based widget rendering
 * 
 * This factory is specifically designed for ObjectEditor's slot-based approach
 * with object type configurations, simpler editing workflows, and direct manipulation.
 */
const ObjectWidgetFactory = ({
    widget,
    slotName,
    index,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    onConfigChange,
    canMoveUp = false,
    canMoveDown = false,
    mode = 'editor',
    showControls = true,
    className = '',
    widgetId,
    slotName: passedSlotName,
    // ObjectEditor-specific props
    objectType,
    slotConfig,
    onSlotAction,
    allowedWidgetTypes = [],
    maxWidgets = null,
    context,
    // Selection props
    isWidgetSelected = false,
    isWidgetCut = false,
    onToggleWidgetSelection,
    // Paste mode props
    pasteModeActive = false,
    onPasteAtPosition
}) => {
    // Use passed props or extract from widget
    const actualWidgetId = widgetId || widget?.id
    const actualSlotName = passedSlotName || slotName || widget?.slotName

    // Get global hover tracking for paste markers
    const { hoveredWidgetId, setHoveredWidget, clearHoveredWidget } = useClipboard();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // Paste mode state
    const [pasteHoverPosition, setPasteHoverPosition] = useState(null) // 'before' | 'after' | null
    const widgetRef = useRef(null)

    // Create a stable config change handler for ObjectEditor
    const stableConfigChangeHandler = useMemo(() => {
        return onConfigChange ? (newConfig) => {
            // ObjectEditor-specific: Direct configuration updates
            onConfigChange(widget.id, slotName, newConfig)
        } : undefined
    }, [onConfigChange, widget.id, slotName])

    // ObjectEditor-specific edit handler
    const handleEdit = () => {
        if (onEdit) {
            onEdit(slotName, index, widget)
        }
    }

    // ObjectEditor-specific delete handler with slot validation
    const handleDelete = () => {
        setShowDeleteConfirm(true)
    }

    // Handle confirmed deletion
    const handleConfirmDelete = async () => {
        if (onDelete) {
            setIsDeleting(true)
            try {
                await onDelete(slotName, index, widget)
                setShowDeleteConfirm(false)
            } catch (error) {
                console.error('Failed to delete widget:', error)
                // Keep modal open on error
            } finally {
                setIsDeleting(false)
            }
        }
    }

    // Handle delete cancellation
    const handleCancelDelete = () => {
        setShowDeleteConfirm(false)
    }

    const handleMoveUp = () => {
        if (onMoveUp && canMoveUp) {
            onMoveUp(slotName, index, widget)
        }
    }

    const handleMoveDown = () => {
        if (onMoveDown && canMoveDown) {
            onMoveDown(slotName, index, widget)
        }
    }

    // Handle pasting a widget after this one
    const handlePaste = () => {
        if (onPasteAtPosition) {
            onPasteAtPosition(slotName, index + 1, false); // index + 1 to paste AFTER
        }
    }

    // Paste mode hover handlers
    const handlePasteHover = (e) => {
        if (!pasteModeActive || !widgetRef.current) return;

        // Stop propagation to prevent parent widgets from showing their paste markers
        e.stopPropagation();

        // Mark this widget as the currently hovered one
        setHoveredWidget(actualWidgetId);

        const rect = widgetRef.current.getBoundingClientRect();
        const mouseY = e.clientY;
        const widgetCenter = rect.top + rect.height / 2;

        // Determine if mouse is in top half (before) or bottom half (after)
        if (mouseY < widgetCenter) {
            setPasteHoverPosition('before');
        } else {
            setPasteHoverPosition('after');
        }
    };

    const handlePasteLeave = (e) => {
        if (pasteModeActive) {
            e.stopPropagation();
        }

        // Clear this widget's hover state
        clearHoveredWidget(actualWidgetId);
        setPasteHoverPosition(null);
    };

    const handlePasteClick = (shiftKey = false) => {
        if (!pasteModeActive || !pasteHoverPosition || !onPasteAtPosition) {
            return;
        }

        // Calculate position based on hover state
        const position = pasteHoverPosition === 'before' ? index : index + 1;

        // Call paste handler
        onPasteAtPosition(slotName, position, shiftKey);

        // Reset hover state
        setPasteHoverPosition(null);
    };

    // Handle slot-specific actions
    const handleSlotAction = (action) => {
        if (onSlotAction) {
            onSlotAction(action, actualSlotName, widget)
        }
    }

    // Get the core widget component
    const CoreWidgetComponent = getWidgetComponent(widget.type)

    // Widget wrapper with ObjectEditor-specific controls
    if (mode === 'editor' && showControls) {
        return CoreWidgetComponent ? (
            <div
                ref={widgetRef}
                className={`widget-item object-editor-widget relative ${className} ${isWidgetSelected ? 'ring-2 ring-blue-500' : ''} ${isWidgetCut ? 'opacity-50' : ''} ${pasteModeActive ? 'paste-mode-active cursor-pointer' : ''}`}
                data-widget-type={widget.type}
                data-widget-id={widget.id}
                data-object-type={objectType?.name}
                data-slot-name={actualSlotName}
                onMouseMove={pasteModeActive ? handlePasteHover : undefined}
                onMouseLeave={pasteModeActive ? handlePasteLeave : undefined}
                onClick={(e) => {
                    if (pasteModeActive && pasteHoverPosition) {
                        e.stopPropagation();
                        handlePasteClick(e.shiftKey);
                        return;
                    }
                }}
            >
                {/* Paste Mode Markers */}
                {pasteModeActive && hoveredWidgetId === actualWidgetId && pasteHoverPosition === 'before' && (
                    <div className="eceee-editor-ui absolute -top-1 left-0 right-0 h-1 bg-purple-500 z-[10006] pointer-events-none">
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full bg-purple-500 text-white text-xs px-2 py-0.5 rounded-t whitespace-nowrap">
                            Paste here
                        </div>
                    </div>
                )}
                {pasteModeActive && hoveredWidgetId === actualWidgetId && pasteHoverPosition === 'after' && (
                    <div className="eceee-editor-ui absolute -bottom-1 left-0 right-0 h-1 bg-purple-500 z-[10006] pointer-events-none">
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full bg-purple-500 text-white text-xs px-2 py-0.5 rounded-b whitespace-nowrap">
                            Paste here
                        </div>
                    </div>
                )}

                {/* ObjectEditor-specific Widget Header */}
                <ObjectWidgetHeader
                    widgetType={getWidgetDisplayName(widget.type)}
                    onEdit={onEdit ? handleEdit : undefined}
                    onDelete={onDelete ? handleDelete : undefined}
                    onMoveUp={onMoveUp ? handleMoveUp : undefined}
                    onMoveDown={onMoveDown ? handleMoveDown : undefined}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    showControls={true}
                    // ObjectEditor-specific props
                    objectType={objectType}
                    slotConfig={slotConfig}
                    onSlotAction={handleSlotAction}
                    isRequired={slotConfig?.required && index === 0}
                    maxWidgets={maxWidgets}
                    currentIndex={index}
                    // Selection props
                    isWidgetSelected={isWidgetSelected}
                    onToggleWidgetSelection={() => onToggleWidgetSelection?.(actualSlotName, widget.id)}
                    // Copy/Cut/Paste props
                    widget={widget}
                    slotName={actualSlotName}
                    onPaste={onPasteAtPosition ? handlePaste : undefined}
                    instanceId={context?.instanceId}
                    widgetPath={`${actualSlotName}/${widget.id}`}
                    isCut={isWidgetCut}
                />

                {/* Slot requirement indicator */}
                {slotConfig?.required && (
                    <div className="eceee-editor-ui absolute top-2 left-2 z-10">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                            Required
                        </span>
                    </div>
                )}

                {/* Core Widget Content */}
                <div className="widget-content overflow-hidden border border-gray-200 border-t-0 rounded-b">
                    <div>
                        <CoreWidgetComponent
                            config={widget.config || {}}
                            typeVersion={widget.typeVersion ?? widget.type_version}
                            mode="editor"
                            onConfigChange={stableConfigChangeHandler}
                            widgetId={actualWidgetId}
                            slotName={actualSlotName}
                            widgetType={widget.type}
                            context={context}
                            objectType={objectType}
                            slotConfig={slotConfig}
                            isRequired={slotConfig?.required}
                            // Context props for container widgets
                            parentComponentId={context?.componentId}
                            contextType="object"
                            objectId={context?.instanceId}
                        />
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                <DeleteConfirmationModal
                    isOpen={showDeleteConfirm}
                    onClose={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    title="Delete Widget"
                    message={`Are you sure you want to delete this ${getWidgetDisplayName(widget.type)} widget?${slotConfig?.required ? ' This is a required slot and deleting this widget may cause validation errors.' : ' This action cannot be undone.'}`}
                    itemName={getWidgetDisplayName(widget.type)}
                    isDeleting={isDeleting}
                    deleteButtonText="Delete Widget"
                    warningText={slotConfig?.required ? "This widget is in a required slot" : null}
                />
            </div>
        ) : (
            <div className={`eceee-editor-ui widget-item unsupported ${className}`}>
                <div className="bg-red-50 border border-red-200 rounded p-4">
                    <div className="flex items-center space-x-3">
                        <div className="bg-red-100 rounded-lg w-10 h-10 flex items-center justify-center text-red-600 border">
                            <Layout className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-red-900" role="heading" aria-level="4">
                                Unsupported Widget
                            </div>
                            <div className="text-xs text-red-600">
                                Widget type "{widget.type}" is not supported in this object type
                            </div>
                            {allowedWidgetTypes.length > 0 && (
                                <div className="text-xs text-gray-600 mt-1">
                                    Allowed types: {allowedWidgetTypes.join(', ')}
                                </div>
                            )}
                            {onDelete && (
                                <div className="mt-3">
                                    <button
                                        onClick={handleDelete}
                                        className="inline-flex items-center px-3 py-1 bg-red-100 text-red-700 text-xs rounded-md hover:bg-red-200 transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        Delete Broken Widget
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                <DeleteConfirmationModal
                    isOpen={showDeleteConfirm}
                    onClose={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    title="Delete Unsupported Widget"
                    message={`Are you sure you want to delete this unsupported widget of type "${widget.type}"?${slotConfig?.required ? ' This is a required slot and deleting this widget may cause validation errors.' : ' This action cannot be undone.'}`}
                    itemName={`Unsupported Widget (${widget.type})`}
                    isDeleting={isDeleting}
                    deleteButtonText="Delete Broken Widget"
                    warningText={slotConfig?.required ? "This widget is in a required slot" : null}
                />
            </div>
        )
    }

    // Simple widget renderer without controls (for display mode)
    return CoreWidgetComponent ? (
        <div
            className={`widget-item object-editor-display ${className}`}
            data-widget-type={widget.type}
            data-widget-id={widget.id}
            data-object-type={objectType?.name}
            data-slot-name={actualSlotName}
        >
            <div>
                <CoreWidgetComponent
                    config={widget.config || {}}
                    typeVersion={widget.typeVersion ?? widget.type_version}
                    mode={mode}
                    onConfigChange={stableConfigChangeHandler}
                    widgetId={actualWidgetId}
                    slotName={actualSlotName}
                    widgetType={widget.type}
                            context={context}
                    // ObjectEditor-specific props
                    objectType={objectType}
                    slotConfig={slotConfig}
                    isRequired={slotConfig?.required}
                    // Context props for container widgets
                    parentComponentId={context?.componentId}
                    contextType="object"
                    objectId={context?.instanceId}
                />
            </div>
        </div>
    ) : null
}

export default ObjectWidgetFactory
