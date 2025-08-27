/**
 * MediaCollectionManager Component
 * 
 * Comprehensive interface for managing media collections with:
 * - List view with search and filtering
 * - Create, edit, delete collections
 * - View collection contents
 * - Add/remove files from collections
 * - Bulk operations
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search,
    Plus,
    Edit3,
    Trash2,
    Eye,
    Folder,
    FolderOpen,
    Users,
    Lock,
    Globe,
    Shield,
    Calendar,
    User,
    Tag,
    FileText,
    Image,
    Video,
    Music,
    Archive,
    File,
    ChevronDown,
    ChevronUp,
    MoreVertical,
    X,
    Check,
    AlertCircle,
    Loader2,
    Grid3X3,
    List as ListIcon,
    Filter,
    SortAsc,
    SortDesc
} from 'lucide-react';
import { mediaCollectionsApi, mediaTagsApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import MediaTagWidget from './MediaTagWidget';
import MediaBrowser from './MediaBrowser';
import { extractErrorMessage } from '../../utils/errorHandling';

const MediaCollectionManager = ({ namespace, onCollectionSelect }) => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('updated_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

    // Filters
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        accessLevel: '',
        createdBy: '',
        tags: []
    });

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showFilesModal, setShowFilesModal] = useState(false);
    const [selectedCollection, setSelectedCollection] = useState(null);

    // Form data
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        accessLevel: 'public',
        tagIds: []
    });

    // Available tags for form
    const [availableTags, setAvailableTags] = useState([]);

    const { addNotification } = useGlobalNotifications();

    // Load collections
    const loadCollections = useCallback(async () => {
        if (!namespace) return;

        try {
            setLoading(true);
            setError(null);

            const params = {
                namespace: namespace,
                search: searchQuery || undefined,
                ordering: `${sortOrder === 'desc' ? '-' : ''}${sortBy}`,
                ...filters
            };

            // Remove empty filters
            Object.keys(params).forEach(key => {
                if (params[key] === '' || (Array.isArray(params[key]) && params[key].length === 0)) {
                    delete params[key];
                }
            });

            const result = await mediaCollectionsApi.list(params)();
            const collectionsData = result.results || result || [];
            setCollections(Array.isArray(collectionsData) ? collectionsData : []);
        } catch (error) {
            console.error('Failed to load collections:', error);
            setError(extractErrorMessage(error));
            setCollections([]); // Ensure collections is always an array
            addNotification('Failed to load collections', 'error');
        } finally {
            setLoading(false);
        }
    }, [namespace, searchQuery, sortBy, sortOrder, filters, addNotification]);

    // Load available tags
    const loadAvailableTags = useCallback(async () => {
        if (!namespace) return;

        try {
            const result = await mediaTagsApi.list({ namespace })();
            setAvailableTags(result.results || result);
        } catch (error) {
            console.error('Failed to load tags:', error);
        }
    }, [namespace]);

    // Load data on mount and when dependencies change
    useEffect(() => {
        if (namespace) {
            loadCollections();
            loadAvailableTags();
        }
    }, [loadCollections, loadAvailableTags, namespace]);

    // Handle search
    const handleSearch = useCallback((query) => {
        setSearchQuery(query);
    }, []);

    // Handle sort change
    const handleSortChange = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    // Handle filter change
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            accessLevel: 'public',
            tagIds: []
        });
    };

    // Handle create collection
    const handleCreate = () => {
        resetForm();
        setShowCreateModal(true);
    };

    // Handle edit collection
    const handleEdit = (collection) => {
        setSelectedCollection(collection);
        setFormData({
            title: collection.title,
            description: collection.description || '',
            accessLevel: collection.accessLevel,
            tagIds: collection.tags?.map(tag => tag.id) || []
        });
        setShowEditModal(true);
    };

    // Handle delete collection
    const handleDelete = (collection) => {
        setSelectedCollection(collection);
        setShowDeleteModal(true);
    };

    // Handle view collection files
    const handleViewFiles = (collection) => {
        setSelectedCollection(collection);
        setShowFilesModal(true);
    };

    // Submit create/edit form
    const handleSubmit = async (isEdit = false) => {
        try {
            const collectionData = {
                ...formData,
                namespace: namespace,
                tag_ids: formData.tagIds
            };

            let result;
            if (isEdit) {
                result = await mediaCollectionsApi.update(selectedCollection.id, collectionData)();
                addNotification('Collection updated successfully', 'success');
            } else {
                result = await mediaCollectionsApi.create(collectionData)();
                addNotification('Collection created successfully', 'success');
            }

            // Refresh collections
            await loadCollections();

            // Close modal
            setShowCreateModal(false);
            setShowEditModal(false);
            resetForm();
        } catch (error) {
            console.error('Failed to save collection:', error);
            addNotification(extractErrorMessage(error), 'error');
        }
    };

    // Confirm delete
    const confirmDelete = async () => {
        try {
            await mediaCollectionsApi.delete(selectedCollection.id)();
            addNotification('Collection deleted successfully', 'success');

            // Refresh collections
            await loadCollections();

            setShowDeleteModal(false);
            setSelectedCollection(null);
        } catch (error) {
            console.error('Failed to delete collection:', error);
            addNotification(extractErrorMessage(error), 'error');
        }
    };

    // Get access level icon and color
    const getAccessLevelInfo = (accessLevel) => {
        switch (accessLevel) {
            case 'public':
                return { icon: Globe, color: 'text-green-600', label: 'Public' };
            case 'members':
                return { icon: Users, color: 'text-blue-600', label: 'Members' };
            case 'staff':
                return { icon: Shield, color: 'text-purple-600', label: 'Staff' };
            case 'private':
                return { icon: Lock, color: 'text-red-600', label: 'Private' };
            default:
                return { icon: Globe, color: 'text-gray-600', label: 'Unknown' };
        }
    };

    // Format date with error handling
    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Render collection card
    const renderCollectionCard = (collection) => {
        const accessInfo = getAccessLevelInfo(collection.accessLevel);
        const AccessIcon = accessInfo.icon;

        return (
            <div key={collection.id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                {/* Header */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Folder className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                <h3 className="text-lg font-medium text-gray-900 truncate">
                                    {collection.title}
                                </h3>
                            </div>
                            {collection.description && (
                                <p className="text-sm text-gray-600 line-clamp-2">
                                    {collection.description}
                                </p>
                            )}
                        </div>

                        {/* Actions dropdown */}
                        <div className="relative ml-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Toggle dropdown logic here
                                }}
                                className="p-1 rounded-md hover:bg-gray-100"
                            >
                                <MoreVertical className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* Stats */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                                <FileText className="w-4 h-4" />
                                {collection.fileCount || 0} files
                            </span>
                            <span className={`flex items-center gap-1 ${accessInfo.color}`}>
                                <AccessIcon className="w-4 h-4" />
                                {accessInfo.label}
                            </span>
                        </div>
                    </div>

                    {/* Tags */}
                    {collection.tags && collection.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                            {collection.tags.slice(0, 3).map(tag => (
                                <span
                                    key={tag.id}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                    style={{
                                        backgroundColor: `${tag.color}20`,
                                        color: tag.color
                                    }}
                                >
                                    {tag.name}
                                </span>
                            ))}
                            {collection.tags.length > 3 && (
                                <span className="text-xs text-gray-500">
                                    +{collection.tags.length - 3} more
                                </span>
                            )}
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Updated {formatDate(collection.updatedAt)}
                        </div>
                        <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            By {collection.createdByName || 'Unknown'}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <button
                        onClick={() => handleViewFiles(collection)}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                    >
                        <Eye className="w-4 h-4" />
                        View Files
                    </button>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleEdit(collection)}
                            className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit collection"
                        >
                            <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleDelete(collection)}
                            className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete collection"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (!namespace) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Please select a namespace to manage collections</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Media Collections</h2>
                    <p className="text-gray-600">Organize your media files into collections</p>
                </div>

                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Collection
                </button>
            </div>

            {/* Search and Controls */}
            <div className="flex items-center gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search collections..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                        title="Grid view"
                    >
                        <Grid3X3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                        title="List view"
                    >
                        <ListIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Sort */}
                <div className="relative">
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                            const [field, order] = e.target.value.split('-');
                            setSortBy(field);
                            setSortOrder(order);
                        }}
                        className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="updated_at-desc">Recently Updated</option>
                        <option value="created_at-desc">Recently Created</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">Error loading collections</span>
                    </div>
                    <p className="text-red-700 mt-1">{error}</p>
                    <button
                        onClick={loadCollections}
                        className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Collections Grid/List */}
            {!loading && !error && (
                <>
                    {collections.length === 0 ? (
                        <div className="text-center py-12">
                            <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No collections found</h3>
                            <p className="text-gray-600 mb-4">
                                {searchQuery ? 'No collections match your search criteria.' : 'Get started by creating your first collection.'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={handleCreate}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Collection
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className={
                            viewMode === 'grid'
                                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                                : 'space-y-4'
                        }>
                            {Array.isArray(collections) && collections.map(collection =>
                                renderCollectionCard(collection)
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {showCreateModal ? 'Create Collection' : 'Edit Collection'}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setShowEditModal(false);
                                        resetForm();
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={(e) => {
                                e.preventDefault();
                                handleSubmit(showEditModal);
                            }} className="space-y-4">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Collection title..."
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Optional description..."
                                    />
                                </div>

                                {/* Access Level */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Access Level
                                    </label>
                                    <select
                                        value={formData.accessLevel}
                                        onChange={(e) => setFormData(prev => ({ ...prev, accessLevel: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="public">Public</option>
                                        <option value="members">Members Only</option>
                                        <option value="staff">Staff Only</option>
                                        <option value="private">Private</option>
                                    </select>
                                </div>

                                {/* Tags */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tags
                                    </label>
                                    <MediaTagWidget
                                        namespace={namespace}
                                        selectedTags={formData.tagIds}
                                        onTagsChange={(tagIds) => setFormData(prev => ({ ...prev, tagIds }))}
                                        availableTags={availableTags}
                                        onTagsUpdate={loadAvailableTags}
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            setShowEditModal(false);
                                            resetForm();
                                        }}
                                        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                    >
                                        {showCreateModal ? 'Create' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedCollection && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Delete Collection</h3>
                                    <p className="text-sm text-gray-600">This action cannot be undone</p>
                                </div>
                            </div>

                            <p className="text-gray-700 mb-6">
                                Are you sure you want to delete the collection "{selectedCollection.title}"?
                                This will remove the collection but not the files in it.
                            </p>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setSelectedCollection(null);
                                    }}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Delete Collection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaCollectionManager;
