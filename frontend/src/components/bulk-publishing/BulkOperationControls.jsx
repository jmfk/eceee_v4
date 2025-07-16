/**
 * Bulk Operation Controls Component
 * Handles operation type selection (publish/schedule) and scheduling form
 */

import React from 'react';
import { Clock, Eye, Loader } from 'lucide-react';

const BulkOperationControls = ({
    operation,
    setOperation,
    scheduledDate,
    setScheduledDate,
    expiryDate,
    setExpiryDate,
    selectedPages,
    processing,
    onBulkOperation
}) => {
    const getMinDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bulk Operations</h2>

            {/* Operation Type Selection */}
            <div className="space-y-4">
                <div>
                    <h3 className="font-medium text-gray-900 mb-3">Operation Type</h3>
                    <div className="space-y-2">
                        <label className="flex items-center">
                            <input
                                type="radio"
                                name="operation"
                                value="publish"
                                checked={operation === 'publish'}
                                onChange={(e) => setOperation(e.target.value)}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Publish immediately</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="radio"
                                name="operation"
                                value="schedule"
                                checked={operation === 'schedule'}
                                onChange={(e) => setOperation(e.target.value)}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Schedule for later</span>
                        </label>
                    </div>
                </div>

                {/* Schedule Settings */}
                {operation === 'schedule' && (
                    <div className="space-y-4">
                        <h3 className="font-medium text-gray-900">Schedule Settings</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Publication Date *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    min={getMinDateTime()}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Expiry Date (Optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                    min={scheduledDate || getMinDateTime()}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Button */}
            <div className="mt-6 flex justify-end">
                <button
                    onClick={onBulkOperation}
                    disabled={processing || selectedPages.size === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    {processing ? (
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                    ) : operation === 'publish' ? (
                        <Eye className="w-4 h-4 mr-2" />
                    ) : (
                        <Clock className="w-4 h-4 mr-2" />
                    )}
                    {processing
                        ? 'Processing...'
                        : operation === 'publish'
                            ? `Publish ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`
                            : `Schedule ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`
                    }
                </button>
            </div>
        </div>
    );
};

export default BulkOperationControls; 