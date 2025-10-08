/**
 * Tree-Based Widget Slot
 * 
 * Simplified widget slot component using inheritance tree helpers.
 * Replaces complex state management with simple tree queries.
 */

import React, { useState } from 'react'
import { Plus, Eye, EyeOff } from 'lucide-react'
import PageWidgetFactory from '../../editors/page-editor/PageWidgetFactory'


const TreeBasedWidgetSlot = ({
    name,
    label,
    widgets = {},
    onWidgetAction,
    editable = true,
    pageContext = {},
    onShowWidgetModal,
    // Tree-based props (much simpler!)
    treeHelpers,
    getSlotData
}) => {

    // Simple mode state
    const [mode, setMode] = useState('edit')
    const isPreviewMode = mode === 'preview'

    // Get slot data using tree helpers (replaces complex inheritance logic)
    const slotData = getSlotData ? getSlotData(name) : {
        local: widgets[name] || [],
        inherited: [],
        merged: widgets[name] || [],
        hasInherited: false,
        hasLocal: (widgets[name] || []).length > 0
    }

    // Simple rendering logic (replaces 200+ lines of complex merge logic)
    const renderWidget = (widget, index) => (
        <PageWidgetFactory
            key={widget.id}
            widget={widget}
            slotName={name}
            index={index}
            onDelete={(slotName, index, widget) => onWidgetAction('delete', slotName, widget, index)}
            onEdit={(slotName, index, widget) => onWidgetAction('edit', slotName, widget, index)}
            mode="editor"
            showControls={editable}
            isInherited={widget.isInherited}
            contextType="page"
            parentComponentId={pageContext.componentId}
        />
    )

    // Handle mode toggle
    const handleModeToggle = () => {
        setMode(mode === 'edit' ? 'preview' : 'edit')
    }

    // Handle add widget
    const handleAddWidget = () => {
        if (onShowWidgetModal) {
            onShowWidgetModal(name)
        }
    }

    return (
        <div className={`widget-slot slot-${name} ${isPreviewMode ? 'preview-mode' : 'edit-mode'}`}>

            {/* Slot Header */}
            <div className="slot-header flex items-center justify-between mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="slot-info">
                    <h3 className="text-sm font-semibold text-gray-700">{label || name}</h3>
                    <p className="text-xs text-gray-500">
                        {slotData.hasLocal && slotData.hasInherited
                            ? `${slotData.local.length} local + ${slotData.inherited.length} inherited`
                            : slotData.hasLocal
                                ? `${slotData.local.length} local widget${slotData.local.length !== 1 ? 's' : ''}`
                                : slotData.hasInherited
                                    ? `${slotData.inherited.length} inherited widget${slotData.inherited.length !== 1 ? 's' : ''}`
                                    : 'Empty slot'
                        }
                    </p>
                </div>

                <div className="slot-controls flex items-center gap-2">
                    {/* Mode Toggle */}
                    <button
                        onClick={handleModeToggle}
                        className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                        title={isPreviewMode ? 'Switch to edit mode' : 'Switch to preview mode'}
                    >
                        {isPreviewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {/* Add Widget Button */}
                    {editable && (
                        <button
                            onClick={handleAddWidget}
                            className="p-2 hover:bg-blue-100 text-blue-600 rounded-md transition-colors"
                            title="Add widget"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Widget Rendering - MASSIVELY SIMPLIFIED! */}
            <div className="slot-content">
                {isPreviewMode ? (
                    // Preview mode: Show merged result
                    <div className="preview-widgets">
                        {slotData.merged.length > 0 ? (
                            slotData.merged.map((widget, index) => renderWidget(widget, index))
                        ) : (
                            <div className="empty-slot text-center py-8 text-gray-500">
                                <p>No content in this slot</p>
                            </div>
                        )}
                    </div>
                ) : (
                    // Edit mode: Show inherited + local separately  
                    <div className="edit-widgets">
                        {/* Inherited Widgets (Read-only) */}
                        {slotData.inherited.length > 0 && (
                            <div className="inherited-section mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="text-sm font-medium text-blue-800 mb-2">
                                    Inherited from parent page
                                </h4>
                                {slotData.inherited.map((widget, index) =>
                                    renderWidget({ ...widget, isInherited: true }, index)
                                )}
                            </div>
                        )}

                        {/* Local Widgets (Editable) */}
                        <div className="local-section">
                            {slotData.local.length > 0 ? (
                                slotData.local.map((widget, index) => renderWidget(widget, index))
                            ) : slotData.inherited.length > 0 ? (
                                <div className="add-local-widgets text-center py-6">
                                    <button
                                        onClick={handleAddWidget}
                                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Your Widget
                                    </button>
                                    <p className="text-xs text-gray-600 mt-2">
                                        Add widgets here to customize this slot
                                    </p>
                                </div>
                            ) : (
                                <div className="empty-slot text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                                    <button
                                        onClick={handleAddWidget}
                                        className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add First Widget
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default TreeBasedWidgetSlot
