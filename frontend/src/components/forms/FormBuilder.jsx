import React, { useState, useEffect } from 'react'
import { 
    ArrowLeft, 
    Save, 
    Plus, 
    GripVertical, 
    Settings as Cog, 
    Trash2, 
    Eye,
    ChevronDown,
    Zap,
    MoveUp,
    MoveDown
} from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'

const FormBuilder = ({ form = null, onClose }) => {
    const [formData, setFormData] = useState(form || {
        name: '',
        label: '',
        description: '',
        isActive: true,
        fields: [],
        actions: [],
        conditionalLogic: { rules: [] }
    })
    const [activeTab, setActiveTab] = useState('fields') // fields, actions, settings
    const [selectedFieldId, setSelectedFieldId] = useState(null)
    
    const [selectedActionIndex, setSelectedActionIndex] = useState(null)
    
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Fetch available field types
    const { data: fieldTypes = [] } = useQuery({
        queryKey: ['form-field-types'],
        queryFn: async () => {
            const response = await api.get('/api/v1/forms/field-types/')
            return response.data?.results || response.data || []
        }
    })

    // Fetch data sources (Value Lists, Object Types)
    const { data: dataSources = { valueLists: [], objectTypes: [] } } = useQuery({
        queryKey: ['form-data-sources'],
        queryFn: async () => {
            const response = await api.get('/api/v1/forms/forms/data-sources/')
            return response.data
        }
    })

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            if (form) {
                return await api.patch(`/api/v1/forms/forms/${form.name}/`, data)
            } else {
                return await api.post('/api/v1/forms/forms/', data)
            }
        },
        onSuccess: () => {
            addNotification(`Form ${form ? 'updated' : 'created'} successfully`, 'success')
            queryClient.invalidateQueries(['forms'])
            onClose()
        },
        onError: (error) => {
            addNotification('Failed to save form', 'error')
        }
    })

    const handleSave = () => {
        if (!formData.name || !formData.label) {
            addNotification('Name and Label are required', 'error')
            return
        }
        saveMutation.mutate(formData)
    }

    const addField = (fieldType) => {
        const newField = {
            id: crypto.randomUUID(),
            type: fieldType.name,
            label: `New ${fieldType.label}`,
            name: `field_${formData.fields.length + 1}`,
            validation: { required: false },
            config: { ...fieldType.config },
            ui: {}
        }
        setFormData({
            ...formData,
            fields: [...formData.fields, newField]
        })
        setSelectedFieldId(newField.id)
    }

    const removeField = (fieldId) => {
        setFormData({
            ...formData,
            fields: formData.fields.filter(f => f.id !== fieldId)
        })
        if (selectedFieldId === fieldId) setSelectedFieldId(null)
    }

    const updateField = (fieldId, updates) => {
        setFormData({
            ...formData,
            fields: formData.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f)
        })
    }

    const moveField = (index, direction) => {
        const newFields = [...formData.fields]
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= newFields.length) return
        
        const temp = newFields[index]
        newFields[index] = newFields[newIndex]
        newFields[newIndex] = temp
        
        setFormData({ ...formData, fields: newFields })
    }

    const addAction = (type) => {
        const newAction = {
            type: type,
            config: {},
            conditions: { type: 'and', conditions: [] }
        }
        setFormData({
            ...formData,
            actions: [...formData.actions, newAction]
        })
        setSelectedActionIndex(formData.actions.length)
    }

    const removeAction = (index) => {
        const newActions = [...formData.actions]
        newActions.splice(index, 1)
        setFormData({ ...formData, actions: newActions })
        if (selectedActionIndex === index) setSelectedActionIndex(null)
    }

    const updateAction = (index, updates) => {
        const newActions = [...formData.actions]
        newActions[index] = { ...newActions[index], ...updates }
        setFormData({ ...formData, actions: newActions })
    }

    const selectedAction = selectedActionIndex !== null ? formData.actions[selectedActionIndex] : null

    return (
        <div className="flex flex-col h-full bg-gray-50 max-h-screen overflow-hidden">
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center">
                    <button 
                        onClick={onClose}
                        className="p-2 mr-4 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {form ? `Edit Form: ${form.label}` : 'Create New Form'}
                        </h2>
                        <div className="text-xs text-gray-500 font-mono">
                            {formData.name || 'new-form'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <button className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium">
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saveMutation.isPending ? 'Saving...' : 'Save Form'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0">
                <nav className="flex space-x-8">
                    {['fields', 'actions', 'settings'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex">
                {activeTab === 'fields' && (
                    <>
                        {/* Field Palette */}
                        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto p-4 space-y-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Available Fields</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {fieldTypes.map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => addField(type)}
                                        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg border border-transparent hover:border-blue-200 transition-all text-left"
                                    >
                                        <Plus className="w-4 h-4 mr-2 text-blue-500" />
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Form Canvas */}
                        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                            <div className="max-w-2xl mx-auto space-y-4">
                                {formData.fields.length === 0 ? (
                                    <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                                        <Plus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">Drag or click fields from the left to start building</p>
                                    </div>
                                ) : (
                                    formData.fields.map((field, index) => (
                                        <div 
                                            key={field.id}
                                            onClick={() => setSelectedFieldId(field.id)}
                                            className={`group relative bg-white p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                                selectedFieldId === field.id ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-gray-200 shadow-sm'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center">
                                                    <GripVertical className="w-4 h-4 text-gray-300 mr-2 group-hover:text-gray-400" />
                                                    <div>
                                                        <label className="block text-sm font-semibold text-gray-900">{field.label}</label>
                                                        <p className="text-xs text-gray-500">{field.type} • {field.name}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }}
                                                        disabled={index === 0}
                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        <MoveUp className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }}
                                                        disabled={index === formData.fields.length - 1}
                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        <MoveDown className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                                                        className="p-1 text-red-400 hover:text-red-600"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Properties Panel */}
                        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto p-6">
                            {selectedField ? (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-gray-900">Field Settings</h3>
                                        <button onClick={() => setSelectedFieldId(null)} className="text-gray-400 hover:text-gray-600">
                                            <Trash2 className="w-4 h-4" onClick={() => removeField(selectedField.id)} />
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Label</label>
                                            <input 
                                                type="text" 
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                value={selectedField.label}
                                                onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name (ID)</label>
                                            <input 
                                                type="text" 
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                                value={selectedField.name}
                                                onChange={(e) => updateField(selectedField.id, { name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                            />
                                        </div>
                                        
                                        <div className="pt-4 border-t border-gray-100">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Validation</h4>
                                            <div className="flex items-center">
                                                <input 
                                                    type="checkbox" 
                                                    id="field-required"
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                    checked={selectedField.validation.required}
                                                    onChange={(e) => updateField(selectedField.id, { 
                                                        validation: { ...selectedField.validation, required: e.target.checked } 
                                                    })}
                                                />
                                                <label htmlFor="field-required" className="ml-2 text-sm text-gray-700">Required Field</label>
                                            </div>
                                        </div>

                                        {(selectedField.type === 'select' || selectedField.type === 'multiselect' || selectedField.type === 'radio') && (
                                            <div className="pt-4 border-t border-gray-100">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Data Source</h4>
                                                <select 
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    value={selectedField.dataSourceType || 'manual'}
                                                    onChange={(e) => updateField(selectedField.id, { dataSourceType: e.target.value })}
                                                >
                                                    <option value="manual">Manual Options</option>
                                                    <option value="valueList">Value List</option>
                                                    <option value="objectStorage">Object Storage</option>
                                                </select>
                                                
                                                {selectedField.dataSourceType === 'valueList' && (
                                                    <div className="mt-2">
                                                        <select 
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                            value={selectedField.valueListId || ''}
                                                            onChange={(e) => updateField(selectedField.id, { valueListId: e.target.value })}
                                                        >
                                                            <option value="">Select a Value List...</option>
                                                            {dataSources.valueLists.map(vl => (
                                                                <option key={vl.id} value={vl.id}>{vl.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-center text-gray-400 italic">
                                    Select a field to configure its properties
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'actions' && (
                    <div className="flex-1 overflow-hidden flex">
                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            <div className="max-w-2xl mx-auto">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-gray-900">Submission Actions</h3>
                                    <div className="relative group">
                                        <button className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                                            <Plus className="w-4 h-4 mr-1" />
                                            Add Action
                                        </button>
                                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                            <button onClick={() => addAction('send_email')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                                                <Plus className="w-3 h-3 mr-2" /> Send Email
                                            </button>
                                            <button onClick={() => addAction('webhook')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center border-t border-gray-100">
                                                <Plus className="w-3 h-3 mr-2" /> Webhook (HTTP POST)
                                            </button>
                                            <button onClick={() => addAction('save_to_object_storage')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center border-t border-gray-100">
                                                <Plus className="w-3 h-3 mr-2" /> Save to Object Storage
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    {formData.actions.length === 0 ? (
                                        <div className="text-center py-12 bg-white border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                                            <Zap className="w-10 h-10 mx-auto mb-3" />
                                            <p>No actions configured yet</p>
                                        </div>
                                    ) : (
                                        formData.actions.map((action, index) => (
                                            <div 
                                                key={index}
                                                onClick={() => setSelectedActionIndex(index)}
                                                className={`bg-white border-2 rounded-xl p-4 transition-all cursor-pointer ${
                                                    selectedActionIndex === index ? 'border-blue-500 shadow-md' : 'border-transparent border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center">
                                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg mr-3">
                                                            <Zap className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-gray-900">
                                                                {action.type === 'send_email' ? 'Send Email Notification' : 
                                                                 action.type === 'webhook' ? 'Trigger Webhook' : 
                                                                 'Save to Object Storage'}
                                                            </h4>
                                                            <p className="text-xs text-gray-500">{action.type}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); removeAction(index); }} className="text-gray-400 hover:text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Settings Panel */}
                        <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto p-6">
                            {selectedAction ? (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-4">
                                        Action Configuration: {selectedAction.type}
                                    </h3>
                                    
                                    {selectedAction.type === 'send_email' && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">To Email</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    value={selectedAction.config.to || ''}
                                                    onChange={(e) => updateAction(selectedActionIndex, { 
                                                        config: { ...selectedAction.config, to: e.target.value } 
                                                    })}
                                                    placeholder="admin@example.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    value={selectedAction.config.subject || ''}
                                                    onChange={(e) => updateAction(selectedActionIndex, { 
                                                        config: { ...selectedAction.config, subject: e.target.value } 
                                                    })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Template</label>
                                                <textarea 
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                                    rows={6}
                                                    value={selectedAction.config.template || ''}
                                                    onChange={(e) => updateAction(selectedActionIndex, { 
                                                        config: { ...selectedAction.config, template: e.target.value } 
                                                    })}
                                                    placeholder="Use {{ field_name }} for variables"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedAction.type === 'webhook' && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Webhook URL</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    value={selectedAction.config.url || ''}
                                                    onChange={(e) => updateAction(selectedActionIndex, { 
                                                        config: { ...selectedAction.config, url: e.target.value } 
                                                    })}
                                                    placeholder="https://hooks.example.com/..."
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedAction.type === 'save_to_object_storage' && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Object Type</label>
                                                <select 
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    value={selectedAction.config.object_type || ''}
                                                    onChange={(e) => updateAction(selectedActionIndex, { 
                                                        config: { ...selectedAction.config, object_type: e.target.value } 
                                                    })}
                                                >
                                                    <option value="">Select Object Type...</option>
                                                    {dataSources.objectTypes.map(ot => (
                                                        <option key={ot.id} value={ot.name}>{ot.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="pt-4 border-t border-gray-100">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Field Mapping</h4>
                                                <p className="text-xs text-gray-400 mb-4 italic">Map form fields to object properties</p>
                                                
                                                <div className="space-y-3">
                                                    {formData.fields.map(field => (
                                                        <div key={field.id} className="flex items-center space-x-2">
                                                            <div className="flex-1 text-xs font-medium truncate">{field.label}</div>
                                                            <div className="text-gray-400">→</div>
                                                            <input 
                                                                type="text" 
                                                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                                                placeholder="object_prop"
                                                                value={(selectedAction.config.field_mapping || {})[field.name] || ''}
                                                                onChange={(e) => {
                                                                    const mapping = { ...selectedAction.config.field_mapping } || {};
                                                                    mapping[field.name] = e.target.value;
                                                                    updateAction(selectedActionIndex, { 
                                                                        config: { ...selectedAction.config, field_mapping: mapping } 
                                                                    });
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-center text-gray-400 italic">
                                    Select an action to configure its settings
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Form Label</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="e.g. Contact Us"
                                        value={formData.label}
                                        onChange={(e) => setFormData({...formData, label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Identifier (Name)</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-xs"
                                        placeholder="e.g. contact-us"
                                        value={formData.name}
                                        readOnly
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={3}
                                    placeholder="Purpose of this form..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>
                            <div className="flex items-center">
                                <input 
                                    type="checkbox" 
                                    id="is-active"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                                />
                                <label htmlFor="is-active" className="ml-2 text-sm text-gray-700 font-medium">Form is active and accepting submissions</label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default FormBuilder

