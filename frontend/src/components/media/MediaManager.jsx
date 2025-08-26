/**
 * MediaManager Component
 * 
 * Main media management interface with tabs for:
 * - Media Library (approved files) - uses MediaBrowser
 * - Pending Files (awaiting approval) - uses PendingMediaManager
 * 
 * Provides unified navigation and pending file count notifications.
 */

import React, { useState, useEffect } from 'react';
import {
    Files,
    Clock,
    Bell
} from 'lucide-react';
import MediaBrowser from './MediaBrowser';
import PendingMediaManager from './PendingMediaManager';
import { mediaApi } from '../../api';

const MediaManager = ({
    namespace,
    onFileSelect,
    selectionMode = 'single',
    fileTypes = []
}) => {
    const [activeTab, setActiveTab] = useState('library');
    const [pendingCount, setPendingCount] = useState(0);
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
    };

    // Handle tab change
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'pending') {
            loadPendingCount(); // Refresh count when viewing pending tab
        }
    };

    // Tab configuration
    const tabs = [
        {
            id: 'library',
            label: 'Media Library',
            icon: Files,
            description: 'Browse approved media files'
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
        <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Tab Navigation - Seamlessly integrated */}
            <div className="flex-shrink-0">
                <div className="flex bg-white border-b border-gray-200">
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
                                        : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300 bg-gray-50/80 hover:bg-gray-50'
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
            <div className="flex-1 overflow-hidden">
                {activeTab === 'library' && (
                    <MediaBrowser
                        onFileSelect={onFileSelect}
                        selectionMode={selectionMode}
                        fileTypes={fileTypes}
                        namespace={namespace}
                        showUploader={true} // MediaBrowser handles its own upload
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
