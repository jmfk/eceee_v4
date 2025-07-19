import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Grid3X3,
    Monitor,
    Eye,
    Settings,
    Code,
    RefreshCw,
    CheckCircle,
    Info,
    ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { layoutsApi, layoutUtils } from '../api/layouts'

const LayoutEditor = () => {
    const [selectedLayout, setSelectedLayout] = useState(null)
    const [showPreview, setShowPreview] = useState(false)
    const queryClient = useQueryClient()

    // Fetch code layouts
    const { data: layoutsData, isLoading } = useQuery({
        queryKey: ['layouts', 'code'],
        queryFn: () => layoutsApi.codeLayouts.list()
    })

    // Reload code layouts mutation
    const reloadMutation = useMutation({
        mutationFn: () => layoutsApi.codeLayouts.reload(),
        onSuccess: (data) => {
            toast.success('Code layouts reloaded successfully')
            queryClient.invalidateQueries(['layouts'])
        },
        onError: () => {
            toast.error('Failed to reload code layouts')
        }
    })

    // Validate layouts mutation
    const validateMutation = useMutation({
        mutationFn: () => layoutsApi.codeLayouts.validate(),
        onSuccess: () => {
            toast.success('All layouts are valid')
        },
        onError: (error) => {
            toast.error('Layout validation failed')
        }
    })

    // Get code layouts
    const layouts = (layoutsData?.results || []).map(layout => ({
        ...layout,
        id: layout.name,
        type: 'code'
    })).map(layoutUtils.formatLayoutForDisplay)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Code Layout Management</h2>
                    <p className="text-gray-600 mt-1">
                        View and manage code-based layout templates
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => validateMutation.mutate()}
                        disabled={validateMutation.isPending}
                        className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Validate
                    </button>
                    <button
                        onClick={() => reloadMutation.mutate()}
                        disabled={reloadMutation.isPending}
                        className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${reloadMutation.isPending ? 'animate-spin' : ''}`} />
                        Reload
                    </button>
                </div>
            </div>

            {/* Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <Code className="w-5 h-5 text-blue-600 mr-2" />
                        <div>
                            <p className="text-sm font-medium text-blue-900">Available Layouts</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {layoutsData?.summary?.active_layouts || layouts.length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <Settings className="w-5 h-5 text-green-600 mr-2" />
                        <div>
                            <p className="text-sm font-medium text-green-900">Status</p>
                            <p className="text-sm font-medium text-green-600">
                                Code-based layouts only
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Layout listing header */}
            <div className="border-b border-gray-200 pb-2">
                <h3 className="text-lg font-medium text-gray-900">Available Code Layouts</h3>
                <p className="text-sm text-gray-600">Code-based layout templates defined in your application</p>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Layouts List */}
                <div className="lg:col-span-1">
                    <LayoutsList
                        layouts={layouts}
                        selectedLayout={selectedLayout}
                        onSelectLayout={setSelectedLayout}
                        isLoading={isLoading}
                    />
                </div>

                {/* Layout Detail Panel */}
                <div className="lg:col-span-2">
                    {selectedLayout ? (
                        <LayoutDetailPanel
                            layout={selectedLayout}
                            onCancel={() => setSelectedLayout(null)}
                            showPreview={showPreview}
                            onTogglePreview={() => setShowPreview(!showPreview)}
                        />
                    ) : (
                        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                            <Grid3X3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Select a Layout to View Details
                            </h3>
                            <p className="text-gray-500">
                                Choose a code layout from the list to view its configuration
                            </p>
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-start space-x-3">
                                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div className="text-left">
                                        <h4 className="text-sm font-medium text-blue-900 mb-1">
                                            Code-Based Layouts
                                        </h4>
                                        <p className="text-sm text-blue-700">
                                            📝 <strong>Code layouts</strong> are defined in application code and provide better version control, IDE support, and easier distribution.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Layouts List Component
const LayoutsList = ({ layouts, selectedLayout, onSelectLayout, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Available Layouts</h3>
                </div>
                <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading layouts...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Available Layouts</h3>
                <p className="text-sm text-gray-500 mt-1">{layouts.length} layouts found</p>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {layouts?.map((layout) => (
                    <div
                        key={layout.id}
                        onClick={() => onSelectLayout(layout)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedLayout?.id === layout.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <h4 className="font-medium text-gray-900">{layout.name}</h4>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${layout.type === 'code'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-amber-100 text-amber-800'
                                        }`}>
                                        {layout.type === 'code' ? (
                                            <>
                                                <Code className="w-3 h-3 mr-1" />
                                                Code
                                            </>
                                        ) : (
                                            <>
                                                <Database className="w-3 h-3 mr-1" />
                                                Database
                                            </>
                                        )}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                    {layout.slot_configuration?.slots?.length || 0} slots
                                </p>
                                {layout.description && (
                                    <p className="text-sm text-gray-600 mt-1">{layout.description}</p>
                                )}
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                    </div>
                ))}
                {layouts.length === 0 && (
                    <div className="p-8 text-center">
                        <Grid3X3 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No layouts found</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// Layout Detail Panel Component (code layouts are read-only)
const LayoutDetailPanel = ({ layout, onCancel, showPreview, onTogglePreview }) => {

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center space-x-3">
                            <h3 className="text-xl font-semibold text-gray-900">{layout.name}</h3>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                <Code className="w-4 h-4 mr-1" />
                                Code Layout
                            </span>
                        </div>
                        {layout.description && (
                            <p className="text-gray-600 mt-1">{layout.description}</p>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={onTogglePreview}
                            className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            <Eye className="w-4 h-4 mr-2" />
                            {showPreview ? 'Hide' : 'Show'} Preview
                        </button>
                        {/* Code layouts are read-only - no edit/delete functionality */}
                        <button
                            onClick={onCancel}
                            className="inline-flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                        <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-medium text-blue-900 mb-1">
                                Code-Based Layout
                            </h4>
                            <p className="text-sm text-blue-700">
                                This layout is defined in application code and cannot be edited through this interface.
                                To modify it, update the layout class in your codebase.
                            </p>
                        </div>
                    </div>
                </div>

                <LayoutDetails layout={layout} showPreview={showPreview} />
            </div>
        </div>
    )
}

// LayoutForm removed - code layouts cannot be created/edited through UI

// Layout Details Component
const LayoutDetails = ({ layout, showPreview }) => {
    return (
        <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Template</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {layout.template_name || 'webpages/page_detail.html'}
                    </p>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">CSS Classes</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {layout.css_classes || 'None'}
                    </p>
                </div>
            </div>

            {/* Slots */}
            <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Slots Configuration</h4>
                <div className="space-y-3">
                    {layout.slot_configuration?.slots?.map((slot, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-gray-900">{slot.name}</h5>
                                <span className="text-xs text-gray-500">
                                    {slot.max_widgets ? `Max: ${slot.max_widgets}` : 'Unlimited'}
                                </span>
                            </div>
                            {slot.title && (
                                <p className="text-sm text-gray-700 mb-1">
                                    <strong>Title:</strong> {slot.title}
                                </p>
                            )}
                            {slot.description && (
                                <p className="text-sm text-gray-600 mb-1">{slot.description}</p>
                            )}
                            {slot.css_classes && (
                                <p className="text-xs text-gray-500">
                                    CSS: <code className="bg-gray-100 px-1 rounded">{slot.css_classes}</code>
                                </p>
                            )}
                        </div>
                    )) || (
                            <p className="text-gray-500 text-center py-4">No slots configured</p>
                        )}
                </div>
            </div>

            {/* Preview */}
            {showPreview && (
                <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Layout Preview</h4>
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                        <div className="text-center text-gray-500">
                            <Monitor className="w-8 h-8 mx-auto mb-2" />
                            <p>Layout preview visualization would be implemented here</p>
                            <p className="text-sm mt-1">
                                This could show a visual representation of the slot arrangement
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default LayoutEditor 