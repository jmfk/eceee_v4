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
import { useClipboard } from '../../contexts/ClipboardContext'

// Normalize widget type for CSS class (matches backend logic)
const normalizeForCSS = (value) => {
    if (!value) return '';
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

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
    onPaste,
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
    namespace,
    // Context props for widgets
    parentComponentId,
    contextType,
    pageId,
    webpageData,
    pageVersionData,
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
    slotMetadata = null,
    // Path variables for dynamic content
    pathVariables = {},
    simulatedPath,
    onSimulatedPathChange,
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
    showPasteMarkers = true // Independent control for paste markers
}) => {
    // Use passed props or extract from widget
    const actualWidgetId = widgetId || widget?.id
    const actualSlotName = passedSlotName || slotName || widget?.slotName
    
    // Get global hover tracking for paste markers
    const { hoveredWidgetId, setHoveredWidget, clearHoveredWidget } = useClipboard();

    const [showPreview, setShowPreview] = useState(false)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [previewContent, setPreviewContent] = useState(null)
    const previewContainerRef = useRef(null)
    
    // Paste mode state
    const [pasteHoverPosition, setPasteHoverPosition] = useState(null) // 'before' | 'after' | null
    const widgetRef = useRef(null)

    // Create a stable config change handler that integrates with LayoutRenderer
    const stableConfigChangeHandler = useMemo(() => {
        return onConfigChange ? (newConfig) => {
            // PageEditor-specific: Update through LayoutRenderer for immediate visual feedback
            if (layoutRenderer) {
                const updatedWidget = { ...widget, config: newConfig }
                layoutRenderer.updateWidget(actualSlotName, index, updatedWidget)
            }
            // Handle different onConfigChange signatures:
            // - Top-level: (widgetId, slotName, newConfig)
            // - Nested: (newConfig)
            if (onConfigChange.length === 1) {
                // Nested widget handler - just pass config
                onConfigChange(newConfig)
            } else {
                // Top-level widget handler - pass full args
                onConfigChange(widget.id, slotName, newConfig)
            }
        } : undefined
    }, [onConfigChange, widget.id, slotName, layoutRenderer, actualSlotName, index, widget])

    // PageEditor-specific edit handler with version awareness
    const handleEdit = () => {
        if (onEdit) {
            onEdit(slotName, index, widget)
        }
    }

    // PageEditor-specific delete handler
    // Note: Confirmation is handled by PageWidgetHeader, so this directly executes deletion
    const handleDelete = async () => {
        if (onDelete) {
            try {
                await onDelete(slotName, index, widget)
            } catch (error) {
                console.error('Failed to delete widget:', error)
            }
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

    // Handle pasting a widget after this one
    const handlePaste = (pastedWidget, metadata) => {
        if (onPaste) {
            onPaste(slotName, index, pastedWidget, metadata);
        }
    }
    
    // Paste mode hover handlers
    const handlePasteHover = (e) => {
        if (!pasteModeActive || !showPasteMarkers || !widgetRef.current) return;
        
        // Stop propagation to prevent parent widgets from showing their paste markers
        e.stopPropagation();
        
        // Mark this widget as the currently hovered one (for nested precedence)
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
        // Stop propagation to prevent parent from receiving the leave event
        if (pasteModeActive && showPasteMarkers) {
            e.stopPropagation();
        }
        
        // Clear this widget's hover state
        clearHoveredWidget(actualWidgetId);
        setPasteHoverPosition(null);
    };
    
    const handlePasteClick = (shiftKey = false) => {
        if (!pasteModeActive || !showPasteMarkers || !pasteHoverPosition || !onPasteAtPosition) {
            return;
        }
        
        // Calculate position based on hover state
        const position = pasteHoverPosition === 'before' ? index : index + 1;
        
        // For top-level widgets, pass empty array (not the widget's own path)
        // widgetPath from props is the current widget's path, not where we're pasting
        // Only pass widgetPath if this widget IS a container (has nested slots)
        const pasteWidgetPath = widgetPath.length > 2 ? widgetPath : [];
        
        // Call paste handler with slot name, position, path, and shift key state
        onPasteAtPosition(slotName, position, pasteWidgetPath, shiftKey);
        
        // Reset hover state
        setPasteHoverPosition(null);
    };

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
                html: `<div class="text-red-600 p-4 border border-red-200 bg-red-50">
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

    // Get the widget component (supports EASY widgets and overrides)
    const CoreWidgetComponent = getWidgetComponent(widget.type)

    if (!CoreWidgetComponent) {
        // Fallback for unsupported widgets
        return (
            <div className={`widget-item unsupported ${className}`}>
                <div className="bg-red-50 border border-red-200 p-4">
                    <div className="flex items-center space-x-3">
                        <div className="bg-red-100 w-10 h-10 flex items-center justify-center text-red-600 border">
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
                    className={`widget-item widget-type-${normalizeForCSS(widget.type)} page-editor-widget-inherited relative group ${className}`}
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
                    <div className="cms-content-isolated">
                        <CoreWidgetComponent
                            config={widget.config || {}}
                            mode="display"
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
                            slotConfig={slotMetadata}
                            context={{
                                widgetId: actualWidgetId,
                                slotName: actualSlotName,
                                contextType,
                                pageId,
                                versionId,
                                webpageData,
                                pageVersionData,
                                widgetPath,
                                namespace,
                                pathVariables: pathVariables || {},
                                simulatedPath: simulatedPath,
                                onSimulatedPathChange: onSimulatedPathChange
                            }}
                            // Paste mode props for container widgets
                            pasteModeActive={pasteModeActive}
                            onPasteAtPosition={onPasteAtPosition}
                            // Selection props for container widgets
                            selectedWidgets={selectedWidgets}
                            cutWidgets={cutWidgets}
                            onToggleWidgetSelection={onToggleWidgetSelection}
                            isWidgetSelected={isWidgetSelected}
                            isWidgetCut={isWidgetCut}
                            buildWidgetPath={buildWidgetPath}
                            parseWidgetPath={parseWidgetPath}
                        />
                    </div>
                </div>
            )
        }

        // Normal local widget rendering with full header
        return (
            <div
                ref={widgetRef}
                className={`widget-item widget-type-${normalizeForCSS(widget.type)} page-editor-widget relative group ${className} ${isPublished ? 'published-widget' : ''} ${pasteModeActive && showPasteMarkers ? 'paste-mode-active' : ''}`}
                data-widget-type={widget.type}
                data-widget-id={widget.id}
                data-version-id={versionId}
                data-published={isPublished}
                onMouseMove={pasteModeActive && showPasteMarkers ? handlePasteHover : undefined}
                onMouseLeave={pasteModeActive && showPasteMarkers ? handlePasteLeave : undefined}
                onClick={(e) => {
                    // Handle paste mode click
                    if (pasteModeActive && showPasteMarkers && pasteHoverPosition) {
                        e.stopPropagation();
                        handlePasteClick(e.shiftKey); // Pass shift key state
                        return;
                    }
                    
                    // STOP PROPAGATION FIRST to prevent bubbling to parent container widgets
                    e.stopPropagation();

                    // Check if clicking on an editable field (contenteditable, input, textarea, etc.)
                    const isEditableField = e.target.isContentEditable ||
                        e.target.tagName === 'INPUT' ||
                        e.target.tagName === 'TEXTAREA' ||
                        e.target.closest('[contenteditable="true"]');

                    if (isEditableField) {
                        // Update panel content if already open, but don't auto-open
                        if (onOpenWidgetEditor) {
                            const widgetWithSlot = {
                                ...widget,
                                slotName: slotName,
                                widgetPath: widgetPath,
                                context: {
                                    ...widget.context,
                                    slotName: slotName,
                                    widgetId: widget.id,
                                    mode: 'edit',
                                    contextType,
                                    widgetPath: widgetPath
                                }
                            };
                            onOpenWidgetEditor(widgetWithSlot, false); // false = don't force open
                        }
                        // Don't prevent default - allow the field to receive focus
                        return;
                    }

                    // Only trigger if clicking the widget body, not the header controls
                    if (!e.target.closest('.widget-header') && !e.target.closest('button')) {
                        // Update panel if already open, but don't auto-open
                        if (onOpenWidgetEditor) {
                            const widgetWithSlot = {
                                ...widget,
                                slotName: slotName,
                                widgetPath: widgetPath,
                                context: {
                                    ...widget.context,
                                    slotName: slotName,
                                    widgetId: widget.id,
                                    mode: 'edit',
                                    contextType,
                                    widgetPath: widgetPath
                                }
                            };
                            onOpenWidgetEditor(widgetWithSlot, false); // false = don't force open
                        }
                    }
                }}
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
                    widget={widget}
                    onPaste={onPaste ? handlePaste : undefined}
                    onCut={undefined}
                    pageId={pageId || webpageData?.id}
                    widgetPath={buildWidgetPath ? buildWidgetPath(actualSlotName, actualWidgetId) : `${actualSlotName}/${actualWidgetId}`}
                    // Selection props
                    slotName={actualSlotName}
                    isSelected={isWidgetSelected ? isWidgetSelected(actualSlotName, actualWidgetId) : false}
                    isCut={isWidgetCut ? isWidgetCut(actualSlotName, actualWidgetId) : false}
                    onToggleSelection={onToggleWidgetSelection ? () => onToggleWidgetSelection(actualSlotName, actualWidgetId) : undefined}
                    // Pass selection helpers to nested widgets
                    selectedWidgets={selectedWidgets}
                    cutWidgets={cutWidgets}
                    onToggleWidgetSelection={onToggleWidgetSelection}
                    isWidgetSelected={isWidgetSelected}
                    isWidgetCut={isWidgetCut}
                    buildWidgetPath={buildWidgetPath}
                    parseWidgetPath={parseWidgetPath}
                    // Active/Inactive toggle
                    onConfigChange={stableConfigChangeHandler}
                />

                {/* Paste Mode Markers - only show if this widget is the currently hovered one */}
                {pasteModeActive && showPasteMarkers && hoveredWidgetId === actualWidgetId && pasteHoverPosition === 'before' && (
                    <div className="absolute -top-1 left-0 right-0 h-1 bg-purple-500 z-[10006] pointer-events-none">
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full bg-purple-500 text-white text-xs px-2 py-0.5 rounded-t whitespace-nowrap">
                            Paste here
                        </div>
                    </div>
                )}
                {pasteModeActive && showPasteMarkers && hoveredWidgetId === actualWidgetId && pasteHoverPosition === 'after' && (
                    <div className="absolute -bottom-1 left-0 right-0 h-1 bg-purple-500 z-[10006] pointer-events-none">
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full bg-purple-500 text-white text-xs px-2 py-0.5 rounded-b whitespace-nowrap">
                            Paste here
                        </div>
                    </div>
                )}

                {/* Core Widget Content */}
                <div className="widget-content overflow-hidden border border-gray-200 border-t-0">
                    <div className="cms-content-isolated">
                        <CoreWidgetComponent
                            config={widget.config || {}}
                            mode="editor"
                            onConfigChange={stableConfigChangeHandler}
                            widgetId={actualWidgetId}
                            slotName={actualSlotName}
                            widgetType={widget.type}
                            layoutRenderer={layoutRenderer}
                            versionId={versionId}
                            isPublished={isPublished}
                            namespace={namespace}
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
                            slotConfig={slotMetadata}
                            context={{
                                widgetId: actualWidgetId,
                                slotName: actualSlotName,
                                contextType,
                                pageId,
                                versionId,
                                webpageData,
                                pageVersionData,
                                widgetPath,
                                namespace,
                                pathVariables: pathVariables || {},
                                simulatedPath: simulatedPath,
                                onSimulatedPathChange: onSimulatedPathChange
                            }}
                            // Paste mode props for container widgets
                            pasteModeActive={pasteModeActive}
                            onPasteAtPosition={onPasteAtPosition}
                            // Selection props for container widgets (TwoColumnsWidget, ThreeColumnsWidget, etc.)
                            selectedWidgets={selectedWidgets}
                            cutWidgets={cutWidgets}
                            onToggleWidgetSelection={onToggleWidgetSelection}
                            isWidgetSelected={isWidgetSelected}
                            isWidgetCut={isWidgetCut}
                            onDeleteCutWidgets={onDeleteCutWidgets}
                            buildWidgetPath={buildWidgetPath}
                            parseWidgetPath={parseWidgetPath}
                        />
                    </div>
                </div>

                {/* PageEditor-specific Preview Modal */}
                {showPreview && (
                    <div
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10010]"
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
                                    <div className="cms-content">
                                        <div
                                            ref={previewContainerRef}
                                            className="widget-preview-content"
                                            dangerouslySetInnerHTML={{ __html: previewContent.html }}
                                        />
                                    </div>
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

    // Simple widget renderer without controls (for display mode)
    return (
        <div
            className={`widget-item widget-type-${normalizeForCSS(widget.type)} page-editor-display ${className}`}
            data-widget-type={widget.type}
            data-widget-id={widget.id}
            data-version-id={versionId}
        >
            <div className="cms-content-isolated">
                <CoreWidgetComponent
                    config={widget.config || {}}
                    mode={mode}
                    onConfigChange={stableConfigChangeHandler}
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
                    slotConfig={slotMetadata}
                    context={{
                        widgetId: actualWidgetId,
                        slotName: actualSlotName,
                        contextType,
                        pageId,
                        versionId,
                        webpageData,
                        pageVersionData,
                        widgetPath,
                        pathVariables: pathVariables || {},
                        simulatedPath: simulatedPath,
                        onSimulatedPathChange: onSimulatedPathChange
                    }}
                    // Paste mode props for container widgets
                    pasteModeActive={pasteModeActive}
                    onPasteAtPosition={onPasteAtPosition}
                    // Selection props for container widgets
                    selectedWidgets={selectedWidgets}
                    cutWidgets={cutWidgets}
                    onToggleWidgetSelection={onToggleWidgetSelection}
                    isWidgetSelected={isWidgetSelected}
                    isWidgetCut={isWidgetCut}
                    onDeleteCutWidgets={onDeleteCutWidgets}
                    buildWidgetPath={buildWidgetPath}
                    parseWidgetPath={parseWidgetPath}
                />
            </div>
        </div>
    )
}

export default PageWidgetFactory
