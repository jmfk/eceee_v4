/**
 * Linked Object Status Component
 * Displays current linked object and provides management actions
 */

import React from 'react';
import {
    Unlink,
    RefreshCw,
    Eye,
    ExternalLink,
    CheckCircle,
    AlertCircle,
    Calendar,
    FileText,
    Users,
    Newspaper
} from 'lucide-react';

const LinkedObjectStatus = ({
    currentPage,
    linking,
    onUnlink,
    onSync,
    onPreview
}) => {
    if (!currentPage?.is_object_page) {
        return (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <div className="text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No object is currently linked to this page.</p>
                    <p className="text-sm mt-1">Select an object from the list below to link it to this page.</p>
                </div>
            </div>
        );
    }

    const getObjectTypeIcon = (type) => {
        const icons = {
            news: Newspaper,
            event: Calendar,
            libraryitem: FileText,
            member: Users,
        };
        const IconComponent = icons[type] || FileText;
        return <IconComponent className="w-5 h-5" />;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    const getObjectUrl = () => {
        if (!currentPage.linked_object_type || !currentPage.linked_object_id) return '#';
        return `/${currentPage.linked_object_type}/${currentPage.linked_object_id}/`;
    };

    return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                            Object Linked Successfully
                        </span>
                    </div>

                    <div className="bg-white rounded-md p-3 border border-green-200">
                        <div className="flex items-start space-x-3">
                            <div className="text-green-600 mt-0.5">
                                {getObjectTypeIcon(currentPage.linked_object_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 mb-1">
                                    {currentPage.title}
                                </h4>
                                {currentPage.description && (
                                    <p className="text-xs text-gray-600 mb-2">
                                        {currentPage.description}
                                    </p>
                                )}
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded capitalize">
                                        {currentPage.linked_object_type}
                                    </span>
                                    <span>ID: {currentPage.linked_object_id}</span>
                                    {currentPage.last_modified && (
                                        <span>Modified: {formatDate(currentPage.last_modified)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-green-200">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => onPreview(currentPage.linked_object_type, currentPage.linked_object_id)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors"
                    >
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                    </button>

                    <a
                        href={getObjectUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Live
                    </a>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={onSync}
                        disabled={linking}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`w-3 h-3 mr-1 ${linking ? 'animate-spin' : ''}`} />
                        {linking ? 'Syncing...' : 'Sync'}
                    </button>

                    <button
                        onClick={onUnlink}
                        disabled={linking}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Unlink className="w-3 h-3 mr-1" />
                        {linking ? 'Unlinking...' : 'Unlink'}
                    </button>
                </div>
            </div>

            {/* Sync Warning */}
            {currentPage.linked_object_type && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-yellow-800">
                            <p className="font-medium">Keep content synchronized</p>
                            <p>Use the "Sync" button to update this page with the latest content from the linked object.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LinkedObjectStatus; 