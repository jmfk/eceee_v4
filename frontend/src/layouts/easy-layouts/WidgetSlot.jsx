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

// Normalize slot name for CSS class (matches backend logic)
const normalizeForCSS = (value) => {
    if (!value) return '';
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
};

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
    onImportContent, // Import content handler
    slotType = 'content', // 'content' or 'inherited' - determines default preview mode
    widgetPath = [], // Path from parent (empty for top-level layouts)
    // NEW: Inheritance props
    inheritedWidgets = {}, // Widgets inherited from parent pages
    slotInheritanceRules = {}, // Per-slot inheritance rules
    slotMode, // External mode control (optional)
    onSlotModeChange, // Callback when mode changes
    className = '', // Additional classes to apply to the slot container
    // Selection props
    selectedWidgets, // Set<widgetPath>
    cutWidgets, // Set<widgetPath>
    onToggleWidgetSelection, // (slotName, widgetId, nestedPath?) => void
    isWidgetSelected, // (slotName, widgetId, nestedPath?) => boolean
    isWidgetCut, // (slotName, widgetId, nestedPath?) => boolean
    onDeleteCutWidgets, // (cutMetadata) => void - Callback to delete cut widgets
    buildWidgetPath, // (slotName, widgetId, nestedPath?) => string
    parseWidgetPath, // (widgetPath) => object
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
        try {
            const result = getSlotWidgetsForMode(currentMode, localWidgets, slotInheritedWidgets, slotRules);
            // Ensure we always return an array, never undefined or null
            return Array.isArray(result) ? result : [];
        } catch (error) {
            // Silently return empty array on error to prevent crashes
            return [];
        }
    }, [currentMode, localWidgets, slotInheritedWidgets, slotRules, name]);

    // NEW: Filter inherited widgets based on type-based replacement before displaying
    const displayInheritedWidgets = useMemo(() => {
        try {
            if (isPreviewMode || !hasInheritance) {
                return [];
            }

            // Ensure we have valid arrays
            if (!Array.isArray(slotInheritedWidgets)) {
                return [];
            }

            if (!Array.isArray(localWidgets)) {
                return slotInheritedWidgets;
            }

            // TYPE-BASED REPLACEMENT: If inheritableTypes defined and any local widget matches, skip inherited
            if (slotRules.inheritableTypes?.length > 0) {
                const localTypes = localWidgets.map(w => w?.type).filter(Boolean);
                const hasMatchingType = slotRules.inheritableTypes.some(type =>
                    localTypes.includes(type)
                );

                if (hasMatchingType) {
                    // Local widget of inheritable type exists, don't show inherited widgets
                    return [];
                }
            }

            return slotInheritedWidgets;
        } catch (error) {
            // Silently return empty array on error
            return [];
        }
    }, [isPreviewMode, hasInheritance, slotInheritedWidgets, localWidgets, slotRules.inheritableTypes, name]);

    // Split local widgets by inheritance behavior for proper ordering in edit mode
    const { beforeLocalWidgets, afterLocalWidgets, overrideLocalWidgets } = useMemo(() => {
        if (isPreviewMode) return { beforeLocalWidgets: [], afterLocalWidgets: [], overrideLocalWidgets: [] };

        const before = [];
        const after = [];
        const override = [];

        if (Array.isArray(localWidgets)) {
            localWidgets.forEach(widget => {
                // Check for inheritance_behavior (snake_case from API or camelCase from frontend)
                const behavior = widget.inheritanceBehavior || widget.inheritance_behavior || 'insert_after_parent';

                if (behavior === 'override_parent') {
                    override.push(widget);
                } else if (behavior === 'insert_before_parent') {
                    before.push(widget);
                } else {
                    // Default: insert_after_parent
                    after.push(widget);
                }
            });
        }

        return { beforeLocalWidgets: before, afterLocalWidgets: after, overrideLocalWidgets: override };
    }, [isPreviewMode, localWidgets]);

    // For backward compatibility - combined local widgets
    const displayLocalWidgets = useMemo(() => {
        return [...beforeLocalWidgets, ...afterLocalWidgets, ...overrideLocalWidgets];
    }, [beforeLocalWidgets, afterLocalWidgets, overrideLocalWidgets]);

    // Extract parent page info from first inherited widget
    const parentPageInfo = useMemo(() => {
        if (!Array.isArray(slotInheritedWidgets) || slotInheritedWidgets.length === 0) {
            return null;
        }
        const firstWidget = slotInheritedWidgets[0];
        return firstWidget?.inheritedFrom || null;
    }, [slotInheritedWidgets]);

    // Legacy: Keep isSlotPreviewMode for backward compatibility
    const isSlotPreviewMode = isPreviewMode;

    // Handle widget actions
    const handleWidgetAction = (action, widget, ...args) => {
        if (action === 'edit') {
            console.log('[WidgetSlot] Edit action received:', {
                action,
                slotName: name,
                widget,
                args,
                hasOnWidgetAction: !!onWidgetAction
            });
        }
        if (onWidgetAction) {
            onWidgetAction(action, name, widget, ...args);
        } else {
            console.warn('[WidgetSlot] onWidgetAction not provided for action:', action);
        }
    };

    // Handle mode change
    const handleModeChange = (newMode) => {
        try {
            // Validate mode value
            if (newMode !== 'edit' && newMode !== 'preview') {
                newMode = 'edit';
            }

            setInternalMode(newMode);
            if (onSlotModeChange) {
                onSlotModeChange(name, newMode);
            }
        } catch (error) {
            // Silently handle error
        }
    };

    // Handle slot preview toggle (legacy support)
    const handleSlotPreviewToggle = () => {
        try {
            const newMode = isPreviewMode ? 'edit' : 'preview';
            handleModeChange(newMode);
        } catch (error) {
            // Silently handle error
        }
    };

    // Handle add widget - show modal for widget selection
    const handleAddWidget = () => {
        if (onShowWidgetModal) {
            // Determine which widget types are allowed for this slot
            // Priority: allowed_types/inheritableTypes > disallowed_types
            let allowedTypes = finalAllowedWidgetTypes;
            let disallowedTypes = null;

            // Check for allowed_types in slot rules
            const hasAllowedTypes = slotRules.allowedTypes !== undefined && slotRules.allowedTypes.length > 0;

            if (slotRules.inheritableTypes !== undefined) {
                // inheritableTypes is explicitly set in the layout
                if (slotRules.inheritableTypes.length > 0) {
                    // Use the specific types defined
                    allowedTypes = slotRules.inheritableTypes;
                } else {
                    // Empty array means "all types allowed" (backend convention)
                    allowedTypes = ['*'];
                }
            } else if (hasAllowedTypes) {
                // Use allowed_types from slot rules
                allowedTypes = slotRules.allowedTypes;
            } else if (slotRules.disallowedTypes !== undefined && slotRules.disallowedTypes.length > 0) {
                // No allowed_types, but disallowed_types exists - use as blacklist
                allowedTypes = ['*'];
                disallowedTypes = slotRules.disallowedTypes;
            }

            onShowWidgetModal(name, {
                label,
                allowedWidgetTypes: allowedTypes,
                disallowedWidgetTypes: disallowedTypes,
                maxWidgets: finalMaxWidgets
            });
        } else {
            // Fallback to direct widget addition if modal not available
            handleWidgetAction('add', null, 'easy_widgets.ContentWidget');
        }
    };

    // Render individual widget
    const renderWidget = (widget, index) => {
        // Safety check: ensure widget is valid
        if (!widget || typeof widget !== 'object') {
            return null;
        }

        // Create a unique key that combines slot name, widget ID, and index to prevent collisions
        const uniqueKey = widget.id ? `${name}-${widget.id}-${index}` : `${name}-index-${index}`;

        // Build full path for this widget: append widget ID to slot path
        const fullWidgetPath = [...slotPath, widget.id || `index-${index}`];

        // Determine allowed widget types for this slot (same logic as handleAddWidget)
        let allowedTypes = finalAllowedWidgetTypes;
        const hasAllowedTypes = slotRules.allowedTypes !== undefined && slotRules.allowedTypes.length > 0;

        if (slotRules.inheritableTypes !== undefined) {
            if (slotRules.inheritableTypes.length > 0) {
                allowedTypes = slotRules.inheritableTypes;
            } else {
                allowedTypes = ['*'];
            }
        } else if (hasAllowedTypes) {
            allowedTypes = slotRules.allowedTypes;
        } else if (slotRules.disallowedTypes !== undefined && slotRules.disallowedTypes.length > 0) {
            // Note: disallowedTypes filtering is handled in the widget modal
            allowedTypes = ['*'];
        }

        try {
            return (
                <div key={uniqueKey}>
                    <PageWidgetFactory
                        widget={widget}
                        slotName={name}
                        index={index}
                        onEdit={(slotName, idx, w) => handleWidgetAction('edit', w, idx)}
                        onDelete={(slotName, idx, w) => handleWidgetAction('delete', w, idx)}
                        onMoveUp={(slotName, idx, w) => handleWidgetAction('moveUp', w, idx)}
                        onMoveDown={(slotName, idx, w) => handleWidgetAction('moveDown', w, idx)}
                        onPaste={(slotName, idx, pastedWidget, metadata) => handleWidgetAction('paste', pastedWidget, idx, metadata)}
                        onConfigChange={(widgetId, slotName, newConfig) => handleWidgetAction('configChange', { id: widgetId }, newConfig)}
                        canMoveUp={index > 0}
                        canMoveDown={index < effectiveWidgets.length - 1}
                        isInherited={widget.isInherited || false}
                        mode={isSlotPreviewMode ? "display" : "editor"}
                        showControls={editable && !isSlotPreviewMode}
                        // PageEditor-specific props
                        versionId={pageContext?.versionId}
                        isPublished={pageContext?.isPublished}
                        onVersionChange={pageContext?.onVersionChange}
                        onPublishingAction={pageContext?.onPublishingAction}
                        onOpenWidgetEditor={pageContext?.onOpenWidgetEditor}
                        // Context props for widgets
                        parentComponentId={pageContext?.parentComponentId}
                        contextType={pageContext?.contextType}
                        pageId={pageContext?.pageId}
                        webpageData={pageContext?.webpageData}
                        pageVersionData={pageContext?.pageVersionData}
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
                        pathVariables={pageContext?.pathVariables}
                        simulatedPath={pageContext?.simulatedPath}
                        onSimulatedPathChange={pageContext?.onSimulatedPathChange}
                        // Selection props
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
            );
        } catch (error) {
            return (
                <div key={uniqueKey} className="p-4 bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600">
                        Error rendering widget: {error.message}
                    </p>
                </div>
            );
        }
    };

    // Main render function with error boundary
    try {
        // Wrap widgets content if className is provided (for grid layouts)
        const wrapContent = (content) => {
            if (className) {
                return <div className={className}>{content}</div>;
            }
            return content;
        };

        return (
            <div
                className={`widget-slot slot-${normalizeForCSS(name)} group relative`}
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
                        className="relative border px-4 py-2 transition-colors border-gray-200 "
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
                                    onImportContent={onImportContent}
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
                {wrapContent(
                    isSlotPreviewMode ? (
                        // Preview mode: Show merged widgets using effectiveWidgets
                        Array.isArray(effectiveWidgets) && effectiveWidgets.length > 0 ? (
                            effectiveWidgets.map((widget, index) => renderWidget(widget, index))
                        ) : null
                    ) : (
                        // Edit mode: Show widgets in correct inheritance order
                        editable && (
                            <>
                                {/* Override widgets replace everything */}
                                {overrideLocalWidgets.length > 0 ? (
                                    <div className="override-widgets-section">
                                        {overrideLocalWidgets.map((widget, index) => renderWidget(widget, index))}
                                    </div>
                                ) : (
                                    <>
                                        {/* Before Local Widgets - appear BEFORE inherited */}
                                        {beforeLocalWidgets.length > 0 && (
                                            <div className="before-local-widgets-section">
                                                {beforeLocalWidgets.map((widget, index) => renderWidget(widget, index))}
                                            </div>
                                        )}

                                        {/* Inherited Widgets Section */}
                                        {Array.isArray(displayInheritedWidgets) && displayInheritedWidgets.length > 0 && (
                                            <div className="inherited-widgets-section">
                                                {displayInheritedWidgets.map((widget, index) =>
                                                    renderWidget({ ...widget, isInherited: true }, index)
                                                )}
                                            </div>
                                        )}

                                        {/* After Local Widgets - appear AFTER inherited (default) */}
                                        {afterLocalWidgets.length > 0 && (
                                            <div className="after-local-widgets-section">
                                                {afterLocalWidgets.map((widget, index) => renderWidget(widget, index))}
                                            </div>
                                        )}

                                        {/* Add Widget Section - Show when in merge mode with inherited widgets but no local widgets */}
                                        {slotRules.mergeMode && Array.isArray(displayInheritedWidgets) && displayInheritedWidgets.length > 0 && displayLocalWidgets.length === 0 && (
                                            <div className="add-widget-section text-center py-8 border-2 border-dashed border-blue-300 bg-blue-50">
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

                                        {/* Empty slot handling - only when NO inherited AND NO local widgets */}
                                        {(!Array.isArray(displayInheritedWidgets) || displayInheritedWidgets.length === 0) && displayLocalWidgets.length === 0 && (
                                            <div className="empty-slot text-center py-12 text-gray-500 border-2 border-dashed border-gray-300">
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
                                )}
                            </>
                        )
                    )
                )}
            </div>
        );
    } catch (error) {
        return (
            <div className="widget-slot-error p-6 bg-red-50 border-2 border-red-300">
                <h4 className="text-lg font-semibold text-red-800 mb-2">Slot Rendering Error</h4>
                <p className="text-sm text-red-600 mb-2">
                    Failed to render slot: <strong>{label || name}</strong>
                </p>
                <p className="text-xs text-red-500 font-mono">
                    {error.message}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    Reload Page
                </button>
            </div>
        );
    }
};

export default WidgetSlot;
