/**
 * AnalysisProgressDialog - Shows progress while analyzing images and files
 * 
 * Displays a modal dialog with progress bar and current item being analyzed
 */

import React from 'react';
import { Loader, Image as ImageIcon, FileText } from 'lucide-react';

const AnalysisProgressDialog = ({ isOpen, progress }) => {
    if (!isOpen) return null;

    const { current, total, type, itemName } = progress;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <Loader className="w-6 h-6 text-blue-600 animate-spin" />
                    <h3 className="text-lg font-semibold text-gray-900">
                        Analyzing Media Files
                    </h3>
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
                            <p className="text-sm text-gray-500 mb-0.5">
                                Analyzing {type}...
                            </p>
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {itemName}
                            </p>
                        </div>
                    </div>
                )}

                {/* Description */}
                <p className="text-xs text-gray-500 mt-4 text-center">
                    Detecting resolution and generating AI metadata for each item
                </p>
            </div>
        </div>
    );
};

export default AnalysisProgressDialog;

