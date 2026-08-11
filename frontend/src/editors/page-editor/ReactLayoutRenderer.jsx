/**
 * ReactLayoutRenderer - Pure React layout rendering
 * 
 * This renderer uses manually defined React layout components instead of
 * complex backend/frontend protocol. Simple, flexible, and maintainable.
 */

import React, { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Layout } from 'lucide-react';
import { getLayoutComponent, getLayoutMetadata, LAYOUT_REGISTRY } from '../../layouts';
import { useWidgets, createDefaultWidgetConfig } from '../../hooks/useWidgets';
import PageWidgetSelectionModal from './PageWidgetSelectionModal';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { OperationTypes } from '../../contexts/unified-data/types/operations';
import { versionsApi } from '../../api/versions';
import ImportDialog from '../../components/ImportDialog';
import { copyWidgetsToClipboard, cutWidgetsToClipboard } from '../../utils/clipboardService';
import { Clipboard, Scissors, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useClipboard } from '../../contexts/ClipboardContext';

// Helper function to filter valid widgets
const filterValidWidgets = (widgets) => {
    return Array.isArray(widgets)
        ? widgets.filter(w => w != null && typeof w === 'object' && w.id != null)
        : []
}

export const isDifferentWidgetSourceContext = ({ sourcePageId, sourceVersionId, currentPageId, currentVersionId }) => {
    const sourcePageDiffers = sourcePageId && currentPageId && String(sourcePageId) !== String(currentPageId);
    const sourceVersionDiffers = sourceVersionId && currentVersionId && String(sourceVersionId) !== String(currentVersionId);

    return Boolean(sourcePageDiffers || sourceVersionDiffers);
}

const removeNestedWidgetFromSlot = (slotWidgets, pathSegment) => {
    if (!Array.isArray(pathSegment) || pathSegment.length < 1) {
        return slotWidgets;
    }

    const currentWidgetId = pathSegment[0];

    if (pathSegment.length === 1) {
        return filterValidWidgets(slotWidgets)
            .filter(widget => String(widget.id) !== String(currentWidgetId))
            .map((widget, index) => ({ ...widget, order: index }));
    }

    if (pathSegment.length < 3) {
        return slotWidgets;
    }

    const validWidgets = filterValidWidgets(slotWidgets);
    const widgetIndex = validWidgets.findIndex(widget => String(widget.id) === String(currentWidgetId));
    if (widgetIndex === -1) {
        return validWidgets;
    }

    const widget = validWidgets[widgetIndex];
    const nestedSlotName = pathSegment[1];
    const nestedSlots = widget.config?.slots || {};
    const nestedSlotWidgets = filterValidWidgets(nestedSlots[nestedSlotName] || []);
    const updatedNestedSlot = removeNestedWidgetFromSlot(nestedSlotWidgets, pathSegment.slice(2));

    const updatedWidgets = [...validWidgets];
    updatedWidgets[widgetIndex] = {
        ...widget,
        config: {
            ...widget.config,
            slots: {
                ...nestedSlots,
                [nestedSlotName]: updatedNestedSlot
            }
        }
    };

    return updatedWidgets;
}

const removeWidgetAtPathFromWidgetMap = (widgetMap, pathParts) => {
    if (!widgetMap || !Array.isArray(pathParts) || pathParts.length < 2) {
        return widgetMap || {};
    }

    const topSlot = pathParts[0];
    const slotWidgets = filterValidWidgets(widgetMap[topSlot] || []);

    return {
        ...widgetMap,
        [topSlot]: removeNestedWidgetFromSlot(slotWidgets, pathParts.slice(1))
    };
}

const removeCutMetadataFromWidgetMap = (widgetMap, cutMetadata) => {
    let updatedWidgets = widgetMap || {};

    if (cutMetadata?.widgetPaths && Array.isArray(cutMetadata.widgetPaths)) {
        cutMetadata.widgetPaths.forEach(widgetPath => {
            if (typeof widgetPath !== 'string') return;
            updatedWidgets = removeWidgetAtPathFromWidgetMap(updatedWidgets, widgetPath.split('/'));
        });
        return updatedWidgets;
    }

    if (cutMetadata?.widgets && typeof cutMetadata.widgets === 'object') {
        Object.entries(cutMetadata.widgets).forEach(([key, widgetIds]) => {
            if (!Array.isArray(widgetIds)) return;

            const keyParts = key.split('/');
            widgetIds.forEach(widgetId => {
                const pathParts = keyParts.length === 3
                    ? [...keyParts, widgetId]
                    : [key, widgetId];
                updatedWidgets = removeWidgetAtPathFromWidgetMap(updatedWidgets, pathParts);
            });
        });
    }

    return updatedWidgets;
}

const ReactLayoutRenderer = forwardRef(({
    layoutName = 'main_layout',  // Default to main_layout (available layout)
    widgets = {},
    onWidgetChange,
    editable = true,
    namespace,
    // PageEditor-specific props
    currentVersion,
    webpageData,
    pageVersionData,
    onVersionChange,
    onOpenWidgetEditor,
    context,
    // Local widget state management
    sharedComponentId,
    publishWidgetOperation,
    // Widget inheritance props
    inheritedWidgets = {},
    slotInheritanceRules = {},
    hasInheritedContent = false,
    refetchInheritance,
    // Path variables for dynamic content
    pathVariables = {},
    simulatedPath,
    onSimulatedPathChange
}, ref) => {

    // Get UDC context (but use shared componentId from PageEditor)
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData();

    // Get version context
    const versionId = currentVersion?.id || pageVersionData?.versionId;
    const isPublished = pageVersionData?.publicationStatus === 'published';

    // Use shared componentId from PageEditor (for component group coordination)
    const componentId = sharedComponentId || `react-layout-renderer-${versionId || 'unknown'}`;
    const contextType = 'page';

    // Subscribe to UDC state changes from external sources only
    useExternalChanges(componentId, () => {
        // External changes will be handled by PageEditor
        // ReactLayoutRenderer will get updates via props (widgets)
    })

    // Use shared widget hook
    const {
        addWidget
    } = useWidgets(widgets);

    // Widget modal state
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    const [selectedSlotForModal, setSelectedSlotForModal] = useState(null);
    const [selectedSlotMetadata, setSelectedSlotMetadata] = useState(null);
    const [replacementContext, setReplacementContext] = useState(null); // { isReplacement: true, position: number }

    // Import dialog state
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importSlotName, setImportSlotName] = useState(null);

    // Widget selection state: Set<widgetPath> where widgetPath = "slotName/widgetId" or "slotName/containerId/nestedSlot/nestedWidgetId"
    const [selectedWidgets, setSelectedWidgets] = useState(() => new Set());

    // Cut widgets state: tracks widgets that have been cut (waiting for paste)
    // Set<widgetPath>
    const [cutWidgets, setCutWidgets] = useState(() => new Set());

    // Toolbar collapse state
    const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
    const [pasteError, setPasteError] = useState(null);

    // Get global clipboard state
    const { clipboardData, pasteModeActive, pasteModePaused, togglePasteMode, clearClipboardState, refreshClipboard } = useClipboard();

    // Helper: Build widget path string from slotName and widgetId (and optional nested path)
    const buildWidgetPath = useCallback((slotName, widgetId, nestedPath = null) => {
        if (nestedPath) {
            return `${slotName}/${widgetId}/${nestedPath}`;
        }
        return `${slotName}/${widgetId}`;
    }, []);

    // Helper: Parse widget path to extract components
    const parseWidgetPath = useCallback((widgetPath) => {
        const parts = widgetPath.split('/');
        if (parts.length === 2) {
            // Top-level: "slotName/widgetId"
            return { slotName: parts[0], widgetId: parts[1], pathParts: parts, isNested: false };
        } else if (parts.length >= 4 && parts.length % 2 === 0) {
            // Nested: "slotName/containerId/nestedSlot/nestedWidgetId[/nestedSlot/nestedWidgetId...]"
            return {
                slotName: parts[0],
                containerId: parts[1],
                nestedSlot: parts[2],
                nestedWidgetId: parts[parts.length - 1],
                pathParts: parts,
                isNested: true
            };
        }
        return null;
    }, []);

    const publishCutSourceRemovals = useCallback(async (cutMetadata) => {
        const sourcePageId = cutMetadata.pageId;
        const sourceVersionId = cutMetadata.versionId;

        if (cutMetadata.widgetPaths && Array.isArray(cutMetadata.widgetPaths)) {
            for (const widgetPath of cutMetadata.widgetPaths) {
                const parsed = parseWidgetPath(widgetPath);
                if (!parsed) continue;

                await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                    id: parsed.isNested ? parsed.nestedWidgetId : parsed.widgetId,
                    contextType: contextType,
                    pageId: sourcePageId,
                    versionId: sourceVersionId,
                    widgetPath: parsed.pathParts
                });
            }
        } else if (cutMetadata.widgets) {
            for (const widgetIds of Object.values(cutMetadata.widgets)) {
                if (!Array.isArray(widgetIds)) continue;
                for (const widgetId of widgetIds) {
                    await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                        id: widgetId,
                        contextType: contextType,
                        pageId: sourcePageId,
                        versionId: sourceVersionId,
                    });
                }
            }
        }
    }, [componentId, contextType, parseWidgetPath, publishUpdate]);

    const prepareCutSourceWidgets = useCallback(async (cutMetadata) => {
        const sourcePageId = cutMetadata?.pageId;
        const sourceVersionId = cutMetadata?.versionId;

        if (!sourceVersionId) {
            throw new Error('The cut source version is missing. Copy the widget again and retry.');
        }

        const state = getState?.();
        const loadedSourceVersion = state?.versions?.[String(sourceVersionId)] || state?.versions?.[sourceVersionId];
        const sourceVersion = sourcePageId
            ? await versionsApi.getPageVersion(sourcePageId, sourceVersionId)
            : await versionsApi.get(sourceVersionId);
        const authoritativeSourceVersion = sourceVersion?.data || sourceVersion || loadedSourceVersion;
        const publicationStatus = authoritativeSourceVersion?.publicationStatus;

        if (publicationStatus !== 'draft') {
            const statusLabel = publicationStatus || 'an unknown publication state';
            throw new Error(
                `Only draft versions can be changed. Source version ${sourceVersionId} is ${statusLabel}.`
            );
        }

        const sourceWidgets = authoritativeSourceVersion?.widgets || {};
        const updatedSourceWidgets = removeCutMetadataFromWidgetMap(sourceWidgets, cutMetadata);

        return {
            sourceVersionId,
            loadedSourceVersion,
            updatedSourceWidgets
        };
    }, [getState]);

    const persistCutSourceWidgets = useCallback(async (cutMetadata, preparedSource = null) => {
        const sourceUpdate = preparedSource || await prepareCutSourceWidgets(cutMetadata);
        await versionsApi.updateWidgets(sourceUpdate.sourceVersionId, {
            widgets: sourceUpdate.updatedSourceWidgets
        });

        if (sourceUpdate.loadedSourceVersion) {
            await publishCutSourceRemovals(cutMetadata);
        }
    }, [prepareCutSourceWidgets, publishCutSourceRemovals]);

    // Page context for widgets - includes all necessary context data
    const pageContext = useMemo(() => ({
        versionId,
        isPublished,
        onVersionChange,
        onPublishingAction: (action) => {
            if (onVersionChange) {
                switch (action) {
                    case 'publish':
                        onVersionChange('publish_current');
                        break;
                    case 'schedule':
                        onVersionChange('schedule_current');
                        break;
                    case 'unpublish':
                        onVersionChange('unpublish_current');
                        break;
                }
            }
        },
        // Add missing context for widgets
        parentComponentId: componentId,
        contextType: 'page',
        pageId: context?.pageId || webpageData?.id,
        siteRootId: context?.siteRootId || webpageData?.cachedRootId || null,  // Site root for link picker navigation
        // Full page data for widget context
        webpageData: webpageData,
        pageVersionData: pageVersionData,
        // Pass onOpenWidgetEditor for nested widgets
        onOpenWidgetEditor,
        // Path variables for dynamic content (matching backend behavior)
        pathVariables: pathVariables,
        simulatedPath: simulatedPath,
        onSimulatedPathChange: onSimulatedPathChange
    }), [versionId, isPublished, onVersionChange, componentId, context?.pageId, context?.siteRootId, webpageData, pageVersionData, onOpenWidgetEditor, pathVariables, simulatedPath, onSimulatedPathChange]);

    // Handle widget actions
    const handleWidgetAction = useCallback(async (action, slotName, widget, ...args) => {
        switch (action) {
            case 'add': {
                const widgetType = args[0] || 'easy_widgets.ContentWidget';
                const insertPosition = args[1]; // Optional position parameter

                const widgetConfig = createDefaultWidgetConfig(widgetType);
                const newWidget = addWidget(slotName, widgetType, widgetConfig);

                // 1. IMMEDIATE: Fast local update via parent (PageEditor)
                const slotWidgets = [...(widgets[slotName] || [])];

                // Insert at specific position if provided, otherwise append to end
                if (insertPosition !== undefined && insertPosition !== null && insertPosition >= 0) {
                    slotWidgets.splice(insertPosition, 0, newWidget);
                } else {
                    slotWidgets.push(newWidget);
                }

                const updatedWidgets = {
                    ...widgets,
                    [slotName]: slotWidgets
                };

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgets, { sourceId: componentId });
                }

                // 2. ASYNC: Publish to UDC for external sync (other users/components)
                const widgetOrder = insertPosition !== undefined && insertPosition !== null && insertPosition >= 0
                    ? insertPosition
                    : (widgets[slotName]?.length || 0);

                if (publishWidgetOperation) {
                    await publishWidgetOperation(OperationTypes.ADD_WIDGET, {
                        id: newWidget.id,
                        type: newWidget.type,
                        config: newWidget.config,
                        slot: slotName,
                        order: widgetOrder
                    });
                } else {
                    // Fallback to direct UDC publishing
                    await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                        id: newWidget.id,
                        type: newWidget.type,
                        config: newWidget.config,
                        slot: slotName,
                        contextType: contextType,
                        pageId: context?.pageId || webpageData?.id,
                        versionId,
                        order: widgetOrder
                    });
                }

                break;
            }

            case 'edit': {
                const widgetIndex = args[0];
                if (onOpenWidgetEditor) {
                    onOpenWidgetEditor({
                        ...widget,
                        slotName,
                        context: {
                            ...(context || {}),
                            slotName,
                            widgetId: widget.id,
                            mode: 'edit',
                            contextType
                        }
                    });
                }
                break;
            }

            case 'delete': {
                const deleteIndex = args[0];

                const updatedWidgetsDelete = { ...widgets };
                if (updatedWidgetsDelete[slotName]) {
                    updatedWidgetsDelete[slotName] = updatedWidgetsDelete[slotName].filter((_, i) => i !== deleteIndex);
                }

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgetsDelete, { sourceId: widget.id });
                }


                // Publish to Unified Data Context
                await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                    id: widget.id,
                    contextType: contextType,
                    pageId: context?.pageId || webpageData?.id,
                    versionId
                });

                break;
            }

            case 'moveUp': {
                const moveUpIndex = args[0];
                if (moveUpIndex > 0) {
                    // First: Update local state for immediate UI feedback
                    const updatedWidgetsUp = { ...widgets };
                    if (updatedWidgetsUp[slotName]) {
                        const slotWidgets = [...updatedWidgetsUp[slotName]];
                        [slotWidgets[moveUpIndex - 1], slotWidgets[moveUpIndex]] =
                            [slotWidgets[moveUpIndex], slotWidgets[moveUpIndex - 1]];
                        updatedWidgetsUp[slotName] = slotWidgets;
                    }

                    if (onWidgetChange) {
                        onWidgetChange(updatedWidgetsUp, { sourceId: widget.id });
                    }

                    // Publish to Unified Data Context
                    await publishUpdate(componentId, OperationTypes.MOVE_WIDGET, {
                        id: widget.id,
                        slot: slotName,
                        contextType: contextType,
                        pageId: context?.pageId || webpageData?.id,
                        versionId,
                        widgets: updatedWidgetsUp
                    });
                }
                break;
            }

            case 'moveDown': {
                const moveDownIndex = args[0];
                const slotWidgets = widgets[slotName] || [];
                if (moveDownIndex < slotWidgets.length - 1) {
                    const updatedWidgetsDown = { ...widgets };
                    if (updatedWidgetsDown[slotName]) {
                        const slotWidgetsCopy = [...updatedWidgetsDown[slotName]];
                        [slotWidgetsCopy[moveDownIndex], slotWidgetsCopy[moveDownIndex + 1]] =
                            [slotWidgetsCopy[moveDownIndex + 1], slotWidgetsCopy[moveDownIndex]];
                        updatedWidgetsDown[slotName] = slotWidgetsCopy;
                    }

                    if (onWidgetChange) {
                        onWidgetChange(updatedWidgetsDown, { sourceId: widget.id });
                    }

                    // Publish to Unified Data Context
                    await publishUpdate(componentId, OperationTypes.MOVE_WIDGET, {
                        id: widget.id,
                        slot: slotName,
                        contextType: contextType,
                        pageId: context?.pageId || webpageData?.id,
                        versionId,
                        widgets: updatedWidgetsDown
                    });
                }
                break;
            }

            case 'paste': {
                setPasteError(null);

                // widget is the pasted widget, args[0] is the index to insert after
                const pastedWidget = widget;
                const insertAfterIndex = args[0];
                const insertPosition = insertAfterIndex + 1;
                const clipboardMetadata = args[1]; // Optional: { operation, metadata } from clipboard
                const currentPageId = context?.pageId || webpageData?.id;

                // Start with current widgets state
                let updatedWidgets = { ...widgets };
                let preparedCutSource = null;

                // Add the pasted widget FIRST to ensure correct insert position
                // Filter valid widgets first to remove any undefined entries
                const slotWidgetsPaste = filterValidWidgets(updatedWidgets[slotName] || []);
                slotWidgetsPaste.splice(insertPosition, 0, pastedWidget);
                updatedWidgets[slotName] = slotWidgetsPaste;

                // If this was a cut operation, delete the original widgets AFTER adding pasted widget
                // The pasted widget has a new ID, so it won't be deleted
                if (clipboardMetadata && clipboardMetadata.operation === 'cut' && clipboardMetadata.metadata) {
                    const cutMetadata = clipboardMetadata.metadata;

                    // Check if this is a cross-page or cross-version cut/paste operation
                    const sourcePageId = cutMetadata.pageId;
                    const sourceVersionId = cutMetadata.versionId;
                    const isCrossSourceContext = isDifferentWidgetSourceContext({
                        sourcePageId,
                        sourceVersionId,
                        currentPageId,
                        currentVersionId: versionId
                    });

                    if (!isCrossSourceContext) {
                        // For same-page operations, remove widgets from updatedWidgets
                        let widgetsDeleted = false;

                        // Handle new format with widget paths
                        if (cutMetadata.widgetPaths && Array.isArray(cutMetadata.widgetPaths)) {
                            for (const widgetPath of cutMetadata.widgetPaths) {
                                const parsed = parseWidgetPath(widgetPath);
                                if (!parsed) continue;

                                if (!parsed.isNested) {
                                    // Top-level widget - remove from the slot
                                    if (updatedWidgets[parsed.slotName]) {
                                        const originalLength = updatedWidgets[parsed.slotName].length;

                                        // Filter out the widget to delete, but keep the pasted widget if it's in the same slot
                                        // Use String() to ensure type matching and also check both string and number formats
                                        // Filter valid widgets first
                                        const validWidgets = filterValidWidgets(updatedWidgets[parsed.slotName] || []);
                                        updatedWidgets[parsed.slotName] = validWidgets.filter(
                                            w => {
                                                const widgetIdStr = String(w.id);
                                                const parsedIdStr = String(parsed.widgetId);
                                                return widgetIdStr !== parsedIdStr;
                                            }
                                        );

                                        const removed = originalLength - updatedWidgets[parsed.slotName].length;

                                        if (removed > 0) {
                                            widgetsDeleted = true;
                                            // Publish UDC operation
                                            await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                                                id: parsed.widgetId,
                                                contextType: contextType,
                                                pageId: currentPageId,
                                                versionId
                                            });
                                        }
                                    }
                                } else {
                                    // Nested widget - update container widget's config
                                    if (updatedWidgets[parsed.slotName]) {
                                        const containerWidget = updatedWidgets[parsed.slotName].find(
                                            w => String(w.id) === String(parsed.containerId)
                                        );
                                        if (containerWidget && containerWidget.config && containerWidget.config.slots) {
                                            const nestedSlotWidgets = containerWidget.config.slots[parsed.nestedSlot] || [];
                                            const originalLength = nestedSlotWidgets.length;

                                            containerWidget.config.slots[parsed.nestedSlot] = nestedSlotWidgets.filter(
                                                w => w && String(w.id) !== String(parsed.nestedWidgetId)
                                            );

                                            const removed = originalLength - containerWidget.config.slots[parsed.nestedSlot].length;
                                            if (removed > 0) {
                                                widgetsDeleted = true;
                                                // Update the container widget in the state
                                                // Filter valid widgets first
                                                const validWidgets = filterValidWidgets(updatedWidgets[parsed.slotName] || []);
                                                updatedWidgets[parsed.slotName] = validWidgets.map(w =>
                                                    String(w.id) === String(parsed.containerId) ? containerWidget : w
                                                );

                                                // Publish UDC operation
                                                await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                                                    id: parsed.containerId,
                                                    slotName: parsed.slotName,
                                                    contextType: contextType,
                                                    pageId: currentPageId,
                                                    versionId,
                                                    config: containerWidget.config
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        } else if (cutMetadata.widgets && typeof cutMetadata.widgets === 'object') {
                            // Handle backward-compatible format (old format)
                            for (const [key, widgetIds] of Object.entries(cutMetadata.widgets)) {
                                const keyParts = key.split('/');

                                if (keyParts.length === 3) {
                                    // Nested widget
                                    const [slotName, containerId, nestedSlot] = keyParts;
                                    if (updatedWidgets[slotName]) {
                                        const containerWidget = updatedWidgets[slotName].find(w => String(w.id) === String(containerId));
                                        if (containerWidget && containerWidget.config && containerWidget.config.slots) {
                                            const nestedSlotWidgets = containerWidget.config.slots[nestedSlot] || [];
                                            const originalLength = nestedSlotWidgets.length;

                                            containerWidget.config.slots[nestedSlot] = nestedSlotWidgets.filter(
                                                w => {
                                                    if (!w) return false;
                                                    const widgetIdStr = String(w.id);
                                                    return !widgetIds.map(String).includes(widgetIdStr);
                                                }
                                            );

                                            const removed = originalLength - containerWidget.config.slots[nestedSlot].length;

                                            if (removed > 0) {
                                                widgetsDeleted = true;
                                                // Filter valid widgets first
                                                const validWidgets = filterValidWidgets(updatedWidgets[slotName] || []);
                                                updatedWidgets[slotName] = validWidgets.map(w =>
                                                    String(w.id) === String(containerId) ? containerWidget : w
                                                );

                                                await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                                                    id: containerId,
                                                    slotName: slotName,
                                                    contextType: contextType,
                                                    pageId: currentPageId,
                                                    versionId,
                                                    config: containerWidget.config
                                                });
                                            }
                                        }
                                    }
                                } else {
                                    // Top-level widget
                                    const slotName = key;

                                    if (updatedWidgets[slotName]) {
                                        const originalLength = updatedWidgets[slotName].length;

                                        // Filter out widgets to delete, but keep the pasted widget
                                        // Use String() to ensure type matching
                                        // Filter valid widgets first
                                        const validWidgets = filterValidWidgets(updatedWidgets[slotName] || []);
                                        updatedWidgets[slotName] = validWidgets.filter(
                                            widget => {
                                                const widgetIdStr = String(widget.id);
                                                const widgetIdsStr = widgetIds.map(String);
                                                return !widgetIdsStr.includes(widgetIdStr);
                                            }
                                        );

                                        const removed = originalLength - updatedWidgets[slotName].length;

                                        if (removed > 0) {
                                            for (const widgetId of widgetIds) {
                                                await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                                                    id: widgetId,
                                                    contextType: contextType,
                                                    pageId: currentPageId,
                                                    versionId
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }

                    } else {
                        try {
                            preparedCutSource = await prepareCutSourceWidgets(cutMetadata);
                        } catch (error) {
                            setPasteError(error?.message || 'The cut source could not be validated.');
                            break;
                        }
                    }
                }

                // Update state with both paste and deletion (if any)
                // This MUST be called to update the parent component's state
                if (onWidgetChange) {
                    onWidgetChange(updatedWidgets, { sourceId: pastedWidget.id });
                }

                // Publish to UDC for external sync
                if (publishWidgetOperation) {
                    await publishWidgetOperation(OperationTypes.ADD_WIDGET, {
                        id: pastedWidget.id,
                        type: pastedWidget.type,
                        config: pastedWidget.config,
                        slot: slotName,
                        order: insertPosition
                    });
                } else {
                    await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                        id: pastedWidget.id,
                        type: pastedWidget.type,
                        config: pastedWidget.config,
                        slot: slotName,
                        contextType: contextType,
                        pageId: currentPageId,
                        versionId,
                        order: insertPosition
                    });
                }

                if (clipboardMetadata?.operation === 'cut' && clipboardMetadata.metadata) {
                    if (preparedCutSource) {
                        try {
                            await persistCutSourceWidgets(clipboardMetadata.metadata, preparedCutSource);
                        } catch (error) {
                            setPasteError(
                                `Widget was pasted, but the cut source was not removed: ${error?.message || 'The source version could not be updated.'}`
                            );
                            break;
                        }
                    }

                    setCutWidgets(new Set());
                    setSelectedWidgets(new Set());
                }

                break;
            }

            case 'configChange': {
                const newConfig = args[0];
                const updatedWidgetsConfig = { ...widgets };
                if (updatedWidgetsConfig[slotName]) {
                    // Filter valid widgets first, then update
                    const validWidgets = filterValidWidgets(updatedWidgetsConfig[slotName]);
                    updatedWidgetsConfig[slotName] = validWidgets.map(w =>
                        w.id === widget.id ? { ...w, config: newConfig } : w
                    );
                }

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgetsConfig, { sourceId: widget.id });
                }


                // Publish to Unified Data Context
                await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                    id: widget.id,
                    slotName,
                    contextType: contextType,
                    pageId: context?.pageId || webpageData?.id,
                    versionId,
                    config: newConfig
                });
                break;
            }

            default:
                break;
        }
    }, [widgets, onWidgetChange, onOpenWidgetEditor, addWidget, publishUpdate, componentId, versionId, isPublished, onVersionChange, context, webpageData, contextType, prepareCutSourceWidgets, persistCutSourceWidgets]);

    // Widget modal handlers
    const handleShowWidgetModal = useCallback((slotName, slotMetadata = null, replacementInfo = null) => {
        setSelectedSlotForModal(slotName);
        setSelectedSlotMetadata(slotMetadata);
        setReplacementContext(replacementInfo);
        setWidgetModalOpen(true);
    }, []);

    const handleCloseWidgetModal = useCallback(() => {
        setWidgetModalOpen(false);
        setSelectedSlotForModal(null);
        setSelectedSlotMetadata(null);
        setReplacementContext(null);
    }, []);

    const handleWidgetSelection = useCallback((widgetType) => {
        if (selectedSlotForModal) {
            // If replacing an inherited widget, pass the position
            if (replacementContext?.isReplacement) {
                handleWidgetAction('add', selectedSlotForModal, null, widgetType, replacementContext.position);
            } else {
                handleWidgetAction('add', selectedSlotForModal, null, widgetType);
            }
        }
        handleCloseWidgetModal();
    }, [selectedSlotForModal, replacementContext, handleWidgetAction, handleCloseWidgetModal]);

    // Widget selection handlers - now support widget paths for nested widgets
    const toggleWidgetSelection = useCallback((slotName, widgetId, nestedPath = null) => {
        const widgetPath = buildWidgetPath(slotName, widgetId, nestedPath);
        setSelectedWidgets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(widgetPath)) {
                newSet.delete(widgetPath);
            } else {
                newSet.add(widgetPath);
            }
            return newSet;
        });
    }, [buildWidgetPath]);

    const selectAllInSlot = useCallback((slotName) => {
        const slotWidgets = widgets[slotName] || [];
        if (slotWidgets.length === 0) return;

        setSelectedWidgets(prev => {
            const newSet = new Set(prev);
            slotWidgets.forEach(widget => {
                const widgetPath = buildWidgetPath(slotName, widget.id);
                newSet.add(widgetPath);
            });
            return newSet;
        });
    }, [widgets, buildWidgetPath]);

    const clearSelection = useCallback(() => {
        setSelectedWidgets(new Set());
        setCutWidgets(new Set());
    }, []);

    const isWidgetSelected = useCallback((slotName, widgetId, nestedPath = null) => {
        const widgetPath = buildWidgetPath(slotName, widgetId, nestedPath);
        return selectedWidgets.has(widgetPath);
    }, [selectedWidgets, buildWidgetPath]);

    const isWidgetCut = useCallback((slotName, widgetId, nestedPath = null) => {
        const widgetPath = buildWidgetPath(slotName, widgetId, nestedPath);
        return cutWidgets.has(widgetPath);
    }, [cutWidgets, buildWidgetPath]);

    const getSelectedCount = useCallback(() => {
        return selectedWidgets.size;
    }, [selectedWidgets]);

    // Get selected widgets - now handles both top-level and nested widgets
    const getSelectedWidgets = useCallback(() => {
        const selected = [];

        selectedWidgets.forEach(widgetPath => {
            const parsed = parseWidgetPath(widgetPath);
            if (!parsed) {
                return;
            }

            if (!parsed.isNested) {
                // Top-level widget
                const slotWidgets = widgets[parsed.slotName] || [];
                const widget = slotWidgets.find(w => w.id === parsed.widgetId);
                if (widget) {
                    selected.push({ widget, slotName: parsed.slotName, widgetPath });
                }
            } else {
                // Nested widget - need to find it in the container widget's config
                const slotWidgets = widgets[parsed.slotName] || [];
                const containerWidget = slotWidgets.find(w => w.id === parsed.containerId);
                if (containerWidget && containerWidget.config && containerWidget.config.slots) {
                    const nestedSlotWidgets = containerWidget.config.slots[parsed.nestedSlot] || [];
                    const nestedWidget = nestedSlotWidgets.find(w => w.id === parsed.nestedWidgetId);
                    if (nestedWidget) {
                        selected.push({
                            widget: nestedWidget,
                            slotName: parsed.slotName,
                            containerWidget,
                            nestedSlot: parsed.nestedSlot,
                            widgetPath
                        });
                    }
                }
            }
        });

        return selected;
    }, [selectedWidgets, widgets, parseWidgetPath]);

    // Clear slot handler
    const handleClearSlot = useCallback(async (slotName) => {

        const updatedWidgets = { ...widgets };
        updatedWidgets[slotName] = [];

        if (onWidgetChange) {
            onWidgetChange(updatedWidgets, { sourceId: `slot-${slotName}` });
        }


        // Publish removals to Unified Data Context for all widgets in this slot
        const existingWidgetsInSlot = widgets[slotName] || [];
        for (const w of existingWidgetsInSlot) {
            await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                id: w.id,
                contextType: contextType,
                pageId: context?.pageId || webpageData?.id,
                versionId
            });
        }
    }, [widgets, onWidgetChange, publishUpdate, componentId, versionId, isPublished]);

    // Import content handler
    const handleImportContent = useCallback((slotName) => {
        setImportSlotName(slotName);
        setImportDialogOpen(true);
    }, []);

    // Import completion handler
    const handleImportComplete = useCallback(async (importedWidgets, metadata = {}) => {
        if (!importSlotName || !importedWidgets || importedWidgets.length === 0) {
            return;
        }

        // Add imported widgets to the slot
        const currentSlotWidgets = widgets[importSlotName] || [];
        const updatedWidgets = {
            ...widgets,
            [importSlotName]: [...currentSlotWidgets, ...importedWidgets]
        };

        if (onWidgetChange) {
            onWidgetChange(updatedWidgets, { sourceId: `import-${importSlotName}` });
        }

        // Publish each widget to UDC
        for (const widget of importedWidgets) {
            await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                id: widget.id,
                type: widget.type,
                config: widget.config,
                slot: importSlotName,
                contextType: contextType,
                pageId: context?.pageId || webpageData?.id,
                versionId,
                order: currentSlotWidgets.length + importedWidgets.indexOf(widget)
            });
        }

        // If page was updated with title/tags, reload page data from backend via UDC
        if (metadata.pageWasUpdated) {
            // Trigger UDC to reload page data - this will refresh title/tags in the page editor
            // The RELOAD_DATA operation tells UDC to fetch fresh data from backend
            await publishUpdate(componentId, OperationTypes.RELOAD_DATA, {
                reason: 'Page metadata updated during import',
                updatedFields: ['title', 'tags'],
            });
        }
    }, [importSlotName, widgets, onWidgetChange, publishUpdate, componentId, contextType]);

    // Bulk action handlers
    const handleCopySelected = useCallback(async () => {
        const selected = getSelectedWidgets();
        if (selected.length === 0) return;

        const widgetsToCopy = selected.map(item => item.widget);
        await copyWidgetsToClipboard(widgetsToCopy);
        // Immediately refresh clipboard state in current window
        await refreshClipboard();
    }, [getSelectedWidgets, refreshClipboard]);

    const handleCutSelected = useCallback(async () => {
        const selected = getSelectedWidgets();
        if (selected.length === 0) {
            return;
        }

        const widgetsToCut = selected.map(item => item.widget);

        // Build metadata for cut operation (track which widgets to delete using widget paths)
        const cutMetadata = {
            pageId: context?.pageId || webpageData?.id, // Store source pageId for cross-page cut/paste
            versionId,
            widgetPaths: selected.map(item => item.widgetPath),
            widgets: {} // Keep backward compatibility: { slotName: [widgetIds] }
        };

        // Build backward-compatible format for top-level widgets
        selected.forEach(({ widget, slotName, nestedSlot, containerWidget }) => {
            if (!nestedSlot) {
                // Top-level widget
                if (!cutMetadata.widgets[slotName]) {
                    cutMetadata.widgets[slotName] = [];
                }
                cutMetadata.widgets[slotName].push(widget.id);
            } else {
                // Nested widget - store in nested format
                const nestedKey = `${slotName}/${containerWidget.id}/${nestedSlot}`;
                if (!cutMetadata.widgets[nestedKey]) {
                    cutMetadata.widgets[nestedKey] = [];
                }
                cutMetadata.widgets[nestedKey].push(widget.id);
            }
        });

        // Mark widgets as cut (visual indicator) - use widget paths
        setCutWidgets(prev => {
            const newSet = new Set(prev);
            selected.forEach(item => {
                newSet.add(item.widgetPath);
            });
            return newSet;
        });

        await cutWidgetsToClipboard(widgetsToCut, cutMetadata);
        // Immediately refresh clipboard state in current window
        await refreshClipboard();
    }, [getSelectedWidgets, context, webpageData, refreshClipboard]);

    const handleDeleteCutWidgets = useCallback(async (cutMetadata, preparedSource = null) => {
        // Delete widgets that were cut and pasted
        // Supports both new format (widgetPaths) and old format (widgets object)

        // Check if this is a cross-page or cross-version cut/paste operation
        const sourcePageId = cutMetadata.pageId;
        const sourceVersionId = cutMetadata.versionId;
        const currentPageId = context?.pageId || webpageData?.id;
        const isCrossSourceContext = isDifferentWidgetSourceContext({
            sourcePageId,
            sourceVersionId,
            currentPageId,
            currentVersionId: versionId
        });

        // For cross-page/cross-version operations, persist the source version directly.
        if (isCrossSourceContext) {
            await persistCutSourceWidgets(cutMetadata, preparedSource);
            return; // Don't update local widgets for cross-context operations
        }

        // For same-page operations, update local widgets
        const updatedWidgets = { ...widgets };
        let hasChanges = false;

        // Handle new format with widget paths
        if (cutMetadata.widgetPaths && Array.isArray(cutMetadata.widgetPaths)) {
            for (const widgetPath of cutMetadata.widgetPaths) {
                const parsed = parseWidgetPath(widgetPath);
                if (!parsed) continue;

                if (!parsed.isNested) {
                    // Top-level widget
                    if (updatedWidgets[parsed.slotName]) {
                        // Filter valid widgets first
                        const validWidgets = filterValidWidgets(updatedWidgets[parsed.slotName] || []);
                        const originalLength = validWidgets.length;
                        updatedWidgets[parsed.slotName] = validWidgets.filter(
                            widget => widget.id !== parsed.widgetId
                        );

                        if (updatedWidgets[parsed.slotName].length !== originalLength) {
                            hasChanges = true;
                            await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                                id: parsed.widgetId,
                                contextType: contextType,
                                pageId: currentPageId,
                                versionId
                            });
                        }
                    }
                } else {
                    // Nested widget - update container widget's config
                    if (updatedWidgets[parsed.slotName]) {
                        const containerWidget = updatedWidgets[parsed.slotName].find(
                            w => String(w.id) === String(parsed.containerId)
                        );
                        if (containerWidget && containerWidget.config && containerWidget.config.slots) {
                            const nestedSlotWidgets = containerWidget.config.slots[parsed.nestedSlot] || [];
                            const originalLength = nestedSlotWidgets.length;

                            containerWidget.config.slots[parsed.nestedSlot] = nestedSlotWidgets.filter(
                                w => w && String(w.id) !== String(parsed.nestedWidgetId)
                            );

                            const removed = originalLength - containerWidget.config.slots[parsed.nestedSlot].length;

                            if (removed > 0) {
                                hasChanges = true;
                                // Update the container widget
                                // Filter valid widgets first
                                const validWidgets = filterValidWidgets(updatedWidgets[parsed.slotName] || []);
                                updatedWidgets[parsed.slotName] = validWidgets.map(w =>
                                    String(w.id) === String(parsed.containerId) ? containerWidget : w
                                );

                                await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                                    id: parsed.containerId,
                                    slotName: parsed.slotName,
                                    contextType: contextType,
                                    pageId: currentPageId,
                                    versionId,
                                    config: containerWidget.config
                                });
                            }
                        }
                    }
                }
            }
        }

        // Handle backward-compatible format (old format)
        if (cutMetadata.widgets && typeof cutMetadata.widgets === 'object') {
            for (const [key, widgetIds] of Object.entries(cutMetadata.widgets)) {
                // Check if this is a nested key (format: "slotName/containerId/nestedSlot")
                const keyParts = key.split('/');

                if (keyParts.length === 3) {
                    // Nested widget
                    const [slotName, containerId, nestedSlot] = keyParts;
                    if (updatedWidgets[slotName]) {
                        const containerWidget = updatedWidgets[slotName].find(w => String(w.id) === String(containerId));
                        if (containerWidget && containerWidget.config && containerWidget.config.slots) {
                            const nestedSlotWidgets = containerWidget.config.slots[nestedSlot] || [];
                            const originalLength = nestedSlotWidgets.length;

                            containerWidget.config.slots[nestedSlot] = nestedSlotWidgets.filter(
                                w => w && !widgetIds.map(String).includes(String(w.id))
                            );

                            const removed = originalLength - containerWidget.config.slots[nestedSlot].length;

                            if (removed > 0) {
                                hasChanges = true;
                                // Filter valid widgets first
                                const validWidgets = filterValidWidgets(updatedWidgets[slotName] || []);
                                updatedWidgets[slotName] = validWidgets.map(w =>
                                    String(w.id) === String(containerId) ? containerWidget : w
                                );

                                await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                                    id: containerId,
                                    slotName: slotName,
                                    contextType: contextType,
                                    pageId: currentPageId,
                                    versionId,
                                    config: containerWidget.config
                                });
                            }
                        }
                    }
                } else {
                    // Top-level widget
                    const slotName = key;
                    if (updatedWidgets[slotName]) {
                        // Filter valid widgets first
                        const validWidgets = filterValidWidgets(updatedWidgets[slotName] || []);
                        const originalLength = validWidgets.length;
                        updatedWidgets[slotName] = validWidgets.filter(
                            widget => !widgetIds.includes(widget.id)
                        );

                        if (updatedWidgets[slotName].length !== originalLength) {
                            hasChanges = true;
                            for (const widgetId of widgetIds) {
                                await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                                    id: widgetId,
                                    contextType: contextType,
                                    pageId: currentPageId,
                                    versionId
                                });
                            }
                        }
                    }
                }
            }
        }

        if (hasChanges && onWidgetChange) {
            onWidgetChange(updatedWidgets, { sourceId: 'cut-operation' });
        }

        // Clear cut state and selection
        setCutWidgets(new Set());
        setSelectedWidgets(new Set());
    }, [widgets, onWidgetChange, publishUpdate, componentId, contextType, parseWidgetPath, context, webpageData, persistCutSourceWidgets]);

    // Handle paste at specific position
    const handlePasteAtPosition = useCallback(async (slotName, position, widgetPath = [], keepClipboard = false) => {
        if (!clipboardData || !clipboardData.data || clipboardData.data.length === 0) {
            return;
        }

        setPasteError(null);

        // Get widget(s) from clipboard
        const widgetsToPaste = clipboardData.data;
        const isCut = clipboardData.operation === 'cut';
        let preparedCutSource = null;

        if (isCut && clipboardData.metadata) {
            const sourcePageId = clipboardData.metadata.pageId;
            const sourceVersionId = clipboardData.metadata.versionId;
            const currentPageId = context?.pageId || webpageData?.id;
            const isCrossSourceContext = isDifferentWidgetSourceContext({
                sourcePageId,
                sourceVersionId,
                currentPageId,
                currentVersionId: versionId
            });

            if (isCrossSourceContext) {
                try {
                    preparedCutSource = await prepareCutSourceWidgets(clipboardData.metadata);
                } catch (error) {
                    setPasteError(error?.message || 'The cut source could not be validated.');
                    return;
                }
            }
        }

        // Generate new IDs for pasted widgets
        const pastedWidgets = widgetsToPaste.map(w => ({
            ...w,
            id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));

        // Determine if this is a nested slot paste
        const isNested = widgetPath.length > 0;

        if (isNested) {
            // NORMALIZE PATH: Determine if path targets a slot or a widget
            // Path structure: [topSlot, widgetId, nestedSlot, widgetId, nestedSlot, ...]
            // - Odd length = ends with slot name (empty slot paste target)
            // - Even length = ends with widget ID (paste relative to existing widget)
            const effectivePath = (widgetPath.length % 2 === 0)
                ? widgetPath.slice(0, -1)  // Strip trailing widgetId
                : widgetPath;

            const topSlotName = effectivePath[0];

            // TRAVERSE WITH ANCESTOR TRACKING
            // We need to track { widget, widgetIndex, slotName } for every level to rebuild immutably
            const ancestors = [];
            let currentWidgets = widgets[topSlotName] || [];
            let containerWidget = null;
            let targetSlotName = null;

            // Iterate pairs [widgetId, slotName] starting from index 1
            for (let i = 1; i < effectivePath.length; i += 2) {
                const widgetId = effectivePath[i];
                const nextSlot = effectivePath[i + 1];

                const widgetIndex = currentWidgets.findIndex(w => String(w.id) === String(widgetId));
                const widget = currentWidgets[widgetIndex];

                if (!widget) {
                    console.error('[ReactLayoutRenderer] Container widget not found in path', widgetId);
                    return;
                }

                // Track ancestor info needed for rebuilding
                ancestors.push({
                    widget,
                    widgetIndex,
                    slotName: i === 1 ? topSlotName : effectivePath[i - 1],
                    currentWidgets
                });

                if (i + 2 >= effectivePath.length) {
                    // This is the innermost container
                    containerWidget = widget;
                    targetSlotName = nextSlot;
                } else {
                    // Go deeper into nested slots
                    currentWidgets = widget.config?.slots?.[nextSlot] || [];
                }
            }

            if (!containerWidget || !targetSlotName) {
                console.error('[ReactLayoutRenderer] Could not find container or target slot');
                return;
            }

            // UPDATE INNERMOST CONTAINER
            const nestedSlotWidgets = containerWidget.config?.slots?.[targetSlotName] || [];
            const updatedNestedWidgets = [...nestedSlotWidgets];
            updatedNestedWidgets.splice(position, 0, ...pastedWidgets);

            let updatedChild = {
                ...containerWidget,
                config: {
                    ...containerWidget.config,
                    slots: {
                        ...containerWidget.config.slots,
                        [targetSlotName]: updatedNestedWidgets
                    }
                }
            };

            // REBUILD ANCESTORS BOTTOM-UP
            // Start from the innermost container (last ancestor) and work up
            // The last ancestor IS the container we just updated
            for (let i = ancestors.length - 1; i >= 0; i--) {
                const ancestor = ancestors[i];

                if (i === ancestors.length - 1) {
                    // This is the container we modified - use updatedChild
                    // Replace in its parent's widget array
                    if (i > 0) {
                        // There's a parent ancestor - update the parent's slot
                        const parentAncestor = ancestors[i - 1];
                        const parentSlotName = effectivePath[i * 2]; // The slot in parent that contains this widget
                        const parentSlotWidgets = parentAncestor.widget.config?.slots?.[parentSlotName] || [];
                        const updatedParentSlotWidgets = parentSlotWidgets.map((w, idx) =>
                            idx === ancestor.widgetIndex ? updatedChild : w
                        );
                        updatedChild = {
                            ...parentAncestor.widget,
                            config: {
                                ...parentAncestor.widget.config,
                                slots: {
                                    ...parentAncestor.widget.config.slots,
                                    [parentSlotName]: updatedParentSlotWidgets
                                }
                            }
                        };
                    }
                } else {
                    // Middle ancestor - updatedChild is already set from previous iteration
                    if (i > 0) {
                        const parentAncestor = ancestors[i - 1];
                        const parentSlotName = effectivePath[i * 2];
                        const parentSlotWidgets = parentAncestor.widget.config?.slots?.[parentSlotName] || [];
                        const updatedParentSlotWidgets = parentSlotWidgets.map((w, idx) =>
                            idx === ancestor.widgetIndex ? updatedChild : w
                        );
                        updatedChild = {
                            ...parentAncestor.widget,
                            config: {
                                ...parentAncestor.widget.config,
                                slots: {
                                    ...parentAncestor.widget.config.slots,
                                    [parentSlotName]: updatedParentSlotWidgets
                                }
                            }
                        };
                    }
                }
            }

            // Update top-level slot with the rebuilt ancestor chain
            const topLevelWidgets = widgets[topSlotName] || [];
            const firstAncestor = ancestors[0];
            const updatedTopLevelWidgets = topLevelWidgets.map((w, idx) =>
                idx === firstAncestor.widgetIndex ? updatedChild : w
            );

            const updatedWidgets = {
                ...widgets,
                [topSlotName]: updatedTopLevelWidgets
            };

            if (onWidgetChange) {
                onWidgetChange(updatedWidgets);
            }

            // Publish update for the topmost container that was modified
            await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: firstAncestor.widget.id,
                slotName: topSlotName,
                contextType: contextType,
                pageId: context?.pageId || webpageData?.id,
                versionId,
                config: updatedChild.config
            });
        } else {
            // Top-level slot paste
            const slotWidgets = [...(widgets[slotName] || [])];

            // Insert pasted widgets at position (IDs already generated above)
            slotWidgets.splice(position, 0, ...pastedWidgets);

            const updatedWidgets = {
                ...widgets,
                [slotName]: slotWidgets
            };

            if (onWidgetChange) {
                onWidgetChange(updatedWidgets);
            }

            // Publish ADD_WIDGET operations for each pasted widget
            for (let i = 0; i < pastedWidgets.length; i++) {
                const widget = pastedWidgets[i];
                await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                    id: widget.id,
                    type: widget.type,
                    config: widget.config,
                    slot: slotName,
                    contextType: contextType,
                    pageId: context?.pageId || webpageData?.id,
                    versionId,
                    order: position + i
                });
            }
        }

        // Handle cut operation - delete from source
        if (isCut && clipboardData.metadata) {
            try {
                await handleDeleteCutWidgets(clipboardData.metadata, preparedCutSource);
            } catch (error) {
                setPasteError(
                    `Widget was pasted, but the cut source was not removed: ${error?.message || 'The source version could not be updated.'}`
                );
                return;
            }
        }

        // Clear clipboard after paste unless shift key was held (or it's a cut operation - always clear for cut)
        if (!keepClipboard || isCut) {
            await clearClipboardState();
        }
    }, [clipboardData, widgets, onWidgetChange, publishUpdate, componentId, contextType, context, webpageData, versionId, prepareCutSourceWidgets, handleDeleteCutWidgets, clearClipboardState]);

    // Get layout component
    const LayoutComponent = getLayoutComponent(layoutName);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        saveWidgets: async () => {
            try {
                // Publish save event to Unified Data Context
                await publishUpdate(componentId, OperationTypes.SAVED_TO_SERVER, {
                    versionId,
                    isPublished,
                    widgets
                });

                return {
                    success: true,
                    data: widgets,
                    module: 'react-layout-renderer',
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.error('ReactLayoutRenderer: Save widgets failed', error);
                throw error;
            }
        },

        // Layout-specific methods
        getLayoutName: () => layoutName,
        getLayoutMetadata: () => getLayoutMetadata(layoutName),
        getCurrentWidgets: () => widgets,
    }), [widgets, layoutName, versionId, isPublished]);

    // Calculate selected count for toolbar
    const selectedCount = getSelectedCount();

    // ESC and right-click handlers to pause paste mode
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && pasteModeActive && !pasteModePaused) {
                // Pause paste mode instead of clearing clipboard
                togglePasteMode();
            }
        };

        const handleContextMenu = (e) => {
            if (pasteModeActive && !pasteModePaused) {
                e.preventDefault();
                // Pause paste mode instead of clearing clipboard
                togglePasteMode();
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [pasteModeActive, pasteModePaused, togglePasteMode]);

    // Reset toolbar collapse when selection changes
    useEffect(() => {
        if (selectedCount === 0) {
            setIsToolbarCollapsed(false);
        }
    }, [selectedCount]);

    if (!LayoutComponent) {
        const availableLayouts = Object.keys(LAYOUT_REGISTRY);

        return (
            <div className="layout-error bg-red-50 border border-red-200 rounded-lg p-8 max-w-2xl mx-auto mt-8">
                <Layout className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <div className="text-lg font-medium text-red-800 mb-2" role="heading" aria-level="3">Layout Not Found</div>
                <div className="text-red-600 mb-6">Layout "{layoutName}" is not available</div>

                <div className="mt-4 text-sm text-gray-600">
                    <div className="font-medium mb-1">Available layouts:</div>
                    <div className="text-gray-500">{availableLayouts.join(', ')}</div>
                </div>
            </div>
        );
    }

    // Render the layout component
    // Make this div act like an iframe - break out of parent constraints and use full viewport width
    return (
        <div className="react-layout-renderer w-full h-full relative cms-content" data-testid="page-editor-surface">
            {/* Bulk Action Toolbar - Floating */}
            {selectedCount > 0 && (
                <>
                    {isToolbarCollapsed ? (
                        // Collapsed: Small floating button in top right
                        <button
                            onClick={() => setIsToolbarCollapsed(false)}
                            className="fixed top-4 right-4 z-[10005] bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all hover:scale-110 flex items-center justify-center"
                            title={`${selectedCount} widget${selectedCount !== 1 ? 's' : ''} selected - Click to expand`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{selectedCount}</span>
                                <ChevronUp className="h-4 w-4" />
                            </div>
                        </button>
                    ) : (
                        // Expanded: Full toolbar
                        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[10005] bg-white border border-gray-300 rounded-lg shadow-xl px-4 py-2 flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">
                                {selectedCount} widget{selectedCount !== 1 ? 's' : ''} selected
                            </span>
                            <div className="h-4 w-px bg-gray-300"></div>
                            <button
                                onClick={handleCopySelected}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                                title="Copy selected widgets"
                            >
                                <Clipboard className="h-4 w-4" />
                                Copy
                            </button>
                            <button
                                onClick={handleCutSelected}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                                title="Cut selected widgets"
                            >
                                <Scissors className="h-4 w-4" />
                                Cut
                            </button>
                            <button
                                onClick={clearSelection}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                                title="Clear selection"
                            >
                                <X className="h-4 w-4" />
                                Clear
                            </button>
                            <div className="h-4 w-px bg-gray-300"></div>
                            <button
                                onClick={() => setIsToolbarCollapsed(true)}
                                className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                                title="Collapse toolbar"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </>
            )}

            {pasteError && (
                <div
                    role="alert"
                    className="mx-4 mb-4 flex items-start justify-between gap-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                    <span>{pasteError}</span>
                    <button
                        type="button"
                        onClick={() => setPasteError(null)}
                        className="font-medium text-amber-800 hover:text-amber-950"
                        aria-label="Dismiss paste error"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <LayoutComponent
                widgets={widgets}
                onWidgetAction={handleWidgetAction}
                editable={editable}
                pageContext={pageContext}
                namespace={namespace}
                onShowWidgetModal={handleShowWidgetModal}
                onImportContent={handleImportContent}
                onClearSlot={handleClearSlot}
                widgetPath={[]} // Initialize empty path for top-level
                // Widget inheritance
                inheritedWidgets={inheritedWidgets}
                slotInheritanceRules={slotInheritanceRules}
                // Selection props - pass to all WidgetSlots and container widgets
                selectedWidgets={selectedWidgets}
                cutWidgets={cutWidgets}
                onToggleWidgetSelection={toggleWidgetSelection}
                isWidgetSelected={isWidgetSelected}
                isWidgetCut={isWidgetCut}
                onDeleteCutWidgets={handleDeleteCutWidgets}
                buildWidgetPath={buildWidgetPath}
                parseWidgetPath={parseWidgetPath}
                // Paste mode props
                pasteModeActive={pasteModeActive}
                onPasteAtPosition={handlePasteAtPosition}
            />

            {/* Widget Selection Modal */}
            <PageWidgetSelectionModal
                isOpen={widgetModalOpen}
                onClose={handleCloseWidgetModal}
                onWidgetSelect={handleWidgetSelection}
                slotName={selectedSlotForModal}
                slotLabel={selectedSlotMetadata?.label || selectedSlotForModal}
                allowedWidgetTypes={selectedSlotMetadata?.allowedWidgetTypes}
            />

            <ImportDialog
                isOpen={importDialogOpen}
                onClose={() => {
                    setImportDialogOpen(false);
                    setImportSlotName(null);
                }}
                slotName={importSlotName}
                pageId={webpageData?.id}
                onImportComplete={handleImportComplete}
            />
        </div>
    );
});

ReactLayoutRenderer.displayName = 'ReactLayoutRenderer';

export default ReactLayoutRenderer;
