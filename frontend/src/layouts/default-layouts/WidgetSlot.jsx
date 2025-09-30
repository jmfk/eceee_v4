/**
 * WidgetSlot - React component for rendering widget slots
 * 
 * This component renders a slot area where widgets can be placed.
 * It handles widget rendering, empty states, and slot management.
 */

import React, { useState, useMemo } from 'react';
import { Layout, Plus, Eye, EyeOff } from 'lucide-react';
import PageWidgetFactory from '../../editors/page-editor/PageWidgetFactory';
import PageSlotIconMenu from '../../editors/page-editor/PageSlotIconMenu';
const WidgetSlot = ({
    name,
    label,
    description,
    widgets = {}, // Now expects the full widgets object instead of array
    onWidgetAction,
    editable = true,
    pageContext = {},
    // Simplified prop structure - behavior only (no styling)
    behavior = {},
    // Legacy props for backward compatibility
    allowedWidgetTypes = ['*'],
    maxWidgets = 20, // Increased default
    required = false,
    onShowWidgetModal,
    onClearSlot,
    slotType = 'content', // 'content' or 'inherited' - determines default preview mode
    widgetPath = [], // Path from parent (empty for top-level layouts)
}) => {
    // Build path for this slot: append slot name to parent path
    const slotPath = [...widgetPath, name];
    // Extract behavior props with defaults
    const {
        allowedWidgetTypes: behaviorAllowedTypes = allowedWidgetTypes,
        maxWidgets: behaviorMaxWidgets = maxWidgets,
        required: behaviorRequired = required,
        slotType: behaviorSlotType = slotType
    } = behavior;

    // Use the extracted values
    const finalAllowedWidgetTypes = behaviorAllowedTypes;
    const finalMaxWidgets = behaviorMaxWidgets;
    const finalRequired = behaviorRequired;
    const finalSlotType = behaviorSlotType;
    // Extract widgets for this specific slot
    const slotWidgets = widgets[name] || [];
    // Determine smart default for slot preview mode
    const defaultPreviewMode = useMemo(() => {
        // If slot type is inherited, default to preview mode
        if (finalSlotType === 'inherited') {
            return true;
        }

        // If slot has widgets and is not explicitly content type, default to preview
        if (slotWidgets.length > 0 && finalSlotType !== 'content') {
            return true;
        }

        // Content slots default to edit mode
        return false;
    }, [finalSlotType, slotWidgets.length]);

    // Slot-level preview state
    const [isSlotPreviewMode, setIsSlotPreviewMode] = useState(defaultPreviewMode);

    // Handle widget actions
    const handleWidgetAction = (action, widget, ...args) => {
        if (onWidgetAction) {
            onWidgetAction(action, name, widget, ...args);
        }
    };

    // Handle slot preview toggle
    const handleSlotPreviewToggle = () => {
        setIsSlotPreviewMode(!isSlotPreviewMode);
    };

    // Handle add widget - show modal for widget selection
    const handleAddWidget = () => {
        if (onShowWidgetModal) {
            onShowWidgetModal(name);
        } else {
            // Fallback to direct widget addition if modal not available
            handleWidgetAction('add', null, 'core_widgets.ContentWidget');
        }
    };

    // Render individual widget
    const renderWidget = (widget, index) => {
        // Create a unique key that combines slot name, widget ID, and index to prevent collisions
        const uniqueKey = widget.id ? `${name}-${widget.id}-${index}` : `${name}-index-${index}`;

        // Build full path for this widget: append widget ID to slot path
        const fullWidgetPath = [...slotPath, widget.id];

        return (
            <div key={uniqueKey} className="mb-4">
                <PageWidgetFactory
                    widget={widget}
                    slotName={name}
                    index={index}
                    onEdit={(slotName, idx, w) => handleWidgetAction('edit', w, idx)}
                    onDelete={(slotName, idx, w) => handleWidgetAction('delete', w, idx)}
                    onMoveUp={(slotName, idx, w) => handleWidgetAction('moveUp', w, idx)}
                    onMoveDown={(slotName, idx, w) => handleWidgetAction('moveDown', w, idx)}
                    onConfigChange={(widgetId, slotName, newConfig) => handleWidgetAction('configChange', { id: widgetId }, newConfig)}
                    canMoveUp={index > 0}
                    canMoveDown={index < slotWidgets.length - 1}
                    mode={isSlotPreviewMode ? "preview" : "editor"}
                    showControls={editable && !isSlotPreviewMode}
                    // PageEditor-specific props
                    versionId={pageContext.versionId}
                    isPublished={pageContext.isPublished}
                    onVersionChange={pageContext.onVersionChange}
                    onPublishingAction={pageContext.onPublishingAction}
                    onOpenWidgetEditor={pageContext.onOpenWidgetEditor}
                    // Context props for widgets
                    parentComponentId={pageContext.parentComponentId}
                    contextType={pageContext.contextType}
                    pageId={pageContext.pageId}
                    // Widget path for nested widget support
                    widgetPath={fullWidgetPath}
                    // Slot type and preview mode for widget determination
                    slotType={finalSlotType}
                    slotPreviewMode={isSlotPreviewMode}
                />
            </div>
        );
    };

    return (
        <div
            className="widget-slot group relative"
            data-slot-name={name}
            data-widget-slot={name}
            data-slot-title={label}
            data-slot-description={description}
            data-slot-max-widgets={finalMaxWidgets}
        >
            {/* Slot Header - Only show in edit mode */}
            {editable && !isSlotPreviewMode && (
                <div
                    key={name}
                    className="relative border p-4 transition-colors border-gray-200 "
                    data-slot-name={name}
                    data-slot-title={label}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <div className="flex items-center">
                                <Layout className="h-4 w-4 mr-2 text-gray-400" />
                                <h4 className="text-sm font-medium text-gray-900">
                                    {label}
                                </h4>
                                {/* Slot type indicator */}
                                {finalSlotType === 'inherited' && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                        Inherited
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {/* Slot Preview Toggle - Only visible on hover */}
                            <button
                                onClick={handleSlotPreviewToggle}
                                className="p-1 rounded transition-all duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-200 opacity-0 group-hover:opacity-100"
                                title="Preview entire slot"
                            >
                                <Eye className="h-4 w-4" />
                            </button>

                            <PageSlotIconMenu
                                slotName={name}
                                slotLabel={label}
                                widgets={slotWidgets}
                                maxWidgets={finalMaxWidgets}
                                onAddWidget={handleWidgetAction}
                                onClearSlot={onClearSlot}
                                onShowWidgetModal={onShowWidgetModal}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Preview Exit Button - Only show in preview mode, visible on hover */}
            {isSlotPreviewMode && editable && (
                <div className="absolute top-2 right-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                        onClick={handleSlotPreviewToggle}
                        className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors shadow-lg"
                        title="Exit slot preview mode"
                    >
                        <EyeOff className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Widgets - Direct rendering without unnecessary containers */}
            {slotWidgets.length > 0 ? (
                slotWidgets.map((widget, index) => renderWidget(widget, index))
            ) : (
                // Empty slot handling - only show in edit mode
                !isSlotPreviewMode && editable && (
                    <div className="empty-slot text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <Layout className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">{label}</h4>
                        <p className="text-sm">{description}</p>
                        <div className="mt-4">
                            <button
                                onClick={handleAddWidget}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Your First Widget
                            </button>
                        </div>
                        {finalRequired && (
                            <p className="text-xs text-orange-600 mt-2">This slot is required</p>
                        )}
                    </div>
                )
            )}
        </div>
    );
};

export default WidgetSlot;
