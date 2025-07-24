import {
    Trash2,
    Edit3,
    Eye,
    EyeOff,
    ArrowUp,
    ArrowDown,
    GripVertical,
    Hash
} from 'lucide-react'
import { createWidgetModel } from '../../utils/widgetHelpers'

// Extracted component for widget action buttons
const WidgetActionButtons = ({
    widget,
    index,
    totalWidgets,
    onEdit,
    onDelete,
    onMove,
    onVisibilityToggle
}) => (
    <div className="flex items-center space-x-1">
        {/* Visibility toggle */}
        {!createWidgetModel(widget, widget.widget_type).isInherited() && (
            <button
                onClick={() => onVisibilityToggle(widget)}
                className={`p-1 ${createWidgetModel(widget, widget.widget_type).isVisible()
                    ? 'text-green-600 hover:text-green-700'
                    : 'text-gray-400 hover:text-gray-600'
                    }`}
                title={createWidgetModel(widget, widget.widget_type).isVisible() ? 'Hide widget' : 'Show widget'}
            >
                {createWidgetModel(widget, widget.widget_type).isVisible() ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
        )}

        {/* Move buttons */}
        {!createWidgetModel(widget, widget.widget_type).isInherited() && (
            <>
                <button
                    onClick={() => onMove(widget, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Move up"
                >
                    <ArrowUp className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onMove(widget, 'down')}
                    disabled={index === totalWidgets - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Move down"
                >
                    <ArrowDown className="w-4 h-4" />
                </button>
            </>
        )}

        {/* Edit button */}
        <button
            onClick={() => onEdit(widget)}
            className="p-1 text-blue-600 hover:text-blue-700"
            title="Edit widget"
        >
            <Edit3 className="w-4 h-4" />
        </button>

        {/* Delete button */}
        {!createWidgetModel(widget, widget.widget_type).isInherited() && (
            <button
                onClick={() => onDelete(widget)}
                className="p-1 text-red-600 hover:text-red-700"
                title="Delete widget"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        )}
    </div>
)

// Extracted component for widget priority controls
const WidgetPriorityControls = ({ widget, onPriorityChange }) => {
    const widgetModel = createWidgetModel(widget, widget.widget_type)
    if (widgetModel.isInherited()) return null

    return (
        <div className="flex items-center space-x-4 pt-2 border-t border-gray-100">
            <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">Priority:</label>
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={widgetModel.getPriority()}
                    onChange={(e) => onPriorityChange(widget, e.target.value)}
                    className="w-16 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>
            <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">
                    Behavior: {widgetModel.getInheritanceBehavior()}
                </span>
            </div>
            {widget.max_inheritance_depth && (
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600">
                        Max depth: {widget.max_inheritance_depth}
                    </span>
                </div>
            )}
        </div>
    )
}

// Extracted component for individual widget card
const WidgetCard = ({
    widget,
    index,
    totalWidgets,
    onEdit,
    onDelete,
    onMove,
    onVisibilityToggle,
    onPriorityChange
}) => {
    // Use WidgetModel for cleaner property access
    const widgetModel = createWidgetModel(widget, widget.widget_type)

    return (
        <div className={`p-3 border rounded-lg transition-colors ${widgetModel.getCardClasses()}`}>
            {/* Widget Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                    <div className="flex items-center space-x-2">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <h5 className="font-medium text-gray-900">
                            {widgetModel.getTypeName()}
                        </h5>
                        {widgetModel.isInherited() && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Inherited
                            </span>
                        )}
                        {widgetModel.getPriority() > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                <Hash className="w-3 h-3 mr-1" />
                                {widgetModel.getPriority()}
                            </span>
                        )}
                        {!widgetModel.isVisible() && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                Hidden
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {widgetModel.getTypeDescription()}
                    </p>
                </div>

                <WidgetActionButtons
                    widget={widget}
                    index={index}
                    totalWidgets={totalWidgets}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMove={onMove}
                    onVisibilityToggle={onVisibilityToggle}
                />
            </div>

            <WidgetPriorityControls
                widget={widget}
                onPriorityChange={onPriorityChange}
            />
        </div>
    )
}

export default WidgetCard 