/**
 * Custom hook for object publishing operations
 * Extracts state management and API calls from ObjectPublisher component
 */

import { useState, useEffect } from 'react';

const useObjectPublisher = (pageId) => {
    const [selectedObjectType, setSelectedObjectType] = useState('');
    const [objects, setObjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [linking, setLinking] = useState(false);
    const [selectedObject, setSelectedObject] = useState(null);
    const [currentPage, setCurrentPage] = useState(null);
    const [showObjectContent, setShowObjectContent] = useState(false);
    const [objectContent, setObjectContent] = useState(null);

    // API URLs
    const API_BASE = 'http://localhost:8000/api/v1';

    // Load current page data
    const loadPageData = async () => {
        if (!pageId) return;

        try {
            const response = await fetch(`${API_BASE}/webpages/pages/${pageId}/`);
            if (response.ok) {
                const data = await response.json();
                setCurrentPage(data);
            }
        } catch (error) {
            console.error('Error loading page data:', error);
        }
    };

    // Load objects based on selected type
    const loadObjects = async (objectType = '') => {
        setLoading(true);
        try {
            let url = `${API_BASE}/content/all/`;
            if (objectType) {
                url = `${API_BASE}/content/${objectType}/`;
            }

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setObjects(data.results || data);
            }
        } catch (error) {
            console.error('Error loading objects:', error);
            setObjects([]);
        } finally {
            setLoading(false);
        }
    };

    // Link object to page
    const linkObject = async (objectType, objectId, onSuccess, onError) => {
        setLinking(true);
        try {
            const response = await fetch(`${API_BASE}/webpages/pages/${pageId}/link-object/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    object_type: objectType,
                    object_id: objectId
                }),
            });

            if (response.ok) {
                const data = await response.json();
                await loadPageData(); // Reload page data
                onSuccess?.(data);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to link object');
            }
        } catch (error) {
            console.error('Error linking object:', error);
            onError?.(error.message);
        } finally {
            setLinking(false);
        }
    };

    // Unlink object from page
    const unlinkObject = async (onSuccess, onError) => {
        setLinking(true);
        try {
            const response = await fetch(`${API_BASE}/webpages/pages/${pageId}/unlink-object/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                await loadPageData(); // Reload page data
                onSuccess?.();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to unlink object');
            }
        } catch (error) {
            console.error('Error unlinking object:', error);
            onError?.(error.message);
        } finally {
            setLinking(false);
        }
    };

    // Sync page with object
    const syncWithObject = async (onSuccess, onError) => {
        setLinking(true);
        try {
            const response = await fetch(`${API_BASE}/webpages/pages/${pageId}/sync-object/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                await loadPageData(); // Reload page data
                onSuccess?.();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to sync with object');
            }
        } catch (error) {
            console.error('Error syncing with object:', error);
            onError?.(error.message);
        } finally {
            setLinking(false);
        }
    };

    // Load object content for preview
    const loadObjectContent = async (objectType, objectId) => {
        try {
            const response = await fetch(`${API_BASE}/content/${objectType}/${objectId}/`);
            if (response.ok) {
                const data = await response.json();
                setObjectContent(data);
                setShowObjectContent(true);
            }
        } catch (error) {
            console.error('Error loading object content:', error);
        }
    };

    // Load initial data
    useEffect(() => {
        if (pageId) {
            loadPageData();
        }
    }, [pageId]);

    // Load objects when type changes
    useEffect(() => {
        loadObjects(selectedObjectType);
    }, [selectedObjectType]);

    return {
        // State
        selectedObjectType,
        setSelectedObjectType,
        objects,
        loading,
        linking,
        selectedObject,
        setSelectedObject,
        currentPage,
        showObjectContent,
        setShowObjectContent,
        objectContent,
        setObjectContent,

        // Actions
        loadPageData,
        loadObjects,
        linkObject,
        unlinkObject,
        syncWithObject,
        loadObjectContent,
    };
};

export default useObjectPublisher; 