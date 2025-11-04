import React, { forwardRef, useImperativeHandle, useState, useEffect, useCallback } from 'react'
import LayoutSelector from './LayoutSelector'
import PageTagWidget from './PageTagWidget'
import PathPatternSelector from './PathPatternSelector'
import PathPreviewInput from './PathPreviewInput'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../contexts/unified-data/types/operations'

type SettingsEditorProps = {
    componentId: string
    context: {
        pageId: string | number
        versionId: string | number
        contextType: string
    }
    isNewPage?: boolean
    // Path preview props
    simulatedPath?: string
    onSimulatedPathChange?: (path: string) => void
    pathVariables?: Record<string, any>
}

export type SettingsEditorHandle = {
    saveSettings: () => Promise<{ module: string; status: string; data: any; timestamp: string }>
}

// Settings & SEO Editor Tab - UDC-integrated with self-controlled fields
const SettingsEditor = forwardRef<SettingsEditorHandle, SettingsEditorProps>(({
    componentId,
    context,
    isNewPage,
    simulatedPath = '',
    onSimulatedPathChange,
    pathVariables = {}
}, ref) => {
    // UDC Integration
    const { getState, publishUpdate, useExternalChanges } = useUnifiedData()

    // Get initial data from UDC
    const state = getState()
    const webpageData: any = state.pages?.[context.pageId]
    const pageVersionData: any = state.versions?.[context.versionId]

    // Local state for immediate UI updates (self-controlled fields)
    const [localValues, setLocalValues] = useState({
        title: webpageData?.title || '',
        slug: webpageData?.slug || '',
        description: webpageData?.description || '',
        pathPatternKey: webpageData?.pathPatternKey || '',
        hostnames: webpageData?.hostnames || [],
        metaTitle: pageVersionData?.metaTitle || '',
        metaDescription: pageVersionData?.metaDescription || '',
        codeLayout: pageVersionData?.codeLayout || '',
        tags: pageVersionData?.tags || []
    })

    // Sync local state when UDC data changes externally
    useExternalChanges(componentId, (changes) => {
        const updatedState = getState()
        const updatedPageData: any = updatedState.pages?.[context.pageId]
        const updatedVersionData: any = updatedState.versions?.[context.versionId]

        if (updatedPageData || updatedVersionData) {
            setLocalValues(prev => ({
                ...prev,
                ...(updatedPageData && {
                    title: updatedPageData.title || prev.title,
                    slug: updatedPageData.slug || prev.slug,
                    description: updatedPageData.description || prev.description,
                    pathPatternKey: updatedPageData.pathPatternKey || prev.pathPatternKey,
                    hostnames: updatedPageData.hostnames || prev.hostnames,
                }),
                ...(updatedVersionData && {
                    metaTitle: updatedVersionData.metaTitle || prev.metaTitle,
                    metaDescription: updatedVersionData.metaDescription || prev.metaDescription,
                    codeLayout: updatedVersionData.codeLayout || prev.codeLayout,
                    tags: updatedVersionData.tags || prev.tags,
                })
            }))
        }
    })

    // Handle page field changes (WebPage model fields)
    const handlePageFieldChange = useCallback((field: string, value: any) => {
        // Update local state immediately
        setLocalValues(prev => ({ ...prev, [field]: value }))

        // Publish to UDC (DataManager will automatically set isDirty)
        publishUpdate(componentId, OperationTypes.UPDATE_WEBPAGE_DATA, {
            id: String(context.pageId),
            updates: { [field]: value }
        })
    }, [componentId, context.pageId, publishUpdate])

    // Handle version field changes (PageVersion model fields)
    const handleVersionFieldChange = useCallback((field: string, value: any) => {
        // Update local state immediately
        setLocalValues(prev => ({ ...prev, [field]: value }))

        // Publish to UDC (DataManager will automatically set isDirty)
        publishUpdate(componentId, OperationTypes.UPDATE_PAGE_VERSION_DATA, {
            id: String(context.versionId),
            updates: { [field]: value }
        })
    }, [componentId, context.versionId, publishUpdate])

    // Expose save method to parent
    useImperativeHandle(ref, () => ({
        saveSettings: async () => {
            // Settings are already saved in real-time via UDC
            // This method confirms the current state is saved
            return {
                module: 'settings',
                status: 'success',
                data: localValues,
                timestamp: new Date().toISOString()
            };
        }
    }), [localValues]);

    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Page Settings Section */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Page Settings</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title
                            </label>
                            <input
                                type="text"
                                value={localValues.title}
                                onChange={(e) => handlePageFieldChange('title', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Page Title"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                The main title of your page
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Short Title (optional)
                            </label>
                            <input
                                type="text"
                                value={localValues.metaTitle}
                                onChange={(e) => handleVersionFieldChange('metaTitle', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Shorter version for navigation menus"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                Brief title for navigation, breadcrumbs, or cards. Leave blank to use full title.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                URL Slug
                            </label>
                            <input
                                type="text"
                                value={localValues.slug}
                                onChange={(e) => handlePageFieldChange('slug', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="page-url-slug"
                            />
                            {(() => {
                                // Check if slug is an HTTP error code (400-599)
                                const slug = localValues.slug || '';
                                const isErrorCode = /^[45]\d{2}$/.test(slug);
                                if (isErrorCode) {
                                    const errorCode = parseInt(slug);
                                    const errorNames = {
                                        400: 'Bad Request',
                                        401: 'Unauthorized',
                                        403: 'Forbidden',
                                        404: 'Not Found',
                                        500: 'Internal Server Error',
                                        502: 'Bad Gateway',
                                        503: 'Service Unavailable',
                                        504: 'Gateway Timeout'
                                    };
                                    const errorName = errorNames[errorCode] || 'Error';
                                    return (
                                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                            <p className="text-sm text-blue-800">
                                                <strong>Error Page Detected:</strong> This slug ({slug}) will create a custom error page for HTTP {errorCode} ({errorName}) responses on this site.
                                            </p>
                                            <p className="text-xs text-blue-600 mt-1">
                                                Consider using an error layout (error_404, error_500, etc.) for the best user experience.
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        <div>
                            <PathPatternSelector
                                value={localValues.pathPatternKey}
                                onChange={(value) => handlePageFieldChange('pathPatternKey', value)}
                                pageId={String(context.pageId)}
                            />
                        </div>

                        {/* Path Preview - Show when a pattern is selected */}
                        {localValues.pathPatternKey && (
                            <div>
                                <PathPreviewInput
                                    pathPatternKey={localValues.pathPatternKey}
                                    value={simulatedPath}
                                    onChange={onSimulatedPathChange || (() => { })}
                                    disabled={isNewPage}
                                />
                            </div>
                        )}

                        {/* Page Layout Selection */}
                        <div>
                            <LayoutSelector
                                value={localValues.codeLayout}
                                onChange={(layout) => handleVersionFieldChange('codeLayout', layout)}
                                label="Page Layout"
                                description="Choose the layout template for this page"
                            />
                            {(() => {
                                // Suggest error layouts for error page slugs
                                const slug = localValues.slug || '';
                                const isErrorCode = /^[45]\d{2}$/.test(slug);
                                const currentLayout = localValues.codeLayout || '';
                                const suggestedLayout = `error_${slug}`;

                                // Show suggestion if it's an error page but not using an error layout
                                if (isErrorCode && !currentLayout.startsWith('error_')) {
                                    return (
                                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                                            <p className="text-xs text-yellow-800">
                                                <strong>Tip:</strong> Consider using the <code className="px-1 bg-yellow-100 rounded">{suggestedLayout}</code> layout for this error page.
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        {/* Page Tags */}
                        <div>
                            <PageTagWidget
                                tags={localValues.tags}
                                onChange={(tags) => handleVersionFieldChange('tags', tags)}
                                disabled={false}
                            />
                        </div>
                    </div>
                </div>

                {/* SEO & Metadata Section */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">SEO & Metadata</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Meta Description
                            </label>
                            <textarea
                                value={localValues.metaDescription}
                                onChange={(e) => handleVersionFieldChange('metaDescription', e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="SEO description for search engines"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Hostnames
                            </label>
                            <input
                                type="text"
                                value={localValues.hostnames.join(', ')}
                                onChange={(e) => handlePageFieldChange('hostnames',
                                    e.target.value.split(',').map(h => h.trim()).filter(h => h)
                                )}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="example.com, www.example.com"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                Enter hostnames separated by commas
                            </p>
                        </div>

                        {/* Site Icon - Only for root pages */}
                        {!webpageData?.parent && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Site Icon (Favicon)
                                </label>
                                <div className="space-y-3">
                                    {webpageData?.siteIcon && (
                                        <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                                            <img
                                                src={webpageData.siteIcon}
                                                alt="Site icon preview"
                                                className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">Current Icon</p>
                                                <p className="text-xs text-gray-500">Will be resized to multiple sizes automatically</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handlePageFieldChange('siteIcon', null)}
                                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                handlePageFieldChange('siteIcon', file)
                                            }
                                        }}
                                        className="block w-full text-sm text-gray-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-md file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-blue-50 file:text-blue-700
                                            hover:file:bg-blue-100
                                            cursor-pointer"
                                    />
                                    <p className="text-sm text-gray-500">
                                        Upload a square image (PNG, JPG, SVG, or WebP). Will be automatically resized to favicon sizes (16x16, 32x32, etc.) and app icons (180x180, 192x192, etc.)
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
});

// Add display name for debugging
SettingsEditor.displayName = 'SettingsEditor';
export default SettingsEditor
