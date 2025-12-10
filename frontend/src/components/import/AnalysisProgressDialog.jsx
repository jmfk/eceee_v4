/**
 * AnalysisProgressDialog - Shows progress while analyzing images and files
 * 
 * Displays a modal dialog with progress bar and current item being analyzed
 */

import React from 'react';
import { Loader, Image as ImageIcon, FileText, SkipForward } from 'lucide-react';

const AnalysisProgressDialog = ({ isOpen, progress, onSkip }) => {
    if (!isOpen) return null;

    const { current, total, type, itemName, resolution } = progress;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <Loader className="w-6 h-6 text-blue-600 animate-spin" />
                    <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">
                        Analyzing Media Files
                    </div>
                </div>

                {/* Progress Info */}
                <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>
                            {current} of {total} items
                        </span>
                        <span className="font-medium text-blue-600">
                            {percentage}%
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>

                {/* Current Item */}
                {itemName && (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        {type === 'image' ? (
                            <ImageIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        ) : (
                            <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-500 mb-0.5">
                                Analyzing {type}...
                            </div>
                            <div className="text-sm font-medium text-gray-900 truncate">
                                {itemName}
                            </div>
                            {/* Show resolution if available */}
                            {resolution && type === 'image' && (
                                <div className="text-xs text-blue-600 font-medium mt-1">
                                    Resolution: {resolution}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between mt-4">
                    <div className="text-xs text-gray-500">
                        Detecting resolution and generating AI metadata
                    </div>
                    {onSkip && (
                        <button
                            onClick={onSkip}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <SkipForward className="w-4 h-4" />
                            Skip
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalysisProgressDialog;

