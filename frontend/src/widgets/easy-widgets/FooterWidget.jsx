/**
 * Footer Widget Component
 * 
 * Simple footer container with content slot and background styling.
 * Widget type: easy_widgets.FooterWidget
 */

import React, { useState, useCallback, useMemo } from 'react';
import SlotEditor from '../../components/editors/SlotEditor';
import PageWidgetFactory from '../../editors/page-editor/PageWidgetFactory';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { OperationTypes } from '../../contexts/unified-data/types/operations';
import { useWidgets } from '../../hooks/useWidgets';
import PropTypes from 'prop-types';

const FooterWidget = ({
    config = {},
    mode = 'display',
    widgetId,
    onWidgetEdit,
    onOpenWidgetEditor,
    contextType = 'page',
    parentComponentId,
    slotName,
    widgetPath = [],
    context = {},
    // Selection props
    selectedWidgets,
    cutWidgets,
    onToggleWidgetSelection,
    isWidgetSelected,
    isWidgetCut,
    onDeleteCutWidgets,
    buildWidgetPath,
    parseWidgetPath,
    // Paste mode props
    pasteModeActive = false,
    onPasteAtPosition,
    ...props
}) => {
    // Create this widget's own UDC componentId
    const componentId = useMemo(() => {
        if (widgetPath && widgetPath.length > 0) {
            return `footer-${widgetPath.join('-')}`;
        }
        return `footer-${widgetId || 'unknown'}`;
    }, [widgetId, widgetPath]);

    const { publishUpdate } = useUnifiedData(componentId);
    const { getFilteredWidgetTypes: getWidgetTypes } = useWidgets();

    // Initialize slots data from config
    const [slotsData, setSlotsData] = useState(
        config.slots || { content: [] }
    );

    // Sync slotsData when config.slots changes externally
    React.useEffect(() => {
        if (config.slots) {
            setSlotsData(config.slots);
        }
    }, [config.slots]);

    // Handle slot changes - update local state first, then publish to UDC
    const handleSlotChange = useCallback(async (slotName, widgets) => {
        // Update local state immediately
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
                publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                    id: widgetId,
                    config: updatedConfig,
                    slotName: props.slotName || 'main',
                    contextType,
                    parentComponentId,
                    widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
                }).catch(error => {
                    console.error('FooterWidget: Failed to update config:', error);
                });
            }

            return updatedSlots;
        });
    }, [config, publishUpdate, componentId, widgetId, contextType, props.slotName, parentComponentId, widgetPath]);

    // Get filtered widget types for slots
    const filteredWidgetTypes = getWidgetTypes ? getWidgetTypes() : [];

    // Render individual widget in a slot (for display mode)
    const renderWidget = useCallback((widget, slotName, index) => {
        if (!widget || typeof widget !== 'object') {
            console.warn('FooterWidget: Invalid widget data', widget);
            return null;
        }

        // widgetPath already ends with this widget's ID from WidgetSlot
        // So we just need to add the slot name and nested widget ID
        const newWidgetPath = widgetPath ? [...widgetPath, slotName, widget.id] : [slotName, widget.id];

        return (
            <PageWidgetFactory
                key={widget.id || index}
                widget={widget}
                slotName={slotName}
                index={index}
                mode={mode}
                onEdit={onWidgetEdit}
                onOpenWidgetEditor={onOpenWidgetEditor}
                contextType={contextType}
                parentComponentId={componentId}
                widgetPath={newWidgetPath}
                selectedWidgets={selectedWidgets}
                cutWidgets={cutWidgets}
                onToggleWidgetSelection={onToggleWidgetSelection}
                isWidgetSelected={isWidgetSelected}
                isWidgetCut={isWidgetCut}
                onDeleteCutWidgets={onDeleteCutWidgets}
                buildWidgetPath={buildWidgetPath}
                parseWidgetPath={parseWidgetPath}
                pasteModeActive={pasteModeActive}
                onPasteAtPosition={onPasteAtPosition}
            />
        );
    }, [
        widgetPath, mode, onWidgetEdit, onOpenWidgetEditor, contextType,
        componentId, selectedWidgets, cutWidgets, onToggleWidgetSelection,
        isWidgetSelected, isWidgetCut, onDeleteCutWidgets, buildWidgetPath,
        parseWidgetPath, pasteModeActive, onPasteAtPosition
    ]);

    // Build footer styles
    const footerStyle = {};

    if (config.backgroundColor) {
        footerStyle.backgroundColor = config.backgroundColor;
    }
    if (config.backgroundImage) {
        footerStyle.backgroundImage = `url(${config.backgroundImage})`;
        footerStyle.backgroundSize = 'cover';
        footerStyle.backgroundPosition = 'center';
    }
    if (config.textColor) {
        footerStyle.color = config.textColor;
    }

    // In editor mode, show SlotEditor
    if (mode === 'editor') {
        const widgets = slotsData.content || [];

        return (
            <div className="footer-widget border border-gray-200 mb-4" style={footerStyle}>
                <div className="p-1">
                    <SlotEditor
                        slotName="content"
                        slotLabel="Footer Content"
                        widgets={widgets}
                        availableWidgetTypes={filteredWidgetTypes}
                        parentWidgetId={widgetId}
                        contextType={contextType}
                        onWidgetEdit={onWidgetEdit}
                        onOpenWidgetEditor={onOpenWidgetEditor}
                        onSlotChange={handleSlotChange}
                        parentComponentId={parentComponentId}
                        selectedWidgets={selectedWidgets}
                        cutWidgets={cutWidgets}
                        onToggleWidgetSelection={onToggleWidgetSelection}
                        isWidgetSelected={isWidgetSelected}
                        isWidgetCut={isWidgetCut}
                        onDeleteCutWidgets={onDeleteCutWidgets}
                        buildWidgetPath={buildWidgetPath}
                        parseWidgetPath={parseWidgetPath}
                        parentSlotName={slotName}
                        pasteModeActive={pasteModeActive}
                        onPasteAtPosition={onPasteAtPosition}
                        widgetPath={widgetPath}
                        emptyMessage="No content in footer"
                        className="[&_.slot-editor]:!p-0"
                        mode="editor"
                        showClearButton={false}
                        compactAddButton={true}
                    />
                </div>
            </div>
        );
    }

    // Display mode - simple rendering
    const contentWidgets = slotsData.content || [];

    return (
        <footer
            className="footer-widget widget-type-easy-widgets-footerwidget cms-content"
            style={footerStyle}
        >
            {contentWidgets.length > 0 ? (
                contentWidgets
                    .filter(widget => widget && typeof widget === 'object')
                    .map((widget, index) =>
                        renderWidget(widget, 'content', index)
                    )
            ) : (
                <div className="empty-slot">
                    Footer content will appear here
                </div>
            )}
        </footer>
    );
};

FooterWidget.propTypes = {
    config: PropTypes.shape({
        backgroundColor: PropTypes.string,
        backgroundImage: PropTypes.string,
        textColor: PropTypes.string,
        slots: PropTypes.shape({
            content: PropTypes.array
        })
    }),
    mode: PropTypes.oneOf(['display', 'editor']),
    widgetId: PropTypes.string,
    onWidgetEdit: PropTypes.func,
    onOpenWidgetEditor: PropTypes.func,
    contextType: PropTypes.oneOf(['page', 'object']),
    parentComponentId: PropTypes.string
};

FooterWidget.displayName = 'Footer';
FooterWidget.widgetType = 'easy_widgets.FooterWidget';
FooterWidget.description = 'Footer container with content slot and background styling options';

// Define slot configuration for the editor
FooterWidget.slotConfiguration = {
    slots: [
        {
            name: "content",
            label: "Footer Content",
            description: "Widgets within the footer",
            maxWidgets: null,
            required: false
        }
    ]
};

FooterWidget.defaultConfig = {
    backgroundColor: null,
    backgroundImage: null,
    textColor: null,
    slots: { content: [] }
};

FooterWidget.metadata = {
    name: 'Footer',
    description: 'Footer container with content slot and background styling options',
    category: 'layout',
    icon: null,
    tags: ['layout', 'footer', 'container'],
    menuItems: []
};

export default FooterWidget;
