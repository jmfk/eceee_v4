import { Search, CheckCircle, XCircle } from 'lucide-react'

/**
 * HTML Slot Detection Panel
 * 
 * Displays slot detection status, statistics, and provides controls for
 * slot management in HTML-based layouts.
 */
const HtmlSlotDetectionPanel = ({
    validation,
    slotsConfiguration,
    onSlotHighlight,
    onSlotUnhighlight,
    onRefreshSlots
}) => {
    const stats = {
        total: slotsConfiguration.length,
        valid: slotsConfiguration.filter(s => s.isValid).length,
        invalid: slotsConfiguration.filter(s => !s.isValid).length,
        empty: slotsConfiguration.filter(s => !s.widgets || s.widgets.length === 0).length
    }

    return (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">HTML Slot Detection</h3>
                <button
                    onClick={onRefreshSlots}
                    className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                    <Search className="w-4 h-4 mr-1" />
                    Refresh
                </button>
            </div>

            {/* Detection Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                    <div className="text-xs text-gray-500">Total Slots</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
                    <div className="text-xs text-gray-500">Valid</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
                    <div className="text-xs text-gray-500">Invalid</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{stats.empty}</div>
                    <div className="text-xs text-gray-500">Empty</div>
                </div>
            </div>

            {/* Validation Status */}
            <div className={`p-3 rounded-lg ${validation.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center space-x-2">
                    {validation.isValid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${validation.isValid ? 'text-green-800' : 'text-red-800'}`}>
                        {validation.isValid ? 'All slots are valid' : `${validation.errors.length} validation error(s)`}
                    </span>
                </div>

                {!validation.isValid && validation.errors.length > 0 && (
                    <ul className="mt-2 text-sm text-red-700 space-y-1">
                        {validation.errors.slice(0, 3).map((error, index) => (
                            <li key={index}>• {error}</li>
                        ))}
                        {validation.errors.length > 3 && (
                            <li className="text-red-600">... and {validation.errors.length - 3} more</li>
                        )}
                    </ul>
                )}

                {validation.warnings.length > 0 && (
                    <div className="mt-2">
                        <div className="text-yellow-700 font-medium text-sm">Warnings:</div>
                        <ul className="text-sm text-yellow-600 space-y-1">
                            {validation.warnings.slice(0, 2).map((warning, index) => (
                                <li key={index}>• {warning}</li>
                            ))}
                            {validation.warnings.length > 2 && (
                                <li className="text-yellow-600">... and {validation.warnings.length - 2} more</li>
                            )}
                        </ul>
                    </div>
                )}
            </div>

            {/* Slot Actions */}
            <div className="flex space-x-2 mt-4">
                <button
                    onClick={onSlotHighlight}
                    className="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                    Highlight All Slots
                </button>
                <button
                    onClick={onSlotUnhighlight}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                    Remove Highlights
                </button>
            </div>
        </div>
    )
}

export default HtmlSlotDetectionPanel 