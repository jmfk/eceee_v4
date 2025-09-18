/**
 * MediaReferencesDisplay Component
 * 
 * Displays reference information for a media file, including:
 * - Reference count
 * - Last referenced date
 * - List of content that references this file
 */

import React, { useState, useEffect } from 'react';
import { Link, ExternalLink, Clock, Hash } from 'lucide-react';
import { mediaApi } from '../../api';

const MediaReferencesDisplay = ({ fileId }) => {
    const [references, setReferences] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadReferences = async () => {
            if (!fileId) return;

            setLoading(true);
            setError(null);

            try {
                const result = await mediaApi.files.references(fileId);
                setReferences(result);
            } catch (error) {
                console.error('Failed to load references:', error);
                setError('Failed to load reference information');
            } finally {
                setLoading(false);
            }
        };

        loadReferences();
    }, [fileId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-500 text-sm p-4">
                {error}
            </div>
        );
    }

    if (!references) {
        return null;
    }

    const { reference_count, last_referenced, references: referenceList } = references;

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString();
    };

    const getContentTypeLabel = (type) => {
        const labels = {
            webpage: 'Web Page',
            widget: 'Widget',
            content: 'Content Block'
        };
        return labels[type] || type;
    };

    return (
        <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Hash className="w-4 h-4" />
                        <span className="text-sm font-medium">Reference Count</span>
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">
                        {reference_count}
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Last Referenced</span>
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">
                        {formatDate(last_referenced)}
                    </div>
                </div>
            </div>

            {/* Reference List */}
            {Object.entries(referenceList).map(([contentType, ids]) => (
                <div key={contentType} className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <Link className="w-4 h-4" />
                        {getContentTypeLabel(contentType)}
                    </h3>
                    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                        {ids.map((id) => (
                            <div key={id} className="p-3 flex items-center justify-between">
                                <span className="text-sm text-gray-600">{id}</span>
                                <a
                                    href={`/admin/${contentType}/${id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                                >
                                    <span>View</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* No References Message */}
            {reference_count === 0 && (
                <div className="text-center py-6 text-gray-500">
                    This file is not referenced in any content
                </div>
            )}
        </div>
    );
};

export default MediaReferencesDisplay;
