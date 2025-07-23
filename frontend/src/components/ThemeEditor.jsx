import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client.js'
import { extractErrorMessage } from '../utils/errorHandling.js'
import toast from 'react-hot-toast'
import {
    Plus,
    Edit3,
    Trash2,
    Save,
    X,
    Palette,
    Eye,
    EyeOff,
    Copy,
    Download,
    Upload,
    Settings,
    Hash
} from 'lucide-react'

const ThemeEditor = () => {
    const [selectedTheme, setSelectedTheme] = useState(null)
    const [isCreating, setIsCreating] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const queryClient = useQueryClient()

    // Fetch themes
    const { data: themes = [], isLoading } = useQuery({
        queryKey: ['themes'],
        queryFn: async () => {
            const response = await api.get('/api/v1/webpages/themes/')
            return response.data
        }
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Theme Editor</h2>
                    <p className="text-gray-600 mt-1">
                        Create and manage page themes with color schemes and styling
                    </p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Theme
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Themes List */}
                <div className="lg:col-span-1">
                    <ThemesList
                        themes={themes}
                        selectedTheme={selectedTheme}
                        onSelectTheme={setSelectedTheme}
                        isLoading={isLoading}
                    />
                </div>

                {/* Theme Editor Panel */}
                <div className="lg:col-span-2">
                    {isCreating && (
                        <ThemeForm
                            onSave={() => {
                                setIsCreating(false)
                                queryClient.invalidateQueries(['themes'])
                            }}
                            onCancel={() => setIsCreating(false)}
                        />
                    )}

                    {selectedTheme && !isCreating && (
                        <ThemeEditPanel
                            theme={selectedTheme}
                            onUpdate={() => {
                                queryClient.invalidateQueries(['themes'])
                                setSelectedTheme(null)
                            }}
                            onCancel={() => setSelectedTheme(null)}
                            showPreview={showPreview}
                            onTogglePreview={() => setShowPreview(!showPreview)}
                        />
                    )}

                    {!selectedTheme && !isCreating && (
                        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                            <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Select a Theme to Edit
                            </h3>
                            <p className="text-gray-500">
                                Choose a theme from the list or create a new one to get started
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Themes List Component
const ThemesList = ({ themes, selectedTheme, onSelectTheme, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-200 rounded"></div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Available Themes</h3>
            </div>
            <div className="divide-y divide-gray-200">
                {themes?.map((theme) => (
                    <div
                        key={theme.id}
                        onClick={() => onSelectTheme(theme)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedTheme?.id === theme.id ? 'bg-purple-50 border-r-4 border-purple-500' : ''
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <h4 className="font-medium text-gray-900">{theme.name}</h4>
                                <p className="text-sm text-gray-500 mt-1">
                                    {Object.keys(theme.css_variables || {}).length} variables
                                </p>
                                {theme.description && (
                                    <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
                                )}

                                {/* Color Preview */}
                                <div className="flex items-center space-x-1 mt-2">
                                    {getColorVariables(theme.css_variables).slice(0, 5).map((color, i) => (
                                        <div
                                            key={i}
                                            className="w-4 h-4 rounded-full border border-gray-300"
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                    {getColorVariables(theme.css_variables).length > 5 && (
                                        <span className="text-xs text-gray-400">
                                            +{getColorVariables(theme.css_variables).length - 5}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                {theme.is_active ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Active
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        Inactive
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {themes?.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        <Palette className="w-8 h-8 mx-auto mb-2" />
                        <p>No themes found</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// Helper function to extract color variables
const getColorVariables = (cssVariables = {}) => {
    return Object.entries(cssVariables)
        .filter(([key, value]) =>
            typeof value === 'string' && (
                value.startsWith('#') ||
                value.startsWith('rgb') ||
                value.startsWith('hsl') ||
                /^[a-zA-Z]+$/.test(value) // Named colors
            )
        )
        .map(([, value]) => value)
}

// Theme Form Component
const ThemeForm = ({ theme = null, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        name: theme?.name || '',
        description: theme?.description || '',
        css_variables: theme?.css_variables || {},
        custom_css: theme?.custom_css || '',
        is_active: theme?.is_active ?? true
    })

    const [newVariable, setNewVariable] = useState({ key: '', value: '' })
    const [showCssEditor, setShowCssEditor] = useState(false)

    const mutation = useMutation({
        mutationFn: async (data) => {
            if (theme) {
                return api.put(`/api/v1/webpages/themes/${theme.id}/`, data)
            } else {
                return api.post('/api/v1/webpages/themes/', data)
            }
        },
        onSuccess: () => {
            toast.success(`Theme ${theme ? 'updated' : 'created'} successfully`)
            onSave()
        },
        onError: (error) => {
            const message = extractErrorMessage(error, `Failed to ${theme ? 'update' : 'create'} theme`)
            toast.error(message)
            console.error(error)
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        mutation.mutate(formData)
    }

    const addVariable = () => {
        if (newVariable.key && newVariable.value) {
            setFormData({
                ...formData,
                css_variables: {
                    ...formData.css_variables,
                    [newVariable.key]: newVariable.value
                }
            })
            setNewVariable({ key: '', value: '' })
        }
    }

    const removeVariable = (key) => {
        const updatedVariables = { ...formData.css_variables }
        delete updatedVariables[key]
        setFormData({
            ...formData,
            css_variables: updatedVariables
        })
    }

    const updateVariable = (oldKey, newKey, value) => {
        const updatedVariables = { ...formData.css_variables }
        if (oldKey !== newKey) {
            delete updatedVariables[oldKey]
        }
        updatedVariables[newKey] = value
        setFormData({
            ...formData,
            css_variables: updatedVariables
        })
    }

    // Predefined color scheme templates
    const colorSchemeTemplates = {
        'Blue Theme': {
            'primary': '#3b82f6',
            'primary-dark': '#1d4ed8',
            'primary-light': '#93c5fd',
            'secondary': '#64748b',
            'accent': '#06b6d4',
            'background': '#ffffff',
            'surface': '#f8fafc',
            'text': '#1f2937',
            'text-muted': '#6b7280'
        },
        'Dark Theme': {
            'primary': '#8b5cf6',
            'primary-dark': '#7c3aed',
            'primary-light': '#c4b5fd',
            'secondary': '#64748b',
            'accent': '#f59e0b',
            'background': '#111827',
            'surface': '#1f2937',
            'text': '#f9fafb',
            'text-muted': '#d1d5db'
        },
        'Green Theme': {
            'primary': '#10b981',
            'primary-dark': '#059669',
            'primary-light': '#6ee7b7',
            'secondary': '#64748b',
            'accent': '#f59e0b',
            'background': '#ffffff',
            'surface': '#f0fdf4',
            'text': '#065f46',
            'text-muted': '#6b7280'
        }
    }

    const applyTemplate = (template) => {
        setFormData({
            ...formData,
            css_variables: {
                ...formData.css_variables,
                ...colorSchemeTemplates[template]
            }
        })
        toast.success(`Applied ${template} template`)
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                    {theme ? 'Edit Theme' : 'Create New Theme'}
                </h3>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-500"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="theme-name" className="block text-sm font-medium text-gray-700 mb-2">
                            Theme Name
                        </label>
                        <input
                            id="theme-name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                    </div>

                    <div className="flex items-center">
                        <label className="flex items-center">
                            <input
                                id="theme-active"
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Active</span>
                        </label>
                    </div>
                </div>

                <div>
                    <label htmlFor="theme-description" className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                    </label>
                    <textarea
                        id="theme-description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>

                {/* Color Scheme Templates */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Quick Start Templates
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(colorSchemeTemplates).map((template) => (
                            <button
                                key={template}
                                type="button"
                                onClick={() => applyTemplate(template)}
                                className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                            >
                                {template}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CSS Variables */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-gray-700">
                            CSS Variables
                        </label>
                        <div className="flex items-center space-x-2">
                            <button
                                type="button"
                                onClick={() => setShowCssEditor(!showCssEditor)}
                                className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                                {showCssEditor ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                                {showCssEditor ? 'Hide' : 'Show'} CSS
                            </button>
                        </div>
                    </div>

                    {/* Add New Variable */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                placeholder="Variable name (e.g., primary-color)"
                                value={newVariable.key}
                                onChange={(e) => setNewVariable({ ...newVariable, key: e.target.value })}
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <input
                                type="text"
                                placeholder="Value (e.g., #3b82f6)"
                                value={newVariable.value}
                                onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <button
                                type="button"
                                onClick={addVariable}
                                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                                aria-label="Add variable"
                                title="Add variable"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Variables List */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {Object.entries(formData.css_variables).map(([key, value]) => (
                            <VariableEditor
                                key={key}
                                originalKey={key}
                                value={value}
                                onUpdate={(newKey, newValue) => updateVariable(key, newKey, newValue)}
                                onRemove={() => removeVariable(key)}
                            />
                        ))}

                        {Object.keys(formData.css_variables).length === 0 && (
                            <div className="text-center py-4 text-gray-500">
                                <Hash className="w-6 h-6 mx-auto mb-2" />
                                <p className="text-sm">No CSS variables defined. Add variables to customize your theme.</p>
                            </div>
                        )}
                    </div>

                    {/* CSS Preview */}
                    {showCssEditor && (
                        <div className="mt-4 p-3 bg-gray-900 rounded-lg">
                            <div className="text-xs text-gray-300 mb-2">Generated CSS Variables</div>
                            <pre className="text-xs text-green-300 overflow-x-auto">
                                <code>
                                    {`:root {\n${Object.entries(formData.css_variables)
                                        .map(([key, value]) => `  --${key}: ${value};`)
                                        .join('\n')}\n}`}
                                </code>
                            </pre>
                        </div>
                    )}
                </div>

                {/* Custom CSS */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label htmlFor="theme-custom-css" className="block text-sm font-medium text-gray-700">
                            Custom CSS
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowCssEditor(!showCssEditor)}
                            className="text-xs text-purple-600 hover:text-purple-700"
                        >
                            {showCssEditor ? 'Hide Editor' : 'Show Editor'}
                        </button>
                    </div>

                    {showCssEditor && (
                        <textarea
                            id="theme-custom-css"
                            value={formData.custom_css}
                            onChange={(e) => setFormData({ ...formData, custom_css: e.target.value })}
                            rows={8}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                            placeholder={`/* Additional custom CSS for this theme */\n.theme-custom {\n  /* Your styles here */\n}\n\nbody {\n  background: var(--background);\n  color: var(--text);\n}`}
                        />
                    )}

                    {!showCssEditor && formData.custom_css && (
                        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                            {formData.custom_css.split('\n').length} lines of custom CSS defined
                        </div>
                    )}

                    <p className="text-xs text-gray-500 mt-1">
                        Additional CSS that will be included with this theme. You can reference CSS variables using var(--variable-name).
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {mutation.isPending ? 'Saving...' : (theme ? 'Update Theme' : 'Create Theme')}
                    </button>
                </div>
            </form>
        </div>
    )
}

// Variable Editor Component
const VariableEditor = ({ originalKey, value, onUpdate, onRemove }) => {
    const [key, setKey] = useState(originalKey)
    const [val, setVal] = useState(value)
    const [isColor, setIsColor] = useState(false)

    useEffect(() => {
        // Check if value looks like a color
        const colorPattern = /^(#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\(|hsla\()/
        setIsColor(colorPattern.test(value))
    }, [value])

    const handleUpdate = () => {
        onUpdate(key, val)
    }

    return (
        <div className="flex items-center space-x-2 p-2 border border-gray-200 rounded-lg">
            <div className="flex-1 flex items-center space-x-2">
                <span className="text-xs text-gray-500 font-mono">--</span>
                <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    onBlur={handleUpdate}
                    className="flex-1 px-2 py-1 text-sm border-0 focus:outline-none font-mono"
                />
                <span className="text-xs text-gray-500">:</span>
                {isColor && (
                    <input
                        type="color"
                        value={val.startsWith('#') ? val : '#000000'}
                        onChange={(e) => {
                            setVal(e.target.value)
                            onUpdate(key, e.target.value)
                        }}
                        className="w-8 h-6 border border-gray-300 rounded cursor-pointer"
                    />
                )}
                <input
                    type="text"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onBlur={handleUpdate}
                    className="flex-1 px-2 py-1 text-sm border-0 focus:outline-none font-mono"
                />
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="text-red-600 hover:text-red-700"
                aria-label="remove variable"
                title="Remove variable"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    )
}

// Theme Edit Panel Component  
const ThemeEditPanel = ({ theme, onUpdate, onCancel, showPreview, onTogglePreview }) => {
    const [isEditing, setIsEditing] = useState(false)

    const deleteMutation = useMutation({
        mutationFn: async () => {
            return api.delete(`/api/v1/webpages/themes/${theme.id}/`)
        },
        onSuccess: () => {
            toast.success('Theme deleted successfully')
            onCancel()
        },
        onError: () => {
            toast.error('Failed to delete theme')
        }
    })

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this theme? This action cannot be undone.')) {
            deleteMutation.mutate()
        }
    }

    const exportTheme = () => {
        const themeData = {
            name: theme.name,
            description: theme.description,
            css_variables: theme.css_variables,
            custom_css: theme.custom_css
        }

        const dataStr = JSON.stringify(themeData, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${theme.name.replace(/\s+/g, '-').toLowerCase()}-theme.json`
        link.click()
        URL.revokeObjectURL(url)
        toast.success('Theme exported successfully')
    }

    if (isEditing) {
        return (
            <ThemeForm
                theme={theme}
                onSave={() => {
                    setIsEditing(false)
                    onUpdate()
                }}
                onCancel={() => setIsEditing(false)}
            />
        )
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">{theme.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {Object.keys(theme.css_variables || {}).length} CSS variables defined
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={onTogglePreview}
                        className={`inline-flex items-center px-3 py-1 rounded-md text-sm transition-colors ${showPreview
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <Eye className="w-4 h-4 mr-1" />
                        {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                    <button
                        onClick={exportTheme}
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                    >
                        <Download className="w-4 h-4 mr-1" />
                        Export
                    </button>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                    >
                        <Edit3 className="w-4 h-4 mr-1" />
                        Edit
                    </button>
                    <button
                        onClick={handleDelete}
                        className="inline-flex items-center px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                    >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                    </button>
                </div>
            </div>

            <div className="p-6">
                {showPreview && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-3">Theme Preview</h4>
                        <ThemePreview theme={theme} />
                    </div>
                )}

                <div className="space-y-6">
                    {/* Basic Information */}
                    <div>
                        <h4 className="font-medium text-gray-900 mb-3">Theme Information</h4>
                        <dl className="space-y-2">
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Name</dt>
                                <dd className="text-sm text-gray-900">{theme.name}</dd>
                            </div>
                            {theme.description && (
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                                    <dd className="text-sm text-gray-900">{theme.description}</dd>
                                </div>
                            )}
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Status</dt>
                                <dd className="text-sm">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${theme.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {theme.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Created</dt>
                                <dd className="text-sm text-gray-900">
                                    {new Date(theme.created_at).toLocaleDateString()} by {theme.created_by?.username}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* CSS Variables */}
                    <div>
                        <h4 className="font-medium text-gray-900 mb-3">CSS Variables</h4>
                        {Object.keys(theme.css_variables || {}).length > 0 ? (
                            <div className="space-y-2">
                                {Object.entries(theme.css_variables).map(([key, value]) => (
                                    <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div className="flex items-center space-x-3">
                                            <code className="text-sm font-mono text-gray-700">--{key}</code>
                                            {getColorVariables({ [key]: value }).length > 0 && (
                                                <div
                                                    className="w-6 h-6 rounded border border-gray-300"
                                                    style={{ backgroundColor: value }}
                                                />
                                            )}
                                        </div>
                                        <code className="text-sm font-mono text-gray-600">{value}</code>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">No CSS variables defined for this theme.</p>
                        )}
                    </div>

                    {/* Custom CSS */}
                    {theme.custom_css && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-3">Custom CSS</h4>
                            <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                                <code>{theme.custom_css}</code>
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Theme Preview Component
const ThemePreview = ({ theme }) => {
    const variables = theme.css_variables || {}

    // Create style object from CSS variables
    const previewStyle = Object.entries(variables).reduce((acc, [key, value]) => {
        acc[`--${key}`] = value
        return acc
    }, {})

    return (
        <div className="border rounded-lg p-4 bg-white" style={previewStyle}>
            <div className="space-y-4">
                {/* Header */}
                <div
                    className="p-4 rounded"
                    style={{
                        backgroundColor: variables.primary || '#3b82f6',
                        color: variables['text-on-primary'] || variables.background || '#ffffff'
                    }}
                >
                    <h3 className="text-lg font-bold">Sample Header</h3>
                    <p className="text-sm opacity-90">Preview of your theme</p>
                </div>

                {/* Content */}
                <div
                    className="p-4 rounded"
                    style={{
                        backgroundColor: variables.surface || variables.background || '#f8fafc',
                        color: variables.text || '#1f2937'
                    }}
                >
                    <h4 className="font-medium mb-2">Sample Content</h4>
                    <p className="text-sm" style={{ color: variables['text-muted'] || variables.secondary || '#6b7280' }}>
                        This is how your content will look with the current theme. The colors and styling will be applied consistently across your pages.
                    </p>

                    {/* Buttons */}
                    <div className="flex space-x-2 mt-3">
                        <button
                            className="px-3 py-1 rounded text-sm"
                            style={{
                                backgroundColor: variables.primary || '#3b82f6',
                                color: variables['text-on-primary'] || '#ffffff'
                            }}
                        >
                            Primary Button
                        </button>
                        <button
                            className="px-3 py-1 rounded text-sm border"
                            style={{
                                borderColor: variables.primary || '#3b82f6',
                                color: variables.primary || '#3b82f6'
                            }}
                        >
                            Secondary Button
                        </button>
                    </div>
                </div>

                {/* Color Palette */}
                <div>
                    <h5 className="text-sm font-medium mb-2">Color Palette</h5>
                    <div className="flex flex-wrap gap-2">
                        {getColorVariables(variables).map((color, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div
                                    className="w-8 h-8 rounded border border-gray-300"
                                    style={{ backgroundColor: color }}
                                />
                                <span className="text-xs mt-1 text-gray-500">{color}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ThemeEditor 