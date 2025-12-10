import React, { useState, useCallback } from 'react'
import { Plus, X, ChevronDown, Filter, Code, Eye } from 'lucide-react'

/**
 * RuleBuilderInput Component
 * 
 * Visual rule/query builder for creating complex "if/and/or" filter conditions.
 * Supports nested groups, multiple operators, and various field types.
 */
const RuleBuilderInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    fields = [],
    operators = ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'],
    showPreview = true,
    maxDepth = 3,
    ...props
}) => {
    const [previewMode, setPreviewMode] = useState('visual') // 'visual' or 'json'

    // Default fields if none provided
    const defaultFields = fields.length > 0 ? fields : [
        { key: 'name', label: 'Name', type: 'string' },
        { key: 'email', label: 'Email', type: 'string' },
        { key: 'age', label: 'Age', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending'] },
        { key: 'created_date', label: 'Created Date', type: 'date' },
        { key: 'is_verified', label: 'Is Verified', type: 'boolean' },
    ]

    // Default rule structure
    const createDefaultRule = () => ({
        id: Date.now() + Math.random(),
        type: 'rule',
        field: defaultFields[0]?.key || '',
        operator: 'equals',
        value: ''
    })

    const createDefaultGroup = () => ({
        id: Date.now() + Math.random(),
        type: 'group',
        combinator: 'and',
        rules: [createDefaultRule()]
    })

    // Initialize value if empty
    const currentValue = value || createDefaultGroup()

    // Operator labels
    const operatorLabels = {
        equals: 'equals',
        not_equals: 'does not equal',
        contains: 'contains',
        not_contains: 'does not contain',
        greater_than: 'is greater than',
        less_than: 'is less than',
        greater_equal: 'is greater than or equal to',
        less_equal: 'is less than or equal to',
        is_empty: 'is empty',
        is_not_empty: 'is not empty',
        starts_with: 'starts with',
        ends_with: 'ends with',
        in: 'is in',
        not_in: 'is not in'
    }

    // Get appropriate operators for field type
    const getOperatorsForField = (fieldType) => {
        switch (fieldType) {
            case 'string':
                return ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
            case 'number':
                return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'is_empty', 'is_not_empty']
            case 'date':
                return ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
            case 'boolean':
                return ['equals', 'not_equals']
            case 'select':
                return ['equals', 'not_equals', 'in', 'not_in', 'is_empty', 'is_not_empty']
            default:
                return ['equals', 'not_equals', 'is_empty', 'is_not_empty']
        }
    }

    // Update rule or group
    const updateItem = useCallback((path, updates) => {
        const updateRecursive = (item, currentPath) => {
            if (currentPath.length === 0) {
                return { ...item, ...updates }
            }

            const [head, ...tail] = currentPath
            if (item.type === 'group' && item.rules) {
                return {
                    ...item,
                    rules: item.rules.map((rule, index) =>
                        index === head ? updateRecursive(rule, tail) : rule
                    )
                }
            }

            return item
        }

        const newValue = updateRecursive(currentValue, path)
        onChange(newValue)
    }, [currentValue, onChange])

    // Add rule or group
    const addItem = useCallback((path, type) => {
        const newItem = type === 'rule' ? createDefaultRule() : createDefaultGroup()

        const addRecursive = (item, currentPath) => {
            if (currentPath.length === 0) {
                if (item.type === 'group') {
                    return {
                        ...item,
                        rules: [...(item.rules || []), newItem]
                    }
                }
                return item
            }

            const [head, ...tail] = currentPath
            if (item.type === 'group' && item.rules) {
                return {
                    ...item,
                    rules: item.rules.map((rule, index) =>
                        index === head ? addRecursive(rule, tail) : rule
                    )
                }
            }

            return item
        }

        const newValue = addRecursive(currentValue, path)
        onChange(newValue)
    }, [currentValue, onChange])

    // Remove rule or group
    const removeItem = useCallback((path) => {
        const removeRecursive = (item, currentPath) => {
            if (currentPath.length === 1) {
                if (item.type === 'group' && item.rules) {
                    return {
                        ...item,
                        rules: item.rules.filter((_, index) => index !== currentPath[0])
                    }
                }
                return item
            }

            const [head, ...tail] = currentPath
            if (item.type === 'group' && item.rules) {
                return {
                    ...item,
                    rules: item.rules.map((rule, index) =>
                        index === head ? removeRecursive(rule, tail) : rule
                    )
                }
            }

            return item
        }

        const newValue = removeRecursive(currentValue, path)
        onChange(newValue)
    }, [currentValue, onChange])

    // Render value input based on field type
    const renderValueInput = (rule, path) => {
        const field = defaultFields.find(f => f.key === rule.field)
        if (!field) return null

        // Some operators don't need values
        if (['is_empty', 'is_not_empty'].includes(rule.operator)) {
            return null
        }

        const handleValueChange = (newValue) => {
            updateItem(path, { value: newValue })
        }

        switch (field.type) {
            case 'string':
                return (
                    <input
                        type="text"
                        value={rule.value || ''}
                        onChange={(e) => handleValueChange(e.target.value)}
                        placeholder="Enter value..."
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={disabled}
                    />
                )
            case 'number':
                return (
                    <input
                        type="number"
                        value={rule.value || ''}
                        onChange={(e) => handleValueChange(Number(e.target.value))}
                        placeholder="0"
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-24"
                        disabled={disabled}
                    />
                )
            case 'date':
                return (
                    <input
                        type="date"
                        value={rule.value || ''}
                        onChange={(e) => handleValueChange(e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={disabled}
                    />
                )
            case 'boolean':
                return (
                    <select
                        value={rule.value || ''}
                        onChange={(e) => handleValueChange(e.target.value === 'true')}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={disabled}
                    >
                        <option value="">Select...</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select>
                )
            case 'select':
                return (
                    <select
                        value={rule.value || ''}
                        onChange={(e) => handleValueChange(e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={disabled}
                    >
                        <option value="">Select...</option>
                        {field.options?.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                )
            default:
                return null
        }
    }

    // Render a single rule
    const renderRule = (rule, path, depth = 0) => (
        <div key={rule.id} className="flex items-center space-x-2 p-3 bg-gray-50 border border-gray-200 rounded">
            {/* Field Selection */}
            <select
                value={rule.field || ''}
                onChange={(e) => {
                    const field = defaultFields.find(f => f.key === e.target.value)
                    updateItem(path, {
                        field: e.target.value,
                        operator: getOperatorsForField(field?.type)[0] || 'equals',
                        value: ''
                    })
                }}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={disabled}
            >
                <option value="">Select field...</option>
                {defaultFields.map(field => (
                    <option key={field.key} value={field.key}>{field.label}</option>
                ))}
            </select>

            {/* Operator Selection */}
            {rule.field && (
                <select
                    value={rule.operator || ''}
                    onChange={(e) => updateItem(path, { operator: e.target.value, value: '' })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={disabled}
                >
                    {getOperatorsForField(defaultFields.find(f => f.key === rule.field)?.type).map(op => (
                        <option key={op} value={op}>{operatorLabels[op] || op}</option>
                    ))}
                </select>
            )}

            {/* Value Input */}
            {rule.field && rule.operator && renderValueInput(rule, path)}

            {/* Remove Rule */}
            <button
                type="button"
                onClick={() => removeItem(path)}
                disabled={disabled}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                title="Remove rule"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )

    // Render a group of rules
    const renderGroup = (group, path = [], depth = 0) => (
        <div key={group.id} className={`space-y-3 ${depth > 0 ? 'ml-6 pl-4 border-l-2 border-gray-200' : ''}`}>
            {/* Group Header */}
            <div className="flex items-center space-x-3">
                <select
                    value={group.combinator || 'and'}
                    onChange={(e) => updateItem(path, { combinator: e.target.value })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    disabled={disabled}
                >
                    <option value="and">AND</option>
                    <option value="or">OR</option>
                </select>

                <span className="text-sm text-gray-500">
                    {group.rules?.length || 0} condition{(group.rules?.length || 0) !== 1 ? 's' : ''}
                </span>

                {/* Add Buttons */}
                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={() => addItem(path, 'rule')}
                        disabled={disabled}
                        className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                    >
                        <Plus className="w-3 h-3" />
                        <span>Rule</span>
                    </button>

                    {depth < maxDepth && (
                        <button
                            type="button"
                            onClick={() => addItem(path, 'group')}
                            disabled={disabled}
                            className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                            <Plus className="w-3 h-3" />
                            <span>Group</span>
                        </button>
                    )}
                </div>

                {/* Remove Group */}
                {depth > 0 && (
                    <button
                        type="button"
                        onClick={() => removeItem(path)}
                        disabled={disabled}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Remove group"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Rules */}
            <div className="space-y-2">
                {group.rules?.map((item, index) => {
                    const itemPath = [...path, index]

                    if (item.type === 'rule') {
                        return renderRule(item, itemPath, depth)
                    } else if (item.type === 'group') {
                        return renderGroup(item, itemPath, depth + 1)
                    }
                    return null
                })}
            </div>

            {/* Empty State */}
            {(!group.rules || group.rules.length === 0) && (
                <div className="p-4 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded">
                    <Filter className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                    <div className="text-sm">No conditions defined</div>
                    <button
                        type="button"
                        onClick={() => addItem(path, 'rule')}
                        disabled={disabled}
                        className="mt-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                    >
                        Add first condition
                    </button>
                </div>
            )}
        </div>
    )

    // Generate human-readable description
    const generateDescription = (item) => {
        if (item.type === 'rule') {
            const field = defaultFields.find(f => f.key === item.field)
            const fieldLabel = field?.label || item.field
            const operatorLabel = operatorLabels[item.operator] || item.operator
            const value = item.value || '[empty]'

            return `${fieldLabel} ${operatorLabel} ${value}`
        } else if (item.type === 'group') {
            const combinator = item.combinator?.toUpperCase() || 'AND'
            const conditions = item.rules?.map(generateDescription).filter(Boolean) || []

            if (conditions.length === 0) return 'No conditions'
            if (conditions.length === 1) return conditions[0]

            return `(${conditions.join(` ${combinator} `)})`
        }

        return ''
    }

    const hasError = validation && !validation.isValid

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className={`border rounded-lg ${hasError ? 'border-red-300' : 'border-gray-300'}`}>
                {/* Header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Filter Rules</span>
                    </div>

                    {showPreview && (
                        <div className="flex items-center space-x-2">
                            <button
                                type="button"
                                onClick={() => setPreviewMode(previewMode === 'visual' ? 'json' : 'visual')}
                                className="flex items-center space-x-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                            >
                                {previewMode === 'visual' ? <Code className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                <span>{previewMode === 'visual' ? 'JSON' : 'Visual'}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Rule Builder */}
                <div className="p-4">
                    {renderGroup(currentValue)}
                </div>

                {/* Preview */}
                {showPreview && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                        <div className="text-xs font-medium text-gray-600 mb-2">
                            {previewMode === 'visual' ? 'Human Readable:' : 'JSON Structure:'}
                        </div>
                        {previewMode === 'visual' ? (
                            <div className="text-sm text-gray-700 font-mono bg-white p-2 rounded border">
                                {generateDescription(currentValue)}
                            </div>
                        ) : (
                            <pre className="text-xs text-gray-700 bg-white p-2 rounded border overflow-auto max-h-32">
                                {JSON.stringify(currentValue, null, 2)}
                            </pre>
                        )}
                    </div>
                )}
            </div>

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Validation Message */}
            {hasError && validation?.errors?.length > 0 && (
                <div className="text-sm text-red-600">
                    {validation.errors[0]}
                </div>
            )}

            {/* Loading State */}
            {isValidating && (
                <div className="text-sm text-blue-600">
                    Validating...
                </div>
            )}

            {/* Usage Help */}
            <div className="text-xs text-gray-500">
                Click "Add Rule" to create conditions. Use "Add Group" to create nested logic with AND/OR operators.
            </div>
        </div>
    )
}

RuleBuilderInput.displayName = 'RuleBuilderInput'

export default RuleBuilderInput
