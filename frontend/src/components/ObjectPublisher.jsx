/**
 * Object Publisher Component for Phase 7: Object Publishing System
 * 
 * Refactored to use custom hooks and sub-components for better maintainability.
 * Now focuses only on orchestrating the publishing workflow.
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';

// Custom hooks
import useObjectPublisher from '../hooks/useObjectPublisher';
import useObjectSearch from '../hooks/useObjectSearch';

// Sub-components
import { ObjectSelectionPanel, LinkedObjectStatus } from './object-publisher';

const ObjectPublisher = ({ pageId, onObjectLinked, onObjectUnlinked }) => {
    const [message, setMessage] = useState({ type: '', text: '' });

    // Use custom hooks for state management
    const {
        selectedObjectType,
        setSelectedObjectType,
        objects,
        loading,
        linking,
        currentPage,
        showObjectContent,
        setShowObjectContent,
        objectContent,
        setObjectContent,
        linkObject,
        unlinkObject,
        syncWithObject,
        loadObjectContent,
    } = useObjectPublisher(pageId);

    const {
        searchQuery,
        setSearchQuery,
        filteredObjects,
        searchStats,
    } = useObjectSearch(objects, selectedObjectType);

    // Helper function to show messages
    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    // Handle object selection and linking
    const handleObjectSelect = async (objectType, objectId) => {
        await linkObject(
            objectType,
            objectId,
            (data) => {
                showMessage('success', `Successfully linked ${objectType} to page`);
                onObjectLinked?.(data);
            },
            (error) => {
                showMessage('error', `Failed to link object: ${error}`);
            }
        );
    };

    // Handle object unlinking
    const handleUnlink = async () => {
        await unlinkObject(
            () => {
                showMessage('success', 'Object unlinked successfully');
                onObjectUnlinked?.();
            },
            (error) => {
                showMessage('error', `Failed to unlink object: ${error}`);
            }
        );
    };

    // Handle page sync with object
    const handleSync = async () => {
        await syncWithObject(
            () => {
                showMessage('success', 'Page synchronized with object successfully');
            },
            (error) => {
                showMessage('error', `Failed to sync with object: ${error}`);
            }
        );
    };

    // Handle object preview
    const handleObjectPreview = async (objectType, objectId) => {
        await loadObjectContent(objectType, objectId);
    };

    // Close object preview modal
    const closeObjectPreview = () => {
        setShowObjectContent(false);
        setObjectContent(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Object Publishing
                </h3>
                <p className="text-sm text-gray-600">
                    Link existing content objects to this page for dynamic publishing.
                </p>
            </div>

            {/* Status Messages */}
            {message.text && (
                <div className={`p-3 rounded-md ${message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Current Linked Object Status */}
            <LinkedObjectStatus
                currentPage={currentPage}
                linking={linking}
                onUnlink={handleUnlink}
                onSync={handleSync}
                onPreview={handleObjectPreview}
            />

            {/* Object Selection Panel */}
            {!currentPage?.is_object_page && (
                <ObjectSelectionPanel
                    selectedObjectType={selectedObjectType}
                    setSelectedObjectType={setSelectedObjectType}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    filteredObjects={filteredObjects}
                    loading={loading}
                    linking={linking}
                    onObjectSelect={handleObjectSelect}
                    onObjectPreview={handleObjectPreview}
                    searchStats={searchStats}
                />
            )}

            {/* Object Content Preview Modal */}
            {showObjectContent && objectContent && (
                <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-medium">Object Preview</h3>
                            <button
                                onClick={closeObjectPreview}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
                            <div className="prose max-w-none">
                                <h1>{objectContent.title}</h1>
                                {objectContent.description && (
                                    <p className="lead">{objectContent.description}</p>
                                )}
                                {objectContent.content && (
                                    <div dangerouslySetInnerHTML={{ __html: objectContent.content }} />
                                )}

                                {/* Object-specific details */}
                                <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <strong>Type:</strong> <span className="capitalize">{objectContent.object_type}</span>
                                    </div>
                                    <div>
                                        <strong>Status:</strong> {objectContent.is_published ? 'Published' : 'Draft'}
                                    </div>
                                    {objectContent.author && (
                                        <div>
                                            <strong>Author:</strong> {objectContent.author}
                                        </div>
                                    )}
                                    {objectContent.published_date && (
                                        <div>
                                            <strong>Published:</strong> {new Date(objectContent.published_date).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ObjectPublisher; 