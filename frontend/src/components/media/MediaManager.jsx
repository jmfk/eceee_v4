/**
 * MediaManager Component
 * 
 * Main media management interface with tabs for:
 * - Media Library (approved files) - uses MediaBrowser
 * - Collections - uses MediaCollectionManager
 * - Tags - uses MediaTagManager
 * - Pending Files (awaiting approval) - uses PendingMediaManager
 * 
 * Provides unified navigation and pending file count notifications.
 */

import React, { useState, useEffect } from 'react';
import {
    Files,
    Clock,
    Bell,
    Folder,
    Hash
} from 'lucide-react';
import MediaBrowser from './MediaBrowser';
import PendingMediaManager from './PendingMediaManager';
import MediaCollectionManager from './MediaCollectionManager';
import MediaTagManager from './MediaTagManager';
import { mediaApi } from '../../api';

const MediaManager = ({
    namespace,
    onFileSelect,
    onFilesLoaded,
    selectionMode = 'single',
    fileTypes = []
}) => {
    const [activeTab, setActiveTab] = useState('library');
    const [pendingCount, setPendingCount] = useState(0);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    // Load pending files count for badge
    const loadPendingCount = async () => {
        if (!namespace) return;

        try {
            const result = await mediaApi.pendingFiles.list({
                namespace: namespace,
                status: 'pending'
            });
            const count = result.results?.length || result.length || 0;
            setPendingCount(count);
        } catch (error) {
            console.error('Failed to load pending count:', error);
            setPendingCount(0); // Set to 0 on error
        }
    };

    // Load pending count on mount and when namespace changes
    useEffect(() => {
        if (namespace) {
            loadPendingCount();

            // Set up polling for pending count (every 30 seconds)
            const interval = setInterval(loadPendingCount, 30000);
            return () => clearInterval(interval);
        }
    }, [namespace]);

    // Handle files processed (from pending manager)
    const handleFilesProcessed = () => {
        loadPendingCount(); // Refresh pending count
        setRefreshTrigger(prev => prev + 1); // Trigger MediaBrowser refresh
    };

    // Handle tab change
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'pending') {
            loadPendingCount(); // Refresh count when viewing pending tab
        }
    };

    const handleFilesLoaded = () => {
        loadPendingCount();
        if (onFilesLoaded) onFilesLoaded();
    };

    useEffect(() => {
        if (pendingCount !== 0) setActiveTab('pending');
    }, [pendingCount]);

    // Tab configuration
    const tabs = [
        {
            id: 'library',
            label: 'Media Library',
            icon: Files,
            description: 'Browse approved media files'
        },
        {
            id: 'collections',
            label: 'Collections',
            icon: Folder,
            description: 'Organize files into collections'
        },
        {
            id: 'tags',
            label: 'Tags',
            icon: Hash,
            description: 'Manage media tags'
        },
        {
            id: 'pending',
            label: 'Pending Files',
            icon: Clock,
            description: 'Review files awaiting approval',
            badge: pendingCount > 0 ? pendingCount : null,
            badgeColor: pendingCount > 10 ? 'bg-red-500' : 'bg-yellow-500'
        }
    ];

    return (
        <div className="flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Tab Navigation - Seamlessly integrated */}
            <div className="flex-shrink-0">
                <div className="flex bg-white border-b border-blue-600">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`
                                    flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all duration-200 border-b-2 relative -mb-px
                                    ${isActive
                                        ? 'text-blue-600 border-blue-600 bg-white'
                                        : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                                {tab.badge && (
                                    <span className={`
                                        inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white rounded-full ml-1
                                       ${isActive
                                            ? 'bg-blue-500'
                                            : 'bg-gray-400'
                                        }
                                    `}>
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'library' && (
                    <MediaBrowser
                        onFileSelect={onFileSelect}
                        onFilesLoaded={handleFilesLoaded}
                        selectionMode={selectionMode}
                        fileTypes={fileTypes}
                        namespace={namespace}
                        showUploader={true} // MediaBrowser handles its own upload
                        refreshTrigger={refreshTrigger} // Trigger refresh when files are processed
                    />
                )}

                {activeTab === 'collections' && (
                    <MediaCollectionManager
                        namespace={namespace}
                        onCollectionSelect={onFileSelect} // Allow selecting collections if needed
                    />
                )}

                {activeTab === 'tags' && (
                    <MediaTagManager
                        namespace={namespace}
                        onTagSelect={(tag) => {
                            // When a tag is selected, switch to library view
                            // Note: This would require MediaBrowser to support tag filtering
                            // For now, just keep the user on the tags view
                        }}
                    />
                )}

                {activeTab === 'pending' && (
                    <PendingMediaManager
                        namespace={namespace}
                        onFilesProcessed={handleFilesProcessed} // Refresh count after processing
                    />
                )}
            </div>



            {/* Pending Files Notification */}
            {pendingCount > 0 && activeTab !== 'pending' && (
                <div className="fixed bottom-4 right-4 z-40">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className="flex items-center gap-2 px-4 py-3 bg-yellow-500 text-white rounded-lg shadow-lg hover:bg-yellow-600 transition-colors"
                    >
                        <Bell className="w-5 h-5" />
                        <span className="font-medium">
                            {pendingCount} file{pendingCount !== 1 ? 's' : ''} awaiting approval
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default MediaManager;
