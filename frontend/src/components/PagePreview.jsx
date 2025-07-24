import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Eye,
    EyeOff,
    Monitor,
    Smartphone,
    Tablet,
    RefreshCw,
    Settings,
    ExternalLink,
    AlertCircle
} from 'lucide-react'
import { api } from '../api/client'
import LayoutRenderer from './LayoutRenderer'

const PagePreview = ({
    pageId = null,
    layoutId = null,
    themeId = null,
    className = '',
    showControls = true
}) => {
    const [previewSize, setPreviewSize] = useState('desktop')
    const [showInheritance, setShowInheritance] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Fetch preview data
    const { data: previewData, isLoading: isLoadingPreview, refetch } = useQuery({
        queryKey: ['page-preview', pageId, layoutId, themeId],
        queryFn: async () => {
            if (!pageId) return null

            const params = new URLSearchParams()
            if (layoutId) params.append('layout_id', layoutId)
            if (themeId) params.append('theme_id', themeId)

            const response = await axios.get(`/api/v1/webpages/pages/${pageId}/preview/?${params}`)
            return response.data
        },
        enabled: !!pageId
    })

    // Fetch sample pages for preview selection
    const { data: samplePagesResponse } = useQuery({
        queryKey: ['sample-pages'],
        queryFn: async () => {
            const response = await api.get('/api/v1/webpages/pages/?limit=10')
            return response.data
        },
        enabled: !pageId
    })

    // Extract sample pages array from paginated response
    const samplePages = samplePagesResponse?.results || []

    const previewSizes = {
        mobile: { width: '375px', height: '667px', label: 'Mobile' },
        tablet: { width: '768px', height: '1024px', label: 'Tablet' },
        desktop: { width: '100%', height: '600px', label: 'Desktop' }
    }

    const renderPreviewContent = () => {
        if (!previewData) {
            return (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                        <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Select a page to preview</p>
                    </div>
                </div>
            )
        }

        const { page, effective_layout, effective_theme, widgets_by_slot } = previewData

        return (
            <LayoutRenderer
                layout={effective_layout}
                theme={effective_theme}
                widgetsBySlot={widgets_by_slot}
                showInheritance={showInheritance}
                mode="preview"
                pageTitle={page.title}
                pageDescription={page.description}
                className="h-full"
            >
                {/* Theme Information */}
                {effective_theme && (
                    <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                            Active Theme: {effective_theme.name}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(effective_theme.css_variables || {}).slice(0, 10).map(([key, value]) => (
                                <div key={key} className="flex items-center space-x-2 text-xs">
                                    <code className="bg-white px-2 py-1 rounded border">--{key}</code>
                                    <span className="text-gray-600">{value}</span>
                                    {value.startsWith('#') && (
                                        <div
                                            className="w-4 h-4 rounded border border-gray-300"
                                            style={{ backgroundColor: value }}
                                        />
                                    )}
                                </div>
                            ))}
                            {Object.keys(effective_theme.css_variables || {}).length > 10 && (
                                <span className="text-xs text-gray-500">
                                    +{Object.keys(effective_theme.css_variables).length - 10} more
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </LayoutRenderer>
        )
    }

    return (
        <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
            {/* Preview Controls */}
            {showControls && (
                <div className="border-b border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            {/* Size Controls */}
                            <div className="flex items-center space-x-2">
                                {Object.entries(previewSizes).map(([size, config]) => (
                                    <button
                                        key={size}
                                        onClick={() => setPreviewSize(size)}
                                        className={`p-2 rounded ${previewSize === size
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                        title={config.label}
                                    >
                                        {size === 'mobile' && <Smartphone className="w-4 h-4" />}
                                        {size === 'tablet' && <Tablet className="w-4 h-4" />}
                                        {size === 'desktop' && <Monitor className="w-4 h-4" />}
                                    </button>
                                ))}
                            </div>

                            {/* Inheritance Toggle */}
                            <button
                                onClick={() => setShowInheritance(!showInheritance)}
                                className={`inline-flex items-center px-3 py-1 rounded text-sm ${showInheritance
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                    }`}
                            >
                                {showInheritance ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                                Inheritance Info
                            </button>
                        </div>

                        <div className="flex items-center space-x-2">
                            {/* Refresh */}
                            <button
                                onClick={() => refetch()}
                                disabled={isLoadingPreview}
                                className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                                title="Refresh preview"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Open in new tab */}
                            {previewData?.page?.slug && (
                                <button
                                    onClick={() => window.open(`/${previewData.page.slug}/`, '_blank')}
                                    className="p-2 text-gray-500 hover:text-gray-700"
                                    title="Open live page"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Frame */}
            <div className="bg-gray-100 p-4">
                <div
                    className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
                    style={{
                        width: previewSizes[previewSize].width,
                        height: previewSizes[previewSize].height,
                        maxWidth: '100%'
                    }}
                >
                    {isLoadingPreview ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                                <p className="text-gray-500">Loading preview...</p>
                            </div>
                        </div>
                    ) : (
                        renderPreviewContent()
                    )}
                </div>
            </div>

            {/* Status Bar */}
            {showControls && (
                <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                            {previewData
                                ? `Previewing: ${previewData.page.title}`
                                : 'No page selected'
                            }
                        </span>
                        <span>
                            {previewSizes[previewSize].width} × {previewSizes[previewSize].height}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}



export default PagePreview 