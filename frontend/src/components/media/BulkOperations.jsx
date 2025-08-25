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

import React, { useState, useEffect } from 'react';
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

const BulkOperations = ({
    selectedFiles = [],
    namespace,
    onOperationComplete,
    onClose,
    className = ''
}) => {
    const [operation, setOperation] = useState('');
    const [operationData, setOperationData] = useState({});
    const [availableTags, setAvailableTags] = useState([]);
    const [availableCollections, setAvailableCollections] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ completed: 0, total: 0, errors: [] });
    const [showProgress, setShowProgress] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [newCollectionName, setNewCollectionName] = useState('');

    const { addNotification } = useGlobalNotifications();

    // Load available tags and collections
    useEffect(() => {
        const loadData = async () => {
            if (!namespace) return;

            try {
                const [tagsResult, collectionsResult] = await Promise.all([
                    mediaTagsApi.list({ namespace }),
                    mediaCollectionsApi.list({ namespace })
                ]);

                setAvailableTags(tagsResult.results || tagsResult || []);
                setAvailableCollections(collectionsResult.results || collectionsResult || []);
            } catch (error) {
                console.error('Failed to load data:', error);
                addNotification('Failed to load tags and collections', 'error');
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
    };

    // Create new tag
    const createNewTag = async () => {
        if (!newTagName.trim()) return;

        try {
            const newTag = await mediaTagsApi.create({
                name: newTagName.trim(),
                namespace: namespace
            });
            
            setAvailableTags(prev => [...prev, newTag]);
            setOperationData(prev => ({
                ...prev,
                tagIds: [...(prev.tagIds || []), newTag.id]
            }));
            setNewTagName('');
            addNotification(`Tag "${newTag.name}" created`, 'success');
        } catch (error) {
            console.error('Failed to create tag:', error);
            addNotification('Failed to create tag', 'error');
        }
    };

    // Create new collection
    const createNewCollection = async () => {
        if (!newCollectionName.trim()) return;

        try {
            const newCollection = await mediaCollectionsApi.create({
                title: newCollectionName.trim(),
                namespace: namespace
            });
            
            setAvailableCollections(prev => [...prev, newCollection]);
            setOperationData(prev => ({
                ...prev,
                collectionId: newCollection.id
            }));
            setNewCollectionName('');
            addNotification(`Collection "${newCollection.title}" created`, 'success');
        } catch (error) {
            console.error('Failed to create collection:', error);
            addNotification('Failed to create collection', 'error');
        }
    };

    // Execute bulk operation
    const executeBulkOperation = async () => {
        if (!operation || selectedFiles.length === 0) return;

        setProcessing(true);
        setShowProgress(true);
        setProgress({ completed: 0, total: selectedFiles.length, errors: [] });

        try {
            const fileIds = selectedFiles.map(file => file.id);
            const requestData = {
                file_ids: fileIds,
                operation: operation,
                ...operationData
            };

            // Call the bulk operations API
            const result = await mediaApi.bulkOperations.execute(requestData);

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
            case 'remove_tags':
                return operationData.tagIds && operationData.tagIds.length > 0;
            case 'set_access_level':
                return operationData.accessLevel;
            case 'add_to_collection':
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
            case 'remove_tags':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Tags
                            </label>
                            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                                {availableTags.map(tag => (
                                    <label key={tag.id} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={(operationData.tagIds || []).includes(tag.id)}
                                            onChange={(e) => {
                                                const tagIds = operationData.tagIds || [];
                                                if (e.target.checked) {
                                                    setOperationData(prev => ({
                                                        ...prev,
                                                        tagIds: [...tagIds, tag.id]
                                                    }));
                                                } else {
                                                    setOperationData(prev => ({
                                                        ...prev,
                                                        tagIds: tagIds.filter(id => id !== tag.id)
                                                    }));
                                                }
                                            }}
                                            className="rounded border-gray-300"
                                        />
                                        <span
                                            className="inline-block w-3 h-3 rounded-full"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <span className="text-sm">{tag.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {operation === 'add_tags' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Create New Tag
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        placeholder="Enter tag name"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onKeyPress={(e) => e.key === 'Enter' && createNewTag()}
                                    />
                                    <button
                                        type="button"
                                        onClick={createNewTag}
                                        disabled={!newTagName.trim()}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'set_access_level':
                return (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Access Level
                        </label>
                        <div className="space-y-2">
                            {accessLevels.map(level => (
                                <label key={level.value} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
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
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Collection
                            </label>
                            <select
                                value={operationData.collectionId || ''}
                                onChange={(e) => setOperationData(prev => ({
                                    ...prev,
                                    collectionId: e.target.value
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a collection...</option>
                                {availableCollections.map(collection => (
                                    <option key={collection.id} value={collection.id}>
                                        {collection.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {operation === 'add_to_collection' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Create New Collection
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newCollectionName}
                                        onChange={(e) => setNewCollectionName(e.target.value)}
                                        placeholder="Enter collection name"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onKeyPress={(e) => e.key === 'Enter' && createNewCollection()}
                                    />
                                    <button
                                        type="button"
                                        onClick={createNewCollection}
                                        disabled={!newCollectionName.trim()}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'delete':
                return (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <h4 className="font-medium text-red-800">Confirm Deletion</h4>
                        </div>
                        <p className="text-red-700 mb-3">
                            This action will permanently delete {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} 
                            and cannot be undone. All references to these files will be broken.
                        </p>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={operationData.confirmDelete || false}
                                onChange={(e) => setOperationData(prev => ({
                                    ...prev,
                                    confirmDelete: e.target.checked
                                }))}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm text-red-700">
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
        return op ? op.color : 'bg-gray-600 hover:bg-gray-700';
    };

    return (
        <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Bulk Operations</h3>
                    <p className="text-sm text-gray-600">
                        {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                    </p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="p-4">
                {!showProgress ? (
                    <>
                        {/* Operation Selection */}
                        {!operation && (
                            <div className="space-y-3">
                                <h4 className="font-medium text-gray-900 mb-3">Select Operation</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {operations.map(op => (
                                        <button
                                            key={op.id}
                                            onClick={() => handleOperationSelect(op.id)}
                                            className={`flex items-center gap-3 p-4 text-left text-white rounded-lg transition-colors ${op.color}`}
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
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-gray-900">
                                        {operations.find(op => op.id === operation)?.label}
                                    </h4>
                                    <button
                                        onClick={() => setOperation('')}
                                        className="text-sm text-gray-500 hover:text-gray-700"
                                    >
                                        ← Back to operations
                                    </button>
                                </div>

                                {renderOperationForm()}

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={executeBulkOperation}
                                        disabled={!isOperationValid() || processing || (operation === 'delete' && !operationData.confirmDelete)}
                                        className={`flex items-center gap-2 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getOperationColor(operation)}`}
                                    >
                                        {processing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                {operations.find(op => op.id === operation)?.icon}
                                                Execute Operation
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setOperation('')}
                                        disabled={processing}
                                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
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
                        <h4 className="font-medium text-gray-900">Operation Progress</h4>
                        
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
                                    <h5 className="font-medium text-red-800 mb-2">Errors:</h5>
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
