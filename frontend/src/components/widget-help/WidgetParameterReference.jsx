import React, { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'

/**
 * Widget Parameter Reference Component
 * 
 * Displays a comprehensive table of all template parameters available in widget templates
 * including configuration fields and computed parameters.
 */
const WidgetParameterReference = ({ parameters }) => {
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedSections, setExpandedSections] = useState({
        config: true,
        computed: true,
        context: true
    })

    // Group parameters by category
    const groupedParameters = useMemo(() => {
        if (!parameters) return { config: [], computed: [], context: [] }

        const groups = {
            config: [],
            computed: [],
            context: []
        }

        Object.entries(parameters).forEach(([paramName, paramInfo]) => {
            if (paramName.startsWith('config._context')) {
                groups.context.push({ name: paramName, ...paramInfo })
            } else if (paramName.startsWith('config.') && !paramName.includes('_')) {
                // Regular config fields (from Pydantic model)
                groups.config.push({ name: paramName, ...paramInfo })
            } else {
                // Computed parameters (added in prepare_template_context)
                groups.computed.push({ name: paramName, ...paramInfo })
            }
        })

        return groups
    }, [parameters])

    // Filter parameters based on search query
    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return groupedParameters

        const lowerQuery = searchQuery.toLowerCase()
        const filtered = {}

        Object.entries(groupedParameters).forEach(([groupName, params]) => {
            filtered[groupName] = params.filter(param =>
                param.name.toLowerCase().includes(lowerQuery) ||
                param.description.toLowerCase().includes(lowerQuery) ||
                param.type.toLowerCase().includes(lowerQuery)
            )
        })

        return filtered
    }, [groupedParameters, searchQuery])

    function toggleSection(section) {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }))
    }

    if (!parameters || Object.keys(parameters).length === 0) {
        return (
            <div className="text-center text-gray-500 py-12">
                No template parameters documented for this widget.
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-900">
                    <span className="font-bold">Template Parameters</span> are available in the widget's Mustache template.
                    Frontend uses <code className="bg-blue-100 px-1 rounded">camelCase</code> but templates use{' '}
                    <code className="bg-blue-100 px-1 rounded">snake_case</code>.
                    The API automatically converts between the two.
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search parameters..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {/* Parameter Groups */}
            <div className="space-y-4">
                {/* Configuration Parameters */}
                <ParameterGroup
                    title="Configuration Parameters"
                    description="Parameters from the widget's Pydantic configuration model"
                    parameters={filteredGroups.config}
                    isExpanded={expandedSections.config}
                    onToggle={() => toggleSection('config')}
                    color="blue"
                />

                {/* Computed Parameters */}
                {filteredGroups.computed.length > 0 && (
                    <ParameterGroup
                        title="Computed Parameters"
                        description="Parameters added by prepare_template_context() method"
                        parameters={filteredGroups.computed}
                        isExpanded={expandedSections.computed}
                        onToggle={() => toggleSection('computed')}
                        color="green"
                    />
                )}

                {/* Context Parameters */}
                {filteredGroups.context.length > 0 && (
                    <ParameterGroup
                        title="Context Parameters"
                        description="Page and rendering context available to all widgets"
                        parameters={filteredGroups.context}
                        isExpanded={expandedSections.context}
                        onToggle={() => toggleSection('context')}
                        color="purple"
                    />
                )}
            </div>
        </div>
    )
}

/**
 * Parameter Group Component
 */
function ParameterGroup({ title, description, parameters, isExpanded, onToggle, color }) {
    const colors = {
        blue: 'bg-blue-50 border-blue-200',
        green: 'bg-green-50 border-green-200',
        purple: 'bg-purple-50 border-purple-200'
    }

    if (parameters.length === 0) return null

    return (
        <div className={`border rounded-lg ${colors[color]}`}>
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-opacity-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                    )}
                    <div className="text-left">
                        <div className="font-semibold text-gray-900" role="heading" aria-level="3">{title}</div>
                        <div className="text-sm text-gray-600 mt-0.5">{description}</div>
                    </div>
                </div>
                <span className="text-sm font-medium text-gray-600 px-2 py-1 bg-white rounded">
                    {parameters.length}
                </span>
            </button>

            {/* Parameter List */}
            {isExpanded && (
                <div className="border-t border-gray-200">
                    <div className="bg-white rounded-b-lg">
                        {parameters.map((param, index) => (
                            <ParameterRow
                                key={param.name}
                                param={param}
                                isLast={index === parameters.length - 1}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Parameter Row Component
 */
function ParameterRow({ param, isLast }) {
    const formatType = (type) => {
        // Simplify type strings for display
        return type
            .replace('typing.', '')
            .replace('Optional[', '')
            .replace(']', '')
            .replace('Union[', '')
    }

    const getExampleValue = (param) => {
        if (param.default !== null && param.default !== undefined) {
            return JSON.stringify(param.default)
        }

        // Provide sensible example based on type
        const typeStr = param.type.toLowerCase()
        if (typeStr.includes('str')) return '"example text"'
        if (typeStr.includes('int')) return '42'
        if (typeStr.includes('float')) return '3.14'
        if (typeStr.includes('bool')) return 'true'
        if (typeStr.includes('list')) return '[]'
        if (typeStr.includes('dict')) return '{}'
        return 'null'
    }

    return (
        <div className={`p-4 ${!isLast ? 'border-b border-gray-100' : ''}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    {/* Parameter Name */}
                    <div className="flex items-center gap-2 mb-2">
                        <code className="text-sm font-mono font-semibold text-gray-900">
                            {param.name}
                        </code>
                        {param.required && (
                            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                                Required
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    <div className="text-sm text-gray-700 mb-2">
                        {param.description}
                    </div>

                    {/* Type and Default */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div>
                            <span className="text-gray-600">Type:</span>{' '}
                            <code className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono text-xs">
                                {formatType(param.type)}
                            </code>
                        </div>
                        {param.default !== null && param.default !== undefined && (
                            <div>
                                <span className="text-gray-600">Default:</span>{' '}
                                <code className="text-green-600 bg-green-50 px-2 py-0.5 rounded font-mono text-xs">
                                    {JSON.stringify(param.default)}
                                </code>
                            </div>
                        )}
                    </div>
                </div>

                {/* Example Value */}
                <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-500 mb-1">Example</div>
                    <code className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {getExampleValue(param)}
                    </code>
                </div>
            </div>
        </div>
    )
}

export default WidgetParameterReference

