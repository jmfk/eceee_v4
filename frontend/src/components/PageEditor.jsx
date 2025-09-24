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
    Calendar,
    Save
} from 'lucide-react'
import { pagesApi, layoutsApi, versionsApi, themesApi } from '../api'
import { api } from '../api/client'
import { endpoints } from '../api/endpoints'
import { smartSave, analyzeChanges, determineSaveStrategy, generateChangeSummary, processLoadedVersionData } from '../utils/smartSaveUtils'
import { WIDGET_ACTIONS } from '../utils/widgetConstants'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useUnifiedData } from '../contexts/unified-data'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import ContentEditor from './ContentEditor'
import PageContentEditor from '../editors/page-editor/PageContentEditor'
import ErrorTodoSidebar from './ErrorTodoSidebar'
import SchemaDrivenForm from './SchemaDrivenForm'
import LayoutSelector from './LayoutSelector'
import StatusBar from './StatusBar'
import WidgetEditorPanel from './WidgetEditorPanel'
import PageTagWidget from './PageTagWidget'
import ThemeSelector from './ThemeSelector'
import PagePreview from './PagePreview'
import SettingsEditor from './SettingsEditor'
import PublishingEditor from './PublishingEditor'

import { logValidationSync } from '../utils/stateVerification'

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

    // Use global isDirty from UnifiedDataContext
    const { useExternalChanges, setIsDirty, publishUpdate } = useUnifiedData()

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


    // Get current dirty state from global context
    const componentId = `page-editor-${pageId}`;
    const [isDirty, setIsDirtyState] = useState(false);
    useExternalChanges(componentId, state => {
        setIsDirtyState(state.metadata.isDirty);
    });

    const [layoutData, setLayoutData] = useState(null)
    const [isLoadingLayout, setIsLoadingLayout] = useState(false)

    // Feature flag for new self-contained widget editor
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

    // Save mutation state
    const [isSaving, setIsSaving] = useState(false)

    // Widget editor panel state
    const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
    const [editingWidget, setEditingWidget] = useState(null)
    const widgetEditorRef = useRef(null)

    // Ref to track current editing widget for callbacks
    const editingWidgetRef = useRef(null)

    // Sync editingWidget state with ref for callbacks
    useEffect(() => {
        editingWidgetRef.current = editingWidget
    }, [editingWidget])

    // Validation To-Do sidebar state
    const [errorTodoItems, setErrorTodoItems] = useState([])
    const [schemaValidationState, setSchemaValidationState] = useState({ isValid: true, hasErrors: false })

    const queryClient = useQueryClient()
    const { showError, showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()

    // Initialize data for new page
    useEffect(() => {
        if (isNewPage && !webpageData && !pageVersionData) {
            const initialWebpageData = {
                title: '',
                slug: '',
                description: '',
                hostnames: [],
                enableCssInjection: false,
                pageCssVariables: {},
                pageCustomCss: ''
            };

            const initialPageVersionData = {
                pageData: {},
                widgets: {},
                codeLayout: '',
                theme: null,
                versionTitle: 'Initial version',
                publicationStatus: 'unpublished'
            };

            // // Initialize WebPage data
            // setWebpageData(initialWebpageData);
            // publishUpdate(componentId, OperationTypes.INIT_PAGE, {
            //     id: 'new',
            //     data: initialWebpageData
            // });

            // Initialize PageVersion data
            setPageVersionData(initialPageVersionData);
            publishUpdate(componentId, OperationTypes.INIT_VERSION, {
                id: 'new',
                data: initialPageVersionData
            });
        }
    }, [isNewPage, webpageData, pageVersionData, publishUpdate, componentId])

    // Fetch webpage data (WebPage model data)
    const { data: webpage, isLoading: isLoadingWebpage } = useQuery({
        queryKey: ['webpage', pageId],
        queryFn: async () => {
            const result = await pagesApi.get(pageId)
            return result
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
            setWebpageData(webpage);
            setOriginalWebpageData(webpage); // Track original for smart saving

            // Publish webpage data to UDC
            publishUpdate(componentId, OperationTypes.INIT_PAGE, {
                id: webpage.id,
                data: webpage
            });
        }
    }, [webpage, isNewPage, publishUpdate, componentId])

    // Process page version data (PageVersion model fields)
    useEffect(() => {
        if (pageVersion && !isNewPage) {
            const processedVersionData = processLoadedVersionData({ ...pageVersion });
            setPageVersionData(processedVersionData);
            setOriginalPageVersionData(processedVersionData); // Track original for smart saving

            // Publish version data to UDC
            publishUpdate(componentId, OperationTypes.INIT_PAGE, {
                id: processedVersionData.id,
                data: processedVersionData
            });
        }
    }, [pageVersion, isNewPage, publishUpdate, componentId])

    // Fetch layout data when page has a codeLayout, with fallback support
    useEffect(() => {
        const codeLayout = pageVersionData?.codeLayout;
        const webpageId = webpageData?.id;

        if (!pageVersionData || !isVersionReady) return;

        const fetchLayoutData = async () => {
            setIsLoadingLayout(true)

            // Determine which layout to load (support both camelCase and snake_case)
            let layoutToLoad = codeLayout;
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

        fetchLayoutData()
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
        // Check for widget unsaved changes first
        if (isDirty && widgetEditorOpen) {
            const confirmed = await showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. What would you like to do?',
                confirmText: 'Save Changes',
                cancelText: 'Discard Changes',
                confirmButtonStyle: 'primary'
            })

            if (confirmed) {
                // Save widget changes using the panel's save method
                if (widgetEditorRef.current) {
                    const savedWidget = widgetEditorRef.current.saveCurrentWidget()
                    if (savedWidget) {
                        await handleSaveWidget(savedWidget)
                    }
                }
            } else {
                // Discard widget changes
                handleCloseWidgetEditor()
            }
            return // Don't close the page editor yet
        }

        // Check for page unsaved changes
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
            setAvailableVersions(versionsData.results || []);
            let targetVersion = null;
            // First priority: Use version from URL if specified and valid
            if (versionFromUrl && versionsData.results) {
                targetVersion = versionsData.results.find(v => v.id.toString() === versionFromUrl);
                if (!targetVersion) {
                    // Version ID from URL is invalid, remove it from URL
                    const currentPath = location.pathname;
                    navigate(currentPath, { replace: true, state: { previousView } });
                }
            }
            // Second priority: Use highest version number (last saved) if no URL version or URL version is invalid
            if (!targetVersion && versionsData.results && versionsData.results.length > 0) {
                targetVersion = versionsData.results.reduce((latest, current) => {
                    return (current.versionNumber > latest.versionNumber) ? current : latest;
                });
            }
            if (targetVersion) {
                // First initialize the version data in UnifiedDataContext
                await publishUpdate(componentId, OperationTypes.INIT_PAGE, {
                    id: webpageData.id,
                    data: webpageData
                });
                await publishUpdate(componentId, OperationTypes.INIT_VERSION, {
                    id: targetVersion.id,
                    data: targetVersion
                });

                setCurrentVersion(targetVersion);

                const changes = analyzeChanges(
                    originalWebpageData,
                    webpageData,
                    originalPageVersionData,
                    pageVersionData
                );
                if (!changes.hasPageChanges && !changes.hasVersionChanges) {
                    const response = await api.get(endpoints.versions.pageVersionDetail(webpageData.id || pageId, targetVersion.id));
                    const newPage = response.data || response;
                    setPageVersionData(processLoadedVersionData(newPage));
                }
            }
        } catch (error) {
            console.error('PageEditor: Error loading versions', error);
            showError('Failed to load page versions');
        }
    }, [webpageData?.id, isNewPage, versionFromUrl, location.pathname, previousView, showError, publishUpdate, componentId]);

    // Load versions but preserve current version selection
    const loadVersionsPreserveCurrent = useCallback(async () => {

        if (!webpageData?.id || isNewPage) {
            return;
        }
        const changes = analyzeChanges(
            originalWebpageData,
            webpageData,
            originalPageVersionData,
            pageVersionData
        );
        if (changes.hasPageChanges || changes.hasVersionChanges) {
            // TODO: Handle unsaved changes
            return;
        }

        try {
            const versionsData = await versionsApi.getPageVersionsList(webpageData.id || pageId);
            setAvailableVersions(versionsData.results || []);


            // Only set current version if not already set
            if (!currentVersion && versionsData.results && versionsData.results.length > 0) {
                // Find the version with the highest version number (last saved)
                const lastSavedVersion = versionsData.results.reduce((latest, current) => {
                    return (current.versionNumber > latest.versionNumber) ? current : latest;
                });
                setCurrentVersion(lastSavedVersion);
                // Load the complete version data including widgets using raw API
                const response = await api.get(endpoints.versions.pageVersionDetail(webpageData.id || pageId, lastSavedVersion.id));
                const newPage = response.data || response;
                setPageVersionData(processLoadedVersionData(newPage));
            } else if (currentVersion) {
                // If we have a current version, reload the page data with that version using raw API
                const response = await api.get(endpoints.versions.pageVersionDetail(webpageData.id || pageId, currentVersion.id));
                const newPage = response.data || response;
                setPageVersionData(processLoadedVersionData(newPage));
            }
        } catch (error) {
            console.error('PageEditor: Error loading versions', error);
            showError('Failed to load page versions');
        }
    }, [webpageData?.id, isNewPage, currentVersion, showError]);

    // Define switchToVersion first since updatePageData depends on it
    const switchToVersion = useCallback(async (versionId) => {
        if (!versionId || !webpageData?.id) return;
        try {
            // Use the raw API endpoint to get the proper data structure
            const response = await api.get(endpoints.versions.pageVersionDetail(webpageData.id || pageId, versionId));
            const versionPageData = response.data || response;
            const versionData = availableVersions.find(version => version.id === versionId);

            // Then switch to the version
            await publishUpdate(componentId, OperationTypes.SWITCH_VERSION, {
                pageId: webpageData.id,
                versionId: versionId
            });

            setCurrentVersion(versionData);

            // Set pageVersionData with processed data (meta fields flattened)
            const processedVersionData = processLoadedVersionData(versionPageData);
            setPageVersionData(processedVersionData);
            setOriginalPageVersionData(processedVersionData);

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
    }, [webpageData, availableVersions, showError, addNotification, location.pathname, buildUrlWithVersion, previousView, publishUpdate, componentId]);

    // Handle page data updates - route to appropriate data structure
    const updatePageData = useCallback(async (updates) => {
        // Handle version changes from LayoutRenderer
        if (updates.versionChanged && updates.pageVersionData) {
            // This is a version switch from LayoutRenderer, use switchToVersion
            const versionId = updates.pageVersionData.id || updates.pageVersionData.versionId;
            await switchToVersion(versionId);
            return; // Don't set dirty for version switches
        }

        // Define fields that belong to WebPage model (sync with PAGE_FIELDS in smartSaveUtils.js)
        const webpageFields = [
            'title', 'slug', 'description', 'parent', 'parentId', 'sortOrder',
            'hostnames', 'enableCssInjection', 'pageCssVariables', 'pageCustomCss'
        ]

        // Separate updates into webpage and version updates
        const webpageUpdates = {}
        const versionUpdates = {}

        Object.entries(updates).forEach(([key, value]) => {
            if (webpageFields.includes(key)) {
                webpageUpdates[key] = value
            } else if (key === 'metaTitle') {
                // Special case: metaTitle should update both webpage title and version metaTitle
                webpageUpdates.title = value
                versionUpdates.metaTitle = value
            } else {
                // Everything else goes to version data (widgets, codeLayout, pageData, etc.)
                versionUpdates[key] = value
            }
        })
        // Apply updates to appropriate state
        if (Object.keys(webpageUpdates).length > 0) {
            setWebpageData(prev => ({ ...prev, ...webpageUpdates }))
            // Publish webpage updates to UDC
            await publishUpdate(componentId, OperationTypes.UPDATE_WEBPAGE_DATA, {
                id: webpageData?.id,
                updates: webpageUpdates
            });
        }
        if (Object.keys(versionUpdates).length > 0) {
            setPageVersionData(prev => ({ ...prev, ...versionUpdates }))
            // Publish version updates to UDC
            await publishUpdate(componentId, OperationTypes.UPDATE_PAGE_VERSION_DATA, {
                id: pageVersionData?.id,
                updates: versionUpdates
            });
        }

        // Mark as dirty in UDC
        setIsDirty(true)
    }, [switchToVersion, publishUpdate, componentId, webpageData?.id, pageVersionData?.id, setIsDirty])

    // NEW: Validation-driven sync handlers
    const handleValidatedPageDataSync = useCallback(async (validatedData) => {
        console.log("handleValidatedPageDataSync", validatedData)
        logValidationSync('pageData', validatedData, 'SchemaDrivenForm')

        // Update local state
        setPageVersionData(prev => ({
            ...prev,
            pageData: {
                ...prev?.pageData,
                ...validatedData
            }
        }))

        // Publish version updates to UDC
        await publishUpdate(componentId, OperationTypes.UPDATE_PAGE_VERSION_DATA, {
            id: pageVersionData?.id,
            updates: {
                pageData: {
                    ...(pageVersionData?.pageData || {}),
                    ...validatedData
                }
            }
        });

        setIsDirty(true) // Mark as dirty since we have new validated data
    }, [publishUpdate, componentId, pageVersionData?.id, pageVersionData?.pageData])


    // Load versions when page data is available
    useEffect(() => {
        loadVersions();
    }, [loadVersions]);


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
    }, [addNotification, showError, webpageData, pageVersionData, originalWebpageData, originalPageVersionData, queryClient, currentVersion]); // Removed loadVersionsPreserveCurrent to break circular dependency

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

        // Check for critical schema validation errors (allow warnings/non-critical errors)
        const hasCriticalErrors = schemaValidationState.fieldResults &&
            Object.values(schemaValidationState.fieldResults).some(result =>
                result && result.severity === 'error' && result.errors && result.errors.length > 0
            );
        if (hasCriticalErrors) {
            addNotification({
                type: 'error',
                message: 'Cannot save: please fix critical validation errors in the page data'
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

            // Publish changes to UDC before saving
            if (changes.hasPageChanges) {
                await publishUpdate(componentId, OperationTypes.UPDATE_WEBPAGE_DATA, {
                    id: webpageData?.id,
                    updates: changes.pageChanges
                });
            }

            if (changes.hasVersionChanges) {
                await publishUpdate(componentId, OperationTypes.UPDATE_PAGE_VERSION_DATA, {
                    id: pageVersionData?.id,
                    updates: changes.versionChanges
                });
            }

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
                setIsDirty(false); // Reset dirty state since no changes
            } else {
                // Version changes detected - save as new version directly
                await handleActualSave({ description: 'Version changes detected', option: 'new' });
            }

        } catch (error) {
            console.error('❌ Save analysis failed:', error);
            addNotification({
                type: 'error',
                message: `Save analysis failed: ${error.message}`
            });
        }
    }, [errorTodoItems, schemaValidationState, addNotification, webpageData, pageVersionData, originalWebpageData, originalPageVersionData, contentEditorRef, settingsEditorRef, handleActualSave, publishUpdate, componentId, setIsDirty]);

    // Handle save options from modal
    const handleSaveOptions = useCallback(async (saveOptions) => {
        try {
            await handleActualSave(saveOptions);
        } catch (error) {
            // Error handling is already done in handleActualSave
            throw error;
        }
    }, [handleActualSave]);

    // Simple save handlers - no modal confirmation
    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            await handleActualSave({ description: 'Page updated', option: 'update' });
        } catch (error) {
            console.error('Save failed:', error);
        } finally {
            setIsSaving(false);
        }
    }, [handleActualSave]);

    const handleSaveNew = useCallback(async () => {
        setIsSaving(true);
        try {
            await handleActualSave({ description: 'New version created', option: 'new' });
        } catch (error) {
            console.error('Save New failed:', error);
        } finally {
            setIsSaving(false);
        }
    }, [handleActualSave]);


    // Widget editor handlers
    const handleOpenWidgetEditor = useCallback((widgetData) => {
        const currentEditingWidget = editingWidgetRef.current
        if (currentEditingWidget && widgetData && currentEditingWidget.id === widgetData.id) {
            setWidgetEditorOpen(false)
            setEditingWidget(null)
        } else {
            setEditingWidget(widgetData)
            setWidgetEditorOpen(true)
        }
    }, [])

    const handleCloseWidgetEditor = useCallback(() => {
        setWidgetEditorOpen(false)
        setEditingWidget(null)
    }, [])

    const handleRealTimeWidgetUpdate = useCallback((updatedWidget) => {
        if (contentEditorRef.current && contentEditorRef.current.layoutRenderer) {
            // Update the widget through the LayoutRenderer using UPDATE action
            const renderer = contentEditorRef.current.layoutRenderer

            // Use UPDATE action for real-time preview updates
            renderer.executeWidgetDataCallback(WIDGET_ACTIONS.UPDATE, updatedWidget.slotName, updatedWidget)
            renderer.updateSlot(updatedWidget.slotName, renderer.getSlotWidgetData(updatedWidget.slotName))
        }
    }, [])

    const handleSaveWidget = useCallback(async (updatedWidget) => {
        // With validation-driven sync, widget data is already in canonical state
        // Just need to update the visual representation and show success

        if (contentEditorRef.current && contentEditorRef.current.layoutRenderer) {
            // Update the visual representation via LayoutRenderer
            const renderer = contentEditorRef.current.layoutRenderer
            renderer.executeWidgetDataCallback(WIDGET_ACTIONS.EDIT, updatedWidget.slotName, updatedWidget)
            renderer.updateSlot(updatedWidget.slotName, renderer.getSlotWidgetData(updatedWidget.slotName))
        }

        addNotification({
            type: 'success',
            message: `Widget "${updatedWidget.name}" saved successfully`
        })

        // Reset dirty state and close editor
        setIsDirty(false)
        handleCloseWidgetEditor()
    }, [addNotification, handleCloseWidgetEditor])

    // Memoized callback to prevent ContentEditor re-renders
    const handleDirtyChange = useCallback((isDirty, reason) => {
        setIsDirty(isDirty);
    }, [setIsDirty])

    // Subscribe to widget events using direct subscription
    // Widget events now handled through UnifiedDataContext

    useEffect(() => {
        // Handler for widget changes
        const handleWidgetChanged = (payload) => {
            if (payload.changeType === WIDGET_CHANGE_TYPES.CONFIG) {
                // CRITICAL FIX: Config changes must update persistent data, not just mark as dirty
                // This fixes the split-brain issue where config changes were only preview-only

                // Update the persistent widget data in pageVersionData
                setPageVersionData(prev => {
                    const widgets = prev?.widgets || {}
                    const slotWidgets = widgets[payload.slotName] || []

                    const updatedSlotWidgets = slotWidgets.map(widget =>
                        widget.id === payload.widgetId ? payload.widget : widget
                    )
                    console.log("handleWidgetChanged", payload)
                    // await publishUpdate(componentId, OperationTypes.UPDATE_PAGE_VERSION_DATA, {
                    //     id: pageVersionData?.id,
                    //     updates: {
                    //         pageData: {
                    //             ...(pageVersionData?.pageData || {}),
                    //             ...validatedData
                    //         }
                    //     }
                    // });                    
                    return {
                        ...prev,
                        widgets: {
                            ...widgets,
                            [payload.slotName]: updatedSlotWidgets
                        }
                    }
                })

                // Also update the visual representation for real-time preview
                if (contentEditorRef.current && contentEditorRef.current.layoutRenderer) {
                    const renderer = contentEditorRef.current.layoutRenderer
                    renderer.executeWidgetDataCallback(WIDGET_ACTIONS.UPDATE, payload.slotName, payload.widget)
                    renderer.updateSlot(payload.slotName, renderer.getSlotWidgetData(payload.slotName))
                }

                // Mark page as dirty so user knows there are unsaved changes
                setIsDirty(true)
                return
            }

            // For structural changes (position, add, remove), trigger full re-render
            if (contentEditorRef.current && contentEditorRef.current.layoutRenderer) {
                const renderer = contentEditorRef.current.layoutRenderer
                renderer.executeWidgetDataCallback(WIDGET_ACTIONS.UPDATE, payload.slotName, payload.widget)
                renderer.updateSlot(payload.slotName, renderer.getSlotWidgetData(payload.slotName))
            }
        }

        // Handler for error events
        const handleWidgetError = (payload) => {
            addNotification({
                type: 'error',
                message: `Widget error: ${payload.error}`
            })
        }

        // Widget events now handled through UnifiedDataContext - no subscriptions needed

        // No cleanup needed since we're not subscribing to widget events anymore
        return () => {
            // Widget events now handled through UnifiedDataContext
        }
    }, [addNotification])

    // Tab navigation (main tabs)
    const tabs = [
        { id: 'content', label: 'Content', icon: Layout },
        { id: 'data', label: 'Data', icon: FileText },
        { id: 'settings', label: 'Settings & SEO', icon: Settings },
        { id: 'theme', label: 'Theme', icon: Palette },
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

    // Handle widget editor panel when navigating between tabs
    useEffect(() => {
        if (widgetEditorOpen && activeTab !== 'content') {
            // Check widget validation state
            const widgetState = widgetEditorRef.current
            const isValidating = widgetState?.isValidating || false
            const isValid = widgetState?.isValid !== false

            // Block navigation if validating
            if (isValidating) {
                addNotification({
                    type: 'warning',
                    message: 'Please wait for validation to complete before navigating'
                })
                return
            }

            // Check for unsaved changes before closing
            if (isDirty) {
                // Show confirmation modal for unsaved changes
                const handleUnsavedChanges = async () => {
                    const confirmed = await showConfirm({
                        title: 'Unsaved Changes',
                        message: 'You have unsaved changes. What would you like to do?',
                        confirmText: 'Save Changes',
                        cancelText: 'Discard Changes',
                        confirmButtonStyle: 'primary'
                    })

                    if (confirmed) {
                        // Check if widget is valid before saving
                        if (!isValid) {
                            addNotification({
                                type: 'error',
                                message: 'Cannot save: Please fix validation errors first'
                            })
                            return
                        }

                        // Save the widget changes using the panel's save method
                        if (widgetEditorRef.current) {
                            const savedWidget = widgetEditorRef.current.saveCurrentWidget()
                            if (savedWidget) {
                                await handleSaveWidget(savedWidget)
                            }
                        }
                    } else {
                        // Discard changes and close panel
                        handleCloseWidgetEditor()
                    }
                }

                handleUnsavedChanges()
            } else {
                // No unsaved changes, just close the panel
                handleCloseWidgetEditor()
            }
        }
    }, [activeTab, widgetEditorOpen, isDirty, editingWidget, handleCloseWidgetEditor, handleSaveWidget, showConfirm, addNotification])

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

            {/* Main Content Area with right error To-Do sidebar and widget editor panel */}
            <div className="flex-1 overflow-hidden">
                <div className="h-full flex relative">
                    <div className={`flex-1 min-w-0 overflow-y-auto transition-all duration-300 ${widgetEditorOpen ? 'mr-0' : ''}`}>
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
                                    <div className="h-full flex flex-col">
                                        {/* Layout fallback warning */}
                                        {!(pageVersionData?.codeLayout) && (
                                            <div className="flex-shrink-0 bg-amber-50 border-l-4 border-amber-400 p-4 mb-2">
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
                                            <div className="flex-1 flex items-center justify-center bg-gray-50">
                                                <div className="text-center">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                                    <p className="text-gray-600">Loading layout data...</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1 h-full">
                                                <PageContentEditor
                                                    key={`page-editor-${webpageData?.id}-${pageVersionData?.versionId || 'current'}`}
                                                    ref={contentEditorRef}
                                                    webpageData={webpageData}
                                                    pageVersionData={pageVersionData}
                                                    onUpdate={updatePageData}
                                                    isNewPage={isNewPage}
                                                    layoutJson={layoutData}
                                                    editable={true}
                                                    onDirtyChange={handleDirtyChange}
                                                    onOpenWidgetEditor={handleOpenWidgetEditor}
                                                    // PageEditor-specific props
                                                    currentVersion={currentVersion}
                                                    availableVersions={availableVersions}
                                                    onVersionChange={switchToVersion}
                                                    // Editor context
                                                    context={{
                                                        pageId: webpageData?.id,
                                                        mode: 'edit'
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
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
                                onValidationChange={setSchemaValidationState}
                                onValidatedDataSync={handleValidatedPageDataSync}
                                namespace={null} // TODO: Add proper namespace integration
                            />
                        )}
                        {activeTab === 'theme' && (
                            <ThemeSelector
                                key={`theme-${pageVersionData?.versionId || 'new'}`}
                                selectedThemeId={pageVersionData?.theme}
                                onThemeChange={(themeId) => updatePageData({ theme: themeId })}
                                onDirtyChange={handleDirtyChange}
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

                    {/* Widget Editor Panel - positioned within content area */}
                    <WidgetEditorPanel
                        ref={widgetEditorRef}
                        isOpen={widgetEditorOpen}
                        onClose={handleCloseWidgetEditor}
                        onSave={handleSaveWidget}
                        onRealTimeUpdate={handleRealTimeWidgetUpdate}
                        widgetData={editingWidget}
                        title={editingWidget ? `Edit ${editingWidget.name}` : 'Edit Widget'}
                        autoOpenSpecialEditor={editingWidget?.type === 'core_widgets.ImageWidget'}
                    />
                </div>
            </div>

            {/* Status bar with notifications */}
            <StatusBar
                isDirty={isDirty}
                currentVersion={currentVersion}
                availableVersions={availableVersions}
                onVersionChange={switchToVersion}
                onSaveClick={handleSave}
                onSaveNewClick={handleSaveNew}
                isSaving={isSaving}
                isNewPage={isNewPage}
                webpageData={webpageData}
                pageVersionData={pageVersionData}
                validationState={schemaValidationState}
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
        </div>
    )
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