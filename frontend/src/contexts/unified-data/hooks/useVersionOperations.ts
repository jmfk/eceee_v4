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
        const newVersionId = `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        await dispatch({
            type: OperationTypes.CREATE_VERSION,
            payload: {
                pageId: pageId,
                versionId: newVersionId,
                data: data,
                createdBy: 'user'
            }
        });
        
        return newVersionId;
    }, [dispatch, pageId]);

    const publishVersion = useCallback(async (versionId: string) => {
        await dispatch({
            type: OperationTypes.PUBLISH_VERSION,
            payload: {
                pageId: pageId,
                versionId: versionId
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
                versionId: versionId
            }
        });
    }, [dispatch]);

    const compareVersions = useCallback(async (versionId1: string, versionId2: string) => {
        // Get versions from state
        const version1 = versions.find(v => v.id === versionId1);
        const version2 = versions.find(v => v.id === versionId2);
        
        if (!version1 || !version2) {
            throw new Error('One or both versions not found');
        }

        // Compare version data
        const comparison = {
            version1: {
                id: version1.id,
                number: version1.number,
                created_at: version1.created_at,
                status: version1.status
            },
            version2: {
                id: version2.id,
                number: version2.number,
                created_at: version2.created_at,
                status: version2.status
            },
            differences: {
                layout: version1.data.layout !== version2.data.layout,
                metadata: JSON.stringify(version1.data.metadata) !== JSON.stringify(version2.data.metadata),
                widgets: JSON.stringify(version1.data.widgets) !== JSON.stringify(version2.data.widgets),
                widgetCount: {
                    version1: Object.keys(version1.data.widgets || {}).length,
                    version2: Object.keys(version2.data.widgets || {}).length
                }
            }
        };

        // Dispatch for logging/tracking purposes
        await dispatch({
            type: OperationTypes.COMPARE_VERSIONS,
            payload: {
                pageId,
                versionId1,
                versionId2,
                comparison
            }
        });

        return comparison;
    }, [versions, dispatch, pageId]);

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
