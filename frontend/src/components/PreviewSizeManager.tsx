import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Save, Edit2, GripVertical } from 'lucide-react';
import { previewSizesApi } from '../api';
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext';

interface PreviewSize {
    id: number;
    name: string;
    width: number;
    height: number | null;
    sortOrder: number;
    isDefault: boolean;
}

interface PreviewSizeManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onSizesUpdated: () => void;
}

const PreviewSizeManager: React.FC<PreviewSizeManagerProps> = ({
    isOpen,
    onClose,
    onSizesUpdated,
}) => {
    const queryClient = useQueryClient();
    const { addNotification } = useGlobalNotifications();

    const [editingId, setEditingId] = useState<number | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        width: 1920,
        height: 1080,
        sortOrder: 0,
    });

    // Fetch preview sizes
    const { data: previewSizesResponse, isLoading } = useQuery({
        queryKey: ['previewSizes'],
        queryFn: () => previewSizesApi.list(),
        enabled: isOpen,
    });

    // Handle paginated API response
    const previewSizes = previewSizesResponse?.results || previewSizesResponse || [];

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data: any) => previewSizesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['previewSizes'] });
            addNotification('Preview size created successfully', 'success');
            setIsAdding(false);
            setFormData({ name: '', width: 1920, height: 1080, sortOrder: 0 });
            onSizesUpdated();
        },
        onError: (error: any) => {
            addNotification(`Failed to create preview size: ${error.message}`, 'error');
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            previewSizesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['previewSizes'] });
            addNotification('Preview size updated successfully', 'success');
            setEditingId(null);
            onSizesUpdated();
        },
        onError: (error: any) => {
            addNotification(`Failed to update preview size: ${error.message}`, 'error');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: number) => previewSizesApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['previewSizes'] });
            addNotification('Preview size deleted successfully', 'success');
            onSizesUpdated();
        },
        onError: (error: any) => {
            addNotification(`Failed to delete preview size: ${error.message}`, 'error');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const submitData = {
            name: formData.name,
            width: formData.width,
            height: formData.height || null,
            sort_order: formData.sortOrder,
            is_default: false,
        };

        if (editingId) {
            updateMutation.mutate({ id: editingId, data: submitData });
        } else {
            createMutation.mutate(submitData);
        }
    };

    const handleEdit = (size: PreviewSize) => {
        setEditingId(size.id);
        setFormData({
            name: size.name,
            width: size.width,
            height: size.height || 0,
            sortOrder: size.sortOrder,
        });
        setIsAdding(true);
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this preview size?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setFormData({ name: '', width: 1920, height: 1080, sortOrder: 0 });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Manage Preview Sizes
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {/* Add/Edit Form */}
                    {isAdding && (
                        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h3 className="text-sm font-medium text-gray-900 mb-3">
                                {editingId ? 'Edit Preview Size' : 'Add New Preview Size'}
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) =>
                                            setFormData({ ...formData, name: e.target.value })
                                        }
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., Desktop, Mobile"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Sort Order
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.sortOrder}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                sortOrder: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Width (px) *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.width}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                width: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        min="1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Height (px) <span className="text-gray-500">(optional)</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.height || ''}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                height: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        min="1"
                                        placeholder="Leave blank for responsive"
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4 mr-1.5" />
                                    {editingId ? 'Update' : 'Add'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Add Button */}
                    {!isAdding && (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full mb-4 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add New Preview Size
                        </button>
                    )}

                    {/* Preview Sizes List */}
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm">Loading preview sizes...</p>
                        </div>
                    ) : previewSizes.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p className="text-sm">No preview sizes configured yet.</p>
                            <p className="text-xs mt-1">Add your first preview size above.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {previewSizes.map((size: PreviewSize) => (
                                <div
                                    key={size.id}
                                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                >
                                    <div className="flex items-center space-x-3">
                                        <GripVertical className="w-4 h-4 text-gray-400" />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {size.name}
                                                {size.isDefault && (
                                                    <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {size.width}px
                                                {size.height && ` × ${size.height}px`}
                                                {!size.height && ' (responsive height)'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleEdit(size)}
                                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        {!size.isDefault && (
                                            <button
                                                onClick={() => handleDelete(size.id)}
                                                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreviewSizeManager;

