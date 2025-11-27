import { useState, useCallback, useMemo } from 'react';
import { X, AlertTriangle, Check, Layers } from 'lucide-react';
import { formatConflictForDisplay, getConflictSummary } from '@/utils/conflictResolution';
import DiffStepperModal from './DiffStepperModal';

/**
 * ConflictResolutionModal
 * 
 * Shows field-level conflicts and allows user to choose which version to keep.
 * Supports quick actions: "Keep All Mine" and "Accept All Server".
 */
export default function ConflictResolutionModal({ 
    conflictResult, 
    onResolve, 
    onCancel 
}) {
    // View mode: 'diff' (step-through) or 'list' (all at once)
    const [viewMode, setViewMode] = useState('diff');
    
    // Track resolution decisions (field -> useLocal)
    const [resolutions, setResolutions] = useState(() => {
        // Initialize with null (unresolved) for each conflict
        const initial = new Map();
        (conflictResult.allConflicts || []).forEach(conflict => {
            const fieldKey = conflict.field || conflict.pathString;
            initial.set(fieldKey, null);
        });
        return initial;
    });

    // Format conflicts for display
    const formattedConflicts = useMemo(() => {
        return (conflictResult.allConflicts || []).map(formatConflictForDisplay);
    }, [conflictResult]);

    // Check if all conflicts are resolved
    const allResolved = useMemo(() => {
        return Array.from(resolutions.values()).every(res => res !== null);
    }, [resolutions]);

    // Handle individual field resolution
    const handleFieldResolution = useCallback((field, useLocal) => {
        setResolutions(prev => {
            const next = new Map(prev);
            next.set(field, useLocal);
            return next;
        });
    }, []);

    // Quick action: Keep all local changes
    const handleKeepAllMine = useCallback(() => {
        setResolutions(prev => {
            const next = new Map(prev);
            (conflictResult.allConflicts || []).forEach(conflict => {
                const fieldKey = conflict.field || conflict.pathString;
                next.set(fieldKey, true);
            });
            return next;
        });
    }, [conflictResult]);

    // Quick action: Accept all server changes
    const handleAcceptAllServer = useCallback(() => {
        setResolutions(prev => {
            const next = new Map(prev);
            (conflictResult.allConflicts || []).forEach(conflict => {
                const fieldKey = conflict.field || conflict.pathString;
                next.set(fieldKey, false);
            });
            return next;
        });
    }, [conflictResult]);

    // Submit resolutions
    const handleSubmit = useCallback(() => {
        if (!allResolved) {
            return;
        }

        // Convert Map to array format
        const resolutionArray = Array.from(resolutions.entries()).map(([field, useLocal]) => ({
            field,
            useLocal
        }));

        onResolve(resolutionArray);
    }, [allResolved, resolutions, onResolve]);

    const summary = getConflictSummary(conflictResult);

    // If in diff mode, render DiffStepperModal instead
    if (viewMode === 'diff') {
        return (
            <DiffStepperModal
                conflictResult={conflictResult}
                onResolve={onResolve}
                onCancel={onCancel}
                onSwitchToList={() => setViewMode('list')}
            />
        );
    }

    // Otherwise render list view
    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-orange-500" />
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Resolve Conflicts
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {summary}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('diff')}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Switch to diff viewer"
                        >
                            <Layers className="w-4 h-4" />
                            Diff Viewer
                        </button>
                        <button
                            onClick={onCancel}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex gap-3">
                        <button
                            onClick={handleKeepAllMine}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                            Keep All Mine
                        </button>
                        <button
                            onClick={handleAcceptAllServer}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                            Accept All Server
                        </button>
                    </div>
                </div>

                {/* Conflict List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {formattedConflicts.map((conflict, index) => {
                            const fieldKey = conflict.field || conflict.pathString;
                            const resolution = resolutions.get(fieldKey);
                            
                            return (
                                <div 
                                    key={fieldKey || index}
                                    className={`border rounded-lg p-4 ${
                                        resolution === null 
                                            ? 'border-orange-300 bg-orange-50' 
                                            : 'border-gray-300 bg-white'
                                    }`}
                                >
                                    {/* Field name */}
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-gray-900">
                                            {conflict.fieldLabel}
                                        </h3>
                                        {resolution !== null && (
                                            <Check className="w-5 h-5 text-green-600" />
                                        )}
                                    </div>

                                    {/* Side-by-side comparison */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Local version */}
                                        <div
                                            onClick={() => handleFieldResolution(fieldKey, true)}
                                            className={`cursor-pointer border-2 rounded-lg p-3 transition-all ${
                                                resolution === true
                                                    ? 'border-blue-600 bg-blue-50'
                                                    : 'border-gray-300 hover:border-blue-400'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-700">
                                                    My Changes
                                                </span>
                                                <input
                                                    type="radio"
                                                    checked={resolution === true}
                                                    onChange={() => handleFieldResolution(fieldKey, true)}
                                                    className="w-4 h-4 text-blue-600"
                                                />
                                            </div>
                                            <div className={`text-sm ${
                                                conflict.isComplexObject 
                                                    ? 'font-mono text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-40' 
                                                    : 'text-gray-900'
                                            }`}>
                                                {conflict.isHtmlContent ? (
                                                    <div 
                                                        className="prose prose-sm max-w-none prose-headings:text-sm prose-h1:text-base prose-h2:text-sm prose-h3:text-xs prose-p:text-xs prose-p:my-1 prose-headings:my-1"
                                                        dangerouslySetInnerHTML={{ __html: conflict.localValue }}
                                                    />
                                                ) : (
                                                    conflict.localDisplay
                                                )}
                                            </div>
                                        </div>

                                        {/* Server version */}
                                        <div
                                            onClick={() => handleFieldResolution(fieldKey, false)}
                                            className={`cursor-pointer border-2 rounded-lg p-3 transition-all ${
                                                resolution === false
                                                    ? 'border-green-600 bg-green-50'
                                                    : 'border-gray-300 hover:border-green-400'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-700">
                                                    Server Version
                                                </span>
                                                <input
                                                    type="radio"
                                                    checked={resolution === false}
                                                    onChange={() => handleFieldResolution(fieldKey, false)}
                                                    className="w-4 h-4 text-green-600"
                                                />
                                            </div>
                                            <div className={`text-sm ${
                                                conflict.isComplexObject 
                                                    ? 'font-mono text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-40' 
                                                    : 'text-gray-900'
                                            }`}>
                                                {conflict.isHtmlContent ? (
                                                    <div 
                                                        className="prose prose-sm max-w-none prose-headings:text-sm prose-h1:text-base prose-h2:text-sm prose-h3:text-xs prose-p:text-xs prose-p:my-1 prose-headings:my-1"
                                                        dangerouslySetInnerHTML={{ __html: conflict.serverValue }}
                                                    />
                                                ) : (
                                                    conflict.serverDisplay
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Original value (for reference) */}
                                    {conflict.originalDisplay !== conflict.localDisplay && 
                                     conflict.originalDisplay !== conflict.serverDisplay && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <span className="text-xs text-gray-500">
                                                Original value: {conflict.originalDisplay}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                        {allResolved ? (
                            <span className="text-green-600 font-medium">
                                All conflicts resolved. Ready to save.
                            </span>
                        ) : (
                            <span className="text-orange-600 font-medium">
                                Please resolve all conflicts before saving
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!allResolved}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                                allResolved
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            Save with Resolutions
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


