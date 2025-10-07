/**
 * PageEditor Widget Factory
 * 
 * This is the PageEditor-specific widget factory that wraps shared widget
 * implementations with PageEditor-specific behaviors and integrations.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Layout, Settings, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getWidgetComponent, getWidgetDisplayName } from '../../widgets'
import { renderWidgetPreview } from '../../utils/widgetPreview'
import PageWidgetHeader from './PageWidgetHeader'
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal'

/**
 * PageEditor Widget Factory - Layout-based widget rendering
 * 
 * This factory is specifically designed for PageEditor's layout-based approach
 * with LayoutRenderer integration, version management, and publishing workflows.
 */
const PageWidgetFactory = ({
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
    // PageEditor-specific props
    layoutRenderer,
    versionId,
    isPublished = false,
    onVersionChange,
    onPublishingAction,
    onOpenWidgetEditor,
    // Context props for widgets
    parentComponentId,
    contextType,
    pageId,
    // Nested widget props (for widgets inside container widgets)
    nestedParentWidgetId,
    nestedParentSlotName,
    // Widget path for infinite nesting support
    widgetPath = [],
    slotType = 'content', // 'content' or 'inherited' - determines default preview mode
    // NEW: Inheritance props
    isInherited = false,
    // Widget modal for replace functionality
    onShowWidgetModal,
    slotMetadata = null
}) => {
    // Use passed props or extract from widget
    const actualWidgetId = widgetId || widget?.id
    const actualSlotName = passedSlotName || slotName || widget?.slotName

    const [showPreview, setShowPreview] = useState(false)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [previewContent, setPreviewContent] = useState(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const previewContainerRef = useRef(null)

    // Create a stable config change handler that integrates with LayoutRenderer
    const stableConfigChangeHandler = useMemo(() => {
        return onConfigChange ? (newConfig) => {
            // PageEditor-specific: Update through LayoutRenderer for immediate visual feedback
            if (layoutRenderer) {
                const updatedWidget = { ...widget, config: newConfig }
                layoutRenderer.updateWidget(actualSlotName, index, updatedWidget)
            }
            onConfigChange(widget.id, slotName, newConfig)
        } : undefined
    }, [onConfigChange, widget.id, slotName, layoutRenderer, actualSlotName, index, widget])

    // PageEditor-specific edit handler with version awareness
    const handleEdit = () => {
        if (onEdit) {
            onEdit(slotName, index, widget)
        }
    }

    // PageEditor-specific delete handler
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

    // Enhanced preview with publishing context and slot type awareness
    const handleModalPreview = async () => {
        setShowPreview(true)
        setIsLoadingPreview(true)
        setPreviewContent(null)

        try {
            // Determine preview mode based on slot type and widget inheritance
            const isInheritedWidget = widget.inherit_from_parent || widget.inherited_from
            const defaultToViewMode = slotType === 'inherited' || isInheritedWidget

            // PageEditor-specific: Include version and publishing context in preview
            const result = await renderWidgetPreview(widget, {
                versionId,
                publishingContext: isPublished,
                layoutContext: layoutRenderer?.getLayoutContext(),
                previewMode: defaultToViewMode ? 'view' : 'edit',
                slotType,
                isInherited: isInheritedWidget
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

    // Get the widget component (supports ECEEE widgets and overrides)
    const CoreWidgetComponent = getWidgetComponent(widget.type)

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
                                Widget type "{widget.type}" is not supported in PageEditor
                            </p>
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
                    message={`Are you sure you want to delete this unsupported widget of type "${widget.type}"? This action cannot be undone.`}
                    itemName={`Unsupported Widget (${widget.type})`}
                    isDeleting={isDeleting}
                    deleteButtonText="Delete Broken Widget"
                />
            </div>
        )
    }

    // Widget wrapper with PageEditor-specific controls
    if (mode === 'editor' && showControls) {
        // For inherited widgets in merge mode, show clean display with hover replace button
        if (isInherited) {
            // Only show replace button if slot has inheritableTypes defined and non-empty
            const showReplaceButton = slotMetadata?.allowedWidgetTypes?.length > 0 &&
                !slotMetadata.allowedWidgetTypes.includes('*');

            return (
                <div
                    className={`widget-item page-editor-widget-inherited relative group ${className}`}
                    data-widget-type={widget.type}
                    data-widget-id={widget.id}
                    data-version-id={versionId}
                    data-inherited="true"
                >
                    {/* Replace button - only visible on hover, positioned at top-right */}
                    {showReplaceButton && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button
                                onClick={() => {
                                    // Open widget selection modal to choose a replacement widget
                                    if (onShowWidgetModal) {
                                        // Pass replacement context
                                        // Note: With type-based replacement, adding ANY local widget of the inheritable type
                                        // will hide ALL inherited widgets, so we always insert at position 0
                                        const replacementInfo = {
                                            isReplacement: true,
                                            position: 0 // Always insert at beginning since all inherited will be hidden
                                        };
                                        onShowWidgetModal(actualSlotName, slotMetadata, replacementInfo);
                                    } else {
                                        alert(`Replace inherited ${getWidgetDisplayName(widget.type)} from ${widget.inheritedFrom?.title || 'parent page'}\n\nWidget modal not available.`);
                                    }
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded shadow-lg"
                                title="Replace this inherited widget with a local one"
                            >
                                Replace
                            </button>
                        </div>
                    )}

                    {/* Core Widget Content - render the actual widget in display mode */}
                    <CoreWidgetComponent
                        config={widget.config || {}}
                        mode="display"
                        themeId={widget.config?.themeId}
                        widgetId={actualWidgetId}
                        slotName={actualSlotName}
                        widgetType={widget.type}
                        layoutRenderer={layoutRenderer}
                        versionId={versionId}
                        isPublished={isPublished}
                        parentComponentId={parentComponentId}
                        contextType={contextType}
                        pageId={pageId}
                        widgetPath={widgetPath}
                        nestedParentWidgetId={nestedParentWidgetId}
                        nestedParentSlotName={nestedParentSlotName}
                    />
                </div>
            )
        }

        // Normal local widget rendering with full header
        return (
            <div
                className={`widget-item page-editor-widget relative group ${className} ${isPublished ? 'published-widget' : ''}`}
                data-widget-type={widget.type}
                data-widget-id={widget.id}
                data-version-id={versionId}
                data-published={isPublished}
            >
                {/* PageEditor-specific Widget Header */}
                <PageWidgetHeader
                    widgetType={getWidgetDisplayName(widget.type)}
                    onEdit={onEdit ? handleEdit : undefined}
                    onDelete={onDelete ? handleDelete : undefined}
                    onMoveUp={onMoveUp ? handleMoveUp : undefined}
                    onMoveDown={onMoveDown ? handleMoveDown : undefined}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    showControls={true}
                    isInherited={false}
                    inheritedFrom={null}
                />

                {/* Core Widget Content */}
                <div className="widget-content overflow-hidden border border-gray-200 border-t-0 rounded-b">
                    <CoreWidgetComponent
                        config={widget.config || {}}
                        mode="editor"
                        onConfigChange={stableConfigChangeHandler}
                        themeId={widget.config?.themeId}
                        widgetId={actualWidgetId}
                        slotName={actualSlotName}
                        widgetType={widget.type}
                        layoutRenderer={layoutRenderer}
                        versionId={versionId}
                        isPublished={isPublished}
                        // Context props for container widgets
                        parentComponentId={parentComponentId}
                        contextType={contextType}
                        pageId={pageId}
                        onWidgetEdit={onEdit}
                        onOpenWidgetEditor={onOpenWidgetEditor}
                        // Widget path for infinite nesting
                        widgetPath={widgetPath}
                        // Legacy nested widget context (deprecated)
                        nestedParentWidgetId={nestedParentWidgetId}
                        nestedParentSlotName={nestedParentSlotName}
                    />
                </div>

                {/* PageEditor-specific Preview Modal */}
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
                                        Preview: {getWidgetDisplayName(widget.type)}
                                    </h3>
                                    {versionId && (
                                        <p className="text-sm text-gray-500">Version: {versionId}</p>
                                    )}
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
                    message={`Are you sure you want to delete this ${getWidgetDisplayName(widget.type)} widget? This action cannot be undone.`}
                    itemName={getWidgetDisplayName(widget.type)}
                    isDeleting={isDeleting}
                    deleteButtonText="Delete Widget"
                />
            </div>
        )
    }

    // Simple widget renderer without controls (for display mode)
    return (
        <div
            className={`widget-item page-editor-display ${className}`}
            data-widget-type={widget.type}
            data-widget-id={widget.id}
            data-version-id={versionId}
        >
            <CoreWidgetComponent
                config={widget.config || {}}
                mode={mode}
                onConfigChange={stableConfigChangeHandler}
                themeId={widget.config?.themeId}
                widgetId={actualWidgetId}
                slotName={actualSlotName}
                widgetType={widget.type}
                // PageEditor-specific props
                layoutRenderer={layoutRenderer}
                versionId={versionId}
                isPublished={isPublished}
                // Context props for container widgets
                parentComponentId={parentComponentId}
                contextType={contextType}
                pageId={pageId}
                onWidgetEdit={onEdit}
                onOpenWidgetEditor={onOpenWidgetEditor}
                // Widget path for infinite nesting
                widgetPath={widgetPath}
                // Legacy nested widget context (deprecated)
                nestedParentWidgetId={nestedParentWidgetId}
                nestedParentSlotName={nestedParentSlotName}
            />
        </div>
    )
}

export default PageWidgetFactory
