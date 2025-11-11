/**
 * PendingMediaManager Component
 * 
 * Interface for viewing and managing all pending media files awaiting approval.
 * Provides list view, filtering, and individual file management.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search,
    Filter,
    RefreshCw,
    Check,
    X,
    Trash2,
    Clock,
    FileText,
    Image,
    Video,
    Music,
    Archive,
    File,
    ChevronDown,
    ChevronUp,
    Calendar,
    User,
    Tag,
    Eye,
    AlertCircle,
    Upload,
    Download
} from 'lucide-react';
import { mediaApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';

import MediaTagWidget from './MediaTagWidget';

const PendingMediaManager = ({ namespace, onFilesProcessed }) => {
    const [pendingFiles, setPendingFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');

    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        fileType: '',
        status: 'pending',
        dateRange: ''
    });


    const [fileFormData, setFileFormData] = useState({}); // Store form data for each file
    const [markedFiles, setMarkedFiles] = useState({}); // Track files marked for approval/rejection
    const [selectedCollection, setSelectedCollection] = useState(''); // Selected media collection
    const [newCollectionName, setNewCollectionName] = useState(''); // Name for new collection
    const [availableCollections, setAvailableCollections] = useState([]); // Available collections
    const [autoUpdatedSlugs, setAutoUpdatedSlugs] = useState({}); // Track files with automatically updated slugs
    const [validatingSlugs, setValidatingSlugs] = useState({}); // Track files with slugs being validated
    const [fieldErrors, setFieldErrors] = useState({}); // Track validation errors for each field
    
    // Bulk selection state
    const [selectedFiles, setSelectedFiles] = useState(new Set()); // Track selected files for bulk operations
    const [bulkTags, setBulkTags] = useState([]); // Tags to apply to selected files

    const { addNotification } = useGlobalNotifications();

    // Initialize form data for a file
    const initializeFormData = (file) => {
        if (!fileFormData[file.id]) {
            const title = file.aiSuggestedTitle || file.originalFilename.replace(/\.[^/.]+$/, "");
            setFileFormData(prev => ({
                ...prev,
                [file.id]: {
                    title: title,
                    slug: generateSlug(title),
                    tags: file.aiSuggestedTags || [],
                    accessLevel: 'public'
                }
            }));
        }
    };

    // Debounce timer for slug validation
    const slugValidationTimers = useRef({});
    const manualSlugValidationTimers = useRef({});

    // Validate individual field
    const validateField = (fileId, fieldName, value) => {
        const errors = { ...fieldErrors };
        if (!errors[fileId]) errors[fileId] = {};

        switch (fieldName) {
            case 'title':
                if (!value || value.trim().length === 0) {
                    errors[fileId].title = 'Title is required';
                } else if (value.length > 255) {
                    errors[fileId].title = 'Title must be less than 255 characters';
                } else {
                    delete errors[fileId].title;
                }
                break;

            case 'slug':
                if (value && !/^[a-z0-9-]+$/.test(value)) {
                    errors[fileId].slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
                } else if (value && value.length > 255) {
                    errors[fileId].slug = 'Slug must be less than 255 characters';
                } else {
                    delete errors[fileId].slug;
                }
                break;

            case 'tags':
                if (!value || value.length === 0) {
                    errors[fileId].tags = 'At least one tag is required';
                } else {
                    delete errors[fileId].tags;
                }
                break;

            case 'description':
                if (value && value.length > 1000) {
                    errors[fileId].description = 'Description must be less than 1000 characters';
                } else {
                    delete errors[fileId].description;
                }
                break;

            default:
                break;
        }

        // Clean up empty error objects
        if (Object.keys(errors[fileId]).length === 0) {
            delete errors[fileId];
        }

        setFieldErrors(errors);
        return !errors[fileId] || !errors[fileId][fieldName];
    };

    // Update form data for a specific file
    const updateFormData = (fileId, field, value) => {
        setFileFormData(prev => {
            const updatedData = {
                ...prev[fileId],
                [field]: value
            };

            // Auto-generate slug when title changes (immediate feedback)
            if (field === 'title') {
                updatedData.slug = generateSlug(value);
            }

            return {
                ...prev,
                [fileId]: updatedData
            };
        });

        // Validate the field
        validateField(fileId, field, value);

        // If title changed, also validate the auto-generated slug
        if (field === 'title') {
            const newSlug = generateSlug(value);
            validateField(fileId, 'slug', newSlug);
        }

        // If title changed, validate slug with backend after debounce
        if (field === 'title' && value.trim()) {
            // Clear existing timer for this file
            if (slugValidationTimers.current[fileId]) {
                clearTimeout(slugValidationTimers.current[fileId]);
            }

            // Set new timer to validate slug after user stops typing
            slugValidationTimers.current[fileId] = setTimeout(async () => {
                const validatedSlug = await validateSlug(value, fileId);

                // Update with backend-validated slug
                setFileFormData(prev => ({
                    ...prev,
                    [fileId]: {
                        ...prev[fileId],
                        slug: validatedSlug
                    }
                }));
            }, 500); // 500ms debounce
        }
    };

    // Handle manual slug changes
    const handleManualSlugChange = (fileId, newSlug) => {
        // Clear auto-updated flag since user is manually editing
        setAutoUpdatedSlugs(prev => {
            const newState = { ...prev };
            delete newState[fileId];
            return newState;
        });

        // Update form data immediately for UI feedback
        setFileFormData(prev => ({
            ...prev,
            [fileId]: {
                ...prev[fileId],
                slug: newSlug
            }
        }));

        // Clear existing timer for this file
        if (manualSlugValidationTimers.current[fileId]) {
            clearTimeout(manualSlugValidationTimers.current[fileId]);
        }

        // Validate the manually entered slug with server after debounce
        if (newSlug.trim() && namespace) {
            manualSlugValidationTimers.current[fileId] = setTimeout(async () => {
                // Set validating state
                setValidatingSlugs(prev => ({ ...prev, [fileId]: true }));

                try {
                    const slugValidationResult = await mediaApi.validateSlug({
                        title: newSlug.trim(), // Use the slug itself as title for validation
                        namespace: namespace,
                        current_slugs: Object.entries(fileFormData)
                            .filter(([id, data]) => id !== fileId && data.slug)
                            .map(([id, data]) => data.slug)
                    });

                    let validatedSlug;
                    if (slugValidationResult && slugValidationResult.slug) {
                        validatedSlug = slugValidationResult.slug;
                    } else if (slugValidationResult && slugValidationResult.data && slugValidationResult.data.slug) {
                        validatedSlug = slugValidationResult.data.slug;
                    } else {
                        validatedSlug = newSlug;
                    }

                    // If server suggests a different slug, update and mark as auto-updated
                    if (validatedSlug !== newSlug) {
                        setFileFormData(prev => ({
                            ...prev,
                            [fileId]: {
                                ...prev[fileId],
                                slug: validatedSlug
                            }
                        }));

                        setAutoUpdatedSlugs(prev => ({
                            ...prev,
                            [fileId]: {
                                originalSlug: newSlug,
                                newSlug: validatedSlug,
                                timestamp: new Date().toISOString()
                            }
                        }));

                        addNotification(
                            `Slug changed to "${validatedSlug}" to ensure uniqueness.`,
                            'warning'
                        );
                    }
                } catch (error) {
                    console.error('Failed to validate manually entered slug:', error);
                    addNotification('Failed to validate slug. Please check for conflicts.', 'error');
                } finally {
                    // Clear validating state
                    setValidatingSlugs(prev => {
                        const newState = { ...prev };
                        delete newState[fileId];
                        return newState;
                    });
                }
            }, 800); // 800ms debounce for manual changes
        }
    };

    // Generate slug from title (client-side only for immediate feedback)
    const generateSlug = (title) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    };

    // Validate and get unique slug from backend
    const validateSlug = useCallback(async (title, fileId) => {
        if (!title.trim() || !namespace) return '';
        try {
            // Get all current slugs from other files (excluding the current file)
            const currentSlugs = Object.entries(fileFormData)
                .filter(([id, data]) => id !== fileId && data.slug)
                .map(([id, data]) => data.slug);

            // Call backend to validate slug and get alternative if needed
            const response = await mediaApi.validateSlug({
                title: title.trim(),
                namespace: namespace,
                current_slugs: currentSlugs
            });

            // Handle different possible response structures
            if (response && response.slug) {
                return response.slug;
            } else if (response && response.data && response.data.slug) {
                return response.data.slug;
            } else {
                // If no slug in response, fallback to client-side generation
                return generateSlug(title);
            }
        } catch (error) {
            console.error('Failed to validate slug:', error);
            // Fallback to client-side generation if backend fails
            return generateSlug(title);
        }
    }, [namespace, fileFormData]);

    // Bulk selection handlers
    const toggleFileSelection = (fileId) => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedFiles.size === pendingFiles.length) {
            // Deselect all
            setSelectedFiles(new Set());
        } else {
            // Select all pending review files (not marked)
            const pendingReviewFiles = pendingFiles.filter(file => !markedFiles[file.id]);
            setSelectedFiles(new Set(pendingReviewFiles.map(file => file.id)));
        }
    };

    const handleApplyBulkTags = () => {
        if (selectedFiles.size === 0) {
            addNotification('No files selected', 'warning');
            return;
        }

        if (bulkTags.length === 0) {
            addNotification('Please select at least one tag to apply', 'warning');
            return;
        }

        // Apply tags to all selected files
        setFileFormData(prev => {
            const updated = { ...prev };
            selectedFiles.forEach(fileId => {
                if (updated[fileId]) {
                    // Merge with existing tags (avoid duplicates)
                    const existingTags = updated[fileId].tags || [];
                    const existingTagNames = existingTags.map(t => 
                        typeof t === 'string' ? t : t.name
                    );
                    
                    const newTags = bulkTags.filter(tag => {
                        const tagName = typeof tag === 'string' ? tag : tag.name;
                        return !existingTagNames.includes(tagName);
                    });

                    updated[fileId] = {
                        ...updated[fileId],
                        tags: [...existingTags, ...newTags]
                    };

                    // Validate tags for this file
                    validateField(fileId, 'tags', [...existingTags, ...newTags]);
                }
            });
            return updated;
        });

        addNotification(`Tags applied to ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''}`, 'success');
    };

    const handleBulkApprove = async () => {
        if (selectedFiles.size === 0) {
            addNotification('No files selected', 'warning');
            return;
        }

        // Validate all selected files
        let hasErrors = false;
        const validationErrors = {};

        selectedFiles.forEach(fileId => {
            const formData = fileFormData[fileId];
            if (!formData || !formData.title || !formData.title.trim()) {
                if (!validationErrors[fileId]) validationErrors[fileId] = {};
                validationErrors[fileId].title = 'Title is required';
                hasErrors = true;
            }
            if (!formData || !formData.tags || formData.tags.length === 0) {
                if (!validationErrors[fileId]) validationErrors[fileId] = {};
                validationErrors[fileId].tags = 'At least one tag is required';
                hasErrors = true;
            }
        });

        if (hasErrors) {
            setFieldErrors(prev => ({
                ...prev,
                ...validationErrors
            }));
            addNotification('Some files are missing required fields (title or tags)', 'error');
            return;
        }

        // Mark all selected files for approval
        selectedFiles.forEach(fileId => {
            markFileForProcessing(fileId, 'approve');
        });

        addNotification(`${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} marked for approval`, 'success');
        
        // Clear selection
        setSelectedFiles(new Set());
    };

    // Mark file for processing
    const markFileForProcessing = (fileId, action) => {
        setMarkedFiles(prev => ({
            ...prev,
            [fileId]: {
                action: action, // 'approve' or 'reject'
                timestamp: new Date().toISOString()
            }
        }));
    };

    // Unmark file
    const unmarkFile = (fileId) => {
        setMarkedFiles(prev => {
            const newState = { ...prev };
            delete newState[fileId];
            return newState;
        });

        // Clear auto-updated slug flag when unmarking
        setAutoUpdatedSlugs(prev => {
            const newState = { ...prev };
            delete newState[fileId];
            return newState;
        });

        // Clear validating state when unmarking
        setValidatingSlugs(prev => {
            const newState = { ...prev };
            delete newState[fileId];
            return newState;
        });

        // Clear any pending validation timers
        if (manualSlugValidationTimers.current[fileId]) {
            clearTimeout(manualSlugValidationTimers.current[fileId]);
            delete manualSlugValidationTimers.current[fileId];
        }
    };

    // Mark file for approval
    const handleMarkForApproval = async (file) => {
        const formData = fileFormData[file.id];

        // Validate all fields before marking for approval
        let hasErrors = false;

        if (!validateField(file.id, 'title', formData?.title)) {
            hasErrors = true;
        }
        if (!validateField(file.id, 'tags', formData?.tags)) {
            hasErrors = true;
        }
        if (!validateField(file.id, 'slug', formData?.slug)) {
            hasErrors = true;
        }
        if (!validateField(file.id, 'description', formData?.description)) {
            hasErrors = true;
        }

        if (hasErrors) {
            addNotification('Please fix validation errors before marking for approval', 'error');
            return;
        }

        try {
            // Validate slug against server
            const slugValidationResult = await mediaApi.validateSlug({
                title: formData.title.trim(),
                namespace: namespace,
                current_slugs: Object.entries(fileFormData)
                    .filter(([id, data]) => id !== file.id && data.slug)
                    .map(([id, data]) => data.slug)
            });

            let validatedSlug;
            if (slugValidationResult && slugValidationResult.slug) {
                validatedSlug = slugValidationResult.slug;
            } else if (slugValidationResult && slugValidationResult.data && slugValidationResult.data.slug) {
                validatedSlug = slugValidationResult.data.slug;
            } else {
                // Fallback to client-side generation if no slug in response
                validatedSlug = generateSlug(formData.title);
            }

            // Check if the slug changed from what the user had
            if (validatedSlug !== formData.slug) {
                // Update the form data with the new slug
                setFileFormData(prev => ({
                    ...prev,
                    [file.id]: {
                        ...prev[file.id],
                        slug: validatedSlug
                    }
                }));

                // Mark this slug as automatically updated
                setAutoUpdatedSlugs(prev => ({
                    ...prev,
                    [file.id]: {
                        originalSlug: formData.slug,
                        newSlug: validatedSlug,
                        timestamp: new Date().toISOString()
                    }
                }));

                // Alert user about the slug change and keep file unmarked
                addNotification(
                    `Slug changed to "${validatedSlug}" to ensure uniqueness. Please review and approve again.`,
                    'warning'
                );
                return; // Don't mark for approval, let user review the change
            }

            // Slug is valid, proceed with marking for approval
            markFileForProcessing(file.id, 'approve');
            addNotification(`File "${formData.title}" marked for approval`, 'success');

        } catch (error) {
            console.error('Failed to validate slug:', error);
            addNotification('Failed to validate slug. Please try again.', 'error');
        }
    };

    // Load pending files
    const loadPendingFiles = useCallback(async () => {
        if (!namespace) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = {
                namespace: namespace,
                search: searchQuery,
                ordering: sortOrder === 'desc' ? `-${sortBy}` : sortBy,
                ...filters
            };

            const result = await mediaApi.pendingFiles.list(params);
            const files = result.results || result || [];
            // Ensure we always have an array
            setPendingFiles(Array.isArray(files) ? files : []);
        } catch (err) {
            console.error('Failed to load pending files:', err);
            setError('Failed to load pending files');
            addNotification('Failed to load pending files', 'error');
            setPendingFiles([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    }, [namespace, searchQuery, sortBy, sortOrder, filters, addNotification]);

    // Load available collections
    const loadCollections = useCallback(async () => {
        if (!namespace) return;

        try {
            // Assuming there's an API endpoint for collections
            // For now, we'll use a placeholder
            setAvailableCollections([
                { id: 1, name: 'General Media' },
                { id: 2, name: 'Product Images' },
                { id: 3, name: 'Blog Assets' }
            ]);
        } catch (error) {
            console.error('Failed to load collections:', error);
            setAvailableCollections([]);
        }
    }, [namespace]);

    // Load files on mount and when dependencies change
    useEffect(() => {
        if (namespace) {
            loadPendingFiles();
            loadCollections();
        }
    }, [loadPendingFiles, loadCollections, namespace]);

    // Initialize form data when pending files are loaded
    useEffect(() => {
        if (Array.isArray(pendingFiles)) {
            pendingFiles.forEach(file => {
                initializeFormData(file);
            });
        }
    }, [pendingFiles]);

    // File type icons
    const getFileTypeIcon = (fileType) => {
        switch (fileType) {
            case 'image':
                return <Image className="w-5 h-5 text-blue-500" />;
            case 'video':
                return <Video className="w-5 h-5 text-purple-500" />;
            case 'audio':
                return <Music className="w-5 h-5 text-green-500" />;
            case 'document':
                return <FileText className="w-5 h-5 text-red-500" />;
            case 'archive':
                return <Archive className="w-5 h-5 text-yellow-500" />;
            default:
                return <File className="w-5 h-5 text-gray-500" />;
        }
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };



    // Individual file actions
    const handleApproveFile = async (file) => {
        // This function should not be used anymore as it doesn't handle tags
        // All approvals should go through the form-based approval process
        addNotification('Please use the approval form to assign tags before approving files', 'warning');
        return;
    };

    const handleMarkForRejection = (file) => {
        markFileForProcessing(file.id, 'reject');
        addNotification(`${file.originalFilename} marked for rejection`, 'info');
    };

    // Submit marked files
    const handleSubmitMarkedFiles = async () => {
        const markedFileIds = Object.keys(markedFiles);
        if (markedFileIds.length === 0) {
            addNotification('No files marked for processing', 'warning');
            return;
        }

        const approvedFiles = markedFileIds.filter(id => markedFiles[id].action === 'approve');
        const rejectedFiles = markedFileIds.filter(id => markedFiles[id].action === 'reject');

        try {
            // Validate approved files have required tags
            const validationErrors = {};
            let hasValidationErrors = false;

            for (const fileId of approvedFiles) {
                const formData = fileFormData[fileId];
                if (!formData || !formData.tags || formData.tags.length === 0) {
                    const file = pendingFiles.find(f => f.id === fileId);
                    const filename = file ? file.originalFilename : 'Unknown file';

                    // Set field error for visual feedback
                    if (!validationErrors[fileId]) {
                        validationErrors[fileId] = {};
                    }
                    validationErrors[fileId].tags = 'At least one tag is required to approve this file';
                    hasValidationErrors = true;
                }
            }

            // If there are validation errors, show them in the UI and notify
            if (hasValidationErrors) {
                setFieldErrors(prev => ({
                    ...prev,
                    ...validationErrors
                }));
                addNotification('Cannot approve: Some files are missing required tags. Please add at least one tag to each file.', 'error');
                return;
            }

            // Process approved files
            const approvalErrors = [];
            for (const fileId of approvedFiles) {
                const file = pendingFiles.find(f => f.id === fileId);
                const formData = fileFormData[fileId];

                if (file && formData) {
                    try {
                        // Convert tag objects to tag IDs/names (backend expects array of strings)
                        const tagIds = (formData.tags || []).map(tag => {
                            if (typeof tag === 'string') return tag;
                            return tag.id || tag.name;
                        });

                        await mediaApi.pendingFiles.approve(fileId, {
                            title: formData.title,
                            slug: formData.slug,
                            tagIds: tagIds,
                            accessLevel: formData.accessLevel,
                            collectionId: selectedCollection === 'new' ? null : (selectedCollection || null),
                            collectionName: selectedCollection === 'new' ? newCollectionName : null
                        })();
                    } catch (error) {
                        console.error(`Failed to approve ${file.originalFilename}:`, error);

                        // Handle validation errors from server (camelCase from backend)
                        if (error.response?.data) {
                            const serverErrors = error.response.data;
                            const errors = { ...fieldErrors };
                            if (!errors[fileId]) errors[fileId] = {};

                            // Map server field errors to frontend fields
                            if (serverErrors.title) {
                                errors[fileId].title = Array.isArray(serverErrors.title) ? serverErrors.title[0] : serverErrors.title;
                            }
                            if (serverErrors.tagIds) {
                                errors[fileId].tags = Array.isArray(serverErrors.tagIds) ? serverErrors.tagIds[0] : serverErrors.tagIds;
                            }
                            if (serverErrors.slug) {
                                errors[fileId].slug = Array.isArray(serverErrors.slug) ? serverErrors.slug[0] : serverErrors.slug;
                            }

                            setFieldErrors(errors);
                        }

                        approvalErrors.push(`${file.originalFilename}: ${error.response?.data?.detail || error.message}`);
                    }
                }
            }

            // Process rejected files
            for (const fileId of rejectedFiles) {
                await mediaApi.pendingFiles.reject(fileId)();
            }

            // Show appropriate notifications
            const successfulApprovals = approvedFiles.length - approvalErrors.length;

            if (successfulApprovals > 0 || rejectedFiles.length > 0) {
                addNotification(
                    `Successfully processed ${successfulApprovals} approved and ${rejectedFiles.length} rejected files`,
                    'success'
                );
            }

            if (approvalErrors.length > 0) {
                approvalErrors.forEach(error => {
                    addNotification(error, 'error');
                });
                return; // Don't clear form data if there were errors
            }

            // Clear marked files and form data
            setMarkedFiles({});
            setFileFormData({});
            setAutoUpdatedSlugs({});
            setValidatingSlugs({});
            setSelectedCollection('');
            setNewCollectionName('');
            setSelectedFiles(new Set());
            setBulkTags([]);

            // Reload the list
            loadPendingFiles();
            if (onFilesProcessed) onFilesProcessed();

        } catch (error) {
            console.error('Failed to submit files:', error);
            addNotification('Failed to process some files', 'error');
        }
    };





    // Render main list view
    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Pending Media Files</h2>
                <p className="text-gray-600">
                    Review and manage files awaiting approval. Files expire after 24 hours if not processed.
                </p>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="ml-3 text-gray-600">Loading pending files...</span>
                </div>
            ) : error ? (
                <div className="flex items-center justify-center py-12">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                    <span className="ml-3 text-red-600">{error}</span>
                </div>
            ) : (!Array.isArray(pendingFiles) || pendingFiles.length === 0) ? (
                <div className="text-center py-12">
                    <Upload className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No pending files</h3>
                    <p className="text-gray-500">
                        {searchQuery || filters.fileType ?
                            'No files match your current filters.' :
                            'All uploaded files have been processed or no files are awaiting approval.'
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Bulk Actions Section */}
                    {pendingFiles.filter(file => !markedFiles[file.id]).length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedFiles.size > 0 && selectedFiles.size === pendingFiles.filter(file => !markedFiles[file.id]).length}
                                        onChange={toggleSelectAll}
                                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <h3 className="text-lg font-semibold text-blue-900">
                                        Bulk Actions
                                    </h3>
                                    {selectedFiles.size > 0 && (
                                        <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-blue-600 text-white rounded-full">
                                            {selectedFiles.size} selected
                                        </span>
                                    )}
                                </div>
                            </div>

                            {selectedFiles.size > 0 && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Apply Tags to Selected Files
                                        </label>
                                        <MediaTagWidget
                                            tags={bulkTags}
                                            onChange={setBulkTags}
                                            namespace={namespace}
                                            disabled={false}
                                        />
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleApplyBulkTags}
                                            disabled={bulkTags.length === 0}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <Tag className="w-4 h-4" />
                                            Apply Tags to {selectedFiles.size} File{selectedFiles.size > 1 ? 's' : ''}
                                        </button>

                                        <button
                                            onClick={handleBulkApprove}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                                        >
                                            <Check className="w-4 h-4" />
                                            Approve {selectedFiles.size} Selected
                                        </button>

                                        <button
                                            onClick={() => setSelectedFiles(new Set())}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                            Clear Selection
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedFiles.size === 0 && (
                                <p className="text-sm text-blue-800">
                                    Select files using the checkboxes below to apply tags and approve multiple files at once.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        {/* Table Header */}
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                            <div className="flex items-center">
                                <span className="text-sm font-medium text-gray-700">
                                    {Array.isArray(pendingFiles) ? pendingFiles.length : 0} file{(Array.isArray(pendingFiles) ? pendingFiles.length : 0) !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                    {/* Separate the files into approved, rejected, and pending lists */}
                    {(() => {
                        const approvedFiles = Array.isArray(pendingFiles) ? pendingFiles.filter(file =>
                            markedFiles[file.id] && markedFiles[file.id].action === 'approve'
                        ) : [];

                        const rejectedFiles = Array.isArray(pendingFiles) ? pendingFiles.filter(file =>
                            markedFiles[file.id] && markedFiles[file.id].action === 'reject'
                        ) : [];

                        const pendingReviewFiles = Array.isArray(pendingFiles) ? pendingFiles.filter(file =>
                            !markedFiles[file.id]
                        ) : [];

                        return (
                            <>
                                {/* Approved Files List */}
                                {approvedFiles.length > 0 && (
                                    <div className="mb-8">
                                        <div className="bg-green-50 px-6 py-3 border-b border-green-200">
                                            <div className="flex items-center gap-2">
                                                <Check className="w-5 h-5 text-green-600" />
                                                <span className="text-sm font-medium text-green-800">
                                                    Approved Files ({approvedFiles.length})
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-0">
                                            {approvedFiles.map((file) => {
                                                const formData = fileFormData[file.id] || {};
                                                const markedStatus = markedFiles[file.id];

                                                return (
                                                    <div
                                                        key={file.id}
                                                        className="m-4 bg-white border border-green-200 bg-green-50 rounded-lg shadow-sm overflow-hidden"
                                                    >
                                                        <div className="px-6 py-4">
                                                            <div className="flex gap-4 items-start">
                                                                {/* Thumbnail */}
                                                                <div className="flex-shrink-0">
                                                                    <div className="w-24 h-24 bg-gray-200 rounded overflow-hidden border border-gray-300">
                                                                        {file.fileType === 'image' ? (
                                                                            <img
                                                                                src={`/api/v1/media/pending-files/${file.id}/preview/`}
                                                                                alt={formData?.title || file.originalFilename}
                                                                                className="w-full h-full object-cover"
                                                                                onError={(e) => {
                                                                                    e.target.style.display = 'none';
                                                                                    e.target.nextSibling.style.display = 'flex';
                                                                                }}
                                                                            />
                                                                        ) : null}
                                                                        <div className={`w-full h-full flex items-center justify-center ${file.fileType === 'image' ? 'hidden' : 'flex'}`}>
                                                                            <div className="text-gray-500 text-sm">
                                                                                {getFileTypeIcon(file.fileType)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* File Details */}
                                                                <div className="flex-1 min-w-0">
                                                                    {/* Header Row */}
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <h3 className="text-sm font-large text-gray-900 truncate">
                                                                                {formData?.title && formData?.title || file.originalFilename}
                                                                                {formData?.slug && (
                                                                                    <small className="ml-2 rounded text-xs">[{formData.slug}]</small>
                                                                                )}
                                                                            </h3>
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                                                                                <Check className="w-3 h-3" />
                                                                                Approved
                                                                            </span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => unmarkFile(file.id)}
                                                                            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                                                                            title="Unmark file"
                                                                        >
                                                                            <RefreshCw className="w-4 h-4" />
                                                                            Unmark
                                                                        </button>
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

                                                                    {/* File Info and Dates */}
                                                                    <div className="space-y-1 text-xs text-gray-500 pt-2 border-t border-gray-200">
                                                                        <div>
                                                                            Marked on {new Date(markedStatus.timestamp).toLocaleString()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Rejected Files List */}
                                {rejectedFiles.length > 0 && (
                                    <div className="mb-8">
                                        <div className="bg-red-50 px-6 py-3 border-b border-red-200">
                                            <div className="flex items-center gap-2">
                                                <X className="w-5 h-5 text-red-600" />
                                                <span className="text-sm font-medium text-red-800">
                                                    Rejected Files ({rejectedFiles.length})
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-0">
                                            {rejectedFiles.map((file) => {
                                                const markedStatus = markedFiles[file.id];

                                                return (
                                                    <div
                                                        key={file.id}
                                                        className="m-4 bg-white border border-red-200 bg-red-50 rounded-lg shadow-sm overflow-hidden"
                                                    >
                                                        <div className="px-6 py-4">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex items-start gap-3 flex-1">
                                                                    <div className="mr-3 mt-1">
                                                                        {getFileTypeIcon(file.fileType)}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <h3 className="text-sm font-medium text-gray-900">
                                                                                {file.originalFilename}
                                                                            </h3>
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full font-medium">
                                                                                <X className="w-3 h-3" />
                                                                                Rejected
                                                                            </span>
                                                                        </div>

                                                                        {/* File Info and Dates */}
                                                                        <div className="space-y-1 text-xs text-gray-500 pt-2 border-t border-gray-200">
                                                                            <div className="flex items-center gap-4">
                                                                                <span>{formatFileSize(file.fileSize)}</span>
                                                                                <span className="flex items-center gap-1">
                                                                                    <Calendar className="w-3 h-3" />
                                                                                    {formatDate(file.createdAt)}
                                                                                </span>
                                                                                <span className="flex items-center gap-1">
                                                                                    <Clock className="w-3 h-3" />
                                                                                    Expires {formatDate(file.expiresAt)}
                                                                                </span>
                                                                            </div>
                                                                            <div>
                                                                                Marked on {new Date(markedStatus.timestamp).toLocaleString()}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => unmarkFile(file.id)}
                                                                    className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors ml-4"
                                                                    title="Unmark file"
                                                                >
                                                                    <RefreshCw className="w-4 h-4" />
                                                                    Unmark
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Submit Section - positioned after approved and rejected files */}
                                {Object.keys(markedFiles).length > 0 && (
                                    <div className="mx-4">
                                        <div className="mb-4 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                                            <h3 className="text-lg font-semibold text-blue-900 mb-4">
                                                Submit Marked Files ({Object.keys(markedFiles).length})
                                            </h3>

                                            <div className="space-y-4">
                                                {/* Collection Selection */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Media Collection (Optional)
                                                    </label>
                                                    <div className="space-y-2">
                                                        <select
                                                            value={selectedCollection}
                                                            onChange={(e) => setSelectedCollection(e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="">No Collection</option>
                                                            {availableCollections.map(collection => (
                                                                <option key={collection.id} value={collection.id}>
                                                                    {collection.name}
                                                                </option>
                                                            ))}
                                                            <option value="new">Create New Collection</option>
                                                        </select>

                                                        {selectedCollection === 'new' && (
                                                            <input
                                                                type="text"
                                                                value={newCollectionName}
                                                                onChange={(e) => setNewCollectionName(e.target.value)}
                                                                placeholder="Enter new collection name"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Submit Button */}
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={handleSubmitMarkedFiles}
                                                        disabled={selectedCollection === 'new' && !newCollectionName.trim()}
                                                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                                                    >
                                                        Submit All
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Pending Review Files List */}
                                {pendingReviewFiles.length > 0 && (
                                    <div>
                                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-gray-600" />
                                                <span className="text-sm font-medium text-gray-700">
                                                    Pending Review ({pendingReviewFiles.length})
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-0">
                                            {pendingReviewFiles.map((file) => {
                                                const isExpiringSoon = new Date(file.expiresAt) - new Date() < 2 * 60 * 60 * 1000; // 2 hours
                                                const formData = fileFormData[file.id] || {};
                                                const markedStatus = markedFiles[file.id];

                                                return (
                                                    <div
                                                        key={file.id}
                                                        className={`m-4 bg-white border rounded-lg shadow-sm overflow-hidden ${
                                                            selectedFiles.has(file.id) 
                                                                ? 'border-blue-500 border-2 bg-blue-50' 
                                                                : 'border-gray-200'
                                                        }`}
                                                    >
                                                        {/* Unmarked files - integrated header with approval form */}
                                                        <div className="px-6 py-6">
                                                            {/* Selection Checkbox */}
                                                            <div className="flex items-start gap-4 mb-4">
                                                                <div className="flex items-center pt-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedFiles.has(file.id)}
                                                                        onChange={() => toggleFileSelection(file.id)}
                                                                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h4 className="text-base font-semibold text-gray-900">
                                                                        {file.originalFilename}
                                                                    </h4>
                                                                    {selectedFiles.has(file.id) && (
                                                                        <p className="text-sm text-blue-600 mt-1">
                                                                            Selected for bulk actions
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Form Section */}
                                                            <div className="flex gap-6">
                                                                {/* Thumbnail */}
                                                                <div className="flex-shrink-0">
                                                                    <div className="w-64 h-64 bg-gray-200 rounded-lg overflow-hidden border border-gray-300">
                                                                        {file.fileType === 'image' ? (
                                                                            <img
                                                                                src={`/api/v1/media/pending-files/${file.id}/preview/`}
                                                                                alt={file.originalFilename}
                                                                                className="w-full h-full object-cover"
                                                                                onError={(e) => {
                                                                                    e.target.style.display = 'none';
                                                                                    e.target.nextSibling.style.display = 'flex';
                                                                                }}
                                                                            />
                                                                        ) : null}
                                                                        <div className={`w-full h-full flex items-center justify-center ${file.fileType === 'image' ? 'hidden' : 'flex'}`}>
                                                                            {getFileTypeIcon(file.fileType)}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Form Content */}
                                                                <div className="flex-1">
                                                                    <div className="space-y-6">
                                                                        {/* Title and Slug Row */}
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                            {/* Title */}
                                                                            <div>
                                                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                                    Title *
                                                                                </label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={formData.title || ''}
                                                                                    onChange={(e) => updateFormData(file.id, 'title', e.target.value)}
                                                                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors[file.id]?.title
                                                                                        ? 'border-red-300 bg-red-50'
                                                                                        : 'border-gray-300'
                                                                                        }`}
                                                                                    placeholder="Enter file title"
                                                                                />
                                                                                {fieldErrors[file.id]?.title && (
                                                                                    <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                                                        <AlertCircle className="w-4 h-4" />
                                                                                        {fieldErrors[file.id].title}
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Slug */}
                                                                            <div>
                                                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                                    Slug
                                                                                </label>
                                                                                <div className="relative">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={formData.slug || ''}
                                                                                        onChange={(e) => handleManualSlugChange(file.id, e.target.value)}
                                                                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors[file.id]?.slug
                                                                                            ? 'border-red-300 bg-red-50'
                                                                                            : 'border-gray-300'
                                                                                            }`}
                                                                                        placeholder="Enter or edit slug"
                                                                                    />
                                                                                    {validatingSlugs[file.id] && (
                                                                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                                                                            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                {fieldErrors[file.id]?.slug && (
                                                                                    <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                                                        <AlertCircle className="w-4 h-4" />
                                                                                        {fieldErrors[file.id].slug}
                                                                                    </div>
                                                                                )}
                                                                                {autoUpdatedSlugs[file.id] && (
                                                                                    <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                                                                        <AlertCircle className="w-3 h-3" />
                                                                                        Slug was automatically updated to ensure uniqueness
                                                                                        {autoUpdatedSlugs[file.id].originalSlug && (
                                                                                            <span className="text-gray-500">
                                                                                                (was: {autoUpdatedSlugs[file.id].originalSlug})
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Tags Section */}
                                                                        <div>
                                                                            <div className="flex items-center justify-between mb-3">
                                                                                <h4 className="text-sm font-medium text-gray-700">
                                                                                    Tags <span className="text-red-500">*</span>
                                                                                </h4>
                                                                                {(!formData.tags || formData.tags.length === 0) && (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
                                                                                        <AlertCircle className="w-3 h-3" />
                                                                                        Required
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            <div className={`bg-white p-4 rounded-md border ${fieldErrors[file.id]?.tags
                                                                                ? 'border-red-300 bg-red-50'
                                                                                : 'border-gray-200'
                                                                                }`}>
                                                                                <MediaTagWidget
                                                                                    tags={formData.tags || []}
                                                                                    onChange={(tags) => {
                                                                                        // Ensure we're passing an array of tag objects
                                                                                        const formattedTags = tags.map(tag => {
                                                                                            if (typeof tag === 'string') {
                                                                                                return { name: tag };
                                                                                            }
                                                                                            return tag;
                                                                                        });
                                                                                        updateFormData(file.id, 'tags', formattedTags);
                                                                                    }}
                                                                                    namespace={namespace}
                                                                                    disabled={false}
                                                                                />
                                                                            </div>
                                                                            {fieldErrors[file.id]?.tags && (
                                                                                <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                                                    <AlertCircle className="w-4 h-4" />
                                                                                    {fieldErrors[file.id].tags}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="mt-4 flex justify-end gap-3">
                                                                            <button
                                                                                onClick={() => handleMarkForRejection(file)}
                                                                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                                Reject
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleMarkForApproval(file)}
                                                                                disabled={!formData.title?.trim() || !formData.tags || formData.tags.length === 0}
                                                                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                            >
                                                                                <Check className="w-3 h-3" />
                                                                                Approve
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* File Info and Dates */}
                                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                                    <span>{formatFileSize(file.fileSize)}</span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {formatDate(file.createdAt)}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        Expires {formatDate(file.expiresAt)}
                                                                    </span>
                                                                    {isExpiringSoon && (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                                                                            <Clock className="w-3 h-3" />
                                                                            Expiring Soon
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PendingMediaManager;
