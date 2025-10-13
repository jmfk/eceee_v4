/**
 * Path Debug Widget - ECEEE Frontend Component
 * 
 * Displays path variables captured from URL patterns for debugging.
 * Useful for testing dynamic object publishing.
 */

import React from 'react';
import { Bug } from 'lucide-react';

const eceeePathDebugWidget = ({ config = {}, mode = 'display', onConfigChange, context = {} }) => {
    const {
        showFullContext = false,
        title = 'Path Debug',
    } = config;

    // Extract path variables from context (same as backend provides)
    const pathVariables = context.pathVariables || {};
    const simulatedPath = context.simulatedPath || '';

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

    // In display mode, show path variables from context
    const hasPathVariables = Object.keys(pathVariables).length > 0;
    const hasPattern = context.webpageData?.pathPatternKey || context.webpageData?.path_pattern_key;

    return (
        <div className="border-2 border-purple-500 bg-purple-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
                <Bug className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-purple-900">{title}</h3>
            </div>

            {/* Path Pattern Status */}
            <div className="bg-white rounded p-4 border border-purple-200 mb-3">
                <div className="text-sm font-medium text-gray-700 mb-2">
                    Path Pattern Status:
                </div>
                {hasPattern ? (
                    <div className="flex items-center gap-2 text-green-700">
                        <span className="text-lg">✓</span>
                        <span>Pattern: <code className="bg-green-100 px-2 py-0.5 rounded text-sm">{hasPattern}</code></span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-orange-600">
                        <span className="text-lg">⚠</span>
                        <span className="text-sm">No path pattern set (go to Settings tab)</span>
                    </div>
                )}
            </div>

            {/* Simulated Path (in editor) */}
            {simulatedPath && (
                <div className="bg-blue-50 rounded p-3 border border-blue-200 mb-3">
                    <div className="text-xs font-medium text-blue-900 mb-1">Simulated Path:</div>
                    <code className="text-sm text-blue-800 bg-blue-100 px-2 py-1 rounded block">
                        {simulatedPath}
                    </code>
                </div>
            )}

            {/* Path Variables */}
            <div className="bg-white rounded p-4 border border-purple-200">
                <div className="text-sm font-medium text-gray-700 mb-2">
                    Extracted Path Variables:
                </div>
                {hasPathVariables ? (
                    <div className="space-y-2">
                        {Object.entries(pathVariables).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between bg-gray-50 rounded p-2">
                                <code className="text-sm font-mono text-purple-700">{key}</code>
                                <code className="text-sm font-mono text-gray-800 bg-gray-200 px-2 py-1 rounded">
                                    {value}
                                </code>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 italic">
                        {hasPattern
                            ? "No variables extracted yet. Set a simulated path in Settings tab."
                            : "Set a path pattern in Settings tab to capture variables."}
                    </div>
                )}
            </div>

            {/* Full Context (if enabled) */}
            {showFullContext && (
                <div className="mt-3 bg-gray-800 rounded p-3 overflow-auto max-h-96">
                    <div className="text-xs font-medium text-gray-300 mb-2">Full Context (Advanced):</div>
                    <pre className="text-xs text-green-400 font-mono">
                        {JSON.stringify(context, null, 2)}
                    </pre>
                </div>
            )}

            <div className="mt-3 bg-purple-100 rounded p-3">
                <div className="text-xs text-purple-800">
                    <strong>💡 Usage:</strong> In the Settings tab, select a path pattern (e.g., "news_slug"),
                    then enter a path like <code className="bg-purple-200 px-1 rounded">my-article/</code> to see extracted variables.
                </div>
            </div>
        </div>
    );
};

export default eceeePathDebugWidget;

