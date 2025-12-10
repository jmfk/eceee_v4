/**
 * Conflict Resolution Dialog
 * 
 * Shows conflicts when pasting theme data and allows user to resolve them
 */

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

const ConflictResolutionDialog = ({ conflicts, onResolve, onCancel }) => {
    const [resolutions, setResolutions] = useState({});
    const [expandedConflicts, setExpandedConflicts] = useState({});

    // Initialize all resolutions to 'keep'
    useEffect(() => {
        const initial = {};
        conflicts.forEach(conflict => {
            const key = `${conflict.section}.${conflict.key}`;
            initial[key] = 'keep';
        });
        setResolutions(initial);
    }, [conflicts]);

    const handleResolutionChange = (conflict, resolution) => {
        const key = `${conflict.section}.${conflict.key}`;
        setResolutions(prev => ({
            ...prev,
            [key]: resolution,
        }));
    };

    const handleRenameChange = (conflict, newName) => {
        const key = `${conflict.section}.${conflict.key}`;
        setResolutions(prev => ({
            ...prev,
            [`${key}.newName`]: newName,
        }));
    };

    const handleSelectAll = (resolution) => {
        const updated = {};
        conflicts.forEach(conflict => {
            const key = `${conflict.section}.${conflict.key}`;
            updated[key] = resolution;
        });
        setResolutions(updated);
    };

    const toggleExpanded = (index) => {
        setExpandedConflicts(prev => ({
            ...prev,
            [index]: !prev[index],
        }));
    };

    const handleApply = () => {
        onResolve(resolutions);
    };

    const renderValue = (value, section) => {
        if (typeof value === 'string') {
            return <span className="text-sm text-gray-900">{value}</span>;
        }

        if (section === 'fonts') {
            return (
                <div className="text-sm space-y-1">
                    <div className="font-medium text-gray-900">{value.family}</div>
                    <div className="text-xs text-gray-600">Variants: {value.variants?.join(', ')}</div>
                </div>
            );
        }

        if (section === 'colors') {
            return (
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded border border-gray-300"
                        style={{ backgroundColor: value }}
                    />
                    <span className="text-sm text-gray-900 font-mono">{value}</span>
                </div>
            );
        }

        // For complex objects, show JSON
        return (
            <pre className="text-xs text-gray-700 bg-gray-50 p-2 rounded overflow-x-auto max-h-32">
                {JSON.stringify(value, null, 2)}
            </pre>
        );
    };

    const stats = {
        total: conflicts.length,
        overwrite: Object.values(resolutions).filter(r => r === 'overwrite').length,
        keep: Object.values(resolutions).filter(r => r === 'keep').length,
        rename: Object.values(resolutions).filter(r => r === 'rename').length,
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <div>
                            <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="2">
                                Resolve Conflicts
                            </div>
                            <div className="text-sm text-gray-600">
                                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected. Choose how to handle each one.
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-6 text-sm">
                    <div>
                        <span className="text-gray-600">Total:</span>{' '}
                        <span className="font-semibold text-gray-900">{stats.total}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Keep:</span>{' '}
                        <span className="font-semibold text-blue-600">{stats.keep}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Overwrite:</span>{' '}
                        <span className="font-semibold text-orange-600">{stats.overwrite}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Rename:</span>{' '}
                        <span className="font-semibold text-green-600">{stats.rename}</span>
                    </div>
                </div>

                {/* Bulk Actions */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">Quick Actions:</span>
                    <button
                        onClick={() => handleSelectAll('keep')}
                        className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200"
                    >
                        Keep All Existing
                    </button>
                    <button
                        onClick={() => handleSelectAll('overwrite')}
                        className="px-3 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded hover:bg-orange-200"
                    >
                        Overwrite All
                    </button>
                    <button
                        onClick={() => handleSelectAll('rename')}
                        className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200"
                    >
                        Rename All
                    </button>
                </div>

                {/* Conflicts List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="space-y-3">
                        {conflicts.map((conflict, index) => {
                            const key = `${conflict.section}.${conflict.key}`;
                            const resolution = resolutions[key];
                            const isExpanded = expandedConflicts[index];

                            return (
                                <div
                                    key={index}
                                    className="border border-gray-200 rounded-lg overflow-hidden"
                                >
                                    {/* Conflict Header */}
                                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                                        <button
                                            onClick={() => toggleExpanded(index)}
                                            className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4" />
                                            )}
                                            <span className="capitalize">{conflict.section}</span>
                                            <span className="text-gray-500">→</span>
                                            <span className="font-semibold">{conflict.key}</span>
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <select
                                                value={resolution}
                                                onChange={(e) => handleResolutionChange(conflict, e.target.value)}
                                                className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="keep">Keep Existing</option>
                                                <option value="overwrite">Overwrite</option>
                                                <option value="rename">Rename New</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Conflict Details */}
                                    {isExpanded && (
                                        <div className="p-4 bg-white">
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                {/* Existing Value */}
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                                        Existing Value
                                                    </div>
                                                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                                        {renderValue(conflict.existing, conflict.section)}
                                                    </div>
                                                </div>

                                                {/* Incoming Value */}
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                                        Incoming Value
                                                    </div>
                                                    <div className="bg-orange-50 border border-orange-200 rounded p-3">
                                                        {renderValue(conflict.incoming, conflict.section)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Rename Input */}
                                            {resolution === 'rename' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        New name for incoming item:
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder={`${conflict.key}-copy`}
                                                        onChange={(e) => handleRenameChange(conflict, e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                        Apply Resolutions
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConflictResolutionDialog;

