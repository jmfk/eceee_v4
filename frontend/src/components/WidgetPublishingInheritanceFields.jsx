import React, { useState, useCallback, useEffect } from 'react'
import { Eye, EyeOff, Calendar, Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'

/**
 * WidgetPublishingInheritanceFields - Publishing and inheritance controls for widgets
 * 
 * Displays fields for:
 * - Publishing on/off switch (is_published)
 * - Inheritance level (inheritance_level: 0 = page only, -1 = infinite)
 * - Inherit from parent flag (inherit_from_parent)
 * - Effective date (publish_effective_date)
 * - Expire date (publish_expire_date)
 * 
 * Integrated with UDC for real-time updates
 */
const WidgetPublishingInheritanceFields = ({
    widgetData,
    widgetType,
    contextType,
    componentId
}) => {
    const { publishUpdate } = useUnifiedData()

    // Get default inheritance level from widget type
    const defaultInheritanceLevel = widgetType?.default_inheritance_level ?? 0

    // Accordion state - closed by default
    const [isExpanded, setIsExpanded] = useState(false)

    // Use local state for immediate UI updates (camelCase for frontend)
    const [localValues, setLocalValues] = useState({
        isPublished: widgetData?.isPublished ?? widgetData?.is_published ?? true,
        inheritanceLevel: widgetData?.inheritanceLevel ?? widgetData?.inheritance_level ?? defaultInheritanceLevel,
        inheritFromParent: widgetData?.inheritFromParent ?? widgetData?.inherit_from_parent ?? true,
        publishEffectiveDate: widgetData?.publishEffectiveDate ?? widgetData?.publish_effective_date ?? '',
        publishExpireDate: widgetData?.publishExpireDate ?? widgetData?.publish_expire_date ?? ''
    })

    // Sync local state when widgetData changes
    useEffect(() => {
        setLocalValues({
            isPublished: widgetData?.isPublished ?? widgetData?.is_published ?? true,
            inheritanceLevel: widgetData?.inheritanceLevel ?? widgetData?.inheritance_level ?? defaultInheritanceLevel,
            inheritFromParent: widgetData?.inheritFromParent ?? widgetData?.inherit_from_parent ?? true,
            publishEffectiveDate: widgetData?.publishEffectiveDate ?? widgetData?.publish_effective_date ?? '',
            publishExpireDate: widgetData?.publishExpireDate ?? widgetData?.publish_expire_date ?? ''
        })
    }, [widgetData, defaultInheritanceLevel])

    const handleFieldChange = useCallback(async (field, value) => {
        // Update local state immediately for UI responsiveness
        setLocalValues(prev => ({ ...prev, [field]: value }))

        // Publish widget-level update through UDC
        await publishUpdate(componentId, 'UPDATE_WIDGET_CONFIG', {
            id: widgetData?.id,
            slotName: widgetData?.slotName || widgetData?.slot,
            contextType: contextType,
            widgetUpdates: {
                [field]: value
            }
        })
    }, [widgetData, contextType, componentId, publishUpdate])

    return (
        <div className="border-t border-gray-200 bg-gray-50">
            {/* Accordion Header */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 transition-colors"
            >
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Publishing & Inheritance
                    {!localValues.isPublished && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Unpublished
                        </span>
                    )}
                    {localValues.inheritanceLevel === -1 && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Infinite
                        </span>
                    )}
                    {localValues.inheritanceLevel > 0 && (
                        <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            {localValues.inheritanceLevel}L
                        </span>
                    )}
                </h3>
                {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
            </button>

            {/* Accordion Content */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Publishing Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            {localValues.isPublished ? (
                                <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                                <EyeOff className="w-4 h-4 text-gray-400" />
                            )}
                            Published
                        </label>
                        <button
                            type="button"
                            onClick={() => handleFieldChange('isPublished', !localValues.isPublished)}
                            className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        ${localValues.isPublished ? 'bg-green-600' : 'bg-gray-300'}
                    `}
                            role="switch"
                            aria-checked={localValues.isPublished}
                        >
                            <span
                                className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${localValues.isPublished ? 'translate-x-6' : 'translate-x-1'}
                        `}
                            />
                        </button>
                    </div>

                    {/* Inheritance Level */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Inheritance Level
                        </label>
                        <select
                            value={localValues.inheritanceLevel}
                            onChange={(e) => handleFieldChange('inheritanceLevel', parseInt(e.target.value, 10))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value={-1}>Infinite (All descendants)</option>
                            <option value={0}>Page Only (Not inherited)</option>
                            <option value={1}>1 Level (Direct children only)</option>
                            <option value={2}>2 Levels</option>
                            <option value={3}>3 Levels</option>
                            <option value={4}>4 Levels</option>
                            <option value={5}>5 Levels</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                            {localValues.inheritanceLevel === -1 && 'Widget visible on all descendant pages'}
                            {localValues.inheritanceLevel === 0 && 'Widget only visible on this page'}
                            {localValues.inheritanceLevel > 0 && `Widget visible ${localValues.inheritanceLevel} level${localValues.inheritanceLevel > 1 ? 's' : ''} deep`}
                        </p>
                    </div>

                    {/* Inherit From Parent Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                            Can Be Inherited
                        </label>
                        <button
                            type="button"
                            onClick={() => handleFieldChange('inheritFromParent', !localValues.inheritFromParent)}
                            className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        ${localValues.inheritFromParent ? 'bg-blue-600' : 'bg-gray-300'}
                    `}
                            role="switch"
                            aria-checked={localValues.inheritFromParent}
                        >
                            <span
                                className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${localValues.inheritFromParent ? 'translate-x-6' : 'translate-x-1'}
                        `}
                            />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 -mt-2">
                        Master switch for inheritance (overrides level)
                    </p>

                    {/* Effective Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Effective Date (Optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={localValues.publishEffectiveDate ? new Date(localValues.publishEffectiveDate).toISOString().slice(0, 16) : ''}
                            onChange={(e) => handleFieldChange('publishEffectiveDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Widget becomes visible on this date/time
                        </p>
                    </div>

                    {/* Expire Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Expire Date (Optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={localValues.publishExpireDate ? new Date(localValues.publishExpireDate).toISOString().slice(0, 16) : ''}
                            onChange={(e) => handleFieldChange('publishExpireDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Widget stops being visible on this date/time
                        </p>
                    </div>

                    {/* Info box about inheritance + publishing */}
                    {!localValues.isPublished && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <p className="text-xs text-yellow-800">
                                <strong>Note:</strong> Unpublished widgets are not inherited by child pages, regardless of inheritance settings.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default WidgetPublishingInheritanceFields
