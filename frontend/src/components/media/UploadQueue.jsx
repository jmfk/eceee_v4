/**
 * UploadQueue Component
 * 
 * Visual upload queue interface showing:
 * - Current upload progress
 * - Queue status and controls
 * - Individual file progress
 * - Retry/cancel functionality
 */

import React from 'react';
import {
    Upload,
    Pause,
    Play,
    X,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Clock,
    Trash2,
    FileText
} from 'lucide-react';
import useUploadStore, { UPLOAD_STATUS } from '../../stores/uploadStore';

const UploadQueue = ({ className = '' }) => {
    const {
        queue,
        isUploading,
        currentUpload,
        globalProgress,
        pauseQueue,
        resumeQueue,
        retryUpload,
        cancelUpload,
        removeFromQueue,
        clearCompleted,
        clearAll,
        getQueueStats
    } = useUploadStore();

    const stats = getQueueStats();

    if (queue.length === 0) {
        return null;
    }

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case UPLOAD_STATUS.PENDING:
                return <Clock className="w-4 h-4 text-gray-500" />;
            case UPLOAD_STATUS.UPLOADING:
                return <Upload className="w-4 h-4 text-blue-500 animate-pulse" />;
            case UPLOAD_STATUS.COMPLETED:
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case UPLOAD_STATUS.FAILED:
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case UPLOAD_STATUS.CANCELLED:
                return <X className="w-4 h-4 text-gray-400" />;
            default:
                return <FileText className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case UPLOAD_STATUS.PENDING:
                return 'bg-gray-100 text-gray-700';
            case UPLOAD_STATUS.UPLOADING:
                return 'bg-blue-100 text-blue-700';
            case UPLOAD_STATUS.COMPLETED:
                return 'bg-green-100 text-green-700';
            case UPLOAD_STATUS.FAILED:
                return 'bg-red-100 text-red-700';
            case UPLOAD_STATUS.CANCELLED:
                return 'bg-gray-100 text-gray-500';
            default:
                return 'bg-gray-100 text-gray-500';
        }
    };

    return (
        <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">Upload Queue</h3>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                            {stats.total} files
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {isUploading ? (
                            <button
                                onClick={pauseQueue}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                            >
                                <Pause className="w-4 h-4" />
                                Pause
                            </button>
                        ) : stats.pending > 0 ? (
                            <button
                                onClick={resumeQueue}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                <Play className="w-4 h-4" />
                                Resume
                            </button>
                        ) : null}

                        {stats.completed > 0 && (
                            <button
                                onClick={clearCompleted}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Clear Completed
                            </button>
                        )}

                        <button
                            onClick={clearAll}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear All
                        </button>
                    </div>
                </div>

                {/* Global Progress */}
                {stats.total > 0 && (
                    <div className="mt-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>Overall Progress</span>
                            <span>{globalProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${globalProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                    {stats.pending > 0 && <span>Pending: {stats.pending}</span>}
                    {stats.uploading > 0 && <span>Uploading: {stats.uploading}</span>}
                    {stats.completed > 0 && <span>Completed: {stats.completed}</span>}
                    {stats.failed > 0 && <span>Failed: {stats.failed}</span>}
                </div>
            </div>

            {/* Queue Items */}
            <div className="max-h-96 overflow-y-auto">
                {queue.map((item) => (
                    <div key={item.id} className="p-4 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {getStatusIcon(item.status)}

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900 truncate">{item.file.name}</p>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                        <span>{formatFileSize(item.file.size)}</span>
                                        <span>{item.file.type}</span>
                                        {item.retryCount > 0 && (
                                            <span className="text-yellow-600">Retry #{item.retryCount}</span>
                                        )}
                                    </div>

                                    {/* Progress Bar */}
                                    {item.status === UPLOAD_STATUS.UPLOADING && (
                                        <div className="mt-2">
                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                <div
                                                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${item.progress}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>Uploading...</span>
                                                <span>{item.progress}%</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {item.status === UPLOAD_STATUS.FAILED && item.error && (
                                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                            {item.error}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 ml-4">
                                {item.status === UPLOAD_STATUS.FAILED && (
                                    <button
                                        onClick={() => retryUpload(item.id)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                        title="Retry upload"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                )}

                                {(item.status === UPLOAD_STATUS.PENDING || item.status === UPLOAD_STATUS.FAILED) && (
                                    <button
                                        onClick={() => cancelUpload(item.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                        title="Cancel upload"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}

                                {(item.status === UPLOAD_STATUS.COMPLETED || item.status === UPLOAD_STATUS.CANCELLED) && (
                                    <button
                                        onClick={() => removeFromQueue(item.id)}
                                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                                        title="Remove from queue"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UploadQueue;
