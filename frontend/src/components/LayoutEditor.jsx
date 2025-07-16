import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus,
    Edit3,
    Trash2,
    Save,
    X,
    Grid3X3,
    Square,
    Monitor,
    Eye,
    Move,
    Settings
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

const LayoutEditor = () => {
    const [selectedLayout, setSelectedLayout] = useState(null)
    const [isCreating, setIsCreating] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const queryClient = useQueryClient()

    // Fetch layouts
    const { data: layouts, isLoading } = useQuery({
        queryKey: ['layouts'],
        queryFn: async () => {
            const response = await axios.get('/api/v1/webpages/layouts/')
            return response.data
        }
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Layout Editor</h2>
                    <p className="text-gray-600 mt-1">
                        Create and manage page layout templates with defined slots
                    </p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Layout
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Layouts List */}
                <div className="lg:col-span-1">
                    <LayoutsList
                        layouts={layouts}
                        selectedLayout={selectedLayout}
                        onSelectLayout={setSelectedLayout}
                        isLoading={isLoading}
                    />
                </div>

                {/* Layout Editor Panel */}
                <div className="lg:col-span-2">
                    {isCreating && (
                        <LayoutForm
                            onSave={() => {
                                setIsCreating(false)
                                queryClient.invalidateQueries(['layouts'])
                            }}
                            onCancel={() => setIsCreating(false)}
                        />
                    )}

                    {selectedLayout && !isCreating && (
                        <LayoutEditPanel
                            layout={selectedLayout}
                            onUpdate={() => {
                                queryClient.invalidateQueries(['layouts'])
                                setSelectedLayout(null)
                            }}
                            onCancel={() => setSelectedLayout(null)}
                            showPreview={showPreview}
                            onTogglePreview={() => setShowPreview(!showPreview)}
                        />
                    )}

                    {!selectedLayout && !isCreating && (
                        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                            <Grid3X3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Select a Layout to Edit
                            </h3>
                            <p className="text-gray-500">
                                Choose a layout from the list or create a new one to get started
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Layouts List Component
const LayoutsList = ({ layouts, selectedLayout, onSelectLayout, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded"></div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Available Layouts</h3>
            </div>
            <div className="divide-y divide-gray-200">
                {layouts?.map((layout) => (
                    <div
                        key={layout.id}
                        onClick={() => onSelectLayout(layout)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedLayout?.id === layout.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-gray-900">{layout.name}</h4>
                                <p className="text-sm text-gray-500 mt-1">
                                    {layout.slot_configuration?.slots?.length || 0} slots
                                </p>
                                {layout.description && (
                                    <p className="text-sm text-gray-600 mt-1">{layout.description}</p>
                                )}
                            </div>
                            <div className="flex items-center space-x-2">
                                {layout.is_active ? (
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
                {layouts?.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        <Grid3X3 className="w-8 h-8 mx-auto mb-2" />
                        <p>No layouts found</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// Layout Form Component
const LayoutForm = ({ layout = null, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        name: layout?.name || '',
        description: layout?.description || '',
        slot_configuration: layout?.slot_configuration || { slots: [] },
        css_classes: layout?.css_classes || '',
        is_active: layout?.is_active ?? true
    })

    const mutation = useMutation({
        mutationFn: async (data) => {
            if (layout) {
                return axios.put(`/api/v1/webpages/layouts/${layout.id}/`, data)
            } else {
                return axios.post('/api/v1/webpages/layouts/', data)
            }
        },
        onSuccess: () => {
            toast.success(`Layout ${layout ? 'updated' : 'created'} successfully`)
            onSave()
        },
        onError: (error) => {
            toast.error(`Failed to ${layout ? 'update' : 'create'} layout`)
            console.error(error)
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        mutation.mutate(formData)
    }

    const addSlot = () => {
        const newSlot = {
            name: `slot_${formData.slot_configuration.slots.length + 1}`,
            display_name: `Slot ${formData.slot_configuration.slots.length + 1}`,
            description: '',
            css_classes: '',
            allows_multiple: true
        }
        setFormData({
            ...formData,
            slot_configuration: {
                ...formData.slot_configuration,
                slots: [...formData.slot_configuration.slots, newSlot]
            }
        })
    }

    const updateSlot = (index, field, value) => {
        const updatedSlots = [...formData.slot_configuration.slots]
        updatedSlots[index] = { ...updatedSlots[index], [field]: value }
        setFormData({
            ...formData,
            slot_configuration: {
                ...formData.slot_configuration,
                slots: updatedSlots
            }
        })
    }

    const removeSlot = (index) => {
        const updatedSlots = formData.slot_configuration.slots.filter((_, i) => i !== index)
        setFormData({
            ...formData,
            slot_configuration: {
                ...formData.slot_configuration,
                slots: updatedSlots
            }
        })
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                    {layout ? 'Edit Layout' : 'Create New Layout'}
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
                        <label htmlFor="layout-name" className="block text-sm font-medium text-gray-700 mb-2">
                            Layout Name
                        </label>
                        <input
                            id="layout-name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div className="flex items-center">
                        <label className="flex items-center">
                            <input
                                id="layout-active"
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Active</span>
                        </label>
                    </div>
                </div>

                <div>
                    <label htmlFor="layout-description" className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                    </label>
                    <textarea
                        id="layout-description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Slots Configuration */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-gray-700">
                            Layout Slots
                        </label>
                        <button
                            type="button"
                            onClick={addSlot}
                            className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Slot
                        </button>
                    </div>

                    <div className="space-y-4">
                        {formData.slot_configuration.slots.map((slot, index) => (
                            <div key={index} className="p-4 border border-gray-200 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-gray-900">Slot {index + 1}</h4>
                                    <button
                                        type="button"
                                        onClick={() => removeSlot(index)}
                                        className="text-red-600 hover:text-red-700"
                                        aria-label={`Remove Slot ${index + 1}`}
                                        title={`Remove Slot ${index + 1}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor={`slot-name-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                                            Slot Name (Technical)
                                        </label>
                                        <input
                                            id={`slot-name-${index}`}
                                            type="text"
                                            value={slot.name}
                                            onChange={(e) => updateSlot(index, 'name', e.target.value)}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor={`slot-display-name-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                                            Display Name
                                        </label>
                                        <input
                                            id={`slot-display-name-${index}`}
                                            type="text"
                                            value={slot.display_name || ''}
                                            onChange={(e) => updateSlot(index, 'display_name', e.target.value)}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label htmlFor={`slot-description-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                                            Description
                                        </label>
                                        <input
                                            id={`slot-description-${index}`}
                                            type="text"
                                            value={slot.description || ''}
                                            onChange={(e) => updateSlot(index, 'description', e.target.value)}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor={`slot-css-classes-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                                            CSS Classes
                                        </label>
                                        <input
                                            id={`slot-css-classes-${index}`}
                                            type="text"
                                            value={slot.css_classes || ''}
                                            onChange={(e) => updateSlot(index, 'css_classes', e.target.value)}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="col-span-2 bg-gray-50"
                                        />
                                    </div>

                                    <div className="flex items-center">
                                        <label className="flex items-center">
                                            <input
                                                id={`slot-allows-multiple-${index}`}
                                                type="checkbox"
                                                checked={slot.allows_multiple ?? true}
                                                onChange={(e) => updateSlot(index, 'allows_multiple', e.target.checked)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="ml-2 text-xs text-gray-700">Allow Multiple Widgets</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {formData.slot_configuration.slots.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                <Square className="w-8 h-8 mx-auto mb-2" />
                                <p>No slots defined. Add slots to create your layout structure.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CSS Classes */}
                <div>
                    <label htmlFor="layout-css-classes" className="block text-sm font-medium text-gray-700 mb-2">
                        Layout CSS Classes
                    </label>
                    <textarea
                        id="layout-css-classes"
                        value={formData.css_classes}
                        onChange={(e) => setFormData({ ...formData, css_classes: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder=".layout-example { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Custom CSS classes for this layout. Will be included in the page head.
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
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {mutation.isPending ? 'Saving...' : (layout ? 'Update Layout' : 'Create Layout')}
                    </button>
                </div>
            </form>
        </div>
    )
}

// Layout Edit Panel Component  
const LayoutEditPanel = ({ layout, onUpdate, onCancel, showPreview, onTogglePreview }) => {
    const [isEditing, setIsEditing] = useState(false)

    const deleteMutation = useMutation({
        mutationFn: async () => {
            return axios.delete(`/api/v1/webpages/layouts/${layout.id}/`)
        },
        onSuccess: () => {
            toast.success('Layout deleted successfully')
            onCancel()
        },
        onError: () => {
            toast.error('Failed to delete layout')
        }
    })

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this layout? This action cannot be undone.')) {
            deleteMutation.mutate()
        }
    }

    if (isEditing) {
        return (
            <LayoutForm
                layout={layout}
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
                    <h3 className="text-lg font-medium text-gray-900">{layout.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {layout.slot_configuration?.slots?.length || 0} slots defined
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={onTogglePreview}
                        className={`inline-flex items-center px-3 py-1 rounded-md text-sm transition-colors ${showPreview
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <Eye className="w-4 h-4 mr-1" />
                        {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
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
                        <h4 className="font-medium text-gray-900 mb-3">Layout Preview</h4>
                        <LayoutPreview layout={layout} />
                    </div>
                )}

                <div className="space-y-6">
                    {/* Basic Information */}
                    <div>
                        <h4 className="font-medium text-gray-900 mb-3">Layout Information</h4>
                        <dl className="space-y-2">
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Name</dt>
                                <dd className="text-sm text-gray-900">{layout.name}</dd>
                            </div>
                            {layout.description && (
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                                    <dd className="text-sm text-gray-900">{layout.description}</dd>
                                </div>
                            )}
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Status</dt>
                                <dd className="text-sm">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${layout.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {layout.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Created</dt>
                                <dd className="text-sm text-gray-900">
                                    {new Date(layout.created_at).toLocaleDateString()} by {layout.created_by?.username}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* Slots */}
                    <div>
                        <h4 className="font-medium text-gray-900 mb-3">Defined Slots</h4>
                        {layout.slot_configuration?.slots?.length > 0 ? (
                            <div className="space-y-3">
                                {layout.slot_configuration.slots.map((slot, index) => (
                                    <div key={index} className="p-3 border border-gray-200 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-gray-900">{slot.display_name || slot.name}</span>
                                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{slot.name}</code>
                                        </div>
                                        {slot.description && (
                                            <p className="text-sm text-gray-600 mb-2">{slot.description}</p>
                                        )}
                                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                                            {slot.css_classes && (
                                                <span>CSS: <code>{slot.css_classes}</code></span>
                                            )}
                                            <span>
                                                {slot.allows_multiple ? 'Multiple widgets allowed' : 'Single widget only'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">No slots defined for this layout.</p>
                        )}
                    </div>

                    {/* CSS Classes */}
                    {layout.css_classes && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-3">Custom CSS</h4>
                            <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                                <code>{layout.css_classes}</code>
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Layout Preview Component
const LayoutPreview = ({ layout }) => {
    const slots = layout.slot_configuration?.slots || []

    return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
            <div className="text-xs text-gray-500 mb-2">Layout: {layout.name}</div>
            <div className="space-y-2">
                {slots.map((slot, index) => (
                    <div
                        key={index}
                        className={`border border-gray-200 rounded p-3 bg-gray-50 ${slot.css_classes || ''}`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                                {slot.display_name || slot.name}
                            </span>
                            <span className="text-xs text-gray-500">
                                {slot.allows_multiple ? 'Multi' : 'Single'}
                            </span>
                        </div>
                        {slot.description && (
                            <div className="text-xs text-gray-500 mt-1">{slot.description}</div>
                        )}
                    </div>
                ))}
                {slots.length === 0 && (
                    <div className="text-center py-4 text-gray-400">
                        <Square className="w-6 h-6 mx-auto mb-1" />
                        <div className="text-xs">No slots defined</div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LayoutEditor 