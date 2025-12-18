import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { FileText, Loader2 } from 'lucide-react'

const FormSelector = ({ value, onChange, label, helpText, error }) => {
    const { data: formsResponse, isLoading } = useQuery({
        queryKey: ['forms-list'],
        queryFn: async () => {
            const response = await api.get('/api/v1/forms/forms/')
            return response.data
        }
    })

    const forms = formsResponse?.results || []

    return (
        <div className="form-field">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
            )}
            
            <div className="relative">
                {isLoading ? (
                    <div className="flex items-center px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading forms...
                    </div>
                ) : (
                    <select
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none bg-white ${
                            error ? 'border-red-500' : 'border-gray-300'
                        }`}
                    >
                        <option value="">Select a form...</option>
                        {forms.map((form) => (
                            <option key={form.id} value={form.name}>
                                {form.label} ({form.name})
                            </option>
                        ))}
                    </select>
                )}
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <FileText className="w-4 h-4" />
                </div>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                </div>
            </div>
            
            {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    )
}

export default FormSelector

