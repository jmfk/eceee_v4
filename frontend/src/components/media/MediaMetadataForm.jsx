/**
 * MediaMetadataForm Component
 * 
 * Enhanced metadata entry form with validation for uploaded files.
 * Provides comprehensive validation, AI suggestions, and user-friendly interface.
 */

import React, { useState, useEffect } from 'react';
import {
    Save,
    X,
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
    EyeOff
} from 'lucide-react';
import { mediaApi, mediaTagsApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';

const MediaMetadataForm = ({
    uploadResults,
    namespace,
    onComplete,
    onCancel
}) => {
    const [fileMetadata, setFileMetadata] = useState({});
    const [aiSuggestions, setAiSuggestions] = useState({});
    const [loadingAI, setLoadingAI] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [availableTags, setAvailableTags] = useState([]);
    const [showAdvanced, setShowAdvanced] = useState({});
    const [slugValidation, setSlugValidation] = useState({});
    const [slugValidating, setSlugValidating] = useState({});

    const { addNotification } = useGlobalNotifications();

    // Initialize metadata for each file
    useEffect(() => {
        const initialMetadata = {};
        uploadResults.forEach(file => {
            initialMetadata[file.id] = {
                title: file.title || file.original_filename?.replace(/\.[^/.]+$/, '') || '',
                description: file.description || '',
                tags: '',
                access_level: file.access_level || 'public',
                slug: file.slug || ''
            };
        });
        setFileMetadata(initialMetadata);
    }, [uploadResults]);

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
                // Validate tag format (comma-separated)
                if (value) {
                    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
                    const invalidTags = tags.filter(tag => tag.length > 50);
                    if (invalidTags.length > 0) {
                        fileErrors.tags = 'Each tag must be less than 50 characters';
                    } else {
                        delete fileErrors.tags;
                    }
                } else {
                    delete fileErrors.tags;
                }
                break;

            case 'slug':
                if (value) {
                    // Validate slug format (lowercase, alphanumeric, hyphens)
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
                    namespace: namespace,
                    file_id: fileId
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

    // Update metadata with validation
    const updateFileMetadata = (fileId, field, value) => {
        setFileMetadata(prev => ({
            ...prev,
            [fileId]: {
                ...prev[fileId],
                [field]: value
            }
        }));

        // Auto-generate slug from title if title is being updated and slug is empty
        if (field === 'title' && value && (!fileMetadata[fileId]?.slug || fileMetadata[fileId].slug === '')) {
            const slug = generateSlugFromTitle(value);

            setFileMetadata(prev => ({
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

    // AI Suggestions
    const generateAISuggestions = async (fileId) => {
        setLoadingAI(prev => ({ ...prev, [fileId]: true }));
        try {
            const result = await mediaApi.ai.getSuggestions(fileId);
            setAiSuggestions(prev => ({
                ...prev,
                [fileId]: result.suggestions || result
            }));
            addNotification('AI suggestions generated successfully', 'success');
        } catch (error) {
            console.error('Failed to generate AI suggestions:', error);
            addNotification('Failed to generate AI suggestions', 'error');
        } finally {
            setLoadingAI(prev => ({ ...prev, [fileId]: false }));
        }
    };

    const applyAISuggestion = (fileId, field, value) => {
        updateFileMetadata(fileId, field, value);
        addNotification(`Applied AI suggestion for ${field}`, 'success');
    };

    // Tag helpers
    const addTag = (fileId, tag) => {
        const currentTags = fileMetadata[fileId]?.tags || '';
        const tags = currentTags ? currentTags.split(',').map(t => t.trim()) : [];

        if (!tags.includes(tag)) {
            const newTags = [...tags, tag].join(', ');
            updateFileMetadata(fileId, 'tags', newTags);
        }
    };

    const removeTag = (fileId, tagToRemove) => {
        const currentTags = fileMetadata[fileId]?.tags || '';
        const tags = currentTags.split(',').map(t => t.trim()).filter(t => t && t !== tagToRemove);
        updateFileMetadata(fileId, 'tags', tags.join(', '));
    };

    // Save metadata
    const saveMetadata = async () => {
        // Validate all fields
        let hasErrors = false;
        Object.keys(fileMetadata).forEach(fileId => {
            const metadata = fileMetadata[fileId];
            Object.keys(metadata).forEach(field => {
                if (!validateField(fileId, field, metadata[field])) {
                    hasErrors = true;
                }
            });
        });

        if (hasErrors) {
            addNotification('Please fix validation errors before saving', 'error');
            return;
        }

        setSaving(true);
        try {
            // Update each file's metadata
            const updatePromises = Object.keys(fileMetadata).map(async (fileId) => {
                const metadata = fileMetadata[fileId];

                // Convert tags string to tag IDs
                const tagNames = metadata.tags ?
                    metadata.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

                // Create new tags if they don't exist
                const tagIds = [];
                for (const tagName of tagNames) {
                    let tag = availableTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                    if (!tag) {
                        // Create new tag
                        try {
                            tag = await mediaTagsApi.create({
                                name: tagName,
                                namespace: namespace
                            });
                            setAvailableTags(prev => [...prev, tag]);
                        } catch (error) {
                            console.error(`Failed to create tag ${tagName}:`, error);
                            continue;
                        }
                    }
                    tagIds.push(tag.id);
                }

                // Update file metadata
                return mediaApi.files.update(fileId, {
                    title: metadata.title,
                    description: metadata.description,
                    slug: metadata.slug,
                    access_level: metadata.access_level,
                    tag_ids: tagIds
                });
            });

            await Promise.all(updatePromises);
            addNotification('Metadata saved successfully', 'success');
            onComplete();
        } catch (error) {
            console.error('Failed to save metadata:', error);
            addNotification('Failed to save metadata', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Check if form is valid
    const isFormValid = () => {
        return Object.keys(validationErrors).length === 0 &&
            Object.values(fileMetadata).every(metadata => metadata.title && metadata.title.trim());
    };

    // File size formatter
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="p-8">
            <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Review and Edit Metadata
                </h3>
                <p className="text-gray-600">
                    Complete the metadata for your uploaded files. Title is required for all files.
                </p>
            </div>

            <div className="space-y-6">
                {uploadResults.map((file) => {
                    const currentMetadata = fileMetadata[file.id] || {};
                    const suggestions = aiSuggestions[file.id] || file.ai_suggestions;
                    const isLoadingAI = loadingAI[file.id];
                    const fileErrors = validationErrors[file.id] || {};
                    const isAdvancedVisible = showAdvanced[file.id];

                    return (
                        <div key={file.id} className="border border-gray-200 rounded-lg p-6 bg-white">
                            {/* File Header */}
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-lg font-medium text-gray-900 truncate">
                                        {file.original_filename}
                                    </h4>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                        <span className="capitalize">{file.file_type}</span>
                                        <span>{formatFileSize(file.file_size)}</span>
                                        {file.width && file.height && (
                                            <span>{file.width} × {file.height}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* AI Suggestions Button */}
                                    <button
                                        type="button"
                                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
                                        onClick={() => generateAISuggestions(file.id)}
                                        disabled={isLoadingAI}
                                    >
                                        {isLoadingAI ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                AI Suggestions
                                            </>
                                        )}
                                    </button>

                                    {/* Advanced Toggle */}
                                    <button
                                        type="button"
                                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                                        onClick={() => setShowAdvanced(prev => ({ ...prev, [file.id]: !prev[file.id] }))}
                                    >
                                        {isAdvancedVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        {isAdvancedVisible ? 'Hide Advanced' : 'Show Advanced'}
                                    </button>
                                </div>
                            </div>

                            {/* Title Field (Required) */}
                            <div className="mb-4">
                                <label htmlFor={`title-${file.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <div className="space-y-2">
                                    <input
                                        id={`title-${file.id}`}
                                        type="text"
                                        value={currentMetadata.title || ''}
                                        onChange={(e) => updateFileMetadata(file.id, 'title', e.target.value)}
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

                            {/* Approval Details */}
                            <div className="space-y-2 mb-3">
                                {formData?.tags && formData.tags.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-gray-600">Tags:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {formData.tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded"
                                                >
                                                    {typeof tag === 'string' ? tag : tag.name || tag.title}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tags Field */}
                            <div className="mb-4">
                                <label htmlFor={`tags-${file.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                                    Tags
                                </label>
                                <div className="space-y-2">
                                    <input
                                        id={`tags-${file.id}`}
                                        type="text"
                                        value={currentMetadata.tags || ''}
                                        onChange={(e) => updateFileMetadata(file.id, 'tags', e.target.value)}
                                        placeholder="Enter tags (comma-separated)"
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
                                    {currentMetadata.tags && (
                                        <div className="flex flex-wrap gap-2">
                                            {currentMetadata.tags.split(',').map(tag => tag.trim()).filter(tag => tag).map((tag, index) => (
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
                                            value={currentMetadata.description || ''}
                                            onChange={(e) => updateFileMetadata(file.id, 'description', e.target.value)}
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
                                                    const slug = generateSlugFromTitle(currentMetadata.title || '');
                                                    updateFileMetadata(file.id, 'slug', slug);
                                                }}
                                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                disabled={!currentMetadata.title}
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                Generate from title
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                id={`slug-${file.id}`}
                                                type="text"
                                                value={currentMetadata.slug || ''}
                                                onChange={(e) => updateFileMetadata(file.id, 'slug', e.target.value)}
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
                                                onClick={() => updateFileMetadata(file.id, 'slug', slugValidation[file.id].suggestion)}
                                                className="text-xs text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1"
                                            >
                                                Use suggestion: {slugValidation[file.id].suggestion}
                                            </button>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1">
                                            URL-friendly identifier (lowercase, alphanumeric, hyphens only)
                                        </p>
                                    </div>

                                    {/* Access Level */}
                                    <div>
                                        <label htmlFor={`access-${file.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                                            Access Level
                                        </label>
                                        <select
                                            id={`access-${file.id}`}
                                            value={currentMetadata.access_level || 'public'}
                                            onChange={(e) => updateFileMetadata(file.id, 'access_level', e.target.value)}
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
                            {suggestions?.confidence_score && (
                                <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-800">
                                            AI Confidence: {Math.round(suggestions.confidence_score * 100)}%
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Extracted Text */}
                            {suggestions?.extracted_text && (
                                <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-400 rounded">
                                    <h5 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Extracted Text:
                                    </h5>
                                    <p className="text-sm text-green-700 leading-relaxed">
                                        {suggestions.extracted_text.substring(0, 300)}
                                        {suggestions.extracted_text.length > 300 && '...'}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                    onClick={saveMetadata}
                    disabled={!isFormValid() || saving}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save Metadata
                        </>
                    )}
                </button>
                <button
                    onClick={onCancel}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                    <X className="w-4 h-4" />
                    Cancel
                </button>
            </div>

            {/* Validation Summary */}
            {Object.keys(validationErrors).length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="text-lg font-medium text-red-800 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Validation Errors:
                    </h4>
                    <div className="space-y-2">
                        {Object.entries(validationErrors).map(([fileId, errors]) => {
                            const file = uploadResults.find(f => f.id === fileId);
                            return (
                                <div key={fileId} className="text-sm text-red-700">
                                    <span className="font-medium">{file?.original_filename}:</span>
                                    <ul className="ml-4 list-disc">
                                        {Object.values(errors).map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaMetadataForm;
