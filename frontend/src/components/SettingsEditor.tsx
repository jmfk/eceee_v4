import React, { forwardRef, useImperativeHandle, useState, useEffect, useCallback } from 'react'
import LayoutSelector from './LayoutSelector'
import PageTagWidget from './PageTagWidget'
import PathPatternSelector from './PathPatternSelector'
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
}

export type SettingsEditorHandle = {
    saveSettings: () => Promise<{ module: string; status: string; data: any; timestamp: string }>
}

// Settings & SEO Editor Tab - UDC-integrated with self-controlled fields
const SettingsEditor = forwardRef<SettingsEditorHandle, SettingsEditorProps>(({ componentId, context, isNewPage }, ref) => {
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
        pathPatternKey: webpageData?.pathPatternKey || webpageData?.path_pattern_key || webpageData?.path_pattern || '',
        hostnames: webpageData?.hostnames || [],
        metaTitle: pageVersionData?.metaTitle || pageVersionData?.meta_title || '',
        metaDescription: pageVersionData?.metaDescription || pageVersionData?.meta_description || '',
        codeLayout: pageVersionData?.codeLayout || pageVersionData?.code_layout || '',
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
                    pathPatternKey: updatedPageData.pathPatternKey || updatedPageData.path_pattern_key || updatedPageData.path_pattern || prev.pathPatternKey,
                    hostnames: updatedPageData.hostnames || prev.hostnames,
                }),
                ...(updatedVersionData && {
                    metaTitle: updatedVersionData.metaTitle || updatedVersionData.meta_title || prev.metaTitle,
                    metaDescription: updatedVersionData.metaDescription || updatedVersionData.meta_description || prev.metaDescription,
                    codeLayout: updatedVersionData.codeLayout || updatedVersionData.code_layout || prev.codeLayout,
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
                        </div>

                        <div>
                            <PathPatternSelector
                                value={localValues.pathPatternKey}
                                onChange={(value) => handlePageFieldChange('pathPatternKey', value)}
                                pageId={context.pageId}
                            />
                        </div>

                        {/* Page Layout Selection */}
                        <div>
                            <LayoutSelector
                                value={localValues.codeLayout}
                                onChange={(layout) => handleVersionFieldChange('codeLayout', layout)}
                                label="Page Layout"
                                description="Choose the layout template for this page"
                            />
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
                    </div>
                </div>
            </div>
        </div>
    )
});

// Add display name for debugging
SettingsEditor.displayName = 'SettingsEditor';
export default SettingsEditor
