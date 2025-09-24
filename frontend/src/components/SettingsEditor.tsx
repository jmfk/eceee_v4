import React, { forwardRef, useImperativeHandle } from 'react'
import LayoutSelector from './LayoutSelector'
import PageTagWidget from './PageTagWidget'

type SettingsEditorProps = {
    webpageData?: any
    pageVersionData?: any
    onUpdate: (update: any) => void
    isNewPage?: boolean
}

export type SettingsEditorHandle = {
    saveSettings: () => Promise<{ module: string; status: string; data: any; timestamp: string }>
}

// Settings & SEO Editor Tab (merged from SettingsEditor and MetadataEditor)
const SettingsEditor = forwardRef<SettingsEditorHandle, SettingsEditorProps>(({ webpageData, pageVersionData, onUpdate, isNewPage }, ref) => {
    // Expose save method to parent
    useImperativeHandle(ref, () => ({
        saveSettings: async () => {
            // Settings are already saved in real-time via onUpdate
            // This method confirms the current state is saved
            const currentSettings = {
                // WebPage fields
                title: webpageData?.title || '',
                slug: webpageData?.slug || '',
                description: webpageData?.description || '',
                parent: webpageData?.parent,
                parentId: webpageData?.parentId,
                sortOrder: webpageData?.sortOrder,
                hostnames: webpageData?.hostnames || [],
                enableCssInjection: webpageData?.enableCssInjection || false,
                pageCssVariables: webpageData?.pageCssVariables || {},
                pageCustomCss: webpageData?.pageCustomCss || '',
                // SEO & Metadata fields (now stored in pageVersionData)
                metaTitle: pageVersionData?.metaTitle || webpageData?.title || '',
                metaDescription: pageVersionData?.metaDescription || '',
                // PageVersion field (codeLayout affects version content)
                codeLayout: pageVersionData?.codeLayout || '',
                // Tags (stored in pageVersionData)
                tags: pageVersionData?.tags || []
            };

            return {
                module: 'settings',
                status: 'success',
                data: currentSettings,
                timestamp: new Date().toISOString()
            };
        }
    }), [webpageData, pageVersionData]);

    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Page Settings Section */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Page Settings</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                URL Slug
                            </label>
                            <input
                                type="text"
                                value={webpageData?.slug || ''}
                                onChange={(e) => onUpdate({ slug: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="page-url-slug"
                            />
                        </div>

                        {/* Page Layout Selection */}
                        <div>
                            <LayoutSelector
                                value={pageVersionData?.codeLayout || ''}
                                onChange={(layout) => onUpdate({ codeLayout: layout })}
                                label="Page Layout"
                                description="Choose the layout template for this page"
                            />
                        </div>

                        {/* Page Tags */}
                        <div>
                            <PageTagWidget
                                tags={pageVersionData?.tags || []}
                                onChange={(tags) => onUpdate({ tags })}
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
                                Meta Title
                            </label>
                            <input
                                type="text"
                                value={pageVersionData?.metaTitle || webpageData?.title || ''}
                                onChange={(e) => onUpdate({ metaTitle: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="SEO title for search engines"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Meta Description
                            </label>
                            <textarea
                                value={pageVersionData?.metaDescription || ''}
                                onChange={(e) => onUpdate({ metaDescription: e.target.value })}
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
                                value={webpageData?.hostnames?.join(', ') || ''}
                                onChange={(e) => onUpdate({
                                    hostnames: e.target.value.split(',').map(h => h.trim()).filter(h => h)
                                })}
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
