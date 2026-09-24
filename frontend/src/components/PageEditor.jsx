/*
 * Copyright (C) 2025 Johan Mats Fred Karlsson
 *
 * This file is part of easy_v4.
 *
 * This program is licensed under the Server Side Public License, version 1,
 * as published by MongoDB, Inc. See the LICENSE file for details.
 */

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
    Save,
    Globe,
    Layers,
    AlertTriangle
} from 'lucide-react'
import { pagesApi, layoutsApi, versionsApi, themesApi, namespacesApi } from '../api'
import { api } from '../api/client'
import { endpoints } from '../api/endpoints'
import {
    smartSave,
    analyzeChanges,
    determineSaveStrategy,
    generateChangeSummary,
    processLoadedVersionData,
    buildVersionedPageData,
    canPublishWorkingCopy,
    mergeVersionedPageAttributes,
    refreshAfterWorkingCopySave,
} from '../utils/smartSaveUtils'
import { applyWidgetUpdateToWidgetMap } from '../utils/pageEditorWidgetState'
import { saveWidgetEditorChanges } from '../utils/pageEditorWidgetSave'
import { WIDGET_CHANGE_TYPES } from '../types/widgetEvents'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import ContextualHelpLink from './help/ContextualHelpLink'
import { useUnifiedData, defaultEqualityFn } from '../contexts/unified-data'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import PageContentEditor from '../editors/page-editor/PageContentEditor'
import { useClipboard } from '../contexts/ClipboardContext'
import { getDefaultLayout } from '../utils/defaultLayout'
import ErrorTodoSidebar from './ErrorTodoSidebar'
import SchemaDrivenForm from './SchemaDrivenForm'
import StatusBar from './StatusBar'
import WidgetEditorPanel from './WidgetEditorPanel'
import ThemeSelector from './ThemeSelector'
import PagePreview from './PagePreview'
import SettingsEditor from './SettingsEditor'
import PublishingEditor from './PublishingEditor'
import AllSlotsEditor from './AllSlotsEditor'
import { getWidgetDisplayName } from '../hooks/useWidgets'
import { useWidgetInheritance } from '../hooks/useWidgetInheritance'
import { usePageInheritance } from '../hooks/usePageInheritance'
import GlobalWysiwygToolbar from './wysiwyg/GlobalWysiwygToolbar'
import GlobalTableToolbar from './table-toolbar/GlobalTableToolbar'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { usePageWebSocket } from '../hooks/usePageWebSocket'

import { logValidationSync } from '../utils/stateVerification'
import { buildPathVariablesContext, getDefaultSimulatedPath } from '../utils/pathParser'
import { detectPageConflicts, applyConflictResolutions } from '../utils/conflictResolution'
import ConflictResolutionModal from './ConflictResolutionModal'

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

function formatWorkflowState(state) {
    const labels = {
        notPublished: 'Not published',
        not_published: 'Not published',
        live: 'Live',
        liveWithUnpublishedChanges: 'Live · unpublished changes',
        live_with_unpublished_changes: 'Live · unpublished changes',
        scheduled: 'Scheduled',
        liveWithScheduledChanges: 'Live · scheduled changes',
        live_with_scheduled_changes: 'Live · scheduled changes',
        publicationEnded: 'Publication ended',
        publication_ended: 'Publication ended',
    }
    return labels[state] || 'Not published'
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
 * - PageContentEditor/ReactLayoutRenderer receive widgets from canonical pageVersionData/localWidgets state
 */
const PageEditor = () => {
    const { pageId, tab } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    // Use global isDirty from UnifiedDataContext
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData()

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

    // Set document title based on page and tab
    const tabNames = {
        'content': 'Content',
        'settings': 'Settings',
        'metadata': 'Metadata',
        'preview': 'Preview',
        'publishing': 'Publishing'
    }
    const pageTitle = isNewPage
        ? 'New Page'
        : (webpageData?.title || 'Loading...')
    const tabName = tabNames[activeTab] || activeTab
    useDocumentTitle(`${pageTitle} - ${tabName}`)

    // Local widget state for fast UI operations
    const [localWidgets, setLocalWidgets] = useState({})
    const [editorResetKey, setEditorResetKey] = useState(0)

    // Path pattern state for dynamic URL path simulation
    const [simulatedPath, setSimulatedPath] = useState('')
    const [pathVariables, setPathVariables] = useState({})

    // Get global clipboard state
    const { clipboardData, pasteModePaused, togglePasteMode, clearClipboardState } = useClipboard()

    // Shared componentId for entire page editing group (includes versionId for proper isolation)
    const versionId = pageVersionData?.versionId || pageVersionData?.id || 'current'
    const componentId = `page-editor-${pageId}-${versionId}`;

    // Get current dirty state from global context
    const [isDirty, setIsDirtyState] = useState(false);
    const isDirtyRef = useRef(false);

    // Local dirty state derived from semantic diff (original vs current data).
    // PageEditor is the single owner of dirty for the page editor UI.
    const setIsDirty = useCallback((value) => {
        if (isDirtyRef.current === value) {
            return;
        }

        isDirtyRef.current = value;
        setIsDirtyState(value);
    }, []);

    // Helper to recompute dirty state based on semantic comparison.
    // This is the single source of truth for the local isDirty value used by
    // the editor UI. We derive it from a semantic diff between the original
    // load snapshot and the current editor state so that load-time
    // normalization, widget hydration, or other UDC operations cannot mark
    // the page dirty without a real user-visible change. The UDC global
    // metadata.isDirty is updated as well so other consumers stay in sync.
    const recomputeDirtyState = useCallback(() => {
        if (!originalWebpageData || !originalPageVersionData) return;

        const changes = analyzeChanges(
            originalWebpageData,
            webpageData,
            originalPageVersionData,
            pageVersionData
        );

        const hasChanges = changes.hasPageChanges || changes.hasVersionChanges;
        setIsDirty(hasChanges);
    }, [originalWebpageData, webpageData, originalPageVersionData, pageVersionData, setIsDirty]);

    useExternalChanges(componentId, (state, metadata) => {
        const sourceId = metadata?.sourceId || '';
        const operationType = metadata?.type;

        const isFormBufferSource =
            sourceId.startsWith('isolated-form-') ||
            sourceId.startsWith('special-editor-') ||
            sourceId.startsWith('field-') ||
            sourceId.includes('-field-');

        const externalPageId = String(webpageData?.id || pageId || state.metadata?.currentPageId || '');
        const externalVersionId = String(versionId || state.metadata?.currentVersionId || '');
        const externalPage = externalPageId ? state.pages?.[externalPageId] : null;
        const externalVersion = externalVersionId ? state.versions?.[externalVersionId] : null;

        const syncExternalPage = () => {
            if (externalPage && !defaultEqualityFn(webpageData || {}, externalPage)) {
                setWebpageData(externalPage);
            }
        };

        const syncExternalVersion = () => {
            if (externalVersion && !defaultEqualityFn(pageVersionData || {}, externalVersion)) {
                setPageVersionData(externalVersion);
            }
        };

        // Field buffers and special editors update canonical UDC state directly.
        // Mirror that canonical snapshot into PageEditor so the semantic dirty
        // check can enable/disable save without forcing every field to rerender.
        if (isFormBufferSource) {
            syncExternalVersion();
            return;
        }

        // Note: do NOT mirror state.metadata.isDirty here. The local
        // isDirty value is derived from a semantic diff via
        // recomputeDirtyState() so that load-time normalization or
        // hydration cannot force the editor into a dirty state.

        const shouldSyncPage = [
            OperationTypes.UPDATE_WEBPAGE_DATA,
            OperationTypes.INIT_PAGE,
        ].includes(operationType);

        if (shouldSyncPage) {
            syncExternalPage();
        }

        const shouldSyncVersion = [
            OperationTypes.ADD_WIDGET,
            OperationTypes.UPDATE_WIDGET_CONFIG,
            OperationTypes.MOVE_WIDGET,
            OperationTypes.REMOVE_WIDGET,
            OperationTypes.INIT_VERSION,
            OperationTypes.SWITCH_VERSION,
            OperationTypes.UPDATE_PAGE_VERSION_DATA,
        ].includes(operationType);

        if (shouldSyncVersion) {
            syncExternalVersion();
        }

        const shouldSyncWidgets = [
            OperationTypes.ADD_WIDGET,
            OperationTypes.UPDATE_WIDGET_CONFIG,
            OperationTypes.MOVE_WIDGET,
            OperationTypes.REMOVE_WIDGET,
            OperationTypes.INIT_VERSION,
            OperationTypes.SWITCH_VERSION,
            OperationTypes.UPDATE_PAGE_VERSION_DATA,
        ].includes(operationType);

        if (!shouldSyncWidgets || !externalVersion?.widgets) {
            return;
        }

        // Update local widgets from external UDC changes (other components/users)
        if (versionId) {
            const externalWidgets = externalVersion.widgets;
            if (defaultEqualityFn(localWidgets || {}, externalWidgets)) {
                return;
            }

            setLocalWidgets(externalWidgets);
        }
    });

    // Initialize local widgets when pageVersionData loads
    useEffect(() => {
        if (pageVersionData?.widgets) {
            setLocalWidgets(pageVersionData.widgets);
        }
    }, [pageVersionData?.widgets]);

    // Initialize simulated path when path pattern changes
    useEffect(() => {
        const pathPatternKey = webpageData?.pathPatternKey;

        if (pathPatternKey && !simulatedPath) {
            // Load default example path for the pattern
            getDefaultSimulatedPath(pathPatternKey).then(defaultPath => {
                if (defaultPath) {
                    setSimulatedPath(defaultPath);
                }
            });
        } else if (!pathPatternKey) {
            // Clear simulated path if no pattern is set
            setSimulatedPath('');
            setPathVariables({});
        }
    }, [webpageData?.pathPatternKey]);

    // Parse path and extract variables whenever simulatedPath or pathPatternKey changes
    useEffect(() => {
        const parsePathVariables = async () => {
            if (webpageData && simulatedPath) {
                const variables = await buildPathVariablesContext(webpageData, simulatedPath);
                setPathVariables(variables);
            } else {
                setPathVariables({});
            }
        };

        parsePathVariables();
    }, [webpageData, simulatedPath]);

    // Fast local widget update function
    const updateLocalWidgets = useCallback((updatedWidgets, options = {}) => {
        // 1. Immediate local state update (fast UI)
        setLocalWidgets(updatedWidgets);

        // 2. Update pageVersionData for persistence layer (including any additional fields like codeLayout)
        setPageVersionData(prev => ({
            ...prev,
            widgets: updatedWidgets,
            ...(options.codeLayout && { codeLayout: options.codeLayout })
        }));

        // 3. Dirty state will be recomputed by the effect
    }, [componentId]);

    // UDC widget operation publisher (for external sync)
    const publishWidgetOperation = useCallback(async (operation, data) => {
        await publishUpdate(componentId, operation, {
            ...data,
            contextType: 'page',
            pageId: pageId,
            versionId: versionId
        });
    }, [publishUpdate, componentId, pageId, versionId]);

    const [layoutData, setLayoutData] = useState(null)
    const [isLoadingLayout, setIsLoadingLayout] = useState(false)
    const [activeLayoutName, setActiveLayoutName] = useState(null)
    const [isUsingFallbackLayout, setIsUsingFallbackLayout] = useState(false)
    const [showEssentialFieldsModal, setShowEssentialFieldsModal] = useState(false)

    // Feature flag for new self-contained widget editor
    const contentEditorRef = useRef(null)
    const settingsEditorRef = useRef(null)
    const pendingCutSourceFinalizersRef = useRef(new Map())

    const queueCutSourceRemoval = useCallback((key, finalize, destinationVersionId) => {
        pendingCutSourceFinalizersRef.current.set(key, { finalize, destinationVersionId })
    }, [])

    const finalizePendingCutSources = useCallback(async (savedDestinationVersionId) => {
        for (const [key, pendingCut] of pendingCutSourceFinalizersRef.current.entries()) {
            if (String(pendingCut.destinationVersionId) !== String(savedDestinationVersionId)) {
                continue
            }

            const { finalize } = pendingCut
            await finalize()
            pendingCutSourceFinalizersRef.current.delete(key)
        }
    }, [])

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

    // Conflict resolution state
    const [conflictData, setConflictData] = useState(null)
    const [showConflictModal, setShowConflictModal] = useState(false)

    // WebSocket for real-time notifications
    const { isStale: isVersionStale, latestUpdate, clearStaleFlag } = usePageWebSocket(
        pageId,
        {
            enabled: !isNewPage && Boolean(pageId),
            onVersionUpdated: async (updateInfo) => {
                try {
                    // Fetch latest server version
                    const serverWebpage = await pagesApi.get(pageId);
                    const serverVersion = await versionsApi.get(updateInfo.versionId);

                    // Detect conflicts using deep diff analysis
                    const conflictResult = detectPageConflicts(
                        originalWebpageData,
                        webpageData,
                        serverWebpage,
                        originalPageVersionData,
                        pageVersionData,
                        serverVersion
                    );

                    // Check if a refresh is required (blocking path changed)
                    if (conflictResult.requiresRefresh) {
                        addNotification(
                            `Page updated by ${updateInfo.updatedBy || 'another user'} - please refresh the page`,
                            'warning'
                        );
                        clearStaleFlag();
                        return;
                    }

                    // Only show diff dialog if there are actual conflicts
                    if (conflictResult.hasConflicts) {
                        setConflictData({
                            analysis: conflictResult,
                            serverWebpage,
                            serverVersion,
                            updateInfo
                        });
                        setShowConflictModal(true);

                        addNotification(
                            `Page updated by ${updateInfo.updatedBy || 'another user'} - conflicts detected`,
                            'info'
                        );
                    } else {
                        // No conflicts - silently accept server changes

                        // Update local state with merged data
                        setWebpageData(conflictResult.mergedWebpage);
                        setPageVersionData(conflictResult.mergedVersion);
                        setOriginalWebpageData(conflictResult.mergedWebpage);
                        setOriginalPageVersionData(conflictResult.mergedVersion);

                        // Update local widgets state for UI
                        if (conflictResult.mergedVersion.widgets) {
                            setLocalWidgets(conflictResult.mergedVersion.widgets);
                        }

                        // Check if merged data matches server - if so, mark as clean
                        const mergedMatchesServer =
                            JSON.stringify(conflictResult.mergedWebpage) === JSON.stringify(serverWebpage) &&
                            JSON.stringify(conflictResult.mergedVersion) === JSON.stringify(serverVersion);

                        if (mergedMatchesServer) {
                            // No local changes, or local changes exactly match what was saved - mark as clean
                            setIsDirty(false);
                        }
                        // Otherwise, keep current dirty state (user has unsaved local changes)

                        // Publish update through UDC to notify active editor components
                        if (versionId && conflictResult.mergedVersion.widgets) {
                            const udcComponentId = `page-editor-${pageId}-websocket-merge`;
                            publishUpdate(udcComponentId, OperationTypes.UPDATE_PAGE_VERSION_DATA, {
                                id: versionId,
                                updates: {
                                    widgets: conflictResult.mergedVersion.widgets
                                },
                                source: 'websocket_auto_merge',
                                skipDirty: true, // Don't mark as dirty since this is a server update
                                setClean: mergedMatchesServer // Explicitly set clean if merged matches server
                            });
                        }

                        addNotification(
                            `Page updated by ${updateInfo.updatedBy || 'another user'}`,
                            'success'
                        );
                    }

                    // Clear stale flag
                    clearStaleFlag();
                } catch (error) {
                    console.error('Failed to fetch server version for diff:', error);
                    // Fallback to simple notification
                    addNotification(
                        `Page updated by ${updateInfo.updatedBy || 'another user'}`,
                        'info'
                    );
                }
            }
        }
    )

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

    // Namespace for media operations
    const [namespace, setNamespace] = useState(null)

    const queryClient = useQueryClient()
    const { showError, showConfirm, showSaveConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()

    // Load default namespace for media operations
    useEffect(() => {
        const loadNamespace = async () => {
            try {
                const defaultNamespace = await namespacesApi.getDefault()
                setNamespace(defaultNamespace?.slug || 'default')
            } catch (error) {
                console.error('Failed to load namespace:', error)
                setNamespace('default') // Fallback to 'default' if loading fails
            }
        }
        loadNamespace()
    }, [])

    // Initialize data for new page - show modal for essential fields
    useEffect(() => {
        if (isNewPage && !webpageData && !pageVersionData) {
            // Show modal to collect essential fields for new page
            setShowEssentialFieldsModal(true);
        }
    }, [isNewPage, webpageData, pageVersionData])

    // Create page on backend after essential fields are provided
    const createNewPageMutation = useMutation({
        mutationFn: async (essentialFields) => {
            // Get parent info from location state if available
            const parentId = location.state?.parentId || location.state?.parentPage?.id || null;

            // Create the page on backend
            const pageData = {
                title: essentialFields.title,
                slug: essentialFields.slug,
                description: essentialFields.description,
                parentId: parentId,
            };

            const newPage = await pagesApi.create(pageData);

            // Initialize the canonical working copy through the workflow API.
            const versionData = {
                pageData: buildVersionedPageData({}, newPage),
                widgets: {},
                codeLayout: essentialFields.codeLayout || '',
                theme: null,
                versionTitle: 'Initial version',
            };

            let initialVersionError = null;
            try {
                const workingCopy = await versionsApi.getOrCreateWorkingCopy(newPage.id);
                await versionsApi.saveWorkingCopy(
                    workingCopy.version.id,
                    versionData,
                    workingCopy.version.updatedAt,
                );
            } catch (versionError) {
                console.error('Failed to create version:', versionError);
                initialVersionError = versionError;
            }

            return { page: newPage, initialVersionError };
        },
        onSuccess: ({ page, initialVersionError }) => {
            if (initialVersionError) {
                addNotification(
                    `Page "${page.title}" was created, but its initial working version could not be saved. Review and save it again.`,
                    'warning',
                    'page-create'
                );
            } else {
                addNotification(`Page "${page.title}" created successfully`, 'success', 'page-create');
            }
            setShowEssentialFieldsModal(false);

            // Navigate to the newly created page editor
            // The page editor will fetch the current version (which will auto-create if needed)
            navigate(`/pages/${page.id}/edit/content`, {
                state: { previousView }
            });
        },
        onError: (error) => {
            console.error('Failed to create page:', error);
            showError(error, 'Failed to create page');
            addNotification('Failed to create page', 'error', 'page-create');
        }
    });

    // Handle essential fields modal submission
    const handleCreateNewPage = useCallback((essentialFields) => {
        createNewPageMutation.mutate(essentialFields);
    }, [createNewPageMutation])

    // Fetch webpage data (WebPage model data)
    const { data: webpage, isLoading: isLoadingWebpage } = useQuery({
        queryKey: ['webpage', pageId],
        queryFn: async () => {
            const result = await pagesApi.get(pageId)
            return result
        },
        enabled: !isNewPage,
        staleTime: 30000, // Consider data fresh for 30 seconds
        refetchOnMount: false, // Don't refetch on mount if data exists
        refetchOnWindowFocus: false // Don't refetch on window focus
    })

    const {
        data: workflow,
        isLoading: isLoadingWorkflow,
        refetch: refetchWorkflow,
    } = useQuery({
        queryKey: ['pageWorkflow', pageId],
        queryFn: () => versionsApi.getWorkflow(pageId),
        enabled: !isNewPage,
        staleTime: 10000,
        refetchOnWindowFocus: false,
    })

    // Load the canonical working version. A live-only page remains live-only
    // until the first save, when getOrCreateWorkingCopy is called.
    const { data: pageVersion, isLoading: isLoadingPageVersion } = useQuery({
        queryKey: [
            'pageVersion',
            pageId,
            workflow?.editableVersion?.id || workflow?.liveVersion?.id || null,
        ],
        queryFn: async () => {
            const target = workflow?.editableVersion || workflow?.liveVersion || workflow?.scheduledVersion
            if (target?.id) {
                return versionsApi.get(target.id)
            }
            const result = await versionsApi.getOrCreateWorkingCopy(pageId)
            return result.version
        },
        enabled: !isNewPage && Boolean(workflow),
        staleTime: 10000,
        refetchOnWindowFocus: false,
    })

    useEffect(() => {
        if (!workflow?.scheduledAt) return undefined
        const activationTime = new Date(workflow.scheduledAt).getTime()
        if (!Number.isFinite(activationTime)) return undefined
        // The activation worker runs once per minute, so refresh just after its
        // worst-case processing window. Keep checking once per minute only while
        // the workflow still reports the same schedule, in case the worker is late.
        const refreshAt = activationTime + 65_000
        const maxTimeout = 2_147_483_647
        let interval
        let timer
        const scheduleRefresh = () => {
            const remaining = refreshAt - Date.now()
            if (remaining > maxTimeout) {
                timer = window.setTimeout(scheduleRefresh, maxTimeout)
                return
            }
            timer = window.setTimeout(() => {
                refetchWorkflow()
                interval = window.setInterval(() => refetchWorkflow(), 60_000)
            }, Math.max(remaining, 1_000))
        }
        scheduleRefresh()
        return () => {
            window.clearTimeout(timer)
            if (interval) window.clearInterval(interval)
        }
    }, [workflow?.scheduledAt, refetchWorkflow])

    // Get unified inheritance data for this page (widgets, layout, theme)
    const pageInheritance = usePageInheritance(pageId, {
        enabled: !isNewPage && Boolean(pageId),
        includeWidgets: true
    })

    // Extract widget inheritance (for backward compatibility)
    const {
        inherited: inheritedWidgets,
        rules: slotInheritanceRules,
        hasContent: hasInheritedContent,
        parentId
    } = pageInheritance.widgets

    const isLoadingInheritance = pageInheritance.isLoading
    const refetchInheritance = pageInheritance.refetch

    // Combined loading state
    const isLoading = isLoadingWebpage || isLoadingWorkflow || isLoadingPageVersion

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

    // Process webpage and version data
    // Check DataManager first (for hot-reload preservation), then fall back to React Query
    useEffect(() => {
        if (isNewPage) return;

        // Get DataManager state to check for existing data (from websocket updates or previous load)
        const udcState = getState();
        const versionId = pageVersion?.versionId || pageVersion?.id;
        const existingPage = udcState.pages?.[pageId];
        const existingVersion = versionId ? udcState.versions?.[versionId] : null;

        // Priority 1: Use DataManager data if available (preserves websocket updates during hot-reload)
        if (existingPage && existingVersion) {
            const mergedPage = mergeVersionedPageAttributes(existingPage, existingVersion);
            setWebpageData(mergedPage);
            setPageVersionData(existingVersion);
            setOriginalWebpageData(mergedPage);
            setOriginalPageVersionData(existingVersion);

            // Update local widgets
            if (existingVersion.widgets) {
                setLocalWidgets(existingVersion.widgets);
            }

            return;
        }

        // Priority 2: Initialize from React Query data (first load)
        if (webpage && pageVersion) {
            const processedVersionData = processLoadedVersionData({ ...pageVersion });
            const mergedPage = mergeVersionedPageAttributes(webpage, processedVersionData);

            setWebpageData(mergedPage);
            setPageVersionData(processedVersionData);
            setOriginalWebpageData(mergedPage);
            setOriginalPageVersionData(processedVersionData);

            // Publish to UDC for future hot-reloads
            const initDataAsync = async () => {
                try {
                    // First ensure page exists in UDC
                    const webpageComponentId = `page-editor-${webpage.id}-webpage`;
                    await publishUpdate(webpageComponentId, OperationTypes.INIT_PAGE, {
                        id: webpage.id,
                        data: mergedPage
                    });

                    // Then initialize version
                    const versionComponentId = `page-editor-${pageId}-${versionId || 'current'}`;
                    const versionDataForUDC = {
                        ...processedVersionData,
                        pageId: String(pageId),
                        versionNumber: processedVersionData.versionNumber || 1
                    };

                    await publishUpdate(versionComponentId, OperationTypes.INIT_VERSION, {
                        id: processedVersionData.id,
                        data: versionDataForUDC
                    });
                } catch (error) {
                    console.error('[PageEditor] Error initializing data in UDC:', error);
                }
            };

            initDataAsync();
        }
    }, [webpage, pageVersion, isNewPage, pageId, publishUpdate, getState, setLocalWidgets])

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
                // Fetch default layout from backend
                try {
                    layoutToLoad = await getDefaultLayout();
                    isUsingFallback = true;
                } catch (error) {
                    console.error('Failed to fetch default layout:', error);
                    layoutToLoad = 'main_layout'; // Hard fallback
                    isUsingFallback = true;
                }
            }

            // Store the layout name and fallback status
            setActiveLayoutName(layoutToLoad);
            setIsUsingFallbackLayout(isUsingFallback);

            try {
                if (isUsingFallback) {
                    addNotification(`Using default layout: ${layoutToLoad}`, 'info', 'layout-load')
                } else {
                    addNotification(`Loading layout: ${layoutToLoad}`, 'info', 'layout-load')
                }

                const layoutData = await layoutsApi.getJson(layoutToLoad)
                setLayoutData(layoutData)

                if (isUsingFallback) {
                    addNotification(`Default layout "${layoutToLoad}" loaded for preview`, 'success', 'layout-load')
                } else {
                    addNotification(`Layout "${layoutToLoad}" loaded successfully`, 'success', 'layout-load')
                }
            } catch (error) {
                console.error('Failed to load layout:', error)

                // Don't show notification popup - the layout renderer will show a clear "Layout Not Found" view
                // showError(error, 'Failed to load layout data') - also removed to avoid redundant popup
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
        // If widget editor is open, close it first so the page-level dirty
        // state is all that remains to check.
        if (widgetEditorOpen) {
            handleCloseWidgetEditor()
        }

        if (!isDirty) {
            navigate(previousView)
            return
        }

        const decision = await showSaveConfirm({
            title: 'Unsaved Changes',
            message: 'You have unsaved changes to this page. What would you like to do?'
        })

        if (decision === 'save') {
            try {
                await handleActualSave({ description: 'Save before leaving' })
                navigate(previousView)
            } catch {
                // handleActualSave already shows an error notification; stay on page
            }
        } else if (decision === 'discard') {
            navigate(previousView)
        }
        // 'cancel' → do nothing, stay on page
    }

    // Version management functions
    const loadVersions = useCallback(async () => {
        if (!webpageData?.id || isNewPage) {
            return;
        }
        try {
            const versionsData = await versionsApi.getPageVersionsList(webpageData.id || pageId);
            setAvailableVersions(versionsData.results || []);
            const targetId = workflow?.editableVersion?.id || workflow?.liveVersion?.id;
            const targetVersion = (versionsData.results || []).find(
                version => String(version.id) === String(targetId)
            );
            if (targetVersion) {
                setCurrentVersion(targetVersion);
            }
        } catch (error) {
            console.error('PageEditor: Error loading versions', error);
            showError('Failed to load page versions');
        }
    }, [webpageData?.id, isNewPage, showError, pageId, workflow]);

    // Load versions but preserve current version selection
    const loadVersionsPreserveCurrent = useCallback(async ({ workflowOverride, skipDirtyCheck = false } = {}) => {

        if (!webpageData?.id || isNewPage) {
            return;
        }
        if (!skipDirtyCheck) {
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
        }

        try {
            const versionsData = await versionsApi.getPageVersionsList(webpageData.id || pageId);
            setAvailableVersions(versionsData.results || []);


            const currentWorkflow = workflowOverride || workflow;
            const targetId = currentWorkflow?.editableVersion?.id || currentWorkflow?.liveVersion?.id;
            const targetVersion = (versionsData.results || []).find(
                version => String(version.id) === String(targetId)
            );
            if (targetVersion) setCurrentVersion(targetVersion);
        } catch (error) {
            console.error('PageEditor: Error loading versions', error);
            showError('Failed to load page versions');
        }
    }, [
        webpageData,
        isNewPage,
        originalWebpageData,
        originalPageVersionData,
        pageVersionData,
        showError,
        pageId,
        workflow,
    ]);

    // Define switchToVersion first since updatePageData depends on it
    const switchToVersion = useCallback(async (versionId) => {
        if (!versionId || !webpageData?.id) return;
        try {
            // Use the raw API endpoint to get the proper data structure
            const response = await api.get(endpoints.versions.pageVersionDetail(webpageData.id || pageId, versionId));
            const versionPageData = response.data || response;
            const versionData = availableVersions.find(version => version.id === versionId);

            // Process the version data
            const processedVersionData = processLoadedVersionData(versionPageData);
            const mergedPage = mergeVersionedPageAttributes(webpageData, processedVersionData);

            // First, ensure the page exists in DataManager state
            if (webpageData) {
                const webpageComponentId = `page-editor-${webpageData.id}-webpage`;
                await publishUpdate(webpageComponentId, OperationTypes.INIT_PAGE, {
                    id: webpageData.id,
                    data: mergedPage
                });
            }

            // Then initialize the version in DataManager state (required before SWITCH_VERSION)
            const versionComponentId = `page-editor-${pageId}-${versionId}`;
            await publishUpdate(versionComponentId, OperationTypes.INIT_VERSION, {
                id: versionId,
                data: {
                    ...processedVersionData,
                    // Ensure required fields for INIT_VERSION
                    pageId: processedVersionData.pageId || webpageData.id,
                    versionNumber: processedVersionData.versionNumber || versionData?.versionNumber,
                    id: versionId
                }
            });

            // Then switch to the version
            await publishUpdate(versionComponentId, OperationTypes.SWITCH_VERSION, {
                pageId: webpageData.id,
                versionId: versionId
            });

            setCurrentVersion(versionData);
            setWebpageData(mergedPage);
            setOriginalWebpageData(mergedPage);
            setPageVersionData(processedVersionData);
            setOriginalPageVersionData(processedVersionData);

            // Update URL to include version parameter
            const currentPath = location.pathname;
            const newUrl = buildUrlWithVersion(currentPath, versionId);
            navigate(newUrl, { replace: true, state: { previousView } });

            // Handle layout fallback for versions without valid layouts
            if (!versionPageData.codeLayout) {
                addNotification(
                    `Version ${versionData?.versionNumber || versionId} has no layout. Using fallback layout for preview.`,
                    'warning'
                );
            }

            addNotification(
                `Switched to version ${versionData?.versionNumber || versionId}`,
                'info'
            );
        } catch (error) {
            console.error('PageEditor: Error switching to version', error);
            showError(`Failed to load version: ${error.message}`);
        }
    }, [webpageData, availableVersions, showError, addNotification, location.pathname, buildUrlWithVersion, previousView, publishUpdate, pageId]);

    // Handle page data updates - route to appropriate data structure
    const updatePageData = useCallback(async (updates) => {
        // Handle version changes from active React editor controls
        if (updates.versionChanged && updates.pageVersionData) {
            // This is a version switch from editor controls, use switchToVersion
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
    }, [switchToVersion, publishUpdate, componentId, webpageData?.id, pageVersionData?.id])

    // NEW: Validation-driven sync handlers
    const handleValidatedPageDataSync = useCallback(async (validatedData) => {
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

        // setIsDirty(true) // Mark as dirty since we have new validated data
    }, [publishUpdate, componentId, pageVersionData?.id, pageVersionData?.pageData])


    // Load versions when page data is available (only once per page)
    const loadVersionsRef = useRef(false);
    useEffect(() => {
        // Only load versions once per page load
        if (!loadVersionsRef.current && webpageData?.id) {
            loadVersionsRef.current = true;
            loadVersions();
        }
    }, [loadVersions, webpageData?.id]);

    // Reset the ref when page changes
    useEffect(() => {
        loadVersionsRef.current = false;
    }, [pageId]);


    // SMART SAVE: Intelligent save logic that only saves what changed
    const handleActualSave = useCallback(async (saveOptions = {}) => {
        try {
            // Collect all data from editors (no saving yet)
            const collectedData = {};

            const versionDataOverrides = saveOptions.versionDataOverrides || {};

            // Collect current widget data from pageVersionData (always current after fix)
            collectedData.widgets = versionDataOverrides.widgets || pageVersionData?.widgets || {};

            if (contentEditorRef.current && contentEditorRef.current.saveWidgets) {
                try {
                    // Call saveWidgets only to publish SAVED_TO_SERVER to UDC downstream listeners.
                    // Widget data is already current in pageVersionData.widgets — we do not use the return value.
                    await contentEditorRef.current.saveWidgets({
                        source: 'smart_save_from_statusbar',
                        description: 'Smart save triggered from status bar'
                    });
                } catch (error) {
                    console.error('❌ SMART SAVE: saveWidgets notification failed', error);
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
                ...(saveOptions.resolvedData?.webpage || webpageData),
                ...collectedData.settings,
                ...collectedData.metadata
            };

            const currentVersionDataForSave = {
                ...(saveOptions.resolvedData?.version || pageVersionData),
                ...versionDataOverrides,
                widgets: versionDataOverrides.widgets || saveOptions.resolvedData?.version?.widgets || collectedData.widgets
            };
            const clientUpdatedAt = saveOptions.resolvedData?.version?.updatedAt || originalPageVersionData?.updatedAt;

            // Use smart save with separated data (include timestamp for conflict detection)
            const saveResult = await smartSave(
                originalWebpageData || {},      // Original webpage data
                currentWebpageDataForSave,      // Current webpage data
                originalPageVersionData || {},  // Original version data
                currentVersionDataForSave,      // Current version data
                { pagesApi, versionsApi },      // API functions
                {
                    description: saveOptions.description || 'Auto-save',
                    clientUpdatedAt,
                    pageId,
                }
            );

            // Check for conflict
            if (saveResult.conflict) {
                console.log('🔀 Conflict detected, attempting auto-merge...');

                // Fetch latest server version
                const serverVersion = saveResult.conflict.serverVersion || saveResult.conflict.server_version;

                // Detect conflicts and try auto-merge
                const conflictAnalysis = detectPageConflicts(
                    originalWebpageData || {},
                    currentWebpageDataForSave,
                    serverVersion,
                    originalPageVersionData || {},
                    currentVersionDataForSave,
                    serverVersion
                );

                if (conflictAnalysis.canAutoMerge) {
                    // Auto-merge successful - retry save with merged data
                    console.log('✅ Auto-merge successful, retrying save...');
                    addNotification(
                        'Changes auto-merged successfully',
                        'success'
                    );

                    // Retry save with merged data (mark as resolved to skip timestamp check)
                    return await handleActualSave({
                        ...saveOptions,
                        resolvedData: {
                            webpage: conflictAnalysis.mergedWebpage,
                            version: conflictAnalysis.mergedVersion
                        }
                    });
                } else {
                    // Conflicts exist - show modal for user resolution
                    console.log('⚠️ Conflicts require manual resolution');
                    setConflictData({
                        analysis: conflictAnalysis,
                        originalWebpage: currentWebpageDataForSave,
                        originalVersion: currentVersionDataForSave,
                        saveOptions
                    });
                    setShowConflictModal(true);
                    return { saved: false, reason: 'conflict', saveResult }; // Don't proceed with save
                }
            }

            // Cross-page/version cut operations are finalized only after the
            // destination version has been saved. If cleanup fails, keep the
            // durable destination copy and retry on the next save rather than
            // risking data loss by deleting the source first.
            if (pendingCutSourceFinalizersRef.current.size > 0) {
                try {
                    await finalizePendingCutSources(
                        currentVersionDataForSave.versionId || currentVersionDataForSave.id
                    );
                } catch (error) {
                    console.error('Destination saved, but cut source cleanup failed', error);
                    addNotification(
                        `Page saved, but the cut source was not removed: ${error?.message || 'The source version could not be updated.'}`,
                        'warning'
                    );
                }
            }

            // Handle resolved data from conflict resolution
            let updatedWebpageData = saveOptions.resolvedData?.webpage || currentWebpageDataForSave;
            let updatedVersionData = saveOptions.resolvedData?.version || currentVersionDataForSave;

            if (saveResult.pageResult) {
                // Page was updated - merge the response into webpage data
                updatedWebpageData = { ...updatedWebpageData, ...saveResult.pageResult };
            }

            if (saveResult.versionResult) {
                // The canonical working version was saved - use the returned data.
                updatedVersionData = {
                    ...updatedVersionData,
                    ...saveResult.versionResult,
                    widgets: currentVersionDataForSave.widgets // Preserve collected widgets
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

            // Show success notification with smart summary
            const actionDescription = saveResult.strategy === 'page-only' ? 'Page updated' :
                saveResult.strategy === 'version-only' ? 'Working version saved' :
                    saveResult.strategy === 'both' ? 'Page and version updated' :
                        'No changes';

            addNotification(
                `${actionDescription}! ${saveResult.summary}${saveOptions.description ? ` - "${saveOptions.description}"` : ''}`,
                'success'
            );

            await refreshAfterWorkingCopySave(
                saveResult,
                refetchWorkflow,
                loadVersionsPreserveCurrent,
            );

            // Invalidate queries to refresh data
            queryClient.invalidateQueries(['page', webpageData?.id || pageId]);
            queryClient.invalidateQueries(['pages', 'root']);

            return { saved: true, saveResult };

        } catch (error) {
            console.error('❌ SMART SAVE: Save failed', error);
            addNotification(
                `Save failed: ${error.message}`,
                'error'
            );
            showError(`Save failed: ${error.message}`);

            // Parse backend validation error and populate To-Do list
            const backendError = error?.response?.data?.error || error?.response?.data?.detail || error?.message
            if (backendError) {
                const items = deriveTodoItemsFromError(backendError)
                if (items && items.length > 0) {
                    setErrorTodoItems(prev => mergeTodoItems(prev, items))
                }
            }
            throw error;
        }
    }, [addNotification, showError, webpageData, pageVersionData, originalWebpageData, originalPageVersionData, pageId, queryClient, currentVersion, finalizePendingCutSources, refetchWorkflow, loadVersionsPreserveCurrent]);


    // Smart save - analyze changes first, then show modal only if needed
    const handleSaveFromStatusBar = useCallback(async () => {
        const unresolved = errorTodoItems.filter(i => !i.checked).length
        if (unresolved > 0) {
            addNotification(
                `Cannot save: resolve ${unresolved} issue${unresolved === 1 ? '' : 's'} in the To-Do sidebar`,
                'error'
            )
            return
        }

        // Check for critical schema validation errors (allow warnings/non-critical errors)
        const hasCriticalErrors = schemaValidationState.fieldResults &&
            Object.values(schemaValidationState.fieldResults).some(result =>
                result && result.severity === 'error' && result.errors && result.errors.length > 0
            );
        if (hasCriticalErrors) {
            addNotification(
                'Cannot save: please fix critical validation errors in the page data',
                'error'
            )
            return
        }

        try {
            // Collect all data from editors first (without saving)
            const collectedData = {};

            // Collect current widget data
            collectedData.widgets = pageVersionData?.widgets || {};
            if (contentEditorRef.current && contentEditorRef.current.saveWidgets) {
                try {
                    // Call saveWidgets only to publish SAVED_TO_SERVER.
                    // Widget data is already current in pageVersionData.widgets.
                    await contentEditorRef.current.saveWidgets({
                        source: 'smart_save_analysis',
                        description: 'Analyzing changes for save decision'
                    });
                } catch (error) {
                    console.error('❌ Widget saveWidgets notification failed during analysis', error);
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
                addNotification(
                    'No changes detected',
                    'info'
                );
                setIsDirty(false); // Reset dirty state since no changes
            } else {
                await handleActualSave({ description: 'Version changes detected' });
            }

        } catch (error) {
            console.error('❌ Save analysis failed:', error);
            addNotification(
                `Save analysis failed: ${error.message}`,
                'error'
            );
        }
    }, [errorTodoItems, schemaValidationState, addNotification, webpageData, pageVersionData, originalWebpageData, originalPageVersionData, contentEditorRef, settingsEditorRef, handleActualSave, publishUpdate, componentId, setIsDirty]);

    // Simple save handlers - no modal confirmation
    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            const clientUpdatedAt = originalPageVersionData?.updatedAt || pageVersionData?.updatedAt;

            const versionPayload = {
                pageData: buildVersionedPageData(pageVersionData?.pageData || {}, webpageData || {}),
                widgets: localWidgets || pageVersionData?.widgets || {},
                codeLayout: pageVersionData?.codeLayout || '',
                theme: pageVersionData?.theme?.id || pageVersionData?.theme || null,
                metaTitle: pageVersionData?.metaTitle || '',
                metaDescription: pageVersionData?.metaDescription || '',
                pageCssVariables: pageVersionData?.pageCssVariables || {},
                pageCustomCss: pageVersionData?.pageCustomCss || '',
                enableCssInjection: pageVersionData?.enableCssInjection !== false,
                tags: pageVersionData?.tags || [],
            };
            const saved = await versionsApi.savePageWorkingCopy(
                pageId,
                pageVersionData.id,
                versionPayload,
                clientUpdatedAt,
            );
            const processed = processLoadedVersionData(saved);
            setPageVersionData(processed);
            setOriginalPageVersionData(processed);
            setCurrentVersion(saved);
            await publishUpdate(`page-editor-${pageId}-${saved.id}`, OperationTypes.INIT_VERSION, {
                id: saved.id,
                data: processed,
            });

            setOriginalWebpageData(webpageData);

            await refreshAfterWorkingCopySave(
                { versionResult: saved },
                refetchWorkflow,
                loadVersionsPreserveCurrent,
            );
            setIsDirty(false);
            addNotification(
                'Working version saved',
                'success'
            );
            return saved;
        } catch (error) {
            console.error('Save failed:', error);
            const isConflict = error?.originalError?.response?.status === 409;
            addNotification(
                isConflict
                    ? 'Someone else changed this working version. Reload it before saving again.'
                    : `Save failed: ${error?.message || 'Unknown error'}`,
                'error'
            );
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [pageVersionData, originalPageVersionData, pageId, localWidgets, publishUpdate, webpageData, refetchWorkflow, loadVersionsPreserveCurrent, setIsDirty, addNotification]);

    const handleVersionRestored = useCallback(async (restoredVersion) => {
        const processed = processLoadedVersionData(restoredVersion);
        const restoredPage = mergeVersionedPageAttributes(webpage || webpageData || {}, processed);
        const versionDataForUDC = {
            ...processed,
            pageId: String(pageId),
            versionNumber: processed.versionNumber || 1,
        };

        setWebpageData(restoredPage);
        setOriginalWebpageData(restoredPage);
        setPageVersionData(processed);
        setOriginalPageVersionData(processed);
        setCurrentVersion(restoredVersion);
        setLocalWidgets(processed.widgets || {});

        await publishUpdate(`page-editor-${pageId}-webpage`, OperationTypes.INIT_PAGE, {
            id: pageId,
            data: restoredPage,
        });
        await publishUpdate(`page-editor-${pageId}-${restoredVersion.id}`, OperationTypes.INIT_VERSION, {
            id: restoredVersion.id,
            data: versionDataForUDC,
        });

        queryClient.setQueryData(
            ['pageVersion', pageId, restoredVersion.id],
            restoredVersion,
        );
        setIsDirty(false);
        await loadVersionsPreserveCurrent();
        addNotification('Historical version restored as the working version', 'success');
    }, [webpage, webpageData, pageId, publishUpdate, queryClient, setIsDirty, loadVersionsPreserveCurrent, addNotification]);

    const handlePublishWorkingCopy = useCallback(async () => {
        try {
            let targetVersion = workflow?.editableVersion;
            if (isDirty || !targetVersion?.id) {
                targetVersion = await handleSave();
            }
            if (!targetVersion?.id) return;
            const confirmed = await showConfirm({
                title: 'Publish changes',
                message: 'Publish the saved working version now?',
                confirmText: 'Publish changes',
                confirmButtonStyle: 'primary',
            });
            if (!confirmed) return;
            await versionsApi.publish(targetVersion.id, targetVersion.updatedAt);
            await refetchWorkflow();
            await queryClient.invalidateQueries({ queryKey: ['pageVersion', pageId] });
            await queryClient.invalidateQueries({ queryKey: ['pages'] });
            addNotification('Changes published', 'success');
        } catch (error) {
            addNotification(`Publishing failed: ${error.message}`, 'error');
        }
    }, [workflow, isDirty, handleSave, showConfirm, refetchWorkflow, queryClient, pageId, addNotification]);

    const handleUndoChanges = useCallback(async () => {
        if (!originalWebpageData || !originalPageVersionData) return;

        setWebpageData(originalWebpageData);
        setPageVersionData(originalPageVersionData);
        if (originalPageVersionData.widgets) {
            setLocalWidgets(originalPageVersionData.widgets);
        }

        const initId = `page-editor-${originalWebpageData.id}-undo`;
        await publishUpdate(initId, OperationTypes.INIT_PAGE, {
            id: originalWebpageData.id,
            data: originalWebpageData
        });
        await publishUpdate(initId, OperationTypes.INIT_VERSION, {
            id: originalPageVersionData.id || originalPageVersionData.versionId,
            data: originalPageVersionData
        });

        setIsDirty(false);
        setEditorResetKey(k => k + 1);

        // Recompute dirty state immediately after reset to ensure it's clean
        setTimeout(() => {
            recomputeDirtyState();
        }, 0);

        addNotification('Changes undone', 'success');
    }, [originalWebpageData, originalPageVersionData, publishUpdate, setIsDirty, addNotification]);

    // Recompute dirty state when data changes
    useEffect(() => {
        recomputeDirtyState();
    }, [recomputeDirtyState]);

    // Warn on browser-level navigation (tab close / refresh) when there are unsaved changes
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    // Conflict resolution handlers
    const handleConflictResolve = useCallback(async (resolutions) => {
        if (!conflictData) return;

        // Apply user's resolution decisions
        const resolved = applyConflictResolutions(conflictData.analysis, resolutions);

        // Update local state with resolved data
        setWebpageData(resolved.webpage);
        setPageVersionData(resolved.version);

        // Update original data to the server version (what we just accepted)
        // This way if user didn't change anything, page stays clean
        setOriginalWebpageData(resolved.webpage);
        setOriginalPageVersionData(resolved.version);

        // Update local widgets for UI
        if (resolved.version.widgets) {
            setLocalWidgets(resolved.version.widgets);
        }

        // Publish update through UDC to notify active editor components
        if (versionId && resolved.version.widgets) {
            const udcComponentId = `page-editor-${pageId}-conflict-resolve`;
            publishUpdate(udcComponentId, OperationTypes.UPDATE_PAGE_VERSION_DATA, {
                id: versionId,
                updates: {
                    widgets: resolved.version.widgets
                },
                source: 'conflict_resolution',
                skipDirty: true // Don't mark as dirty - preserve existing dirty state
            });
        }

        // Check if resolved data matches server - if so, mark as clean
        const matchesServer =
            JSON.stringify(resolved.webpage) === JSON.stringify(conflictData.serverWebpage) &&
            JSON.stringify(resolved.version) === JSON.stringify(conflictData.serverVersion);

        if (matchesServer) {
            // Resolved to server state - mark as clean
            setIsDirty(false);
        }
        // Otherwise preserve existing dirty state

        // Close modal
        setShowConflictModal(false);
        setConflictData(null);
    }, [conflictData, versionId, pageId, publishUpdate, setIsDirty]);

    const handleConflictCancel = useCallback(() => {
        setShowConflictModal(false);
        setConflictData(null);
        addNotification(
            'Save cancelled - conflicts not resolved',
            'info'
        );
    }, [addNotification]);

    // Widget editor handlers
    const handleOpenWidgetEditor = useCallback((widgetData, forceOpen = true) => {
        // Always update the editing widget
        setEditingWidget(widgetData)
        // forceOpen = true: open the panel (from edit button)
        // forceOpen = false: only update if already open (from widget body click)
        if (forceOpen) {
            setWidgetEditorOpen(true)
        }
        // If forceOpen is false, panel state remains unchanged (open stays open, closed stays closed)
    }, [])

    const handleCloseWidgetEditor = useCallback(() => {
        setWidgetEditorOpen(false)
        setEditingWidget(null)
    }, [])

    const applyWidgetUpdateToPageState = useCallback((updatedWidget) => {
        if (!updatedWidget?.id) return

        setLocalWidgets(prev => applyWidgetUpdateToWidgetMap(prev || pageVersionData?.widgets || {}, updatedWidget))
        setPageVersionData(prev => prev ? ({
            ...prev,
            widgets: applyWidgetUpdateToWidgetMap(prev.widgets || {}, updatedWidget)
        }) : prev)
        setEditingWidget(prev => prev && String(prev.id) === String(updatedWidget.id)
            ? { ...prev, ...updatedWidget, config: { ...(prev.config || {}), ...(updatedWidget.config || {}) } }
            : prev
        )
    }, [pageVersionData?.widgets])

    const handleRealTimeWidgetUpdate = useCallback((updatedWidget) => {
        applyWidgetUpdateToPageState(updatedWidget)
        const slotName = updatedWidget?.slotName || updatedWidget?.slot || updatedWidget?.context?.slotName
        if (!updatedWidget?.id || !slotName) return

        publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: updatedWidget.id,
            slotName,
            contextType: 'page',
            pageId,
            versionId,
            config: updatedWidget.config || {},
            widgetUpdates: updatedWidget.widgetUpdates,
            widgetPath: updatedWidget.widgetPath || updatedWidget.context?.widgetPath
        })
    }, [applyWidgetUpdateToPageState, publishUpdate, componentId, pageId, versionId])

    const handleSaveWidget = useCallback(async (updatedWidget) => {
        const widgetsForSave = applyWidgetUpdateToWidgetMap(
            pageVersionData?.widgets || {},
            updatedWidget
        )

        return await saveWidgetEditorChanges(updatedWidget, {
            applyWidgetUpdate: applyWidgetUpdateToPageState,
            persistChanges: () => handleActualSave({
                description: `Widget "${updatedWidget.name || updatedWidget.id}" saved`,
                versionDataOverrides: { widgets: widgetsForSave }
            }),
            addNotification,
            closeWidgetEditor: handleCloseWidgetEditor
        })
    }, [addNotification, applyWidgetUpdateToPageState, handleActualSave, handleCloseWidgetEditor, pageVersionData?.widgets])

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

                return
            }
        }

        // Handler for error events
        const handleWidgetError = (payload) => {
            addNotification(
                `Widget error: ${payload.error}`,
                'error'
            )
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
        { id: 'slots', label: 'All Slots', icon: Layers },
        { id: 'settings', label: 'Settings & SEO', icon: Settings },
        { id: 'theme', label: 'Theme', icon: Palette },
        { id: 'publishing', label: 'Publish', icon: Calendar },
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
    // Allow widget editor to stay open on 'content' and 'slots' tabs
    useEffect(() => {
        if (widgetEditorOpen && activeTab !== 'content' && activeTab !== 'slots') {
            // Check widget validation state
            const widgetState = widgetEditorRef.current
            const isValidating = widgetState?.isValidating || false
            const isValid = widgetState?.isValid !== false

            // Block navigation if validating
            if (isValidating) {
                addNotification(
                    'Please wait for validation to complete before navigating',
                    'warning'
                )
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
                            addNotification(
                                'Cannot save: Please fix validation errors first',
                                'error'
                            )
                            return
                        }

                        // Save the widget changes using the panel's save method
                        if (widgetEditorRef.current) {
                            try {
                                await widgetEditorRef.current.saveCurrentWidget()
                            } catch {
                                // handleActualSave already shows the failure; keep the panel open.
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
            <div className="fixed inset-0 bg-gray-50 flex items-center justify-center" style={{ zIndex: 10000 }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-600">Loading page editor...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-gray-50 flex flex-col" style={{ zIndex: 10000 }}>
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
                                <div className="flex items-center gap-2">
                                    <div className="text-lg font-semibold text-gray-900 truncate" role="heading" aria-level="1">
                                        {isNewPage ? 'New Page' : (webpageData?.title || 'Untitled Page')}
                                    </div>
                                    <ContextualHelpLink topicId="pages-create" label="Open Page editor help" />
                                </div>
                                {/* Show hostnames for root pages, otherwise show path */}
                                {!isNewPage && !webpageData?.parent && webpageData?.hostnames && webpageData.hostnames.length > 0 ? (
                                    <div className="flex items-center text-sm text-gray-500">
                                        <Globe className="w-3.5 h-3.5 mr-1.5" />
                                        <span>{webpageData.hostnames.join(', ')}</span>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500">
                                        /{isNewPage ? 'new-page-slug' : (webpageData?.slug || 'page-slug')}
                                    </div>
                                )}
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
                                            data-testid={`page-editor-tab-${tabItem.id}`}
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
                                                        data-testid={`page-editor-tab-${tabItem.id}`}
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

            {/* Global WYSIWYG Toolbar - appears when editor is active */}
            <GlobalWysiwygToolbar />

            {/* Global Table Toolbar - appears when table editor is active */}
            <GlobalTableToolbar />

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
                                            <div className="text-gray-600">Loading version data...</div>
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
                                                        <div className="text-sm text-amber-700">
                                                            <span className="font-bold">No layout specified for this version.</span> Using default layout "{activeLayoutName || 'main_layout'}" for preview.
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {isLoadingLayout ? (
                                            <div className="flex-1 flex items-center justify-center bg-gray-50">
                                                <div className="text-center">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                                    <div className="text-gray-600">Loading layout data...</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1 h-full">
                                                <PageContentEditor
                                                    key={`page-editor-${webpageData?.id}-${pageVersionData?.versionId || 'current'}-${editorResetKey}`}
                                                    ref={contentEditorRef}
                                                    webpageData={webpageData}
                                                    pageVersionData={pageVersionData}
                                                    onUpdate={updatePageData}
                                                    isNewPage={isNewPage}
                                                    layoutJson={layoutData}
                                                    editable={true}
                                                    onOpenWidgetEditor={handleOpenWidgetEditor}
                                                    namespace={namespace}
                                                    // PageEditor-specific props
                                                    currentVersion={currentVersion}
                                                    availableVersions={availableVersions}
                                                    onVersionChange={switchToVersion}
                                                    // Local widget state management
                                                    localWidgets={localWidgets}
                                                    onLocalWidgetUpdate={updateLocalWidgets}
                                                    sharedComponentId={componentId}
                                                    publishWidgetOperation={publishWidgetOperation}
                                                    onQueueCutSourceRemoval={queueCutSourceRemoval}
                                                    // Widget inheritance
                                                    inheritedWidgets={inheritedWidgets}
                                                    slotInheritanceRules={slotInheritanceRules}
                                                    hasInheritedContent={hasInheritedContent}
                                                    refetchInheritance={refetchInheritance}
                                                    // Path variables for dynamic content
                                                    pathVariables={pathVariables}
                                                    simulatedPath={simulatedPath}
                                                    onSimulatedPathChange={setSimulatedPath}
                                                    // Editor context
                                                    context={{
                                                        pageId: webpageData?.id,
                                                        mode: 'edit',
                                                        namespace: namespace
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                        {activeTab === 'slots' && (
                            <AllSlotsEditor
                                key={`slots-${pageVersionData?.versionId || 'new'}`}
                                widgets={localWidgets || pageVersionData?.widgets || {}}
                                onWidgetChange={updateLocalWidgets}
                                editable={!isNewPage}
                                currentVersion={currentVersion}
                                webpageData={webpageData}
                                pageVersionData={pageVersionData}
                                onVersionChange={switchToVersion}
                                onOpenWidgetEditor={handleOpenWidgetEditor}
                                context={{
                                    pageId: webpageData?.id || pageId,
                                    versionId: pageVersionData?.id || versionId,
                                    contextType: 'page',
                                    namespace: namespace
                                }}
                                namespace={namespace}
                                sharedComponentId={componentId}
                                publishWidgetOperation={publishWidgetOperation}
                                inheritedWidgets={inheritedWidgets}
                                slotInheritanceRules={slotInheritanceRules}
                                hasInheritedContent={hasInheritedContent}
                                refetchInheritance={refetchInheritance}
                                pathVariables={pathVariables}
                                simulatedPath={simulatedPath}
                                onSimulatedPathChange={setSimulatedPath}
                            />
                        )}
                        {activeTab === 'settings' && (
                            <SettingsEditor
                                key={`settings-${pageVersionData?.versionId || 'new'}-${editorResetKey}`}
                                ref={settingsEditorRef}
                                componentId={`${componentId}-settings`}
                                context={{
                                    pageId: webpageData?.id || pageId,
                                    versionId: pageVersionData?.id || versionId,
                                    contextType: 'page'
                                }}
                                isNewPage={isNewPage}
                                // Path preview props
                                simulatedPath={simulatedPath}
                                onSimulatedPathChange={setSimulatedPath}
                                pathVariables={pathVariables}
                            />
                        )}
                        {activeTab === 'publishing' && !isNewPage && (
                            <PublishingEditor
                                key={`publishing-${pageVersionData?.versionId || 'current'}`}
                                pageId={pageId}
                                isDirty={isDirty}
                                onSave={handleSave}
                                onWorkflowChange={refetchWorkflow}
                                onVersionRestored={handleVersionRestored}
                            />
                        )}
                        {activeTab === 'theme' && (
                            <ThemeSelector
                                key={`theme-${pageVersionData?.versionId || 'new'}`}
                                selectedThemeId={pageVersionData?.theme}
                                effectiveThemeId={pageVersionData?.effectiveTheme?.id}
                                themeInheritanceInfo={pageInheritance.theme.inheritanceInfo || pageVersionData?.themeInheritanceInfo}
                                onThemeChange={(themeId) => updatePageData({ theme: themeId })}
                            />
                        )}
                        {activeTab === 'preview' && (
                            <div className="h-full bg-white">
                                {!isVersionReady ? (
                                    <div className="h-full flex items-center justify-center bg-gray-50">
                                        <div className="text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                            <div className="text-gray-600">Loading version data...</div>
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
                        title={editingWidget ? `Edit ${getWidgetDisplayName(editingWidget.type)}` : 'Edit Widget'}
                        autoOpenSpecialEditor={true}
                        namespace={namespace}
                        webpageData={webpageData}
                        pageVersionData={pageVersionData}
                        context={{
                            pageId: webpageData?.id,
                            versionId: pageVersionData?.versionId,
                            webpageData: webpageData,
                            pageVersionData: pageVersionData
                        }}
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
                onUndoChanges={handleUndoChanges}
                onPublishClick={handlePublishWorkingCopy}
                onHistoryClick={() => navigate(`/pages/${pageId}/edit/publishing?panel=history`, { state: { previousView } })}
                onScheduleClick={() => navigate(`/pages/${pageId}/edit/publishing`, { state: { previousView } })}
                isSaving={isSaving}
                isNewPage={isNewPage}
                webpageData={webpageData}
                pageVersionData={pageVersionData}
                validationState={schemaValidationState}
                canPublish={canPublishWorkingCopy(isDirty, workflow)}
                customStatusContent={
                    <div className="flex items-center space-x-4">
                        <span>
                            Status: <span className={`font-medium ${workflow?.state === 'live' ? 'text-green-600' :
                                workflow?.state?.includes('scheduled') ? 'text-blue-600' :
                                    'text-gray-600'
                                }`}>
                                {formatWorkflowState(workflow?.state)}
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

            {/* Essential Fields Modal for New Pages */}
            {showEssentialFieldsModal && (
                <EssentialFieldsModal
                    onSave={handleCreateNewPage}
                    onCancel={() => {
                        setShowEssentialFieldsModal(false);
                        navigate(previousView);
                    }}
                    isLoading={createNewPageMutation.isPending}
                />
            )}

            {/* Conflict Resolution Modal */}
            {showConflictModal && conflictData && (
                <ConflictResolutionModal
                    conflictResult={conflictData.analysis}
                    onResolve={handleConflictResolve}
                    onCancel={handleConflictCancel}
                />
            )}

            {/* Stale version warning removed - conflicts now handled via diff modal */}
        </div>
    )
}

// Essential Fields Modal Component
const EssentialFieldsModal = ({ onSave, onCancel, isLoading = false }) => {
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [description, setDescription] = useState('')
    const [autoGenerateSlug, setAutoGenerateSlug] = useState(true)
    const [selectedLayout, setSelectedLayout] = useState('')

    // Fetch available layouts using React Query
    const { data: layoutsData } = useQuery({
        queryKey: ['layouts', 'code'],
        queryFn: () => layoutsApi.codeLayouts.list()
    })

    const availableLayouts = layoutsData?.results || []

    // Set first layout as default when layouts are loaded
    useEffect(() => {
        if (availableLayouts.length > 0 && !selectedLayout) {
            setSelectedLayout(availableLayouts[0].name);
        }
    }, [availableLayouts, selectedLayout]);

    // Auto-generate slug from title
    useEffect(() => {
        if (autoGenerateSlug && title) {
            const generatedSlug = title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            setSlug(generatedSlug);
        }
    }, [title, autoGenerateSlug]);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!title.trim()) {
            alert('Title is required');
            return;
        }

        if (!slug.trim()) {
            alert('Slug is required');
            return;
        }

        onSave({
            title,
            slug,
            description,
            codeLayout: selectedLayout
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10010]">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="2">Create New Page</div>
                        <div className="text-sm text-gray-500 mt-1">Fill in the essential fields to get started</div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-4 space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={isLoading}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder="e.g., News, About Us, Contact"
                                autoFocus
                                required
                            />
                        </div>

                        {/* Slug */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Slug <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => {
                                    setSlug(e.target.value);
                                    setAutoGenerateSlug(false);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., news, about-us, contact"
                                required
                            />
                            <div className="mt-1 flex items-center">
                                <input
                                    type="checkbox"
                                    id="auto-slug"
                                    checked={autoGenerateSlug}
                                    onChange={(e) => setAutoGenerateSlug(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="auto-slug" className="ml-2 text-sm text-gray-600">
                                    Auto-generate from title
                                </label>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Brief description of this page..."
                            />
                        </div>

                        {/* Layout */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Layout (optional)
                            </label>
                            <select
                                value={selectedLayout}
                                onChange={(e) => setSelectedLayout(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Use Default Layout --</option>
                                {availableLayouts.map(layout => (
                                    <option key={layout.name} value={layout.name}>
                                        {layout.name}
                                    </option>
                                ))}
                            </select>
                            <div className="mt-1 text-xs text-gray-500">
                                Leave blank to use the default layout
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {isLoading && (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            <span>{isLoading ? 'Creating...' : 'Create Page'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

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

export default PageEditor
