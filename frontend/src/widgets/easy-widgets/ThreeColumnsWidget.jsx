/**
 * ECEEE Three-Column Widget Component
 * 
 * ECEEE-specific three-column layout with left, center, and right slots.
 * Widget type: easy_widgets.ThreeColumnsWidget
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import SlotEditor from '../../components/editors/SlotEditor';
import PageWidgetFactory from '../../editors/page-editor/PageWidgetFactory';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { OperationTypes } from '../../contexts/unified-data/types/operations';
import { useWidgets } from '../../hooks/useWidgets';
import PropTypes from 'prop-types';

const ThreeColumnsWidget = ({
    config = {},
    mode = 'display',
    widgetId,
    onWidgetEdit,
    onOpenWidgetEditor,
    contextType = 'page',
    parentComponentId,
    slotName,
    widgetPath = [],
    context = {}, // Full context including page data
    ...props
}) => {
    // Create this widget's own UDC componentId
    const componentId = useMemo(() => {
        return `three-columns-widget-${widgetId}`;
    }, [widgetId]);

    // Get UDC functions
    const { useExternalChanges, publishUpdate } = useUnifiedData();

    // Get all available widget types from the system
    const { widgetTypes, isLoadingTypes, typesError } = useWidgets();

    // Local state management for slots data
    const [slotsData, setSlotsData] = useState(() => {
        return config.slots || { left: [], center: [], right: [] };
    });

    // Track the widget ID to detect when we're rendering a different widget
    const previousWidgetIdRef = useRef(widgetId);

    // Only update from props when widgetId changes (different widget) or on mount
    useEffect(() => {
        if (previousWidgetIdRef.current !== widgetId) {
            setSlotsData(config.slots || { left: [], center: [], right: [] });
            previousWidgetIdRef.current = widgetId;
        }
    }, [widgetId, config.slots]);

    // Subscribe to external UDC changes for this specific widget
    useExternalChanges(componentId, (state) => {
        let version = null;
        if (contextType === 'page') {
            version = state.versions?.[state.metadata?.currentVersionId];
        } else if (contextType === 'object') {
            const objectId = state.metadata?.currentObjectId;
            version = state.objects?.[objectId];
        }

        if (!version) return;

        // Find this ThreeColumnsWidget in the widgets tree using widgetPath
        let containerWidget = null;
        if (widgetPath && widgetPath.length >= 2) {
            const topSlot = widgetPath[0];
            const widgets = version.widgets?.[topSlot] || [];

            let current = widgets;
            for (let i = 1; i < widgetPath.length; i += 2) {
                const targetId = widgetPath[i];
                const widget = current.find(w => w.id === targetId);
                if (!widget) break;

                if (widget.id === widgetId) {
                    containerWidget = widget;
                    break;
                }

                const nextSlot = widgetPath[i + 1];
                if (nextSlot && widget.config?.slots) {
                    current = widget.config.slots[nextSlot] || [];
                }
            }
        } else {
            const slotWidgets = version.widgets?.[slotName] || [];
            containerWidget = slotWidgets.find(w => w.id === widgetId);
        }

        if (containerWidget && containerWidget.config?.slots) {
            const newSlots = containerWidget.config.slots;
            setSlotsData(prevSlots => {
                if (JSON.stringify(prevSlots) !== JSON.stringify(newSlots)) {
                    return newSlots;
                }
                return prevSlots;
            });
        }
    });

    // Filter widget types for container slots
    const getFilteredWidgetTypes = useCallback(() => {
        if (!widgetTypes || !Array.isArray(widgetTypes)) return [];

        return widgetTypes
            .filter(widget => {
                const excludedTypes = [
                    'layout.full-width',
                    'navigation.main-nav',
                    'system.header',
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

    // Handle slot changes
    const handleSlotChange = useCallback(async (slotName, widgets) => {
        setSlotsData(prevSlots => {
            const updatedSlots = {
                ...prevSlots,
                [slotName]: widgets
            };

            const updatedConfig = {
                ...config,
                slots: updatedSlots
            };

            if (publishUpdate) {
                publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                    id: widgetId,
                    config: updatedConfig,
                    slotName: props.slotName || 'main',
                    contextType,
                    parentComponentId,
                    widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
                }).catch(error => {
                    console.error('ThreeColumnsWidget: Failed to update config:', error);
                });
            }

            return updatedSlots;
        });
    }, [config, publishUpdate, componentId, widgetId, contextType, props.slotName, parentComponentId, widgetPath]);

    // Get filtered widget types for slots
    const filteredWidgetTypes = getFilteredWidgetTypes();

    // Render individual widget in a slot (for display mode)
    const renderWidget = useCallback((widget, slotName, index) => {
        const uniqueKey = widget.id ? `${slotName}-${widget.id}-${index}` : `${slotName}-index-${index}`;
        const fullWidgetPath = [...widgetPath, widgetId, slotName, widget.id];

        return (
            <div key={uniqueKey} className="widget-wrapper">
                <PageWidgetFactory
                    widget={widget}
                    slotName={slotName}
                    index={index}
                    mode="display"
                    showControls={false}
                    parentComponentId={componentId}
                    contextType={contextType}
                    pageId={context.pageId}
                    webpageData={context.webpageData}
                    pageVersionData={context.pageVersionData}
                    versionId={context.versionId}
                    widgetPath={fullWidgetPath}
                />
            </div>
        );
    }, [widgetPath, widgetId, componentId, contextType, context]);

    // Show loading state
    if (mode === 'editor' && isLoadingTypes) {
        return (
            <div className="three-columns-widget-editor">
                <div className="columns-grid grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="p-4 text-center text-gray-500">Loading...</div>
                    <div className="p-4 text-center text-gray-500">Loading...</div>
                    <div className="p-4 text-center text-gray-500">Loading...</div>
                </div>
            </div>
        );
    }

    // Show error state
    if (mode === 'editor' && typesError) {
        return (
            <div className="three-columns-widget-editor">
                <div className="columns-grid grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="p-4 text-center text-red-500">Error: {typesError.message}</div>
                    <div className="p-4 text-center text-red-500">Error: {typesError.message}</div>
                    <div className="p-4 text-center text-red-500">Error: {typesError.message}</div>
                </div>
            </div>
        );
    }

    // In editor mode, show SlotEditor components
    if (mode === 'editor') {
        return (
            <div className="three-columns-widget-editor">
                <div className="columns-grid grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                        widgetPath={widgetPath}
                        emptyMessage="No widgets in left column"
                        className=""
                        mode="editor"
                        showClearButton={false}
                        compactAddButton={true}
                    />

                    <SlotEditor
                        slotName="center"
                        slotLabel="Center Column"
                        widgets={slotsData.center || []}
                        availableWidgetTypes={filteredWidgetTypes}
                        parentWidgetId={widgetId}
                        contextType={contextType}
                        onWidgetEdit={onWidgetEdit}
                        onOpenWidgetEditor={onOpenWidgetEditor}
                        onSlotChange={handleSlotChange}
                        parentComponentId={parentComponentId}
                        parentSlotName={slotName}
                        widgetPath={widgetPath}
                        emptyMessage="No widgets in center column"
                        className=""
                        mode="editor"
                        showClearButton={false}
                        compactAddButton={true}
                    />

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
                        widgetPath={widgetPath}
                        emptyMessage="No widgets in right column"
                        className=""
                        mode="editor"
                        showClearButton={false}
                        compactAddButton={true}
                    />
                </div>
            </div>
        );
    }

    // In display mode, render the widgets in each slot
    return (
        <div className="three-columns-widget">
            <div className="column-slot left" data-slot="left">
                {slotsData.left && slotsData.left.length > 0 ? (
                    slotsData.left.map((widget, index) => renderWidget(widget, 'left', index))
                ) : (
                    <div className="empty-slot">Left column</div>
                )}
            </div>

            <div className="column-slot center" data-slot="center">
                {slotsData.center && slotsData.center.length > 0 ? (
                    slotsData.center.map((widget, index) => renderWidget(widget, 'center', index))
                ) : (
                    <div className="empty-slot">Center column</div>
                )}
            </div>

            <div className="column-slot right" data-slot="right">
                {slotsData.right && slotsData.right.length > 0 ? (
                    slotsData.right.map((widget, index) => renderWidget(widget, 'right', index))
                ) : (
                    <div className="empty-slot">Right column</div>
                )}
            </div>
        </div>
    );
};

ThreeColumnsWidget.propTypes = {
    config: PropTypes.shape({
        slots: PropTypes.shape({
            left: PropTypes.array,
            center: PropTypes.array,
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

ThreeColumnsWidget.displayName = 'ECEEE Three Columns';
ThreeColumnsWidget.widgetType = 'easy_widgets.ThreeColumnsWidget';
ThreeColumnsWidget.description = 'ECEEE-specific three-column layout with left, center, and right slots';

// Define slot configuration for the editor
ThreeColumnsWidget.slotConfiguration = {
    slots: [
        {
            name: "left",
            label: "Left Column",
            description: "Widgets in the left column",
            maxWidgets: null,
            required: false
        },
        {
            name: "center",
            label: "Center Column",
            description: "Widgets in the center column",
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

ThreeColumnsWidget.defaultConfig = {
    layout_style: null,
    slots: { left: [], center: [], right: [] }
};

ThreeColumnsWidget.metadata = {
    name: 'ECEEE Three Columns',
    description: 'ECEEE-specific three-column layout with left, center, and right slots',
    category: 'layout',
    icon: null,
    tags: ['layout', 'columns', 'container', 'eceee', 'three-column'],
    menuItems: []
};

export default ThreeColumnsWidget;

