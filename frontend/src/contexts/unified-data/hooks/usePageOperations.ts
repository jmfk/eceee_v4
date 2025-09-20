import { useCallback, useMemo } from 'react';
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
    const { dispatch, useSelector } = useUnifiedData();

    // Selectors
    const page = useSelector(state => state.pages[pageId] || null);
    const metadata = useSelector(state => state.pages[pageId]?.metadata || null);
    const hasUnsavedChanges = useSelector(state => 
        Object.values(state.metadata.widgetStates.unsavedChanges).some(Boolean)
    );

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
            payload: {
                pageId: pageId,
                metadata: newMetadata
            }
        });
    }, [dispatch, pageId]);

    const updatePage = useCallback(async (updates: Partial<PageData>) => {
        await dispatch({
            type: OperationTypes.UPDATE_PAGE,
            payload: {
                pageId: pageId,
                updates
            }
        });
    }, [dispatch, pageId]);

    const publishPage = useCallback(async () => {
        await dispatch({
            type: OperationTypes.PUBLISH_PAGE,
            payload: {
                pageId: pageId
            }
        });
    }, [dispatch, pageId]);

    const unpublishPage = useCallback(async () => {
        await dispatch({
            type: OperationTypes.UNPUBLISH_PAGE,
            payload: {
                pageId: pageId
            }
        });
    }, [dispatch, pageId]);

    const schedulePage = useCallback(async (publishAt: string) => {
        await dispatch({
            type: OperationTypes.SCHEDULE_PAGE,
            payload: {
                pageId: pageId,
                publishAt
            }
        });
    }, [dispatch, pageId]);

    const duplicatePage = useCallback(async (newSlug?: string): Promise<string> => {
        const newPageId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        await dispatch({
            type: OperationTypes.DUPLICATE_PAGE,
            payload: {
                pageId: pageId,
                newPageId: newPageId,
                newSlug
            }
        });
        
        return newPageId;
    }, [dispatch, pageId]);

    const deletePage = useCallback(async () => {
        await dispatch({
            type: OperationTypes.DELETE_PAGE,
            payload: {
                pageId: pageId
            }
        });
    }, [dispatch, pageId]);

    const createVersion = useCallback(async (): Promise<string> => {
        const result = await dispatch({
            type: OperationTypes.CREATE_VERSION,
            payload: {
                pageId
            }
        });
        return result.versionId;
    }, [dispatch, pageId]);

    const revertToVersion = useCallback(async (versionId: string) => {
        await dispatch({
            type: OperationTypes.REVERT_VERSION,
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
