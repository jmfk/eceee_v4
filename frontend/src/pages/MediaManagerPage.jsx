/**
 * MediaManagerPage Component
 * 
 * Main media management interface providing:
 * - Media Library tab (approved files)
 * - Pending Files tab (awaiting approval)
 * - Upload functionality with approval workflow
 * - Search and filtering
 * - File management operations
 */

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, FolderOpen } from 'lucide-react';
import { namespacesApi } from '../api';
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext';
import MediaManager from '../components/media/MediaManager';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const MediaManagerPage = () => {
  // Set document title
  useDocumentTitle('Media Manager');

  const [namespaces, setNamespaces] = useState([]);
  const [selectedNamespace, setSelectedNamespace] = useState(null);
  const [loading, setLoading] = useState(true);

  const mediaBrowserRef = useRef(null);

  const { addNotification } = useGlobalNotifications();

  // Load namespaces on mount
  useEffect(() => {
    const loadNamespaces = async () => {
      try {
        const result = await namespacesApi.list();
        // Handle direct API response (results array from paginated response)
        const namespaces = result.results || result || [];
        setNamespaces(namespaces);

        // Auto-select first namespace or default
        if (namespaces.length > 0) {
          const defaultNamespace = namespaces.find(ns => ns.isDefault) || namespaces[0];
          setSelectedNamespace(defaultNamespace.slug);
        }
      } catch (error) {
        console.error('Error loading namespaces:', error);
        addNotification('Failed to load namespaces', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadNamespaces();
  }, [addNotification]);

  const handleFileSelect = (file) => {
    // Handle file selection - could open details modal, etc.
  };

  const handleFilesLoaded = () => {
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading media manager...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 max-w-7xl mx-auto w-full p-6">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Media Manager</h1>
            <p className="text-gray-600">Upload, organize, and manage your media files</p>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <label htmlFor="namespace-select" className="font-medium text-gray-700">
              Namespace:
            </label>
            <select
              id="namespace-select"
              value={selectedNamespace || ''}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a namespace...</option>
              {namespaces.map((namespace) => (
                <option key={namespace.id} value={namespace.slug}>
                  {namespace.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 pb-6 min-h-0">
        {!selectedNamespace ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-center">
              <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Select a Namespace</h3>
              <p className="text-gray-500">Please select a namespace to view and manage media files.</p>
            </div>
          </div>
        ) : (
          <MediaManager
            namespace={selectedNamespace}
            onFileSelect={handleFileSelect}
            onFilesLoaded={handleFilesLoaded}
            selectionMode="multiple"
          />
        )}
      </div>
    </div>
  );
};

export default MediaManagerPage;
