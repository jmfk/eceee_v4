import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Settings } from 'lucide-react'

const ACTION_TYPES = [
    { type: 'find_unique_id', label: 'Find Unique ID', description: 'Ensure each item has a unique identifier' },
    { type: 'translate_field', label: 'Translate Field', description: 'Rename or move a field' },
    { type: 'convert_type', label: 'Convert Type', description: 'Change field data type (int, float, etc)' },
    { type: 'count_items', label: 'Count Items', description: 'Count items in a list or dict' },
    { type: 'check_value', label: 'Check Value', description: 'Add a boolean check field' },
    { type: 'filter_expression', label: 'Filter', description: 'Skip items that don\'t match condition' },
]

const WorkflowActionEditor = ({ workflow, onChange }) => {
    const [isAdding, setIsAdding] = useState(false)

    const addAction = (type) => {
        const newAction = { type, config: {} }
        onChange([...workflow, newAction])
        setIsAdding(false)
    }

    const removeAction = (index) => {
        const newWorkflow = [...workflow]
        newWorkflow.splice(index, 1)
        onChange(newWorkflow)
    }

    const updateActionConfig = (index, config) => {
        const newWorkflow = [...workflow]
        newWorkflow[index] = { ...newWorkflow[index], config }
        onChange(newWorkflow)
    }

    const moveAction = (index, direction) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === workflow.length - 1)) return
        const newWorkflow = [...workflow]
        const temp = newWorkflow[index]
        newWorkflow[index] = newWorkflow[index + direction]
        newWorkflow[index + direction] = temp
        onChange(newWorkflow)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Workflow Actions</h4>
                <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                    <Plus className="w-3 h-3" />
                    <span>Add Action</span>
                </button>
            </div>

            {isAdding && (
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    {ACTION_TYPES.map(action => (
                        <button 
                            key={action.type}
                            onClick={() => addAction(action.type)}
                            className="text-left p-2 hover:bg-white rounded border border-transparent hover:border-gray-300 transition-all"
                        >
                            <div className="text-xs font-bold text-gray-900">{action.label}</div>
                            <div className="text-[10px] text-gray-500">{action.description}</div>
                        </button>
                    ))}
                </div>
            )}

            <div className="space-y-3">
                {workflow.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 border-2 border-dashed rounded-lg text-gray-400 text-sm">
                        No actions defined. Each item will be passed through raw.
                    </div>
                ) : (
                    workflow.map((action, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                                <div className="flex items-center space-x-2">
                                    <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                                    <span className="text-xs font-bold text-gray-700 uppercase">{action.type.replace(/_/g, ' ')}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <button onClick={() => moveAction(index, -1)} disabled={index === 0} className="p-1 hover:text-blue-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                                    <button onClick={() => moveAction(index, 1)} disabled={index === workflow.length - 1} className="p-1 hover:text-blue-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                                    <button onClick={() => removeAction(index)} className="p-1 hover:text-red-600 ml-2"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="p-4">
                                <ActionConfigEditor 
                                    type={action.type} 
                                    config={action.config} 
                                    onChange={(cfg) => updateActionConfig(index, cfg)} 
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

const ActionConfigEditor = ({ type, config, onChange }) => {
    const handleFieldChange = (field, value) => {
        onChange({ ...config, [field]: value })
    }

    switch(type) {
        case 'find_unique_id':
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Source Fields (comma separated)</label>
                        <input 
                            type="text" 
                            className="w-full text-xs p-2 border rounded" 
                            value={(config.source_fields || []).join(', ')}
                            onChange={(e) => handleFieldChange('source_fields', e.target.value.split(',').map(s => s.trim()))}
                            placeholder="id, slug, guid"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Target Field Name</label>
                        <input 
                            type="text" 
                            className="w-full text-xs p-2 border rounded" 
                            value={config.target_field || 'uid'}
                            onChange={(e) => handleFieldChange('target_field', e.target.value)}
                        />
                    </div>
                </div>
            )
        case 'translate_field':
            return (
                <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                        {'Field Mapping (JSON: {"new": "old"})'}
                    </label>
                    <textarea 
                        className="w-full text-xs p-2 border rounded font-mono" 
                        rows={2}
                        value={JSON.stringify(config.mapping || {}, null, 2)}
                        onChange={(e) => {
                            try { 
                                handleFieldChange('mapping', JSON.parse(e.target.value)) 
                            } catch(err) {
                                // Ignore invalid JSON while typing
                            }
                        }}
                    />
                </div>
            )
        case 'convert_type':
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Field Name</label>
                        <input type="text" className="w-full text-xs p-2 border rounded" value={config.field || ''} onChange={(e) => handleFieldChange('field', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Convert To</label>
                        <select className="w-full text-xs p-2 border rounded" value={config.to || 'str'} onChange={(e) => handleFieldChange('to', e.target.value)}>
                            <option value="str">String</option>
                            <option value="int">Integer</option>
                            <option value="float">Float</option>
                            <option value="bool">Boolean</option>
                        </select>
                    </div>
                </div>
            )
        case 'count_items':
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Collection Field</label>
                        <input type="text" className="w-full text-xs p-2 border rounded" value={config.field || ''} onChange={(e) => handleFieldChange('field', e.target.value)} placeholder="tags, children" />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Count Target Field</label>
                        <input type="text" className="w-full text-xs p-2 border rounded" value={config.target_field || ''} onChange={(e) => handleFieldChange('target_field', e.target.value)} placeholder="tag_count" />
                    </div>
                </div>
            )
        case 'check_value':
        case 'filter_expression':
            return (
                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Field</label>
                            <input type="text" className="w-full text-xs p-2 border rounded" value={config.field || ''} onChange={(e) => handleFieldChange('field', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Operator</label>
                            <select className="w-full text-xs p-2 border rounded" value={config.operator || '=='} onChange={(e) => handleFieldChange('operator', e.target.value)}>
                                <option value="==">==</option>
                                <option value="!=">!=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                                <option value="contains">contains</option>
                                <option value="regex">regex</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Value</label>
                            <input type="text" className="w-full text-xs p-2 border rounded" value={config.value || ''} onChange={(e) => handleFieldChange('value', e.target.value)} />
                        </div>
                    </div>
                    {type === 'check_value' && (
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Check Result Target Field</label>
                            <input type="text" className="w-full text-xs p-2 border rounded" value={config.target_field || ''} onChange={(e) => handleFieldChange('target_field', e.target.value)} placeholder="is_active" />
                        </div>
                    )}
                </div>
            )
        default:
            return <div className="text-xs text-gray-400">Configure parameters for this action.</div>
    }
}

export default WorkflowActionEditor

