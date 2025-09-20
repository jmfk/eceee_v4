import { Operation } from '../types/operations';
import { PageData, WidgetData, LayoutData, VersionData } from '../types/state';
import { pagesApi, layoutsApi, versionsApi } from '../../../api';

/**
 * API operation handlers that connect UnifiedDataContext operations to backend APIs
 */

export interface APIOperationResult<T = any> {
    success: boolean;
    data?: T;
    error?: Error;
    shouldRollback?: boolean;
}

export interface APIOperationHandler {
    execute: (operation: Operation) => Promise<APIOperationResult>;
    rollback?: (operation: Operation) => Promise<void>;
}

/**
 * Page API operations
 */
export const pageAPIOperations: Record<string, APIOperationHandler> = {
    CREATE_PAGE: {
        execute: async (operation) => {
            try {
                const response = await pagesApi.create({
                    title: operation.payload.title,
                    slug: operation.payload.slug,
                    description: operation.payload.metadata?.description,
                    layout: operation.payload.layout,
                    status: 'draft'
                });

                return {
                    success: true,
                    data: response
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    UPDATE_PAGE: {
        execute: async (operation) => {
            try {
                const response = await pagesApi.update(
                    operation.payload.pageId,
                    operation.payload.updates
                );

                return {
                    success: true,
                    data: response
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    UPDATE_PAGE_METADATA: {
        execute: async (operation) => {
            try {
                const response = await pagesApi.updateMetadata(
                    operation.payload.pageId,
                    operation.payload.metadata
                );

                return {
                    success: true,
                    data: response
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    DELETE_PAGE: {
        execute: async (operation) => {
            try {
                await pagesApi.delete(operation.payload.pageId);

                return {
                    success: true
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    PUBLISH_PAGE: {
        execute: async (operation) => {
            try {
                const response = await pagesApi.publish(operation.payload.pageId);

                return {
                    success: true,
                    data: response
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    DUPLICATE_PAGE: {
        execute: async (operation) => {
            try {
                const response = await pagesApi.duplicate(
                    operation.payload.pageId,
                    {
                        newSlug: operation.payload.newSlug,
                        title: operation.payload.title
                    }
                );

                return {
                    success: true,
                    data: response
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    }
};

/**
 * Widget API operations
 */
export const widgetAPIOperations: Record<string, APIOperationHandler> = {
    ADD_WIDGET: {
        execute: async (operation) => {
            try {
                // Widget creation might be handled through version updates
                // For now, we'll track it as a state-only operation
                return {
                    success: true,
                    data: { widgetId: operation.payload.widgetId }
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    UPDATE_WIDGET_CONFIG: {
        execute: async (operation) => {
            try {
                // Widget updates are typically saved as part of page versions
                // This could trigger an auto-save or be batched
                return {
                    success: true,
                    data: { widgetId: operation.payload.id }
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: false // Don't rollback config changes immediately
                };
            }
        }
    },

    SAVE_WIDGET: {
        execute: async (operation) => {
            try {
                // This would trigger a version save or page save
                // Implementation depends on the specific save strategy
                return {
                    success: true
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    }
};

/**
 * Version API operations
 */
export const versionAPIOperations: Record<string, APIOperationHandler> = {
    CREATE_VERSION: {
        execute: async (operation) => {
            try {
                const response = await versionsApi.create(
                    operation.payload.pageId,
                    {
                        data: operation.payload.data,
                        description: operation.payload.description
                    }
                );

                return {
                    success: true,
                    data: response
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    PUBLISH_VERSION: {
        execute: async (operation) => {
            try {
                const response = await versionsApi.publish(
                    operation.payload.pageId,
                    operation.payload.versionId
                );

                return {
                    success: true,
                    data: response
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    DELETE_VERSION: {
        execute: async (operation) => {
            try {
                await versionsApi.delete(operation.payload.versionId);

                return {
                    success: true
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    }
};

/**
 * Layout API operations
 */
export const layoutAPIOperations: Record<string, APIOperationHandler> = {
    CREATE_LAYOUT: {
        execute: async (operation) => {
            try {
                const response = await layoutsApi.create({
                    name: operation.payload.name,
                    slots: operation.payload.slots,
                    theme: operation.payload.theme,
                    metadata: operation.payload.metadata
                });

                return {
                    success: true,
                    data: response
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    UPDATE_LAYOUT: {
        execute: async (operation) => {
            try {
                const response = await layoutsApi.update(
                    operation.payload.layoutId,
                    operation.payload.updates
                );

                return {
                    success: true,
                    data: response
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    },

    DELETE_LAYOUT: {
        execute: async (operation) => {
            try {
                await layoutsApi.delete(operation.payload.layoutId);

                return {
                    success: true
                };
            } catch (error) {
                return {
                    success: false,
                    error: error as Error,
                    shouldRollback: true
                };
            }
        }
    }
};

/**
 * Combined API operations registry
 */
export const apiOperations = {
    ...pageAPIOperations,
    ...widgetAPIOperations,
    ...versionAPIOperations,
    ...layoutAPIOperations
};

/**
 * Execute API operation for a given operation type
 */
export async function executeAPIOperation(operation: Operation): Promise<APIOperationResult> {
    const handler = apiOperations[operation.type];
    
    if (!handler) {
        // No API handler for this operation type - treat as state-only
        return {
            success: true,
            data: null
        };
    }

    try {
        const result = await handler.execute(operation);
        return result;
    } catch (error) {
        return {
            success: false,
            error: error as Error,
            shouldRollback: true
        };
    }
}

/**
 * Rollback API operation if supported
 */
export async function rollbackAPIOperation(operation: Operation): Promise<void> {
    const handler = apiOperations[operation.type];
    
    if (handler?.rollback) {
        try {
            await handler.rollback(operation);
        } catch (error) {
            console.error('Failed to rollback API operation:', error);
        }
    }
}
