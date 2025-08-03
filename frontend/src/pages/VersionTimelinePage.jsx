import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Eye, Settings, Plus, Edit3, ExternalLink, Edit2, Check, X } from 'lucide-react';
import { getPageVersionsList, scheduleVersion, publishVersionNow, updateVersion } from '../api/versions.js';
import { getPage } from '../api/pages.js';
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext';

/**
 * VersionTimelinePage - Dedicated page for version management and publishing
 * 
 * Features:
 * - Timeline view of all versions with effective/expiry dates
 * - Ability to schedule different versions for different time periods
 * - Visual indication of current live version
 * - Scheduling UI for setting effective/expiry dates
 */
const VersionTimelinePage = () => {
    const { pageId } = useParams();
    const navigate = useNavigate();
    const { addNotification } = useGlobalNotifications();

    const [versions, setVersions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [showScheduleDialog, setShowScheduleDialog] = useState(false);
    const [scheduleData, setScheduleData] = useState({
        effective_date: '',
        expiry_date: ''
    });
    const [pageTitle, setPageTitle] = useState('');
    const [pageData, setPageData] = useState(null);
    
    // Inline editing state
    const [editingVersionId, setEditingVersionId] = useState(null);
    const [editingDescription, setEditingDescription] = useState('');

    // Load versions when component mounts
    useEffect(() => {
        loadVersions();
    }, [pageId]);

    const loadVersions = async () => {
        if (!pageId) return;

        try {
            setIsLoading(true);
            // Load both versions and page data
            const [versionsData, pageResponse] = await Promise.all([
                getPageVersionsList(pageId),
                getPage(pageId)
            ]);

            setVersions(versionsData.versions || []);
            setPageTitle(versionsData.page_title || pageResponse.title || 'Page');
            setPageData(pageResponse);
        } catch (error) {
            console.error('Failed to load versions:', error);
            addNotification('Failed to load versions', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Helper function to convert ISO datetime to datetime-local format
    const formatForDatetimeLocal = (isoDateString) => {
        if (!isoDateString) return '';

        try {
            const date = new Date(isoDateString);
            // Convert to local time and format as YYYY-MM-DDTHH:MM
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (error) {
            console.error('Error formatting date for datetime-local:', error);
            return '';
        }
    };

    const handleScheduleVersion = (version) => {
        setSelectedVersion(version);
        setScheduleData({
            effective_date: formatForDatetimeLocal(version.effective_date),
            expiry_date: formatForDatetimeLocal(version.expiry_date)
        });
        setShowScheduleDialog(true);
    };

    const handleSaveSchedule = async () => {
        if (!selectedVersion) return;

        try {
            // Convert datetime-local values to ISO format for API
            const apiData = {
                effective_date: scheduleData.effective_date ? new Date(scheduleData.effective_date).toISOString() : null,
                expiry_date: scheduleData.expiry_date ? new Date(scheduleData.expiry_date).toISOString() : null
            };

            await scheduleVersion(selectedVersion.id, apiData);
            addNotification('Version scheduled successfully', 'success');
            setShowScheduleDialog(false);
            setSelectedVersion(null);
            await loadVersions(); // Reload to show updated dates
        } catch (error) {
            console.error('Failed to schedule version:', error);
            addNotification('Failed to schedule version', 'error');
        }
    };

    const handlePublishNow = async (version) => {
        try {
            await publishVersionNow(version.id);
            addNotification('Version published successfully', 'success');
            await loadVersions(); // Reload to show updated status
        } catch (error) {
            console.error('Failed to publish version:', error);
            addNotification('Failed to publish version', 'error');
        }
    };

    // Inline editing functions
    const handleStartEditDescription = (version) => {
        setEditingVersionId(version.id);
        setEditingDescription(version.description || '');
    };

    const handleSaveDescription = async (versionId) => {
        try {
            await updateVersion(versionId, { description: editingDescription });
            addNotification('Version description updated successfully', 'success');
            setEditingVersionId(null);
            setEditingDescription('');
            await loadVersions(); // Refresh the list
        } catch (error) {
            console.error('Failed to update version description:', error);
            addNotification('Failed to update version description', 'error');
        }
    };

    const handleCancelEditDescription = () => {
        setEditingVersionId(null);
        setEditingDescription('');
    };

    const getVersionStatusInfo = (version) => {
        const now = new Date();
        const effectiveDate = version.effective_date ? new Date(version.effective_date) : null;
        const expiryDate = version.expiry_date ? new Date(version.expiry_date) : null;

        if (!effectiveDate) {
            return {
                status: 'draft',
                label: 'Draft',
                color: 'bg-gray-100 text-gray-800',
                description: 'Not scheduled for publishing'
            };
        }

        if (effectiveDate > now) {
            return {
                status: 'scheduled',
                label: 'Scheduled',
                color: 'bg-blue-100 text-blue-800',
                description: `Will be published ${effectiveDate.toLocaleDateString()}`
            };
        }

        if (expiryDate && expiryDate <= now) {
            return {
                status: 'expired',
                label: 'Expired',
                color: 'bg-red-100 text-red-800',
                description: `Expired ${expiryDate.toLocaleDateString()}`
            };
        }

        // At this point, the version has effective_date <= now and is not expired
        // Check if this version is the currently active published version
        const currentlyPublishedVersion = getCurrentlyPublishedVersion();

        if (currentlyPublishedVersion && currentlyPublishedVersion.id === version.id) {
            return {
                status: 'published',
                label: 'Published',
                color: 'bg-green-100 text-green-800',
                description: 'Currently live'
            };
        }

        // If we have a current published version and this isn't it, then this one is superseded
        if (currentlyPublishedVersion) {
            return {
                status: 'superseded',
                label: 'Superseded',
                color: 'bg-orange-100 text-orange-800',
                description: 'Published but replaced by newer version'
            };
        }

        // If there's no current published version but this has effective_date <= now,
        // it should be published (shouldn't happen, but fallback)
        return {
            status: 'published',
            label: 'Published',
            color: 'bg-green-100 text-green-800',
            description: 'Currently live'
        };
    };

    // Helper function to find the currently active published version
    const getCurrentlyPublishedVersion = () => {
        const now = new Date();

        // Find the latest version (by version_number) that is currently published
        const publishedVersions = versions
            .filter(version => {
                const effectiveDate = version.effective_date ? new Date(version.effective_date) : null;
                const expiryDate = version.expiry_date ? new Date(version.expiry_date) : null;

                // Must have effective date and be active
                if (!effectiveDate || effectiveDate > now) return false;

                // Must not be expired
                if (expiryDate && expiryDate <= now) return false;

                return true;
            })
            .sort((a, b) => b.version_number - a.version_number); // Sort by version number descending

        // Return the latest version (highest version_number) that's currently published
        return publishedVersions.length > 0 ? publishedVersions[0] : null;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleString();
    };

    // Build full URL path for the page
    const buildFullPagePath = () => {
        if (!pageData) return '';

        // Get hostname from root page (inherited context)
        const hostname = getEffectiveHostname(pageData);

        // Build the full URL
        const protocol = hostname.includes('localhost') ? 'http://' : 'https://';
        const slug = buildFullSlugPath(pageData);

        return `${protocol}${hostname}${slug}`;
    };

    // Get effective hostname by walking up the parent hierarchy
    const getEffectiveHostname = (page) => {
        // If this page has hostnames (root page), use it
        if (page.hostnames && page.hostnames.length > 0) {
            return page.hostnames[0];
        }

        // If it has a parent, walk up to find the root page with hostname
        if (page.parent) {
            return getEffectiveHostname(page.parent);
        }

        // Fallback if no hostname found anywhere in the hierarchy
        return 'localhost:8000';
    };

    // Build full slug path including parent slugs (excluding root page slug)
    const buildFullSlugPath = (page) => {
        const slugParts = [];
        let currentPage = page;

        // Walk up the hierarchy to build complete path
        while (currentPage) {
            // Include slug only if it's not the root page (has a parent)
            if (currentPage.slug && currentPage.parent) {
                slugParts.unshift(currentPage.slug);
            }
            currentPage = currentPage.parent;
        }

        // If no slug parts (root page itself), return root path
        if (slugParts.length === 0) {
            return '/';
        }

        // Join with slashes and ensure it starts with /
        return '/' + slugParts.join('/');
    };

    // Sort versions by version number (newest first)
    const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-6">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => navigate(`/pages/${pageId}/edit/content`)}
                                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 mr-2" />
                                Back to Editor
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Version Timeline & Publishing
                                </h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    {pageTitle} - Schedule and manage when different versions go live
                                </p>
                                {pageData && (
                                    <div className="flex items-center text-xs text-gray-500 mt-2 space-x-2">
                                        <span className="font-medium">Page URL:</span>
                                        <a
                                            href={buildFullPagePath()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 underline font-mono flex items-center space-x-1"
                                        >
                                            <span>{buildFullPagePath()}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                        <span className="text-gray-400">•</span>
                                        <span>ID: {pageData.id}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-sm text-gray-600">
                            {sortedVersions.filter(v => getVersionStatusInfo(v).status === 'published').length} published • {' '}
                            {sortedVersions.filter(v => getVersionStatusInfo(v).status === 'scheduled').length} scheduled • {' '}
                            {sortedVersions.filter(v => getVersionStatusInfo(v).status === 'superseded').length} superseded • {' '}
                            {sortedVersions.filter(v => getVersionStatusInfo(v).status === 'draft').length} drafts
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading versions...</p>
                    </div>
                ) : sortedVersions.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                            <Calendar className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">No versions found</h3>
                        <p className="text-gray-600 mb-6">Create content first to manage versions and publishing.</p>
                        <button
                            onClick={() => navigate(`/pages/${pageId}/edit/content`)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Go to Editor
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {sortedVersions.map((version) => {
                            const statusInfo = getVersionStatusInfo(version);
                            return (
                                <div
                                    key={version.id}
                                    className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-4 mb-3">
                                                <div className="flex-1">
                                                    {editingVersionId === version.id ? (
                                                        <div className="flex items-center space-x-2">
                                                            <input
                                                                type="text"
                                                                value={editingDescription}
                                                                onChange={(e) => setEditingDescription(e.target.value)}
                                                                className="text-xl font-semibold text-gray-900 border border-gray-300 rounded-md px-3 py-1 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                placeholder={`Version ${version.version_number}`}
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleSaveDescription(version.id);
                                                                    } else if (e.key === 'Escape') {
                                                                        handleCancelEditDescription();
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => handleSaveDescription(version.id)}
                                                                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                                                title="Save description"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEditDescription}
                                                                className="p-1 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                                                                title="Cancel editing"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div 
                                                            className="flex items-center space-x-2 group cursor-pointer"
                                                            onClick={() => handleStartEditDescription(version)}
                                                        >
                                                            <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                                {version.description || `Version ${version.version_number}`}
                                                            </h3>
                                                            <Edit2 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    )}
                                                    {version.description && editingVersionId !== version.id && (
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            Version {version.version_number}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>
                                                {statusInfo.status === 'published' && (
                                                    <span className="text-sm bg-green-500 text-white px-3 py-1 rounded-full font-medium">
                                                        LIVE
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                                                <div>
                                                    <span className="text-sm font-semibold text-gray-700 block mb-1">Created:</span>
                                                    <div className="text-gray-900">
                                                        {formatDate(version.created_at)}
                                                    </div>
                                                    {version.created_by && (
                                                        <div className="text-gray-500 text-sm mt-1">
                                                            by {version.created_by}
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <span className="text-sm font-semibold text-gray-700 block mb-1">Effective Date:</span>
                                                    <div className="text-gray-900">
                                                        {formatDate(version.effective_date)}
                                                    </div>
                                                </div>

                                                <div>
                                                    <span className="text-sm font-semibold text-gray-700 block mb-1">Expiry Date:</span>
                                                    <div className="text-gray-900">
                                                        {formatDate(version.expiry_date)}
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                                                {statusInfo.description}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col space-y-3 ml-6">
                                            {statusInfo.status === 'draft' && (
                                                <button
                                                    onClick={() => handlePublishNow(version)}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                                                    disabled={isLoading}
                                                >
                                                    Publish Now
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleScheduleVersion(version)}
                                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-2"
                                                disabled={isLoading}
                                            >
                                                <Calendar className="w-4 h-4" />
                                                <span>Schedule</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Schedule Dialog */}
            {showScheduleDialog && selectedVersion && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                Schedule {selectedVersion.description || `Version ${selectedVersion.version_number}`}
                                {selectedVersion.description && (
                                    <span className="text-sm text-gray-600 block font-normal mt-1">
                                        Version {selectedVersion.version_number}
                                    </span>
                                )}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Effective Date (When to publish)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={scheduleData.effective_date}
                                        onChange={(e) => setScheduleData(prev => ({
                                            ...prev,
                                            effective_date: e.target.value
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Expiry Date (When to expire) - Optional
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={scheduleData.expiry_date}
                                        onChange={(e) => setScheduleData(prev => ({
                                            ...prev,
                                            expiry_date: e.target.value
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end space-x-3 mt-6">
                                <button
                                    onClick={() => setShowScheduleDialog(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveSchedule}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                >
                                    Save Schedule
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VersionTimelinePage;