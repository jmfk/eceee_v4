import { useState, useCallback } from 'react'
import {
    Plus,
    Target,
    XCircle,
    AlertTriangle,
    Info,
    Layers
} from 'lucide-react'
import WidgetCard from './WidgetCard'

/**
 * Enhanced HTML Slot Card Component for template-based layouts
 * 
 * Provides a comprehensive interface for managing HTML slots including:
 * - Slot validation and error display
 * - Widget management within slots
 * - Visual slot interaction and highlighting
 * - Slot metadata display
 */
const HtmlSlotCard = ({
    slot,
    widgets = [],
    isActive = false,
    onAddWidget,
    onEditWidget,
    onDeleteWidget,
    onSlotClick,
    onVisibilityToggle,
    onPriorityChange
}) => {
    const [isHighlighted, setIsHighlighted] = useState(false)

    const handleSlotClick = useCallback(() => {
        if (onSlotClick) onSlotClick(slot)
        setIsHighlighted(!isHighlighted)
    }, [slot, onSlotClick, isHighlighted])

    const slotValidation = slot.isValid ?
        { isValid: true, errors: [], warnings: [] } :
        { isValid: false, errors: slot.errors || [], warnings: slot.warnings || [] }

    return (
        <div className={`
            bg-white border rounded-lg transition-all duration-200
            ${isActive ? 'border-blue-500 shadow-lg' : 'border-gray-200'}
            ${isHighlighted ? 'ring-2 ring-blue-200' : ''}
            ${!slotValidation.isValid ? 'border-red-300 bg-red-50' : ''}
        `}>
            {/* Slot Header */}
            <div
                className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                onClick={handleSlotClick}
            >
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center space-x-2">
                            <Target className="w-4 h-4 text-gray-400" />
                            <h4 className="font-medium text-gray-900">
                                {slot.display_name || slot.name}
                            </h4>
                            {!slotValidation.isValid && (
                                <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            {slotValidation.isValid && widgets.length === 0 && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    Empty
                                </span>
                            )}
                            {widgets.length > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                                    {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
                                </span>
                            )}
                            {slot.max_widgets && (
                                <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded">
                                    Max: {slot.max_widgets}
                                </span>
                            )}
                        </div>
                        {slot.description && (
                            <p className="text-sm text-gray-500 mt-1">
                                {slot.description}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onAddWidget(slot)
                        }}
                        disabled={slot.max_widgets && widgets.length >= slot.max_widgets}
                        className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Widget
                    </button>
                </div>

                {/* Validation Errors */}
                {!slotValidation.isValid && (
                    <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-sm">
                        <div className="flex items-center space-x-1 text-red-700 font-medium mb-1">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Slot Validation Errors</span>
                        </div>
                        <ul className="text-red-600 space-y-1 text-xs">
                            {slotValidation.errors.map((error, index) => (
                                <li key={index}>• {error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Validation Warnings */}
                {slotValidation.warnings.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-100 border border-yellow-200 rounded text-sm">
                        <div className="flex items-center space-x-1 text-yellow-700 font-medium mb-1">
                            <Info className="w-4 h-4" />
                            <span>Warnings</span>
                        </div>
                        <ul className="text-yellow-600 space-y-1 text-xs">
                            {slotValidation.warnings.map((warning, index) => (
                                <li key={index}>• {warning}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Slot Widgets */}
            <div className="p-4">
                {widgets.length > 0 ? (
                    <div className="space-y-3">
                        {widgets.map((widget, index) => (
                            <WidgetCard
                                key={widget.id}
                                widget={widget}
                                index={index}
                                totalWidgets={widgets.length}
                                onEdit={onEditWidget}
                                onDelete={onDeleteWidget}
                                onMove={() => {
                                    // HTML slots don't support traditional move operations
                                    // This could be enhanced with drag-and-drop in the future
                                    console.info('Widget reordering in HTML slots will be available soon')
                                }}
                                onVisibilityToggle={onVisibilityToggle}
                                onPriorityChange={onPriorityChange}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <Layers className="w-6 h-6 mx-auto mb-2" />
                        <p className="text-sm">No widgets in this slot</p>
                        <p className="text-xs">Click "Add Widget" to get started</p>
                        {slot.allowed_widget_types && slot.allowed_widget_types.length > 0 && (
                            <p className="text-xs mt-1 text-gray-400">
                                Accepts: {slot.allowed_widget_types.join(', ')}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Slot Debug Info (development only) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="border-t border-gray-200 p-3 bg-gray-50">
                    <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                            Debug Info
                        </summary>
                        <div className="mt-2 space-y-1 text-gray-500">
                            <div>Selector: {slot.selector}</div>
                            <div>Element: {slot.element ? 'Available' : 'Missing'}</div>
                            <div>CSS Classes: {slot.css_classes || 'None'}</div>
                            {slot.responsive && <div>Responsive: Yes</div>}
                        </div>
                    </details>
                </div>
            )}
        </div>
    )
}

export default HtmlSlotCard 