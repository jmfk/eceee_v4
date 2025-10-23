/**
 * WidgetSlot - React component for rendering widget slots
 * 
 * This component renders a slot area where widgets can be placed.
 * It handles widget rendering, empty states, slot management, and widget inheritance.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Layout, Plus, Eye, EyeOff } from 'lucide-react';
import PageWidgetFactory from '../../editors/page-editor/PageWidgetFactory';
import PageSlotIconMenu from '../../editors/page-editor/PageSlotIconMenu';
import { getSlotWidgetsForMode, shouldSlotDefaultToPreview, hasInheritedContent } from '../../utils/widgetMerging';
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
    // NEW: Inheritance props
    inheritedWidgets = {}, // Widgets inherited from parent pages
    slotInheritanceRules = {}, // Per-slot inheritance rules
    slotMode, // External mode control (optional)
    onSlotModeChange, // Callback when mode changes
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
    const localWidgets = widgets[name] || [];
    const slotInheritedWidgets = inheritedWidgets[name] || [];
    const slotRules = slotInheritanceRules[name] || {};


    // Determine smart default for slot mode
    const defaultMode = useMemo(() => {
        // Use smart logic to determine default mode based on inheritance
        return shouldSlotDefaultToPreview(name, localWidgets, slotInheritedWidgets, slotRules) ? 'preview' : 'edit';
    }, [name, localWidgets, slotInheritedWidgets, slotRules]);

    // Slot-level mode state (controlled or uncontrolled)
    const [internalMode, setInternalMode] = useState(defaultMode);
    const currentMode = slotMode || internalMode; // Use external mode if provided
    const isPreviewMode = currentMode === 'preview';

    // Check if slot has inherited content
    const hasInheritance = hasInheritedContent(slotInheritedWidgets);

    // Get effective widgets based on current mode
    const effectiveWidgets = useMemo(() => {
        const result = getSlotWidgetsForMode(currentMode, localWidgets, slotInheritedWidgets, slotRules);
        return result;
    }, [currentMode, localWidgets, slotInheritedWidgets, slotRules, name]);

    // NEW: Filter inherited widgets based on type-based replacement before displaying
    const displayInheritedWidgets = useMemo(() => {
        if (isPreviewMode || !hasInheritance) {
            return [];
        }

        // TYPE-BASED REPLACEMENT: If inheritableTypes defined and any local widget matches, skip inherited
        if (slotRules.inheritableTypes?.length > 0) {
            const localTypes = localWidgets.map(w => w.type);
            const hasMatchingType = slotRules.inheritableTypes.some(type =>
                localTypes.includes(type)
            );

            if (hasMatchingType) {
                // Local widget of inheritable type exists, don't show inherited widgets
                return [];
            }
        }

        return slotInheritedWidgets;
    }, [isPreviewMode, hasInheritance, slotInheritedWidgets, localWidgets, slotRules.inheritableTypes, name]);

    const displayLocalWidgets = !isPreviewMode ? localWidgets : [];

    // Extract parent page info from first inherited widget
    const parentPageInfo = slotInheritedWidgets.length > 0 && slotInheritedWidgets[0].inheritedFrom
        ? slotInheritedWidgets[0].inheritedFrom
        : null;

    // Legacy: Keep isSlotPreviewMode for backward compatibility
    const isSlotPreviewMode = isPreviewMode;

    // Handle widget actions
    const handleWidgetAction = (action, widget, ...args) => {
        if (onWidgetAction) {
            onWidgetAction(action, name, widget, ...args);
        }
    };

    // Handle mode change
    const handleModeChange = (newMode) => {
        setInternalMode(newMode);
        if (onSlotModeChange) {
            onSlotModeChange(name, newMode);
        }
    };

    // Handle slot preview toggle (legacy support)
    const handleSlotPreviewToggle = () => {
        const newMode = isPreviewMode ? 'edit' : 'preview';
        handleModeChange(newMode);
    };

    // Handle add widget - show modal for widget selection
    const handleAddWidget = () => {
        if (onShowWidgetModal) {
            // Determine which widget types are allowed for this slot
            // Priority: inheritableTypes (if defined and non-empty) > allowedWidgetTypes
            // Note: empty inheritableTypes array means "all types" according to backend
            let allowedTypes = finalAllowedWidgetTypes;

            if (slotRules.inheritableTypes !== undefined) {
                // inheritableTypes is explicitly set in the layout
                if (slotRules.inheritableTypes.length > 0) {
                    // Use the specific types defined
                    allowedTypes = slotRules.inheritableTypes;
                } else {
                    // Empty array means "all types allowed" (backend convention)
                    allowedTypes = ['*'];
                }
            }

            onShowWidgetModal(name, {
                label,
                allowedWidgetTypes: allowedTypes,
                maxWidgets: finalMaxWidgets
            });
        } else {
            // Fallback to direct widget addition if modal not available
            handleWidgetAction('add', null, 'default_widgets.ContentWidget');
        }
    };

    // Render individual widget
    const renderWidget = (widget, index) => {
        // Create a unique key that combines slot name, widget ID, and index to prevent collisions
        const uniqueKey = widget.id ? `${name}-${widget.id}-${index}` : `${name}-index-${index}`;

        // Build full path for this widget: append widget ID to slot path
        const fullWidgetPath = [...slotPath, widget.id];

        // Determine allowed widget types for this slot (same logic as handleAddWidget)
        let allowedTypes = finalAllowedWidgetTypes;
        if (slotRules.inheritableTypes !== undefined) {
            if (slotRules.inheritableTypes.length > 0) {
                allowedTypes = slotRules.inheritableTypes;
            } else {
                allowedTypes = ['*'];
            }
        }

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
                    canMoveDown={index < effectiveWidgets.length - 1}
                    isInherited={widget.isInherited || false}
                    mode={isSlotPreviewMode ? "display" : "editor"}
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
                    webpageData={pageContext.webpageData}
                    pageVersionData={pageContext.pageVersionData}
                    // Widget path for nested widget support
                    widgetPath={fullWidgetPath}
                    // Slot type and preview mode for widget determination
                    slotType={finalSlotType}
                    slotPreviewMode={isSlotPreviewMode}
                    // Widget modal for replace functionality
                    onShowWidgetModal={onShowWidgetModal}
                    slotMetadata={{
                        label,
                        allowedWidgetTypes: allowedTypes,
                        maxWidgets: finalMaxWidgets
                    }}
                    // Path variables for dynamic content
                    pathVariables={pageContext.pathVariables}
                    simulatedPath={pageContext.simulatedPath}
                    onSimulatedPathChange={pageContext.onSimulatedPathChange}
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
                    <div className="flex items-center justify-between mb-3">
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
                            {/* Slot Preview Toggle - Always visible on hover */}
                            <button
                                onClick={handleSlotPreviewToggle}
                                className="p-1 rounded transition-all duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-200 opacity-0 group-hover:opacity-100"
                                title={isPreviewMode ? "Exit preview mode" : "Preview entire slot"}
                            >
                                {isPreviewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>

                            <PageSlotIconMenu
                                slotName={name}
                                slotLabel={label}
                                widgets={localWidgets}
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

            {/* Widgets Rendering */}
            {isSlotPreviewMode ? (
                // Preview mode: Show merged widgets using effectiveWidgets
                effectiveWidgets.length > 0 ? (
                    effectiveWidgets.map((widget, index) => renderWidget(widget, index))
                ) : null
            ) : (
                // Edit mode: Show inherited widgets (read-only) + local widgets (editable) separately
                editable && (
                    <>
                        {/* Inherited Widgets Section */}
                        {displayInheritedWidgets.length > 0 && (
                            <div className="inherited-widgets-section mb-4">
                                {displayInheritedWidgets.map((widget, index) =>
                                    renderWidget({ ...widget, isInherited: true }, index)
                                )}
                            </div>
                        )}

                        {/* Add Widget Section - Show when in merge mode with inherited widgets but no local widgets */}
                        {slotRules.mergeMode && displayInheritedWidgets.length > 0 && displayLocalWidgets.length === 0 && (
                            <div className="add-widget-section text-center py-8 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
                                <button
                                    onClick={handleAddWidget}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Your First Widget
                                </button>
                                <p className="text-xs text-blue-700 mt-2">
                                    Widgets added here will appear alongside the inherited content above
                                </p>
                            </div>
                        )}

                        {/* Local Widgets Section (editable) */}
                        {displayLocalWidgets.length > 0 && (
                            <div className="local-widgets-section">
                                {displayLocalWidgets.map((widget, index) => renderWidget(widget, index))}
                            </div>
                        )}

                        {/* Empty slot handling - only when NO inherited AND NO local widgets */}
                        {displayInheritedWidgets.length === 0 && displayLocalWidgets.length === 0 && (
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
                        )}
                    </>
                )
            )}
        </div>
    );
};

export default WidgetSlot;
