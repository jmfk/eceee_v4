import React, { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

const DynamicFormRenderer = ({ formName, fields: initialFields = [], onSuccess }) => {
    const [formData, setFormData] = useState({})
    const [errors, setErrors] = useState({})
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [fields, setFields] = useState(initialFields)
    const [conditionalLogic, setConditionalLogic] = useState({ rules: [] })
    const [dataSourceOptions, setDataSourceOptions] = useState({})

    // Fetch form definition if fields are not provided
    const { data: formDef, isLoading: formLoading } = useQuery({
        queryKey: ['form-definition', formName],
        queryFn: async () => {
            const response = await api.get(`/api/v1/forms/forms/${formName}/`)
            return response.data
        },
        enabled: !!formName && (!initialFields || initialFields.length === 0)
    })

    useEffect(() => {
        if (formDef) {
            if (formDef.fields) setFields(formDef.fields)
            if (formDef.conditionalLogic) setConditionalLogic(formDef.conditionalLogic)
        }
    }, [formDef])
    
    // Update fields if initialFields changes (e.g. from editor)
    useEffect(() => {
        if (initialFields && initialFields.length > 0) {
            setFields(initialFields)
        }
    }, [initialFields])

    // Fetch data source options
    useEffect(() => {
        const fetchDataSourceOptions = async () => {
            const newOptions = { ...dataSourceOptions }
            let changed = false

            for (const field of fields) {
                if (field.dataSourceType === 'valueList' && field.valueListId && !newOptions[field.name]) {
                    try {
                        const response = await api.get(`/api/v1/utils/value-lists/${field.valueListId}/`)
                        newOptions[field.name] = (response.data.items || []).map(item => item.label || item.value)
                        changed = true
                    } catch (e) {
                        console.error(`Error fetching value list ${field.valueListId}:`, e)
                    }
                } else if (field.dataSourceType === 'objectStorage' && field.objectType && !newOptions[field.name]) {
                    try {
                        const response = await api.get(`/api/v1/objects/instances/?type=${field.objectType}`)
                        newOptions[field.name] = (response.data.results || []).map(obj => obj.title)
                        changed = true
                    } catch (e) {
                        console.error(`Error fetching object types ${field.objectType}:`, e)
                    }
                }
            }

            if (changed) {
                setDataSourceOptions(newOptions)
            }
        }

        if (fields.length > 0) {
            fetchDataSourceOptions()
        }
    }, [fields])

    // Conditional logic evaluation
    const evaluateCondition = (condition, data) => {
        const { field, operator, value } = condition
        const actualValue = data[field]
        
        switch (operator) {
            case '==': return String(actualValue) === String(value)
            case '!=': return String(actualValue) !== String(value)
            case '>': return Number(actualValue) > Number(value)
            case '<': return Number(actualValue) < Number(value)
            case 'contains': return String(actualValue || '').includes(String(value))
            default: return false
        }
    }

    const evaluateRule = (rule, data) => {
        const { if: conditionGroup } = rule
        const results = conditionGroup.conditions.map(c => evaluateCondition(c, data))
        
        if (conditionGroup.type === 'or') {
            return results.some(r => r)
        }
        return results.every(r => r)
    }

    const visibleFields = fields.filter(field => {
        // Find rules that target this field
        const rules = (conditionalLogic?.rules || []).filter(r => r.then?.field === field.name)
        
        if (rules.length === 0) return true
        
        // If any rule says "show" and evaluates to true, OR if any rule says "hide" and evaluates to false
        // For simplicity: default visible, hide if any "hide" rule is true, or hide if any "show" rule exists but none are true
        
        const showRules = rules.filter(r => r.then.action === 'show')
        const hideRules = rules.filter(r => r.then.action === 'hide')
        
        if (hideRules.some(r => evaluateRule(r, formData))) return false
        if (showRules.length > 0 && !showRules.some(r => evaluateRule(r, formData))) return false
        
        return true
    })

    const submissionMutation = useMutation({
        mutationFn: async (data) => {
            const response = await api.post('/api/v1/forms/submissions/', {
                form_name: formName,
                data: data
            })
            return response.data
        },
        onSuccess: (data) => {
            setIsSubmitted(true)
            if (onSuccess) onSuccess(data)
        },
        onError: (error) => {
            if (error.response?.data?.errors) {
                setErrors(error.response.data.errors)
            } else {
                setErrors({ _global: 'An unexpected error occurred. Please try again.' })
            }
        }
    })

    const handleChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }))
        // Clear error when field changes
        if (errors[name]) {
            const newErrors = { ...errors }
            delete newErrors[name]
            setErrors(newErrors)
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        setErrors({})
        submissionMutation.mutate(formData)
    }

    if (formLoading && (!fields || fields.length === 0)) {
        return (
            <div className="animate-pulse space-y-4 p-4">
                <div className="h-8 bg-gray-100 rounded w-1/3"></div>
                <div className="h-10 bg-gray-100 rounded"></div>
                <div className="h-10 bg-gray-100 rounded"></div>
                <div className="h-32 bg-gray-100 rounded"></div>
            </div>
        )
    }

    if (isSubmitted) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-900 mb-2">Thank you!</h3>
                <p className="text-green-700">Your submission has been received successfully.</p>
                <button 
                    onClick={() => { setIsSubmitted(false); setFormData({}); }}
                    className="mt-6 text-green-600 font-medium hover:underline"
                >
                    Submit another response
                </button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {errors._global && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {errors._global}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {visibleFields.map((field) => {
                    const error = errors[field.name]
                    
                    return (
                        <div key={field.id} className="form-group">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {field.label}
                                {field.validation?.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            
                            {field.type === 'textarea' ? (
                                <textarea
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                                        error ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    rows={field.ui?.rows || 4}
                                    value={formData[field.name] || ''}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    placeholder={field.ui?.placeholder}
                                />
                            ) : field.type === 'select' ? (
                                <select
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                                        error ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    value={formData[field.name] || ''}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                >
                                    <option value="">Select an option...</option>
                                    {(dataSourceOptions[field.name] || field.options || []).map((opt, idx) => (
                                        <option key={idx} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                                        error ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    value={formData[field.name] || ''}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    placeholder={field.ui?.placeholder}
                                />
                            )}
                            
                            {error && (
                                <p className="mt-1 text-sm text-red-600">{error}</p>
                            )}
                            
                            {field.description && (
                                <p className="mt-1 text-xs text-gray-500">{field.description}</p>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="pt-4">
                <button
                    type="submit"
                    disabled={submissionMutation.isPending}
                    className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                    {submissionMutation.isPending && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                    Submit
                </button>
            </div>
        </form>
    )
}

export default DynamicFormRenderer
