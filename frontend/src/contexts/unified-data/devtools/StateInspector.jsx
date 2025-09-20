import React, { useState, useMemo } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Search,
    Copy,
    Eye,
    EyeOff,
    Filter
} from 'lucide-react';

/**
 * Visual State Inspector for UnifiedDataContext
 * Provides interactive exploration of application state
 */

function StateNode({ data, path = '', level = 0, maxLevel = 3 }) {
    const [isExpanded, setIsExpanded] = useState(level < 2);
    const [filter, setFilter] = useState('');

    const isObject = data && typeof data === 'object' && !Array.isArray(data);
    const isArray = Array.isArray(data);
    const isPrimitive = !isObject && !isArray;

    const filteredKeys = useMemo(() => {
        if (!isObject && !isArray) return [];

        const keys = isArray ? data.map((_, i) => i.toString()) : Object.keys(data);

        if (!filter) return keys;

        return keys.filter(key =>
            key.toLowerCase().includes(filter.toLowerCase()) ||
            JSON.stringify(data[key]).toLowerCase().includes(filter.toLowerCase())
        );
    }, [data, filter, isObject, isArray]);

    const copyToClipboard = (value) => {
        navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    };

    if (isPrimitive) {
        return (
            <div className="flex items-center space-x-2 py-1">
                <span className="text-sm font-mono text-gray-600">{path}:</span>
                <span className={`text-sm font-mono ${typeof data === 'string' ? 'text-green-600' :
                        typeof data === 'number' ? 'text-blue-600' :
                            typeof data === 'boolean' ? 'text-purple-600' :
                                'text-gray-600'
                    }`}>
                    {JSON.stringify(data)}
                </span>
                <button
                    onClick={() => copyToClipboard(data)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Copy value"
                >
                    <Copy className="w-3 h-3" />
                </button>
            </div>
        );
    }

    return (
        <div className="border-l border-gray-200 pl-4 ml-2">
            <div className="flex items-center space-x-2 py-1">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center space-x-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                    <span>{path || 'root'}</span>
                    <span className="text-gray-500">
                        {isArray ? `[${data.length}]` : `{${Object.keys(data).length}}`}
                    </span>
                </button>

                <button
                    onClick={() => copyToClipboard(data)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Copy object"
                >
                    <Copy className="w-3 h-3" />
                </button>

                {level === 0 && (
                    <div className="flex items-center space-x-2 ml-auto">
                        <input
                            type="text"
                            placeholder="Filter..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-2 py-1 text-xs border rounded"
                        />
                        <Filter className="w-3 h-3 text-gray-400" />
                    </div>
                )}
            </div>

            {isExpanded && level < maxLevel && (
                <div className="mt-2 space-y-1">
                    {filteredKeys.map(key => (
                        <StateNode
                            key={key}
                            data={data[key]}
                            path={key}
                            level={level + 1}
                            maxLevel={maxLevel}
                        />
                    ))}
                    {filteredKeys.length === 0 && filter && (
                        <div className="text-sm text-gray-500 italic">
                            No matches for "{filter}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function StateInspector({ state, onClose }) {
    const [selectedEntity, setSelectedEntity] = useState('pages');
    const [showMetadata, setShowMetadata] = useState(true);
    const [maxDepth, setMaxDepth] = useState(3);

    const entities = [
        { key: 'pages', label: 'Pages', count: Object.keys(state.pages || {}).length },
        { key: 'widgets', label: 'Widgets', count: Object.keys(state.widgets || {}).length },
        { key: 'layouts', label: 'Layouts', count: Object.keys(state.layouts || {}).length },
        { key: 'versions', label: 'Versions', count: Object.keys(state.versions || {}).length },
        { key: 'metadata', label: 'Metadata', count: Object.keys(state.metadata || {}).length }
    ];

    const selectedData = state[selectedEntity] || {};

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-2xl w-11/12 h-5/6 flex">
                {/* Sidebar */}
                <div className="w-64 border-r bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-900">State Inspector</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-2 mb-4">
                        {entities.map(entity => (
                            <button
                                key={entity.key}
                                onClick={() => setSelectedEntity(entity.key)}
                                className={`w-full text-left p-2 rounded text-sm ${selectedEntity === entity.key
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'hover:bg-gray-100'
                                    }`}
                            >
                                <div className="flex justify-between items-center">
                                    <span>{entity.label}</span>
                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                                        {entity.count}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="border-t pt-4 space-y-3">
                        <div>
                            <label className="flex items-center space-x-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={showMetadata}
                                    onChange={(e) => setShowMetadata(e.target.checked)}
                                />
                                <span>Show Metadata</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-700 mb-1">
                                Max Depth: {maxDepth}
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={maxDepth}
                                onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <button
                            onClick={() => {
                                const data = JSON.stringify(state, null, 2);
                                const blob = new Blob([data], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `state-${Date.now()}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        >
                            Export State
                        </button>
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">
                                {entities.find(e => e.key === selectedEntity)?.label}
                                <span className="text-sm text-gray-500 ml-2">
                                    ({Object.keys(selectedData).length} items)
                                </span>
                            </h4>

                            <div className="text-xs text-gray-500">
                                State size: {(JSON.stringify(selectedData).length / 1024).toFixed(1)}KB
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-4">
                        {Object.keys(selectedData).length === 0 ? (
                            <div className="text-center text-gray-500 mt-8">
                                <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No {selectedEntity} data available</p>
                            </div>
                        ) : (
                            <StateNode
                                data={selectedData}
                                path={selectedEntity}
                                level={0}
                                maxLevel={maxDepth}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Performance Profiler Panel
 */
export function PerformanceProfilerPanel({ report, onClose }) {
    if (!report) return null;

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-2xl w-11/12 h-5/6 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-900">Performance Profiler</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        ×
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {/* Performance Score */}
                    <div className="mb-6 text-center">
                        <div className={`text-4xl font-bold ${getScoreColor(report.score)}`}>
                            {report.score}/100
                        </div>
                        <div className="text-gray-600">Performance Score</div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-600">Total Operations</div>
                            <div className="text-2xl font-bold">{report.totalOperations}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-600">Avg Time</div>
                            <div className="text-2xl font-bold">{report.averageOperationTime.toFixed(1)}ms</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-600">Slow Operations</div>
                            <div className="text-2xl font-bold text-red-600">{report.slowestOperations.length}</div>
                        </div>
                    </div>

                    {/* Recommendations */}
                    {report.recommendations.length > 0 && (
                        <div className="mb-6">
                            <h3 className="font-medium text-gray-900 mb-2">Recommendations</h3>
                            <div className="space-y-2">
                                {report.recommendations.map((rec, index) => (
                                    <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                                        <p className="text-sm text-yellow-800">{rec}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Slowest Operations */}
                    {report.slowestOperations.length > 0 && (
                        <div className="mb-6">
                            <h3 className="font-medium text-gray-900 mb-2">Slowest Operations</h3>
                            <div className="space-y-2">
                                {report.slowestOperations.map((op, index) => (
                                    <div key={index} className="p-3 border rounded">
                                        <div className="flex justify-between items-center">
                                            <span className="font-mono text-sm">{op.operationType}</span>
                                            <span className="text-sm text-red-600 font-medium">
                                                {op.duration?.toFixed(2)}ms
                                            </span>
                                        </div>
                                        {op.stateSizeDelta && (
                                            <div className="text-xs text-gray-600 mt-1">
                                                State size: +{(op.stateSizeDelta / 1024).toFixed(1)}KB
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Memory Leaks */}
                    {report.memoryLeaks.length > 0 && (
                        <div>
                            <h3 className="font-medium text-gray-900 mb-2">Potential Memory Leaks</h3>
                            <div className="space-y-2">
                                {report.memoryLeaks.map((op, index) => (
                                    <div key={index} className="p-3 border border-red-200 rounded bg-red-50">
                                        <div className="flex justify-between items-center">
                                            <span className="font-mono text-sm">{op.operationType}</span>
                                            <span className="text-sm text-red-600 font-medium">
                                                +{((op.memoryDelta || 0) / 1000000).toFixed(1)}MB
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export { StateInspector, PerformanceProfilerPanel };
