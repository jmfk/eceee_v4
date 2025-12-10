/**
 * MediaApprovalForm Component
 * 
 * Approval interface for uploaded files awaiting review.
 * Allows users to review, edit metadata, and approve/reject pending files.
 */

import React, { useState, useEffect } from 'react';
import {
    Save,
    X,
    Check,
    Trash2,
    Lightbulb,
    RefreshCw,
    Plus,
    Sparkles,
    AlertCircle,
    CheckCircle,
    Tag,
    FileText,
    Hash,
    Eye,
    EyeOff,
    Clock,
    Upload
} from 'lucide-react';
import { mediaApi, mediaTagsApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';

const MediaApprovalForm = ({
    pendingFiles,
    namespace,
    onComplete,
    onCancel
}) => {
    const [fileApprovals, setFileApprovals] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [availableTags, setAvailableTags] = useState([]);
    const [showAdvanced, setShowAdvanced] = useState({});
    const [slugValidation, setSlugValidation] = useState({});
    const [slugValidating, setSlugValidating] = useState({});

    const { addNotification } = useGlobalNotifications();

    // Initialize approval data for each file
    useEffect(() => {
        const initialApprovals = {};
        pendingFiles.forEach(file => {
            initialApprovals[file.id] = {
                title: file.aiSuggestions?.title || file.originalFilename?.replace(/\.[^/.]+$/, '') || '',
                description: '',
                tags: file.aiSuggestions?.tags ? file.aiSuggestions.tags.join(', ') : '',
                accessLevel: 'public',
                slug: '',
                approved: true // Default to approved
            };
        });
        setFileApprovals(initialApprovals);
    }, [pendingFiles]);

    // Load available tags for suggestions
    useEffect(() => {
        const loadTags = async () => {
            try {
                const result = await mediaTagsApi.list({ namespace });
                setAvailableTags(result.results || result || []);
            } catch (error) {
                console.error('Failed to load tags:', error);
            }
        };
        if (namespace) {
            loadTags();
        }
    }, [namespace]);

    // Validation rules
    const validateField = (fileId, field, value) => {
        const errors = { ...validationErrors };
        const fileErrors = errors[fileId] || {};

        switch (field) {
            case 'title':
                if (!value || value.trim().length === 0) {
                    fileErrors.title = 'Title is required';
                } else if (value.length > 255) {
                    fileErrors.title = 'Title must be less than 255 characters';
                } else {
                    delete fileErrors.title;
                }
                break;

            case 'description':
                if (value && value.length > 1000) {
                    fileErrors.description = 'Description must be less than 1000 characters';
                } else {
                    delete fileErrors.description;
                }
                break;

            case 'tags':
                if (!value || value.trim().length === 0) {
                    fileErrors.tags = 'At least one tag is required';
                } else {
                    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
                    if (tags.length === 0) {
                        fileErrors.tags = 'At least one tag is required';
                    } else {
                        const invalidTags = tags.filter(tag => tag.length > 50);
                        if (invalidTags.length > 0) {
                            fileErrors.tags = 'Each tag must be less than 50 characters';
                        } else {
                            delete fileErrors.tags;
                        }
                    }
                }
                break;

            case 'slug':
                if (value) {
                    const slugPattern = /^[a-z0-9-]+$/;
                    if (!slugPattern.test(value)) {
                        fileErrors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
                    } else if (value.length > 255) {
                        fileErrors.slug = 'Slug must be less than 255 characters';
                    } else {
                        delete fileErrors.slug;
                    }
                } else {
                    delete fileErrors.slug;
                }
                break;

            default:
                break;
        }

        if (Object.keys(fileErrors).length === 0) {
            delete errors[fileId];
        } else {
            errors[fileId] = fileErrors;
        }

        setValidationErrors(errors);
        return Object.keys(fileErrors).length === 0;
    };

    // Debounced slug validation
    const validateSlugAsync = async (fileId, slug) => {
        if (!slug || !namespace) return;

        setSlugValidating(prev => ({ ...prev, [fileId]: true }));

        try {
            const response = await fetch('/api/media/validate-slug/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    slug: slug,
                    namespace: namespace
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSlugValidation(prev => ({
                    ...prev,
                    [fileId]: {
                        isValid: data.isValid,
                        message: data.message,
                        suggestion: data.isValid ? null : data.slug
                    }
                }));
            }
        } catch (error) {
            console.error('Slug validation error:', error);
        } finally {
            setSlugValidating(prev => ({ ...prev, [fileId]: false }));
        }
    };

    // Helper to generate slug from title
    const generateSlugFromTitle = (title) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    };

    // Update approval data with validation
    const updateFileApproval = (fileId, field, value) => {
        setFileApprovals(prev => ({
            ...prev,
            [fileId]: {
                ...prev[fileId],
                [field]: value
            }
        }));

        // Auto-generate slug from title if title is being updated and slug is empty
        if (field === 'title' && value && (!fileApprovals[fileId]?.slug || fileApprovals[fileId].slug === '')) {
            const slug = generateSlugFromTitle(value);

            setFileApprovals(prev => ({
                ...prev,
                [fileId]: {
                    ...prev[fileId],
                    slug: slug
                }
            }));
            validateField(fileId, 'slug', slug);
            
            // Debounced slug validation
            if (window.slugValidationTimeout) {
                clearTimeout(window.slugValidationTimeout);
            }
            window.slugValidationTimeout = setTimeout(() => {
                validateSlugAsync(fileId, slug);
            }, 300);
        }

        // Validate slug in real-time
        if (field === 'slug' && value) {
            if (window.slugValidationTimeout) {
                clearTimeout(window.slugValidationTimeout);
            }
            window.slugValidationTimeout = setTimeout(() => {
                validateSlugAsync(fileId, value);
            }, 300);
        }

        validateField(fileId, field, value);
    };

    // Apply AI suggestion
    const applyAISuggestion = (fileId, field, value) => {
        updateFileApproval(fileId, field, value);
        addNotification(`Applied AI suggestion for ${field}`, 'success');
    };

    // Tag helpers
    const addTag = (fileId, tag) => {
        const currentTags = fileApprovals[fileId]?.tags || '';
        const tags = currentTags ? currentTags.split(',').map(t => t.trim()) : [];

        if (!tags.includes(tag)) {
            const newTags = [...tags, tag].join(', ');
            updateFileApproval(fileId, 'tags', newTags);
        }
    };

    const removeTag = (fileId, tagToRemove) => {
        const currentTags = fileApprovals[fileId]?.tags || '';
        const tags = currentTags.split(',').map(t => t.trim()).filter(t => t && t !== tagToRemove);
        updateFileApproval(fileId, 'tags', tags.join(', '));
    };

    // Toggle file approval status
    const toggleFileApproval = (fileId) => {
        setFileApprovals(prev => ({
            ...prev,
            [fileId]: {
                ...prev[fileId],
                approved: !prev[fileId].approved
            }
        }));
    };

    // Process approvals
    const processApprovals = async () => {
        // Validate all approved files
        let hasErrors = false;
        Object.keys(fileApprovals).forEach(fileId => {
            const approval = fileApprovals[fileId];
            if (approval.approved) {
                Object.keys(approval).forEach(field => {
                    if (!validateField(fileId, field, approval[field])) {
                        hasErrors = true;
                    }
                });
            }
        });

        if (hasErrors) {
            addNotification('Please fix validation errors before proceeding', 'error');
            return;
        }

        setProcessing(true);
        try {
            // Prepare approvals for approved files
            const approvals = [];
            const rejections = [];

            Object.entries(fileApprovals).forEach(([fileId, approval]) => {
                if (approval.approved) {
                    // Convert tags string to tag names/IDs (backend expects array of strings)
                    const tagNames = approval.tags ?
                        approval.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

                    // Send tag names - backend will handle creation/lookup
                    approvals.push({
                        pendingFileId: fileId,
                        title: approval.title,
                        slug: approval.slug,
                        description: approval.description,
                        tagIds: tagNames,
                        accessLevel: approval.accessLevel
                    });
                } else {
                    rejections.push(fileId);
                }
            });

            // Process bulk operations
            const results = [];

            if (approvals.length > 0) {
                try {
                    const approvalResult = await mediaApi.pendingFiles.bulkApprove(approvals);
                    results.push({ type: 'approvals', result: approvalResult });
                } catch (error) {
                    console.error('Bulk approval failed:', error);
                    addNotification('Some files failed to be approved', 'error');
                }
            }

            if (rejections.length > 0) {
                try {
                    const rejectionResult = await mediaApi.pendingFiles.bulkReject(rejections);
                    results.push({ type: 'rejections', result: rejectionResult });
                } catch (error) {
                    console.error('Bulk rejection failed:', error);
                    addNotification('Some files failed to be rejected', 'error');
                }
            }

            // Calculate totals
            const totalApproved = approvals.length;
            const totalRejected = rejections.length;

            if (totalApproved > 0) {
                addNotification(`${totalApproved} files approved successfully`, 'success');
            }
            if (totalRejected > 0) {
                addNotification(`${totalRejected} files rejected`, 'info');
            }

            onComplete(results);

        } catch (error) {
            console.error('Failed to process approvals:', error);
            addNotification('Failed to process file approvals', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Check if form is valid
    const isFormValid = () => {
        const approvedFiles = Object.entries(fileApprovals).filter(([_, approval]) => approval.approved);
        return Object.keys(validationErrors).length === 0 &&
            approvedFiles.every(([_, approval]) => approval.title && approval.title.trim());
    };

    // File size formatter
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Get approval counts
    const approvalCounts = Object.values(fileApprovals).reduce((acc, approval) => {
        if (approval.approved) acc.approved++;
        else acc.rejected++;
        return acc;
    }, { approved: 0, rejected: 0 });

    return (
        <div className="p-8">
            <div className="mb-6">
                <div className="text-xl font-semibold text-gray-900 mb-2" role="heading" aria-level="3">
                    Review and Approve Uploaded Files
                </div>
                <div className="text-gray-600">
                    Review the uploaded files below. You can edit metadata and choose to approve or reject each file.
                </div>
                <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        {approvalCounts.approved} to approve
                    </span>
                    <span className="flex items-center gap-2 text-red-600">
                        <X className="w-4 h-4" />
                        {approvalCounts.rejected} to reject
                    </span>
                </div>
            </div>

            <div className="space-y-6">
                {pendingFiles.map((file) => {
                    const currentApproval = fileApprovals[file.id] || {};
                    const suggestions = file.aiSuggestions;
                    const fileErrors = validationErrors[file.id] || {};
                    const isAdvancedVisible = showAdvanced[file.id];
                    const isApproved = currentApproval.approved;

                    return (
                        <div key={file.id} className={`border rounded-lg p-6 transition-all ${isApproved ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                            }`}>
                            {/* File Header */}
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                                <div className="flex-1 min-w-0">
                                    <div className="text-lg font-medium text-gray-900 truncate" role="heading" aria-level="4">
                                        {file.originalFilename}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                        <span className="capitalize">{file.fileType}</span>
                                        <span>{formatFileSize(file.fileSize)}</span>
                                        {file.width && file.height && (
                                            <span>{file.width} × {file.height}</span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Uploaded {new Date(file.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Approval Toggle */}
                                    <button
                                        type="button"
                                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${isApproved
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'bg-red-600 text-white hover:bg-red-700'
                                            }`}
                                        onClick={() => toggleFileApproval(file.id)}
                                    >
                                        {isApproved ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Approve
                                            </>
                                        ) : (
                                            <>
                                                <X className="w-4 h-4" />
                                                Reject
                                            </>
                                        )}
                                    </button>

                                    {/* Advanced Toggle */}
                                    {isApproved && (
                                        <button
                                            type="button"
                                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                                            onClick={() => setShowAdvanced(prev => ({ ...prev, [file.id]: !prev[file.id] }))}
                                        >
                                            {isAdvancedVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            {isAdvancedVisible ? 'Hide Advanced' : 'Show Advanced'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Approval Form - Only show if approved */}
                            {isApproved && (
                                <>
                                    {/* Title Field (Required) */}
                                    <div className="mb-4">
                                        <label htmlFor={`title-${file.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                                            Title <span className="text-red-500">*</span>
                                        </label>
                                        <div className="space-y-2">
                                            <input
                                                id={`title-${file.id}`}
                                                type="text"
                                                value={currentApproval.title || ''}
                                                onChange={(e) => updateFileApproval(file.id, 'title', e.target.value)}
                                                placeholder="Enter file title (required)"
                                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fileErrors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                                    }`}
                                                required
                                            />
                                            {fileErrors.title && (
                                                <div className="flex items-center gap-2 text-sm text-red-600">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {fileErrors.title}
                                                </div>
                                            )}
                                            {suggestions?.title && (
                                                <button
                                                    type="button"
                                                    className="flex items-center gap-2 px-3 py-1 text-sm bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-md hover:bg-yellow-100 transition-colors"
                                                    onClick={() => applyAISuggestion(file.id, 'title', suggestions.title)}
                                                    title="Apply AI suggestion"
                                                >
                                                    <Lightbulb className="w-3 h-3" />
                                                    {suggestions.title}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tags Field */}
                                    <div className="mb-4">
                                        <label htmlFor={`tags-${file.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                                            Tags <span className="text-red-500">*</span>
                                        </label>
                                        <div className="space-y-2">
                                            <input
                                                id={`tags-${file.id}`}
                                                type="text"
                                                value={currentApproval.tags || ''}
                                                onChange={(e) => updateFileApproval(file.id, 'tags', e.target.value)}
                                                placeholder="Enter tags (comma-separated, required)"
                                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fileErrors.tags ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                                    }`}
                                            />
                                            {fileErrors.tags && (
                                                <div className="flex items-center gap-2 text-sm text-red-600">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {fileErrors.tags}
                                                </div>
                                            )}

                                            {/* Current Tags */}
                                            {currentApproval.tags && (
                                                <div className="flex flex-wrap gap-2">
                                                    {currentApproval.tags.split(',').map(tag => tag.trim()).filter(tag => tag).map((tag, index) => (
                                                        <span
                                                            key={index}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                                                        >
                                                            <Tag className="w-3 h-3" />
                                                            {tag}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeTag(file.id, tag)}
                                                                className="ml-1 hover:text-red-600"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* AI Suggested Tags */}
                                            {suggestions?.tags && suggestions.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    <span className="text-xs text-gray-600">Suggested:</span>
                                                    {suggestions.tags.map((tag, index) => (
                                                        <button
                                                            key={index}
                                                            type="button"
                                                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full hover:bg-green-100 transition-colors"
                                                            onClick={() => addTag(file.id, tag)}
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Advanced Fields */}
                                    {isAdvancedVisible && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            {/* Description */}
                                            <div>
                                                <label htmlFor={`description-${file.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                                                    Description
                                                </label>
                                                <textarea
                                                    id={`description-${file.id}`}
                                                    value={currentApproval.description || ''}
                                                    onChange={(e) => updateFileApproval(file.id, 'description', e.target.value)}
                                                    placeholder="Enter file description (optional)"
                                                    rows={3}
                                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fileErrors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                                        }`}
                                                />
                                                {fileErrors.description && (
                                                    <div className="flex items-center gap-2 text-sm text-red-600 mt-1">
                                                        <AlertCircle className="w-4 h-4" />
                                                        {fileErrors.description}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Slug */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label htmlFor={`slug-${file.id}`} className="block text-sm font-medium text-gray-700">
                                                        Slug
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const slug = generateSlugFromTitle(currentApproval.title || '');
                                                            updateFileApproval(file.id, 'slug', slug);
                                                        }}
                                                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                        disabled={!currentApproval.title}
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                        Generate from title
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        id={`slug-${file.id}`}
                                                        type="text"
                                                        value={currentApproval.slug || ''}
                                                        onChange={(e) => updateFileApproval(file.id, 'slug', e.target.value)}
                                                        placeholder="auto-generated-from-title"
                                                        className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                            fileErrors.slug 
                                                                ? 'border-red-300 bg-red-50' 
                                                                : slugValidation[file.id]?.isValid === false
                                                                    ? 'border-yellow-300 bg-yellow-50'
                                                                    : slugValidation[file.id]?.isValid === true
                                                                        ? 'border-green-300 bg-green-50'
                                                                        : 'border-gray-300'
                                                        }`}
                                                    />
                                                    {slugValidating[file.id] && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                                                        </div>
                                                    )}
                                                    {!slugValidating[file.id] && slugValidation[file.id]?.isValid === true && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                                        </div>
                                                    )}
                                                    {!slugValidating[file.id] && slugValidation[file.id]?.isValid === false && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                {fileErrors.slug && (
                                                    <div className="flex items-center gap-2 text-sm text-red-600 mt-1">
                                                        <AlertCircle className="w-4 h-4" />
                                                        {fileErrors.slug}
                                                    </div>
                                                )}
                                                {!fileErrors.slug && slugValidation[file.id]?.message && (
                                                    <div className={`flex items-center gap-2 text-sm mt-1 ${
                                                        slugValidation[file.id].isValid ? 'text-green-600' : 'text-yellow-600'
                                                    }`}>
                                                        {slugValidation[file.id].isValid ? (
                                                            <CheckCircle className="w-4 h-4" />
                                                        ) : (
                                                            <AlertCircle className="w-4 h-4" />
                                                        )}
                                                        {slugValidation[file.id].message}
                                                    </div>
                                                )}
                                                {!fileErrors.slug && slugValidation[file.id]?.suggestion && (
                                                    <button
                                                        type="button"
                                                        onClick={() => updateFileApproval(file.id, 'slug', slugValidation[file.id].suggestion)}
                                                        className="text-xs text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1"
                                                    >
                                                        Use suggestion: {slugValidation[file.id].suggestion}
                                                    </button>
                                                )}
                                                <div className="text-xs text-gray-500 mt-1">
                                                    URL-friendly identifier (lowercase, alphanumeric, hyphens only)
                                                </div>
                                            </div>

                                            {/* Access Level */}
                                            <div>
                                                <label htmlFor={`access-${file.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                                                    Access Level
                                                </label>
                                                <select
                                                    id={`access-${file.id}`}
                                                    value={currentApproval.accessLevel || 'public'}
                                                    onChange={(e) => updateFileApproval(file.id, 'accessLevel', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="public">Public</option>
                                                    <option value="members">Members Only</option>
                                                    <option value="staff">Staff Only</option>
                                                    <option value="private">Private</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Confidence Score */}
                                    {suggestions?.confidenceScore && (
                                        <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-blue-600" />
                                                <span className="text-sm font-medium text-blue-800">
                                                    AI Confidence: {Math.round(suggestions.confidenceScore * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Extracted Text */}
                                    {suggestions?.extractedText && (
                                        <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-400 rounded">
                                            <div className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2" role="heading" aria-level="5">
                                                <FileText className="w-4 h-4" />
                                                Extracted Text:
                                            </div>
                                            <div className="text-sm text-green-700 leading-relaxed">
                                                {suggestions.extractedText.substring(0, 300)}
                                                {suggestions.extractedText.length > 300 && '...'}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Rejection Message */}
                            {!isApproved && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-center gap-2 text-red-800">
                                        <Trash2 className="w-5 h-5" />
                                        <span className="font-medium">This file will be rejected and removed from storage.</span>
                                    </div>
                                    <div className="text-sm text-red-600 mt-1">
                                        The file will be permanently deleted and cannot be recovered.
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                    onClick={processApprovals}
                    disabled={!isFormValid() || processing}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {processing ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Upload className="w-4 h-4" />
                            Process Files ({approvalCounts.approved} approve, {approvalCounts.rejected} reject)
                        </>
                    )}
                </button>
                <button
                    onClick={onCancel}
                    disabled={processing}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                    <X className="w-4 h-4" />
                    Cancel
                </button>
            </div>

            {/* Validation Summary */}
            {Object.keys(validationErrors).length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-lg font-medium text-red-800 mb-3 flex items-center gap-2" role="heading" aria-level="4">
                        <AlertCircle className="w-5 h-5" />
                        Validation Errors:
                    </div>
                    <div className="space-y-2">
                        {Object.entries(validationErrors).map(([fileId, errors]) => {
                            const file = pendingFiles.find(f => f.id === fileId);
                            return (
                                <div key={fileId} className="text-sm text-red-700">
                                    <span className="font-medium">{file?.originalFilename}:</span>
                                    <div className="ml-4 list-disc" role="list">
                                        {Object.values(errors).map((error, index) => (
                                            <div key={index}>{error}</div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaApprovalForm;
