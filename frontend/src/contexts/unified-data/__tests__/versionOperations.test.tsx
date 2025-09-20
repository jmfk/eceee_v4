import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../context/UnifiedDataContext';
import { useVersionOperations } from '../hooks/useVersionOperations';
import { OperationTypes } from '../types/operations';

const TestWrapper: React.FC<{ children: React.ReactNode; initialState?: any }> = ({
    children,
    initialState
}) => (
    <UnifiedDataProvider initialState={initialState}>
        {children}
    </UnifiedDataProvider>
);

describe('Version Operations', () => {
    const pageId = 'test-page-123';
    const versionId1 = 'version-1';
    const versionId2 = 'version-2';

    const initialState = {
        pages: {
            [pageId]: {
                id: pageId,
                title: 'Test Page',
                slug: 'test-page',
                status: 'draft',
                metadata: { description: 'Test page' },
                layout: 'single_column',
                version: versionId1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        },
        widgets: {
            'widget-1': {
                id: 'widget-1',
                type: 'core_widgets.ContentWidget',
                pageId: pageId,
                slot: 'main',
                config: { content: 'Version 1 content' },
                order: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        },
        versions: {
            [versionId1]: {
                id: versionId1,
                page_id: pageId,
                number: 1,
                data: {
                    layout: 'single_column',
                    widgets: {
                        'widget-1': {
                            id: 'widget-1',
                            config: { content: 'Version 1 content' }
                        }
                    },
                    metadata: { description: 'Test page' }
                },
                created_at: new Date().toISOString(),
                created_by: 'user',
                status: 'draft'
            },
            [versionId2]: {
                id: versionId2,
                page_id: pageId,
                number: 2,
                data: {
                    layout: 'two_column',
                    widgets: {
                        'widget-1': {
                            id: 'widget-1',
                            config: { content: 'Version 2 content' }
                        }
                    },
                    metadata: { description: 'Updated test page' }
                },
                created_at: new Date().toISOString(),
                created_by: 'user',
                status: 'published'
            }
        }
    };

    describe('Version Management', () => {
        it('should list versions correctly', () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.versions).toHaveLength(2);
            expect(result.current.latestVersion?.number).toBe(2);
            expect(result.current.publishedVersion?.id).toBe(versionId2);
            expect(result.current.currentVersion?.id).toBe(versionId1);
        });

        it('should create new version', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            let newVersionId: string;

            await act(async () => {
                newVersionId = await result.current.createVersion({
                    layout: 'three_column',
                    metadata: { description: 'New version' }
                });
            });

            expect(newVersionId).toBeDefined();
            expect(newVersionId).toMatch(/^version-\d+-/);
        });

        it('should publish version', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            await act(async () => {
                await result.current.publishVersion(versionId1);
            });

            // Version should be published
            const version1 = result.current.getVersion(versionId1);
            expect(version1?.status).toBe('published');
        });

        it('should revert to version', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            await act(async () => {
                await result.current.revertToVersion(versionId2);
            });

            // Page should now use version 2's data
            // Note: We'd need to check the page state to verify the revert
        });

        it('should delete version', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.versions).toHaveLength(2);

            await act(async () => {
                await result.current.deleteVersion(versionId2);
            });

            // Version should be removed
            expect(result.current.getVersion(versionId2)).toBeNull();
        });
    });

    describe('Version Comparison', () => {
        it('should compare versions', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            let comparison: any;

            await act(async () => {
                comparison = await result.current.compareVersions(versionId1, versionId2);
            });

            expect(comparison).toBeDefined();
            expect(comparison.version1.id).toBe(versionId1);
            expect(comparison.version2.id).toBe(versionId2);
            expect(comparison.differences.layout).toBe(true); // Different layouts
            expect(comparison.differences.metadata).toBe(true); // Different metadata
            expect(comparison.differences.widgets).toBe(true); // Different widget content
        });

        it('should handle version comparison errors', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            await act(async () => {
                await expect(
                    result.current.compareVersions('non-existent-1', 'non-existent-2')
                ).rejects.toThrow('One or both versions not found');
            });
        });
    });

    describe('Version Utilities', () => {
        it('should get version by ID', () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const version = result.current.getVersion(versionId1);
            expect(version?.id).toBe(versionId1);
            expect(version?.number).toBe(1);

            const nonExistent = result.current.getVersion('non-existent');
            expect(nonExistent).toBeNull();
        });

        it('should get version history', () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const history = result.current.getVersionHistory();
            expect(history).toHaveLength(2);
            expect(history[0].number).toBe(2); // Latest first
            expect(history[1].number).toBe(1);
        });

        it('should check version permissions', () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            // Draft version can be published
            expect(result.current.canPublish(versionId1)).toBe(true);

            // Published version cannot be published again
            expect(result.current.canPublish(versionId2)).toBe(false);

            // Can revert to different version
            expect(result.current.canRevert(versionId2)).toBe(true);

            // Cannot revert to current version
            expect(result.current.canRevert(versionId1)).toBe(false);

            // Check current version
            expect(result.current.isCurrentVersion(versionId1)).toBe(true);
            expect(result.current.isCurrentVersion(versionId2)).toBe(false);
        });
    });

    describe('Version Workflow', () => {
        it('should handle complete version workflow', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            // 1. Create new version
            let newVersionId: string;
            await act(async () => {
                newVersionId = await result.current.createVersion({
                    layout: 'three_column',
                    metadata: { description: 'New version' }
                });
            });

            expect(newVersionId).toBeDefined();

            // 2. Publish the new version
            await act(async () => {
                await result.current.publishVersion(newVersionId);
            });

            // 3. Compare with previous version
            let comparison: any;
            await act(async () => {
                comparison = await result.current.compareVersions(versionId1, newVersionId);
            });

            expect(comparison.differences.layout).toBe(true);

            // 4. Revert to previous version
            await act(async () => {
                await result.current.revertToVersion(versionId1);
            });

            // 5. Delete the new version
            await act(async () => {
                await result.current.deleteVersion(newVersionId);
            });
        });
    });
});
