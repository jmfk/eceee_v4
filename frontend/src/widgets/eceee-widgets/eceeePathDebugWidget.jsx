/**
 * Path Debug Widget - ECEEE Frontend Component
 * 
 * Displays path variables captured from URL patterns for debugging.
 * Useful for testing dynamic object publishing.
 */

import React from 'react';
import { Bug } from 'lucide-react';

const eceeePathDebugWidget = ({ config = {}, mode = 'display', onConfigChange }) => {
    const {
        showFullContext = false,
        title = 'Path Debug',
    } = config;

    // In edit mode, show configuration options
    if (mode === 'edit') {
        return (
            <div className="border-2 border-purple-300 bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Bug className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-purple-900">Path Debug Widget - Configuration</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => onConfigChange?.({ title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Path Debug"
                        />
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="show-full-context"
                            checked={showFullContext}
                            onChange={(e) => onConfigChange?.({ showFullContext: e.target.checked })}
                            className="h-4 w-4 text-purple-600 rounded"
                        />
                        <label htmlFor="show-full-context" className="ml-2 text-sm text-gray-700">
                            Show full context (advanced debugging)
                        </label>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-xs text-yellow-800">
                            <strong>Note:</strong> This widget is for development/debugging.
                            It displays path variables captured from the page's path pattern.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // In display mode, show placeholder (actual rendering happens on backend)
    return (
        <div className="border-2 border-purple-500 bg-purple-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
                <Bug className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-purple-900">{title}</h3>
            </div>

            <div className="bg-white rounded p-4 border border-purple-200">
                <div className="text-sm text-gray-600 italic">
                    Path debug information will be displayed when viewing the published page.
                </div>
                <div className="mt-2 text-xs text-gray-500">
                    Visit the page with different URL paths to see captured variables.
                </div>
            </div>

            <div className="mt-3 bg-purple-100 rounded p-3">
                <div className="text-xs text-purple-800">
                    <strong>💡 Tip:</strong> Set a path pattern in Settings tab (e.g., <code className="bg-purple-200 px-1 rounded">^(?P&lt;slug&gt;[\w-]+)/$</code>),
                    then visit URLs like <code className="bg-purple-200 px-1 rounded">/news/my-article/</code> to see variables.
                </div>
            </div>
        </div>
    );
};

export default eceeePathDebugWidget;

