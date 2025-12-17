import React from 'react'
import { X, Palette, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * Design Groups Info Modal
 * Shows which design groups are affecting a widget with links to edit them
 */
const DesignGroupsInfoModal = ({ widgetType, onClose, themeId }) => {
    const navigate = useNavigate()

    const handleEditTheme = () => {
        if (themeId) {
            navigate(`/themes/${themeId}/edit?tab=design-groups`)
        } else {
            // If no theme ID, go to themes list
            navigate('/themes')
        }
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10010]" onClick={onClose}>
            <div 
                className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Widget Styling</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Header Widget</h4>
                        <p className="text-sm text-gray-600 mb-4">
                            This widget is styled entirely through Design Groups in the theme editor.
                        </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h5 className="font-medium text-blue-900 mb-2">Styling Configuration</h5>
                        <ul className="space-y-2 text-sm text-blue-800">
                            <li className="flex items-start">
                                <span className="mr-2">•</span>
                                <span><strong>Background Images:</strong> Set per breakpoint in Layout Properties</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2">•</span>
                                <span><strong>Height:</strong> Controlled by CSS variables (--header-height-sm/md/lg/xl)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2">•</span>
                                <span><strong>Position & Size:</strong> Configured in design group settings</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-2">How to Edit</h5>
                        <ol className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start">
                                <span className="mr-2">1.</span>
                                <span>Go to Theme Editor → Design Groups tab</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2">2.</span>
                                <span>Select or create a design group for HeaderWidget</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2">3.</span>
                                <span>Use Layout Properties to set background images per breakpoint</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2">4.</span>
                                <span>Configure height, position, and other CSS properties</span>
                            </li>
                        </ol>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleEditTheme}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Palette className="h-4 w-4" />
                        Edit Theme
                        <ExternalLink className="h-3 w-3" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default DesignGroupsInfoModal

