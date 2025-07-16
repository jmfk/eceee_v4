/**
 * Object Publisher Component for Phase 7: Object Publishing System
 * 
 * Provides interface for selecting and linking content objects to pages,
 * managing object publishing, and displaying object content.
 */

import React, { useState, useEffect } from 'react';
import {
    Search,
    Link,
    Unlink,
    RefreshCw,
    Eye,
    ExternalLink,
    Filter,
    Calendar,
    FileText,
    Users,
    Newspaper,
    CheckCircle,
    AlertCircle,
    X
} from 'lucide-react';

const ObjectPublisher = ({ pageId, onObjectLinked, onObjectUnlinked }) => {
    const [selectedObjectType, setSelectedObjectType] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [objects, setObjects] = useState([]);
    const [filteredObjects, setFilteredObjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [linking, setLinking] = useState(false);
    const [selectedObject, setSelectedObject] = useState(null);
    const [currentPage, setCurrentPage] = useState(null);
    const [showObjectContent, setShowObjectContent] = useState(false);
    const [objectContent, setObjectContent] = useState(null);

    const objectTypes = [
        { value: '', label: 'All Types', icon: Filter },
        { value: 'news', label: 'News Article', icon: Newspaper },
        { value: 'event', label: 'Event', icon: Calendar },
        { value: 'libraryitem', label: 'Library Item', icon: FileText },
        { value: 'member', label: 'Member Profile', icon: Users }
    ];

    // Load current page data
    useEffect(() => {
        if (pageId) {
            loadPageData();
        }
    }, [pageId]);

    // Load objects when type changes
    useEffect(() => {
        if (selectedObjectType) {
            loadObjects();
        } else {
            setObjects([]);
            setFilteredObjects([]);
        }
    }, [selectedObjectType]);

    // Filter objects based on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredObjects(objects);
        } else {
            const filtered = objects.filter(obj =>
                obj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (obj.description && obj.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (obj.author && obj.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (obj.organizer_name && obj.organizer_name.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setFilteredObjects(filtered);
        }
    }, [searchQuery, objects]);

    const loadPageData = async () => {
        try {
            const response = await fetch(`/api/webpages/api/pages/${pageId}/`);
            if (response.ok) {
                const pageData = await response.json();
                setCurrentPage(pageData);

                // If page is linked to an object, load the object content
                if (pageData.linked_object_type && pageData.linked_object_id) {
                    loadObjectContent();
                }
            }
        } catch (error) {
            console.error('Error loading page data:', error);
        }
    };

    const loadObjects = async () => {
        setLoading(true);
        try {
            const endpoint = getObjectEndpoint(selectedObjectType);
            const response = await fetch(endpoint);

            if (response.ok) {
                const data = await response.json();
                setObjects(data.results || data);
            } else {
                console.error('Failed to load objects');
                setObjects([]);
            }
        } catch (error) {
            console.error('Error loading objects:', error);
            setObjects([]);
        } finally {
            setLoading(false);
        }
    };

    const loadObjectContent = async () => {
        if (!currentPage?.linked_object_type || !currentPage?.linked_object_id) return;

        try {
            const response = await fetch(`/api/webpages/api/pages/${pageId}/object_content/`);
            if (response.ok) {
                const data = await response.json();
                setObjectContent(data.object_content);
            }
        } catch (error) {
            console.error('Error loading object content:', error);
        }
    };

    const getObjectEndpoint = (objectType) => {
        const baseUrl = '/api/content/api';
        switch (objectType) {
            case 'news': return `${baseUrl}/news/`;
            case 'event': return `${baseUrl}/events/`;
            case 'libraryitem': return `${baseUrl}/library-items/`;
            case 'member': return `${baseUrl}/members/`;
            default: return '';
        }
    };

    const linkObjectToPage = async (object) => {
        setLinking(true);
        try {
            const response = await fetch(`/api/webpages/api/pages/${pageId}/link_object/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({
                    object_type: selectedObjectType,
                    object_id: object.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                setCurrentPage(data.page);
                setSelectedObject(object);
                loadObjectContent();
                if (onObjectLinked) {
                    onObjectLinked(object, selectedObjectType);
                }
                alert('Object linked successfully!');
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error linking object:', error);
            alert('Failed to link object');
        } finally {
            setLinking(false);
        }
    };

    const unlinkObject = async () => {
        setLinking(true);
        try {
            const response = await fetch(`/api/webpages/api/pages/${pageId}/unlink_object/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                }
            });

            if (response.ok) {
                const data = await response.json();
                setCurrentPage(data.page);
                setSelectedObject(null);
                setObjectContent(null);
                if (onObjectUnlinked) {
                    onObjectUnlinked();
                }
                alert('Object unlinked successfully!');
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error unlinking object:', error);
            alert('Failed to unlink object');
        } finally {
            setLinking(false);
        }
    };

    const syncWithObject = async () => {
        setLinking(true);
        try {
            const response = await fetch(`/api/webpages/api/pages/${pageId}/sync_with_object/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                }
            });

            if (response.ok) {
                const data = await response.json();
                setCurrentPage(data.page);
                loadObjectContent();
                alert('Page synced with object successfully!');
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error syncing with object:', error);
            alert('Failed to sync with object');
        } finally {
            setLinking(false);
        }
    };

    const getCsrfToken = () => {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    };

    const getObjectIcon = (type) => {
        const iconMap = {
            news: Newspaper,
            event: Calendar,
            libraryitem: FileText,
            member: Users
        };
        return iconMap[type] || FileText;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    const isObjectLinked = currentPage?.linked_object_type && currentPage?.linked_object_id;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Object Publishing</h3>
                {isObjectLinked && (
                    <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-600">
                            Linked to {currentPage.linked_object_type}
                        </span>
                    </div>
                )}
            </div>

            {/* Current Object Status */}
            {isObjectLinked && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                            {React.createElement(getObjectIcon(currentPage.linked_object_type), {
                                className: "h-5 w-5 text-blue-600"
                            })}
                            <div>
                                <h4 className="font-medium text-blue-900">
                                    Currently Linked Object
                                </h4>
                                <p className="text-sm text-blue-700">
                                    Type: {currentPage.linked_object_type} | ID: {currentPage.linked_object_id}
                                </p>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setShowObjectContent(!showObjectContent)}
                                className="text-blue-600 hover:text-blue-800"
                                title="View object content"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                            <button
                                onClick={syncWithObject}
                                disabled={linking}
                                className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                title="Sync page with object"
                            >
                                <RefreshCw className={`h-4 w-4 ${linking ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={unlinkObject}
                                disabled={linking}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                                title="Unlink object"
                            >
                                <Unlink className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Object Content Preview */}
                    {showObjectContent && objectContent && (
                        <div className="mt-4 pt-4 border-t border-blue-200">
                            <h5 className="font-medium text-blue-900 mb-2">Object Content</h5>
                            <div className="bg-white rounded border p-3 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <strong>Title:</strong> {objectContent.title}
                                    </div>
                                    <div>
                                        <strong>Published:</strong> {formatDate(objectContent.published_date)}
                                    </div>
                                </div>
                                {objectContent.description && (
                                    <div className="mt-2">
                                        <strong>Description:</strong>
                                        <p className="text-gray-600 mt-1">{objectContent.description.substring(0, 200)}...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Object Selection */}
            {!isObjectLinked && (
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Link Object to Page</h4>

                    {/* Object Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Object Type
                        </label>
                        <select
                            value={selectedObjectType}
                            onChange={(e) => setSelectedObjectType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            {objectTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Search Objects */}
                    {selectedObjectType && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Search Objects
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by title, description, or author..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Objects List */}
                    {selectedObjectType && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h5 className="font-medium text-gray-900">Available Objects</h5>
                                <button
                                    onClick={loadObjects}
                                    disabled={loading}
                                    className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                    title="Refresh objects"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-8 text-gray-500">
                                    Loading objects...
                                </div>
                            ) : filteredObjects.length > 0 ? (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {filteredObjects.map(object => (
                                        <div
                                            key={object.id}
                                            className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2">
                                                        {React.createElement(getObjectIcon(selectedObjectType), {
                                                            className: "h-4 w-4 text-gray-500"
                                                        })}
                                                        <h6 className="font-medium text-gray-900">{object.title}</h6>
                                                        {object.is_published ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                                                        )}
                                                    </div>
                                                    {object.excerpt && (
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            {object.excerpt.substring(0, 100)}...
                                                        </p>
                                                    )}
                                                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                                        {object.published_date && (
                                                            <span>Published: {formatDate(object.published_date)}</span>
                                                        )}
                                                        {object.author && <span>By: {object.author}</span>}
                                                        {object.organizer_name && <span>Organizer: {object.organizer_name}</span>}
                                                        {object.member_type && <span>Type: {object.member_type}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex space-x-2 ml-4">
                                                    <a
                                                        href={object.get_absolute_url || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-gray-400 hover:text-gray-600"
                                                        title="View object"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                    <button
                                                        onClick={() => linkObjectToPage(object)}
                                                        disabled={linking}
                                                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                                        title="Link to page"
                                                    >
                                                        <Link className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    {searchQuery ? 'No objects match your search.' : 'No objects found.'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ObjectPublisher; 