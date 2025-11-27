import { useState, useCallback, useMemo, useEffect } from 'react';
import { X, AlertTriangle, Check, ChevronLeft, ChevronRight, List, Download, Upload } from 'lucide-react';
import { formatConflictForDisplay } from '@/utils/conflictResolution';

/**
 * DiffStepperModal
 * 
 * Step-through interface for resolving conflicts one at a time.
 * Shows only fields that actually differ between local and server.
 * Supports keyboard navigation for fast resolution.
 */
export default function DiffStepperModal({ 
    conflictResult, 
    onResolve, 
    onCancel,
    onSwitchToList
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [resolutions, setResolutions] = useState(() => {
        // Initialize with null (unresolved) for each conflict
        const initial = new Map();
        conflictResult.allConflicts.forEach(conflict => {
            initial.set(conflict.field, null);
        });
        return initial;
    });

    // Use conflicts directly from deep diff (already filtered to actual conflicts)
    const realConflicts = useMemo(() => {
        // Format conflicts for display
        return (conflictResult.allConflicts || [])
            .map(formatConflictForDisplay);
    }, [conflictResult]);

    const currentConflict = realConflicts[currentIndex];
    const totalConflicts = realConflicts.length;
    const currentResolution = resolutions.get(currentConflict?.field || currentConflict?.pathString);

    // Check if all conflicts are resolved
    const allResolved = useMemo(() => {
        return realConflicts.every(c => resolutions.get(c.field) !== null);
    }, [resolutions, realConflicts]);

    // Handle field resolution
    const handleChoose = useCallback((useLocal) => {
        if (!currentConflict) return;
        
        const fieldKey = currentConflict.field || currentConflict.pathString;
        
        setResolutions(prev => {
            const next = new Map(prev);
            next.set(fieldKey, useLocal);
            return next;
        });
    }, [currentConflict]);

    // Navigation
    const handlePrev = useCallback(() => {
        setCurrentIndex(prev => Math.max(0, prev - 1));
    }, []);

    const handleNext = useCallback(() => {
        setCurrentIndex(prev => Math.min(totalConflicts - 1, prev + 1));
    }, [totalConflicts]);

    const handleNextUnresolved = useCallback(() => {
        // Find next unresolved conflict
        for (let i = currentIndex + 1; i < totalConflicts; i++) {
            const fieldKey = realConflicts[i].field || realConflicts[i].pathString;
            if (resolutions.get(fieldKey) === null) {
                setCurrentIndex(i);
                return;
            }
        }
        // Wrap around to start
        for (let i = 0; i < currentIndex; i++) {
            const fieldKey = realConflicts[i].field || realConflicts[i].pathString;
            if (resolutions.get(fieldKey) === null) {
                setCurrentIndex(i);
                return;
            }
        }
    }, [currentIndex, totalConflicts, resolutions, realConflicts]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e) => {
            // Don't handle if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    handlePrev();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    handleNext();
                    break;
                case '1':
                    e.preventDefault();
                    handleChoose(true);
                    break;
                case '2':
                    e.preventDefault();
                    handleChoose(false);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (currentResolution !== null) {
                        handleNextUnresolved();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onCancel();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handlePrev, handleNext, handleChoose, handleNextUnresolved, currentResolution, onCancel]);

    // Bulk actions
    const handleAcceptAllServer = useCallback(() => {
        const allServerResolutions = new Map();
        realConflicts.forEach(conflict => {
            const fieldKey = conflict.field || conflict.pathString;
            allServerResolutions.set(fieldKey, false); // false = use server
        });
        setResolutions(allServerResolutions);
    }, [realConflicts]);

    const handleKeepAllLocal = useCallback(() => {
        const allLocalResolutions = new Map();
        realConflicts.forEach(conflict => {
            const fieldKey = conflict.field || conflict.pathString;
            allLocalResolutions.set(fieldKey, true); // true = use local
        });
        setResolutions(allLocalResolutions);
    }, [realConflicts]);

    // Submit resolutions
    const handleSubmit = useCallback(() => {
        if (!allResolved) return;

        const resolutionArray = Array.from(resolutions.entries()).map(([field, useLocal]) => ({
            field,
            useLocal
        }));

        onResolve(resolutionArray);
    }, [allResolved, resolutions, onResolve]);

    if (!currentConflict) {
        return (
            <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                    <p className="text-center text-gray-600">No conflicts to resolve</p>
                    <button
                        onClick={onCancel}
                        className="mt-4 w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-orange-500" />
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Resolve Conflicts
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Conflict {currentIndex + 1} of {totalConflicts}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onSwitchToList && (
                            <button
                                onClick={onSwitchToList}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Switch to list view"
                            >
                                <List className="w-4 h-4" />
                                List View
                            </button>
                        )}
                        <button
                            onClick={onCancel}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Progress Bar and Bulk Actions */}
                <div className="px-6 pt-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ 
                                            width: `${(Array.from(resolutions.values()).filter(r => r !== null).length / totalConflicts) * 100}%` 
                                        }}
                                    />
                                </div>
                                <span className="text-sm text-gray-600 font-medium">
                                    {Array.from(resolutions.values()).filter(r => r !== null).length} / {totalConflicts}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAcceptAllServer}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-green-700 bg-green-50 border border-green-300 rounded-lg hover:bg-green-100 transition-colors"
                                title="Accept all changes from server"
                            >
                                <Download className="w-4 h-4" />
                                Accept All Server
                            </button>
                            <button
                                onClick={handleKeepAllLocal}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
                                title="Keep all your local changes"
                            >
                                <Upload className="w-4 h-4" />
                                Keep All Local
                            </button>
                        </div>
                    </div>
                </div>

                {/* Current Conflict */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto">
                        {/* Field name */}
                        <div className="mb-6">
                            <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                                {currentConflict.fieldLabel}
                            </h3>
                            {currentResolution !== null && (
                                <div className="flex items-center gap-2 text-green-600">
                                    <Check className="w-5 h-5" />
                                    <span className="font-medium">Resolved</span>
                                </div>
                            )}
                        </div>

                        {/* Side-by-side comparison */}
                        <div className="grid grid-cols-2 gap-6">
                            {/* Local version */}
                            <div
                                onClick={() => handleChoose(true)}
                                className={`cursor-pointer border-3 rounded-lg p-6 transition-all ${
                                    currentResolution === true
                                        ? 'border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-600'
                                        : 'border-gray-300 hover:border-blue-400 hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-semibold text-gray-900">
                                            My Changes
                                        </span>
                                        <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 rounded border border-gray-300">
                                            1
                                        </kbd>
                                    </div>
                                    <input
                                        type="radio"
                                        checked={currentResolution === true}
                                        onChange={() => handleChoose(true)}
                                        className="w-5 h-5 text-blue-600"
                                    />
                                </div>
                                <div className={`text-base ${
                                    currentConflict.isComplexObject 
                                        ? 'font-mono text-sm bg-white p-4 rounded border border-gray-200 overflow-auto max-h-96' 
                                        : 'text-gray-900 break-words'
                                }`}>
                                    {currentConflict.isHtmlContent ? (
                                        <div 
                                            className="prose prose-sm max-w-none prose-headings:text-base prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:text-sm prose-p:my-2 prose-headings:my-2"
                                            dangerouslySetInnerHTML={{ __html: currentConflict.localValue }}
                                        />
                                    ) : (
                                        currentConflict.localDisplay
                                    )}
                                </div>
                            </div>

                            {/* Server version */}
                            <div
                                onClick={() => handleChoose(false)}
                                className={`cursor-pointer border-3 rounded-lg p-6 transition-all ${
                                    currentResolution === false
                                        ? 'border-green-600 bg-green-50 shadow-lg ring-2 ring-green-600'
                                        : 'border-gray-300 hover:border-green-400 hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-semibold text-gray-900">
                                            Server Version
                                        </span>
                                        <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 rounded border border-gray-300">
                                            2
                                        </kbd>
                                    </div>
                                    <input
                                        type="radio"
                                        checked={currentResolution === false}
                                        onChange={() => handleChoose(false)}
                                        className="w-5 h-5 text-green-600"
                                    />
                                </div>
                                <div className={`text-base ${
                                    currentConflict.isComplexObject 
                                        ? 'font-mono text-sm bg-white p-4 rounded border border-gray-200 overflow-auto max-h-96' 
                                        : 'text-gray-900 break-words'
                                }`}>
                                    {currentConflict.isHtmlContent ? (
                                        <div 
                                            className="prose prose-sm max-w-none prose-headings:text-base prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:text-sm prose-p:my-2 prose-headings:my-2"
                                            dangerouslySetInnerHTML={{ __html: currentConflict.serverValue }}
                                        />
                                    ) : (
                                        currentConflict.serverDisplay
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Original value reference */}
                        {currentConflict.originalDisplay !== currentConflict.localDisplay && 
                         currentConflict.originalDisplay !== currentConflict.serverDisplay && (
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <p className="text-sm text-gray-500 mb-2">Original value:</p>
                                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                                    {currentConflict.originalDisplay}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation Footer */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                currentIndex === 0
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                            }`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                            <kbd className="ml-1 px-1.5 py-0.5 text-xs font-mono bg-gray-700 text-white rounded">←</kbd>
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={currentIndex === totalConflicts - 1}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                currentIndex === totalConflicts - 1
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                            }`}
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                            <kbd className="ml-1 px-1.5 py-0.5 text-xs font-mono bg-gray-700 text-white rounded">→</kbd>
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-600">
                            {allResolved ? (
                                <span className="text-green-600 font-medium">
                                    All conflicts resolved!
                                </span>
                            ) : (
                                <span className="text-orange-600 font-medium">
                                    {totalConflicts - Array.from(resolutions.values()).filter(r => r !== null).length} unresolved
                                </span>
                            )}
                        </div>
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

                {/* Keyboard shortcuts help */}
                <div className="px-6 py-3 bg-gray-100 border-t border-gray-200 text-xs text-gray-600">
                    <div className="flex gap-6">
                        <span><kbd className="px-1.5 py-0.5 font-mono bg-white rounded border">←</kbd> <kbd className="px-1.5 py-0.5 font-mono bg-white rounded border">→</kbd> Navigate</span>
                        <span><kbd className="px-1.5 py-0.5 font-mono bg-white rounded border">1</kbd> My changes</span>
                        <span><kbd className="px-1.5 py-0.5 font-mono bg-white rounded border">2</kbd> Server version</span>
                        <span><kbd className="px-1.5 py-0.5 font-mono bg-white rounded border">Enter</kbd> Next unresolved</span>
                        <span><kbd className="px-1.5 py-0.5 font-mono bg-white rounded border">Esc</kbd> Cancel</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

