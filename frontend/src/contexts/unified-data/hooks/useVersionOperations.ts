import { useCallback, useMemo } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { VersionData } from '../types/state';
import { OperationTypes } from '../types/operations';

export interface UseVersionOperationsResult {
    // Version data
    versions: VersionData[];
    currentVersion: VersionData | null;
    latestVersion: VersionData | null;
    publishedVersion: VersionData | null;
    
    // Operations
    createVersion: (data?: any) => Promise<string>;
    publishVersion: (versionId: string) => Promise<void>;
    revertToVersion: (versionId: string) => Promise<void>;
    deleteVersion: (versionId: string) => Promise<void>;
    compareVersions: (versionId1: string, versionId2: string) => Promise<any>;
    
    // Utilities
    getVersion: (versionId: string) => VersionData | null;
    getVersionHistory: () => VersionData[];
    canPublish: (versionId: string) => boolean;
    canRevert: (versionId: string) => boolean;
    isCurrentVersion: (versionId: string) => boolean;
}

export function useVersionOperations(pageId: string): UseVersionOperationsResult {
    const { dispatch, useSelector } = useUnifiedData();

    // Selectors
    const versions = useSelector(state => 
        Object.values(state.versions)
            .filter(version => version.page_id === pageId)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    );

    const currentVersion = useSelector(state => {
        const page = state.pages[pageId];
        if (!page) return null;
        return state.versions[page.version] || null;
    });

    const latestVersion = versions[0] || null;
    const publishedVersion = versions.find(v => v.status === 'published') || null;

    // Operations
    const createVersion = useCallback(async (data?: any): Promise<string> => {
        const result = await dispatch({
            type: OperationTypes.CREATE_VERSION,
            payload: {
                pageId,
                data
            }
        });
        return result.versionId;
    }, [dispatch, pageId]);

    const publishVersion = useCallback(async (versionId: string) => {
        await dispatch({
            type: OperationTypes.PUBLISH_VERSION,
            payload: {
                pageId,
                versionId,
                action: 'publish'
            }
        });
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

    const deleteVersion = useCallback(async (versionId: string) => {
        await dispatch({
            type: OperationTypes.DELETE_VERSION,
            payload: {
                pageId,
                versionId
            }
        });
    }, [dispatch, pageId]);

    const compareVersions = useCallback(async (versionId1: string, versionId2: string) => {
        const result = await dispatch({
            type: OperationTypes.COMPARE_VERSIONS,
            payload: {
                pageId,
                versionId1,
                versionId2
            }
        });
        return result.comparison;
    }, [dispatch, pageId]);

    // Utilities
    const getVersion = useCallback((versionId: string): VersionData | null => {
        return versions.find(v => v.id === versionId) || null;
    }, [versions]);

    const getVersionHistory = useCallback((): VersionData[] => {
        return versions;
    }, [versions]);

    const canPublish = useCallback((versionId: string): boolean => {
        const version = getVersion(versionId);
        return version?.status === 'draft';
    }, [getVersion]);

    const canRevert = useCallback((versionId: string): boolean => {
        const version = getVersion(versionId);
        return version !== null && version.id !== currentVersion?.id;
    }, [getVersion, currentVersion]);

    const isCurrentVersion = useCallback((versionId: string): boolean => {
        return currentVersion?.id === versionId;
    }, [currentVersion]);

    return useMemo(() => ({
        versions,
        currentVersion,
        latestVersion,
        publishedVersion,
        createVersion,
        publishVersion,
        revertToVersion,
        deleteVersion,
        compareVersions,
        getVersion,
        getVersionHistory,
        canPublish,
        canRevert,
        isCurrentVersion
    }), [
        versions,
        currentVersion,
        latestVersion,
        publishedVersion,
        createVersion,
        publishVersion,
        revertToVersion,
        deleteVersion,
        compareVersions,
        getVersion,
        getVersionHistory,
        canPublish,
        canRevert,
        isCurrentVersion
    ]);
}
