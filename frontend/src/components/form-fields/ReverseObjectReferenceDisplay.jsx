import React from 'react'
import { ExternalLink, Loader2, ArrowLeft } from 'lucide-react'
import { useReverseReferences } from '../../hooks/useObjectReferences'
import { Link } from 'react-router-dom'

/**
 * ReverseObjectReferenceDisplay Component
 * 
 * Read-only display component for reverse_object_reference fields.
 * Shows objects that reference the current object with links to their detail pages.
 */
const ReverseObjectReferenceDisplay = ({
    objectId,
    label,
    description,
    // Field config from schema
    reverse_relationship_type,
    reverse_object_types = [],
    show_count = true,
    link_to_objects = true,
    ...props
}) => {
    const {
        objects,
        count,
        isLoading,
        isError,
        error
    } = useReverseReferences(objectId, reverse_relationship_type, {
        enabled: !!objectId && !!reverse_relationship_type,
        reverse_object_types
    })

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-2">
                {label && (
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                    </label>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500 p-4 bg-gray-50 rounded-md">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading reverse references...</span>
                </div>
            </div>
        )
    }

    // Error state
    if (isError) {
        return (
            <div className="space-y-2">
                {label && (
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                    </label>
                )}
                <div className="text-sm text-red-600 p-4 bg-red-50 rounded-md">
                    Error loading reverse references: {error?.message}
                </div>
            </div>
        )
    }

    // No references state
    if (!objects || objects.length === 0) {
        return (
            <div className="space-y-2">
                {label && (
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                        {show_count && <span className="text-gray-500 ml-2">(0)</span>}
                    </label>
                )}
                {description && (
                    <div className="text-sm text-gray-500">{description}</div>
                )}
                <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-md">
                    No {reverse_relationship_type} references
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {/* Label with Count */}
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {show_count && <span className="text-gray-500 ml-2">({count})</span>}
                </label>
            )}

            {/* Description */}
            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Reverse Reference List */}
            <div className="border border-gray-200 rounded-md bg-gray-50">
                <ul className="divide-y divide-gray-200">
                    {objects.map((rel) => {
                        const obj = rel.object
                        if (!obj) {
                            return (
                                <li key={rel.object_id} className="px-4 py-3">
                                    <div className="text-sm text-gray-400 italic">
                                        Object ID {rel.object_id} (deleted or inaccessible)
                                    </div>
                                </li>
                            )
                        }

                        return (
                            <li key={obj.id} className="px-4 py-3 hover:bg-gray-100 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            {link_to_objects ? (
                                                <Link
                                                    to={`/objects/${obj.id}`}
                                                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                    {obj.title}
                                                </Link>
                                            ) : (
                                                <span className="text-sm font-medium text-gray-900">
                                                    {obj.title}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {obj.object_type?.label || obj.objectType?.label}
                                            {obj.slug && ` • ${obj.slug}`}
                                            {` • ID: ${obj.id}`}
                                        </div>
                                    </div>
                                    {link_to_objects && (
                                        <Link
                                            to={`/objects/${obj.id}`}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </Link>
                                    )}
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </div>

            {/* Relationship Type Badge */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <ArrowLeft className="w-3 h-3" />
                <span>Referenced via "{reverse_relationship_type}"</span>
                {reverse_object_types.length > 0 && (
                    <span className="text-gray-400">
                        (from {reverse_object_types.join(', ')})
                    </span>
                )}
            </div>
        </div>
    )
}

export default ReverseObjectReferenceDisplay

