/**
 * MediaTagReviewStep - Review and approve AI-generated tags for images and files
 * 
 * Features:
 * - Display images with thumbnails and files with icons
 * - Show page tags (mandatory, locked)
 * - Show AI-suggested tags (toggleable green/red pills)
 * - Allow custom tags per media item
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Lock, Plus, X, Check, Image as ImageIcon, Hash, FileText, File, Sparkles } from 'lucide-react';
import { getResolutionBadgeColor } from '../../utils/imageResolution';

const MediaTagReviewStep = ({
    mediaItems,
    pageTags,
    onTagReviewsChange,
}) => {
    const [mediaReviews, setMediaReviews] = useState(() => {
        // Initialize with all AI tags approved (green)
        const initial = {};
        mediaItems.forEach((item, idx) => {
            initial[idx] = {
                approvedTags: new Set(item.aiTags || []),
                customTags: [],
                customTagInput: '',
            };
        });
        return initial;
    });

    // Sync changes to parent whenever mediaReviews changes
    useEffect(() => {
        if (onTagReviewsChange) {
            onTagReviewsChange(mediaReviews);
        }
    }, [mediaReviews, onTagReviewsChange]);

    const handleToggleTag = (mediaIndex, tagName) => {
        setMediaReviews(prev => {
            const updated = { ...prev };
            const mediaReview = { ...updated[mediaIndex] };
            const approved = new Set(mediaReview.approvedTags);

            if (approved.has(tagName)) {
                approved.delete(tagName);
            } else {
                approved.add(tagName);
            }

            mediaReview.approvedTags = approved;
            updated[mediaIndex] = mediaReview;

            return updated;
        });
    };

    const handleAddCustomTag = (mediaIndex) => {
        const input = mediaReviews[mediaIndex]?.customTagInput?.trim();
        if (!input) return;

        setMediaReviews(prev => {
            const updated = { ...prev };
            const mediaReview = { ...updated[mediaIndex] };

            // Check if tag already exists
            if (!mediaReview.customTags.includes(input)) {
                mediaReview.customTags = [...mediaReview.customTags, input];
            }
            mediaReview.customTagInput = '';
            updated[mediaIndex] = mediaReview;

            return updated;
        });
    };

    const handleRemoveCustomTag = (mediaIndex, tagName) => {
        setMediaReviews(prev => {
            const updated = { ...prev };
            const mediaReview = { ...updated[mediaIndex] };
            mediaReview.customTags = mediaReview.customTags.filter(t => t !== tagName);
            updated[mediaIndex] = mediaReview;

            return updated;
        });
    };

    const handleCustomTagInputChange = (mediaIndex, value) => {
        setMediaReviews(prev => {
            const updated = { ...prev };
            const mediaReview = { ...updated[mediaIndex] };
            mediaReview.customTagInput = value;
            updated[mediaIndex] = mediaReview;
            return updated;
        });
    };

    const handleKeyPress = (e, mediaIndex) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCustomTag(mediaIndex);
        }
    };

    // Calculate global tag statistics across all media items
    const globalTagStats = useMemo(() => {
        const aiTagCounts = new Map();
        const customTagCounts = new Map();

        mediaItems.forEach((item, idx) => {
            const review = mediaReviews[idx];
            if (!review) return;

            // Count approved AI tags
            const aiTags = item.aiTags || [];
            aiTags.forEach(tag => {
                if (review.approvedTags.has(tag)) {
                    aiTagCounts.set(tag, (aiTagCounts.get(tag) || 0) + 1);
                }
            });

            // Count custom tags
            review.customTags.forEach(tag => {
                customTagCounts.set(tag, (customTagCounts.get(tag) || 0) + 1);
            });
        });

        return { aiTagCounts, customTagCounts };
    }, [mediaItems, mediaReviews]);

    // Handle removing a tag from all media items
    const handleRemoveGlobalTag = (tagName, tagType) => {
        setMediaReviews(prev => {
            const updated = { ...prev };

            mediaItems.forEach((item, idx) => {
                const mediaReview = { ...updated[idx] };

                if (tagType === 'ai') {
                    // Remove from approved AI tags
                    const approved = new Set(mediaReview.approvedTags);
                    approved.delete(tagName);
                    mediaReview.approvedTags = approved;
                } else if (tagType === 'custom') {
                    // Remove from custom tags
                    mediaReview.customTags = mediaReview.customTags.filter(t => t !== tagName);
                }

                updated[idx] = mediaReview;
            });

            return updated;
        });
    };

    // Get file extension from filename or URL
    const getFileExtension = (item) => {
        const filename = item.filename || item.url || '';
        const match = filename.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : '';
    };

    if (mediaItems.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No images or files found in the selected content.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">
                    Review Media Tags
                </h3>
                <p className="text-sm text-blue-700">
                    Review and approve AI-generated tags for images and files. Page tags (blue, locked) are always included.
                    Click tags to toggle between approved (green) and ignored (red).
                </p>
            </div>

            {/* Global Tag Overview */}
            {(globalTagStats.aiTagCounts.size > 0 || globalTagStats.customTagCounts.size > 0) && (
                <div className="border border-gray-300 rounded-lg bg-gray-50 p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Hash className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">
                            All Tags Across Media
                        </h3>
                        <span className="text-sm text-gray-500">
                            (Remove tags from all items)
                        </span>
                    </div>

                    {/* AI-Suggested Tags */}
                    {globalTagStats.aiTagCounts.size > 0 && (
                        <div className="mb-4">
                            <p className="text-xs text-gray-600 mb-2 font-medium">
                                AI-Suggested Tags ({globalTagStats.aiTagCounts.size})
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(globalTagStats.aiTagCounts.entries())
                                    .sort((a, b) => a[0].localeCompare(b[0])) // Sort alphabetically A-Z
                                    .map(([tag, count]) => (
                                        <div
                                            key={tag}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-800 border border-green-300 group hover:bg-green-200 transition-colors"
                                        >
                                            <span className="text-sm font-medium">{tag}</span>
                                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-green-600 text-white text-xs font-semibold">
                                                {count}
                                            </span>
                                            <button
                                                onClick={() => handleRemoveGlobalTag(tag, 'ai')}
                                                className="ml-0.5 p-0.5 rounded-full hover:bg-green-300 transition-colors"
                                                title={`Remove "${tag}" from all items`}
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Tags */}
                    {globalTagStats.customTagCounts.size > 0 && (
                        <div>
                            <p className="text-xs text-gray-600 mb-2 font-medium">
                                Custom Tags ({globalTagStats.customTagCounts.size})
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(globalTagStats.customTagCounts.entries())
                                    .sort((a, b) => a[0].localeCompare(b[0])) // Sort alphabetically A-Z
                                    .map(([tag, count]) => (
                                        <div
                                            key={tag}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 group hover:bg-purple-200 transition-colors"
                                        >
                                            <span className="text-sm font-medium">{tag}</span>
                                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-purple-600 text-white text-xs font-semibold">
                                                {count}
                                            </span>
                                            <button
                                                onClick={() => handleRemoveGlobalTag(tag, 'custom')}
                                                className="ml-0.5 p-0.5 rounded-full hover:bg-purple-300 transition-colors"
                                                title={`Remove "${tag}" from all items`}
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                {mediaItems.map((item, idx) => {
                    const review = mediaReviews[idx] || { approvedTags: new Set(), customTags: [], customTagInput: '' };
                    const aiTags = item.aiTags || [];
                    const isFile = item.type === 'file';
                    const extension = isFile ? getFileExtension(item) : '';

                    return (
                        <div key={idx} className="border border-gray-300 rounded-lg p-4 bg-white">
                            <div className="flex gap-4">
                                {/* Media Thumbnail/Icon */}
                                <div className="flex-shrink-0">
                                    <div className="relative w-24 h-24 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                                        {isFile ? (
                                            // File icon
                                            <div className="flex flex-col items-center justify-center">
                                                {extension === 'pdf' ? (
                                                    <FileText className="w-12 h-12 text-red-500" />
                                                ) : (
                                                    <File className="w-12 h-12 text-gray-500" />
                                                )}
                                                {extension && (
                                                    <div className="text-xs font-medium text-gray-600 mt-1">
                                                        .{extension}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            // Image thumbnail
                                            <>
                                                {item.src ? (
                                                    <img
                                                        src={item.src}
                                                        alt={item.alt || `Image ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div className="hidden w-full h-full items-center justify-center">
                                                    <ImageIcon className="w-8 h-8 text-gray-400" />
                                                </div>
                                                {/* Resolution Badge */}
                                                {item.resolution && (
                                                    <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-semibold border ${getResolutionBadgeColor(item.resolution.multiplier)}`}
                                                         title={`Resolution: ${item.resolution.multiplier}${item.resolution.dimensions ? ` (${item.resolution.dimensions})` : ''}${item.resolution.source ? ` - ${item.resolution.source}` : ''}`}>
                                                        {item.resolution.multiplier}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 text-center">
                                        {isFile ? `File ${idx + 1}` : `Image ${idx + 1}`}
                                    </p>
                                    {/* Resolution Info Display - Always show for images */}
                                    {!isFile && item.resolution && (
                                        <div className="flex items-center justify-center gap-1 mt-1">
                                            <Sparkles className={`w-3 h-3 ${item.resolution.multiplier === '1x' ? 'text-gray-500' : 'text-blue-600'}`} />
                                            <p className={`text-xs font-medium ${item.resolution.multiplier === '1x' ? 'text-gray-600' : 'text-blue-700'}`}>
                                                {item.resolution.multiplier}
                                                {item.resolution.dimensions && (
                                                    <span className="text-gray-600 ml-1">
                                                        {item.resolution.dimensions}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Tag Management */}
                                <div className="flex-1 space-y-3">
                                    {/* Media Title/Name */}
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">
                                            {item.title || item.alt || item.filename || item.linkText || `${isFile ? 'File' : 'Image'} ${idx + 1}`}
                                        </p>
                                        {item.description && (
                                            <p className="text-xs text-gray-600 mt-1">
                                                {item.description}
                                            </p>
                                        )}
                                        {isFile && item.url && (
                                            <p className="text-xs text-gray-500 mt-1 truncate">
                                                {item.url}
                                            </p>
                                        )}
                                    </div>

                                    {/* Page Tags (Mandatory) */}
                                    {pageTags && pageTags.length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-600 mb-1.5 flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                Page Tags (Required)
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {pageTags.map((tag, tidx) => (
                                                    <span
                                                        key={tidx}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300"
                                                    >
                                                        <Lock className="w-3 h-3" />
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* AI-Suggested Tags (Toggleable) */}
                                    {aiTags.length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-600 mb-1.5">
                                                AI-Suggested Tags (click to toggle)
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {aiTags.map((tag, tidx) => {
                                                    const isApproved = review.approvedTags.has(tag);
                                                    return (
                                                        <button
                                                            key={tidx}
                                                            onClick={() => handleToggleTag(idx, tag)}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${isApproved
                                                                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                                                : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                                                                }`}
                                                        >
                                                            {isApproved ? (
                                                                <Check className="w-3 h-3" />
                                                            ) : (
                                                                <X className="w-3 h-3" />
                                                            )}
                                                            {tag}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Custom Tags */}
                                    {review.customTags.length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-600 mb-1.5">
                                                Custom Tags
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {review.customTags.map((tag, tidx) => (
                                                    <span
                                                        key={tidx}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300"
                                                    >
                                                        {tag}
                                                        <button
                                                            onClick={() => handleRemoveCustomTag(idx, tag)}
                                                            className="hover:text-purple-900"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Add Custom Tag Input */}
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1.5">
                                            Add Custom Tag
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={review.customTagInput || ''}
                                                onChange={(e) => handleCustomTagInputChange(idx, e.target.value)}
                                                onKeyPress={(e) => handleKeyPress(e, idx)}
                                                placeholder="Enter tag name"
                                                className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                            <button
                                                onClick={() => handleAddCustomTag(idx)}
                                                disabled={!review.customTagInput?.trim()}
                                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MediaTagReviewStep;

