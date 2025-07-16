/**
 * Custom hook for object search and filtering
 * Extracts search logic from ObjectPublisher component
 */

import { useState, useEffect, useMemo } from 'react';

const useObjectSearch = (objects, selectedObjectType) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredObjects, setFilteredObjects] = useState([]);

    // Filter and search objects
    const processedObjects = useMemo(() => {
        let filtered = objects;

        // Filter by type if specific type is selected
        if (selectedObjectType && selectedObjectType !== '') {
            filtered = filtered.filter(obj => obj.object_type === selectedObjectType);
        }

        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(obj => {
                return (
                    obj.title?.toLowerCase().includes(query) ||
                    obj.description?.toLowerCase().includes(query) ||
                    obj.content?.toLowerCase().includes(query) ||
                    obj.author?.toLowerCase().includes(query) ||
                    obj.category?.name?.toLowerCase().includes(query) ||
                    obj.tags?.some(tag => tag.name?.toLowerCase().includes(query))
                );
            });
        }

        return filtered;
    }, [objects, selectedObjectType, searchQuery]);

    // Update filtered objects when processed objects change
    useEffect(() => {
        setFilteredObjects(processedObjects);
    }, [processedObjects]);

    // Clear search when type changes
    useEffect(() => {
        setSearchQuery('');
    }, [selectedObjectType]);

    // Search statistics
    const searchStats = useMemo(() => {
        return {
            total: objects.length,
            filtered: processedObjects.length,
            hasSearchQuery: searchQuery.trim().length > 0,
            hasTypeFilter: selectedObjectType && selectedObjectType !== '',
        };
    }, [objects.length, processedObjects.length, searchQuery, selectedObjectType]);

    return {
        searchQuery,
        setSearchQuery,
        filteredObjects,
        searchStats,
        clearSearch: () => setSearchQuery(''),
    };
};

export default useObjectSearch; 