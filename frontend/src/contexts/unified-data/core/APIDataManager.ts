import { DataManager } from './DataManager';
import { Operation } from '../types/operations';
import { executeAPIOperation, rollbackAPIOperation } from '../api/apiOperations';

/**
 * Enhanced DataManager with API integration
 * Extends the base DataManager to include backend API calls
 */
export class APIDataManager extends DataManager {
    private enableAPIIntegration: boolean = true;
    private optimisticUpdates: boolean = true;

    constructor(initialState?: any, options: { 
        enableAPIIntegration?: boolean;
        enableOptimisticUpdates?: boolean;
    } = {}) {
        super(initialState);
        this.enableAPIIntegration = options.enableAPIIntegration ?? true;
        this.optimisticUpdates = options.enableOptimisticUpdates ?? true;
    }

    /**
     * Enhanced operation processing with API integration
     */
    protected async processOperation(operation: Operation): Promise<void> {
        if (!this.enableAPIIntegration) {
            // Fall back to base implementation
            return super.processOperation(operation);
        }

        const previousState = { ...this.getState() };

        try {
            // Step 1: Optimistic update (update local state first)
            if (this.optimisticUpdates) {
                await super.processOperation(operation);
            }

            // Step 2: Execute API operation
            const apiResult = await executeAPIOperation(operation);

            if (!apiResult.success) {
                throw apiResult.error || new Error('API operation failed');
            }

            // Step 3: Update state with API response if needed
            if (apiResult.data && !this.optimisticUpdates) {
                // Non-optimistic: update state with API response
                await super.processOperation({
                    ...operation,
                    payload: {
                        ...operation.payload,
                        ...apiResult.data
                    }
                });
            } else if (apiResult.data) {
                // Optimistic: merge API response data if different
                this.mergeAPIResponse(operation, apiResult.data);
            }


        } catch (error) {
            console.error(`❌ API operation failed: ${operation.type}`, error);

            // Step 4: Handle API failure
            if (this.optimisticUpdates) {
                // Rollback optimistic update
                this.setState(() => previousState);
            }

            // Attempt API rollback if supported
            try {
                await rollbackAPIOperation(operation);
            } catch (rollbackError) {
                console.error('API rollback failed:', rollbackError);
            }

            // Just throw the error, error state is handled in UnifiedDataContext
            throw error;
        }
    }

    /**
     * Merge API response data with current state
     */
    private mergeAPIResponse(operation: Operation, apiData: any): void {
        switch (operation.type) {
            case 'CREATE_PAGE':
                if (apiData.id && apiData.id !== operation.payload.pageId) {
                    // Update with real page ID from backend
                    this.setState(state => {
                        const tempPage = state.pages[operation.payload.pageId];
                        if (!tempPage) return state;

                        const { [operation.payload.pageId]: _, ...otherPages } = state.pages;
                        
                        return {
                            pages: {
                                ...otherPages,
                                [apiData.id]: {
                                    ...tempPage,
                                    id: apiData.id,
                                    ...apiData
                                }
                            }
                        };
                    });
                }
                break;

            case 'CREATE_VERSION':
                if (apiData.id && apiData.id !== operation.payload.versionId) {
                    // Update with real version ID from backend
                    this.setState(state => {
                        const tempVersion = state.versions[operation.payload.versionId];
                        if (!tempVersion) return state;

                        const { [operation.payload.versionId]: _, ...otherVersions } = state.versions;
                        
                        return {
                            versions: {
                                ...otherVersions,
                                [apiData.id]: {
                                    ...tempVersion,
                                    id: apiData.id,
                                    ...apiData
                                }
                            }
                        };
                    });
                }
                break;

            // Add other operation types as needed
        }
    }

    /**
     * Enable/disable API integration
     */
    setAPIIntegration(enabled: boolean): void {
        this.enableAPIIntegration = enabled;
    }

    /**
     * Enable/disable optimistic updates
     */
    setOptimisticUpdates(enabled: boolean): void {
        this.optimisticUpdates = enabled;
    }

    /**
     * Get API integration status
     */
    getAPIStatus(): { apiIntegration: boolean; optimisticUpdates: boolean } {
        return {
            apiIntegration: this.enableAPIIntegration,
            optimisticUpdates: this.optimisticUpdates
        };
    }
}
