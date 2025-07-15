import { useState, useEffect, useReducer } from 'react'
import { Save, X, AlertCircle, Info, Settings, Layers, Eye, EyeOff, Monitor } from 'lucide-react'
import toast from 'react-hot-toast'

// Reducer for managing consolidated widget configurator state
const widgetConfiguratorReducer = (state, action) => {
    switch (action.type) {
        case 'SET_CONFIG':
            return {
                ...state,
                config: { ...state.config, ...action.payload }
            }
        case 'SET_INHERITANCE_SETTINGS':
            return {
                ...state,
                inheritanceSettings: { ...state.inheritanceSettings, ...action.payload }
            }
        case 'SET_ERRORS':
            return {
                ...state,
                validation: {
                    ...state.validation,
                    errors: action.payload
                }
            }
        case 'SET_IS_VALID':
            return {
                ...state,
                validation: {
                    ...state.validation,
                    isValid: action.payload
                }
            }
        case 'SET_ACTIVE_TAB':
            return {
                ...state,
                activeTab: action.payload
            }
        case 'RESET_CONFIG':
            return {
                ...state,
                config: action.payload
            }
        case 'INITIALIZE_STATE':
            return {
                config: action.payload.config,
                inheritanceSettings: action.payload.inheritanceSettings,
                validation: { errors: {}, isValid: true },
                activeTab: 'content'
            }
        default:
            return state
    }
}

const WidgetConfigurator = ({
    widgetType,
    initialConfig = {},
    initialInheritanceSettings = {},
    onSave,
    onCancel,
    title = "Configure Widget",
    showInheritanceControls = true,
    isEditing = false
}) => {
    // Initialize consolidated state with reducer
    const initialState = {
        config: initialConfig,
        inheritanceSettings: {
            inherit_from_parent: true,
            override_parent: false,
            inheritance_behavior: 'inherit',
            inheritance_conditions: {},
            priority: 0,
            is_visible: true,
            max_inheritance_depth: null,
            ...initialInheritanceSettings
        },
        validation: { errors: {}, isValid: true },
        activeTab: 'content'
    }

    const [widgetState, dispatch] = useReducer(widgetConfiguratorReducer, initialState)

    // Destructure for easier access
    const { config, inheritanceSettings, validation: { errors, isValid }, activeTab } = widgetState

    // Inheritance behavior options
    const inheritanceBehaviorOptions = [
        { value: 'inherit', label: 'Inherit from Parent', description: 'Widget inherits normally from parent pages' },
        { value: 'override', label: 'Override Parent Widget', description: 'This widget overrides any inherited widget in the same slot' },
        { value: 'supplement', label: 'Add to Parent Widgets', description: 'Add this widget alongside inherited widgets' },
        { value: 'block', label: 'Block Inheritance', description: 'Prevent inheritance of parent widgets in this slot' },
        { value: 'conditional', label: 'Conditional Inheritance', description: 'Inherit based on specified conditions' }
    ]

    // Initialize config with default values from schema
    useEffect(() => {
        if (widgetType?.json_schema?.properties) {
            const defaultConfig = {}
            Object.entries(widgetType.json_schema.properties).forEach(([key, property]) => {
                if (property.default !== undefined) {
                    defaultConfig[key] = property.default
                }
            })
            dispatch({
                type: 'RESET_CONFIG',
                payload: { ...defaultConfig, ...initialConfig }
            })
        }
    }, [widgetType])

    // Validate configuration against schema
    useEffect(() => {
        validateConfig()
    }, [config, widgetType])

    const validateConfig = () => {
        if (!widgetType?.json_schema) return

        const newErrors = {}
        const schema = widgetType.json_schema
        const required = schema.required || []

        // Check required fields
        required.forEach(field => {
            if (!config[field] || (typeof config[field] === 'string' && config[field].trim() === '')) {
                newErrors[field] = 'This field is required'
            }
        })

        // Validate field types and constraints
        Object.entries(schema.properties || {}).forEach(([key, property]) => {
            const value = config[key]
            if (value !== undefined && value !== null && value !== '') {
                // Type validation
                if (property.type === 'number' && isNaN(Number(value))) {
                    newErrors[key] = 'Must be a valid number'
                } else if (property.minimum !== undefined && Number(value) < property.minimum) {
                    newErrors[key] = `Must be at least ${property.minimum}`
                } else if (property.maximum !== undefined && Number(value) > property.maximum) {
                    newErrors[key] = `Must be at most ${property.maximum}`
                } else if (property.pattern && !new RegExp(property.pattern).test(value)) {
                    newErrors[key] = 'Invalid format'
                }
            }
        })

        dispatch({ type: 'SET_ERRORS', payload: newErrors })
        dispatch({ type: 'SET_IS_VALID', payload: Object.keys(newErrors).length === 0 })
    }

    const handleFieldChange = (fieldName, value) => {
        dispatch({
            type: 'SET_CONFIG',
            payload: { [fieldName]: value }
        })
    }

    const handleInheritanceChange = (fieldName, value) => {
        dispatch({
            type: 'SET_INHERITANCE_SETTINGS',
            payload: { [fieldName]: value }
        })
    }

    const handleSave = () => {
        if (!isValid) {
            toast.error('Please fix all validation errors before saving')
            return
        }

        // Return different data structure based on whether inheritance controls are shown
        // This maintains backward compatibility for tests and simple use cases
        if (showInheritanceControls) {
            const saveData = {
                configuration: config,
                ...inheritanceSettings
            }
            onSave(saveData)
        } else {
            // For simple cases (like tests), just return the configuration
            onSave(config)
        }
    }

    const renderField = (fieldName, property) => {
        const value = config[fieldName] || ''
        const hasError = errors[fieldName]
        const isRequired = widgetType?.json_schema?.required?.includes(fieldName)

        const baseClasses = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
            }`

        let inputElement

        if (property.type === 'boolean') {
            inputElement = (
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{property.title}</span>
                </label>
            )
        } else if (property.enum) {
            inputElement = (
                <select
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={baseClasses}
                >
                    <option value="">Select {property.title}</option>
                    {property.enum.map(option => (
                        <option key={option} value={option}>
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                    ))}
                </select>
            )
        } else if (property.format === 'textarea') {
            inputElement = (
                <textarea
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    placeholder={property.description}
                    rows={4}
                    className={baseClasses}
                />
            )
        } else if (property.format === 'date') {
            inputElement = (
                <input
                    type="date"
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={baseClasses}
                />
            )
        } else if (property.format === 'datetime-local') {
            inputElement = (
                <input
                    type="datetime-local"
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={baseClasses}
                />
            )
        } else {
            inputElement = (
                <input
                    type={property.type === 'number' ? 'number' : property.type === 'integer' ? 'number' : 'text'}
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    placeholder={property.description}
                    min={property.minimum}
                    max={property.maximum}
                    step={property.type === 'integer' ? 1 : 'any'}
                    className={baseClasses}
                />
            )
        }

        return (
            <div key={fieldName} className="space-y-2">
                {property.type !== 'boolean' && (
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">
                            {property.title}
                            {isRequired && <span className="text-red-500 ml-1">*</span>}
                        </span>
                    </label>
                )}

                {inputElement}

                {property.description && property.type !== 'boolean' && (
                    <div className="flex items-start space-x-1">
                        <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-500">{property.description}</p>
                    </div>
                )}

                {hasError && (
                    <div className="flex items-start space-x-1">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-red-600">{hasError}</p>
                    </div>
                )}
            </div>
        )
    }

    const renderWidgetPreview = () => {
        // Simple preview based on widget type and configuration
        const renderPreviewContent = () => {
            if (!widgetType) return null;

            switch (widgetType.name.toLowerCase()) {
                case 'text block':
                    return (
                        <div className="prose max-w-none">
                            {config.title && <h3 className="text-lg font-semibold mb-2">{config.title}</h3>}
                            <div className={`text-${config.alignment || 'left'} ${config.style === 'bold' ? 'font-bold' : config.style === 'italic' ? 'italic' : ''}`}>
                                {config.content || 'Your text content will appear here...'}
                            </div>
                        </div>
                    )
                case 'image':
                    return (
                        <div className={`text-${config.alignment || 'center'}`}>
                            {config.image_url ? (
                                <img
                                    src={config.image_url}
                                    alt={config.alt_text || 'Preview image'}
                                    className={`inline-block ${config.size === 'small' ? 'w-32' : config.size === 'large' ? 'w-96' : config.size === 'full' ? 'w-full' : 'w-64'}`}
                                />
                            ) : (
                                <div className={`bg-gray-200 rounded-lg flex items-center justify-center ${config.size === 'small' ? 'w-32 h-24' : config.size === 'large' ? 'w-96 h-64' : config.size === 'full' ? 'w-full h-48' : 'w-64 h-48'}`}>
                                    <span className="text-gray-500">Image Preview</span>
                                </div>
                            )}
                            {config.caption && (
                                <p className="text-sm text-gray-600 mt-2">{config.caption}</p>
                            )}
                        </div>
                    )
                case 'button':
                    return (
                        <div className="flex justify-center">
                            <button
                                className={`px-6 py-2 rounded-lg ${config.style === 'secondary' ? 'bg-gray-200 text-gray-800' :
                                    config.style === 'outline' ? 'border-2 border-blue-600 text-blue-600 bg-transparent' :
                                        'bg-blue-600 text-white'
                                    } ${config.size === 'small' ? 'text-sm px-4 py-1' :
                                        config.size === 'large' ? 'text-lg px-8 py-3' :
                                            'text-base px-6 py-2'
                                    }`}
                            >
                                {config.text || 'Button Text'}
                            </button>
                        </div>
                    )
                case 'news':
                    return (
                        <article className="bg-white border border-gray-200 rounded-lg p-4">
                            {config.featured_image && (
                                <img src={config.featured_image} alt={config.title} className="w-full h-48 object-cover rounded-lg mb-4" />
                            )}
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold">{config.title || 'Article Title'}</h2>
                                {config.show_meta !== false && (
                                    <div className="text-sm text-gray-600 flex space-x-4">
                                        {config.author && <span>By {config.author}</span>}
                                        {config.publication_date && <span>{new Date(config.publication_date).toLocaleDateString()}</span>}
                                        {config.category && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{config.category}</span>}
                                    </div>
                                )}
                                {config.summary && (
                                    <p className="text-gray-700 font-medium">{config.summary}</p>
                                )}
                                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: config.content || 'Article content will appear here...' }} />
                            </div>
                        </article>
                    )
                case 'events':
                    return (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="space-y-3">
                                <h3 className="text-lg font-bold">{config.event_title || 'Event Title'}</h3>
                                {config.description && <p className="text-gray-700">{config.description}</p>}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {config.start_date && (
                                        <div>
                                            <span className="font-medium">Start:</span> {new Date(config.start_date).toLocaleString()}
                                        </div>
                                    )}
                                    {config.end_date && (
                                        <div>
                                            <span className="font-medium">End:</span> {new Date(config.end_date).toLocaleString()}
                                        </div>
                                    )}
                                    {config.location && (
                                        <div>
                                            <span className="font-medium">Location:</span> {config.location}
                                        </div>
                                    )}
                                    {config.price && (
                                        <div>
                                            <span className="font-medium">Price:</span> {config.price}
                                        </div>
                                    )}
                                </div>
                                {config.registration_url && (
                                    <button className="bg-blue-600 text-white px-4 py-2 rounded">Register</button>
                                )}
                            </div>
                        </div>
                    )
                default:
                    return (
                        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-blue-900 mb-2">{widgetType.name} Widget</h3>
                                <p className="text-blue-700 text-sm mb-4">{widgetType.description}</p>
                                <div className="text-xs text-blue-600">
                                    <p>Widget preview with current configuration:</p>
                                    <pre className="mt-2 text-left bg-blue-100 p-2 rounded overflow-x-auto">
                                        {JSON.stringify(config, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )
            }
        }

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Live Preview</h3>
                    <div className="text-xs text-gray-500">
                        Updates as you configure
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 min-h-48">
                    {renderPreviewContent()}
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                    <p>• This is a simplified preview of how your widget will appear</p>
                    <p>• Actual rendering may vary based on page theme and layout</p>
                    <p>• Use the page preview to see the final result in context</p>
                </div>
            </div>
        )
    }

    const renderInheritanceControls = () => {
        return (
            <div className="space-y-6">
                {/* Inheritance Behavior */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                        Inheritance Behavior
                    </label>
                    <div className="space-y-2">
                        {inheritanceBehaviorOptions.map(option => (
                            <label key={option.value} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="radio"
                                    name="inheritance_behavior"
                                    value={option.value}
                                    checked={inheritanceSettings.inheritance_behavior === option.value}
                                    onChange={(e) => handleInheritanceChange('inheritance_behavior', e.target.value)}
                                    className="mt-1 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">{option.label}</div>
                                    <div className="text-xs text-gray-500">{option.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Conditional Inheritance Settings */}
                {inheritanceSettings.inheritance_behavior === 'conditional' && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="text-sm font-medium text-yellow-800 mb-2">Conditional Inheritance Settings</h4>
                        <p className="text-xs text-yellow-700 mb-3">Define conditions for when this widget should inherit from parent pages.</p>
                        <textarea
                            value={JSON.stringify(inheritanceSettings.inheritance_conditions, null, 2)}
                            onChange={(e) => {
                                try {
                                    const conditions = JSON.parse(e.target.value)
                                    handleInheritanceChange('inheritance_conditions', conditions)
                                } catch {
                                    // Invalid JSON, keep current value
                                }
                            }}
                            placeholder='{"page_type": "article", "has_parent": true}'
                            rows={3}
                            className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                        <p className="text-xs text-yellow-600 mt-1">Enter valid JSON conditions</p>
                    </div>
                )}

                {/* Widget Priority */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Widget Priority
                        <span className="text-xs text-gray-500 ml-2">(Higher numbers appear first)</span>
                    </label>
                    <input
                        type="number"
                        value={inheritanceSettings.priority}
                        onChange={(e) => handleInheritanceChange('priority', parseInt(e.target.value) || 0)}
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                        Priority 0 = normal, higher numbers show first in slot
                    </p>
                </div>

                {/* Visibility Controls */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                        {inheritanceSettings.is_visible ? (
                            <Eye className="w-4 h-4 text-green-600" />
                        ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-700">Widget Visibility</span>
                    </div>
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={inheritanceSettings.is_visible}
                            onChange={(e) => handleInheritanceChange('is_visible', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-600">Visible</span>
                    </label>
                </div>

                {/* Inheritance Depth Limit */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Inheritance Depth Limit
                        <span className="text-xs text-gray-500 ml-2">(Leave empty for unlimited)</span>
                    </label>
                    <input
                        type="number"
                        value={inheritanceSettings.max_inheritance_depth || ''}
                        onChange={(e) => handleInheritanceChange('max_inheritance_depth', e.target.value ? parseInt(e.target.value) : null)}
                        min="1"
                        max="10"
                        placeholder="Unlimited"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                        Maximum levels down the page hierarchy this widget can be inherited
                    </p>
                </div>
            </div>
        )
    }

    if (!widgetType) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center text-gray-500">
                    <p>No widget type selected</p>
                </div>
            </div>
        )
    }

    const schema = widgetType.json_schema
    const properties = schema?.properties || {}

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Configuring: {widgetType.name}
                    </p>
                </div>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-500"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-4">
                    <button
                        onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'content' })}
                        className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'content'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            <Settings className="w-4 h-4" />
                            <span>Content</span>
                        </div>
                    </button>
                    {showInheritanceControls && (
                        <button
                            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'inheritance' })}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'inheritance'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center space-x-2">
                                <Layers className="w-4 h-4" />
                                <span>Inheritance</span>
                            </div>
                        </button>
                    )}
                    <button
                        onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'preview' })}
                        className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'preview'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            <Monitor className="w-4 h-4" />
                            <span>Preview</span>
                        </div>
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
                {activeTab === 'content' && (
                    <div>
                        {Object.keys(properties).length > 0 ? (
                            <div className="space-y-6">
                                {Object.entries(properties).map(([fieldName, property]) =>
                                    renderField(fieldName, property)
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-8">
                                <p>No configuration options available for this widget type.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'inheritance' && showInheritanceControls && (
                    <div>
                        {renderInheritanceControls()}
                    </div>
                )}

                {activeTab === 'preview' && (
                    <div>
                        {renderWidgetPreview()}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!isValid}
                    className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${isValid
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                </button>
            </div>

            {/* Validation Summary */}
            {Object.keys(errors).length > 0 && (
                <div className="p-4 border-t border-red-200 bg-red-50">
                    <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="text-sm font-medium text-red-800">
                                Please fix the following errors:
                            </h4>
                            <ul className="text-xs text-red-700 mt-1 space-y-1">
                                {Object.entries(errors).map(([field, error]) => (
                                    <li key={field}>
                                        <strong>{properties[field]?.title || field}:</strong> {error}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default WidgetConfigurator 