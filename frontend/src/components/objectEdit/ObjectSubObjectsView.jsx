import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Plus, ChevronRight, Edit } from 'lucide-react'
import { Link } from 'react-router-dom'
import { objectInstancesApi } from '../../api/objectStorage'

const ObjectSubObjectsView = ({ objectType, instance, isNewInstance, onSave, onCancel }) => {
    // Fetch child objects if editing an existing instance
    const { data: childrenResponse, isLoading: childrenLoading } = useQuery({
        queryKey: ['objectInstance', instance?.id, 'children'],
        queryFn: () => objectInstancesApi.getChildren(instance.id),
        enabled: !!instance?.id
    })

    // Fetch allowed child types
    const allowedChildTypes = objectType?.allowedChildTypes || []
    const children = childrenResponse?.data || []

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Sub-objects & Hierarchy
                </h2>

                <div className="space-y-6">
                    {/* Description */}
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <h3 className="text-sm font-medium text-blue-900 mb-2">About Sub-objects</h3>
                        <p className="text-blue-800 text-sm">
                            Sub-objects are child objects that belong to this {objectType?.label?.toLowerCase()}.
                            They inherit context from their parent and can be organized in tree structures for
                            better content organization.
                        </p>
                    </div>

                    {isNewInstance ? (
                        /* New Instance - Can't have children yet */
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Sub-objects Yet</h3>
                            <p className="text-gray-600 mb-4">
                                Sub-objects can be created after saving this {objectType?.label?.toLowerCase()}.
                            </p>
                            <button
                                onClick={onSave}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                            >
                                Save to Enable Sub-objects
                            </button>
                        </div>
                    ) : (
                        /* Existing Instance - Show children and creation options */
                        <div className="space-y-6">
                            {/* Child Creation Section */}
                            {allowedChildTypes.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Sub-object</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {allowedChildTypes.map((childType) => (
                                            <Link
                                                key={childType.id}
                                                to={`/objects/new/${childType.id}/data?parent=${instance.id}`}
                                                className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all group"
                                            >
                                                <div className="flex items-center">
                                                    {childType.iconImage ? (
                                                        <img
                                                            src={childType.iconImage}
                                                            alt={childType.label}
                                                            className="w-8 h-8 object-cover rounded mr-3"
                                                        />
                                                    ) : (
                                                        <Plus className="h-8 w-8 text-gray-400 mr-3" />
                                                    )}
                                                    <div>
                                                        <h4 className="font-medium text-gray-900 group-hover:text-blue-600">
                                                            New {childType.label}
                                                        </h4>
                                                        <p className="text-sm text-gray-500">
                                                            {childType.description || `Create a new ${childType.label.toLowerCase()}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Existing Children */}
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">
                                    Existing Sub-objects ({children.length})
                                </h3>

                                {childrenLoading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : children.length > 0 ? (
                                    <div className="space-y-2">
                                        {children.map((child) => (
                                            <div
                                                key={child.id}
                                                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                                            >
                                                <div className="flex items-center">
                                                    {child.objectType?.iconImage ? (
                                                        <img
                                                            src={child.objectType.iconImage}
                                                            alt={child.objectType.label}
                                                            className="w-6 h-6 object-cover rounded mr-3"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 bg-gray-200 rounded mr-3 flex items-center justify-center">
                                                            <span className="text-xs text-gray-500">
                                                                {child.objectType?.label?.charAt(0)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h4 className="font-medium text-gray-900">{child.title}</h4>
                                                        <p className="text-sm text-gray-500">
                                                            {child.objectType?.label} • {child.status}
                                                            {child.level > 0 && ` • Level ${child.level}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${child.status === 'published'
                                                            ? 'text-green-700 bg-green-100'
                                                            : child.status === 'draft'
                                                                ? 'text-yellow-700 bg-yellow-100'
                                                                : 'text-gray-700 bg-gray-100'
                                                        }`}>
                                                        {child.status}
                                                    </span>
                                                    <Link
                                                        to={`/objects/${child.id}/edit/content`}
                                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Link>
                                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                                        <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600">
                                            No sub-objects created yet.
                                            {allowedChildTypes.length > 0
                                                ? ' Use the options above to create new sub-objects.'
                                                : ' This object type does not allow child objects.'
                                            }
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Hierarchy Information */}
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Hierarchy Information</h3>
                                <div className="bg-gray-50 rounded-md p-4 space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="font-medium text-gray-700">Current Level:</span>
                                            <span className="ml-2 text-gray-600">{instance?.level || 0}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Tree ID:</span>
                                            <span className="ml-2 text-gray-600">{instance?.treeId || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Direct Children:</span>
                                            <span className="ml-2 text-gray-600">{children.length}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Parent:</span>
                                            <span className="ml-2 text-gray-600">
                                                {instance?.parent ? instance.parentTitle || 'Yes' : 'None (Root level)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                    Back to Objects
                </button>
            </div>
        </div>
    )
}

export default ObjectSubObjectsView
