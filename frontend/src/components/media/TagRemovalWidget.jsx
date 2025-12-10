import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * TagRemovalWidget - Shows tags from selected files as removable pills
 * 
 * This widget displays all unique tags from the selected files as pill-shaped buttons.
 * Users can click the X on any pill to remove that tag from all selected files.
 * The remaining tags will be kept on the files.
 */
const TagRemovalWidget = ({
    selectedFiles,
    namespace,
    onTagsToRemoveChange,
    className = ""
}) => {
    const [allTags, setAllTags] = useState([]);
    const [tagsToRemove, setTagsToRemove] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Extract tags from selected files (files are already loaded objects)
    useEffect(() => {
        const extractFileTags = () => {
            if (!selectedFiles || selectedFiles.length === 0) {
                setAllTags([]);
                setTagsToRemove([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Collect all unique tags from all files
                const tagMap = new Map();

                selectedFiles.forEach(file => {
                    if (file.tags && Array.isArray(file.tags)) {
                        file.tags.forEach(tag => {
                            if (!tagMap.has(tag.name)) {
                                tagMap.set(tag.name, {
                                    name: tag.name,
                                    id: tag.id,
                                    fileCount: 1
                                });
                            } else {
                                tagMap.get(tag.name).fileCount++;
                            }
                        });
                    }
                });

                const uniqueTags = Array.from(tagMap.values());
                setAllTags(uniqueTags);
                setTagsToRemove([]); // Reset removed tags when files change

            } catch (err) {
                console.error('Error processing file tags:', err);
                setError('Failed to process tags from selected files');
            } finally {
                setLoading(false);
            }
        };

        extractFileTags();
    }, [selectedFiles]);

    // Notify parent component when tags to remove change
    useEffect(() => {
        onTagsToRemoveChange(tagsToRemove);
    }, [tagsToRemove, onTagsToRemoveChange]);

    const handleRemoveTag = (tagName) => {
        setTagsToRemove(prev => {
            if (prev.includes(tagName)) {
                // Tag is already marked for removal, unmark it (keep the tag)
                return prev.filter(t => t !== tagName);
            } else {
                // Mark tag for removal
                return [...prev, tagName];
            }
        });
    };

    const getRemainingTags = () => {
        return allTags.filter(tag => !tagsToRemove.includes(tag.name));
    };

    const getTagsToRemoveList = () => {
        return allTags.filter(tag => tagsToRemove.includes(tag.name));
    };

    if (loading) {
        return (
            <div className={`p-4 bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-lg ${className}`}>
                <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    <span className="text-sm text-indigo-700">Loading tags...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`p-4 bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg ${className}`}>
                <div className="text-sm text-red-700">{error}</div>
            </div>
        );
    }

    if (allTags.length === 0) {
        return (
            <div className={`p-4 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg ${className}`}>
                <div className="text-sm text-gray-600">
                    {selectedFiles.length === 0
                        ? 'No files selected'
                        : 'Selected files have no tags to remove'
                    }
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Instructions */}
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-indigo-800 font-medium">
                    Click on tags below to remove them from all selected files
                </div>
                <div className="text-xs text-indigo-600 mt-1">
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected • {allTags.length} unique tag{allTags.length !== 1 ? 's' : ''} found
                </div>
            </div>

            {/* Tags that will remain (kept tags) */}
            {getRemainingTags().length > 0 && (
                <div className="space-y-2">
                    <div className="text-sm font-semibold text-green-800" role="heading" aria-level="4">
                        Tags to Keep ({getRemainingTags().length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {getRemainingTags().map((tag) => (
                            <button
                                key={tag.name}
                                onClick={() => handleRemoveTag(tag.name)}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200 hover:from-green-200 hover:to-emerald-200 hover:border-green-300 transition-all duration-200 cursor-pointer group"
                                title={`Click to remove "${tag.name}" from ${tag.fileCount} file${tag.fileCount !== 1 ? 's' : ''}`}
                            >
                                <span>{tag.name}</span>
                                <span className="ml-1 text-xs text-green-600">({tag.fileCount})</span>
                                <X className="ml-1 h-3 w-3 text-green-600 group-hover:text-green-800 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tags that will be removed */}
            {getTagsToRemoveList().length > 0 && (
                <div className="space-y-2">
                    <div className="text-sm font-semibold text-red-800" role="heading" aria-level="4">
                        Tags to Remove ({getTagsToRemoveList().length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {getTagsToRemoveList().map((tag) => (
                            <button
                                key={tag.name}
                                onClick={() => handleRemoveTag(tag.name)}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-red-100 to-pink-100 text-red-800 border border-red-200 hover:from-red-200 hover:to-pink-200 hover:border-red-300 transition-all duration-200 cursor-pointer group line-through"
                                title={`Click to keep "${tag.name}" on ${tag.fileCount} file${tag.fileCount !== 1 ? 's' : ''}`}
                            >
                                <span>{tag.name}</span>
                                <span className="ml-1 text-xs text-red-600">({tag.fileCount})</span>
                                <X className="ml-1 h-3 w-3 text-red-600 group-hover:text-red-800 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">
                        <span className="font-medium text-green-700">{getRemainingTags().length}</span> tags will be kept
                    </span>
                    <span className="text-gray-700">
                        <span className="font-medium text-red-700">{getTagsToRemoveList().length}</span> tags will be removed
                    </span>
                </div>
            </div>
        </div>
    );
};

export default TagRemovalWidget;
