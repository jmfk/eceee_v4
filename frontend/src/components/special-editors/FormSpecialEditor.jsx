import React, { useState } from 'react'
import { FileText, Eye, AlertCircle, Settings as Cog, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import DynamicFormRenderer from '../forms/DynamicFormRenderer'

/**
 * FormSpecialEditor - specialized editor for the Dynamic Form widget
 * 
 * Allows selecting a form from the library and provides a live preview
 * of the selected form's fields and conditional logic.
 */
const FormSpecialEditor = ({ widgetData, onChange }) => {
    const config = widgetData.config || {}
    const [previewMode, setPreviewMode] = useState(false)

    // Fetch all available forms for selection
    const { data: formsResponse, isLoading: formsLoading } = useQuery({
        queryKey: ['forms-list-special-editor'],
        queryFn: async () => {
            const response = await api.get('/api/v1/forms/forms/')
            return response.data
        }
    })

    const forms = formsResponse?.results || []
    const selectedForm = forms.find(f => f.name === config.formName)

    const handleFormChange = (formName) => {
        onChange({
            ...config,
            formName
        })
    }

    const toggleSetting = (key) => {
        onChange({
            ...config,
            [key]: !config[key]
        })
    }

    return (
        <div className="flex h-full bg-white overflow-hidden">
            {/* Left Column: Form Selection & Settings */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col h-full">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center uppercase tracking-wider">
                        <FileText className="w-4 h-4 mr-2 text-blue-600" />
                        Form Configuration
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Form Selector */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Select Form</label>
                        {formsLoading ? (
                            <div className="h-10 bg-gray-100 animate-pulse rounded-lg"></div>
                        ) : (
                            <div className="space-y-2">
                                {forms.map(form => (
                                    <button
                                        key={form.id}
                                        onClick={() => handleFormChange(form.name)}
                                        className={`w-full text-left p-3 rounded-lg border-2 transition-all group ${
                                            config.formName === form.name 
                                                ? 'border-blue-500 bg-blue-50 shadow-sm' 
                                                : 'border-gray-100 hover:border-gray-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="font-semibold text-sm text-gray-900">{form.label}</div>
                                            <ChevronRight className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 ${config.formName === form.name ? 'text-blue-500' : ''}`} />
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 font-mono truncate">{form.name}</div>
                                    </button>
                                ))}
                                {forms.length === 0 && (
                                    <div className="p-4 bg-yellow-50 text-yellow-700 text-xs rounded-lg border border-yellow-100 italic">
                                        No forms found in library. Create one in Settings -> Forms first.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Display Settings */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Display Options</label>
                        
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Show Form Title</span>
                            <button 
                                onClick={() => toggleSetting('showTitle')}
                                className={`w-10 h-5 rounded-full transition-colors relative ${config.showTitle !== false ? 'bg-blue-600' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.showTitle !== false ? 'right-1' : 'left-1'}`}></div>
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Show Description</span>
                            <button 
                                onClick={() => toggleSetting('showDescription')}
                                className={`w-10 h-5 rounded-full transition-colors relative ${config.showDescription !== false ? 'bg-blue-600' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.showDescription !== false ? 'right-1' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Live Preview */}
            <div className="flex-1 bg-gray-50 flex flex-col h-full relative">
                <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                    <div className="flex items-center">
                        <Eye className="w-4 h-4 mr-2 text-gray-400" />
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Live Preview</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => setPreviewMode(false)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${!previewMode ? 'bg-gray-200 text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            Static
                        </button>
                        <button 
                            onClick={() => setPreviewMode(true)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${previewMode ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            Interactive
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 flex justify-center">
                    <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-gray-200 p-8 h-fit min-h-[300px]">
                        {!config.formName ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-gray-400">
                                <FileText className="w-12 h-12 mb-4 opacity-20" />
                                <p className="text-sm italic">Select a form from the left to preview</p>
                            </div>
                        ) : selectedForm ? (
                            <div className="space-y-6">
                                <div>
                                    {config.showTitle !== false && <h2 className="text-2xl font-bold text-gray-900">{selectedForm.label}</h2>}
                                    {config.showDescription !== false && selectedForm.description && <p className="text-gray-600 mt-2 text-sm">{selectedForm.description}</p>}
                                </div>

                                {previewMode ? (
                                    <div className="border-t border-gray-100 pt-6">
                                        <DynamicFormRenderer formName={config.formName} fields={selectedForm.fields} />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {selectedForm.fields?.map((field, idx) => (
                                            <div key={idx} className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">{field.label} {field.validation?.required && '*'}</span>
                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{field.type}</span>
                                                </div>
                                                <div className="h-9 w-full bg-gray-50 border border-gray-200 rounded-md"></div>
                                            </div>
                                        ))}
                                        <div className="h-10 w-24 bg-blue-600/20 rounded-md mt-6"></div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-red-400">
                                <AlertCircle className="w-12 h-12 mb-4" />
                                <p className="text-sm">Error: Selected form not found in library</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FormSpecialEditor

