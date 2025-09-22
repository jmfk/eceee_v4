import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../v2/context/UnifiedDataContext';
import { useVersionOperations } from '../v2/hooks/useVersionOperations';
import { OperationTypes } from '../v2/types/operations';
import { UnifiedState } from '../v2/types/state';

const TestWrapper: React.FC<{ children: React.ReactNode; initialState?: Partial<UnifiedState> }> = ({
    children,
    initialState
}) => (
    <UnifiedDataProvider
        initialState={initialState}
        options={{
            enableVersionOperations: true
        }}
    >
        {children}
    </UnifiedDataProvider>
);

describe('Version Operations v2', () => {
    const pageId = 'test-page-123';
    const versionId1 = 'version-1';
    const versionId2 = 'version-2';

    const initialState: Partial<UnifiedState> = {
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
                slotName: 'main',
                config: { content: 'Version 1 content' },
                order: 0
            }
        },
        versions: {
            [versionId1]: {
                id: versionId1,
                pageId: pageId,
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
                createdAt: new Date().toISOString(),
                createdBy: 'user',
                status: 'draft'
            },
            [versionId2]: {
                id: versionId2,
                pageId: pageId,
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
                createdAt: new Date().toISOString(),
                createdBy: 'user',
                status: 'published'
            }
        }
    };

    describe('Version Management', () => {
        it('should list versions correctly', () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const versionState = result.current.getVersionState();
            expect(versionState.versions).toHaveLength(2);
            expect(versionState.latestVersion?.number).toBe(2);
            expect(versionState.publishedVersion?.id).toBe(versionId2);
            expect(versionState.currentVersion?.id).toBe(versionId1);
        });

        it('should create new version', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            let newVersionId: string;

            await act(async () => {
                newVersionId = await result.current.create({
                    layout: 'three_column',
                    metadata: { description: 'New version' }
                });
            });

            expect(newVersionId).toBeDefined();
            expect(newVersionId).toMatch(/^version-\d+-/);

            const newVersion = result.current.getVersionState().versions.find(v => v.id === newVersionId);
            expect(newVersion?.data.layout).toBe('three_column');
            expect(newVersion?.data.metadata.description).toBe('New version');
        });

        it('should publish version', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            await act(async () => {
                await result.current.publish(versionId1);
            });

            const versionState = result.current.getVersionState();
            expect(versionState.getVersion(versionId1)?.status).toBe('published');
            expect(versionState.publishedVersion?.id).toBe(versionId1);
        });

        it('should revert to version', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            await act(async () => {
                await result.current.revertTo(versionId2);
            });

            const versionState = result.current.getVersionState();
            expect(versionState.currentVersion?.id).toBe(versionId2);
            expect(versionState.currentVersion?.data.layout).toBe('two_column');
        });

        it('should delete version', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.getVersionState().versions).toHaveLength(2);

            await act(async () => {
                await result.current.delete(versionId2);
            });

            const versionState = result.current.getVersionState();
            expect(versionState.versions).toHaveLength(1);
            expect(versionState.getVersion(versionId2)).toBeUndefined();
        });
    });

    describe('Version Comparison', () => {
        it('should compare versions', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const comparison = await result.current.compare(versionId1, versionId2);

            expect(comparison).toBeDefined();
            expect(comparison.version1.id).toBe(versionId1);
            expect(comparison.version2.id).toBe(versionId2);
            expect(comparison.differences.layout).toBe(true);
            expect(comparison.differences.metadata).toBe(true);
            expect(comparison.differences.widgets).toBe(true);
        });

        it('should handle version comparison errors', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            await expect(
                result.current.compare('non-existent-1', 'non-existent-2')
            ).rejects.toThrow('One or both versions not found');
        });

        it('should provide detailed diff', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const diff = await result.current.getDiff(versionId1, versionId2);

            expect(diff.layout).toEqual({
                from: 'single_column',
                to: 'two_column'
            });

            expect(diff.metadata).toEqual({
                from: { description: 'Test page' },
                to: { description: 'Updated test page' }
            });

            expect(diff.widgets['widget-1'].config).toEqual({
                from: { content: 'Version 1 content' },
                to: { content: 'Version 2 content' }
            });
        });
    });

    describe('Version State', () => {
        it('should track version state', () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const versionState = result.current.getVersionState();

            expect(versionState.isDirty).toBe(false);
            expect(versionState.hasUnsavedChanges).toBe(false);
            expect(versionState.isLoading).toBe(false);
            expect(versionState.errors).toEqual({});
        });

        it('should handle version errors', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            await act(async () => {
                try {
                    await result.current.publish('non-existent');
                } catch (error) {
                    expect(error.code).toBe('VERSION_NOT_FOUND');
                }
            });

            const versionState = result.current.getVersionState();
            expect(versionState.hasErrors).toBe(true);
            expect(versionState.errors['VERSION_NOT_FOUND']).toBeDefined();
        });

        it('should validate version data', async () => {
            const { result } = renderHook(() => useVersionOperations(pageId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            const validationResult = await result.current.validate({
                layout: 'three_column',
                metadata: { description: 'Valid version' },
                widgets: {
                    'widget-1': {
                        id: 'widget-1',
                        config: { content: 'Valid content' }
                    }
                }
            });

            expect(validationResult.isValid).toBe(true);
            expect(validationResult.errors).toHaveLength(0);
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
                newVersionId = await result.current.create({
                    layout: 'three_column',
                    metadata: { description: 'New version' }
                });
            });

            expect(newVersionId).toBeDefined();

            // 2. Publish the new version
            await act(async () => {
                await result.current.publish(newVersionId);
            });

            let versionState = result.current.getVersionState();
            expect(versionState.getVersion(newVersionId)?.status).toBe('published');

            // 3. Compare with previous version
            const comparison = await result.current.compare(versionId1, newVersionId);
            expect(comparison.differences.layout).toBe(true);

            // 4. Revert to previous version
            await act(async () => {
                await result.current.revertTo(versionId1);
            });

            versionState = result.current.getVersionState();
            expect(versionState.currentVersion?.id).toBe(versionId1);

            // 5. Delete the new version
            await act(async () => {
                await result.current.delete(newVersionId);
            });

            versionState = result.current.getVersionState();
            expect(versionState.getVersion(newVersionId)).toBeUndefined();
        });
    });
});