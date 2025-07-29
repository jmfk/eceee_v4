import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    X,
    Eye,
    Settings,
    Layout,
    FileText,
    Clock,
    Share2,
    MoreHorizontal,
    ChevronDown,
    ArrowLeft,
    Palette,
    ChevronLeft,
    ChevronRight,
    Trash2
} from 'lucide-react'
import { api } from '../api/client.js'
import { savePageWithWidgets } from '../api/pages.js'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import ContentEditor from './ContentEditor'
import LayoutSelector from './LayoutSelector'
import StatusBar from './StatusBar'

const PageEditor = () => {
    const { pageId, tab } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    // Determine previous view from location state or default to /pages
    const previousView = location.state?.previousView || '/pages'
    const isNewPage = pageId === 'new' || !pageId
    const activeTab = tab || 'content'

    // Redirect to content tab if no tab is specified
    useEffect(() => {
        if (!tab) {
            const defaultPath = isNewPage ? `/pages/new/content` : `/pages/${pageId}/edit/content`
            navigate(defaultPath, { replace: true, state: { previousView } })
        }
    }, [tab, isNewPage, pageId, navigate, previousView])
    const [pageData, setPageData] = useState(null)
    const [isDirty, setIsDirty] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [layoutData, setLayoutData] = useState(null)
    const [isLoadingLayout, setIsLoadingLayout] = useState(false)
    const contentEditorRef = useRef(null)
    const settingsEditorRef = useRef(null)
    const metadataEditorRef = useRef(null)

    // Version management state
    const [currentVersion, setCurrentVersion] = useState(null)
    const [availableVersions, setAvailableVersions] = useState([])

    // Auto-save management state
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)

    const queryClient = useQueryClient()
    const { showError, showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()



    // Initialize page data for new page
    useEffect(() => {
        if (isNewPage && !pageData) {
            setPageData({
                title: '',
                slug: '',
                description: '',
                publication_status: 'unpublished',
                code_layout: '',
                meta_title: '',
                meta_description: '',
                hostnames: []
            })
        }
    }, [isNewPage, pageData])

    // Fetch page data (skip if creating new page)
    const { data: page, isLoading } = useQuery({
        queryKey: ['page', pageId],
        queryFn: async () => {
            const response = await api.get(`/api/v1/webpages/pages/${pageId}/`)
            return response.data
        },
        enabled: !isNewPage
    })





    // Add loading notifications for page data
    useEffect(() => {
        if (isLoading && !isNewPage) {
            addNotification(`Loading page data...`, 'info', 'page-load')
        } else if (page && !isNewPage) {
            addNotification(`Page "${page.title}" loaded successfully`, 'success', 'page-load')
        }
    }, [isLoading, page, isNewPage, addNotification])



    // Add notifications for tab navigation
    useEffect(() => {
        const tabNames = {
            content: 'Content Editor',
            settings: 'Page Settings',
            metadata: 'Page Metadata',
            preview: 'Page Preview'
        }
        const tabName = tabNames[activeTab] || activeTab
        addNotification(`Switched to ${tabName}`, 'info', 'tab-navigation')
    }, [activeTab, addNotification])

    // Add notification for page editor opening
    useEffect(() => {
        if (isNewPage) {
            addNotification('Opening page editor for new page...', 'info', 'editor-open')
        } else if (pageId) {
            addNotification(`Opening page editor for page ID: ${pageId}`, 'info', 'editor-open')
        }
    }, [isNewPage, pageId, addNotification])

    // Set page data when loaded
    useEffect(() => {
        if (page && !isNewPage) {
            setPageData(page)
        }
    }, [page, isNewPage])

    // Fetch layout data when page has a code_layout
    useEffect(() => {
        const fetchLayoutData = async () => {
            if (!pageData?.code_layout) {
                setLayoutData(null)
                return
            }

            setIsLoadingLayout(true)
            try {
                addNotification(`Loading layout: ${pageData.code_layout}`, 'info', 'layout-load')
                const response = await api.get(`/api/v1/webpages/layouts/${pageData.code_layout}/json/`)
                setLayoutData(response.data)
                addNotification(`Layout "${pageData.code_layout}" loaded successfully`, 'success', 'layout-load')
            } catch (error) {
                console.error('Failed to load layout:', error)
                addNotification(`Failed to load layout: ${pageData.code_layout}`, 'error', 'layout-load')
                showError(error, 'Failed to load layout data')
                setLayoutData(null)
            } finally {
                setIsLoadingLayout(false)
            }
        }

        fetchLayoutData()
    }, [pageData?.code_layout, addNotification, showError])

    // Create page mutation (for new pages)
    const createPageMutation = useMutation({
        mutationFn: async (pageData) => {
            const response = await api.post('/api/v1/webpages/pages/', pageData)
            return response.data
        },
        onSuccess: (newPage) => {
            addNotification('Page created successfully', 'success', 'page-create')
            setIsDirty(false)
            // Navigate to edit the newly created page
            navigate(`/pages/${newPage.id}/edit`, {
                replace: true,
                state: { previousView }
            })
            queryClient.invalidateQueries(['pages'])
        },
        onError: (error) => {
            addNotification('Failed to create page', 'error', 'page-create')
            showError(error, 'Failed to create page')
        }
    })

    // Update page mutation
    const updatePageMutation = useMutation({
        mutationFn: async (pageData) => {
            // Only send the fields that should be updated
            const updateFields = {
                title: pageData.title,
                slug: pageData.slug,
                description: pageData.description,
                code_layout: pageData.code_layout,
                publication_status: pageData.publication_status,
                meta_title: pageData.meta_title,
                meta_description: pageData.meta_description,
                hostnames: pageData.hostnames
            }

            const response = await api.patch(`/api/v1/webpages/pages/${pageId}/`, updateFields)
            return response.data
        },
        onSuccess: (updatedPage) => {
            addNotification('Page saved successfully', 'success', 'page-save')
            setPageData(updatedPage)
            setIsDirty(false)
            queryClient.invalidateQueries(['page', pageId])
            queryClient.invalidateQueries(['pages', 'root'])
        },
        onError: (error) => {
            addNotification('Failed to save page', 'error', 'page-save')
            showError(error, 'Failed to save page')
        }
    })

    // Publish page mutation
    const publishPageMutation = useMutation({
        mutationFn: async () => {
            const response = await api.patch(`/api/v1/webpages/pages/${pageId}/`, {
                publication_status: 'published'
            })
            return response.data
        },
        onSuccess: (updatedPage) => {
            addNotification('Page published successfully', 'success', 'page-publish')
            setPageData(updatedPage)
            queryClient.invalidateQueries(['page', pageId])
            queryClient.invalidateQueries(['pages', 'root'])
        },
        onError: (error) => {
            addNotification('Failed to publish page', 'error', 'page-publish')
            showError(error, 'Failed to publish page')
        }
    })

    // Handle close with unsaved changes check
    const handleClose = async () => {
        if (isDirty) {
            addNotification('Checking for unsaved changes...', 'info', 'editor-close')
            const confirmed = await showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to close?',
                confirmText: 'Close without saving',
                confirmButtonStyle: 'danger'
            })
            if (!confirmed) {
                addNotification('Close cancelled - staying in editor', 'info', 'editor-close')
                return
            }
        }
        addNotification('Closing page editor...', 'info', 'editor-close')
        navigate(previousView)
    }



    // Handle quick publish (only for existing pages)
    const handleQuickPublish = () => {
        if (isNewPage) return

        addNotification('Publishing page...', 'info', 'page-publish')
        setIsPublishing(true)
        publishPageMutation.mutate()
        setIsPublishing(false)
    }

    // Handle page data updates
    const updatePageData = (updates) => {
        setPageData(prev => ({ ...prev, ...updates }))
        setIsDirty(true)
    }

    // Version management functions
    const loadVersions = useCallback(async () => {
        if (!pageData?.id || isNewPage) {
            return;
        }

        try {
            const { getPageVersionsList } = await import('../api/versions.js');
            const versionsData = await getPageVersionsList(pageData.id);

            setAvailableVersions(versionsData.versions || []);

            // Set current version if not already set
            if (!currentVersion && versionsData.current_version) {
                const currentVersionData = versionsData.versions?.find(v => v.id === versionsData.current_version);
                if (currentVersionData) {
                    setCurrentVersion(currentVersionData);
                }
            }
        } catch (error) {
            console.error('PageEditor: Error loading versions', error);
            showError('Failed to load page versions');
        }
    }, [pageData?.id, isNewPage, currentVersion, showError]);

    const switchToVersion = useCallback(async (versionId) => {
        if (!versionId) return;

        try {
            const { getVersionWidgets } = await import('../api/versions.js');
            const versionData = await getVersionWidgets(versionId);

            setCurrentVersion(versionData);

            // Update the page data
            updatePageData({
                currentVersion: versionData
            });

            console.log('PageEditor: Switched to version', versionData.version_number);
            addNotification({
                type: 'info',
                message: `Switched to version ${versionData.version_number}`
            });
        } catch (error) {
            console.error('PageEditor: Error switching to version', error);
            showError(`Failed to load version: ${error.message}`);
        }
    }, [updatePageData, showError, addNotification]);

    // Load versions when page data is available
    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    // Sync auto-save state with all editors when they're available
    useEffect(() => {
        // Sync with ContentEditor
        if (contentEditorRef.current && contentEditorRef.current.enableAutoSave) {
            console.log(`🔄 SYNC AUTO-SAVE: Setting ContentEditor state to ${autoSaveEnabled ? 'ENABLED' : 'DISABLED'}`);
            contentEditorRef.current.enableAutoSave(autoSaveEnabled, autoSaveEnabled ? 10000 : 0);
        }

        // SettingsEditor and MetadataEditor already save in real-time via onUpdate
        // No additional sync needed for them
        console.log('🔄 SYNC AUTO-SAVE: SettingsEditor and MetadataEditor use real-time saving');

    }, [autoSaveEnabled, layoutData]); // layoutData dependency ensures this runs after ContentEditor is mounted

    // UNIFIED SAVE: StatusBar -> PageEditor -> Single API Call
    const handleSaveFromStatusBar = useCallback(async () => {
        try {
            console.log('🔄 UNIFIED SAVE: StatusBar -> PageEditor');

            // Collect all data from editors (no saving yet)
            const collectedData = {};

            // Collect widget data from ContentEditor
            if (contentEditorRef.current && contentEditorRef.current.saveWidgets) {
                console.log('🔄 UNIFIED SAVE: Collecting widget data from ContentEditor');
                try {
                    const widgetResult = await contentEditorRef.current.saveWidgets({
                        source: 'unified_save_from_statusbar',
                        description: 'Unified save triggered from status bar',
                        collectOnly: true  // Tell ContentEditor to collect data, not save
                    });
                    collectedData.widgets = widgetResult.data || widgetResult;
                    console.log('✅ UNIFIED SAVE: Widget data collected', collectedData.widgets);
                } catch (error) {
                    console.error('❌ UNIFIED SAVE: Widget data collection failed', error);
                    throw new Error(`Widget data collection failed: ${error.message}`);
                }
            }

            // Collect settings data from SettingsEditor
            if (settingsEditorRef.current && settingsEditorRef.current.saveSettings) {
                console.log('🔄 UNIFIED SAVE: Collecting settings data from SettingsEditor');
                try {
                    const settingsResult = await settingsEditorRef.current.saveSettings();
                    collectedData.settings = settingsResult.data || settingsResult;
                    console.log('✅ UNIFIED SAVE: Settings data collected', collectedData.settings);
                } catch (error) {
                    console.error('❌ UNIFIED SAVE: Settings data collection failed', error);
                    throw new Error(`Settings data collection failed: ${error.message}`);
                }
            }

            // Collect metadata from MetadataEditor
            if (metadataEditorRef.current && metadataEditorRef.current.saveMetadata) {
                console.log('🔄 UNIFIED SAVE: Collecting metadata from MetadataEditor');
                try {
                    const metadataResult = await metadataEditorRef.current.saveMetadata();
                    collectedData.metadata = metadataResult.data || metadataResult;
                    console.log('✅ UNIFIED SAVE: Metadata collected', collectedData.metadata);
                } catch (error) {
                    console.error('❌ UNIFIED SAVE: Metadata collection failed', error);
                    throw new Error(`Metadata collection failed: ${error.message}`);
                }
            }

            // Combine all page data (settings + metadata)
            const unifiedPageData = {
                ...collectedData.settings,
                ...collectedData.metadata
            };

            console.log('🔄 UNIFIED SAVE: Combined data ready for API call', {
                pageData: unifiedPageData,
                widgets: collectedData.widgets
            });

            // Single API call for everything!
            const response = await savePageWithWidgets(
                pageData.id,
                unifiedPageData,
                collectedData.widgets,
                {
                    description: 'Unified save from page editor',
                    autoPublish: false
                }
            );

            console.log('✅ UNIFIED SAVE: API call successful!', response);

            // Update UI state with response
            setPageData(response);
            setIsDirty(false);

            // Show success notification
            addNotification({
                type: 'success',
                message: 'All changes saved successfully! (Unified Save)'
            });

            // Invalidate queries to refresh data
            queryClient.invalidateQueries(['page', pageData.id]);
            queryClient.invalidateQueries(['pages', 'root']);

        } catch (error) {
            console.error('❌ UNIFIED SAVE: Global save failed', error);
            addNotification({
                type: 'error',
                message: `Save failed: ${error.message}`
            });
            showError(`Save failed: ${error.message}`);
        }
    }, [addNotification, showError, pageData?.id, queryClient]);

    // Auto-save toggle handler
    const handleAutoSaveToggle = useCallback((enabled) => {
        console.log(`🔄 AUTO-SAVE TOGGLE: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        setAutoSaveEnabled(enabled);

        // Pass auto-save setting to ContentEditor
        if (contentEditorRef.current && contentEditorRef.current.enableAutoSave) {
            contentEditorRef.current.enableAutoSave(enabled, enabled ? 10000 : 0);
        }

        // Note: SettingsEditor and MetadataEditor save in real-time via onUpdate
        // so they don't need separate auto-save configuration
        console.log('🔄 AUTO-SAVE: SettingsEditor and MetadataEditor use real-time saving via onUpdate');

        addNotification({
            type: 'info',
            message: `Auto-save ${enabled ? 'enabled' : 'disabled'} - Settings & metadata save in real-time`
        });
    }, [addNotification]);

    // Tab navigation (main tabs only - Settings and Metadata moved to more menu)
    const tabs = [
        { id: 'content', label: 'Content', icon: Layout },
        { id: 'preview', label: 'Preview', icon: Eye },
    ]

    // More menu items (includes Settings and Metadata)
    const moreMenuItems = [
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'metadata', label: 'Metadata', icon: FileText },
    ]

    // State for more menu dropdown
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)

    // Close more menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isMoreMenuOpen && !event.target.closest('.relative')) {
                setIsMoreMenuOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isMoreMenuOpen])

    // Close more menu when activeTab changes
    useEffect(() => {
        setIsMoreMenuOpen(false)
    }, [activeTab])

    if (isLoading && !isNewPage) {
        return (
            <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading page editor...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
            {/* Top Menu Bar */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* Left section - Back button and page info */}
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={handleClose}
                                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to {previousView === '/pages' ? 'Pages' :
                                    previousView === '/settings' ? 'Settings' : 'Previous View'}
                            </button>

                            <div className="h-6 w-px bg-gray-300"></div>

                            <div>
                                <h1 className="text-lg font-semibold text-gray-900 truncate">
                                    {isNewPage ? 'New Page' : (pageData?.title || 'Untitled Page')}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    /{isNewPage ? 'new-page-slug' : (pageData?.slug || 'page-slug')}
                                </p>
                            </div>
                        </div>

                        {/* Center section - Tab navigation */}
                        <div className="flex items-center space-x-1">
                            {tabs.map((tabItem) => {
                                const Icon = tabItem.icon
                                const tabPath = isNewPage ? `/pages/new/${tabItem.id}` : `/pages/${pageId}/edit/${tabItem.id}`
                                const isActive = activeTab === tabItem.id

                                return (
                                    <button
                                        key={tabItem.id}
                                        onClick={() => navigate(tabPath, { state: { previousView } })}
                                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${isActive
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4 mr-2" />
                                        {tabItem.label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Right section - Actions */}
                        <div className="flex items-center space-x-3">


                            <button
                                onClick={handleQuickPublish}
                                disabled={pageData?.publication_status === 'published' || isPublishing}
                                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                {isPublishing ? 'Publishing...' : 'Publish'}
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                                    className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>

                                {/* More menu dropdown */}
                                {isMoreMenuOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                        <div className="py-1">
                                            {moreMenuItems.map((menuItem) => {
                                                const Icon = menuItem.icon
                                                const itemPath = isNewPage ? `/pages/new/${menuItem.id}` : `/pages/${pageId}/edit/${menuItem.id}`
                                                const isActive = activeTab === menuItem.id

                                                return (
                                                    <button
                                                        key={menuItem.id}
                                                        onClick={() => {
                                                            navigate(itemPath, { state: { previousView } })
                                                            setIsMoreMenuOpen(false)
                                                        }}
                                                        className={`w-full flex items-center px-4 py-2 text-sm transition-colors ${isActive
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <Icon className="w-4 h-4 mr-3" />
                                                        {menuItem.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                <div className="h-full">
                    {activeTab === 'content' && (
                        <>
                            {isLoadingLayout ? (
                                <div className="h-full flex items-center justify-center bg-gray-50">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                        <p className="text-gray-600">Loading layout data...</p>
                                    </div>
                                </div>
                            ) : (
                                <ContentEditor
                                    ref={contentEditorRef}
                                    pageData={pageData}
                                    onUpdate={updatePageData}
                                    isNewPage={isNewPage}
                                    layoutJson={layoutData}
                                    editable={true}
                                    onDirtyChange={(isDirty, reason) => {
                                        console.log('🔄 DIRTY STATE: ContentEditor -> PageEditor', { isDirty, reason });
                                        setIsDirty(isDirty);
                                    }}
                                />
                            )}
                        </>
                    )}
                    {activeTab === 'settings' && (
                        <SettingsEditor
                            ref={settingsEditorRef}
                            pageData={pageData}
                            onUpdate={updatePageData}
                            isNewPage={isNewPage}
                        />
                    )}
                    {activeTab === 'metadata' && (
                        <MetadataEditor
                            ref={metadataEditorRef}
                            pageData={pageData}
                            onUpdate={updatePageData}
                            isNewPage={isNewPage}
                        />
                    )}
                    {activeTab === 'preview' && (
                        <div className="h-full bg-white">
                            <PagePreview pageData={pageData} />
                        </div>
                    )}
                </div>
            </div>

            {/* Status bar with notifications */}
            <StatusBar
                showAutoSave={true}
                isDirty={isDirty}
                showVersionSelector={!isNewPage && !!pageData?.id}
                currentVersion={currentVersion}
                availableVersions={availableVersions}
                onVersionChange={switchToVersion}
                onRefreshVersions={loadVersions}
                onSaveClick={handleSaveFromStatusBar}
                onAutoSaveToggle={handleAutoSaveToggle}
                autoSaveEnabled={autoSaveEnabled}
                customStatusContent={
                    <div className="flex items-center space-x-4">
                        <span>
                            Status: <span className={`font-medium ${pageData?.publication_status === 'published' ? 'text-green-600' :
                                pageData?.publication_status === 'scheduled' ? 'text-blue-600' :
                                    'text-gray-600'
                                }`}>
                                {pageData?.publication_status || 'unpublished'}
                            </span>
                        </span>
                        {pageData?.last_modified && (
                            <span>
                                Last modified: {new Date(pageData.last_modified).toLocaleString()}
                            </span>
                        )}
                    </div>
                }
            />
        </div>
    )
}

// Settings Editor Tab
const SettingsEditor = forwardRef(({ pageData, onUpdate, isNewPage }, ref) => {
    // Expose save method to parent
    useImperativeHandle(ref, () => ({
        saveSettings: async () => {
            console.log('🔄 SAVE SIGNAL: SettingsEditor.saveSettings() called');

            // Settings are already saved in real-time via onUpdate
            // This method confirms the current state is saved
            const currentSettings = {
                title: pageData?.title || '',
                slug: pageData?.slug || '',
                description: pageData?.description || '',
                code_layout: pageData?.code_layout || '',
                publication_status: pageData?.publication_status || 'unpublished'
            };

            console.log('✅ SAVE SIGNAL: SettingsEditor - Current settings confirmed', currentSettings);

            return {
                module: 'settings',
                status: 'success',
                data: currentSettings,
                timestamp: new Date().toISOString()
            };
        }
    }), [pageData]);

    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Page Settings</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Page Title
                            </label>
                            <input
                                type="text"
                                value={pageData?.title || ''}
                                onChange={(e) => onUpdate({ title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter page title"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                URL Slug
                            </label>
                            <input
                                type="text"
                                value={pageData?.slug || ''}
                                onChange={(e) => onUpdate({ slug: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="page-url-slug"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={pageData?.description || ''}
                                onChange={(e) => onUpdate({ description: e.target.value })}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter page description"
                            />
                        </div>

                        {/* Page Layout Selection */}
                        <div>
                            <LayoutSelector
                                value={pageData?.code_layout || ''}
                                onChange={(layout) => onUpdate({ code_layout: layout })}
                                label="Page Layout"
                                description="Choose the layout template for this page"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Publication Status
                            </label>
                            <select
                                value={pageData?.publication_status || 'unpublished'}
                                onChange={(e) => onUpdate({ publication_status: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="unpublished">Unpublished</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="published">Published</option>
                                <option value="expired">Expired</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
});

// Add display name for debugging
SettingsEditor.displayName = 'SettingsEditor';

// Metadata Editor Tab
const MetadataEditor = forwardRef(({ pageData, onUpdate, isNewPage }, ref) => {
    // Expose save method to parent
    useImperativeHandle(ref, () => ({
        saveMetadata: async () => {
            console.log('🔄 SAVE SIGNAL: MetadataEditor.saveMetadata() called');

            // Metadata is already saved in real-time via onUpdate
            // This method confirms the current state is saved
            const currentMetadata = {
                meta_title: pageData?.meta_title || pageData?.title || '',
                meta_description: pageData?.meta_description || pageData?.description || '',
                hostnames: pageData?.hostnames || []
            };

            console.log('✅ SAVE SIGNAL: MetadataEditor - Current metadata confirmed', currentMetadata);

            return {
                module: 'metadata',
                status: 'success',
                data: currentMetadata,
                timestamp: new Date().toISOString()
            };
        }
    }), [pageData]);

    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">SEO & Metadata</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Meta Title
                            </label>
                            <input
                                type="text"
                                value={pageData?.meta_title || pageData?.title || ''}
                                onChange={(e) => onUpdate({ meta_title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="SEO title for search engines"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Meta Description
                            </label>
                            <textarea
                                value={pageData?.meta_description || pageData?.description || ''}
                                onChange={(e) => onUpdate({ meta_description: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="SEO description for search engines"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Hostnames
                            </label>
                            <input
                                type="text"
                                value={pageData?.hostnames?.join(', ') || ''}
                                onChange={(e) => onUpdate({
                                    hostnames: e.target.value.split(',').map(h => h.trim()).filter(h => h)
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="example.com, www.example.com"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                Enter hostnames separated by commas
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
});

// Add display name for debugging
MetadataEditor.displayName = 'MetadataEditor';

// Simple preview component
const PagePreview = ({ pageData }) => {
    return (
        <div className="h-full p-6 overflow-y-auto bg-gray-100">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow">
                <div className="p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        {pageData?.title || 'Untitled Page'}
                    </h1>
                    {pageData?.description && (
                        <p className="text-lg text-gray-600 mb-6">
                            {pageData.description}
                        </p>
                    )}
                    <div className="prose max-w-none">
                        <p className="text-gray-500 italic">
                            Live preview of page content would appear here...
                        </p>
                        <p className="text-sm text-gray-400 mt-4">
                            Current layout: {pageData?.code_layout || 'None selected'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PageEditor 