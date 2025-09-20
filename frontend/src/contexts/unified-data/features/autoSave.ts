import { Operation, OperationTypes } from '../types/operations';
import { AppState } from '../types/state';

/**
 * Auto-save system for UnifiedDataContext
 * Automatically saves changes at configurable intervals
 */

export interface AutoSaveConfig {
    enabled: boolean;
    interval: number; // milliseconds
    maxRetries: number;
    retryDelay: number; // milliseconds
    saveOnlyIfDirty: boolean;
    batchSimilarOperations: boolean;
    debounceDelay: number; // milliseconds
}

export interface AutoSaveState {
    isAutoSaving: boolean;
    lastSaveTime: string | null;
    nextSaveTime: string | null;
    saveCount: number;
    errorCount: number;
    lastError: Error | null;
}

export class AutoSaveManager {
    private config: AutoSaveConfig;
    private state: AutoSaveState;
    private saveTimer: NodeJS.Timeout | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private pendingOperations: Operation[] = [];
    private onSave?: (operations: Operation[]) => Promise<void>;
    private onError?: (error: Error) => void;

    constructor(
        config: Partial<AutoSaveConfig> = {},
        callbacks: {
            onSave?: (operations: Operation[]) => Promise<void>;
            onError?: (error: Error) => void;
        } = {}
    ) {
        this.config = {
            enabled: true,
            interval: 30000, // 30 seconds
            maxRetries: 3,
            retryDelay: 5000, // 5 seconds
            saveOnlyIfDirty: true,
            batchSimilarOperations: true,
            debounceDelay: 2000, // 2 seconds
            ...config
        };

        this.state = {
            isAutoSaving: false,
            lastSaveTime: null,
            nextSaveTime: null,
            saveCount: 0,
            errorCount: 0,
            lastError: null
        };

        this.onSave = callbacks.onSave;
        this.onError = callbacks.onError;

        if (this.config.enabled) {
            this.startAutoSave();
        }
    }

    /**
     * Start the auto-save timer
     */
    startAutoSave(): void {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
        }

        this.saveTimer = setInterval(() => {
            this.performAutoSave();
        }, this.config.interval);

        this.updateNextSaveTime();
        console.log(`🔄 Auto-save started (interval: ${this.config.interval}ms)`);
    }

    /**
     * Stop the auto-save timer
     */
    stopAutoSave(): void {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = null;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        this.state.nextSaveTime = null;
        console.log('⏹️ Auto-save stopped');
    }

    /**
     * Queue an operation for auto-save
     */
    queueOperation(operation: Operation): void {
        if (!this.config.enabled) return;

        this.pendingOperations.push(operation);

        // Debounce rapid changes
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.performAutoSave();
        }, this.config.debounceDelay);
    }

    /**
     * Perform auto-save operation
     */
    private async performAutoSave(): Promise<void> {
        if (this.state.isAutoSaving || this.pendingOperations.length === 0) {
            return;
        }

        if (this.config.saveOnlyIfDirty && this.pendingOperations.length === 0) {
            return;
        }

        this.state.isAutoSaving = true;

        try {
            console.log(`💾 Auto-save: Processing ${this.pendingOperations.length} operations`);

            // Batch similar operations if enabled
            const operationsToSave = this.config.batchSimilarOperations
                ? this.batchSimilarOperations(this.pendingOperations)
                : this.pendingOperations;

            // Execute save callback
            if (this.onSave) {
                await this.onSave(operationsToSave);
            }

            // Clear pending operations
            this.pendingOperations = [];

            // Update state
            this.state.saveCount++;
            this.state.lastSaveTime = new Date().toISOString();
            this.state.lastError = null;

            console.log(`✅ Auto-save completed (${operationsToSave.length} operations)`);

        } catch (error) {
            console.error('❌ Auto-save failed:', error);
            
            this.state.errorCount++;
            this.state.lastError = error as Error;

            if (this.onError) {
                this.onError(error as Error);
            }

            // Retry logic could be implemented here
        } finally {
            this.state.isAutoSaving = false;
            this.updateNextSaveTime();
        }
    }

    /**
     * Batch similar operations to reduce API calls
     */
    private batchSimilarOperations(operations: Operation[]): Operation[] {
        const batched: Operation[] = [];
        const widgetConfigUpdates: Record<string, any> = {};

        for (const operation of operations) {
            if (operation.type === OperationTypes.UPDATE_WIDGET_CONFIG) {
                // Batch widget config updates
                const widgetId = operation.payload.id;
                widgetConfigUpdates[widgetId] = {
                    ...widgetConfigUpdates[widgetId],
                    ...operation.payload.config
                };
            } else {
                // Keep other operations as-is
                batched.push(operation);
            }
        }

        // Add batched widget config updates
        Object.entries(widgetConfigUpdates).forEach(([widgetId, config]) => {
            batched.push({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: widgetId, config }
            });
        });

        return batched;
    }

    /**
     * Update next save time
     */
    private updateNextSaveTime(): void {
        if (this.config.enabled && this.saveTimer) {
            this.state.nextSaveTime = new Date(Date.now() + this.config.interval).toISOString();
        }
    }

    /**
     * Force an immediate save
     */
    async forceSave(): Promise<void> {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        await this.performAutoSave();
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<AutoSaveConfig>): void {
        const wasEnabled = this.config.enabled;
        this.config = { ...this.config, ...newConfig };

        if (this.config.enabled && !wasEnabled) {
            this.startAutoSave();
        } else if (!this.config.enabled && wasEnabled) {
            this.stopAutoSave();
        } else if (this.config.enabled) {
            // Restart with new interval
            this.startAutoSave();
        }
    }

    /**
     * Get current auto-save state
     */
    getState(): AutoSaveState {
        return { ...this.state };
    }

    /**
     * Get current configuration
     */
    getConfig(): AutoSaveConfig {
        return { ...this.config };
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.stopAutoSave();
        this.pendingOperations = [];
    }
}
