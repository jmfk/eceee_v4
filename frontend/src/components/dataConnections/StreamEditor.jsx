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
import FilterRow from './FilterRow'
import TextInput from '../form-fields/TextInput'
import TextareaInput from '../form-fields/TextareaInput'
import ComboboxInput from '../form-fields/ComboboxInput'
import MultiSelectInput from '../form-fields/MultiSelectInput'
import SelectInput from '../form-fields/SelectInput'
import CheckboxInput from '../form-fields/CheckboxInput'
import NumberInput from '../form-fields/NumberInput'

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
    const [selectedObjectTypes, setSelectedObjectTypes] = useState([]) // Dedicted state for relation
    const [selectedSites, setSelectedSites] = useState([]) // Dedicated state for sites
    const [showAdvancedDsl, setShowAdvancedDsl] = useState(false)
    const [previewData, setPreviewData] = useState(null)
    const [isPreviewLoading, setIsPreviewLoading] = useState(false)
    const [objectTypeOptions, setObjectTypeOptions] = useState([])
    const [siteOptions, setSiteOptions] = useState([])

    // Fetch Object Types and Sites for filters
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch separately so one failing doesn't block the other
                api.get('/api/v1/objects/object-types/active/')
                    .then(res => setObjectTypeOptions(res.data.map(t => ({ value: t.id.toString(), label: t.label, name: t.name }))))
                    .catch(err => console.error('Failed to fetch object types:', err))

                api.get('/api/v1/webpages/pages/hostnames/')
                    .then(res => setSiteOptions(res.data.map(s => ({ value: s, label: s }))))
                    .catch(err => console.error('Failed to fetch sites:', err))
            } catch (err) {
                console.error('Failed to initiate metadata fetch:', err)
            }
        }
        if (connectionType === 'INTERNAL') {
            fetchData()
        }
    }, [connectionType])

    // Parse filters from initial DSL if available
    useEffect(() => {
        if (connectionType === 'INTERNAL' && initialDsl) {
            try {
                const parsed = JSON.parse(initialDsl)
                if (parsed.filters && typeof parsed.filters === 'object') {
                    const filterList = []
                    const otIds = []
                    const sites = []

                    Object.entries(parsed.filters).forEach(([key, val]) => {
                        // Extract dedicated relational filters
                        if (key === 'object_type__id__in' || key === 'object_type__in') {
                            const ids = Array.isArray(val) ? val.map(v => v.toString()) : (typeof val === 'string' ? val.split(',') : [val.toString()])
                            otIds.push(...ids)
                            return
                        }
                        if (key === 'hostnames__overlap' || key === 'hostnames__contains' || key === 'hostnames') {
                            const s = Array.isArray(val) ? val : (typeof val === 'string' ? val.split(',') : [val])
                            sites.push(...s)
                            return
                        }

                        let field = key
                        let operator = 'exact'
                        
                        // Parse Django-style lookups (e.g., field__icontains)
                        const parts = key.split('__')
                        if (parts.length > 1) {
                            field = parts[0]
                            operator = parts[1]
                        }
                        
                        filterList.push({ field, operator, value: val })
                    })
                    setSelectedFilters(filterList)
                    setSelectedObjectTypes(otIds)
                    setSelectedSites(sites)
                }
            } catch(e) {}
        }
    }, [initialDsl, connectionType])

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleConfigChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            config: {
                ...prev.config,
                [field]: value
            }
        }))
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
            // If field changes, reset operator and value if needed
            if (field === 'field') {
                newList[index].operator = 'exact'
                newList[index].value = ''
            }
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
                
                // Add dedicated relational filters
                if (selectedModel === 'ObjectInstance' && selectedObjectTypes.length > 0) {
                    filters['object_type__in'] = selectedObjectTypes.join(',')
                }
                if (selectedModel === 'WebPage' && selectedSites.length > 0) {
                    filters['hostnames__overlap'] = selectedSites.join(',')
                }

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
    }, [selectedModel, selectedVersion, selectedFields, selectedFilters, selectedObjectTypes, selectedSites, connectionType, showAdvancedDsl])

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
                <TextInput 
                    label="Stream Name"
                    value={formData.name}
                    onChange={(val) => handleChange('name', val)}
                    placeholder="Latest News, User Profile, etc."
                    validation={errors.name ? { isValid: false, errors: Array.isArray(errors.name) ? errors.name : [errors.name] } : null}
                />
                <SelectInput 
                    label="Output Type"
                    value={formData.outputType}
                    onChange={(val) => handleChange('outputType', val)}
                    options={[
                        { value: 'JSON', label: 'Simple JSON' },
                        { value: 'OBJECT_TYPE', label: 'ObjectType Mapping' },
                    ]}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput 
                    label="Cache TTL (seconds)"
                    type="number"
                    value={formData.cacheTtl}
                    onChange={(val) => handleChange('cacheTtl', parseInt(val))}
                />
                {connectionType === 'INTERNAL' && (
                    <div className="flex items-end">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 w-full flex items-start space-x-3">
                            <Table className="w-5 h-5 text-blue-600 mt-0.5" />
                            <p className="text-xs text-blue-800 leading-relaxed">
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

                <div className="mb-6">
                    <MultiSelectInput 
                        label="Attributes / Fields"
                        description={connectionType === 'INTERNAL' 
                            ? "Select specific fields to retrieve from the model (leave empty for all)" 
                            : "Select specific fields to include in the output"}
                        value={selectedFields}
                        onChange={setSelectedFields}
                        options={connectionType === 'INTERNAL' ? (MODEL_FIELDS[selectedModel] || []) : []}
                        placeholder={connectionType === 'INTERNAL' ? "All Fields" : "Enter field names..."}
                        searchable={connectionType === 'INTERNAL'}
                        allowCreate={connectionType !== 'INTERNAL'} // Allow typing custom field names for REST
                    />
                </div>

                {connectionType === 'INTERNAL' ? (
                    <div className="space-y-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
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

                            {(selectedModel === 'ObjectInstance' || selectedModel === 'WebPage') ? (
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
                            ) : (
                                <div className="hidden md:block" /> // Spacer
                            )}
                        </div>

                        {!showAdvancedDsl ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">Filter Conditions</label>
                                        <p className="text-[10px] text-gray-500">Apply granular field-level conditions</p>
                                    </div>
                                    <button 
                                        onClick={handleAddFilter}
                                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Add Condition
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {/* Core Relational Filter - Object Types (always present for ObjectInstance) */}
                                    {selectedModel === 'ObjectInstance' && (
                                        <FilterRow 
                                            filter={{ field: 'object_type', operator: 'in', value: selectedObjectTypes.join(',') }}
                                            isCore={true}
                                            fieldOptions={[{ value: 'object_type', label: 'Object Types' }]}
                                            lookupOperators={[{ value: 'in', label: 'Includes' }]}
                                            objectTypeOptions={objectTypeOptions}
                                            siteOptions={siteOptions}
                                            onValueChange={(val) => setSelectedObjectTypes(val.split(',').filter(Boolean))}
                                            onRemove={() => setSelectedObjectTypes([])}
                                        />
                                    )}

                                    {/* Core Relational Filter - Sites (always present for WebPage) */}
                                    {selectedModel === 'WebPage' && (
                                        <FilterRow 
                                            filter={{ field: 'hostnames', operator: 'overlap', value: selectedSites.join(',') }}
                                            isCore={true}
                                            fieldOptions={[{ value: 'hostnames', label: 'Sites' }]}
                                            lookupOperators={[{ value: 'overlap', label: 'Includes' }]}
                                            objectTypeOptions={objectTypeOptions}
                                            siteOptions={siteOptions}
                                            onValueChange={(val) => setSelectedSites(val.split(',').filter(Boolean))}
                                            onRemove={() => setSelectedSites([])}
                                        />
                                    )}

                                    {selectedFilters.length === 0 && !selectedObjectTypes.length && !selectedSites.length ? (
                                        <div className="flex flex-col items-center justify-center py-6 px-4 bg-white border border-dashed border-gray-300 rounded-lg">
                                            <AlertCircle className="w-5 h-5 text-gray-300 mb-1" />
                                            <p className="text-xs text-gray-400">No filters defined. Retrieving all items.</p>
                                        </div>
                                    ) : (
                                        selectedFilters.map((filter, index) => (
                                            <FilterRow 
                                                key={index}
                                                filter={filter}
                                                index={index}
                                                fieldOptions={FILTERABLE_FIELDS[selectedModel]}
                                                lookupOperators={LOOKUP_OPERATORS}
                                                objectTypeOptions={objectTypeOptions}
                                                siteOptions={siteOptions}
                                                onFieldChange={(val) => handleFilterChange(index, 'field', val)}
                                                onOperatorChange={(val) => handleFilterChange(index, 'operator', val)}
                                                onValueChange={(val) => handleFilterChange(index, 'value', val)}
                                                onRemove={() => handleRemoveFilter(index)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <TextareaInput 
                                    label="Query DSL (JSON)"
                                    rows={8}
                                    value={formData.queryDsl}
                                    onChange={(val) => handleChange('queryDsl', val)}
                                    className="font-mono text-sm"
                                    validation={(errors.queryDsl || errors.query_dsl) ? { 
                                        isValid: false, 
                                        errors: Array.isArray(errors.queryDsl || errors.query_dsl) ? (errors.queryDsl || errors.query_dsl) : [errors.queryDsl || errors.query_dsl] 
                                    } : null}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <TextareaInput 
                            label="Endpoint Path"
                            description="Relative to connection base URL"
                            rows={4}
                            value={formData.queryDsl}
                            onChange={(val) => handleChange('queryDsl', val)}
                            className="font-mono text-sm"
                            placeholder="/api/v1/resource"
                            validation={(errors.queryDsl || errors.query_dsl) ? { 
                                isValid: false, 
                                errors: Array.isArray(errors.queryDsl || errors.query_dsl) ? (errors.queryDsl || errors.query_dsl) : [errors.queryDsl || errors.query_dsl] 
                            } : null}
                        />
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
                        <SelectInput 
                            label="Paging Type"
                            value={formData.config.paging?.type || 'none'}
                            onChange={(val) => handleConfigChange('paging', { ...formData.config.paging, type: val })}
                            options={[
                                { value: 'none', label: 'No Paging' },
                                { value: 'page', label: 'Page-based' },
                                { value: 'limit_offset', label: 'Limit/Offset' },
                            ]}
                        />
                        <NumberInput 
                            label="Max Pages"
                            value={formData.config.paging?.maxPages || 1}
                            onChange={(val) => handleConfigChange('paging', { ...formData.config.paging, maxPages: val })}
                            min={1}
                            max={100}
                        />
                    </div>
                </div>
            )}

            <div className="pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Transformation Mapping</h4>
                    <div className="flex items-center space-x-2">
                        <SelectInput 
                            value={formData.config.mode || 'simple'}
                            onChange={(val) => handleConfigChange('mode', val)}
                            options={[
                                { value: 'simple', label: 'Simple Mapping' },
                                { value: 'object_type', label: 'ObjectType Slots' },
                            ]}
                            className="!space-y-0" // Remove standard spacing for inline look
                        />
                    </div>
                </div>

                {formData.config.mode === 'object_type' ? (
                    <div className="space-y-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-700 mb-2">Map data items to widgets within ObjectType slots.</p>
                        <div className="grid grid-cols-1 gap-4">
                            <TextInput 
                                label="Target Slot"
                                placeholder="e.g. main"
                                onChange={(val) => {
                                    const slots = formData.config.slots || {};
                                    handleConfigChange('slots', { ...slots, [val]: slots[val] || { widget_type: 'html' } });
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <TextareaInput 
                            label="Field Mappings (JSON)"
                            rows={4}
                            value={JSON.stringify(formData.config.mappings || {}, null, 2)}
                            onChange={(val) => {
                                try {
                                    handleConfigChange('mappings', JSON.parse(val))
                                } catch(err) {}
                            }}
                            className="font-mono text-xs"
                            placeholder='{ "target": "source" }'
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <CheckboxInput 
                    label="Parse HTML fields"
                    description="Extract images and links from HTML fields"
                    value={formData.config.parseHtml || false}
                    onChange={(val) => handleConfigChange('parseHtml', val)}
                />
                <CheckboxInput 
                    label="Validate file URLs"
                    description="Check if extracted file URLs are reachable"
                    value={formData.config.validateFiles || false}
                    onChange={(val) => handleConfigChange('validateFiles', val)}
                />
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

