/**
 * Custom hook for object publishing operations
 * Extracts state management and API calls from ObjectPublisher component
 */

import { useState, useEffect } from 'react';
import { api } from '../api/client.js';

const useObjectPublisher = (pageId) => {
    const [selectedObjectType, setSelectedObjectType] = useState('');
    const [objects, setObjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [linking, setLinking] = useState(false);
    const [selectedObject, setSelectedObject] = useState(null);
    const [currentPage, setCurrentPage] = useState(null);
    const [showObjectContent, setShowObjectContent] = useState(false);
    const [objectContent, setObjectContent] = useState(null);

    // Load current page data
    const loadPageData = async () => {
        if (!pageId) return;

        try {
            const response = await api.get(`/api/v1/webpages/pages/${pageId}/`);
            setCurrentPage(response.data);
        } catch (error) {
            console.error('Error loading page data:', error);
        }
    };

    // Load objects based on selected type
    const loadObjects = async (objectType = '') => {
        setLoading(true);
        try {
            let url = `/api/v1/content/all/`;
            if (objectType) {
                url = `/api/v1/content/${objectType}/`;
            }

            const response = await api.get(url);
            const data = response.data;
            setObjects(data.results || data);
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
            const response = await api.post(`/api/v1/webpages/pages/${pageId}/link-object/`, {
                object_type: objectType,
                object_id: objectId
            });

            const data = response.data;
            await loadPageData(); // Reload page data
            onSuccess?.(data);
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
            const response = await api.post(`/api/v1/webpages/pages/${pageId}/unlink-object/`);

            await loadPageData(); // Reload page data
            onSuccess?.();
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
            const response = await api.post(`/api/v1/webpages/pages/${pageId}/sync-object/`);

            await loadPageData(); // Reload page data
            onSuccess?.();
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
            const response = await api.get(`/api/v1/content/${objectType}/${objectId}/`);
            const data = response.data;
            setObjectContent(data);
            setShowObjectContent(true);
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