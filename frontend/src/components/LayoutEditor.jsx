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
    ArrowRight,
    X,
    Database,
    EyeOff,
    Palette,
    Smartphone,
    Tablet,
    Desktop
} from 'lucide-react'
import toast from 'react-hot-toast'
import { layoutsApi, layoutUtils } from '../api/layouts'
import LayoutRenderer from './LayoutRenderer'
import TemplateLayoutRenderer from './TemplateLayoutRenderer'
import EnhancedLayoutRenderer from './EnhancedLayoutRenderer'

const LayoutEditor = () => {
    const [selectedLayout, setSelectedLayout] = useState(null)
    const [showPreview, setShowPreview] = useState(false)
    const [previewMode, setPreviewMode] = useState('desktop') // desktop, tablet, mobile
    const [layoutType, setLayoutType] = useState('all') // all, code, template
    const [showSampleWidgets, setShowSampleWidgets] = useState(true)
    const queryClient = useQueryClient()

    // Fetch code layouts
    const { data: codeLayoutsData, isLoading: isLoadingCode } = useQuery({
        queryKey: ['layouts', 'code'],
        queryFn: () => layoutsApi.codeLayouts.list()
    })

    // Fetch template layouts
    const { data: templateLayoutsData, isLoading: isLoadingTemplate } = useQuery({
        queryKey: ['layouts', 'template'],
        queryFn: () => layoutsApi.templateLayouts.list(),
        enabled: layoutType === 'all' || layoutType === 'template'
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

    // Combine and format layouts
    const getAllLayouts = () => {
        const layouts = []

        // Add code layouts
        if (codeLayoutsData?.results) {
            const codeLayouts = codeLayoutsData.results.map(layout => ({
                ...layout,
                id: layout.name,
                type: 'code'
            })).map(layoutUtils.formatLayoutForDisplay)
            layouts.push(...codeLayouts)
        }

        // Add template layouts
        if (templateLayoutsData?.results) {
            const templateLayouts = templateLayoutsData.results.map(layout => ({
                ...layout,
                id: layout.name,
                type: 'template'
            })).map(layoutUtils.formatLayoutForDisplay)
            layouts.push(...templateLayouts)
        }

        // Filter by type
        if (layoutType === 'code') {
            return layouts.filter(l => l.type === 'code')
        } else if (layoutType === 'template') {
            return layouts.filter(l => l.type === 'template')
        }

        return layouts
    }

    const layouts = getAllLayouts()
    const isLoading = isLoadingCode || (isLoadingTemplate && (layoutType === 'all' || layoutType === 'template'))

    // Preview size configurations
    const previewSizes = {
        mobile: { width: '375px', height: '667px', label: 'Mobile', icon: Smartphone },
        tablet: { width: '768px', height: '1024px', label: 'Tablet', icon: Tablet },
        desktop: { width: '100%', height: '600px', label: 'Desktop', icon: Desktop }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Layout Management</h2>
                    <p className="text-gray-600 mt-1">
                        View and manage both code-based and template-based layout templates
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
                                {layouts.length}
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
                                {layoutType === 'all' ? 'All Layouts' : layoutType === 'code' ? 'Code-based Layouts' : 'Template-based Layouts'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Layout listing header */}
            <div className="border-b border-gray-200 pb-2">
                <h3 className="text-lg font-medium text-gray-900">Available Layouts</h3>
                <p className="text-sm text-gray-600">
                    {layoutType === 'all' ? 'All defined layouts' : layoutType === 'code' ? 'Code-based layout templates' : 'Template-based layout templates'}
                </p>
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
                        layoutType={layoutType}
                        setLayoutType={setLayoutType}
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
                            previewMode={previewMode}
                            setPreviewMode={setPreviewMode}
                            showSampleWidgets={showSampleWidgets}
                            setShowSampleWidgets={setShowSampleWidgets}
                        />
                    ) : (
                        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                            <Grid3X3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Select a Layout to View Details
                            </h3>
                            <p className="text-gray-500">
                                Choose a layout from the list to view its configuration
                            </p>
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-start space-x-3">
                                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div className="text-left">
                                        <h4 className="text-sm font-medium text-blue-900 mb-1">
                                            Layout Types
                                        </h4>
                                        <p className="text-sm text-blue-700">
                                            📝 <strong>Code layouts</strong> are defined in application code and provide better version control, IDE support, and easier distribution.
                                            <br />
                                            🎨 <strong>Template layouts</strong> are pre-defined HTML/CSS/JS files that can be used directly.
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
const LayoutsList = ({ layouts, selectedLayout, onSelectLayout, isLoading, layoutType, setLayoutType }) => {
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

                {/* Layout Type Filter */}
                <div className="mt-3">
                    <div className="flex space-x-2">
                        {[
                            { value: 'all', label: 'All', icon: Grid3X3 },
                            { value: 'code', label: 'Code', icon: Code },
                            { value: 'template', label: 'Template', icon: Palette }
                        ].map(({ value, label, icon: IconComponent }) => (
                            <button
                                key={value}
                                onClick={() => setLayoutType(value)}
                                className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${layoutType === value
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <IconComponent className="w-3 h-3 mr-1" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
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
                                                <Palette className="w-3 h-3 mr-1" />
                                                Template
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
                        {layoutType !== 'all' && (
                            <button
                                onClick={() => setLayoutType('all')}
                                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                            >
                                Show all layouts
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// Layout Detail Panel Component (code layouts are read-only)
const LayoutDetailPanel = ({ layout, onCancel, showPreview, onTogglePreview, previewMode, setPreviewMode, showSampleWidgets, setShowSampleWidgets }) => {

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center space-x-3">
                            <h3 className="text-xl font-semibold text-gray-900">{layout.name}</h3>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                {layout.type === 'code' ? (
                                    <>
                                        <Code className="w-4 h-4 mr-1" />
                                        Code Layout
                                    </>
                                ) : (
                                    <>
                                        <Palette className="w-4 h-4 mr-1" />
                                        Template Layout
                                    </>
                                )}
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
                                Layout Details
                            </h4>
                            <p className="text-sm text-blue-700">
                                This layout is defined in application code and cannot be edited through this interface.
                                To modify it, update the layout class in your codebase.
                            </p>
                        </div>
                    </div>
                </div>

                <LayoutDetails layout={layout} showPreview={showPreview} previewMode={previewMode} setPreviewMode={setPreviewMode} showSampleWidgets={showSampleWidgets} setShowSampleWidgets={setShowSampleWidgets} />
            </div>
        </div>
    )
}

// LayoutForm removed - code layouts cannot be created/edited through UI

// Layout Details Component
const LayoutDetails = ({ layout, showPreview, previewMode, setPreviewMode, showSampleWidgets, setShowSampleWidgets }) => {
    // Preview size configurations for this component
    const previewSizes = {
        mobile: { width: '375px', height: '667px', label: 'Mobile', icon: Smartphone },
        tablet: { width: '768px', height: '1024px', label: 'Tablet', icon: Tablet },
        desktop: { width: '100%', height: '600px', label: 'Desktop', icon: Desktop }
    }

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
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-gray-900">Layout Preview</h4>
                        <div className="flex items-center space-x-4">
                            {/* Preview Size Controls */}
                            <div className="flex items-center space-x-2">
                                {Object.entries(previewSizes).map(([key, config]) => {
                                    const IconComponent = config.icon
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setPreviewMode(key)}
                                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${previewMode === key
                                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            title={`Preview in ${config.label} size`}
                                        >
                                            <IconComponent className="w-3 h-3 mr-1" />
                                            {config.label}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Sample Widgets Toggle */}
                            <button
                                onClick={() => setShowSampleWidgets(!showSampleWidgets)}
                                className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${showSampleWidgets
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <Palette className="w-3 h-3 mr-1" />
                                Sample Widgets
                            </button>
                        </div>
                    </div>

                    <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                        <div
                            className="preview-container bg-white mx-auto transition-all duration-300"
                            style={{
                                width: previewSizes[previewMode].width,
                                height: previewSizes[previewMode].height,
                                maxWidth: '100%'
                            }}
                        >
                            <LayoutPreviewRenderer
                                layout={layout}
                                showSampleWidgets={showSampleWidgets}
                                previewMode={previewMode}
                            />
                        </div>
                    </div>

                    {/* Preview Information */}
                    <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                        <span>
                            Preview size: {previewSizes[previewMode].width} × {previewSizes[previewMode].height}
                        </span>
                        <span>
                            {layout.type === 'template' ? 'Template-based rendering' : 'Code-based rendering'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

// Layout Preview Renderer Component
const LayoutPreviewRenderer = ({ layout, showSampleWidgets, previewMode }) => {
    // Generate sample widgets for preview
    const generateSampleWidgets = () => {
        if (!showSampleWidgets || !layout.slot_configuration?.slots) {
            return {}
        }

        const widgetsBySlot = {}

        layout.slot_configuration.slots.forEach((slot, index) => {
            const maxWidgets = slot.max_widgets || 2
            const widgetCount = Math.min(maxWidgets, 2) // Show max 2 widgets per slot in preview

            widgetsBySlot[slot.name] = []

            for (let i = 0; i < widgetCount; i++) {
                widgetsBySlot[slot.name].push({
                    widget: {
                        id: `sample-${slot.name}-${i}`,
                        widget_type: { name: getSampleWidgetType(slot, i) },
                        configuration: getSampleWidgetConfig(slot, i),
                        is_visible: true
                    },
                    inherited_from: null,
                    is_override: false
                })
            }
        })

        return widgetsBySlot
    }

    const getSampleWidgetType = (slot, index) => {
        const types = ['TextBlock', 'Header', 'Image', 'Button']
        return types[index % types.length]
    }

    const getSampleWidgetConfig = (slot, index) => {
        const configs = {
            'TextBlock': {
                content: `Sample ${slot.title || slot.name} content. This is placeholder text to demonstrate how widgets would appear in this layout slot.`,
                alignment: 'left'
            },
            'Header': {
                title: `${slot.title || slot.name} Header`,
                level: 'h2'
            },
            'Image': {
                src: 'https://via.placeholder.com/400x200/e2e8f0/475569?text=Sample+Image',
                alt: 'Sample image for layout preview'
            },
            'Button': {
                text: `${slot.title || slot.name} Action`,
                style: 'primary'
            }
        }

        const type = getSampleWidgetType(slot, index)
        return configs[type] || configs['TextBlock']
    }

    const sampleWidgetsBySlot = generateSampleWidgets()

    // Generate sample theme for preview
    const sampleTheme = {
        name: 'Preview Theme',
        css_variables: {
            'primary-color': '#3b82f6',
            'secondary-color': '#64748b',
            'background-color': '#ffffff',
            'text-color': '#1f2937'
        },
        custom_css: ''
    }

    const renderLayoutContent = () => {
        // Handle template-based layouts
        if (layout.type === 'template' && layout.template_based) {
            return (
                <TemplateLayoutRenderer
                    layout={layout}
                    theme={sampleTheme}
                    widgetsBySlot={sampleWidgetsBySlot}
                    mode="preview"
                    showInheritance={false}
                    pageTitle="Layout Preview"
                    pageDescription="This is a preview of how the layout will look"
                    className="h-full overflow-auto"
                />
            )
        }

        // Handle code-based layouts
        return (
            <LayoutRenderer
                layout={layout}
                theme={sampleTheme}
                widgetsBySlot={sampleWidgetsBySlot}
                mode="preview"
                showInheritance={false}
                pageTitle="Layout Preview"
                pageDescription="This is a preview of how the layout will look"
                className="h-full overflow-auto"
                showSlotHeaders={true}
                showEmptySlots={true}
            />
        )
    }

    if (!layout) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                    <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No layout selected</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full relative">
            {/* Responsive scaling for mobile/tablet views */}
            <div
                className={`h-full overflow-auto ${previewMode !== 'desktop' ? 'transform-gpu' : ''
                    }`}
                style={{
                    fontSize: previewMode === 'mobile' ? '14px' : previewMode === 'tablet' ? '15px' : '16px'
                }}
            >
                {renderLayoutContent()}
            </div>

            {/* Preview overlay indicator */}
            <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                {layout.type === 'template' ? 'Template' : 'Code'} Preview
            </div>
        </div>
    )
}

export default LayoutEditor 