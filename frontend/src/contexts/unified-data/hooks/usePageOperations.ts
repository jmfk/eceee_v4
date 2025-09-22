import { useCallback, useMemo, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { PageData, PageMetadata } from '../types/state';
import { OperationTypes } from '../types/operations';

export interface UsePageOperationsResult {
    // Page data
    page: PageData | null;
    metadata: PageMetadata | null;
    hasUnsavedChanges: boolean;
    isPublished: boolean;
    
    // Operations
    updateMetadata: (metadata: Partial<PageMetadata>) => Promise<void>;
    updatePage: (updates: Partial<PageData>) => Promise<void>;
    publishPage: () => Promise<void>;
    unpublishPage: () => Promise<void>;
    schedulePage: (publishAt: string) => Promise<void>;
    duplicatePage: (newSlug?: string) => Promise<string>;
    deletePage: () => Promise<void>;
    
    // Version operations
    createVersion: () => Promise<string>;
    revertToVersion: (versionId: string) => Promise<void>;
    
    // Utilities
    canPublish: boolean;
    canEdit: boolean;
    isDraft: boolean;
    isScheduled: boolean;
}

export function usePageOperations(pageId: string): UsePageOperationsResult {
    const { dispatch, useExternalChanges } = useUnifiedData();

    // State
    const [page, setPage] = useState<PageData | null>(null);
    const [metadata, setMetadata] = useState<PageMetadata | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Subscribe to external changes
    useExternalChanges(`page-ops-${pageId}`, state => {
        setPage(state.pages[pageId] || null);
        setMetadata(state.pages[pageId]?.metadata || null);
        setHasUnsavedChanges(
            Object.values(state.metadata.widgetStates.unsavedChanges).some(Boolean)
        );
    });

    // Derived state
    const isPublished = page?.status === 'published';
    const isDraft = page?.status === 'draft';
    const isScheduled = page?.status === 'scheduled';
    const canPublish = isDraft || isScheduled;
    const canEdit = !isPublished || isDraft;

    // Operations
    const updateMetadata = useCallback(async (newMetadata: Partial<PageMetadata>) => {
        await dispatch({
            type: OperationTypes.UPDATE_PAGE_METADATA,
            sourceId: pageId,
            payload: {
                id: pageId,
                metadata: newMetadata
            }
        });
    }, [dispatch, pageId]);

    const updatePage = useCallback(async (updates: Partial<PageData>) => {
        await dispatch({
            type: OperationTypes.UPDATE_PAGE,
            sourceId: pageId,
            payload: {
                id: pageId,
                updates
            }
        });
    }, [dispatch, pageId]);

    const publishPage = useCallback(async () => {
        await dispatch({
            type: OperationTypes.PUBLISH_PAGE,
            sourceId: pageId,
            payload: {
                id: pageId
            }
        });
    }, [dispatch, pageId]);

    const unpublishPage = useCallback(async () => {
        await dispatch({
            type: OperationTypes.UNPUBLISH_PAGE,
            sourceId: pageId,
            payload: {
                id: pageId
            }
        });
    }, [dispatch, pageId]);

    const schedulePage = useCallback(async (publishAt: string) => {
        await dispatch({
            type: OperationTypes.SCHEDULE_PAGE,
            sourceId: pageId,
            payload: {
                id: pageId,
                publishAt
            }
        });
    }, [dispatch, pageId]);

    const duplicatePage = useCallback(async (newSlug?: string): Promise<string> => {
        const result = await dispatch({
            type: OperationTypes.DUPLICATE_PAGE,
            sourceId: pageId,
            payload: {
                id: pageId,
                newSlug
            }
        });
        return result.newPageId;
    }, [dispatch, pageId]);

    const deletePage = useCallback(async () => {
        await dispatch({
            type: OperationTypes.DELETE_PAGE,
            sourceId: pageId,
            payload: {
                id: pageId
            }
        });
    }, [dispatch, pageId]);

    const createVersion = useCallback(async (): Promise<string> => {
        const result = await dispatch({
            type: OperationTypes.CREATE_VERSION,
            sourceId: pageId,
            payload: {
                pageId
            }
        });
        // ToDO This si wrong

        console.warn("THIS NEEDS TO BE FIXED")
        return result.versionId;
    }, [dispatch, pageId]);

    const revertToVersion = useCallback(async (versionId: string) => {
        await dispatch({
            type: OperationTypes.REVERT_VERSION,
            sourceId: pageId,
            payload: {
                pageId,
                versionId
            }
        });
    }, [dispatch, pageId]);

    return useMemo(() => ({
        page,
        metadata,
        hasUnsavedChanges,
        isPublished,
        isDraft,
        isScheduled,
        canPublish,
        canEdit,
        updateMetadata,
        updatePage,
        publishPage,
        unpublishPage,
        schedulePage,
        duplicatePage,
        deletePage,
        createVersion,
        revertToVersion
    }), [
        page,
        metadata,
        hasUnsavedChanges,
        isPublished,
        isDraft,
        isScheduled,
        canPublish,
        canEdit,
        updateMetadata,
        updatePage,
        publishPage,
        unpublishPage,
        schedulePage,
        duplicatePage,
        deletePage,
        createVersion,
        revertToVersion
    ]);
}
