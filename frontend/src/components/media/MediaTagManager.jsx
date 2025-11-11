/**
 * MediaTagManager Component
 * 
 * Comprehensive tag management interface with:
 * - Tag list with usage statistics
 * - CRUD operations (create, read, update, delete)
 * - Bulk operations (merge, bulk delete)
 * - File viewing by tag
 * - Search and filtering
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search,
    Plus,
    Edit2,
    Trash2,
    Hash,
    ArrowUpDown,
    MoreVertical,
    GitMerge,
    Files,
    Calendar,
    User,
    Loader2,
    CheckSquare,
    Square,
    AlertCircle,
    X
} from 'lucide-react';
import { mediaTagsApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import MediaBrowser from './MediaBrowser';

const MediaTagManager = ({ namespace, onTagSelect }) => {
    // State
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [selectedTags, setSelectedTags] = useState(new Set());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [editingTag, setEditingTag] = useState(null);
    const [viewingTagFiles, setViewingTagFiles] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const { addNotification } = useGlobalNotifications();
    const searchTimeoutRef = useRef(null);

    // Load tags
    const loadTags = useCallback(async () => {
        if (!namespace) return;

        setLoading(true);
        try {
            const params = {
                namespace,
                page,
                page_size: 20,
                ordering: sortOrder === 'asc' ? sortBy : `-${sortBy}`
            };

            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }

            const response = await mediaTagsApi.getUsageStats(params)();
            const results = response.results || response || [];

            setTags(results);
            setTotalCount(response.count || results.length);
            setTotalPages(Math.ceil((response.count || results.length) / 20));
        } catch (error) {
            console.error('Failed to load tags:', error);
            addNotification('Failed to load tags', 'error');
            setTags([]);
        } finally {
            setLoading(false);
        }
    }, [namespace, page, sortBy, sortOrder, searchQuery, addNotification]);

    // Load tags on mount and when dependencies change
    useEffect(() => {
        loadTags();
    }, [loadTags]);

    // Debounced search
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);

        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set new timeout
        searchTimeoutRef.current = setTimeout(() => {
            setPage(1); // Reset to first page on search
            loadTags();
        }, 300);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // Toggle tag selection
    const toggleTagSelection = (tagId) => {
        const newSelected = new Set(selectedTags);
        if (newSelected.has(tagId)) {
            newSelected.delete(tagId);
        } else {
            newSelected.add(tagId);
        }
        setSelectedTags(newSelected);
    };

    // Select all / deselect all
    const toggleSelectAll = () => {
        if (selectedTags.size === tags.length) {
            setSelectedTags(new Set());
        } else {
            setSelectedTags(new Set(tags.map(tag => tag.id)));
        }
    };

    // Handle sort change with 3-state sorting (asc -> desc -> null)
    const handleSortChange = (field) => {
        if (sortBy === field) {
            // Cycle through: asc -> desc -> null (default)
            if (sortOrder === 'asc') {
                setSortOrder('desc');
            } else {
                // Reset to default (no sort)
                setSortBy('name');
                setSortOrder('asc');
            }
        } else {
            // New field, start with asc
            setSortBy(field);
            setSortOrder('asc');
        }
        setPage(1);
    };

    // Handle delete
    const handleDelete = async (tagId) => {
        if (!confirm('Are you sure you want to delete this tag? This will remove it from all files.')) {
            return;
        }

        try {
            await mediaTagsApi.delete(tagId)();
            addNotification('Tag deleted successfully', 'success');
            loadTags();
            setSelectedTags(new Set());
        } catch (error) {
            console.error('Failed to delete tag:', error);
            addNotification('Failed to delete tag', 'error');
        }
    };

    // Handle bulk delete
    const handleBulkDelete = async () => {
        if (selectedTags.size === 0) return;

        if (!confirm(`Are you sure you want to delete ${selectedTags.size} tag(s)? This will remove them from all files.`)) {
            return;
        }

        try {
            await mediaTagsApi.bulkDelete(Array.from(selectedTags))();
            addNotification(`Successfully deleted ${selectedTags.size} tag(s)`, 'success');
            loadTags();
            setSelectedTags(new Set());
        } catch (error) {
            console.error('Failed to delete tags:', error);
            addNotification('Failed to delete tags', 'error');
        }
    };

    // Handle edit
    const handleEdit = (tag) => {
        setEditingTag(tag);
        setShowCreateModal(true);
    };

    // Handle create new
    const handleCreateNew = () => {
        setEditingTag(null);
        setShowCreateModal(true);
    };

    // Handle view files
    const handleViewFiles = (tag) => {
        setViewingTagFiles(tag);
    };

    // If viewing files for a tag, show MediaBrowser
    if (viewingTagFiles) {
        return (
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewingTagFiles(null)}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
                        >
                            <X className="w-4 h-4" />
                            Back to Tags
                        </button>
                        <span className="text-gray-400">|</span>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: viewingTagFiles.color }}
                            />
                            <Hash className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{viewingTagFiles.name}</span>
                            <span className="text-sm text-gray-500">
                                ({viewingTagFiles.usageCount || 0} files)
                            </span>
                        </div>
                    </div>
                </div>

                <MediaBrowser
                    namespace={namespace}
                    prefilterTags={[viewingTagFiles.id]}
                    showUploader={false}
                />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            {/* Header with actions */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search tags..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {/* Create tag button */}
                    <button
                        onClick={handleCreateNew}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Create Tag
                    </button>
                </div>
            </div>

            {/* Bulk actions bar */}
            {selectedTags.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                        {selectedTags.size} tag(s) selected
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowMergeModal(true)}
                            className="px-3 py-1.5 text-sm bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition-colors flex items-center gap-2"
                            disabled={selectedTags.size < 2}
                        >
                            <GitMerge className="w-4 h-4" />
                            Merge Tags
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="px-3 py-1.5 text-sm bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Selected
                        </button>
                        <button
                            onClick={() => setSelectedTags(new Set())}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            {/* Tags list */}
            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : tags.length === 0 ? (
                <div className="text-center py-12">
                    <Hash className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                        {searchQuery ? 'No tags found' : 'No tags yet'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                        {searchQuery
                            ? 'Try adjusting your search query'
                            : 'Create your first tag to organize media files'}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={handleCreateNew}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Create First Tag
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        {/* Table header */}
                        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
                            <div className="col-span-1 flex items-center">
                                <button
                                    onClick={toggleSelectAll}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    {selectedTags.size === tags.length ? (
                                        <CheckSquare className="w-5 h-5" />
                                    ) : (
                                        <Square className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                            <button
                                onClick={() => handleSortChange('name')}
                                className="col-span-4 flex items-center gap-1 hover:text-blue-600 transition-colors text-left"
                            >
                                Tag Name
                                {sortBy === 'name' && (
                                    <span className="text-blue-600">
                                        {sortOrder === 'asc' ? '↑' : '↓'}
                                    </span>
                                )}
                            </button>
                            <div className="col-span-3">Description</div>
                            <button
                                onClick={() => handleSortChange('file_count')}
                                className="col-span-2 flex items-center justify-center gap-1 hover:text-blue-600 transition-colors"
                            >
                                Files
                                {sortBy === 'file_count' && (
                                    <span className="text-blue-600">
                                        {sortOrder === 'asc' ? '↑' : '↓'}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => handleSortChange('created_at')}
                                className="col-span-1 flex items-center justify-center gap-1 hover:text-blue-600 transition-colors"
                            >
                                Created
                                {sortBy === 'created_at' && (
                                    <span className="text-blue-600">
                                        {sortOrder === 'asc' ? '↑' : '↓'}
                                    </span>
                                )}
                            </button>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        {/* Table rows */}
                        <div className="divide-y divide-gray-200">
                            {tags.map((tag) => (
                                <div
                                    key={tag.id}
                                    className={`grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${selectedTags.has(tag.id) ? 'bg-blue-50' : ''
                                        }`}
                                >
                                    <div className="col-span-1 flex items-center">
                                        <button
                                            onClick={() => toggleTagSelection(tag.id)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            {selectedTags.has(tag.id) ? (
                                                <CheckSquare className="w-5 h-5 text-blue-600" />
                                            ) : (
                                                <Square className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                    <div className="col-span-4 flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        <span className="font-medium truncate">{tag.name}</span>
                                    </div>
                                    <div className="col-span-3 text-sm text-gray-600 truncate">
                                        {tag.description || <span className="italic text-gray-400">No description</span>}
                                    </div>
                                    <div className="col-span-2 text-center">
                                        <button
                                            onClick={() => handleViewFiles(tag)}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                        >
                                            <Files className="w-3 h-3" />
                                            {tag.usageCount || 0}
                                        </button>
                                    </div>
                                    <div className="col-span-1 text-sm text-gray-500 text-center">
                                        {new Date(tag.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="col-span-1 flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => handleEdit(tag)}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Edit tag"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tag.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete tag"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                Showing {tags.length} of {totalCount} tags
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(page - 1)}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(page + 1)}
                                    disabled={page === totalPages}
                                    className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modals */}
            {showCreateModal && (
                <CreateTagModal
                    tag={editingTag}
                    namespace={namespace}
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingTag(null);
                    }}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        setEditingTag(null);
                        loadTags();
                    }}
                />
            )}

            {showMergeModal && (
                <MergeTagsModal
                    selectedTagIds={Array.from(selectedTags)}
                    tags={tags.filter(tag => selectedTags.has(tag.id))}
                    onClose={() => setShowMergeModal(false)}
                    onSuccess={() => {
                        setShowMergeModal(false);
                        setSelectedTags(new Set());
                        loadTags();
                    }}
                />
            )}
        </div>
    );
};

// Create/Edit Tag Modal Component
const CreateTagModal = ({ tag, namespace, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: tag?.name || '',
        slug: tag?.slug || '',
        color: tag?.color || '#3B82F6',
        description: tag?.description || ''
    });
    const [saving, setSaving] = useState(false);
    const { addNotification } = useGlobalNotifications();

    // Auto-generate slug from name (only for new tags)
    const handleNameChange = (e) => {
        const name = e.target.value;
        const updates = { name };
        
        // Only auto-generate slug for new tags, not when editing
        if (!tag) {
            updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }
        
        setFormData({
            ...formData,
            ...updates
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const data = {
                ...formData,
                namespace
            };

            if (tag) {
                // Update existing tag
                await mediaTagsApi.update(tag.id, data)();
                addNotification('Tag updated successfully', 'success');
            } else {
                // Create new tag
                await mediaTagsApi.create(data)();
                addNotification('Tag created successfully', 'success');
            }

            onSuccess();
        } catch (error) {
            console.error('Failed to save tag:', error);
            addNotification(
                error.message || 'Failed to save tag',
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">
                        {tag ? 'Edit Tag' : 'Create Tag'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tag Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={handleNameChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., Marketing Materials"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Slug *
                        </label>
                        <input
                            type="text"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="marketing-materials"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            URL-friendly version of the name
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Color
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={formData.color}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={formData.color}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="#3B82F6"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Optional description of this tag..."
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {tag ? 'Update Tag' : 'Create Tag'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Merge Tags Modal Component
const MergeTagsModal = ({ selectedTagIds, tags, onClose, onSuccess }) => {
    const [targetTagId, setTargetTagId] = useState(selectedTagIds[0] || '');
    const [merging, setMerging] = useState(false);
    const { addNotification } = useGlobalNotifications();

    const sourceTagIds = selectedTagIds.filter(id => id !== targetTagId);
    const sourceTags = tags.filter(tag => sourceTagIds.includes(tag.id));
    const targetTag = tags.find(tag => tag.id === targetTagId);
    const totalFilesToTransfer = sourceTags.reduce((sum, tag) => sum + (tag.usageCount || 0), 0);

    const handleMerge = async () => {
        if (!targetTagId || sourceTagIds.length === 0) {
            addNotification('Please select a target tag', 'error');
            return;
        }

        if (!confirm(
            `Are you sure you want to merge ${sourceTagIds.length} tag(s) into "${targetTag?.name}"? ` +
            `This will transfer approximately ${totalFilesToTransfer} file associations and delete the source tags. This action cannot be undone.`
        )) {
            return;
        }

        setMerging(true);
        try {
            const result = await mediaTagsApi.mergeTags(targetTagId, sourceTagIds)();
            addNotification(
                `Successfully merged ${result.tagsDeleted} tags. ${result.filesTransferred} files transferred.`,
                'success'
            );
            onSuccess();
        } catch (error) {
            console.error('Failed to merge tags:', error);
            addNotification('Failed to merge tags', 'error');
        } finally {
            setMerging(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <GitMerge className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-semibold">Merge Tags</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-800">
                            <p className="font-medium mb-1">This action cannot be undone</p>
                            <p>All files from the source tags will be associated with the target tag, and the source tags will be deleted.</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Target Tag (keep this one)
                        </label>
                        <select
                            value={targetTagId}
                            onChange={(e) => setTargetTagId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            {tags.map(tag => (
                                <option key={tag.id} value={tag.id}>
                                    {tag.name} ({tag.usageCount || 0} files)
                                </option>
                            ))}
                        </select>
                    </div>

                    {targetTag && sourceTagIds.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Tags to Merge (will be deleted)
                            </label>
                            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                                {sourceTags.map(tag => (
                                    <div key={tag.id} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: tag.color }}
                                            />
                                            <span>{tag.name}</span>
                                        </div>
                                        <span className="text-gray-500">{tag.usageCount || 0} files</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-900">
                            <strong>Summary:</strong> Approximately {totalFilesToTransfer} file associations will be transferred to "{targetTag?.name}"
                        </p>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleMerge}
                        disabled={merging || sourceTagIds.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {merging && <Loader2 className="w-4 h-4 animate-spin" />}
                        Merge Tags
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MediaTagManager;

