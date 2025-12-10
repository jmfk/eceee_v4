import React, { useMemo } from 'react'
import { Loader2, AlertCircle, Hash, ExternalLink } from 'lucide-react'

/**
 * PageSectionsDisplayField Component
 * 
 * Displays a read-only list of widgets with anchor attributes from a selected slot.
 * Used in navigation widgets to show what sections will be included dynamically.
 * 
 * Features:
 * - Reads widgets from pageVersionData context
 * - Filters widgets by anchor attribute (non-empty)
 * - Read-only display (no selection, no storage)
 * - Shows widget type, anchor value
 * - Responsive to slot and form data changes
 * 
 * Usage:
 * <PageSectionsDisplayField
 *   label="Page Sections"
 *   description="Widgets with anchors will appear as sections"
 *   context={{ pageId, webpageData, pageVersionData }}
 *   formData={{ slotName: "main" }}
 * />
 */
const PageSectionsDisplayField = ({
    label = "Page Sections",
    description,
    context = {},
    formData = {},
    ...props
}) => {
    // Extract data from context
    const pageId = context?.pageId
    const pageVersionData = context?.pageVersionData
    const webpageData = context?.webpageData

    // Get selected slot from form data (defaults to "main")
    const selectedSlot = formData?.slotName || formData?.slot_name || "main"

    // Get widgets from the selected slot and filter by anchor
    const sectionsWithAnchors = useMemo(() => {
        if (!pageVersionData?.widgets) return []

        const slotWidgets = pageVersionData.widgets[selectedSlot] || []

        // Filter widgets that have anchor set (non-empty)
        return slotWidgets.filter(widget => {
            const anchor = widget.config?.anchor
            return anchor && typeof anchor === 'string' && anchor.trim() !== ''
        })
    }, [pageVersionData, selectedSlot])

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
                    <div className="text-sm text-gray-500">{description}</div>
                )}
                <div className="text-sm text-gray-500 italic bg-gray-50 border border-gray-200 rounded-md p-4">
                    Not available in preview mode. Save the page first to see sections.
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
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Sections List */}
            <div className="border border-gray-200 rounded-md bg-gray-50">
                {sectionsWithAnchors && sectionsWithAnchors.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                        {sectionsWithAnchors.map((widget) => (
                            <div
                                key={widget.id}
                                className="flex items-center justify-between p-3 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                            {widget.config.anchor}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {widget.type?.split('.').pop() || widget.type} widget
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        Section
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 italic p-4 text-center">
                        No sections found in the "{selectedSlot}" slot.
                        {webpageData?.title && (
                            <span className="block mt-1">
                                Add widgets with anchors to the "{selectedSlot}" slot to create navigation sections.
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Info footer */}
            {sectionsWithAnchors && sectionsWithAnchors.length > 0 && (
                <div className="text-xs text-gray-500 mt-2">
                    {sectionsWithAnchors.length} section{sectionsWithAnchors.length === 1 ? '' : 's'} from "{selectedSlot}" slot will be displayed in the navigation.
                </div>
            )}
        </div>
    )
}

PageSectionsDisplayField.displayName = 'PageSectionsDisplayField'

export default PageSectionsDisplayField

