/**
 * MediaEditForm Component
 * 
 * Reusable form for editing media file metadata.
 * Used for both pending files and approved files.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    Save,
    X,
    Lightbulb,
    RefreshCw,
    Sparkles,
    AlertCircle,
    FileText,
    Upload
} from 'lucide-react';
import { mediaApi, mediaTagsApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import OptimizedImage from './OptimizedImage';
import MediaTagWidget from './MediaTagWidget';
import MediaReferencesDisplay from './MediaReferencesDisplay';

const MediaEditForm = ({
    file,
    namespace,
    onSave,
    onCancel,
    mode = 'edit', // 'edit' for approved files, 'approve' for pending files
    showHeader = true // Whether to show the header with title and close button
}) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        tags: [],
        accessLevel: 'public',
        slug: ''
    });
    const [validationErrors, setValidationErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [availableTags, setAvailableTags] = useState([]);
    const [replacingFile, setReplacingFile] = useState(false);

    // Local file state (to avoid triggering onSave/exit)
    const [localFile, setLocalFile] = useState(file);

    const { addNotification } = useGlobalNotifications();
    
    // Ref for file input
    const fileInputRef = useRef(null);



    // Initialize form data and local file state
    useEffect(() => {
        if (file) {
            // Update local file state
            setLocalFile(file);
            // Convert tags to array of tag OBJECTS for MediaTagWidget
            let tagsArray = [];

            if (Array.isArray(file.tags)) {
                // If tags is an array of tag objects, use them directly
                tagsArray = file.tags.filter(tag => tag && (tag.name || tag.id));
            } else if (typeof file.tags === 'string' && file.tags) {
                // If tags is a string, we need to convert to tag objects
                // This is a fallback case - ideally tags should be objects
                const tagNames = file.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                tagsArray = tagNames.map(name => ({ name, id: null })); // Temporary objects
            }



            setFormData({
                title: file.title || file.originalFilename?.replace(/\.[^/.]+$/, '') || '',
                description: file.description || '',
                tags: tagsArray,
                accessLevel: file.accessLevel || 'public',
                slug: file.slug || ''
            });
        }
    }, [file]);

    // Load available tags and collections
    useEffect(() => {
        const loadTags = async () => {
            if (!namespace) return;

            try {
                // Load tags
                const tags = await mediaTagsApi.list({ namespace });
                const tagsList = tags.results || tags || [];
                setAvailableTags(Array.isArray(tagsList) ? tagsList : []);
            } catch (error) {
                console.error('Failed to load tags:', error);
                setAvailableTags([]);
            }
        };

        loadTags();
    }, [namespace]);

    // Update form data
    const updateFormData = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Auto-generate slug from title if title is being updated and slug is empty
        if (field === 'title' && value && (!formData.slug || formData.slug === '')) {
            const slug = value
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim();

            setFormData(prev => ({
                ...prev,
                slug: slug
            }));
            validateField('slug', slug);
        }

        validateField(field, value);
    };

    // Validate field
    const validateField = (field, value) => {
        const errors = { ...validationErrors };

        switch (field) {
            case 'title':
                if (!value || value.trim().length === 0) {
                    errors.title = 'Title is required';
                } else if (value.length > 255) {
                    errors.title = 'Title must be less than 255 characters';
                } else {
                    delete errors.title;
                }
                break;
            case 'description':
                if (value && value.length > 1000) {
                    errors.description = 'Description must be less than 1000 characters';
                } else {
                    delete errors.description;
                }
                break;
            case 'tags':
                if (!value || !Array.isArray(value) || value.length === 0) {
                    errors.tags = 'At least one tag is required';
                } else {
                    delete errors.tags;
                }
                break;
            case 'slug':
                if (value) {
                    const slugPattern = /^[a-z0-9-]+$/;
                    if (!slugPattern.test(value)) {
                        errors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
                    } else if (value.length > 255) {
                        errors.slug = 'Slug must be less than 255 characters';
                    } else {
                        delete errors.slug;
                    }
                } else {
                    delete errors.slug;
                }
                break;
            default:
                break;
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Apply AI suggestion
    const applyAISuggestion = (field, value) => {
        updateFormData(field, value);
        addNotification(`Applied AI suggestion for ${field}`, 'success');
    };

    // Tag change handler for MediaTagWidget
    const handleTagsChange = (newTags) => {
        updateFormData('tags', newTags);
    };

    // Handle replace file button click
    const handleReplaceFileClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // Handle file input change
    const handleFileInputChange = async (event) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        // Confirm replacement
        if (!window.confirm(`Are you sure you want to replace "${file.originalFilename}" with "${selectedFile.name}"? This action cannot be undone.`)) {
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        setReplacingFile(true);
        try {
            const result = await mediaApi.files.replaceFile(file.id, selectedFile)();
            
            addNotification('File replaced successfully', 'success');
            
            // Update local file state with the new file data
            setLocalFile(result);
            
            // Call onSave to update parent component
            onSave(result);
        } catch (error) {
            console.error('Failed to replace file:', error);
            addNotification(
                error?.context?.data?.error || 'Failed to replace file',
                'error'
            );
        } finally {
            setReplacingFile(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Save form data
    const handleSave = async () => {
        // Validate all fields
        let hasErrors = false;
        Object.keys(formData).forEach(field => {
            if (!validateField(field, formData[field])) {
                hasErrors = true;
            }
        });

        if (hasErrors) {
            addNotification('Please fix validation errors before saving', 'error');
            return;
        }

        setSaving(true);
        try {
            // Convert tags to tag IDs
            const tags = formData.tags || [];
            const tagIds = [];
            const safeAvailableTags = Array.isArray(availableTags) ? availableTags : [];

            for (const tagItem of tags) {
                let tag;

                if (typeof tagItem === 'object' && tagItem.id) {
                    // Tag object with ID - use it directly
                    tag = tagItem;
                } else {
                    // Tag name or object without ID - find or create
                    const tagName = typeof tagItem === 'string' ? tagItem : tagItem?.name;
                    if (!tagName) continue;

                    tag = safeAvailableTags.find(t => t?.name?.toLowerCase() === tagName.toLowerCase());
                    if (!tag) {
                        // Create new tag
                        try {
                            // Generate slug from tag name
                            const tagSlug = tagName.toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/^-+|-+$/g, '');

                            tag = await mediaTagsApi.create({
                                name: tagName,
                                slug: tagSlug,
                                namespace: namespace
                            })();
                            setAvailableTags(prev => {
                                const safePrev = Array.isArray(prev) ? prev : [];
                                return [...safePrev, tag];
                            });
                        } catch (error) {
                            console.error(`Failed to create tag ${tagName}:`, error);
                            continue;
                        }
                    }
                }

                if (tag?.id) {
                    tagIds.push(tag.id);
                }
            }

            let result;
            if (mode === 'approve') {
                // Approve pending file
                result = await mediaApi.pendingFiles.approve(file.id, {
                    title: formData.title,
                    description: formData.description,
                    slug: formData.slug,
                    tag_ids: tagIds,
                    access_level: formData.accessLevel
                })();
            } else {
                // Update approved file
                result = await mediaApi.files.update(file.id, {
                    title: formData.title,
                    description: formData.description,
                    slug: formData.slug,
                    tag_ids: tagIds,
                    access_level: formData.accessLevel
                })();
            }

            addNotification('File updated successfully', 'success');
            // Merge the API result with our local collection changes
            const finalResult = {
                ...result,
                collections: localFile.collections
            };
            onSave(finalResult);
        } catch (error) {
            console.error('Failed to save file:', error);
            addNotification('Failed to save file', 'error');
        } finally {
            setSaving(false);
        }
    };

    // File size formatter
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!file) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
            {showHeader && (
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {mode === 'approve' ? 'Approve File' : 'Edit File'}
                    </h3>
                    <button
                        onClick={onCancel}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className="flex gap-6">
                {/* File Preview */}
                <div className="flex-shrink-0">
                    <div className="w-48 h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center">
                        {(file.fileType === 'image' || file.file_type === 'image') ? (
                            <OptimizedImage
                                src={mode === 'approve'
                                    ? `/api/v1/media/pending-files/${file.id}/preview/`
                                    : file.imgproxyBaseUrl || file.fileUrl
                                }
                                alt={file.title || file.originalFilename}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover"
                                fallback={
                                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                        <FileText className="w-16 h-16 text-gray-400" />
                                    </div>
                                }
                            />
                        ) : (
                            <FileText className="w-16 h-16 text-gray-400" />
                        )}
                    </div>
                    <div className="mt-2 text-sm text-gray-600 text-center">
                        <p className="truncate">{file.originalFilename}</p>
                        <p>{formatFileSize(file.fileSize)}</p>
                    </div>
                    
                    {/* Replace File Button - Only show in edit mode */}
                    {mode === 'edit' && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileInputChange}
                                className="hidden"
                                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,video/webm,audio/mpeg,audio/wav"
                            />
                            <button
                                onClick={handleReplaceFileClick}
                                disabled={replacingFile}
                                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                {replacingFile ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Replacing...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Replace File
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>

                {/* Form Fields */}
                <div className="flex-1 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Title *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => updateFormData('title', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${validationErrors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                            placeholder="Enter file title"
                        />
                        {validationErrors.title && (
                            <div className="flex items-center gap-2 mt-1 text-sm text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                {validationErrors.title}
                            </div>
                        )}
                        {file.aiSuggestions?.title && (
                            <button
                                type="button"
                                className="flex items-center gap-2 px-3 py-1 mt-2 text-sm bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-md hover:bg-yellow-100 transition-colors"
                                onClick={() => applyAISuggestion('title', file.aiSuggestions.title)}
                                title="Apply AI suggestion"
                            >
                                <Lightbulb className="w-3 h-3" />
                                {file.aiSuggestions.title}
                            </button>
                        )}
                    </div>
                    {/* Slug */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Slug
                        </label>
                        <input
                            type="text"
                            value={formData.slug}
                            onChange={(e) => updateFormData('slug', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${validationErrors.slug ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                            placeholder="Auto-generated from title"
                        />
                        {validationErrors.slug && (
                            <div className="flex items-center gap-2 mt-1 text-sm text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                {validationErrors.slug}
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                            URL-friendly identifier (lowercase, alphanumeric, hyphens only)
                        </p>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tags <span className="text-red-500">*</span>
                        </label>

                        <div className={`bg-white p-4 rounded-md border ${validationErrors.tags
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-200'
                            }`}>

                            <MediaTagWidget
                                tags={formData.tags || []}
                                onChange={handleTagsChange}
                                namespace={namespace}
                                disabled={false}
                            />
                        </div>

                        {validationErrors.tags && (
                            <div className="flex items-center gap-2 mt-1 text-sm text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                {validationErrors.tags}
                            </div>
                        )}
                    </div>





                    {/* References Display */}
                    {mode === 'edit' && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">References</h4>
                            <MediaReferencesDisplay fileId={file.id} />
                        </div>
                    )}

                    {/* AI Confidence Score */}
                    {file.aiSuggestions?.confidenceScore && (
                        <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">
                                    AI Confidence: {Math.round(file.aiSuggestions.confidenceScore * 100)}%
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Extracted Text */}
                    {file.aiSuggestions?.extractedText && (
                        <div className="p-4 bg-green-50 border-l-4 border-green-400 rounded">
                            <h5 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Extracted Text:
                            </h5>
                            <p className="text-sm text-green-700 leading-relaxed">
                                {file.aiSuggestions.extractedText.substring(0, 300)}
                                {file.aiSuggestions.extractedText.length > 300 && '...'}
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving || Object.keys(validationErrors).length > 0}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {saving ? 'Saving...' : (mode === 'approve' ? 'Approve' : 'Save Changes')}
                        </button>
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaEditForm;
