import React, { useState, useEffect, useRef } from 'react'
import { Layout, Settings, Trash2, ChevronUp, ChevronDown, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { WIDGET_REGISTRY, getWidgetComponent } from './widgetRegistry'
import { renderWidgetPreview } from '../../utils/widgetPreview'

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
    className = ''
}) => {
    const [isHovered, setIsHovered] = useState(false)
    const [isMenuExpanded, setIsMenuExpanded] = useState(true)
    const [showPreview, setShowPreview] = useState(false)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [previewContent, setPreviewContent] = useState(null)
    const previewContainerRef = useRef(null)

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

    const handlePreview = async () => {
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

    const toggleMenuExpansion = () => {
        setIsMenuExpanded(!isMenuExpanded)
    }

    // Widget wrapper with controls
    if (mode === 'editor' && showControls) {
        return (
            <div
                className={`widget-item relative hover:shadow-sm transition-colors ${className}`}
                data-widget-type={widget.type}
                data-widget-id={widget.id}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Enhanced Hover Menu - positioned in top-right corner */}
                {isHovered && (
                    <div className="absolute top-2 right-2 flex items-center space-x-1 bg-white shadow-lg rounded-md p-1 border z-10">
                        {/* Expand/Contract Button */}
                        <button
                            onClick={toggleMenuExpansion}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors rounded"
                            title={isMenuExpanded ? "Minimize menu" : "Expand menu"}
                        >
                            {isMenuExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>

                        {/* Widget Type Label */}
                        {isMenuExpanded && (
                            <span
                                className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-100 rounded"
                                title={`Widget Type: ${getWidgetTypeName(widget)}`}
                            >
                                {getWidgetTypeName(widget)}
                            </span>
                        )}

                        {/* Menu Container (can be hidden/shown) */}
                        {isMenuExpanded && (
                            <div className="flex items-center space-x-1">
                                {/* Preview Button */}
                                <button
                                    onClick={handlePreview}
                                    className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors rounded"
                                    title="Preview widget"
                                >
                                    <Eye className="h-4 w-4" />
                                </button>

                                {/* Move Up Button */}
                                {onMoveUp && (
                                    <button
                                        onClick={handleMoveUp}
                                        disabled={!canMoveUp}
                                        className={`p-1.5 transition-colors rounded ${canMoveUp
                                            ? 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                                            : 'text-gray-300 cursor-not-allowed'
                                            }`}
                                        title={canMoveUp ? "Move widget up" : "Cannot move up"}
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </button>
                                )}

                                {/* Move Down Button */}
                                {onMoveDown && (
                                    <button
                                        onClick={handleMoveDown}
                                        disabled={!canMoveDown}
                                        className={`p-1.5 transition-colors rounded ${canMoveDown
                                            ? 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                                            : 'text-gray-300 cursor-not-allowed'
                                            }`}
                                        title={canMoveDown ? "Move widget down" : "Cannot move down"}
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                )}

                                {/* Edit Button */}
                                {onEdit && (
                                    <button
                                        onClick={handleEdit}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded"
                                        title="Edit widget"
                                    >
                                        <Settings className="h-4 w-4" />
                                    </button>
                                )}

                                {/* Delete Button */}
                                {onDelete && (
                                    <button
                                        onClick={handleDelete}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded"
                                        title="Delete widget"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}



                {/* Widget Content - Render actual widget component */}
                <div className="widget-content border border-gray-200 rounded overflow-hidden">
                    {(() => {
                        const WidgetComponent = getWidgetComponent(widget.type)
                        if (WidgetComponent) {
                            return (
                                <WidgetComponent
                                    config={widget.config || {}}
                                    mode="editor"
                                    onConfigChange={onConfigChange}
                                    themeId={widget.config?.themeId}
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
                    onConfigChange={onConfigChange}
                    themeId={widget.config?.themeId}
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
