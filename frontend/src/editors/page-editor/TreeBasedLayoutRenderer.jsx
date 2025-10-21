/**
 * Tree-Based Layout Renderer
 * 
 * Simplified layout renderer using inheritance tree structure.
 * This replaces the complex merge logic with simple tree queries.
 */

import React, { useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react'
import { Layout } from 'lucide-react'
import { getLayoutComponent, LAYOUT_REGISTRY } from '../../layouts'
import { useInheritanceTree } from '../../hooks/useInheritanceTree'
import PageWidgetSelectionModal from './PageWidgetSelectionModal'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'


const TreeBasedLayoutRenderer = forwardRef(({
    layoutName = 'main_layout',  // Default to main_layout (available layout)
    widgets = {},
    onWidgetChange,
    editable = true,
    pageId,
    // PageEditor-specific props
    currentVersion,
    pageVersionData,
    onVersionChange,
    onOpenWidgetEditor,
    context,
    sharedComponentId
}, ref) => {

    // Use tree-based inheritance (much simpler!)
    const { tree, helpers, isLoading } = useInheritanceTree(pageId)

    // Get UDC context
    const { publishUpdate } = useUnifiedData()
    const { addNotification } = useGlobalNotifications()

    // Layout selector state - MUST be at top level (Rules of Hooks)
    const [selectedLayout, setSelectedLayout] = useState(Object.keys(LAYOUT_REGISTRY)[0] || 'main_layout');
    const [isSavingLayout, setIsSavingLayout] = useState(false);

    // Component state
    const [widgetModalOpen, setWidgetModalOpen] = useState(false)
    const [selectedSlotForModal, setSelectedSlotForModal] = useState(null)
    const componentId = sharedComponentId || `tree-renderer-${pageId}`

    // Widget action handler (simplified with tree queries)
    const handleWidgetAction = useCallback(async (action, slotName, widget, ...args) => {
        if (!helpers) return

        switch (action) {
            case 'delete': {
                const deleteIndex = args[0]

                // Update local widgets
                const updatedWidgets = { ...widgets }
                if (updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = updatedWidgets[slotName].filter((_, i) => i !== deleteIndex)
                }

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgets, { sourceId: widget.id })
                }

                // Publish to UDC
                await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                    id: widget.id,
                    contextType: 'page'
                })

                break
            }

            case 'add': {
                const widgetType = args[0]

                // Create new widget
                const newWidget = {
                    id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: widgetType,
                    config: {},
                    order: widgets[slotName]?.length || 0
                }

                // Update local widgets
                const updatedWidgets = { ...widgets }
                if (!updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = []
                }
                updatedWidgets[slotName] = [...updatedWidgets[slotName], newWidget]

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgets, { sourceId: newWidget.id })
                }

                // Publish to UDC
                await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                    id: newWidget.id,
                    type: widgetType,
                    slot: slotName,
                    contextType: 'page'
                })

                break
            }
        }
    }, [helpers, widgets, onWidgetChange, publishUpdate, componentId])

    // Simplified slot data provider using tree queries
    const getSlotData = useCallback((slotName) => {
        if (!helpers) return { local: [], inherited: [], merged: [] }

        return {
            local: helpers.getLocalWidgets(slotName),
            inherited: helpers.getInheritedWidgets(slotName),
            merged: helpers.getMergedWidgets(slotName, { mode: 'edit' }),
            hasInherited: helpers.hasInheritedContent(slotName),
            hasLocal: helpers.hasLocalContent(slotName)
        }
    }, [helpers])

    // Widget modal handlers
    const handleShowWidgetModal = useCallback((slotName) => {
        setSelectedSlotForModal(slotName)
        setWidgetModalOpen(true)
    }, [])

    const handleCloseWidgetModal = useCallback(() => {
        setWidgetModalOpen(false)
        setSelectedSlotForModal(null)
    }, [])

    const handleWidgetSelection = useCallback((widgetType) => {
        if (selectedSlotForModal) {
            handleWidgetAction('add', selectedSlotForModal, null, widgetType)
        }
        handleCloseWidgetModal()
    }, [selectedSlotForModal, handleWidgetAction, handleCloseWidgetModal])

    // Loading state
    if (isLoading) {
        return (
            <div className="tree-renderer-loading p-8 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading inheritance tree...</p>
            </div>
        )
    }

    // Error state 
    if (!tree) {
        return (
            <div className="tree-renderer-error bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <Layout className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-medium text-red-800 mb-2">Tree Generation Failed</h3>
                <p className="text-red-600">Could not build inheritance tree for this page</p>
            </div>
        )
    }

    // Get layout component
    const LayoutComponent = getLayoutComponent(layoutName)

    // Handle layout save (defined here so it's available for the error UI)
    const handleSaveLayout = async () => {
        if (!selectedLayout) return;

        setIsSavingLayout(true);
        try {
            // Update the page version data with the new layout
            // onWidgetChange expects (widgets, data) where data can contain page metadata
            if (onWidgetChange) {
                // Pass current widgets and include codeLayout in the data parameter
                await onWidgetChange(widgets, { codeLayout: selectedLayout });
                addNotification(`Layout changed to "${selectedLayout.replace(/_/g, ' ')}". Save the page to persist this change.`, 'success');
            }
            // The parent will re-render with the new layout
        } catch (error) {
            console.error('Failed to save layout:', error);
            addNotification('Failed to apply layout. Please try again.', 'error');
        } finally {
            setIsSavingLayout(false);
        }
    };

    if (!LayoutComponent) {
        const availableLayouts = Object.keys(LAYOUT_REGISTRY);

        return (
            <div className="layout-error bg-red-50 border border-red-200 rounded-lg p-8 max-w-2xl mx-auto mt-8">
                <Layout className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-medium text-red-800 mb-2">Layout Not Found</h3>
                <p className="text-red-600 mb-6">Layout "{layoutName}" is not available</p>

                <div className="bg-white rounded-lg p-6 border border-red-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Choose a layout to continue:
                    </label>
                    <select
                        value={selectedLayout}
                        onChange={(e) => setSelectedLayout(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isSavingLayout}
                    >
                        {availableLayouts.map(layout => (
                            <option key={layout} value={layout}>
                                {layout.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={handleSaveLayout}
                        disabled={isSavingLayout || !selectedLayout}
                        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSavingLayout ? 'Saving...' : 'Save and Apply Layout'}
                    </button>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium mb-1">Available layouts:</p>
                    <p className="text-gray-500">{availableLayouts.join(', ')}</p>
                </div>
            </div>
        )
    }

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        updateWidget: (slotName, index, updatedWidget) => {
            // Implementation for widget updates
        },
        getSlotData
    }))

    // Render layout with tree-based data
    return (
        <div className="tree-based-layout-renderer w-full h-full">
            <LayoutComponent
                widgets={widgets}
                onWidgetAction={handleWidgetAction}
                editable={editable}
                pageContext={{ pageId, mode: 'edit' }}
                onShowWidgetModal={handleShowWidgetModal}
                // NEW: Pass tree and helpers to layout components
                inheritanceTree={tree}
                treeHelpers={helpers}
                getSlotData={getSlotData}
                widgetPath={[]}
            />

            {/* Widget Selection Modal */}
            <PageWidgetSelectionModal
                isOpen={widgetModalOpen}
                onClose={handleCloseWidgetModal}
                onWidgetSelect={handleWidgetSelection}
                slotName={selectedSlotForModal}
                slotLabel={selectedSlotForModal}
            />
        </div>
    )
})

TreeBasedLayoutRenderer.displayName = 'TreeBasedLayoutRenderer'

export default TreeBasedLayoutRenderer
