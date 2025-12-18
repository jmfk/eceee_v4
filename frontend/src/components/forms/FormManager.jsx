import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
    Plus, 
    Search, 
    Edit3, 
    Trash2, 
    FileText, 
    ChevronRight,
    Play,
    Settings as Cog,
    CheckCircle2,
    XCircle,
    Clock
} from 'lucide-react'
import { api } from '../../api/client'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { useNotificationContext } from '../NotificationManager'
import FormBuilder from './FormBuilder'

const FormManager = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [editingForm, setEditingForm] = useState(null)
    const [isCreating, setIsCreating] = useState(false)
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()
    const { showConfirm } = useNotificationContext()

    const { data: formsResponse, isLoading } = useQuery({
        queryKey: ['forms'],
        queryFn: async () => {
            const response = await api.get('/api/v1/forms/forms/')
            return response.data
        }
    })

    const forms = formsResponse?.results || []

    const deleteFormMutation = useMutation({
        mutationFn: async (formName) => {
            await api.delete(`/api/v1/forms/forms/${formName}/`)
        },
        onSuccess: () => {
            addNotification('Form deleted successfully', 'success')
            queryClient.invalidateQueries(['forms'])
        },
        onError: (error) => {
            addNotification('Failed to delete form', 'error')
        }
    })

    const handleDelete = async (form) => {
        const confirmed = await showConfirm({
            title: 'Delete Form',
            message: `Are you sure you want to delete "${form.label}"? This will also delete all its submissions.`,
            confirmText: 'Delete',
            confirmButtonStyle: 'danger'
        })

        if (confirmed) {
            deleteFormMutation.mutate(form.name)
        }
    }

    const filteredForms = forms.filter(form => 
        form.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        form.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (isCreating || editingForm) {
        return (
            <FormBuilder 
                form={editingForm} 
                onClose={() => {
                    setEditingForm(null)
                    setIsCreating(false)
                }} 
            />
        )
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Forms</h2>
                    <p className="text-gray-500">Manage dynamic forms and submissions</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Form
                </button>
            </div>

            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Search forms..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredForms.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900">No forms found</h3>
                    <p className="text-gray-500 mt-1">Get started by creating your first form</p>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="mt-4 text-blue-600 font-medium hover:text-blue-700"
                    >
                        Create Form
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredForms.map((form) => (
                        <div key={form.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-5 border-b border-gray-100">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mr-3">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{form.label}</h4>
                                            <p className="text-xs text-gray-500 font-mono">{form.name}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-full ${form.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {form.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                {form.description && (
                                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">{form.description}</p>
                                )}
                            </div>
                            <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center text-xs text-gray-500">
                                    <Clock className="w-3 h-3 mr-1" />
                                    v{form.version} • {form.fields?.length || 0} fields
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button 
                                        onClick={() => setEditingForm(form)}
                                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        title="Edit Form"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(form)}
                                        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        title="Delete Form"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default FormManager

