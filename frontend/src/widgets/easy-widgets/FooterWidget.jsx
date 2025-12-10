/**
 * Footer Widget Component
 * 
 * Simple footer container with content slot and background styling.
 * Widget type: easy_widgets.FooterWidget
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Layers } from 'lucide-react';
import SlotEditor from '../../components/editors/SlotEditor';
import PageWidgetFactory from '../../editors/page-editor/PageWidgetFactory';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { OperationTypes } from '../../contexts/unified-data/types/operations';
import { useWidgets } from '../../hooks/useWidgets';
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure';
import MediaSelectModal from '../../components/media/MediaSelectModal';
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

    // Background image state
    const [backgroundUrl, setBackgroundUrl] = useState('');
    const [imageLoading, setImageLoading] = useState(false);
    
    // State for image edit modal
    const [showImageModal, setShowImageModal] = useState(false);
    const [editingField, setEditingField] = useState(null);

    // Sync slotsData when config.slots changes externally
    React.useEffect(() => {
        if (config.slots) {
            setSlotsData(config.slots);
        }
    }, [config.slots]);

    // Load optimized background image URL from backend API
    useEffect(() => {
        const loadBackgroundImage = async () => {
            const image = config.backgroundImage;
            if (!image) {
                setBackgroundUrl('');
                return;
            }

            setImageLoading(true);

            try {
                // Large footer background size (1920x400)
                const url = await getImgproxyUrlFromImage(image, {
                    width: 1920,
                    height: 400,
                    resizeType: 'fill'
                });
                setBackgroundUrl(url);
            } catch (error) {
                console.error('Failed to load optimized footer background image:', error);
            } finally {
                setImageLoading(false);
            }
        };

        loadBackgroundImage();
    }, [config.backgroundImage]);

    // Image change handler for quick edit
    const handleImageChange = useCallback((fieldName, newImage) => {
        const updatedConfig = { ...config, [fieldName]: newImage };
        publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            config: updatedConfig,
            widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
            slotName: slotName,
            contextType: contextType
        });
    }, [componentId, widgetId, slotName, publishUpdate, contextType, widgetPath, config]);

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
                pageId={context.pageId}
                webpageData={context.webpageData}
                pageVersionData={context.pageVersionData}
                versionId={context.versionId}
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
        componentId, context, selectedWidgets, cutWidgets, onToggleWidgetSelection,
        isWidgetSelected, isWidgetCut, onDeleteCutWidgets, buildWidgetPath,
        parseWidgetPath, pasteModeActive, onPasteAtPosition
    ]);

    // Build footer styles
    const footerStyle = {};

    if (config.backgroundColor) {
        footerStyle.backgroundColor = config.backgroundColor;
    }
    if (config.backgroundImage && backgroundUrl) {
        footerStyle.backgroundImage = `url('${backgroundUrl}')`;
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
            <div className="footer-widget border border-gray-200 mb-4 relative group" style={footerStyle}>
                {/* Background image edit icon */}
                <button
                    onClick={() => {
                        setEditingField('backgroundImage');
                        setShowImageModal(true);
                    }}
                    className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Edit background image"
                >
                    <Layers className="w-5 h-5 text-gray-700" />
                </button>
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
                {/* Media Insert Modal */}
                {showImageModal && (
                    <MediaSelectModal
                        isOpen={showImageModal}
                        onClose={() => {
                            setShowImageModal(false);
                            setEditingField(null);
                        }}
                        onSelect={(selectedItems) => {
                            if (selectedItems === null) {
                                // Handle remove - set to null
                                handleImageChange(editingField, null);
                            } else if (selectedItems && selectedItems.length > 0) {
                                handleImageChange(editingField, selectedItems[0]);
                            }
                            setShowImageModal(false);
                            setEditingField(null);
                        }}
                        mediaTypes={['image']}
                        allowCollections={false}
                        currentSelection={backgroundImage}
                        namespace={context?.namespace}
                        pageId={context?.pageId}
                        customTitle="Edit Footer Background Image"
                    />
                )}
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
