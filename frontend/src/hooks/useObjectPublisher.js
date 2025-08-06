/**
 * Custom hook for object publishing operations
 * Extracts state management and API calls from ObjectPublisher component
 */

import { useState, useEffect } from 'react';
import { pagesApi, contentApi } from '../api';

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
            const pageData = await pagesApi.get(pageId);
            setCurrentPage(pageData);
        } catch (error) {
            console.error('Error loading page data:', error);
        }
    };

    // Load objects based on selected type
    const loadObjects = async (objectType = '') => {
        setLoading(true);
        try {
            const data = objectType 
                ? await contentApi.getByType(objectType)
                : await contentApi.getAll();
            
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
            const data = await pagesApi.linkObject(pageId, {
                object_type: objectType,
                object_id: objectId
            });

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
            await pagesApi.unlinkObject(pageId, {});

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
            await pagesApi.syncObject(pageId, {});

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
            const data = await contentApi.get(objectType, objectId);
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