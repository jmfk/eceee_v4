import React, { useState, useEffect } from 'react'
import {
    Plus,
    Edit,
    Trash2,
    Save,
    X,
    List,
    GripVertical,
    Check,
    AlertCircle,
    Hash,
    Type,
    Calculator
} from 'lucide-react'
import { valueListsApi } from '../../api/valueLists'
import { ReorderableInput } from '../form-fields'

/**
 * ValueListsManager Component
 * 
 * Settings interface for managing value lists and their items.
 * Provides CRUD operations and drag-and-drop reordering.
 */
const ValueListsManager = () => {
    const [valueLists, setValueLists] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editingList, setEditingList] = useState(null)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [selectedList, setSelectedList] = useState(null)
    const [saving, setSaving] = useState(false)

    // Form state for creating/editing value lists
    const [formData, setFormData] = useState({
        name: '',
        label: '',
        description: '',
        value_type: 'string',
        is_active: true,
        items_data: []
    })

    // Load value lists on mount
    useEffect(() => {
        loadValueLists()
    }, [])

    const loadValueLists = async () => {
        try {
            setLoading(true)
            const response = await valueListsApi.list()
            setValueLists(response.results || response.data || [])
            setError('')
        } catch (err) {
            console.error('Failed to load value lists:', err)
            setError('Failed to load value lists')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateList = async () => {
        try {
            setSaving(true)
            await valueListsApi.create(formData)
            await loadValueLists()
            setShowCreateForm(false)
            resetForm()
            setError('')
        } catch (err) {
            console.error('Failed to create value list:', err)
            setError('Failed to create value list')
        } finally {
            setSaving(false)
        }
    }

    const handleUpdateList = async () => {
        if (!editingList) return

        try {
            setSaving(true)
            await valueListsApi.update(editingList.id, {
                label: formData.label,
                description: formData.description,
                value_type: formData.value_type,
                is_active: formData.is_active
            })
            await loadValueLists()
            setEditingList(null)
            resetForm()
            setError('')
        } catch (err) {
            console.error('Failed to update value list:', err)
            setError('Failed to update value list')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteList = async (listId) => {
        if (!window.confirm('Are you sure you want to delete this value list?')) {
            return
        }

        try {
            await valueListsApi.delete(listId)
            await loadValueLists()
            if (selectedList?.id === listId) {
                setSelectedList(null)
            }
            setError('')
        } catch (err) {
            console.error('Failed to delete value list:', err)
            setError('Failed to delete value list')
        }
    }

    const handleAddItem = async (valueListId, itemData) => {
        try {
            await valueListsApi.addItem(valueListId, itemData)
            await loadValueLists()
            // Refresh selected list if it's the one we updated
            if (selectedList?.id === valueListId) {
                const updatedList = await valueListsApi.get(valueListId)
                setSelectedList(updatedList)
            }
        } catch (err) {
            console.error('Failed to add item:', err)
            setError('Failed to add item')
        }
    }

    const resetForm = () => {
        setFormData({
            name: '',
            label: '',
            description: '',
            value_type: 'string',
            is_active: true,
            items_data: []
        })
    }

    const startEdit = (valueList) => {
        setFormData({
            name: valueList.name,
            label: valueList.label,
            description: valueList.description || '',
            value_type: valueList.value_type,
            is_active: valueList.is_active,
            items_data: []
        })
        setEditingList(valueList)
        setShowCreateForm(false)
    }

    const cancelEdit = () => {
        setEditingList(null)
        setShowCreateForm(false)
        resetForm()
    }

    const getValueTypeIcon = (valueType) => {
        switch (valueType) {
            case 'string': return Type
            case 'integer': return Hash
            case 'decimal': return Calculator
            default: return Type
        }
    }

    const getValueTypeColor = (valueType) => {
        switch (valueType) {
            case 'string': return 'text-blue-600 bg-blue-100'
            case 'integer': return 'text-green-600 bg-green-100'
            case 'decimal': return 'text-purple-600 bg-purple-100'
            default: return 'text-gray-600 bg-gray-100'
        }
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Loading value lists...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Value Lists</h2>
                    <p className="text-gray-600 mt-1">
                        Manage centralized lists of values for form fields
                    </p>
                </div>
                <button
                    onClick={() => {
                        setShowCreateForm(true)
                        setEditingList(null)
                        resetForm()
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Create Value List</span>
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-3" />
                    <div>
                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Value Lists Panel */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Available Lists ({valueLists.length})</h3>

                    {valueLists.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <List className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                            <p>No value lists created yet</p>
                            <p className="text-sm mt-1">Create your first value list to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {valueLists.map((valueList) => {
                                const ValueTypeIcon = getValueTypeIcon(valueList.value_type)
                                return (
                                    <div
                                        key={valueList.id}
                                        className={`
                                            p-4 border rounded-lg cursor-pointer transition-all
                                            ${selectedList?.id === valueList.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }
                                        `}
                                        onClick={() => setSelectedList(valueList)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <ValueTypeIcon className="w-5 h-5 text-gray-600" />
                                                <div>
                                                    <h4 className="font-medium text-gray-900">{valueList.label}</h4>
                                                    <p className="text-sm text-gray-500">{valueList.name}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-1 text-xs rounded-full ${getValueTypeColor(valueList.value_type)}`}>
                                                    {valueList.value_type}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {valueList.item_count} items
                                                </span>
                                                <div className="flex items-center space-x-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            startEdit(valueList)
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Edit value list"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    {!valueList.is_system && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDeleteList(valueList.id)
                                                            }}
                                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                            title="Delete value list"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {valueList.description && (
                                            <p className="text-sm text-gray-600 mt-2">{valueList.description}</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Details/Form Panel */}
                <div className="space-y-4">
                    {(showCreateForm || editingList) ? (
                        /* Create/Edit Form */
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-900">
                                    {editingList ? 'Edit Value List' : 'Create Value List'}
                                </h3>
                                <button
                                    onClick={cancelEdit}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="countries, priorities, statuses"
                                        disabled={editingList !== null} // Can't change name when editing
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Unique identifier (letters, numbers, underscores only)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Label *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.label}
                                        onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                                        placeholder="Countries, Priorities, Status Options"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Optional description of what this list represents"
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Value Type
                                    </label>
                                    <select
                                        value={formData.value_type}
                                        onChange={(e) => setFormData(prev => ({ ...prev, value_type: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="string">String</option>
                                        <option value="integer">Integer</option>
                                        <option value="decimal">Decimal</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Type of values that will be stored in this list
                                    </p>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                                        Active (available for use in forms)
                                    </label>
                                </div>

                                <div className="flex items-center space-x-3 pt-4 border-t">
                                    <button
                                        onClick={editingList ? handleUpdateList : handleCreateList}
                                        disabled={saving || !formData.name || !formData.label}
                                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Save className="w-4 h-4" />
                                        <span>{saving ? 'Saving...' : (editingList ? 'Update' : 'Create')}</span>
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : selectedList ? (
                        /* Selected List Details */
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    {React.createElement(getValueTypeIcon(selectedList.value_type), {
                                        className: "w-5 h-5 text-gray-600"
                                    })}
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">{selectedList.label}</h3>
                                        <p className="text-sm text-gray-500">{selectedList.name}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => startEdit(selectedList)}
                                    className="flex items-center space-x-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                >
                                    <Edit className="w-4 h-4" />
                                    <span>Edit</span>
                                </button>
                            </div>

                            {selectedList.description && (
                                <p className="text-gray-600 mb-4">{selectedList.description}</p>
                            )}

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-gray-900">Items ({selectedList.item_count})</h4>
                                    <span className={`px-2 py-1 text-xs rounded-full ${getValueTypeColor(selectedList.value_type)}`}>
                                        {selectedList.value_type}
                                    </span>
                                </div>

                                {selectedList.items && selectedList.items.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedList.items.map((item, index) => (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-sm text-gray-500">#{item.order || index + 1}</span>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{item.label}</div>
                                                        {item.effective_value !== item.label && (
                                                            <div className="text-sm text-gray-500">
                                                                Value: <code className="bg-gray-200 px-1 rounded">{item.effective_value}</code>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {item.is_active ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <X className="w-4 h-4 text-red-500" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-500">
                                        <List className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                                        <p className="text-sm">No items in this list</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Welcome Message */
                        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                            <List className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Value List</h3>
                            <p className="text-gray-600">
                                Choose a value list from the left to view and manage its items,
                                or create a new value list to get started.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

ValueListsManager.displayName = 'ValueListsManager'

export default ValueListsManager
