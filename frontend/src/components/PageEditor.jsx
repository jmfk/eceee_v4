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
    ChevronDown,
    ArrowLeft,
    Palette,
    ChevronLeft,
    ChevronRight,
    Trash2,
    Calendar
} from 'lucide-react'
import { pagesApi, layoutsApi, versionsApi } from '../api'
import { api } from '../api/client'
import { endpoints } from '../api/endpoints'
import { smartSave, analyzeChanges, determineSaveStrategy, generateChangeSummary } from '../utils/smartSaveUtils'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import ContentEditor from './ContentEditor'
import ErrorTodoSidebar from './ErrorTodoSidebar'
import SchemaDrivenForm from './SchemaDrivenForm'
import LayoutSelector from './LayoutSelector'
import StatusBar from './StatusBar'
import SaveOptionsModal from './SaveOptionsModal'

// Helpers: error parsing and merging for To-Do items
function mergeTodoItems(existing, incoming) {
    const byId = new Map(existing.map(i => [i.id, i]))
    incoming.forEach(item => {
        if (byId.has(item.id)) {
            const prev = byId.get(item.id)
            byId.set(item.id, { ...prev, ...item, checked: prev.checked && item.checked })
        } else {
            byId.set(item.id, item)
        }
    })
    return Array.from(byId.values())
}

function hashString(str) {
    let h = 0
    const s = String(str || '')
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i)
        h |= 0
    }
    return Math.abs(h).toString(36)
}

function mapFieldToTarget(field) {
    if (!field) return { type: 'data' }
    const settingsFields = new Set(['title', 'slug', 'codeLayout'])
    const metadataFields = new Set(['metaTitle', 'metaDescription', 'hostnames'])
    if (settingsFields.has(field)) return { type: 'settings' }
    if (metadataFields.has(field)) return { type: 'metadata' }
    return { type: 'data' }
}

function deriveTodoItemsFromError(errorString) {
    const items = []
    const s = String(errorString || '')

    // Common jsonschema error patterns
    const requiredMatch = s.match(/'(.*?)' is a required property/)
    if (requiredMatch) {
        const field = requiredMatch[1]
        const target = mapFieldToTarget(field)
        items.push({
            id: `required:${field}`,
            title: `Missing required field: ${field}`,
            detail: s,
            hint: `Provide a valid value for '${field}'.`,
            target,
            checked: false
        })
    }

    const typeMatch = s.match(/'(.*?)' is not of type '(.*?)'/)
    if (typeMatch) {
        const field = typeMatch[1]
        const expected = typeMatch[2]
        const target = mapFieldToTarget(field)
        items.push({
            id: `type:${field}`,
            title: `Field '${field}' must be of type ${expected}`,
            detail: s,
            hint: `Change the value of '${field}' to a ${expected}.`,
            target,
            checked: false
        })
    }

    // Fallback single item if nothing matched
    if (items.length === 0) {
        items.push({
            id: `error:${hashString(s)}`,
            title: 'Validation error',
            detail: s,
            hint: 'Review the error and update the related fields.',
            target: { type: 'data', path: null },
            checked: false
        })
    }
    return items
}


/**
 * PageEditor - Unified Page State Architecture
 * 
 * Data Structure:
 * - pageData: Unified page state with flat structure:
 *   {
 *     id: number,
 *     title: string,
 *     slug: string,
 *     description: string,
 *     codeLayout: string,
 *     widgets: { slot_name: [widget_objects] },
 *     versionId: number,        // Current version being viewed
 *     versionNumber: number,    // Version number for display
 *     publicationStatus: string, // draft/published/scheduled/expired
 *     // ... other page metadata
 *   }
 * - availableVersions: List of version metadata for dropdown
 * 
 * Version Management:
 * - Initial load: Regular page API populates pageData
 * - Switching versions: Version API response gets transformed and merged into pageData
 * - ContentEditor always uses pageData.widgets as single source of truth
 */
const PageEditor = () => {
    const { pageId, tab } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    // Extract version from URL search parameters
    const urlParams = new URLSearchParams(location.search)
    const versionFromUrl = urlParams.get('version')

    // Determine previous view from location state or default to /pages
    const previousView = location.state?.previousView || '/pages'
    const isNewPage = pageId === 'new' || !pageId
    const activeTab = tab || 'content'

    // Helper function to construct URL with current version parameter
    const buildUrlWithVersion = (path, version = versionFromUrl) => {
        if (version && !isNewPage) {
            const params = new URLSearchParams()
            params.set('version', version)
            return `${path}?${params.toString()}`
        }
        return path
    }

    // Redirect to content tab if no tab is specified
    useEffect(() => {
        if (!tab) {
            const basePath = isNewPage ? `/pages/new/content` : `/pages/${pageId}/edit/content`
            const defaultPath = buildUrlWithVersion(basePath)
            navigate(defaultPath, { replace: true, state: { previousView } })
        }
    }, [tab, isNewPage, pageId, navigate, previousView, versionFromUrl])
    // Separate WebPage and PageVersion data
    const [webpageData, setWebpageData] = useState(null)
    const [pageVersionData, setPageVersionData] = useState(null)
    const [originalWebpageData, setOriginalWebpageData] = useState(null) // Track original for smart saving
    const [originalPageVersionData, setOriginalPageVersionData] = useState(null) // Track original for smart saving
    const [isDirty, setIsDirty] = useState(false)
    const [layoutData, setLayoutData] = useState(null)
    const [isLoadingLayout, setIsLoadingLayout] = useState(false)
    const contentEditorRef = useRef(null)
    const settingsEditorRef = useRef(null)

    // Note: pageData has been completely removed - use webpageData and pageVersionData directly

    // Version management state
    const [currentVersion, setCurrentVersion] = useState(null)
    const [availableVersions, setAvailableVersions] = useState([])

    // Guard: only consider layout/rendering ready once the intended version is resolved
    // Note: API returns 'id' but we need to check against currentVersion.id
    const isVersionReady = isNewPage || (
        Boolean(currentVersion?.id) && Boolean(pageVersionData?.id) && currentVersion.id === pageVersionData.id
    )



    // Auto-save management state
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)

    // Save options modal state
    const [showSaveOptionsModal, setShowSaveOptionsModal] = useState(false)

    // Validation To-Do sidebar state
    const [errorTodoItems, setErrorTodoItems] = useState([])

    const queryClient = useQueryClient()
    const { showError, showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()



    // Initialize data for new page
    useEffect(() => {
        if (isNewPage && !webpageData && !pageVersionData) {
            // Initialize WebPage data
            setWebpageData({
                title: '',
                slug: '',
                description: '',
                hostnames: [],
                enableCssInjection: false,
                pageCssVariables: {},
                pageCustomCss: ''
            })

            // Initialize PageVersion data
            setPageVersionData({
                pageData: {},
                widgets: {},
                codeLayout: '',
                theme: null,
                versionTitle: 'Initial version',
                publicationStatus: 'unpublished'
            })
        }
    }, [isNewPage, webpageData, pageVersionData])

    // Fetch webpage data (WebPage model data)
    const { data: webpage, isLoading: isLoadingWebpage } = useQuery({
        queryKey: ['webpage', pageId],
        queryFn: async () => {
            return await pagesApi.get(pageId)
        },
        enabled: !isNewPage
    })

    // Fetch page version data (PageVersion model data)
    const { data: pageVersion, isLoading: isLoadingPageVersion } = useQuery({
        queryKey: ['pageVersion', pageId],
        queryFn: async () => {
            const result = await pagesApi.versionCurrent(pageId)
            return result
        },
        enabled: !isNewPage
    })

    // Combined loading state
    const isLoading = isLoadingWebpage || isLoadingPageVersion

    // Add loading notifications for page data
    useEffect(() => {
        if (isLoading && !isNewPage) {
            addNotification(`Loading page data...`, 'info', 'page-load')
        } else if (webpage && pageVersion && !isNewPage) {
            addNotification(`Page "${webpage.title}" loaded successfully`, 'success', 'page-load')
        }
    }, [isLoading, webpage, pageVersion, isNewPage, addNotification])

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

    // Process webpage data (WebPage model fields)
    useEffect(() => {
        if (webpage && !isNewPage) {
            setWebpageData(webpage)
            setOriginalWebpageData(webpage) // Track original for smart saving
        }
    }, [webpage, isNewPage])

    // Process page version data (PageVersion model fields)
    useEffect(() => {
        if (pageVersion && !isNewPage) {
            setPageVersionData({ ...pageVersion })
            setOriginalPageVersionData({ ...pageVersion }) // Track original for smart saving
        }
    }, [pageVersion, isNewPage])

    // Fetch layout data when page has a codeLayout, with fallback support
    useEffect(() => {
        if (!pageVersionData) return;
        if (!isVersionReady) return;
        const fetchLayoutData = async () => {
            setIsLoadingLayout(true)

            // Determine which layout to load (support both camelCase and snake_case)
            let layoutToLoad = pageVersionData?.codeLayout;
            let isUsingFallback = false;

            if (!layoutToLoad) {
                // Use fallback layout for versions without layout
                layoutToLoad = 'single_column'; // Default fallback layout
                isUsingFallback = true;
            }

            try {
                if (isUsingFallback) {
                    addNotification(`Using fallback layout: ${layoutToLoad}`, 'info', 'layout-load')
                } else {
                    addNotification(`Loading layout: ${layoutToLoad}`, 'info', 'layout-load')
                }

                const layoutData = await layoutsApi.getJson(layoutToLoad)
                setLayoutData(layoutData)

                if (isUsingFallback) {
                    addNotification(`Fallback layout "${layoutToLoad}" loaded for preview`, 'success', 'layout-load')
                } else {
                    addNotification(`Layout "${layoutToLoad}" loaded successfully`, 'success', 'layout-load')
                }
            } catch (error) {
                console.error('Failed to load layout:', error)

                if (isUsingFallback) {
                    addNotification(`Failed to load fallback layout: ${layoutToLoad}`, 'error', 'layout-load')
                } else {
                    addNotification(`Failed to load layout: ${layoutToLoad}`, 'error', 'layout-load')
                }

                showError(error, 'Failed to load layout data')
                setLayoutData(null)
            } finally {
                setIsLoadingLayout(false)
            }
        }

        // Only fetch if we have pageVersionData (avoid loading on initial mount)
        if (pageVersionData) {
            fetchLayoutData()
        }
    }, [pageVersionData?.codeLayout, webpageData?.id, isVersionReady, addNotification, showError])


    // Publish page mutation
    const publishPageMutation = useMutation({
        mutationFn: async () => {
            return await pagesApi.update(pageId, {
                publicationStatus: 'published'
            })
        },
        onSuccess: (updatedPage) => {
            addNotification('Page published successfully', 'success', 'page-publish')
            // Update the appropriate data structure based on response
            if (updatedPage.widgets) {
                setPageVersionData(prev => ({ ...prev, ...updatedPage }))
            } else {
                setWebpageData(prev => ({ ...prev, ...updatedPage }))
            }
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

    // Version management functions
    const loadVersions = useCallback(async () => {
        if (!webpageData?.id || isNewPage) {
            return;
        }
        try {
            const versionsData = await versionsApi.getPageVersionsList(webpageData.id || pageId);
            setAvailableVersions(versionsData.versions || []);

            let targetVersion = null;

            // First priority: Use version from URL if specified and valid
            if (versionFromUrl && versionsData.versions) {
                targetVersion = versionsData.versions.find(v => v.id.toString() === versionFromUrl);
                if (!targetVersion) {
                    // Version ID from URL is invalid, remove it from URL
                    const currentPath = location.pathname;
                    navigate(currentPath, { replace: true, state: { previousView } });
                }
            }

            // Second priority: Use highest version number (last saved) if no URL version or URL version is invalid
            if (!targetVersion && versionsData.versions && versionsData.versions.length > 0) {
                targetVersion = versionsData.versions.reduce((latest, current) => {
                    return (current.versionNumber > latest.versionNumber) ? current : latest;
                });
            }

            if (targetVersion) {
                setCurrentVersion(targetVersion);
                // Load the complete version data including widgets using raw API
                const response = await api.get(endpoints.versions.pageVersionDetail(webpageData.id || pageId, targetVersion.id));
                const newPage = response.data || response;
                setPageVersionData(newPage);
            }
        } catch (error) {
            console.error('PageEditor: Error loading versions', error);
            showError('Failed to load page versions');
        }
    }, [webpageData?.id, isNewPage, versionFromUrl, location.pathname, navigate, previousView, showError]);

    // Load versions but preserve current version selection
    const loadVersionsPreserveCurrent = useCallback(async () => {
        if (!webpageData?.id || isNewPage) {
            return;
        }
        try {
            const versionsData = await versionsApi.getPageVersionsList(webpageData.id || pageId);
            setAvailableVersions(versionsData.versions || []);

            // Only set current version if not already set
            if (!currentVersion && versionsData.versions && versionsData.versions.length > 0) {
                // Find the version with the highest version number (last saved)
                const lastSavedVersion = versionsData.versions.reduce((latest, current) => {
                    return (current.versionNumber > latest.versionNumber) ? current : latest;
                });
                setCurrentVersion(lastSavedVersion);
                // Load the complete version data including widgets using raw API
                const response = await api.get(endpoints.versions.pageVersionDetail(webpageData.id || pageId, lastSavedVersion.id));
                const newPage = response.data || response;
                setPageVersionData(newPage);
            } else if (currentVersion) {
                // If we have a current version, reload the page data with that version using raw API
                const response = await api.get(endpoints.versions.pageVersionDetail(webpageData.id || pageId, currentVersion.id));
                const newPage = response.data || response;
                setPageVersionData(newPage);
            }
        } catch (error) {
            console.error('PageEditor: Error loading versions', error);
            showError('Failed to load page versions');
        }
    }, [webpageData?.id, isNewPage, currentVersion, showError]);



    // Handle page data updates - route to appropriate data structure
    const updatePageData = (updates) => {
        // Handle version changes from LayoutRenderer
        if (updates.versionChanged && updates.pageVersionData) {
            // This is a version switch from LayoutRenderer, use switchToVersion
            const versionId = updates.pageVersionData.id || updates.pageVersionData.versionId;
            switchToVersion(versionId);
            return; // Don't set dirty for version switches
        }

        // Define fields that belong to WebPage model (sync with PAGE_FIELDS in smartSaveUtils.js)
        const webpageFields = [
            'title', 'slug', 'description', 'parent', 'parentId', 'sortOrder',
            'hostnames', 'enableCssInjection', 'pageCssVariables', 'pageCustomCss',
            'metaTitle', 'metaDescription'
        ]

        // Separate updates into webpage and version updates
        const webpageUpdates = {}
        const versionUpdates = {}

        Object.entries(updates).forEach(([key, value]) => {
            if (webpageFields.includes(key)) {
                webpageUpdates[key] = value
            } else {
                // Everything else goes to version data (widgets, codeLayout, pageData, etc.)
                versionUpdates[key] = value
            }
        })

        // Apply updates to appropriate state
        if (Object.keys(webpageUpdates).length > 0) {
            setWebpageData(prev => ({ ...prev, ...webpageUpdates }))
        }
        if (Object.keys(versionUpdates).length > 0) {
            setPageVersionData(prev => ({ ...prev, ...versionUpdates }))
        }

        setIsDirty(true)
    }

    const switchToVersion = useCallback(async (versionId) => {
        if (!versionId || !webpageData?.id) return;
        try {
            // Use the raw API endpoint to get the proper data structure
            const response = await api.get(endpoints.versions.pageVersionDetail(webpageData.id || pageId, versionId));
            const versionPageData = response.data || response;
            const versionData = availableVersions.find(version => version.id === versionId);
            setCurrentVersion(versionData);

            // Set pageVersionData with the raw API response structure
            setPageVersionData(versionPageData);
            setOriginalPageVersionData(versionPageData);

            // Update URL to include version parameter
            const currentPath = location.pathname;
            const newUrl = buildUrlWithVersion(currentPath, versionId);
            navigate(newUrl, { replace: true, state: { previousView } });

            // Handle layout fallback for versions without valid layouts
            if (!versionPageData.codeLayout) {
                addNotification({
                    type: 'warning',
                    message: `Version ${versionData.versionNumber} has no layout. Using fallback layout for preview.`
                });
            }

            addNotification({
                type: 'info',
                message: `Switched to version ${versionData.versionNumber}`
            });
        } catch (error) {
            console.error('PageEditor: Error switching to version', error);
            showError(`Failed to load version: ${error.message}`);
        }
    }, [webpageData, availableVersions, showError, addNotification, location.pathname, navigate, buildUrlWithVersion, previousView]);

    // Load versions when page data is available
    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    // Sync auto-save state with all editors when they're available
    useEffect(() => {
        // Sync with ContentEditor
        if (contentEditorRef.current && contentEditorRef.current.enableAutoSave) {
            contentEditorRef.current.enableAutoSave(autoSaveEnabled, autoSaveEnabled ? 10000 : 0);
        }
    }, [autoSaveEnabled, layoutData]); // layoutData dependency ensures this runs after ContentEditor is mounted

    // SMART SAVE: Intelligent save logic that only saves what changed
    const handleActualSave = useCallback(async (saveOptions = {}) => {
        try {
            // Collect all data from editors (no saving yet)
            const collectedData = {};

            // Collect current widget data (from pageVersionData) and any unsaved changes from ContentEditor
            collectedData.widgets = pageVersionData?.widgets || {};
            if (contentEditorRef.current && contentEditorRef.current.saveWidgets) {
                try {
                    const widgetResult = await contentEditorRef.current.saveWidgets({
                        source: 'smart_save_from_statusbar',
                        description: 'Smart save triggered from status bar',
                        collectOnly: true  // Tell ContentEditor to collect data, not save
                    });
                    // Merge any changes from ContentEditor with existing widgets
                    collectedData.widgets = widgetResult.data || widgetResult || collectedData.widgets;
                } catch (error) {
                    console.error('❌ SMART SAVE: Widget data collection failed', error);
                }
            }

            // Collect settings data from SettingsEditor
            if (settingsEditorRef.current && settingsEditorRef.current.saveSettings) {
                try {
                    const settingsResult = await settingsEditorRef.current.saveSettings();
                    collectedData.settings = settingsResult.data || settingsResult;
                } catch (error) {
                    console.error('❌ SMART SAVE: Settings data collection failed', error);
                    throw new Error(`Settings data collection failed: ${error.message}`);
                }
            }



            // Prepare data for smart save
            const currentWebpageDataForSave = {
                ...webpageData,
                ...collectedData.settings,
                ...collectedData.metadata
            };

            const currentVersionDataForSave = {
                ...pageVersionData,
                widgets: collectedData.widgets
            };



            // Use smart save with separated data
            const saveResult = await smartSave(
                originalWebpageData || {},      // Original webpage data
                currentWebpageDataForSave,      // Current webpage data
                originalPageVersionData || {},  // Original version data
                currentVersionDataForSave,      // Current version data
                { pagesApi, versionsApi },      // API functions
                {
                    description: saveOptions.description || 'Auto-save',
                    forceNewVersion: saveOptions.option === 'new'
                }
            );



            // Update UI based on what was saved
            let updatedWebpageData = currentWebpageDataForSave;
            let updatedVersionData = currentVersionDataForSave;

            if (saveResult.pageResult) {
                // Page was updated - merge the response into webpage data
                updatedWebpageData = { ...updatedWebpageData, ...saveResult.pageResult };
            }

            if (saveResult.versionResult) {
                // New version was created - use the version data
                updatedVersionData = {
                    ...updatedVersionData,
                    ...saveResult.versionResult,
                    widgets: collectedData.widgets // Preserve collected widgets
                };

                // Update current version
                setCurrentVersion(saveResult.versionResult);
            }

            // Update separated data states and mark as clean
            setWebpageData(updatedWebpageData);
            setPageVersionData(updatedVersionData);
            setOriginalWebpageData(updatedWebpageData); // Update original for next comparison
            setOriginalPageVersionData(updatedVersionData); // Update original for next comparison
            setIsDirty(false);

            // Clear To-Do items on success
            setErrorTodoItems([])

            // Mark LayoutRenderer as clean after successful save
            if (contentEditorRef.current?.layoutRenderer) {
                contentEditorRef.current.layoutRenderer.markAsClean();
            }

            // Show success notification with smart summary
            const actionDescription = saveResult.strategy === 'page-only' ? 'Page updated' :
                saveResult.strategy === 'version-only' ? 'New version created' :
                    saveResult.strategy === 'both' ? 'Page and version updated' :
                        'No changes';

            addNotification({
                type: 'success',
                message: `${actionDescription}! ${saveResult.summary}${saveOptions.description ? ` - "${saveOptions.description}"` : ''}`
            });

            // Reload versions if a version was created/updated
            if (saveResult.versionResult) {
                await loadVersionsPreserveCurrent();
            }

            // Invalidate queries to refresh data
            queryClient.invalidateQueries(['page', webpageData?.id || pageId]);
            queryClient.invalidateQueries(['pages', 'root']);

        } catch (error) {
            console.error('❌ SMART SAVE: Save failed', error);
            addNotification({
                type: 'error',
                message: `Save failed: ${error.message}`
            });
            showError(`Save failed: ${error.message}`);

            // Parse backend validation error and populate To-Do list
            const backendError = error?.response?.data?.error || error?.response?.data?.detail || error?.message
            if (backendError) {
                const items = deriveTodoItemsFromError(backendError)
                if (items && items.length > 0) {
                    setErrorTodoItems(prev => mergeTodoItems(prev, items))
                }
            }
        }
    }, [addNotification, showError, webpageData, pageVersionData, originalWebpageData, originalPageVersionData, queryClient, loadVersionsPreserveCurrent, currentVersion]);

    // Smart save - analyze changes first, then show modal only if needed
    const handleSaveFromStatusBar = useCallback(async () => {
        const unresolved = errorTodoItems.filter(i => !i.checked).length
        if (unresolved > 0) {
            addNotification({
                type: 'error',
                message: `Cannot save: resolve ${unresolved} issue${unresolved === 1 ? '' : 's'} in the To-Do sidebar`
            })
            return
        }

        try {
            // Collect all data from editors first (without saving)
            const collectedData = {};

            // Collect current widget data
            collectedData.widgets = pageVersionData?.widgets || {};
            if (contentEditorRef.current && contentEditorRef.current.saveWidgets) {
                try {
                    const widgetResult = await contentEditorRef.current.saveWidgets({
                        source: 'smart_save_analysis',
                        description: 'Analyzing changes for save decision',
                        collectOnly: true
                    });
                    collectedData.widgets = widgetResult.data || widgetResult || collectedData.widgets;
                } catch (error) {
                    console.error('❌ Widget data collection failed during analysis', error);
                }
            }

            // Collect settings data
            if (settingsEditorRef.current && settingsEditorRef.current.saveSettings) {
                try {
                    const settingsResult = await settingsEditorRef.current.saveSettings();
                    collectedData.settings = settingsResult.data || settingsResult;
                } catch (error) {
                    console.error('❌ Settings data collection failed during analysis', error);
                    throw new Error(`Settings collection failed: ${error.message}`);
                }
            }



            // Prepare data for save analysis
            const currentWebpageDataForSave = {
                ...webpageData,
                ...collectedData.settings
            };

            const currentVersionDataForSave = {
                ...pageVersionData,
                widgets: collectedData.widgets
            };

            // Analyze what changed using separated data
            const changes = analyzeChanges(
                originalWebpageData || {},
                currentWebpageDataForSave,
                originalPageVersionData || {},
                currentVersionDataForSave
            );
            const strategy = determineSaveStrategy(changes);



            // Decision logic: Show modal only if version changes detected
            if (strategy.strategy === 'page-only') {
                // Only page changes - save directly without modal

                await handleActualSave({ description: 'Page attributes updated' });
            } else if (strategy.strategy === 'none') {
                // No changes - just show notification
                addNotification({
                    type: 'info',
                    message: 'No changes detected'
                });
            } else {
                // Version changes detected - show modal for user to choose options

                setShowSaveOptionsModal(true);
            }

        } catch (error) {
            console.error('❌ Save analysis failed:', error);
            addNotification({
                type: 'error',
                message: `Save analysis failed: ${error.message}`
            });
        }
    }, [errorTodoItems, addNotification, webpageData, pageVersionData, originalWebpageData, originalPageVersionData, contentEditorRef, settingsEditorRef, handleActualSave]);

    // Handle save options from modal
    const handleSaveOptions = useCallback(async (saveOptions) => {
        try {
            await handleActualSave(saveOptions);
        } catch (error) {
            // Error handling is already done in handleActualSave
            throw error;
        }
    }, [handleActualSave]);

    // Auto-save toggle handler
    const handleAutoSaveToggle = useCallback((enabled) => {
        setAutoSaveEnabled(enabled);

        // Pass auto-save setting to ContentEditor
        if (contentEditorRef.current && contentEditorRef.current.enableAutoSave) {
            contentEditorRef.current.enableAutoSave(enabled, enabled ? 10000 : 0);
        }

        addNotification({
            type: 'info',
            message: `Auto-save ${enabled ? 'enabled' : 'disabled'} - Settings & metadata save in real-time`
        });
    }, [addNotification]);

    // Tab navigation (main tabs)
    const tabs = [
        { id: 'content', label: 'Content', icon: Layout },
        { id: 'data', label: 'Data', icon: FileText },
        { id: 'settings', label: 'Settings & SEO', icon: Settings },
        { id: 'publishing', label: 'Publishing', icon: Calendar },
        { id: 'preview', label: 'Preview', icon: Eye },
    ]

    // State for mobile dropdown menu
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)

    // Close dropdown when clicking outside
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

    // Close dropdown when activeTab changes
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
                                    {isNewPage ? 'New Page' : (webpageData?.title || 'Untitled Page')}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    /{isNewPage ? 'new-page-slug' : (webpageData?.slug || 'page-slug')}
                                </p>
                            </div>
                        </div>

                        {/* Center section - Tab navigation */}
                        {/* Desktop tabs - hidden on mobile */}
                        <div className="flex items-center space-x-3">
                            <div className="hidden lg:flex items-center space-x-1">
                                {tabs.map((tabItem, index) => {
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



                            <div className="lg:hidden relative">
                                <button
                                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                                    className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    {(() => {
                                        const currentTab = tabs.find(tab => tab.id === activeTab)
                                        if (currentTab) {
                                            const Icon = currentTab.icon
                                            return (
                                                <>
                                                    <Icon className="w-4 h-4 mr-2" />
                                                    <span className="text-sm font-medium">{currentTab.label}</span>
                                                </>
                                            )
                                        }
                                        return <span className="text-sm">Select Tab</span>
                                    })()}
                                    <ChevronDown className="w-4 h-4 ml-2" />
                                </button>

                                {/* Mobile dropdown menu */}
                                {isMoreMenuOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                        <div className="py-1">
                                            {tabs.map((tabItem) => {
                                                const Icon = tabItem.icon
                                                const tabPath = isNewPage ? `/pages/new/${tabItem.id}` : `/pages/${pageId}/edit/${tabItem.id}`
                                                const isActive = activeTab === tabItem.id

                                                return (
                                                    <button
                                                        key={tabItem.id}
                                                        onClick={() => {
                                                            navigate(tabPath, { state: { previousView } })
                                                            setIsMoreMenuOpen(false)
                                                        }}
                                                        className={`w-full flex items-center px-4 py-2 text-sm transition-colors ${isActive
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <Icon className="w-4 h-4 mr-3" />
                                                        {tabItem.label}
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

            {/* Main Content Area with right error To-Do sidebar */}
            <div className="flex-1 overflow-hidden">
                <div className="h-full flex">
                    <div className="flex-1 min-w-0">
                        {activeTab === 'content' && (
                            <>
                                {!isVersionReady ? (
                                    <div className="h-full flex items-center justify-center bg-gray-50">
                                        <div className="text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                            <p className="text-gray-600">Loading version data...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Layout fallback warning */}
                                        {!(pageVersionData?.codeLayout) && (
                                            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
                                                <div className="flex">
                                                    <div className="flex-shrink-0">
                                                        <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="text-sm text-amber-700">
                                                            <strong>No layout specified for this version.</strong> Using fallback single-column layout for preview.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {isLoadingLayout ? (
                                            <div className="h-full flex items-center justify-center bg-gray-50">
                                                <div className="text-center">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                                    <p className="text-gray-600">Loading layout data...</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <ContentEditor
                                                key={`${webpageData?.id}-${pageVersionData?.versionId || 'current'}`}
                                                ref={contentEditorRef}
                                                webpageData={webpageData}
                                                pageVersionData={pageVersionData}
                                                onUpdate={updatePageData}
                                                isNewPage={isNewPage}
                                                layoutJson={layoutData}
                                                editable={true}
                                                onDirtyChange={(isDirty, reason) => {
                                                    setIsDirty(isDirty);
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </>
                        )}
                        {activeTab === 'settings' && (
                            <SettingsEditor
                                key={`settings-${pageVersionData?.versionId || 'new'}`}
                                ref={settingsEditorRef}
                                webpageData={webpageData}
                                pageVersionData={pageVersionData}
                                onUpdate={updatePageData}
                                isNewPage={isNewPage}
                            />
                        )}
                        {activeTab === 'publishing' && !isNewPage && (
                            <PublishingEditor
                                key={`publishing-${pageVersionData?.versionId || 'current'}`}
                                webpageData={webpageData}
                                pageVersionData={pageVersionData}
                                pageId={pageId}
                                currentVersion={currentVersion}
                                onVersionChange={switchToVersion}
                            />
                        )}
                        {activeTab === 'data' && (
                            <SchemaDrivenForm
                                key={`data-${pageVersionData?.id || 'new'}`}
                                pageVersionData={pageVersionData}
                                onChange={(data) => updatePageData({
                                    pageData: { ...pageVersionData?.pageData, ...data }
                                })}
                            />
                        )}
                        {activeTab === 'preview' && (
                            <div className="h-full bg-white">
                                {!isVersionReady ? (
                                    <div className="h-full flex items-center justify-center bg-gray-50">
                                        <div className="text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                            <p className="text-gray-600">Loading version data...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <PagePreview
                                        webpageData={webpageData}
                                        pageVersionData={pageVersionData}
                                        isLoadingLayout={isLoadingLayout}
                                        layoutData={layoutData}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                    {/* Right Error To-Do Sidebar */}
                    {errorTodoItems.length > 0 && (
                        <ErrorTodoSidebar
                            items={errorTodoItems}
                            onToggle={(id, checked) => setErrorTodoItems(prev => prev.map(i => i.id === id ? { ...i, checked } : i))}
                            onNavigate={(item) => navigateToFix({ item, navigate, pageId, isNewPage, currentVersion, previousView })}
                        />
                    )}
                </div>
            </div>

            {/* Status bar with notifications */}
            <StatusBar
                showAutoSave={true}
                isDirty={isDirty}
                currentVersion={currentVersion}
                availableVersions={availableVersions}
                onVersionChange={switchToVersion}
                onRefreshVersions={loadVersions}
                onSaveClick={handleSaveFromStatusBar}
                onAutoSaveToggle={handleAutoSaveToggle}
                autoSaveEnabled={autoSaveEnabled}
                webpageData={webpageData}
                pageVersionData={pageVersionData}
                customStatusContent={
                    <div className="flex items-center space-x-4">
                        <span>
                            Status: <span className={`font-medium ${pageVersionData?.publicationStatus === 'published' ? 'text-green-600' :
                                pageVersionData?.publicationStatus === 'scheduled' ? 'text-blue-600' :
                                    'text-gray-600'
                                }`}>
                                {pageVersionData?.publicationStatus || 'unpublished'}
                            </span>
                        </span>

                        {!isNewPage && (
                            <button
                                onClick={() => navigate(`/pages/${pageId}/edit/publishing`, { state: { previousView } })}
                                className="text-xs px-3 py-1 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center space-x-1"
                            >
                                <Calendar className="w-3 h-3" />
                                <span>Publishing</span>
                            </button>
                        )}

                        {webpageData?.last_modified && (
                            <span>
                                Last modified: {new Date(webpageData.last_modified).toLocaleString()}
                            </span>
                        )}
                    </div>
                }
            />

            {/* Save Options Modal */}
            <SaveOptionsModal
                isOpen={showSaveOptionsModal}
                onClose={() => setShowSaveOptionsModal(false)}
                onSave={handleSaveOptions}
                currentVersion={currentVersion}
                isNewPage={isNewPage}
            />
        </div>
    )
}

// Settings & SEO Editor Tab (merged from SettingsEditor and MetadataEditor)
const SettingsEditor = forwardRef(({ webpageData, pageVersionData, onUpdate, isNewPage }, ref) => {
    // Expose save method to parent
    useImperativeHandle(ref, () => ({
        saveSettings: async () => {
            // Settings are already saved in real-time via onUpdate
            // This method confirms the current state is saved
            const currentSettings = {
                // WebPage fields
                title: webpageData?.title || '',
                slug: webpageData?.slug || '',
                description: webpageData?.description || '',
                parent: webpageData?.parent,
                parentId: webpageData?.parentId,
                sortOrder: webpageData?.sortOrder,
                hostnames: webpageData?.hostnames || [],
                enableCssInjection: webpageData?.enableCssInjection || false,
                pageCssVariables: webpageData?.pageCssVariables || {},
                pageCustomCss: webpageData?.pageCustomCss || '',
                // SEO & Metadata fields
                metaTitle: webpageData?.metaTitle || webpageData?.title || '',
                metaDescription: webpageData?.metaDescription || '',
                // PageVersion field (codeLayout affects version content)
                codeLayout: pageVersionData?.codeLayout || ''
            };

            return {
                module: 'settings',
                status: 'success',
                data: currentSettings,
                timestamp: new Date().toISOString()
            };
        }
    }), [webpageData, pageVersionData]);

    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Page Settings Section */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Page Settings</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Page Title
                            </label>
                            <input
                                type="text"
                                value={webpageData?.title || ''}
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
                                value={webpageData?.slug || ''}
                                onChange={(e) => onUpdate({ slug: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="page-url-slug"
                            />
                        </div>

                        {/* Page Layout Selection */}
                        <div>
                            <LayoutSelector
                                value={pageVersionData?.codeLayout || ''}
                                onChange={(layout) => onUpdate({ codeLayout: layout })}
                                label="Page Layout"
                                description="Choose the layout template for this page"
                            />
                        </div>
                    </div>
                </div>

                {/* SEO & Metadata Section */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">SEO & Metadata</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Meta Title
                            </label>
                            <input
                                type="text"
                                value={webpageData?.metaTitle || webpageData?.title || ''}
                                onChange={(e) => onUpdate({ metaTitle: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="SEO title for search engines"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                If empty, will use the page title
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Meta Description
                            </label>
                            <textarea
                                value={webpageData?.metaDescription || ''}
                                onChange={(e) => onUpdate({ metaDescription: e.target.value })}
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
                                value={webpageData?.hostnames?.join(', ') || ''}
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
SettingsEditor.displayName = 'SettingsEditor';

// Publishing Editor Tab - Version Timeline & Publishing Management
const PublishingEditor = ({ webpageData, pageVersionData, pageId, currentVersion, onVersionChange }) => {
    const [versions, setVersions] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const { addNotification } = useGlobalNotifications()

    // Load versions when component mounts
    useEffect(() => {
        loadVersions()
    }, [pageId])

    const loadVersions = async () => {
        if (!pageId) return
        setIsLoading(true)
        try {
            const response = await versionsApi.getPageVersionsList(pageId)
            setVersions(response.versions || [])
        } catch (error) {
            console.error('Failed to load versions:', error)
            addNotification('Failed to load versions', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Loading versions...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Version Timeline & Publishing</h2>
                    <p className="text-gray-600">
                        Manage page versions, scheduling, and publishing workflow
                    </p>
                </div>

                {/* Version List */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-6">
                        <h3 className="text-md font-semibold text-gray-900 mb-4">Page Versions</h3>

                        {versions.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                <p>No versions found for this page</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {versions.map((version) => {
                                    const isCurrentVersion = currentVersion?.id === version.id

                                    return (
                                        <div
                                            key={version.id}
                                            className={`border rounded-lg p-4 ${isCurrentVersion ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    <div>
                                                        <div className="flex items-center space-x-2">
                                                            <span className="font-medium text-gray-900">
                                                                Version {version.versionNumber}
                                                            </span>
                                                            {isCurrentVersion && (
                                                                <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800">
                                                                    Current
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            {version.changeSummary || 'No description'}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Created {new Date(version.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    {!isCurrentVersion && (
                                                        <button
                                                            onClick={() => onVersionChange(version)}
                                                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                        >
                                                            Switch to
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Add display name for debugging
PublishingEditor.displayName = 'PublishingEditor';

// Preview component that renders actual page content without editing controls
const PagePreview = ({ webpageData, pageVersionData, isLoadingLayout, layoutData }) => {
    const [viewportSize, setViewportSize] = useState('desktop');

    // Viewport configurations with realistic device dimensions
    const viewports = {
        desktop: { width: '100%', height: '100%', label: 'Desktop', icon: '🖥️' },
        tablet: { width: '820px', height: '1180px', label: 'iPad Pro', icon: '📱' },
        mobile: { width: '390px', height: '844px', label: 'iPhone 14', icon: '📱' }
    };

    if (!webpageData || !pageVersionData) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                    <p className="text-lg">No page data available</p>
                    <p className="text-sm">Save your page to see the preview</p>
                </div>
            </div>
        );
    }

    if (!pageVersionData.codeLayout) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                    <p className="text-lg">No layout selected</p>
                    <p className="text-sm">Choose a layout to see the preview</p>
                </div>
            </div>
        );
    }

    // Show loading state if layout data is still being fetched
    if (isLoadingLayout) {
        return (
            <div className="h-full bg-gray-50 overflow-auto">
                <div className="h-full p-4 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                        <p className="text-lg">Loading preview...</p>
                        <p className="text-sm">Fetching layout data</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show error state if layout data failed to load
    if (!layoutData && pageVersionData.codeLayout) {
        return (
            <div className="h-full bg-gray-50 overflow-auto">
                <div className="h-full p-4 flex items-center justify-center">
                    <div className="text-center text-red-500">
                        <p className="text-lg">Preview unavailable</p>
                        <p className="text-sm">Failed to load layout: {pageVersionData.codeLayout}</p>
                    </div>
                </div>
            </div>
        );
    }

    const currentViewport = viewports[viewportSize];

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            {/* Responsive Preview Controls */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">Preview</h3>
                    <div className="flex items-center space-x-1">
                        {Object.entries(viewports).map(([key, viewport]) => (
                            <button
                                key={key}
                                onClick={() => setViewportSize(key)}
                                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewportSize === key
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                                    }`}
                                title={`Switch to ${viewport.label} view`}
                            >
                                <span className="mr-1">{viewport.icon}</span>
                                {viewport.label}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Viewport Size Indicator */}
                {viewportSize !== 'desktop' && (
                    <div className="mt-2 text-xs text-gray-500 text-center">
                        {currentViewport.width} × {currentViewport.height}
                    </div>
                )}
            </div>

            {/* Preview Content */}
            <div className="flex-1 bg-gray-100 overflow-auto">
                {viewportSize === 'desktop' ? (
                    /* Desktop: Full responsive container */
                    <div className="h-full p-4">
                        <div className="bg-white shadow-lg rounded-lg w-full h-full overflow-auto">
                            <ContentEditor
                                key={`preview-${webpageData?.id}-${pageVersionData?.versionId || 'current'}`}
                                layoutJson={layoutData}
                                webpageData={webpageData}
                                pageVersionData={pageVersionData}
                                editable={false}
                                className="h-full preview-mode"
                            />
                        </div>
                    </div>
                ) : (
                    /* Mobile/Tablet: Fixed-size device containers with external scrolling */
                    <div className="h-full p-4 overflow-auto">
                        <div className="min-h-full flex items-start justify-center">
                            {/* Fixed-size device frame */}
                            <div
                                className={`transition-all duration-300 flex-shrink-0 ${viewportSize === 'tablet'
                                    ? 'border-2 border-gray-800 rounded-xl shadow-2xl'
                                    : 'border-2 border-gray-900 rounded-3xl shadow-2xl'
                                    }`}
                                style={{
                                    width: currentViewport.width,
                                    height: currentViewport.height,
                                    // Add device-like styling for mobile and tablet
                                    background: viewportSize === 'mobile'
                                        ? 'linear-gradient(145deg, #1f2937, #374151)'
                                        : 'linear-gradient(145deg, #374151, #4b5563)',
                                    padding: viewportSize === 'mobile' ? '8px' : '6px',
                                }}
                            >
                                {/* Inner screen with fixed dimensions and device-like scrolling */}
                                <div
                                    className="bg-white w-full h-full rounded-lg overflow-auto relative"
                                    style={{
                                        // Device-like smooth scrolling
                                        scrollBehavior: 'smooth',
                                        WebkitOverflowScrolling: 'touch',
                                        // Custom scrollbar for device-like appearance
                                        scrollbarWidth: 'thin',
                                        scrollbarColor: '#CBD5E0 transparent'
                                    }}
                                >
                                    {/* Device content area with natural scrolling */}
                                    <div className="w-full">
                                        <ContentEditor
                                            key={`mobile-preview-${webpageData?.id}-${pageVersionData?.versionId || 'current'}`}
                                            layoutJson={layoutData}
                                            webpageData={webpageData}
                                            pageVersionData={pageVersionData}
                                            editable={false}
                                            className="preview-mode device-content"
                                            style={{
                                                minHeight: 'auto',
                                                height: 'auto',
                                                display: 'block',
                                                overflow: 'visible'
                                            }}
                                        />
                                        {/* Add bottom padding for device-like scroll experience */}
                                        <div className="h-20 w-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PageEditor

// Navigate user to the view that needs fixing based on item.target
function navigateToFix({ item, navigate, pageId, isNewPage, currentVersion, previousView }) {
    const targetType = item?.target?.type
    if (!targetType) return
    const base = isNewPage ? `/pages/new` : `/pages/${pageId}/edit`
    let path = `${base}/data`
    if (targetType === 'settings') path = `${base}/settings`
    if (targetType === 'metadata') path = `${base}/metadata`
    if (targetType === 'content') path = `${base}/content`
    navigate(path, { state: { previousView } })
}