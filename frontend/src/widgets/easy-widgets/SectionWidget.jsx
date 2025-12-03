/**
 * Section Widget Component
 * 
 * Collapsible section with anchor support and internal content slot.
 * Widget type: easy_widgets.SectionWidget
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

// Simple slugify function for anchor generation
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-')   // Replace multiple - with single -
        .replace(/^-+/, '')       // Trim - from start of text
        .replace(/-+$/, '');      // Trim - from end of text
};

const SectionWidget = ({
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
        return `section-widget-${widgetId}`;
    }, [widgetId]);

    // Get UDC functions
    const { useExternalChanges, publishUpdate } = useUnifiedData();

    // Get all available widget types from the system
    const { widgetTypes, isLoadingTypes, typesError } = useWidgets();

    // Get current theme for component styles
    const { currentTheme } = useTheme({ pageId: context.pageId });

    // Local state management for slots data and collapse state
    const [slotsData, setSlotsData] = useState(() => {
        return config.slots || { content: [] };
    });

    const [isExpanded, setIsExpanded] = useState(() => {
        return config.startExpanded !== false; // Default to true
    });

    // Track the widget ID to detect when we're rendering a different widget
    const previousWidgetIdRef = useRef(widgetId);

    // Only update from props when widgetId changes (different widget) or on mount
    useEffect(() => {
        if (previousWidgetIdRef.current !== widgetId) {
            // Different widget - reinitialize from config
            setSlotsData(config.slots || { content: [] });
            setIsExpanded(config.startExpanded !== false);
            previousWidgetIdRef.current = widgetId;
        }
    }, [widgetId, config.slots, config.startExpanded]);

    // Auto-generate anchor from title when title changes
    useEffect(() => {
        if (mode === 'editor' && config.title && !config.anchor && onWidgetEdit) {
            const newAnchor = slugify(config.title);
            if (newAnchor) {
                // Update config with generated anchor
                onWidgetEdit({
                    ...config,
                    anchor: newAnchor
                });
            }
        }
    }, [config.title, config.anchor, mode, onWidgetEdit]);

    // Handle inline editing of title
    const handleTitleClick = useCallback((e) => {
        e.stopPropagation();
        const newTitle = prompt('Enter section title:', config.title || '');
        if (newTitle !== null && onWidgetEdit) {
            onWidgetEdit({
                ...config,
                title: newTitle,
                anchor: newTitle ? slugify(newTitle) : config.anchor
            });
        }
    }, [config, onWidgetEdit]);

    // Handle inline editing of anchor
    const handleAnchorClick = useCallback((e) => {
        e.stopPropagation();
        const newAnchor = prompt('Enter section anchor/slug:', config.anchor || '');
        if (newAnchor !== null && onWidgetEdit) {
            onWidgetEdit({
                ...config,
                anchor: newAnchor ? slugify(newAnchor) : newAnchor
            });
        }
    }, [config, onWidgetEdit]);

    // Subscribe to external UDC changes for this specific widget
    useExternalChanges(componentId, (state) => {
        // When UDC state changes, look for updates to our widget's config
        let version = null;
        if (contextType === 'page') {
            version = state.versions?.[state.metadata?.currentVersionId];
        } else if (contextType === 'object') {
            const objectId = state.metadata?.currentObjectId;
            version = state.objects?.[objectId];
        }

        if (!version) return;

        // Find this SectionWidget in the widgets tree using widgetPath
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
    const getFilteredWidgetTypes = useCallback(() => {
        if (!widgetTypes || !Array.isArray(widgetTypes)) return [];

        return widgetTypes
            .filter(widget => {
                // Exclude widgets that shouldn't be in container slots
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
                publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                    id: widgetId,
                    config: updatedConfig,
                    slotName: props.slotName || 'main',
                    contextType,
                    parentComponentId,
                    widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
                }).catch(error => {
                    console.error('SectionWidget: Failed to update config:', error);
                });
            }

            return updatedSlots;
        });
    }, [config, publishUpdate, componentId, widgetId, contextType, props.slotName, parentComponentId, widgetPath]);

    // Toggle collapse/expand state
    const toggleSection = useCallback(() => {
        if (config.enableCollapse) {
            setIsExpanded(prev => !prev);
        }
    }, [config.enableCollapse]);

    // Get filtered widget types for slots
    const filteredWidgetTypes = getFilteredWidgetTypes();

    // Render individual widget in a slot (for display mode)
    const renderWidget = useCallback((widget, slotName, index) => {
        const uniqueKey = widget.id ? `${slotName}-${widget.id}-${index}` : `${slotName}-index-${index}`;
        // widgetPath already ends with this widget's ID from WidgetSlot
        const fullWidgetPath = [...widgetPath, slotName, widget.id];

        return (
            <>
                <PageWidgetFactory
                    widget={widget}
                    slotName={slotName}
                    index={index}
                    mode="display"
                    showControls={false}
                    showPasteMarkers={true}
                    parentComponentId={componentId}
                    contextType={contextType}
                    pageId={context.pageId}
                    webpageData={context.webpageData}
                    pageVersionData={context.pageVersionData}
                    versionId={context.versionId}
                    widgetPath={fullWidgetPath}
                    pasteModeActive={pasteModeActive}
                    onPasteAtPosition={onPasteAtPosition}
                />
            </>
        );
    }, [widgetPath, componentId, contextType, context, pasteModeActive, onPasteAtPosition]);

    // Show loading state while fetching widget types
    if (mode === 'editor' && isLoadingTypes) {
        return (
            <div className="section-widget">
                <div className="p-4 text-center text-gray-500">Loading widget types...</div>
            </div>
        );
    }

    // Show error state if widget types failed to load
    if (mode === 'editor' && typesError) {
        return (
            <div className="section-widget">
                <div className="p-4 text-center text-red-500">
                    Error loading widget types: {typesError.message}
                </div>
            </div>
        );
    }

    // Build custom slot label with editable title and anchor - render as JSX element
    const slotLabel = (
        <div className="flex items-center space-x-2">
            <span>Section</span>
            {config.title && (
                <>
                    <span className="text-gray-400">•</span>
                    <span>{config.title}</span>
                </>
            )}
            {config.anchor && (
                <>
                    <span className="text-gray-400">•</span>
                    <span className="font-mono">#{config.anchor}</span>
                </>
            )}
            {config.enableCollapse && (
                <>
                    <span className="text-gray-400">•</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleSection();
                        }}
                        className="text-gray-600 hover:text-gray-900 transition-transform"
                        title={isExpanded ? 'Collapse section' : 'Expand section'}
                    >
                        <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            ▶
                        </span>
                    </button>
                </>
            )}
        </div>
    );

    // In editor mode, show SlotEditor with custom header
    if (mode === 'editor') {
        const widgets = slotsData.content || [];

        return (
            <div className={`section-widget border border-gray-200 mb-4 ${config.enableCollapse && !isExpanded ? 'collapsed' : ''}`}>
                <div className="p-4">
                    <SlotEditor
                        slotName="content"
                        slotLabel={slotLabel}
                        widgets={widgets}
                        availableWidgetTypes={filteredWidgetTypes}
                        parentWidgetId={widgetId}
                        contextType={contextType}
                        onWidgetEdit={onWidgetEdit}
                        onOpenWidgetEditor={onOpenWidgetEditor}
                        onSlotChange={handleSlotChange}
                        parentComponentId={parentComponentId}
                        // Selection props
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
                        emptyMessage="No content in section"
                        className={`[&_.slot-editor]:!p-0 ${config.enableCollapse && !isExpanded ? '[&_.widgets-list]:hidden' : ''}`}
                        mode="editor"
                        showClearButton={false}
                        compactAddButton={true}
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
                        '', // No content for section
                        config.anchor || '',
                        style.variables || {},
                        config
                    );

                    // Add section specific context
                    mustacheContext.title = config.title || '';
                    mustacheContext.enableCollapse = config.enableCollapse || false;
                    mustacheContext.isExpanded = isExpanded;

                    // Use ComponentStyleRenderer for consistent scoped rendering
                    const styleId = `section-${widgetId || 'preview'}-${componentStyle}`;

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
                const styleId = `section-${widgetId || 'preview'}-${componentStyle}`;

                return (
                    <div data-style-id={styleId}>
                        {style.css && <style>{`[data-style-id="${styleId}"] { ${style.css} }`}</style>}
                        {renderDefaultSection()}
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
    function renderDefaultSection() {
        const hasContent = slotsData.content && slotsData.content.length > 0;
        const isCollapsed = config.enableCollapse && !isExpanded;

        return (
            <div className={`section-widget mb-6 ${isCollapsed ? 'section-collapsed' : ''}`}
                data-section-id={config.anchor || ''}
                data-accordion-mode={config.accordionMode ? 'true' : 'false'}>
                {config.title && (
                    <div className="section-header p-4 font-semibold text-xl"
                        id={config.anchor}>
                        {config.title}
                    </div>
                )}
                <div className="section-content px-4 pb-4">
                    {hasContent ? (
                        <>
                            {/* First widget - always visible */}
                            {renderWidget(slotsData.content[0], 'content', 0)}

                            {config.enableCollapse && (
                                <>
                                    {/* Remaining widgets - animated expand/collapse */}
                                    <div className="section-remaining-content block section-collapsed:hidden">
                                        {slotsData.content.slice(1).map((widget, index) => renderWidget(widget, 'content', index + 1))}
                                    </div>

                                    {/* Expand banner - shown when collapsed */}
                                    <div
                                        className="section-banner expand-banner hidden section-collapsed:flex items-center justify-center p-4 mt-4 border-t border-gray-300 cursor-pointer select-none transition-opacity hover:opacity-80 font-medium"
                                        onClick={toggleSection}
                                        style={{
                                            backgroundColor: config.bannerBgColor || '#f3f4f6',
                                            color: config.bannerTextColor || '#374151'
                                        }}
                                    >
                                        <span>{config.expandText || 'Expand to read more'}</span>
                                    </div>

                                    {/* Contract banner - shown when expanded */}
                                    <div
                                        className="section-banner contract-banner flex section-collapsed:hidden items-center justify-center p-4 mt-4 border-t border-gray-300 cursor-pointer select-none transition-opacity hover:opacity-80 font-medium"
                                        onClick={toggleSection}
                                        style={{
                                            backgroundColor: config.bannerBgColor || '#f3f4f6',
                                            color: config.bannerTextColor || '#374151'
                                        }}
                                    >
                                        <span>{config.contractText || 'Show less'}</span>
                                    </div>
                                </>
                            )}

                            {!config.enableCollapse && (
                                /* No collapse enabled - show all widgets without banner */
                                slotsData.content.slice(1).map((widget, index) => renderWidget(widget, 'content', index + 1))
                            )}
                        </>
                    ) : (
                        <div className="text-center text-gray-400">Section content</div>
                    )}
                </div>
            </div>
        );
    }

    // In display mode, render the default section
    return renderDefaultSection();
};

SectionWidget.propTypes = {
    config: PropTypes.shape({
        title: PropTypes.string,
        anchor: PropTypes.string,
        enableCollapse: PropTypes.bool,
        startExpanded: PropTypes.bool,
        accordionMode: PropTypes.bool,
        componentStyle: PropTypes.string,
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

SectionWidget.displayName = 'Section';
SectionWidget.widgetType = 'easy_widgets.SectionWidget';
SectionWidget.description = 'Collapsible section with anchor support and internal content slot';

// Define slot configuration for the editor
SectionWidget.slotConfiguration = {
    slots: [
        {
            name: "content",
            label: "Section Content",
            description: "Widgets within the section",
            maxWidgets: null,
            required: false
        }
    ]
};

SectionWidget.defaultConfig = {
    title: '',
    anchor: null,
    enableCollapse: false,
    startExpanded: true,
    accordionMode: false,
    expandText: 'Expand to read more',
    contractText: 'Show less',
    bannerBgColor: '#f3f4f6',
    bannerTextColor: '#374151',
    componentStyle: 'default',
    slots: { content: [] }
};

SectionWidget.metadata = {
    name: 'Section',
    description: 'Collapsible section with anchor support and internal content slot',
    category: 'layout',
    icon: null,
    tags: ['layout', 'section', 'collapsible', 'container', 'anchor'],
    menuItems: []
};

export default SectionWidget;

