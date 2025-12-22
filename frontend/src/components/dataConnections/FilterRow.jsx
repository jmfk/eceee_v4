import React from 'react'
import { Trash2 } from 'lucide-react'
import MultiSelectInput from '../form-fields/MultiSelectInput'

const ObjectTypeSelector = ({ value, onChange, options, isMulti }) => {
    const selectedValues = typeof value === 'string' ? value.split(',').map(v => v.trim()).filter(Boolean) : (Array.isArray(value) ? value : [])
    
    if (isMulti) {
        return (
            <MultiSelectInput
                value={selectedValues}
                onChange={(val) => onChange(val.join(','))}
                options={options}
                placeholder="Select types..."
                className="text-xs"
            />
        )
    }

    return (
        <select 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 px-2"
        >
            <option value="">Select Type...</option>
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    )
}

const SiteSelector = ({ value, onChange, options, isMulti }) => {
    const selectedValues = typeof value === 'string' ? value.split(',').map(v => v.trim()).filter(Boolean) : (Array.isArray(value) ? value : [])

    if (isMulti) {
        return (
            <MultiSelectInput
                value={selectedValues}
                onChange={(val) => onChange(val.join(','))}
                options={options}
                placeholder="Select sites..."
                className="text-xs"
            />
        )
    }

    return (
        <select 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 px-2"
        >
            <option value="">Select Site...</option>
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    )
}

const TextFilterInput = ({ value, onChange, placeholder }) => (
    <input 
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 px-2"
        placeholder={placeholder}
    />
)

const FilterValueInput = ({ filter, onValueChange, objectTypeOptions, siteOptions }) => {
    if (filter.operator === 'isnull') return null

    const isObjectTypeField = filter.field === 'object_type' || filter.field === 'object_type__name'
    const isSiteField = filter.field === 'hostnames'
    const isMulti = ['in', 'overlap', 'contains'].includes(filter.operator)

    if (isObjectTypeField) {
        const options = objectTypeOptions.map(opt => ({
            value: filter.field === 'object_type' ? opt.value : opt.name,
            label: opt.label
        }))
        return <ObjectTypeSelector value={filter.value} onChange={onValueChange} options={options} isMulti={isMulti} />
    }

    if (isSiteField) {
        return <SiteSelector value={filter.value} onChange={onValueChange} options={siteOptions} isMulti={isMulti} />
    }

    return (
        <TextFilterInput 
            value={filter.value} 
            onChange={onValueChange} 
            placeholder={filter.operator === 'regex' ? 'Regex pattern...' : 'Value...'} 
        />
    )
}

const FilterRow = ({ filter, index, onFieldChange, onOperatorChange, onValueChange, onRemove, fieldOptions, lookupOperators, objectTypeOptions, siteOptions, isCore = false }) => {
    return (
        <div className={`flex items-start space-x-3 bg-white p-3 rounded-lg border shadow-sm group animate-in fade-in slide-in-from-top-1 ${isCore ? 'border-blue-200 bg-blue-50/10' : 'border-gray-200'}`}>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-400">Field</label>
                    <select 
                        value={filter.field}
                        onChange={(e) => onFieldChange?.(e.target.value)}
                        disabled={isCore}
                        className={`w-full text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 px-2 ${isCore ? 'bg-gray-50 text-gray-500' : ''}`}
                    >
                        {isCore ? null : <option value="">Select Field...</option>}
                        {fieldOptions?.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-400">Operator</label>
                    <select 
                        value={filter.operator}
                        onChange={(e) => onOperatorChange?.(e.target.value)}
                        disabled={isCore}
                        className={`w-full text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 px-2 ${isCore ? 'bg-gray-50 text-gray-500' : ''}`}
                    >
                        {lookupOperators.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-400">Value</label>
                    <FilterValueInput 
                        filter={filter} 
                        onValueChange={onValueChange}
                        objectTypeOptions={objectTypeOptions}
                        siteOptions={siteOptions}
                    />
                </div>
            </div>
            {!isCore && (
                <button 
                    onClick={onRemove}
                    className="mt-5 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                    title="Remove condition"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}

export default FilterRow

