import React, { useState, useCallback, useEffect } from 'react'
import { Eye, EyeOff, Calendar, Layers } from 'lucide-react'
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

    // Use local state for immediate UI updates
    const [localValues, setLocalValues] = useState({
        is_published: widgetData?.is_published ?? true,
        inheritance_level: widgetData?.inheritance_level ?? defaultInheritanceLevel,
        inherit_from_parent: widgetData?.inherit_from_parent ?? true,
        publish_effective_date: widgetData?.publish_effective_date ?? '',
        publish_expire_date: widgetData?.publish_expire_date ?? ''
    })

    // Sync local state when widgetData changes
    useEffect(() => {
        setLocalValues({
            is_published: widgetData?.is_published ?? true,
            inheritance_level: widgetData?.inheritance_level ?? defaultInheritanceLevel,
            inherit_from_parent: widgetData?.inherit_from_parent ?? true,
            publish_effective_date: widgetData?.publish_effective_date ?? '',
            publish_expire_date: widgetData?.publish_expire_date ?? ''
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
        <div className="space-y-4 p-4 border-t border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Publishing & Inheritance
            </h3>

            {/* Publishing Toggle */}
            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    {localValues.is_published ? (
                        <Eye className="w-4 h-4 text-green-600" />
                    ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                    Published
                </label>
                <button
                    type="button"
                    onClick={() => handleFieldChange('is_published', !localValues.is_published)}
                    className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        ${localValues.is_published ? 'bg-green-600' : 'bg-gray-300'}
                    `}
                    role="switch"
                    aria-checked={localValues.is_published}
                >
                    <span
                        className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${localValues.is_published ? 'translate-x-6' : 'translate-x-1'}
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
                    value={localValues.inheritance_level}
                    onChange={(e) => handleFieldChange('inheritance_level', parseInt(e.target.value, 10))}
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
                    {localValues.inheritance_level === -1 && 'Widget visible on all descendant pages'}
                    {localValues.inheritance_level === 0 && 'Widget only visible on this page'}
                    {localValues.inheritance_level > 0 && `Widget visible ${localValues.inheritance_level} level${localValues.inheritance_level > 1 ? 's' : ''} deep`}
                </p>
            </div>

            {/* Inherit From Parent Toggle */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                    Can Be Inherited
                </label>
                <button
                    type="button"
                    onClick={() => handleFieldChange('inherit_from_parent', !localValues.inherit_from_parent)}
                    className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        ${localValues.inherit_from_parent ? 'bg-blue-600' : 'bg-gray-300'}
                    `}
                    role="switch"
                    aria-checked={localValues.inherit_from_parent}
                >
                    <span
                        className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${localValues.inherit_from_parent ? 'translate-x-6' : 'translate-x-1'}
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
                    value={localValues.publish_effective_date ? new Date(localValues.publish_effective_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) => handleFieldChange('publish_effective_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
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
                    value={localValues.publish_expire_date ? new Date(localValues.publish_expire_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) => handleFieldChange('publish_expire_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Widget stops being visible on this date/time
                </p>
            </div>

            {/* Info box about inheritance + publishing */}
            {!localValues.is_published && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs text-yellow-800">
                        <strong>Note:</strong> Unpublished widgets are not inherited by child pages, regardless of inheritance settings.
                    </p>
                </div>
            )}
        </div>
    )
}

export default WidgetPublishingInheritanceFields
