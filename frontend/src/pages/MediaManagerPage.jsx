/**
 * MediaManagerPage Component
 * 
 * Main media management interface providing:
 * - File browser with grid/list views
 * - Upload functionality
 * - Search and filtering
 * - File management operations
 * - Integration with existing layout patterns
 */

import React, { useState, useEffect } from 'react';
import { namespacesApi } from '../api';
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext';
import MediaBrowser from '../components/media/MediaBrowser';
import MediaUploader from '../components/media/MediaUploader';

const MediaManagerPage = () => {
    const [namespaces, setNamespaces] = useState([]);
    const [selectedNamespace, setSelectedNamespace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showUploader, setShowUploader] = useState(false);

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
                    setSelectedNamespace(defaultNamespace.id);
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
        console.log('Selected file:', file);
        // Handle file selection - could open details modal, etc.
    };

    const handleUploadComplete = (results) => {
        setShowUploader(false);
        addNotification(`${results.length} files uploaded successfully`, 'success');
    };

    if (loading) {
        return (
            <div className="media-manager-page loading">
                <div className="loading-spinner">
                    <p>Loading media manager...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="media-manager-page p-6">
            <div className="page-header">
                <h1>Media Manager</h1>
                <p>Upload, organize, and manage your media files</p>
            </div>

            <div className="page-controls">
                <div className="namespace-selector">
                    <label htmlFor="namespace-select">Namespace:</label>
                    <select
                        id="namespace-select"
                        value={selectedNamespace || ''}
                        onChange={(e) => setSelectedNamespace(e.target.value)}
                        className="form-select"
                    >
                        <option value="">Select a namespace...</option>
                        {namespaces.map((namespace) => (
                            <option key={namespace.id} value={namespace.id}>
                                {namespace.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="page-actions">
                    <button
                        onClick={() => setShowUploader(true)}
                        className="btn btn-primary"
                        disabled={!selectedNamespace}
                    >
                        Upload Files
                    </button>
                </div>
            </div>

            {!selectedNamespace ? (
                <div className="namespace-required">
                    <div className="empty-state">
                        <h3>Select a Namespace</h3>
                        <p>Please select a namespace to view and manage media files.</p>
                    </div>
                </div>
            ) : (
                <div className="media-content">
                    <MediaBrowser
                        namespace={selectedNamespace}
                        onFileSelect={handleFileSelect}
                        selectionMode="single"
                        showUploader={false} // We have our own upload button
                    />
                </div>
            )}

            {/* Upload Modal */}
            {showUploader && selectedNamespace && (
                <div className="modal-overlay">
                    <div className="modal-content large">
                        <MediaUploader
                            namespace={selectedNamespace}
                            onUploadComplete={handleUploadComplete}
                            onClose={() => setShowUploader(false)}
                        />
                    </div>
                </div>
            )}

            <style>{`
        .media-manager-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-header h1 {
          margin: 0 0 0.5rem 0;
          color: #333;
        }

        .page-header p {
          margin: 0;
          color: #666;
        }

        .page-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .namespace-selector {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .namespace-selector label {
          font-weight: 500;
          color: #333;
        }

        .form-select {
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          min-width: 200px;
        }

        .page-actions {
          display: flex;
          gap: 1rem;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .namespace-required {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
        }

        .empty-state h3 {
          margin: 0 0 1rem 0;
          color: #666;
        }

        .empty-state p {
          margin: 0;
          color: #888;
        }

        .media-content {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          max-width: 90vw;
          max-height: 90vh;
          overflow: auto;
        }

        .modal-content.large {
          width: 800px;
        }

        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .loading-spinner p {
          color: #666;
        }
      `}</style>
        </div>
    );
};

export default MediaManagerPage;
