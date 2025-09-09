/**
 * WidgetSlot - React component for rendering widget slots
 * 
 * This component renders a slot area where widgets can be placed.
 * It handles widget rendering, empty states, and slot management.
 */

import React from 'react';
import { Layout, Plus } from 'lucide-react';
import PageWidgetFactory from '../PageWidgetFactory';

const WidgetSlot = ({
    name,
    label,
    description,
    widgets = [],
    onWidgetAction,
    editable = true,
    pageContext = {},
    className = '',
    allowedWidgetTypes = ['*'],
    maxWidgets = 10,
    required = false
}) => {
    // Handle widget actions
    const handleWidgetAction = (action, widget, ...args) => {
        if (onWidgetAction) {
            onWidgetAction(action, name, widget, ...args);
        }
    };

    // Handle add widget
    const handleAddWidget = () => {
        handleWidgetAction('add', null, 'core_widgets.ContentWidget');
    };

    // Render individual widget
    const renderWidget = (widget, index) => {
        return (
            <div key={widget.id || index} className="mb-4">
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
                    canMoveDown={index < widgets.length - 1}
                    mode="editor"
                    showControls={editable}
                    // PageEditor-specific props
                    versionId={pageContext.versionId}
                    isPublished={pageContext.isPublished}
                    onVersionChange={pageContext.onVersionChange}
                    onPublishingAction={pageContext.onPublishingAction}
                />
            </div>
        );
    };

    return (
        <div className={`widget-slot ${className}`} data-slot-name={name}>
            {/* Slot Header */}
            {editable && (
                <div className="slot-header bg-gray-100 border border-gray-300 rounded-t-lg px-4 py-3 flex items-center justify-between">
                    <div>
                        <div className="flex items-center space-x-2">
                            <Layout className="h-4 w-4 text-gray-600" />
                            <span className="font-medium text-gray-900">{label}</span>
                            {required && (
                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                    Required
                                </span>
                            )}
                            {pageContext.isPublished && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                    Published
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            {description} • {widgets.length}/{maxWidgets === Infinity ? '∞' : maxWidgets} widgets
                        </div>
                    </div>

                    <button
                        onClick={handleAddWidget}
                        disabled={widgets.length >= maxWidgets}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Widget
                    </button>
                </div>
            )}

            {/* Slot Content */}
            <div className={`slot-content ${editable ? 'border border-gray-300 border-t-0 rounded-b-lg p-4' : ''}`}>
                {widgets.length > 0 ? (
                    <div className="widgets-list space-y-2">
                        {widgets.map((widget, index) => renderWidget(widget, index))}
                    </div>
                ) : (
                    <div className="empty-slot text-center py-12 text-gray-500">
                        <Layout className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">{label}</h4>
                        <p className="text-sm">{description}</p>
                        {editable && (
                            <div className="mt-4">
                                <button
                                    onClick={handleAddWidget}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Your First Widget
                                </button>
                            </div>
                        )}
                        {required && (
                            <p className="text-xs text-orange-600 mt-2">This slot is required</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WidgetSlot;
