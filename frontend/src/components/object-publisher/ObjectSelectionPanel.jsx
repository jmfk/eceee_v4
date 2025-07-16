/**
 * Object Selection Panel Component
 * Handles object type filtering, search, and object listing
 */

import React from 'react';
import {
    Search,
    Link,
    Eye,
    Filter,
    Calendar,
    FileText,
    Users,
    Newspaper,
    X
} from 'lucide-react';

const ObjectSelectionPanel = ({
    selectedObjectType,
    setSelectedObjectType,
    searchQuery,
    setSearchQuery,
    filteredObjects,
    loading,
    linking,
    onObjectSelect,
    onObjectPreview,
    searchStats
}) => {
    const objectTypes = [
        { value: '', label: 'All Types', icon: Filter },
        { value: 'news', label: 'News Article', icon: Newspaper },
        { value: 'event', label: 'Event', icon: Calendar },
        { value: 'libraryitem', label: 'Library Item', icon: FileText },
        { value: 'member', label: 'Member Profile', icon: Users }
    ];

    const getObjectTypeIcon = (type) => {
        const objectType = objectTypes.find(t => t.value === type);
        const IconComponent = objectType?.icon || FileText;
        return <IconComponent className="w-4 h-4" />;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    const clearSearch = () => {
        setSearchQuery('');
    };

    return (
        <div className="space-y-4">
            {/* Object Type Filter */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content Type
                </label>
                <select
                    value={selectedObjectType}
                    onChange={(e) => setSelectedObjectType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={linking}
                >
                    {objectTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                            {type.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Search Bar */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Objects
                </label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by title, description, author..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={linking}
                    />
                    {searchQuery && (
                        <button
                            onClick={clearSearch}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Search Stats */}
            {(searchStats.hasSearchQuery || searchStats.hasTypeFilter) && (
                <div className="text-sm text-gray-600">
                    Showing {searchStats.filtered} of {searchStats.total} objects
                    {searchStats.hasSearchQuery && ` matching "${searchQuery}"`}
                    {searchStats.hasTypeFilter && ` in ${objectTypes.find(t => t.value === selectedObjectType)?.label}`}
                </div>
            )}

            {/* Objects List */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Objects
                </label>
                <div className="border rounded-md max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-500">
                            Loading objects...
                        </div>
                    ) : filteredObjects.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            {searchQuery || selectedObjectType
                                ? 'No objects found matching your criteria'
                                : 'No objects available'
                            }
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {filteredObjects.map((obj) => (
                                <div
                                    key={`${obj.object_type}-${obj.id}`}
                                    className="p-3 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2 mb-1">
                                                {getObjectTypeIcon(obj.object_type)}
                                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                                    {obj.title}
                                                </h4>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${obj.is_published
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {obj.is_published ? 'Published' : 'Draft'}
                                                </span>
                                            </div>
                                            {obj.description && (
                                                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                                    {obj.description}
                                                </p>
                                            )}
                                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                                                {obj.author && (
                                                    <span>By {obj.author}</span>
                                                )}
                                                {obj.published_date && (
                                                    <span>{formatDate(obj.published_date)}</span>
                                                )}
                                                {obj.category && (
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                        {obj.category.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-2">
                                            <button
                                                onClick={() => onObjectPreview(obj.object_type, obj.id)}
                                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                title="Preview object"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onObjectSelect(obj.object_type, obj.id)}
                                                disabled={linking}
                                                className="p-1 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                                                title="Link to page"
                                            >
                                                <Link className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ObjectSelectionPanel; 