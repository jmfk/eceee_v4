/**
 * SimplifiedApprovalForm Component
 * 
 * Lightweight inline approval form for pending media files.
 * Shows minimal required fields: title and tags.
 * Used in WYSIWYG media upload workflow.
 */

import React, { useState, useEffect } from 'react';
import {
    Check,
    X,
    Loader2,
    AlertCircle,
    CheckCircle,
    Sparkles,
    Image as ImageIcon
} from 'lucide-react';
import { mediaApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import MediaTagWidget from './MediaTagWidget';
import OptimizedImage from './OptimizedImage';

const SimplifiedApprovalForm = ({
    pendingFiles,
    namespace,
    onComplete,
    onCancel
}) => {
    const [fileApprovals, setFileApprovals] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [processing, setProcessing] = useState(false);

    const { addNotification } = useGlobalNotifications();

    // Initialize approval data for each file
    useEffect(() => {
        const initialApprovals = {};
        pendingFiles.forEach(file => {
            // Extract AI suggestions or use defaults
            const aiTitle = file.aiSuggestions?.title || file.aiSuggestedTitle;
            const aiTags = file.aiSuggestions?.tags || file.aiGeneratedTags || [];

            initialApprovals[file.id] = {
                title: aiTitle || file.originalFilename?.replace(/\.[^/.]+$/, '') || '',
                tags: Array.isArray(aiTags) ? aiTags.map(tag => ({ name: tag })) : [],
                approved: true // Default to approved
            };
        });
        setFileApprovals(initialApprovals);
    }, [pendingFiles]);

    // Validate a specific file's data
    const validateFile = (fileId) => {
        const approval = fileApprovals[fileId];
        const errors = {};

        if (!approval) {
            return { hasErrors: true, errors: { general: 'Approval data missing' } };
        }

        // Title validation
        if (!approval.title || approval.title.trim().length === 0) {
            errors.title = 'Title is required';
        } else if (approval.title.length > 255) {
            errors.title = 'Title must be less than 255 characters';
        }

        // Tags validation
        if (!approval.tags || approval.tags.length === 0) {
            errors.tags = 'At least one tag is required';
        }

        return {
            hasErrors: Object.keys(errors).length > 0,
            errors
        };
    };

    // Update approval data for a file
    const updateApproval = (fileId, field, value) => {
        setFileApprovals(prev => ({
            ...prev,
            [fileId]: {
                ...prev[fileId],
                [field]: value
            }
        }));

        // Clear validation errors for this field
        if (validationErrors[fileId]) {
            setValidationErrors(prev => {
                const fileErrors = { ...prev[fileId] };
                delete fileErrors[field];
                return {
                    ...prev,
                    [fileId]: fileErrors
                };
            });
        }
    };

    // Handle approval submission
    const handleApprove = async () => {
        // Validate all files
        const allErrors = {};
        let hasAnyErrors = false;

        pendingFiles.forEach(file => {
            const validation = validateFile(file.id);
            if (validation.hasErrors) {
                allErrors[file.id] = validation.errors;
                hasAnyErrors = true;
            }
        });

        if (hasAnyErrors) {
            setValidationErrors(allErrors);
            addNotification('Please fix validation errors before approving', 'error');
            return;
        }

        setProcessing(true);

        try {
            // Prepare bulk approval data
            const approvals = pendingFiles.map(file => {
                const approval = fileApprovals[file.id];

                // Convert tags to tag names or IDs
                const tagIds = approval.tags.map(tag => {
                    // If tag has an id, use it; otherwise use the name
                    return tag.id || tag.name;
                });

                return {
                    fileId: file.id,
                    title: approval.title.trim(),
                    tagIds: tagIds,
                    description: '',
                    accessLevel: 'public'
                };
            });

            // Use bulk approve API if multiple files, otherwise approve individually
            if (approvals.length > 1) {
                // Use bulk approve endpoint
                const result = await mediaApi.pendingFiles.bulkApprove(approvals)();

                addNotification(
                    `${approvals.length} file(s) approved successfully`,
                    'success'
                );

                // Call onComplete with results
                if (onComplete) {
                    onComplete(result.results || approvals);
                }
            } else if (approvals.length === 1) {
                // Single file approval
                const approval = approvals[0];
                const result = await mediaApi.pendingFiles.approve(
                    approval.fileId,
                    {
                        title: approval.title,
                        tagIds: approval.tagIds,
                        description: approval.description,
                        accessLevel: approval.accessLevel
                    }
                )();

                addNotification('File approved successfully', 'success');

                // Call onComplete with result
                if (onComplete) {
                    onComplete([{ mediaFile: result.mediaFile || result.media_file }]);
                }
            }
        } catch (error) {
            console.error('Approval error:', error);

            // Handle error response
            const errorMessage = error.context?.data?.error ||
                error.message ||
                'Failed to approve files';

            addNotification(errorMessage, 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Handle cancel
    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
    };

    // Render preview thumbnail for a file
    const renderThumbnail = (file) => {
        const previewUrl = file.fileUrl || `/api/v1/media/pending/${file.id}/preview/`;

        if (file.fileType === 'image') {
            return (
                <OptimizedImage
                    src={previewUrl}
                    alt={file.originalFilename}
                    width={80}
                    height={80}
                    className="w-20 h-20 object-cover rounded"
                    fallback={
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded">
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                        </div>
                    }
                />
            );
        }

        return (
            <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded">
                <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                        Approve Uploaded Files
                    </h3>
                </div>
                <div className="text-sm text-gray-600">
                    {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} pending
                </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                    Please provide a title and at least one tag for each file before approving.
                </p>
            </div>

            {/* File List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {pendingFiles.map((file) => {
                    const approval = fileApprovals[file.id] || {};
                    const errors = validationErrors[file.id] || {};

                    return (
                        <div
                            key={file.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
                        >
                            {/* File Preview and Name */}
                            <div className="flex items-start gap-3">
                                {renderThumbnail(file)}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">
                                        {file.originalFilename}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {file.fileType} • {(file.fileSize / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>

                            {/* Title Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={approval.title || ''}
                                    onChange={(e) => updateApproval(file.id, 'title', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title
                                            ? 'border-red-300 bg-red-50'
                                            : 'border-gray-300'
                                        }`}
                                    placeholder="Enter file title"
                                    disabled={processing}
                                />
                                {errors.title && (
                                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        {errors.title}
                                    </p>
                                )}
                            </div>

                            {/* Tags Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tags <span className="text-red-500">*</span>
                                </label>
                                <MediaTagWidget
                                    tags={approval.tags || []}
                                    onChange={(newTags) => updateApproval(file.id, 'tags', newTags)}
                                    namespace={namespace}
                                    disabled={processing}
                                />
                                {errors.tags && (
                                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        {errors.tags}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    disabled={processing}
                >
                    <X className="w-4 h-4" />
                    Cancel
                </button>
                <button
                    onClick={handleApprove}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    disabled={processing}
                >
                    {processing ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Approving...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-4 h-4" />
                            Approve {pendingFiles.length > 1 ? `${pendingFiles.length} Files` : 'File'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SimplifiedApprovalForm;

