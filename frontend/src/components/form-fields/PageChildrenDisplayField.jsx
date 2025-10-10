import React from 'react'
import { Loader2, AlertCircle, FileText, ExternalLink } from 'lucide-react'
import { usePageChildren } from '../../hooks/usePageStructure'

/**
 * PageChildrenDisplayField Component
 * 
 * Displays a read-only list of child pages for the current page.
 * Used in navigation widgets to show what pages will be included dynamically.
 * 
 * Features:
 * - Fetches children using React Query hook
 * - Read-only display (no selection, no storage)
 * - Shows page title, slug, and published status
 * - Handles loading and error states
 * - Responsive to page context changes
 * 
 * Usage:
 * <PageChildrenDisplayField
 *   label="Child Pages"
 *   description="These pages will appear in the navigation"
 *   context={{ pageId: 123, webpageData, pageVersionData }}
 * />
 */
const PageChildrenDisplayField = ({
    label = "Child Pages",
    description,
    context = {},
    ...props
}) => {
    // Extract page ID from context
    const pageId = context?.pageId
    const webpageData = context?.webpageData

    // Use existing React Query hook for children
    const { data: children, isLoading, error } = usePageChildren(pageId)

    // Handle no page ID
    if (!pageId) {
        return (
            <div className="space-y-2">
                {label && (
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                    </label>
                )}
                {description && (
                    <p className="text-sm text-gray-500">{description}</p>
                )}
                <div className="text-sm text-gray-500 italic bg-gray-50 border border-gray-200 rounded-md p-4">
                    Not available in preview mode. Save the page first to see child pages.
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}

            {/* Description */}
            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {/* Children List */}
            <div className="border border-gray-200 rounded-md bg-gray-50">
                {isLoading ? (
                    <div className="flex items-center justify-center p-6">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin mr-2" />
                        <span className="text-sm text-gray-600">Loading child pages...</span>
                    </div>
                ) : error ? (
                    <div className="flex items-center text-red-600 p-4">
                        <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <div>
                            <div className="font-medium text-sm">Failed to load child pages</div>
                            <div className="text-xs text-red-500 mt-1">{error.message}</div>
                        </div>
                    </div>
                ) : children && children.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                        {children.map((child) => (
                            <div
                                key={child.page.id}
                                className="flex items-center justify-between p-3 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                            {child.page.title}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        {child.currentVersion.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 italic p-4 text-center">
                        This page has no child pages.
                        {webpageData?.title && (
                            <span className="block mt-1">
                                Add child pages to "{webpageData.title}" to see them here.
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Info footer */}
            {children && children.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                    {children.length} child {children.length === 1 ? 'page' : 'pages'} will be displayed in the navigation.
                </p>
            )}
        </div>
    )
}

PageChildrenDisplayField.displayName = 'PageChildrenDisplayField'

export default PageChildrenDisplayField

