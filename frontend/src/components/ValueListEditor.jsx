import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { valueListsApi, valueListItemsApi } from '../api/valueLists'
import { extractErrorMessage } from '../utils/errorHandling.js'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import {
    Plus,
    Edit3,
    Trash2,
    Save,
    X,
    List as ListIcon,
    Eye,
    Search,
    ArrowLeft,
    GripVertical,
    Hash,
    Type,
    Calculator,
    Check,
    AlertCircle
} from 'lucide-react'

const ValueListEditor = () => {
    const [selectedValueList, setSelectedValueList] = useState(null)
    const [isCreating, setIsCreating] = useState(false)
    const [currentView, setCurrentView] = useState('list') // 'list' or 'edit'
    const [searchTerm, setSearchTerm] = useState('')
    const [searchParams, setSearchParams] = useSearchParams()
    const queryClient = useQueryClient()
    const { showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()

    // Form state for creating/editing value lists
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        value_type: 'string',
        is_active: true
    })

    // Item management state
    const [items, setItems] = useState([])
    const [newItemLabel, setNewItemLabel] = useState('')
    const [newItemValue, setNewItemValue] = useState('')
    const [editingItemId, setEditingItemId] = useState(null)
    const [editingItemData, setEditingItemData] = useState({ label: '', value: '' })
    const [valueValidationError, setValueValidationError] = useState('')
    const [draggedItemId, setDraggedItemId] = useState(null)

    // Fetch value lists
    const { data: valueLists = [], isLoading } = useQuery({
        queryKey: ['value-lists'],
        queryFn: async () => {
            try {
                const response = await valueListsApi.list()
                return response.results || response.data || []
            } catch (error) {
                console.error('Error fetching value lists:', error)
                throw error
            }
        }
    })

    // Handle URL parameters for direct value list editing
    useEffect(() => {
        const editValueListId = searchParams.get('edit')
        if (editValueListId && valueLists.length > 0) {
            const valueListToEdit = valueLists.find(vl => vl.id.toString() === editValueListId)
            if (valueListToEdit) {
                setSelectedValueList(valueListToEdit)
                setCurrentView('edit')
                setIsCreating(false)
                loadValueListDetails(valueListToEdit.id)
            }
        }
    }, [searchParams, valueLists])

    // Load value list details including items
    const loadValueListDetails = async (valueListId) => {
        try {
            const response = await valueListsApi.getItems(valueListId)
            setItems(response.items || [])
        } catch (error) {
            console.error('Failed to load value list items:', error)
            addNotification('Failed to load value list items', 'error')
        }
    }

    // Filter value lists based on search term
    const filteredValueLists = valueLists.filter(valueList =>
        valueList.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        valueList.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Mutations
    const createMutation = useMutation({
        mutationFn: valueListsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries(['value-lists'])
            addNotification('Value list created successfully', 'success')
            handleBackToList()
        },
        onError: (error) => {
            addNotification(`Failed to create value list: ${extractErrorMessage(error)}`, 'error')
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => valueListsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['value-lists'])
            addNotification('Value list updated successfully', 'success')
        },
        onError: (error) => {
            addNotification(`Failed to update value list: ${extractErrorMessage(error)}`, 'error')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: valueListsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries(['value-lists'])
            addNotification('Value list deleted successfully', 'success')
            handleBackToList()
        },
        onError: (error) => {
            addNotification(`Failed to delete value list: ${extractErrorMessage(error)}`, 'error')
        }
    })

    const handleCreateNew = () => {
        setIsCreating(true)
        setCurrentView('edit')
        setFormData({
            name: '',
            description: '',
            value_type: 'string',
            is_active: true
        })
        setItems([])
    }

    const handleEditValueList = (valueList) => {
        setSelectedValueList(valueList)
        setIsCreating(false)
        setCurrentView('edit')
        setFormData({
            name: valueList.name,
            description: valueList.description || '',
            value_type: valueList.value_type,
            is_active: valueList.is_active
        })
        loadValueListDetails(valueList.id)
    }

    const handleBackToList = () => {
        setCurrentView('list')
        setSelectedValueList(null)
        setIsCreating(false)
        setItems([])
        // Clear URL params
        setSearchParams({})
    }

    const handleSave = async () => {
        try {
            if (isCreating) {
                await createMutation.mutateAsync(formData)
            } else if (selectedValueList) {
                await updateMutation.mutateAsync({
                    id: selectedValueList.id,
                    data: formData
                })
            }
        } catch (error) {
            // Error handling is done in the mutation callbacks
        }
    }

    const handleDelete = async (valueList) => {
        const confirmed = await showConfirm(
            'Delete Value List',
            `Are you sure you want to delete "${valueList.label}"? This action cannot be undone.`,
            'Delete',
            'destructive'
        )

        if (confirmed) {
            deleteMutation.mutate(valueList.id)
        }
    }

    const handleAddItem = async () => {
        if (!newItemLabel.trim()) return

        // Validate value based on value type
        let validatedValue = newItemValue.trim() || undefined
        if (validatedValue) {
            if (formData.value_type === 'integer') {
                const intValue = parseInt(validatedValue, 10)
                if (isNaN(intValue)) {
                    addNotification('Value must be a valid integer', 'error')
                    return
                }
                validatedValue = String(intValue)
            } else if (formData.value_type === 'decimal') {
                const floatValue = parseFloat(validatedValue)
                if (isNaN(floatValue)) {
                    addNotification('Value must be a valid decimal number', 'error')
                    return
                }
                validatedValue = String(floatValue)
            }
        }

        try {
            const itemData = {
                label: newItemLabel.trim(),
                value: validatedValue,
                order: items.length + 1
            }

            if (isCreating) {
                // Add to local items for new value list
                setItems(prev => [...prev, { ...itemData, id: Date.now() }])
            } else if (selectedValueList) {
                // Add to existing value list
                await valueListsApi.addItem(selectedValueList.id, itemData)
                await loadValueListDetails(selectedValueList.id)
            }

            setNewItemLabel('')
            setNewItemValue('')
        } catch (error) {
            addNotification(`Failed to add item: ${extractErrorMessage(error)}`, 'error')
        }
    }

    const handleRemoveItem = async (itemId) => {
        try {
            if (isCreating) {
                // Remove from local items
                setItems(prev => prev.filter(item => item.id !== itemId))
            } else if (selectedValueList) {
                // Remove from existing value list
                await valueListsApi.removeItem(selectedValueList.id, itemId)
                await loadValueListDetails(selectedValueList.id)
            }
        } catch (error) {
            addNotification(`Failed to remove item: ${extractErrorMessage(error)}`, 'error')
        }
    }

    // Inline editing functions
    const startEditItem = (item, field) => {
        setEditingItemId(`${item.id}-${field}`)
        setEditingItemData({
            label: item.label,
            value: item.value || ''
        })
    }

    const saveEditItem = async (itemId, field, newValue) => {
        // Validate value based on type if editing value field
        if (field === 'value' && newValue.trim()) {
            if (formData.value_type === 'integer') {
                const intValue = parseInt(newValue, 10)
                if (isNaN(intValue)) {
                    addNotification('Value must be a valid integer', 'error')
                    setEditingItemId(null)
                    return
                }
                newValue = String(intValue)
            } else if (formData.value_type === 'decimal') {
                const floatValue = parseFloat(newValue)
                if (isNaN(floatValue)) {
                    addNotification('Value must be a valid decimal number', 'error')
                    setEditingItemId(null)
                    return
                }
                newValue = String(floatValue)
            }
        }

        try {
            const updateData = field === 'label'
                ? { label: newValue.trim() }
                : { value: newValue.trim() || null }

            if (isCreating) {
                // Update local items for new value list
                setItems(prev => prev.map(item =>
                    item.id === itemId
                        ? { ...item, ...updateData }
                        : item
                ))
            } else if (selectedValueList) {
                // Update existing item via API
                await valueListItemsApi.update(itemId, updateData)
                await loadValueListDetails(selectedValueList.id)
            }

            setEditingItemId(null)
            setEditingItemData({ label: '', value: '' })
        } catch (error) {
            addNotification(`Failed to update item: ${extractErrorMessage(error)}`, 'error')
            setEditingItemId(null)
        }
    }

    const cancelEditItem = () => {
        setEditingItemId(null)
        setEditingItemData({ label: '', value: '' })
    }

    // Drag and drop functions
    const handleDragStart = (e, itemId) => {
        setDraggedItemId(itemId)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDrop = async (e, targetItemId) => {
        e.preventDefault()

        if (!draggedItemId || draggedItemId === targetItemId) {
            setDraggedItemId(null)
            return
        }

        const draggedIndex = items.findIndex(item => item.id === draggedItemId)
        const targetIndex = items.findIndex(item => item.id === targetItemId)

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedItemId(null)
            return
        }

        // Reorder items
        const newItems = [...items]
        const [draggedItem] = newItems.splice(draggedIndex, 1)
        newItems.splice(targetIndex, 0, draggedItem)

        // Update order values
        const updatedItems = newItems.map((item, index) => ({
            ...item,
            order: index + 1
        }))

        setItems(updatedItems)
        setDraggedItemId(null)

        // If editing existing value list, update order on backend
        if (!isCreating && selectedValueList) {
            try {
                const itemOrders = updatedItems.map(item => ({
                    id: item.id,
                    order: item.order
                }))
                await valueListsApi.reorderItems(selectedValueList.id, itemOrders)
            } catch (error) {
                addNotification(`Failed to reorder items: ${extractErrorMessage(error)}`, 'error')
                // Reload items to get correct order
                await loadValueListDetails(selectedValueList.id)
            }
        }
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading value lists...</p>
                </div>
            </div>
        )
    }

    // List View
    if (currentView === 'list') {
        return (
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Value Lists</h1>
                        <p className="text-gray-600 mt-1">Manage centralized dropdown options for form fields</p>
                    </div>
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create Value List</span>
                    </button>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search value lists..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Value Lists Grid */}
                {filteredValueLists.length === 0 ? (
                    <div className="text-center py-12">
                        <ListIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {searchTerm ? 'No value lists found' : 'No value lists yet'}
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {searchTerm
                                ? 'Try adjusting your search terms'
                                : 'Create your first value list to manage dropdown options centrally'
                            }
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={handleCreateNew}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mx-auto"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Create First Value List</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredValueLists.map((valueList) => {
                            const ValueTypeIcon = getValueTypeIcon(valueList.value_type)
                            return (
                                <div
                                    key={valueList.id}
                                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => handleEditValueList(valueList)}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center space-x-3">
                                            <ValueTypeIcon className="w-6 h-6 text-gray-600" />
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{valueList.name}</h3>
                                                <p className="text-sm text-gray-500">{valueList.slug}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`px-2 py-1 text-xs rounded-full ${getValueTypeColor(valueList.value_type)}`}>
                                                {valueList.value_type}
                                            </span>
                                            {!valueList.is_active && (
                                                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {valueList.description && (
                                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                            {valueList.description}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">
                                            {valueList.item_count} item{valueList.item_count !== 1 ? 's' : ''}
                                        </span>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleEditValueList(valueList)
                                                }}
                                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                                title="Edit value list"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            {!valueList.is_system && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDelete(valueList)
                                                    }}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                    title="Delete value list"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    // Edit View
    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={handleBackToList}
                        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Value Lists</span>
                    </button>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isCreating ? 'Create Value List' : `Edit ${selectedValueList?.name}`}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {isCreating
                                ? 'Create a new centralized list of values for form fields'
                                : 'Manage value list settings and items'
                            }
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleSave}
                        disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        <span>{createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}</span>
                    </button>
                    {!isCreating && selectedValueList && !selectedValueList.is_system && (
                        <button
                            onClick={() => handleDelete(selectedValueList)}
                            className="flex items-center space-x-2 px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Value List Settings */}
                <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Value List Settings</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Countries, Priorities, Status Options"
                                    disabled={!isCreating} // Can't change name when editing
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Display name and unique identifier (letters, numbers, spaces allowed)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Optional description of what this list represents"
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Value Type
                                    {(!isCreating && items.length > 0) && (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                                            Locked
                                        </span>
                                    )}
                                </label>
                                <select
                                    value={formData.value_type}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, value_type: e.target.value }))
                                        // Clear validation error and value when type changes
                                        setValueValidationError('')
                                        setNewItemValue('')
                                    }}
                                    disabled={
                                        (!isCreating && selectedValueList?.is_system) || // System lists can't change type
                                        (!isCreating && items.length > 0) // Can't change type when items exist
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                                >
                                    <option value="string">String</option>
                                    <option value="integer">Integer</option>
                                    <option value="decimal">Decimal</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    {(!isCreating && items.length > 0)
                                        ? 'Cannot change type when items exist (delete all items first)'
                                        : (!isCreating && selectedValueList?.is_system)
                                            ? 'Cannot change type of system-managed value lists'
                                            : 'Type of values that will be stored in this list'
                                    }
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
                        </div>
                    </div>
                </div>

                {/* Items Management */}
                <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-medium text-gray-900">
                                    Items ({items.length})
                                </h2>
                                {items.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {items.length > 1 ? 'Drag to reorder • ' : ''}Click labels or values to edit • Enter to save • Esc to cancel
                                    </p>
                                )}
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full ${getValueTypeColor(formData.value_type)}`}>
                                {formData.value_type}
                            </span>
                        </div>

                        {/* Add New Item */}
                        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded">
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Label *
                                        </label>
                                        <input
                                            type="text"
                                            value={newItemLabel}
                                            onChange={(e) => setNewItemLabel(e.target.value)}
                                            placeholder="Display label"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Value (optional) - {formData.value_type}
                                        </label>
                                        <input
                                            type={formData.value_type === 'string' ? 'text' : 'number'}
                                            value={newItemValue}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                setNewItemValue(value)

                                                // Real-time validation
                                                if (value.trim()) {
                                                    if (formData.value_type === 'integer') {
                                                        const intValue = parseInt(value, 10)
                                                        if (isNaN(intValue)) {
                                                            setValueValidationError('Must be a valid integer')
                                                        } else {
                                                            setValueValidationError('')
                                                        }
                                                    } else if (formData.value_type === 'decimal') {
                                                        const floatValue = parseFloat(value)
                                                        if (isNaN(floatValue)) {
                                                            setValueValidationError('Must be a valid decimal number')
                                                        } else {
                                                            setValueValidationError('')
                                                        }
                                                    } else {
                                                        setValueValidationError('')
                                                    }
                                                } else {
                                                    setValueValidationError('')
                                                }
                                            }}
                                            placeholder={
                                                formData.value_type === 'string' ? 'Custom text value' :
                                                    formData.value_type === 'integer' ? '123' :
                                                        '123.45'
                                            }
                                            step={formData.value_type === 'decimal' ? '0.01' : '1'}
                                            className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${valueValidationError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                                                }`}
                                        />
                                        {valueValidationError && (
                                            <p className="text-xs text-red-600 mt-1">{valueValidationError}</p>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1">
                                            {formData.value_type === 'string' && 'Enter a custom text value or leave empty to use slug'}
                                            {formData.value_type === 'integer' && 'Enter a whole number or leave empty to use slug'}
                                            {formData.value_type === 'decimal' && 'Enter a decimal number or leave empty to use slug'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleAddItem}
                                    disabled={!newItemLabel.trim() || valueValidationError}
                                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Item</span>
                                </button>
                            </div>
                        </div>

                        {/* Items List */}
                        {items.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <ListIcon className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                                <p className="text-sm">No items added yet</p>
                                <p className="text-xs mt-1">Add items using the form above</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {items.map((item, index) => (
                                    <div
                                        key={item.id}
                                        draggable={!editingItemId?.startsWith(item.id)}
                                        onDragStart={(e) => handleDragStart(e, item.id)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, item.id)}
                                        className={`
                                            flex items-center space-x-3 p-3 border border-gray-200 rounded transition-all
                                            ${draggedItemId === item.id ? 'opacity-50 bg-blue-50' : 'bg-gray-50'}
                                            ${editingItemId?.startsWith(item.id) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-100'}
                                        `}
                                    >
                                        <GripVertical className={`w-4 h-4 ${editingItemId?.startsWith(item.id) ? 'text-gray-300' : 'text-gray-400 cursor-grab'}`} />
                                        <span className="text-sm text-gray-500 w-8">#{item.order || index + 1}</span>

                                        {/* Inline Editable Fields */}
                                        <div className="flex-1 space-y-1">
                                            {/* Editable Label */}
                                            {editingItemId === `${item.id}-label` ? (
                                                <input
                                                    type="text"
                                                    defaultValue={item.label}
                                                    autoFocus
                                                    onBlur={(e) => {
                                                        const newValue = e.target.value.trim()
                                                        if (newValue && newValue !== item.label) {
                                                            saveEditItem(item.id, 'label', newValue)
                                                        } else {
                                                            setEditingItemId(null)
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.target.blur()
                                                        } else if (e.key === 'Escape') {
                                                            setEditingItemId(null)
                                                        }
                                                    }}
                                                    className="w-full px-2 py-1 text-sm font-medium text-gray-900 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                                    placeholder="Item label"
                                                />
                                            ) : (
                                                <div
                                                    onClick={() => startEditItem(item, 'label')}
                                                    className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                                                    title="Click to edit label"
                                                >
                                                    {item.label}
                                                </div>
                                            )}

                                            {/* Editable Value */}
                                            {editingItemId === `${item.id}-value` ? (
                                                <input
                                                    type={formData.value_type === 'string' ? 'text' : 'number'}
                                                    defaultValue={item.value || ''}
                                                    autoFocus
                                                    onBlur={(e) => {
                                                        const newValue = e.target.value.trim()
                                                        saveEditItem(item.id, 'value', newValue)
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.target.blur()
                                                        } else if (e.key === 'Escape') {
                                                            setEditingItemId(null)
                                                        }
                                                    }}
                                                    step={formData.value_type === 'decimal' ? '0.01' : '1'}
                                                    className="w-full px-2 py-1 text-sm text-gray-700 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                                    placeholder={
                                                        formData.value_type === 'string' ? 'Custom value' :
                                                            formData.value_type === 'integer' ? '123' :
                                                                '123.45'
                                                    }
                                                />
                                            ) : (
                                                <div
                                                    onClick={() => startEditItem(item, 'value')}
                                                    className="text-sm cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                                                    title="Click to edit value"
                                                >
                                                    <code className="bg-gray-200 px-1 rounded text-xs text-gray-700">
                                                        {item.value || item.label}
                                                    </code>
                                                    {!item.value && (
                                                        <span className="text-gray-400 ml-1">(auto-generated)</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            {!editingItemId?.startsWith(item.id) && (
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                    title="Remove item"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    )
}

ValueListEditor.displayName = 'ValueListEditor'

export default ValueListEditor
