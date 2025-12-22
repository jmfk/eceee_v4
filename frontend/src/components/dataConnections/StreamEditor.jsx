import React, { useState, useEffect } from 'react'
import { 
    Activity, 
    Database, 
    Globe, 
    Play, 
    Settings, 
    Save, 
    X, 
    ChevronRight, 
    ChevronDown,
    Plus,
    Trash2,
    RefreshCw,
    Layers,
    Table,
    Eye,
    CheckCircle2,
    AlertCircle
} from 'lucide-react'
import { api } from '../../api/client'
import WorkflowActionEditor from './WorkflowActionEditor'
import ComboboxInput from '../form-fields/ComboboxInput'
import MultiSelectInput from '../form-fields/MultiSelectInput'
import SelectInput from '../form-fields/SelectInput'

const MODEL_FIELDS = {
    ObjectInstance: [
        { value: 'id', label: 'ID' },
        { value: 'title', label: 'Title' },
        { value: 'slug', label: 'Slug' },
        { value: 'status', label: 'Status' },
        { value: 'publish_date', label: 'Publish Date' },
        { value: 'unpublish_date', label: 'Unpublish Date' },
        { value: 'version', label: 'Version Number' },
        { value: 'created_at', label: 'Created At' },
        { value: 'updated_at', label: 'Updated At' },
        { value: 'data', label: 'Content Data (JSON)' },
        { value: 'metadata', label: 'Metadata (JSON)' },
    ],
    WebPage: [
        { value: 'id', label: 'ID' },
        { value: 'title', label: 'Title' },
        { value: 'slug', label: 'Slug' },
        { value: 'publication_status', label: 'Publication Status' },
        { value: 'publish_date', label: 'Publish Date' },
        { value: 'unpublish_date', label: 'Unpublish Date' },
        { value: 'version', label: 'Version' },
        { value: 'created_at', label: 'Created At' },
        { value: 'updated_at', label: 'Updated At' },
        { value: 'content', label: 'Page Content (JSON)' },
    ],
    Tag: [
        { value: 'id', label: 'ID' },
        { value: 'name', label: 'Name' },
        { value: 'slug', label: 'Slug' },
        { value: 'description', label: 'Description' },
        { value: 'created_at', label: 'Created At' },
    ],
    MediaFile: [
        { value: 'id', label: 'ID' },
        { value: 'name', label: 'Filename' },
        { value: 'file', label: 'File URL' },
        { value: 'mime_type', label: 'MIME Type' },
        { value: 'size', label: 'Size' },
        { value: 'alt_text', label: 'Alt Text' },
        { value: 'title', label: 'Title' },
        { value: 'created_at', label: 'Created At' },
    ],
    ObjectTypeDefinition: [
        { value: 'id', label: 'ID' },
        { value: 'name', label: 'Name' },
        { value: 'label', label: 'Label' },
        { value: 'description', label: 'Description' },
        { value: 'schema', label: 'Schema (JSON)' },
    ]
}

const FILTERABLE_FIELDS = {
    ObjectInstance: [
        { value: 'id', label: 'ID' },
        { value: 'title', label: 'Title' },
        { value: 'slug', label: 'Slug' },
        { value: 'status', label: 'Status' },
        { value: 'object_type', label: 'Object Type (ID)' },
        { value: 'object_type__name', label: 'Object Type Name' },
        { value: 'publish_date', label: 'Publish Date' },
        { value: 'created_at', label: 'Created At' },
    ],
    WebPage: [
        { value: 'id', label: 'ID' },
        { value: 'title', label: 'Title' },
        { value: 'slug', label: 'Slug' },
        { value: 'hostnames', label: 'Site (Hostname)' },
        { value: 'cached_path', label: 'Path' },
        { value: 'publication_status', label: 'Publication Status' },
        { value: 'is_currently_published', label: 'Is Published' },
    ],
    Tag: [
        { value: 'id', label: 'ID' },
        { value: 'name', label: 'Name' },
        { value: 'slug', label: 'Slug' },
    ],
    MediaFile: [
        { value: 'id', label: 'ID' },
        { value: 'name', label: 'Filename' },
        { value: 'mime_type', label: 'MIME Type' },
    ],
    ObjectTypeDefinition: [
        { value: 'id', label: 'ID' },
        { value: 'name', label: 'Name' },
        { value: 'is_active', label: 'Is Active' },
    ]
}

const LOOKUP_OPERATORS = [
    { value: 'exact', label: 'Equals (==)' },
    { value: 'icontains', label: 'Contains (Ignore Case)' },
    { value: 'regex', label: 'Regex Match' },
    { value: 'gt', label: 'Greater Than (>)' },
    { value: 'lt', label: 'Less Than (<)' },
    { value: 'gte', label: 'Greater/Equal (>=)' },
    { value: 'lte', label: 'Less/Equal (<=)' },
    { value: 'in', label: 'In (Comma Separated)' },
    { value: 'contains', label: 'Array Contains' },
    { value: 'isnull', label: 'Is Null' },
]

const StreamEditor = ({ stream, onSave, onCancel, connectionType, connectionId, errors = {} }) => {
    // Initial state setup
    const initialDsl = stream?.queryDsl || (connectionType === 'INTERNAL' ? '{\n  "model": "ObjectInstance",\n  "filters": {},\n  "limit": 10\n}' : '')
    
    // Parse DSL for initial UI state
    let initialModel = 'ObjectInstance'
    let initialVersion = 'latest'
    let initialFields = []
    
    if (connectionType === 'INTERNAL' && initialDsl) {
        try {
            const parsed = JSON.parse(initialDsl)
            initialModel = parsed.model || 'ObjectInstance'
            initialVersion = parsed.version || 'latest'
            initialFields = parsed.fields || []
        } catch(e) {}
    }

    const [formData, setFormData] = useState({
        name: stream?.name || '',
        queryDsl: initialDsl,
        outputType: stream?.outputType || 'JSON',
        cacheTtl: stream?.cacheTtl || 3600,
        workflow: stream?.workflow || [],
        config: stream?.config || {}
    })
    
    const [selectedModel, setSelectedModel] = useState(initialModel)
    const [selectedVersion, setSelectedModelVersion] = useState(initialVersion)
    const [selectedFields, setSelectedFields] = useState(initialFields)
    const [selectedFilters, setSelectedFilters] = useState([]) // Array of { field, operator, value }
    const [showAdvancedDsl, setShowAdvancedDsl] = useState(false)
    const [previewData, setPreviewData] = useState(null)
    const [isPreviewLoading, setIsPreviewLoading] = useState(false)

    // Parse filters from initial DSL if available
    useEffect(() => {
        if (connectionType === 'INTERNAL' && initialDsl) {
            try {
                const parsed = JSON.parse(initialDsl)
                if (parsed.filters && typeof parsed.filters === 'object') {
                    const filterList = Object.entries(parsed.filters).map(([key, val]) => {
                        let field = key
                        let operator = 'exact'
                        
                        // Parse Django-style lookups (e.g., field__icontains)
                        const parts = key.split('__')
                        if (parts.length > 1) {
                            field = parts[0]
                            operator = parts[1]
                        }
                        
                        return { field, operator, value: val }
                    })
                    setSelectedFilters(filterList)
                }
            } catch(e) {}
        }
    }, [initialDsl, connectionType])

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleAddFilter = () => {
        setSelectedFilters(prev => [...prev, { field: '', operator: 'exact', value: '' }])
    }

    const handleRemoveFilter = (index) => {
        setSelectedFilters(prev => prev.filter((_, i) => i !== index))
    }

    const handleFilterChange = (index, field, value) => {
        setSelectedFilters(prev => {
            const newList = [...prev]
            newList[index] = { ...newList[index], [field]: value }
            return newList
        })
    }

    const handlePreview = async () => {
        const id = connectionId || stream?.connection
        if (!id) {
            console.warn('Cannot preview without a connection ID')
            return
        }
        
        setIsPreviewLoading(true)
        setPreviewData(null)
        try {
            const response = await api.post(`/api/v1/data-connections/connections/${id}/preview_stream/`, formData)
            setPreviewData(response.data)
        } catch (error) {
            console.error('Preview failed:', error)
            setPreviewData({ error: 'Failed to retrieve preview data' })
        } finally {
            setIsPreviewLoading(false)
        }
    }

    // 1. Sync from UI states to queryDsl (only if NOT in advanced mode)
    useEffect(() => {
        if (connectionType === 'INTERNAL' && !showAdvancedDsl) {
            try {
                let currentDsl = {}
                try {
                    currentDsl = JSON.parse(formData.queryDsl || '{}')
                } catch (e) {
                    currentDsl = { limit: 10 }
                }

                // Construct Django-style filters from the UI list
                const filters = {}
                selectedFilters.forEach(f => {
                    if (f.field) {
                        const key = f.operator === 'exact' ? f.field : `${f.field}__${f.operator}`
                        filters[key] = f.value
                    }
                })

                const newDsl = {
                    ...currentDsl,
                    model: selectedModel,
                    version: selectedVersion,
                    fields: selectedFields,
                    filters: filters
                }
                
                const newDslString = JSON.stringify(newDsl, null, 2)
                if (formData.queryDsl !== newDslString) {
                    handleChange('queryDsl', newDslString)
                }
            } catch (e) {
                console.error('Error syncing UI to DSL:', e)
            }
        }
    }, [selectedModel, selectedVersion, selectedFields, selectedFilters, connectionType, showAdvancedDsl])

    // 2. Sync from queryDsl back to UI states (only if IN advanced mode)
    // This ensures simple UI stays updated as user types in DSL box
    useEffect(() => {
        if (connectionType === 'INTERNAL' && showAdvancedDsl && formData.queryDsl) {
            try {
                const parsed = JSON.parse(formData.queryDsl)
                
                if (parsed.model && parsed.model !== selectedModel) {
                    setSelectedModel(parsed.model)
                }
                
                // Only sync version for models that support it
                if (parsed.version && parsed.version !== selectedVersion && (parsed.model === 'ObjectInstance' || parsed.model === 'WebPage')) {
                    setSelectedModelVersion(parsed.version)
                } else if (!parsed.version && selectedVersion !== 'latest') {
                    // Default back to latest if version removed from DSL
                    setSelectedModelVersion('latest')
                }

                if (parsed.fields && JSON.stringify(parsed.fields) !== JSON.stringify(selectedFields)) {
                    setSelectedFields(parsed.fields)
                }
            } catch (e) {
                // Ignore invalid JSON while typing in advanced mode
            }
        }
    }, [formData.queryDsl, connectionType, showAdvancedDsl])

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Stream Name</label>
                    <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className={`mt-1 block w-full border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 shadow-sm focus:ring-blue-500 focus:border-blue-500`} 
                        placeholder="Latest News, User Profile, etc."
                    />
                    {errors.name && (
                        <p className="mt-1 text-xs text-red-500">{Array.isArray(errors.name) ? errors.name[0] : errors.name}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Output Type</label>
                    <select 
                        value={formData.outputType}
                        onChange={(e) => handleChange('outputType', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="JSON">Simple JSON</option>
                        <option value="OBJECT_TYPE">ObjectType Mapping</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Cache TTL (seconds)</label>
                    <input 
                        type="number" 
                        value={formData.cacheTtl}
                        onChange={(e) => handleChange('cacheTtl', parseInt(e.target.value))}
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                    />
                </div>
                {connectionType === 'INTERNAL' && (
                    <div className="flex items-end">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 w-full flex items-start space-x-3">
                            <Table className="w-5 h-5 text-blue-600 mt-0.5" />
                            <p className="text-xs text-blue-800">
                                <strong>Internal Query Mode:</strong> Configure your system data source below. You can select specific models, versions, and attributes.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {connectionType === 'INTERNAL' ? 'Source Configuration' : 'Endpoint Configuration'}
                    </h3>
                    {connectionType === 'INTERNAL' && (
                        <button 
                            onClick={() => setShowAdvancedDsl(!showAdvancedDsl)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            {showAdvancedDsl ? 'Show Simple View' : 'Show Advanced DSL'}
                        </button>
                    )}
                </div>

                {connectionType === 'INTERNAL' ? (
                    <div className="space-y-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
                        {!showAdvancedDsl ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ComboboxInput 
                                        label="Data Model"
                                        description="System model to retrieve data from"
                                        value={selectedModel}
                                        onChange={(val) => {
                                            setSelectedModel(val)
                                            setSelectedFields([]) // Reset fields when model changes
                                        }}
                                        options={[
                                            { value: 'ObjectInstance', label: 'Object Instances', description: 'Query generic system objects' },
                                            { value: 'WebPage', label: 'Web Pages', description: 'Retrieve page metadata and hierarchy' },
                                            { value: 'Tag', label: 'Tags', description: 'Query system-wide categorization tags' },
                                            { value: 'MediaFile', label: 'Media Files', description: 'Retrieve images and assets' },
                                            { value: 'ObjectTypeDefinition', label: 'Object Type Definitions', description: 'Query defined object schemas' },
                                        ]}
                                    />

                                    {(selectedModel === 'ObjectInstance' || selectedModel === 'WebPage') && (
                                        <SelectInput 
                                            label="Version Selection"
                                            description="Which version of the content to retrieve"
                                            value={selectedVersion}
                                            onChange={setSelectedModelVersion}
                                            options={[
                                                { value: 'latest', label: 'Latest (Includes Drafts)' },
                                                { value: 'published', label: 'Currently Published Only' },
                                            ]}
                                        />
                                    )}
                                </div>

                                <MultiSelectInput 
                                    label="Attributes / Fields"
                                    description="Select specific fields to include in the output (empty for all)"
                                    value={selectedFields}
                                    onChange={setSelectedFields}
                                    options={MODEL_FIELDS[selectedModel] || []}
                                    placeholder="All fields"
                                />

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm font-medium text-gray-700">Filter Conditions</label>
                                        <button 
                                            onClick={handleAddFilter}
                                            className="text-xs flex items-center text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            <Plus className="w-3 h-3 mr-1" />
                                            Add Filter
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedFilters.length === 0 ? (
                                            <p className="text-xs text-gray-500 italic bg-white p-3 rounded border border-dashed text-center">No filters applied. Retrieving all items.</p>
                                        ) : (
                                            selectedFilters.map((filter, index) => (
                                                <div key={index} className="flex items-center space-x-2 bg-white p-2 rounded border group">
                                                    <div className="flex-1 grid grid-cols-3 gap-2">
                                                        <select 
                                                            value={filter.field}
                                                            onChange={(e) => handleFilterChange(index, 'field', e.target.value)}
                                                            className="text-xs border-gray-300 rounded p-1"
                                                        >
                                                            <option value="">Select Field...</option>
                                                            {FILTERABLE_FIELDS[selectedModel]?.map(f => (
                                                                <option key={f.value} value={f.value}>{f.label}</option>
                                                            ))}
                                                        </select>
                                                        <select 
                                                            value={filter.operator}
                                                            onChange={(e) => handleFilterChange(index, 'operator', e.target.value)}
                                                            className="text-xs border-gray-300 rounded p-1"
                                                        >
                                                            {LOOKUP_OPERATORS.map(op => (
                                                                <option key={op.value} value={op.value}>{op.label}</option>
                                                            ))}
                                                        </select>
                                                        <input 
                                                            type="text"
                                                            value={filter.value}
                                                            onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
                                                            className="text-xs border-gray-300 rounded p-1"
                                                            placeholder="Value..."
                                                            disabled={filter.operator === 'isnull'}
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={() => handleRemoveFilter(index)}
                                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Query DSL (JSON)</label>
                                <textarea 
                                    rows={8}
                                    value={formData.queryDsl}
                                    onChange={(e) => handleChange('queryDsl', e.target.value)}
                                    className={`mt-1 block w-full border ${errors.queryDsl || errors.query_dsl ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 font-mono text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                />
                                {(errors.queryDsl || errors.query_dsl) && (
                                    <p className="mt-1 text-xs text-red-500">{Array.isArray(errors.queryDsl || errors.query_dsl) ? (errors.queryDsl || errors.query_dsl)[0] : (errors.queryDsl || errors.query_dsl)}</p>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint Path</label>
                        <textarea 
                            rows={4}
                            value={formData.queryDsl}
                            onChange={(e) => handleChange('queryDsl', e.target.value)}
                            className={`mt-1 block w-full border ${errors.queryDsl || errors.query_dsl ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 font-mono text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                            placeholder="/api/v1/resource"
                        />
                        {(errors.queryDsl || errors.query_dsl) && (
                            <p className="mt-1 text-xs text-red-500">{Array.isArray(errors.queryDsl || errors.query_dsl) ? (errors.queryDsl || errors.query_dsl)[0] : (errors.queryDsl || errors.query_dsl)}</p>
                        )}
                    </div>
                )}
            </div>

            <div className="pt-6 border-t">
                <WorkflowActionEditor 
                    workflow={formData.workflow} 
                    onChange={(newWorkflow) => handleChange('workflow', newWorkflow)} 
                />
            </div>

            {connectionType === 'EXTERNAL_REST' && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Paging Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500">Paging Type</label>
                            <select 
                                value={formData.config.paging?.type || 'none'}
                                onChange={(e) => handleConfigChange('paging', { ...formData.config.paging, type: e.target.value })}
                                className="mt-1 block w-full text-sm border-gray-300 rounded-md"
                            >
                                <option value="none">No Paging</option>
                                <option value="page">Page-based</option>
                                <option value="limit_offset">Limit/Offset</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500">Max Pages</label>
                            <input 
                                type="number"
                                value={formData.config.paging?.maxPages || 1}
                                onChange={(e) => handleConfigChange('paging', { ...formData.config.paging, maxPages: parseInt(e.target.value) })}
                                className="mt-1 block w-full text-sm border-gray-300 rounded-md"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Transformation Mapping</h4>
                    <div className="flex items-center space-x-2">
                        <label className="text-xs text-gray-500">Mode:</label>
                        <select 
                            value={formData.config.mode || 'simple'}
                            onChange={(e) => handleConfigChange('mode', e.target.value)}
                            className="text-xs border-gray-300 rounded-md"
                        >
                            <option value="simple">Simple Mapping</option>
                            <option value="object_type">ObjectType Slots</option>
                        </select>
                    </div>
                </div>

                {formData.config.mode === 'object_type' ? (
                    <div className="space-y-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-700 mb-2">Map data items to widgets within ObjectType slots.</p>
                        {/* Simplified slot mapping editor */}
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Target Slot</label>
                                <input 
                                    type="text"
                                    placeholder="e.g. main"
                                    className="mt-1 block w-full text-sm border-gray-300 rounded-md"
                                    onChange={(e) => {
                                        const slots = formData.config.slots || {};
                                        handleConfigChange('slots', { ...slots, [e.target.value]: slots[e.target.value] || { widget_type: 'html' } });
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-medium text-gray-700">Field Mappings (JSON)</label>
                        </div>
                        <textarea 
                            rows={4}
                            value={JSON.stringify(formData.config.mappings || {}, null, 2)}
                            onChange={(e) => {
                                try {
                                    handleConfigChange('mappings', JSON.parse(e.target.value))
                                } catch(err) {}
                            }}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 font-mono text-xs"
                            placeholder='{ "target": "source" }'
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <div className="flex items-center space-x-2">
                    <input 
                        type="checkbox"
                        checked={formData.config.parseHtml || false}
                        onChange={(e) => handleConfigChange('parseHtml', e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm text-gray-700">Parse HTML fields (extract images/links)</label>
                </div>
                <div className="flex items-center space-x-2">
                    <input 
                        type="checkbox"
                        checked={formData.config.validateFiles || false}
                        onChange={(e) => handleConfigChange('validateFiles', e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm text-gray-700">Validate file URLs</label>
                </div>
            </div>

            <div className="pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Preview Results</h3>
                    <button 
                        onClick={handlePreview}
                        disabled={isPreviewLoading}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {isPreviewLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Eye className="w-4 h-4" />
                        )}
                        <span>{previewData ? 'Refresh Preview' : 'Preview Result'}</span>
                    </button>
                </div>

                {previewData && (
                    <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-auto max-h-64 border border-gray-800">
                        {previewData.error ? (
                            <div className="text-red-400 flex items-center">
                                <AlertCircle className="w-4 h-4 mr-2" />
                                {previewData.error}
                            </div>
                        ) : Array.isArray(previewData) && previewData.length > 0 ? (
                            <div>
                                <div className="text-blue-400 mb-2 flex items-center">
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Showing first item of {previewData.length} results:
                                </div>
                                <pre className="text-gray-300">{JSON.stringify(previewData[0], null, 2)}</pre>
                            </div>
                        ) : Array.isArray(previewData) && previewData.length === 0 ? (
                            <div className="text-yellow-400">Query returned no results.</div>
                        ) : (
                            <pre className="text-gray-300">{JSON.stringify(previewData, null, 2)}</pre>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
                <button 
                    onClick={onCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button 
                    onClick={() => onSave(formData)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    <Save className="w-4 h-4" />
                    <span>Save Stream</span>
                </button>
            </div>
        </div>
    )
}

export default StreamEditor

