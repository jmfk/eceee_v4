/**
 * BulkOperations Component
 * 
 * Provides bulk operations UI for mass file management including:
 * - Mass tagging and tag removal
 * - Access level changes
 * - Collection management
 * - File deletion
 * - Progress tracking and error handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Tag,
    Trash2,
    Lock,
    Unlock,
    FolderPlus,
    FolderMinus,
    CheckCircle,
    AlertCircle,
    Loader2,
    X,
    Plus,
    Settings,
    Users,
    Eye,
    EyeOff,
    Archive,
    Download
} from 'lucide-react';
import { mediaApi, mediaTagsApi, mediaCollectionsApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import MediaTagWidget from './MediaTagWidget';
import TagRemovalWidget from './TagRemovalWidget';
import { extractErrorMessage } from '../../utils/errorHandling';

const BulkOperations = ({
    selectedFiles = [],
    namespace,
    initialOperation = '',
    onOperationComplete,
    onClose,
    className = '',
    compact = false,
    showSelectionHeader = true
}) => {
    const [operation, setOperation] = useState(initialOperation);
    const [operationData, setOperationData] = useState({});
    const [availableTags, setAvailableTags] = useState(null);
    const [availableCollections, setAvailableCollections] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ completed: 0, total: 0, errors: [] });
    const [showProgress, setShowProgress] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [newCollectionTagIds, setNewCollectionTagIds] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [existingTagsFromFiles, setExistingTagsFromFiles] = useState([]);
    const [tagsToRemove, setTagsToRemove] = useState([]);

    const { addNotification } = useGlobalNotifications();

    // Gather existing tags from selected files
    const gatherExistingTags = useCallback(() => {
        const allTags = new Set();
        selectedFiles.forEach(file => {
            if (file.tags && Array.isArray(file.tags)) {
                file.tags.forEach(tag => {
                    if (typeof tag === 'string') {
                        allTags.add(tag);
                    } else if (tag && tag.name) {
                        allTags.add(tag.name);
                    }
                });
            }
        });
        return Array.from(allTags);
    }, [selectedFiles]);

    // Update existing tags when selected files change
    useEffect(() => {
        const existingTags = gatherExistingTags();
        setExistingTagsFromFiles(existingTags);

        // For remove_tags operation, initialize with existing tags
        if (operation === 'remove_tags') {
            setSelectedTags(existingTags);
        }
    }, [selectedFiles, operation, gatherExistingTags]);

    // Load available tags and collections
    useEffect(() => {
        const loadData = async () => {
            if (!namespace) return;

            try {
                const [tagsResult, collectionsResult] = await Promise.all([
                    mediaTagsApi.list({ namespace })(),
                    mediaCollectionsApi.list({ namespace })()
                ]);

                setAvailableTags(Array.isArray(tagsResult.results) ? tagsResult.results : Array.isArray(tagsResult) ? tagsResult : []);
                setAvailableCollections(Array.isArray(collectionsResult.results) ? collectionsResult.results : Array.isArray(collectionsResult) ? collectionsResult : []);
            } catch (error) {
                console.error('Failed to load data:', error);
                addNotification('Failed to load tags and collections', 'error');
                // Set empty arrays on error to prevent map errors
                setAvailableTags([]);
                setAvailableCollections([]);
            }
        };

        loadData();
    }, [namespace, addNotification]);

    // Operation definitions
    const operations = [
        {
            id: 'add_tags',
            label: 'Add Tags',
            icon: <Tag className="w-4 h-4" />,
            description: 'Add tags to selected files',
            color: 'bg-blue-600 hover:bg-blue-700'
        },
        {
            id: 'remove_tags',
            label: 'Remove Tags',
            icon: <Tag className="w-4 h-4" />,
            description: 'Remove tags from selected files',
            color: 'bg-orange-600 hover:bg-orange-700'
        },
        {
            id: 'set_access_level',
            label: 'Change Access Level',
            icon: <Lock className="w-4 h-4" />,
            description: 'Update access permissions',
            color: 'bg-purple-600 hover:bg-purple-700'
        },
        {
            id: 'add_to_collection',
            label: 'Add to Collection',
            icon: <FolderPlus className="w-4 h-4" />,
            description: 'Add files to a collection',
            color: 'bg-green-600 hover:bg-green-700'
        },
        {
            id: 'remove_from_collection',
            label: 'Remove from Collection',
            icon: <FolderMinus className="w-4 h-4" />,
            description: 'Remove files from a collection',
            color: 'bg-yellow-600 hover:bg-yellow-700'
        },
        {
            id: 'delete',
            label: 'Delete Files',
            icon: <Trash2 className="w-4 h-4" />,
            description: 'Permanently delete selected files',
            color: 'bg-red-600 hover:bg-red-700'
        }
    ];

    // Access level options
    const accessLevels = [
        { value: 'public', label: 'Public', icon: <Eye className="w-4 h-4" /> },
        { value: 'members', label: 'Members Only', icon: <Users className="w-4 h-4" /> },
        { value: 'staff', label: 'Staff Only', icon: <Settings className="w-4 h-4" /> },
        { value: 'private', label: 'Private', icon: <EyeOff className="w-4 h-4" /> }
    ];

    // Handle operation selection
    const handleOperationSelect = (operationId) => {
        setOperation(operationId);
        setOperationData({});
        setProgress({ completed: 0, total: 0, errors: [] });
        setShowProgress(false);

        // Reset and initialize tags based on operation
        if (operationId === 'add_tags') {
            setSelectedTags([]);
            setTagsToRemove([]);
        } else if (operationId === 'remove_tags') {
            setSelectedTags([]);
            setTagsToRemove([]);
        } else {
            setSelectedTags([]);
            setTagsToRemove([]);
        }
        
        // Reset collection creation fields
        setNewCollectionName('');
        setNewCollectionTagIds([]);
    };



    // Create new collection (called during execute if needed)
    const createNewCollection = async (name, tagIds) => {
        if (!name || !name.trim()) {
            throw new Error('Collection name is required');
        }

        if (!tagIds || tagIds.length === 0) {
            throw new Error('At least one tag is required to create a collection');
        }

        // Ensure tagIds are strings (UUIDs should be strings)
        const normalizedTagIds = tagIds.map(id => String(id));

        const newCollection = await mediaCollectionsApi.create({
            title: name.trim(),
            namespace: namespace,
            tagIds: normalizedTagIds
        })();

        // Add to available collections list
        setAvailableCollections(prev => {
            const exists = prev.some(c => c.id === newCollection.id);
            if (exists) {
                return prev;
            }
            return [...prev, newCollection];
        });

        return newCollection;
    };

    // Execute bulk operation
    const executeBulkOperation = async () => {
        if (!operation || selectedFiles.length === 0) return;

        setProcessing(true);
        setShowProgress(true);
        setProgress({ completed: 0, total: selectedFiles.length, errors: [] });

        try {
            let collectionId = operationData.collectionId;

            // If adding to collection and a new collection name is provided, create it first
            if (operation === 'add_to_collection' && newCollectionName.trim() && !collectionId) {
                try {
                    const newCollection = await createNewCollection(newCollectionName.trim(), newCollectionTagIds);
                    collectionId = newCollection.id;
                    addNotification(`Collection "${newCollection.title}" created`, 'success');
                } catch (error) {
                    console.error('Failed to create collection:', error);
                    addNotification(extractErrorMessage(error) || 'Failed to create collection', 'error');
                    setProcessing(false);
                    setShowProgress(false);
                    return;
                }
            }

            const fileIds = selectedFiles.map(file => file.id);
            const requestData = {
                file_ids: fileIds,
                operation: operation,
                ...operationData,
                collectionId: collectionId || operationData.collectionId
            };

            // Ensure collectionId is null instead of empty string for UUID validation
            if (requestData.collectionId === '') {
                requestData.collectionId = null;
            }

            // Add tag data for tag operations
            if (operation === 'add_tags') {
                requestData.tag_names = selectedTags;
            } else if (operation === 'remove_tags') {
                requestData.tag_names = tagsToRemove;
            }
            // Call the bulk operations API
            const result = await mediaApi.bulkOperations.execute(requestData)();

            setProgress({
                completed: result.successful_count || 0,
                total: selectedFiles.length,
                errors: result.errors || []
            });

            if (result.errors && result.errors.length > 0) {
                addNotification(
                    `Operation completed with ${result.errors.length} errors`,
                    'warning'
                );
            } else {
                addNotification(
                    `Successfully processed ${result.successful_count || selectedFiles.length} files`,
                    'success'
                );
            }

            // Notify parent component
            if (onOperationComplete) {
                onOperationComplete(result);
            }

        } catch (error) {
            console.error('Bulk operation failed:', error);
            setProgress(prev => ({
                ...prev,
                errors: [{ message: error.message || 'Operation failed' }]
            }));
            addNotification('Bulk operation failed', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Validate operation data
    const isOperationValid = () => {
        switch (operation) {
            case 'add_tags':
                return selectedTags && selectedTags.length > 0;
            case 'remove_tags':
                return tagsToRemove && tagsToRemove.length > 0;
            case 'set_access_level':
                return operationData.accessLevel;
            case 'add_to_collection':
                // Valid if either: existing collection selected OR new collection name + tags provided
                return operationData.collectionId || 
                       (newCollectionName.trim() && newCollectionTagIds && newCollectionTagIds.length > 0);
            case 'remove_from_collection':
                return operationData.collectionId;
            case 'delete':
                return true; // No additional data needed
            default:
                return false;
        }
    };

    // Render operation-specific form
    const renderOperationForm = () => {
        switch (operation) {
            case 'add_tags':
                return (
                    <div className={compact ? "space-y-4" : "space-y-5"}>
                        <div>
                            <label className={`block text-sm font-semibold mb-3 ${compact ? 'text-indigo-800' : 'text-gray-800'}`}>
                                Add Tags
                            </label>
                            <div className="bg-white border border-indigo-200 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow duration-200">
                                <MediaTagWidget
                                    tags={selectedTags}
                                    onChange={setSelectedTags}
                                    namespace={namespace}
                                    disabled={processing}
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'remove_tags':
                return (
                    <div className={compact ? "space-y-4" : "space-y-5"}>
                        <div>
                            <label className={`block text-sm font-semibold mb-3 ${compact ? 'text-indigo-800' : 'text-gray-800'}`}>
                                Remove Tags
                            </label>
                            <TagRemovalWidget
                                selectedFiles={selectedFiles}
                                namespace={namespace}
                                onTagsToRemoveChange={setTagsToRemove}
                                className="bg-white border border-indigo-200 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow duration-200"
                            />
                        </div>
                    </div>
                );

            case 'set_access_level':
                return (
                    <div className={compact ? "space-y-4" : "space-y-5"}>
                        <label className={`block text-sm font-semibold mb-3 ${compact ? 'text-indigo-800' : 'text-gray-800'}`}>
                            Select Access Level
                        </label>
                        <div className="space-y-3">
                            {accessLevels.map(level => (
                                <label key={level.value} className="flex items-center space-x-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-indigo-300 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md">
                                    <input
                                        type="radio"
                                        name="accessLevel"
                                        value={level.value}
                                        checked={operationData.accessLevel === level.value}
                                        onChange={(e) => setOperationData(prev => ({
                                            ...prev,
                                            accessLevel: e.target.value
                                        }))}
                                        className="text-blue-600"
                                    />
                                    {level.icon}
                                    <div>
                                        <div className="font-medium">{level.label}</div>
                                        <div className="text-sm text-gray-500">
                                            {level.value === 'public' && 'Visible to everyone'}
                                            {level.value === 'members' && 'Visible to logged-in users'}
                                            {level.value === 'staff' && 'Visible to staff only'}
                                            {level.value === 'private' && 'Visible to owner only'}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                );

            case 'add_to_collection':
            case 'remove_from_collection':
                return (
                    <div className={compact ? "space-y-4" : "space-y-5"}>
                        <div>
                            <label className={`block text-sm font-semibold mb-3 ${compact ? 'text-indigo-800' : 'text-gray-800'}`}>
                                Select Collection
                            </label>
                            <select
                                value={operationData.collectionId || ''}
                                onChange={(e) => setOperationData(prev => ({
                                    ...prev,
                                    collectionId: e.target.value
                                }))}
                                className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-md hover:shadow-lg transition-all duration-200"
                            >
                                <option value="">
                                    {Array.isArray(availableCollections) && availableCollections.length > 0
                                        ? 'Select a collection...'
                                        : availableCollections === null
                                            ? 'Loading collections...'
                                            : 'No collections available'
                                    }
                                </option>
                                {Array.isArray(availableCollections) && availableCollections.map(collection => (
                                    <option key={collection.id} value={collection.id}>
                                        {collection.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {operation === 'add_to_collection' && (
                            <div className="space-y-4">
                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${compact ? 'text-indigo-800' : 'text-gray-800'}`}>
                                        Collection Name (for new collection)
                                    </label>
                                    <input
                                        type="text"
                                        value={newCollectionName}
                                        onChange={(e) => setNewCollectionName(e.target.value)}
                                        placeholder="Enter collection name (leave empty to use existing collection)"
                                        className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-md hover:shadow-lg transition-all duration-200"
                                    />
                                    <div className="text-xs text-gray-500 mt-1">
                                        If you enter a name and tags below, a new collection will be created when you execute the operation.
                                    </div>
                                </div>
                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${compact ? 'text-indigo-800' : 'text-gray-800'}`}>
                                        Tags {newCollectionName.trim() && <span className="text-xs text-gray-500 font-normal">(Required for new collection)</span>}
                                    </label>
                                    {availableTags && Array.isArray(availableTags) ? (
                                        <MediaTagWidget
                                            tags={newCollectionTagIds
                                                .map(id => availableTags.find(tag => tag.id === id))
                                                .filter(Boolean)
                                            }
                                            onChange={(tagObjects) => {
                                                const tagIds = tagObjects.map(tag => tag.id);
                                                setNewCollectionTagIds(tagIds);
                                            }}
                                            namespace={namespace}
                                        />
                                    ) : (
                                        <div className="text-sm text-gray-500">Loading tags...</div>
                                    )}
                                    {newCollectionName.trim() && (!newCollectionTagIds || newCollectionTagIds.length === 0) && (
                                        <div className="text-xs text-amber-600 mt-1">
                                            At least one tag is required to create a new collection
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'delete':
                return (
                    <div className={`bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg shadow-md ${compact ? 'p-4' : 'p-5'}`}>
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                            <div className={`font-semibold text-red-800 ${compact ? 'text-base' : 'text-lg'}`} role="heading" aria-level="4">Confirm Deletion</div>
                        </div>
                        <div className={`text-red-700 mb-4 leading-relaxed ${compact ? 'text-sm' : ''}`}>
                            This action will permanently delete {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                            and cannot be undone. All references to these files will be broken.
                        </div>
                        <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gradient-to-r hover:from-red-100 hover:to-pink-100 transition-all duration-200 hover:shadow-sm">
                            <input
                                type="checkbox"
                                checked={operationData.confirmDelete || false}
                                onChange={(e) => setOperationData(prev => ({
                                    ...prev,
                                    confirmDelete: e.target.checked
                                }))}
                                className="rounded border-gray-300 text-red-600 focus:ring-red-500 mt-0.5 flex-shrink-0 w-4 h-4"
                            />
                            <span className={`text-red-700 font-medium ${compact ? 'text-sm' : ''}`}>
                                I understand this action cannot be undone
                            </span>
                        </label>
                    </div>
                );

            default:
                return null;
        }
    };

    // Get operation button color
    const getOperationColor = (operationId) => {
        const op = operations.find(o => o.id === operationId);
        return op ? op.color : 'bg-blue-50 hover:bg-gray-700 text-white';
    };

    return (
        <div className={`bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-lg shadow-lg`}>
            {/* Selection Header */}
            {showSelectionHeader && selectedFiles.length > 0 && (
                <div className="bg-gradient-to-r from-blue-100 to-indigo-100 border-b border-blue-200">
                    <div className="flex justify-between items-center px-4 py-3">
                        <div className="text-sm text-blue-800 font-semibold">
                            {selectedFiles.length} file(s) selected
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={operation}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleOperationSelect(e.target.value);
                                    }
                                }}
                                className="px-3 py-2 text-sm bg-white border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all duration-200"
                            >
                                <option key="bulk-actions-default" value="">Bulk Actions</option>
                                <option key="add_tags" value="add_tags">Add Tags</option>
                                <option key="remove_tags" value="remove_tags">Remove Tags</option>
                                <option key="add_to_collection" value="add_to_collection">Add to Collection</option>
                                <option key="remove_from_collection" value="remove_from_collection">Remove from Collection</option>
                                <option key="delete" value="delete">Delete Files</option>
                            </select>
                            <button
                                onClick={() => {
                                    if (onClose) onClose();
                                }}
                                className="flex items-center gap-1 px-3 py-2 text-sm text-blue-700 hover:text-white hover:bg-blue-600 rounded-md transition-all duration-200 font-medium shadow-sm"
                            >
                                <X className="w-3 h-3" />
                                Clear Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={compact ? "" : "p-0"}>
                {!showProgress ? (
                    <>
                        {/* Operation Selection - only show if no initial operation and not showing selection header */}
                        {!operation && !initialOperation && !showSelectionHeader && (
                            <div className="p-6 space-y-4 bg-gradient-to-br from-white to-gray-50">
                                <div className="font-bold text-gray-900 text-xl mb-4 text-center" role="heading" aria-level="4">Select Operation</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {operations.map(op => (
                                        <button
                                            key={op.id}
                                            onClick={() => handleOperationSelect(op.id)}
                                            className={`flex items-center gap-3 p-5 text-left text-white rounded-lg transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 hover:scale-105 ${op.color} shadow-md`}
                                        >
                                            {op.icon}
                                            <div>
                                                <div className="font-medium">{op.label}</div>
                                                <div className="text-sm opacity-90">{op.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Operation Form */}
                        {operation && (
                            <div className={compact ? "px-4 pb-4" : "p-6"}>
                                <div className="mt-5">
                                    {renderOperationForm()}
                                </div>

                                {/* Action Buttons */}
                                <div className={`flex gap-3 pt-5 mt-5 ${compact ? 'border-t border-indigo-200' : 'border-t border-gray-200'}`}>
                                    <button
                                        onClick={executeBulkOperation}
                                        disabled={!isOperationValid() || processing || (operation === 'delete' && !operationData.confirmDelete)}
                                        className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:-translate-y-0.5 font-semibold ${getOperationColor(operation)} ${compact ? 'text-sm' : ''} shadow-md `}
                                    >
                                        {processing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                {operations.find(op => op.id === operation)?.icon}
                                                {operations.find(op => op.id === operation)?.label}
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowProgress(false);
                                            setOperation('');
                                            setProgress({ completed: 0, total: 0, errors: [] });
                                        }}
                                        disabled={processing}
                                        className={`px-6 py-3 text-gray-700 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all duration-200 disabled:opacity-50 font-medium shadow-md hover:shadow-lg ${compact ? 'text-sm' : ''}`}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* Progress Display */
                    <div className="space-y-4">
                        <div className="font-medium text-gray-900" role="heading" aria-level="4">Operation Progress</div>

                        <div className="space-y-3">
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                                />
                            </div>

                            <div className="flex justify-between text-sm text-gray-600">
                                <span>{progress.completed} of {progress.total} files processed</span>
                                <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
                            </div>

                            {/* Success/Error Summary */}
                            <div className="flex items-center gap-4">
                                {progress.completed > 0 && (
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-sm">{progress.completed - progress.errors.length} successful</span>
                                    </div>
                                )}
                                {progress.errors.length > 0 && (
                                    <div className="flex items-center gap-2 text-red-600">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="text-sm">{progress.errors.length} errors</span>
                                    </div>
                                )}
                            </div>

                            {/* Error Details */}
                            {progress.errors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <div className="font-medium text-red-800 mb-2" role="heading" aria-level="5">Errors:</div>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {progress.errors.map((error, index) => (
                                            <div key={index} className="text-sm text-red-700">
                                                {error.file_id && `File ${error.file_id}: `}
                                                {error.message}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Close Button */}
                        {!processing && (
                            <div className="pt-4 border-t border-gray-200">
                                <button
                                    onClick={() => {
                                        setShowProgress(false);
                                        setOperation('');
                                        setProgress({ completed: 0, total: 0, errors: [] });
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkOperations;
