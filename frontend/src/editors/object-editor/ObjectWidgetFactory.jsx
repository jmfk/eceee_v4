/**
 * ObjectEditor Widget Factory
 * 
 * This is the ObjectEditor-specific widget factory that wraps shared widget
 * implementations with ObjectEditor-specific behaviors and integrations.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Layout, Settings, Trash2, ChevronUp, ChevronDown, Eye, ChevronLeft, ChevronRight, X, EyeOff } from 'lucide-react'
import { getCoreWidgetComponent, getCoreWidgetDisplayName } from '../../widgets'
import { renderWidgetPreview } from '../../utils/widgetPreview'
import ObjectWidgetHeader from './ObjectWidgetHeader'
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal'

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
    context
}) => {
    // Use passed props or extract from widget
    const actualWidgetId = widgetId || widget?.id
    const actualSlotName = passedSlotName || slotName || widget?.slotName

    const [isPreviewMode, setIsPreviewMode] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [previewContent, setPreviewContent] = useState(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const previewContainerRef = useRef(null)

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

    // ObjectEditor-specific preview
    const handlePreview = () => {
        setIsPreviewMode(true)
    }

    const handleExitPreview = () => {
        setIsPreviewMode(false)
    }

    // Enhanced preview with object context
    const handleModalPreview = async () => {
        setShowPreview(true)
        setIsLoadingPreview(true)
        setPreviewContent(null)

        try {
            // ObjectEditor-specific: Include object type and slot context in preview
            const result = await renderWidgetPreview(widget, {
                objectType: objectType?.name,
                slotName: actualSlotName,
                slotConfig,
                objectContext: true
            })
            setPreviewContent(result)
        } catch (error) {
            console.error('Error loading widget preview:', error)
            setPreviewContent({
                html: `<div class="text-red-600 p-4 border border-red-200 rounded bg-red-50">
                    <strong>Preview Error:</strong> Could not load widget preview
                    <br><small>${error.message || 'Unknown error'}</small>
                </div>`,
                css: '',
                success: false,
                error: error.message
            })
        } finally {
            setIsLoadingPreview(false)
        }
    }

    const handleClosePreview = () => {
        setShowPreview(false)
        setPreviewContent(null)
        setIsLoadingPreview(false)
    }

    // Handle slot-specific actions
    const handleSlotAction = (action) => {
        if (onSlotAction) {
            onSlotAction(action, actualSlotName, widget)
        }
    }

    // Get the core widget component
    const CoreWidgetComponent = getCoreWidgetComponent(widget.type)

    if (!CoreWidgetComponent) {
        // Fallback for unsupported widgets
        return (
            <div className={`widget-item unsupported ${className}`}>
                <div className="bg-red-50 border border-red-200 rounded p-4">
                    <div className="flex items-center space-x-3">
                        <div className="bg-red-100 rounded-lg w-10 h-10 flex items-center justify-center text-red-600 border">
                            <Layout className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-red-900">
                                Unsupported Widget
                            </h4>
                            <p className="text-xs text-red-600">
                                Widget type "{widget.type}" is not supported in this object type
                            </p>
                            {allowedWidgetTypes.length > 0 && (
                                <p className="text-xs text-gray-600 mt-1">
                                    Allowed types: {allowedWidgetTypes.join(', ')}
                                </p>
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

    // Widget wrapper with ObjectEditor-specific controls
    if (mode === 'editor' && showControls) {
        return (
            <div
                className={`widget-item object-editor-widget relative ${className} ${isPreviewMode ? 'preview-mode' : ''}`}
                data-widget-type={widget.type}
                data-widget-id={widget.id}
                data-object-type={objectType?.name}
                data-slot-name={actualSlotName}
            >
                {/* ObjectEditor-specific Widget Header */}
                {!isPreviewMode && (
                    <ObjectWidgetHeader
                        widgetType={getCoreWidgetDisplayName(widget.type)}
                        onEdit={onEdit ? handleEdit : undefined}
                        onDelete={onDelete ? handleDelete : undefined}
                        onMoveUp={onMoveUp ? handleMoveUp : undefined}
                        onMoveDown={onMoveDown ? handleMoveDown : undefined}
                        onPreview={handlePreview}
                        onModalPreview={handleModalPreview}
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
                    />
                )}

                {/* Preview Mode Exit Button */}
                {isPreviewMode && (
                    <div className="absolute top-2 right-2 z-10 opacity-30 hover:opacity-100 transition-opacity duration-200">
                        <button
                            onClick={handleExitPreview}
                            className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
                            title="Exit preview mode"
                        >
                            <EyeOff className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Slot requirement indicator */}
                {slotConfig?.required && (
                    <div className="absolute top-2 left-2 z-10">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                            Required
                        </span>
                    </div>
                )}

                {/* Core Widget Content */}
                <div className={`widget-content overflow-hidden ${isPreviewMode
                    ? 'border-0 rounded'
                    : 'border border-gray-200 border-t-0 rounded-b'
                    }`}>
                    <CoreWidgetComponent
                        config={widget.config || {}}
                        mode={isPreviewMode ? "display" : "editor"}
                        onConfigChange={isPreviewMode ? undefined : stableConfigChangeHandler}
                        themeId={widget.config?.themeId}
                        widgetId={actualWidgetId}
                        slotName={actualSlotName}
                        widgetType={widget.type}
                        // ObjectEditor-specific props
                        objectType={objectType}
                        slotConfig={slotConfig}
                        isRequired={slotConfig?.required}
                    />
                </div>

                {/* ObjectEditor-specific Preview Modal */}
                {showPreview && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                        onClick={handleClosePreview}
                    >
                        <div
                            className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[80vh] overflow-auto m-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">
                                        Preview: {getCoreWidgetDisplayName(widget.type)}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {objectType?.name} • {slotConfig?.label || actualSlotName}
                                    </p>
                                </div>
                                <button
                                    onClick={handleClosePreview}
                                    className="text-gray-400 hover:text-gray-600 w-6 h-6"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="p-4">
                                {isLoadingPreview ? (
                                    <div className="text-center py-12">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        <p className="mt-2 text-sm text-gray-600">Rendering preview...</p>
                                    </div>
                                ) : previewContent ? (
                                    <div
                                        ref={previewContainerRef}
                                        className="widget-preview-content"
                                        dangerouslySetInnerHTML={{ __html: previewContent.html }}
                                    />
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>No preview available</p>
                                    </div>
                                )}
                            </div>
                            {/* Add CSS if available */}
                            {previewContent?.css && (
                                <style dangerouslySetInnerHTML={{ __html: previewContent.css }} />
                            )}
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                <DeleteConfirmationModal
                    isOpen={showDeleteConfirm}
                    onClose={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    title="Delete Widget"
                    message={`Are you sure you want to delete this ${getCoreWidgetDisplayName(widget.type)} widget?${slotConfig?.required ? ' This is a required slot and deleting this widget may cause validation errors.' : ' This action cannot be undone.'}`}
                    itemName={getCoreWidgetDisplayName(widget.type)}
                    isDeleting={isDeleting}
                    deleteButtonText="Delete Widget"
                    warningText={slotConfig?.required ? "This widget is in a required slot" : null}
                />
            </div>
        )
    }

    // Simple widget renderer without controls (for display mode)
    return (
        <div
            className={`widget-item object-editor-display ${className}`}
            data-widget-type={widget.type}
            data-widget-id={widget.id}
            data-object-type={objectType?.name}
            data-slot-name={actualSlotName}
        >
            <CoreWidgetComponent
                config={widget.config || {}}
                mode={mode}
                onConfigChange={stableConfigChangeHandler}
                themeId={widget.config?.themeId}
                widgetId={actualWidgetId}
                slotName={actualSlotName}
                widgetType={widget.type}
                // ObjectEditor-specific props
                objectType={objectType}
                slotConfig={slotConfig}
                isRequired={slotConfig?.required}
            />
        </div>
    )
}

export default ObjectWidgetFactory
