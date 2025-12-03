/**
 * EASY Two-Column Widget Component
 * 
 * EASY-specific two-column layout with left and right slots that work like regular page slots.
 * Widget type: easy_widgets.TwoColumnsWidget
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import SlotEditor from '../../components/editors/SlotEditor';
import PageWidgetFactory from '../../editors/page-editor/PageWidgetFactory';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { OperationTypes } from '../../contexts/unified-data/types/operations';
import { useWidgets } from '../../hooks/useWidgets';
import { useTheme } from '../../hooks/useTheme';
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer';
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer';
import PropTypes from 'prop-types';

const TwoColumnsWidget = ({
    config = {},
    mode = 'display',
    widgetId,
    onWidgetEdit,
    onOpenWidgetEditor,
    contextType = 'page',
    parentComponentId, // PageEditor's componentId
    slotName, // Which slot this TwoColumnsWidget is in (e.g., 'main')  
    widgetPath = [], // Full path to this widget (for infinite nesting)
    context = {}, // Full context including page data
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
    ...props
}) => {
    // Create this widget's own UDC componentId
    const componentId = useMemo(() => {
        return `two-columns-widget-${widgetId}`;
    }, [widgetId]);

    // Get UDC functions
    const { useExternalChanges, publishUpdate } = useUnifiedData();

    // Get all available widget types from the system
    const { widgetTypes, isLoadingTypes, typesError } = useWidgets();

    // Get current theme for component styles
    const { currentTheme } = useTheme({ pageId: context.pageId });

    // Local state management for slots data
    // Initialize from config.slots, but maintain locally to avoid prop resets
    const [slotsData, setSlotsData] = useState(() => {
        return config.slots || { left: [], right: [] };
    });

    // Track the widget ID to detect when we're rendering a different widget
    const previousWidgetIdRef = useRef(widgetId);

    // Only update from props when widgetId changes (different widget) or on mount
    useEffect(() => {
        if (previousWidgetIdRef.current !== widgetId) {
            // Different widget - reinitialize from config
            setSlotsData(config.slots || { left: [], right: [] });
            previousWidgetIdRef.current = widgetId;
        }
    }, [widgetId, config.slots]);

    // Subscribe to external UDC changes for this specific widget
    useExternalChanges(componentId, (state) => {
        // When UDC state changes, look for updates to our widget's config
        // This allows us to receive updates from other sources (DataManager, other components)

        // Extract updated widget config from UDC state
        let version = null;
        if (contextType === 'page') {
            version = state.versions?.[state.metadata?.currentVersionId];
        } else if (contextType === 'object') {
            const objectId = state.metadata?.currentObjectId;
            version = state.objects?.[objectId];
        }

        if (!version) return;

        // Find this TwoColumnsWidget in the widgets tree using widgetPath
        let containerWidget = null;
        if (widgetPath && widgetPath.length >= 2) {
            // Use path to find this container widget
            const topSlot = widgetPath[0];
            const widgets = version.widgets?.[topSlot] || [];

            // Navigate through the path to find this widget
            let current = widgets;
            for (let i = 1; i < widgetPath.length; i += 2) {

                const targetId = widgetPath[i];
                const widget = current.find(w => w.id === targetId);
                if (!widget) break;

                if (widget.id === widgetId) {
                    containerWidget = widget;
                    break;
                }

                // Descend into next slot
                const nextSlot = widgetPath[i + 1];
                if (nextSlot && widget.config?.slots) {
                    current = widget.config.slots[nextSlot] || [];
                }
            }
        } else {
            // Top-level widget - find in slot
            const slotWidgets = version.widgets?.[slotName] || [];
            containerWidget = slotWidgets.find(w => w.id === widgetId);
        }

        if (containerWidget && containerWidget.config?.slots) {
            // Update local slotsData if it has changed

            const newSlots = containerWidget.config.slots;
            setSlotsData(prevSlots => {
                // Only update if actually changed
                if (JSON.stringify(prevSlots) !== JSON.stringify(newSlots)) {
                    return newSlots;
                }
                return prevSlots;
            });
        }
    });

    // Filter widget types for container slots
    // TwoColumnsWidget allows most widgets but excludes certain types
    const getFilteredWidgetTypes = useCallback(() => {
        if (!widgetTypes || !Array.isArray(widgetTypes)) return [];

        return widgetTypes
            .filter(widget => {
                // Exclude widgets that shouldn't be in container slots
                const excludedTypes = [
                    'layout.full-width', // Layout widgets
                    'navigation.main-nav', // Navigation widgets
                    'system.header', // System widgets
                    'system.footer'
                ];

                return !excludedTypes.some(excluded =>
                    widget.type?.includes(excluded) || widget.name?.includes(excluded)
                );
            })
            .map(widget => ({
                type: widget.type,
                name: widget.name || widget.displayName || widget.type
            }));
    }, [widgetTypes]);

    // Handle slot changes - update local state first, then publish to UDC
    const handleSlotChange = useCallback(async (slotName, widgets) => {
        // Update local state immediately for fast UI
        setSlotsData(prevSlots => {
            const updatedSlots = {
                ...prevSlots,
                [slotName]: widgets
            };

            // Publish to UDC using this widget's own componentId
            const updatedConfig = {
                ...config,
                slots: updatedSlots
            };

            if (publishUpdate) {
                // Publish using our own componentId (not parent's) so DataManager knows this widget changed
                publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                    id: widgetId,
                    config: updatedConfig,
                    slotName: props.slotName || 'main', // Parent slot where this widget lives
                    contextType,
                    // Include parent context for DataManager to propagate upward
                    parentComponentId,
                    // NEW: Path-based approach (supports infinite nesting)
                    widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
                }).catch(error => {
                    console.error('TwoColumnsWidget: Failed to update config:', error);
                });
            }

            return updatedSlots;
        });
    }, [config, publishUpdate, componentId, widgetId, contextType, props.slotName, parentComponentId, widgetPath]);

    // Get filtered widget types for slots
    const filteredWidgetTypes = getFilteredWidgetTypes();

    // Get grid classes based on layout style
    const getGridClasses = useCallback((layoutStyle) => {
        if (!layoutStyle) return 'md:grid-cols-2'

        // Generate CSS class name matching backend convention
        const ratioClass = `two-col-ratio-${layoutStyle.replace(/:/g, '-')}`

        // Also add Tailwind classes for immediate styling
        const ratioMap = {
            '5:1': 'md:grid-cols-[5fr_1fr]',
            '4:2': 'md:grid-cols-[2fr_1fr]',
            '3:3': 'md:grid-cols-2',
            '2:4': 'md:grid-cols-[1fr_2fr]',
            '1:5': 'md:grid-cols-[1fr_5fr]',
        }
        const tailwindClass = ratioMap[layoutStyle] || 'md:grid-cols-2'

        return `${ratioClass} ${tailwindClass}`
    }, [])

    // Render individual widget in a slot (for display mode)
    const renderWidget = useCallback((widget, slotName, index) => {
        // Create unique key for widget
        const uniqueKey = widget.id ? `${slotName}-${widget.id}-${index}` : `${slotName}-index-${index}`;

        // widgetPath already ends with this widget's ID from WidgetSlot
        // So we just need to add the slot name and nested widget ID
        const fullWidgetPath = [...widgetPath, slotName, widget.id];

        return (
            <div key={uniqueKey} className="widget-wrapper">
                <PageWidgetFactory
                    widget={widget}
                    slotName={slotName}
                    index={index}
                    mode="display"
                    showControls={false}
                    showPasteMarkers={true}
                    // Context props
                    parentComponentId={componentId}
                    contextType={contextType}
                    pageId={context.pageId}
                    webpageData={context.webpageData}
                    pageVersionData={context.pageVersionData}
                    versionId={context.versionId}
                    // Widget path for nested widget support
                    widgetPath={fullWidgetPath}
                    // Paste mode props
                    pasteModeActive={pasteModeActive}
                    onPasteAtPosition={onPasteAtPosition}
                />
            </div>
        );
    }, [widgetPath, componentId, contextType, context, pasteModeActive, onPasteAtPosition]);

    // Show loading state while fetching widget types
    if (mode === 'editor' && isLoadingTypes) {
        return (
            <div className="two-columns-widget-editor">
                <div className="columns-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-4 text-center text-gray-500">Loading widget types...</div>
                    <div className="p-4 text-center text-gray-500">Loading widget types...</div>
                </div>
            </div>
        );
    }

    // Show error state if widget types failed to load
    if (mode === 'editor' && typesError) {
        return (
            <div className="two-columns-widget-editor">
                <div className="columns-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-4 text-center text-red-500">
                        Error loading widget types: {typesError.message}
                    </div>
                    <div className="p-4 text-center text-red-500">
                        Error loading widget types: {typesError.message}
                    </div>
                </div>
            </div>
        );
    }

    // In editor mode, show SlotEditor components with editable widgets
    if (mode === 'editor') {
        const layoutStyle = config.layoutStyle || config.layout_style || '3:3'
        const gridClasses = getGridClasses(layoutStyle)

        return (
            <div className={`grid grid-cols-1 ${gridClasses} gap-4 w-full mb-4`}>
                <div className="two-col-slot left min-h-[50px]">
                    <SlotEditor
                        slotName="left"
                        slotLabel="Left Column"
                        widgets={slotsData.left || []}
                        availableWidgetTypes={filteredWidgetTypes}
                        parentWidgetId={widgetId}
                        contextType={contextType}
                        onWidgetEdit={onWidgetEdit}
                        onOpenWidgetEditor={onOpenWidgetEditor}
                        onSlotChange={handleSlotChange}
                        parentComponentId={parentComponentId}
                        parentSlotName={slotName}
                        widgetPath={widgetPath} // Pass path to nested widgets
                        emptyMessage="No widgets in left column"
                        className=""
                        mode="editor" // Explicitly pass editor mode
                        // Selection props
                        selectedWidgets={selectedWidgets}
                        cutWidgets={cutWidgets}
                        onToggleWidgetSelection={onToggleWidgetSelection}
                        isWidgetSelected={isWidgetSelected}
                        isWidgetCut={isWidgetCut}
                        onDeleteCutWidgets={onDeleteCutWidgets}
                        buildWidgetPath={buildWidgetPath}
                        parseWidgetPath={parseWidgetPath}
                        showClearButton={false} // Hide Clear Slot button
                        compactAddButton={true} // Show just + icon
                        // Paste mode props
                        pasteModeActive={pasteModeActive}
                        onPasteAtPosition={onPasteAtPosition}
                    />
                </div>
                <div className="two-col-slot right min-h-[50px]">
                    <SlotEditor
                        slotName="right"
                        slotLabel="Right Column"
                        widgets={slotsData.right || []}
                        availableWidgetTypes={filteredWidgetTypes}
                        parentWidgetId={widgetId}
                        contextType={contextType}
                        onWidgetEdit={onWidgetEdit}
                        onOpenWidgetEditor={onOpenWidgetEditor}
                        onSlotChange={handleSlotChange}
                        parentComponentId={parentComponentId}
                        parentSlotName={slotName}
                        widgetPath={widgetPath} // Pass path to nested widgets
                        emptyMessage="No widgets in right column"
                        className=""
                        mode="editor" // Explicitly pass editor mode
                        // Selection props
                        selectedWidgets={selectedWidgets}
                        cutWidgets={cutWidgets}
                        onToggleWidgetSelection={onToggleWidgetSelection}
                        isWidgetSelected={isWidgetSelected}
                        // Paste mode props
                        pasteModeActive={pasteModeActive}
                        onPasteAtPosition={onPasteAtPosition}
                        isWidgetCut={isWidgetCut}
                        onDeleteCutWidgets={onDeleteCutWidgets}
                        buildWidgetPath={buildWidgetPath}
                        parseWidgetPath={parseWidgetPath}
                        showClearButton={false} // Hide Clear Slot button
                        compactAddButton={true} // Show just + icon
                        // Selection props
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
        );
    }

    // Check if using component style with Mustache template
    const componentStyle = config.componentStyle || 'default';
    const useCustomStyle = componentStyle && componentStyle !== 'default' && currentTheme?.componentStyles;

    if (useCustomStyle) {
        const style = currentTheme.componentStyles[componentStyle];

        if (style) {
            try {
                // Check for passthru mode
                const isPassthru = style.template?.trim() === '{{passthru}}';

                if (!isPassthru) {
                    // Prepare context for Mustache rendering
                    const mustacheContext = prepareComponentContext(
                        '', // No content for two columns
                        '',
                        style.variables || {},
                        config
                    );

                    // Use ComponentStyleRenderer for consistent scoped rendering
                    const styleId = `two-columns-${widgetId || 'preview'}-${componentStyle}`;

                    return (
                        <ComponentStyleRenderer
                            template={style.template}
                            context={mustacheContext}
                            css={style.css}
                            styleId={styleId}
                            className=""
                        />
                    );
                }

                // Passthru mode: render default with custom CSS
                const styleId = `two-columns-${widgetId || 'preview'}-${componentStyle}`;

                return (
                    <div data-style-id={styleId}>
                        {style.css && <style>{`[data-style-id="${styleId}"] { ${style.css} }`}</style>}
                        {renderDefaultTwoColumns()}
                    </div>
                );
            } catch (error) {
                console.error('Error rendering custom component style:', error);
                return (
                    <div>
                        <div className="text-red-500 text-sm p-2">Error rendering custom style</div>
                    </div>
                );
            }
        }
    }

    // Default rendering helper function
    function renderDefaultTwoColumns() {
        const layoutStyle = config.layoutStyle || config.layout_style || '3:3'
        const gridClasses = getGridClasses(layoutStyle)

        return (
            <div className={`grid grid-cols-1 ${gridClasses} gap-4 w-full mb-4`}>
                <div className="two-col-slot left min-h-[50px]">
                    {slotsData.left && slotsData.left.length > 0 ? (
                        slotsData.left.map((widget, index) => renderWidget(widget, 'left', index))
                    ) : (
                        <div className="p-4 text-center text-gray-400">Left column</div>
                    )}
                </div>
                <div className="two-col-slot right min-h-[50px]">
                    {slotsData.right && slotsData.right.length > 0 ? (
                        slotsData.right.map((widget, index) => renderWidget(widget, 'right', index))
                    ) : (
                        <div className="p-4 text-center text-gray-400">Right column</div>
                    )}
                </div>
            </div>
        );
    }

    // In display mode, render the default two columns
    return renderDefaultTwoColumns();
};

TwoColumnsWidget.propTypes = {
    config: PropTypes.shape({
        slots: PropTypes.shape({
            left: PropTypes.array,
            right: PropTypes.array
        })
    }),
    mode: PropTypes.oneOf(['display', 'editor']),
    widgetId: PropTypes.string,
    onWidgetEdit: PropTypes.func,
    onOpenWidgetEditor: PropTypes.func,
    contextType: PropTypes.oneOf(['page', 'object']),
    parentComponentId: PropTypes.string
};

TwoColumnsWidget.displayName = 'ECEEE Two Columns';
TwoColumnsWidget.widgetType = 'easy_widgets.TwoColumnsWidget';
TwoColumnsWidget.description = 'ECEEE-specific two-column layout with left and right slots for widgets';

// Define slot configuration for the editor
TwoColumnsWidget.slotConfiguration = {
    slots: [
        {
            name: "left",
            label: "Left Column",
            description: "Widgets in the left column",
            maxWidgets: null,
            required: false
        },
        {
            name: "right",
            label: "Right Column",
            description: "Widgets in the right column",
            maxWidgets: null,
            required: false
        }
    ]
};

TwoColumnsWidget.defaultConfig = {
    layoutStyle: '3:3',
    slots: { left: [], right: [] }
};

TwoColumnsWidget.metadata = {
    name: 'Two Columns',
    description: 'EASY-specific two-column layout with left and right slots',
    category: 'layout',
    icon: null,
    tags: ['layout', 'columns', 'container'],
    menuItems: []
};

export default TwoColumnsWidget;
