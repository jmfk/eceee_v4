import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Layout, Settings, Trash2, ChevronUp, ChevronDown, Eye, ChevronLeft, ChevronRight, X, EyeOff } from 'lucide-react'
import { WIDGET_REGISTRY, getWidgetComponent } from './widgetRegistry'
import { renderWidgetPreview } from '../../utils/widgetPreview'
import WidgetHeader from './WidgetHeader'

/**
 * Widget Factory component that creates widget elements with controls
 * Used by both ContentEditor and ObjectContentEditor
 */

/**
 * Get widget type display name from widget instance
 * @param {Object} widget - Widget instance
 * @returns {string} Widget type display name
 */
const getWidgetTypeName = (widget) => {
    if (!widget || !widget.type) {
        return 'Widget';
    }

    const registryEntry = WIDGET_REGISTRY[widget.type];
    if (registryEntry && registryEntry.metadata && registryEntry.metadata.name) {
        return registryEntry.metadata.name;
    }

    // Fallback to extracting name from type string
    const typeParts = widget.type.split('.');
    return typeParts[typeParts.length - 1].replace('Widget', '');
};

const WidgetFactory = ({
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
    slotName: passedSlotName
}) => {
    // Use passed props or extract from widget
    const actualWidgetId = widgetId || widget?.id
    const actualSlotName = passedSlotName || slotName || widget?.slotName
    const [isPreviewMode, setIsPreviewMode] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [previewContent, setPreviewContent] = useState(null)
    const previewContainerRef = useRef(null)

    // Create a stable config change handler using useMemo
    const stableConfigChangeHandler = useMemo(() => {
        return onConfigChange ? (newConfig) => {
            onConfigChange(widget.id, slotName, newConfig);
        } : undefined;
    }, [onConfigChange, widget.id, slotName])

    const handleEdit = () => {
        if (onEdit) {
            onEdit(slotName, index, widget)
        }
    }

    const handleDelete = () => {
        if (onDelete) {
            onDelete(slotName, index, widget)
        }
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

    const handlePreview = () => {
        setIsPreviewMode(true)
    }

    const handleExitPreview = () => {
        setIsPreviewMode(false)
    }

    const handleModalPreview = async () => {
        setShowPreview(true)
        setIsLoadingPreview(true)
        setPreviewContent(null)

        try {
            const result = await renderWidgetPreview(widget)
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


    // Widget wrapper with controls
    if (mode === 'editor' && showControls) {
        return (
            <div
                className={`widget-item relative ${className} ${isPreviewMode ? 'preview-mode' : ''}`}
                data-widget-type={widget.type}
                data-widget-id={widget.id}
            >
                {/* Widget Header - Hidden in preview mode */}
                {!isPreviewMode && (
                    <WidgetHeader
                        widgetType={getWidgetTypeName(widget)}
                        onEdit={onEdit ? handleEdit : undefined}
                        onDelete={onDelete ? handleDelete : undefined}
                        onMoveUp={onMoveUp ? handleMoveUp : undefined}
                        onMoveDown={onMoveDown ? handleMoveDown : undefined}
                        onPreview={handlePreview}
                        canMoveUp={canMoveUp}
                        canMoveDown={canMoveDown}
                        showControls={true}
                    />
                )}

                {/* Preview Mode Exit Button - Semi-transparent overlay */}
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

                {/* Widget Content - Render actual widget component */}
                <div className={`widget-content overflow-hidden ${isPreviewMode
                        ? 'border-0 rounded'
                        : 'border border-gray-200 border-t-0 rounded-b'
                    }`}>
                    {(() => {
                        const WidgetComponent = getWidgetComponent(widget.type)
                        if (WidgetComponent) {
                            return (
                                <WidgetComponent
                                    config={widget.config || {}}
                                    mode={isPreviewMode ? "display" : "editor"}
                                    onConfigChange={isPreviewMode ? undefined : stableConfigChangeHandler}
                                    themeId={widget.config?.themeId}
                                    widgetId={actualWidgetId}
                                    slotName={actualSlotName}
                                    widgetType={widget.type}
                                />
                            )
                        } else {
                            // Fallback to placeholder if component not found
                            return (
                                <div className="bg-gray-50 p-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-white rounded-lg w-10 h-10 flex items-center justify-center text-gray-600 border">
                                            <Layout className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-gray-900">
                                                {getWidgetTypeName(widget)}
                                            </h4>
                                            <p className="text-xs text-gray-500 truncate">
                                                {widget.config?.title || widget.config?.content || widget.config?.text || 'Widget content'}
                                            </p>
                                            <p className="text-xs text-red-500 mt-1">Component not found: {widget.type}</p>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    })()}
                </div>

                {/* Preview Modal */}
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
                                <h3 className="text-lg font-medium text-gray-900">
                                    Preview: {getWidgetTypeName(widget)}
                                </h3>
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

            </div>
        )
    }

    // Simple widget renderer without controls
    const WidgetComponent = getWidgetComponent(widget.type)

    return (
        <div
            className={`widget-item ${className}`}
            data-widget-type={widget.type}
            data-widget-id={widget.id}
        >
            {WidgetComponent ? (
                <WidgetComponent
                    config={widget.config || {}}
                    mode={mode}
                    onConfigChange={stableConfigChangeHandler}
                    themeId={widget.config?.themeId}
                    widgetId={actualWidgetId}
                    slotName={actualSlotName}
                    widgetType={widget.type}
                />
            ) : (
                // Fallback to placeholder if component not found
                <div className="widget-content bg-gray-50 border border-gray-200 rounded p-4">
                    <div className="flex items-center space-x-3">
                        <div className="bg-white rounded-lg w-10 h-10 flex items-center justify-center text-gray-600 border">
                            <Layout className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900">
                                {getWidgetTypeName(widget)}
                            </h4>
                            <p className="text-xs text-gray-500 truncate">
                                {widget.config?.title || widget.config?.content || widget.config?.text || 'Widget content'}
                            </p>
                            <p className="text-xs text-red-500 mt-1">Component not found: {widget.type}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default WidgetFactory
