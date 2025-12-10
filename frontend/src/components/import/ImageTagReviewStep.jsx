/**
 * ImageTagReviewStep - Review and approve AI-generated tags for each image
 * 
 * Features:
 * - Display images with thumbnails
 * - Show page tags (mandatory, locked)
 * - Show AI-suggested tags (toggleable green/red pills)
 * - Allow custom tags per image
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Lock, Plus, X, Check, Image as ImageIcon, Hash } from 'lucide-react';

const ImageTagReviewStep = ({
    images,
    pageTags,
    onTagReviewsChange,
}) => {
    const [imageReviews, setImageReviews] = useState(() => {
        // Initialize with all AI tags approved (green)
        const initial = {};
        images.forEach((img, idx) => {
            initial[idx] = {
                approvedTags: new Set(img.aiTags || []),
                customTags: [],
                customTagInput: '',
            };
        });
        return initial;
    });

    // Sync initial state to parent on mount
    useEffect(() => {
        if (onTagReviewsChange) {
            onTagReviewsChange(imageReviews);
        }
    }, []); // Empty deps - only run on mount

    const handleToggleTag = (imageIndex, tagName) => {
        setImageReviews(prev => {
            const updated = { ...prev };
            const imgReview = { ...updated[imageIndex] };
            const approved = new Set(imgReview.approvedTags);

            if (approved.has(tagName)) {
                approved.delete(tagName);
            } else {
                approved.add(tagName);
            }

            imgReview.approvedTags = approved;
            updated[imageIndex] = imgReview;

            // Notify parent
            if (onTagReviewsChange) {
                onTagReviewsChange(updated);
            }

            return updated;
        });
    };

    const handleAddCustomTag = (imageIndex) => {
        const input = imageReviews[imageIndex]?.customTagInput?.trim();
        if (!input) return;

        setImageReviews(prev => {
            const updated = { ...prev };
            const imgReview = { ...updated[imageIndex] };

            // Check if tag already exists
            if (!imgReview.customTags.includes(input)) {
                imgReview.customTags = [...imgReview.customTags, input];
            }
            imgReview.customTagInput = '';
            updated[imageIndex] = imgReview;

            // Notify parent
            if (onTagReviewsChange) {
                onTagReviewsChange(updated);
            }

            return updated;
        });
    };

    const handleRemoveCustomTag = (imageIndex, tagName) => {
        setImageReviews(prev => {
            const updated = { ...prev };
            const imgReview = { ...updated[imageIndex] };
            imgReview.customTags = imgReview.customTags.filter(t => t !== tagName);
            updated[imageIndex] = imgReview;

            // Notify parent
            if (onTagReviewsChange) {
                onTagReviewsChange(updated);
            }

            return updated;
        });
    };

    const handleCustomTagInputChange = (imageIndex, value) => {
        setImageReviews(prev => {
            const updated = { ...prev };
            const imgReview = { ...updated[imageIndex] };
            imgReview.customTagInput = value;
            updated[imageIndex] = imgReview;
            return updated;
        });
    };

    const handleKeyPress = (e, imageIndex) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCustomTag(imageIndex);
        }
    };

    // Calculate global tag statistics across all images
    const globalTagStats = useMemo(() => {
        const aiTagCounts = new Map();
        const customTagCounts = new Map();

        images.forEach((image, idx) => {
            const review = imageReviews[idx];
            if (!review) return;

            // Count approved AI tags
            const aiTags = image.aiTags || [];
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
    }, [images, imageReviews]);

    // Handle removing a tag from all images
    const handleRemoveGlobalTag = (tagName, tagType) => {
        setImageReviews(prev => {
            const updated = { ...prev };

            images.forEach((image, idx) => {
                const imgReview = { ...updated[idx] };

                if (tagType === 'ai') {
                    // Remove from approved AI tags
                    const approved = new Set(imgReview.approvedTags);
                    approved.delete(tagName);
                    imgReview.approvedTags = approved;
                } else if (tagType === 'custom') {
                    // Remove from custom tags
                    imgReview.customTags = imgReview.customTags.filter(t => t !== tagName);
                }

                updated[idx] = imgReview;
            });

            // Notify parent
            if (onTagReviewsChange) {
                onTagReviewsChange(updated);
            }

            return updated;
        });
    };

    if (images.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No images found in the selected content.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="font-semibold text-blue-900 mb-2" role="heading" aria-level="3">
                    Review Image Tags
                </div>
                <div className="text-sm text-blue-700">
                    Review and approve AI-generated tags for each image. Page tags (blue, locked) are always included.
                    Click tags to toggle between approved (green) and ignored (red).
                </div>
            </div>

            {/* Global Tag Overview */}
            {(globalTagStats.aiTagCounts.size > 0 || globalTagStats.customTagCounts.size > 0) && (
                <div className="border border-gray-300 rounded-lg bg-gray-50 p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Hash className="w-5 h-5 text-gray-600" />
                        <div className="font-semibold text-gray-900" role="heading" aria-level="3">
                            All Tags Across Images
                        </div>
                        <span className="text-sm text-gray-500">
                            (Remove tags from all images)
                        </span>
                    </div>

                    {/* AI-Suggested Tags */}
                    {globalTagStats.aiTagCounts.size > 0 && (
                        <div className="mb-4">
                            <div className="text-xs text-gray-600 mb-2 font-medium">
                                AI-Suggested Tags ({globalTagStats.aiTagCounts.size})
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(globalTagStats.aiTagCounts.entries())
                                    .sort((a, b) => b[1] - a[1]) // Sort by count descending
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
                                                title={`Remove "${tag}" from all images`}
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
                            <div className="text-xs text-gray-600 mb-2 font-medium">
                                Custom Tags ({globalTagStats.customTagCounts.size})
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(globalTagStats.customTagCounts.entries())
                                    .sort((a, b) => b[1] - a[1]) // Sort by count descending
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
                                                title={`Remove "${tag}" from all images`}
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
                {images.map((image, idx) => {
                    const review = imageReviews[idx] || { approvedTags: new Set(), customTags: [], customTagInput: '' };
                    const aiTags = image.aiTags || [];

                    return (
                        <div key={idx} className="border border-gray-300 rounded-lg p-4 bg-white">
                            <div className="flex gap-4">
                                {/* Image Thumbnail */}
                                <div className="flex-shrink-0">
                                    <div className="w-24 h-24 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                                        {image.src ? (
                                            <img
                                                src={image.src}
                                                alt={image.alt || `Image ${idx + 1}`}
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
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 text-center">
                                        Image {idx + 1}
                                    </div>
                                </div>

                                {/* Tag Management */}
                                <div className="flex-1 space-y-3">
                                    {/* Image Title/Alt */}
                                    <div>
                                        <div className="font-medium text-gray-900 text-sm">
                                            {image.title || image.alt || image.filename || `Image ${idx + 1}`}
                                        </div>
                                        {image.description && (
                                            <div className="text-xs text-gray-600 mt-1">
                                                {image.description}
                                            </div>
                                        )}
                                    </div>

                                    {/* Page Tags (Mandatory) */}
                                    {pageTags && pageTags.length > 0 && (
                                        <div>
                                            <div className="text-xs text-gray-600 mb-1.5 flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                Page Tags (Required)
                                            </div>
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
                                            <div className="text-xs text-gray-600 mb-1.5">
                                                AI-Suggested Tags (click to toggle)
                                            </div>
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
                                            <div className="text-xs text-gray-600 mb-1.5">
                                                Custom Tags
                                            </div>
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
                                        <div className="text-xs text-gray-600 mb-1.5">
                                            Add Custom Tag
                                        </div>
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

export default ImageTagReviewStep;

