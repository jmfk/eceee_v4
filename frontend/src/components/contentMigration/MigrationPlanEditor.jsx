import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
    Save, 
    ArrowLeft, 
    Plus, 
    Trash2, 
    Settings, 
    ChevronDown, 
    ChevronUp,
    Code,
    Activity,
    Layers,
    Type,
    Image as ImageIcon,
    FileCode,
    Filter
} from 'lucide-react'
import { api } from '../../api/client'
import TextInput from '../form-fields/TextInput'
import TextareaInput from '../form-fields/TextareaInput'
import SelectInput from '../form-fields/SelectInput'
import ComboboxInput from '../form-fields/ComboboxInput'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'

const MigrationPlanEditor = ({ plan, onBack }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sourceConnection: '',
        targetObjectType: '',
        queryDsl: '',
        workflow: [],
        config: {
            batch_size: 50,
            reprocess_existing: false
        }
    })
    
    const { addNotification } = useGlobalNotifications()
    const queryClient = useQueryClient()

    useEffect(() => {
        if (plan) {
            setFormData({
                ...plan,
                sourceConnection: plan.sourceConnection || '',
                targetObjectType: plan.targetObjectType || ''
            })
        }
    }, [plan])

    // Fetch Connections
    const { data: connections = [] } = useQuery({
        queryKey: ['data-connections'],
        queryFn: async () => {
            const response = await api.get('/api/v1/data-connections/connections/')
            return response.data.results || response.data
        }
    })

    // Fetch Object Types
    const { data: objectTypes = [] } = useQuery({
        queryKey: ['object-types'],
        queryFn: async () => {
            const response = await api.get('/api/v1/objects/object-types/')
            return response.data.results || response.data
        }
    })

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (plan?.id) {
                return api.patch(`/api/v1/content-migration/plans/${plan.id}/`, data)
            }
            return api.post('/api/v1/content-migration/plans/', data)
        },
        onSuccess: () => {
            addNotification('Migration plan saved', 'success')
            onBack()
        },
        onError: (error) => {
            addNotification('Failed to save plan: ' + (error.response?.data?.detail || 'Unknown error'), 'error')
        }
    })

    const addStep = (type) => {
        const newStep = { type, config: {} }
        // Set some default configs based on type
        if (type === 'extract_variables') {
            newStep.config = { mapping: { title: 'source_title', content: 'source_body' } }
        } else if (type === 'target_mapping') {
            newStep.config = { title_var: 'title', field_mapping: { content: 'content' } }
        }
        
        setFormData(prev => ({
            ...prev,
            workflow: [...prev.workflow, newStep]
        }))
    }

    const removeStep = (index) => {
        setFormData(prev => ({
            ...prev,
            workflow: prev.workflow.filter((_, i) => i !== index)
        }))
    }

    const updateStepConfig = (index, newConfig) => {
        setFormData(prev => {
            const newWorkflow = [...prev.workflow]
            newWorkflow[index] = { ...newWorkflow[index], config: newConfig }
            return { ...prev, workflow: newWorkflow }
        })
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900 mb-6 group">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to migration plans
            </button>

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">{plan ? `Edit Plan: ${plan.name}` : 'New Migration Plan'}</h1>
                <button 
                    onClick={() => saveMutation.mutate(formData)}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
                >
                    <Save className="w-4 h-4" />
                    <span>Save Plan</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold flex items-center"><Settings className="w-5 h-5 mr-2 text-blue-600" /> Basic Information</h3>
                    <TextInput 
                        label="Plan Name" 
                        value={formData.name} 
                        onChange={val => setFormData(p => ({...p, name: val}))} 
                        placeholder="e.g., Import News from Legacy DB"
                        required
                    />
                    <TextareaInput 
                        label="Description" 
                        value={formData.description} 
                        onChange={val => setFormData(p => ({...p, description: val}))} 
                        rows={2}
                    />
                </div>
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold flex items-center"><Activity className="w-5 h-5 mr-2 text-blue-600" /> Data Source & Target</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <ComboboxInput 
                            label="Source Connection"
                            value={formData.sourceConnection}
                            onChange={val => setFormData(p => ({...p, sourceConnection: val}))}
                            options={connections.map(c => ({ value: c.id, label: c.name }))}
                            required
                        />
                        <ComboboxInput 
                            label="Target Object Type"
                            value={formData.targetObjectType}
                            onChange={val => setFormData(p => ({...p, targetObjectType: val}))}
                            options={objectTypes.map(ot => ({ value: ot.id, label: ot.label }))}
                            required
                        />
                    </div>
                    <TextareaInput 
                        label="Source Query (DSL/Path)"
                        value={formData.queryDsl}
                        onChange={val => setFormData(p => ({...p, queryDsl: val}))}
                        placeholder="SELECT * FROM news"
                        className="font-mono text-sm"
                        rows={3}
                    />
                </div>
            </div>

            <div className="mb-12">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold flex items-center"><Layers className="w-5 h-5 mr-2 text-blue-600" /> Migration Workflow</h3>
                    <div className="flex space-x-2">
                        <button onClick={() => addStep('extract_variables')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded flex items-center"><Plus className="w-3 h-3 mr-1" /> Variables</button>
                        <button onClick={() => addStep('condition')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded flex items-center"><Plus className="w-3 h-3 mr-1" /> Condition</button>
                        <button onClick={() => addStep('process_html')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded flex items-center"><Plus className="w-3 h-3 mr-1" /> HTML</button>
                        <button onClick={() => addStep('media_import')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded flex items-center"><Plus className="w-3 h-3 mr-1" /> Media</button>
                        <button onClick={() => addStep('target_mapping')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded flex items-center"><Plus className="w-3 h-3 mr-1" /> Mapping</button>
                    </div>
                </div>

                <div className="space-y-4">
                    {formData.workflow.map((step, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                    <StepIcon type={step.type} />
                                    <span className="font-bold text-sm uppercase tracking-tight">{step.type.replace('_', ' ')}</span>
                                </div>
                                <button onClick={() => removeStep(idx)} className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="p-4 bg-white">
                                <TextareaInput 
                                    label="Configuration (JSON)"
                                    value={JSON.stringify(step.config, null, 2)}
                                    onChange={(val) => {
                                        try {
                                            const cfg = JSON.parse(val)
                                            updateStepConfig(idx, cfg)
                                        } catch(e) {
                                            // Ignore invalid JSON while typing
                                        }
                                    }}
                                    className="font-mono text-xs"
                                    rows={4}
                                />
                            </div>
                        </div>
                    ))}
                    {formData.workflow.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 border-2 border-dashed rounded-lg text-gray-400">
                            No steps added yet. Start by adding a variable extraction step.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const StepIcon = ({ type }) => {
    switch (type) {
        case 'extract_variables': return <Code className="w-4 h-4 text-blue-500" />
        case 'condition': return <Filter className="w-4 h-4 text-orange-500" />
        case 'process_html': return <FileCode className="w-4 h-4 text-purple-500" />
        case 'media_import': return <ImageIcon className="w-4 h-4 text-green-500" />
        case 'target_mapping': return <Layers className="w-4 h-4 text-indigo-500" />
        default: return <Settings className="w-4 h-4 text-gray-500" />
    }
}

export default MigrationPlanEditor

