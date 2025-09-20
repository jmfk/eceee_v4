/**
 * Unified Data Context Hooks
 * 
 * This module exports all specialized hooks for working with the UnifiedDataContext.
 * Each hook provides a focused API for specific data operations and state management.
 */

// Core hooks
export { useUnifiedData } from '../context/UnifiedDataContext';

// Specialized operation hooks
export { useWidgetOperations } from './useWidgetOperations';
export { usePageOperations } from './usePageOperations';
export { useLayoutOperations } from './useLayoutOperations';
export { useVersionOperations } from './useVersionOperations';
export { usePageWidgets } from './usePageWidgets';

// Utility hooks
export { useBatchOperations } from './useBatchOperations';
export { useDataSubscriptions } from './useDataSubscriptions';

// Re-export types for convenience
export type { UseWidgetOperationsResult } from './useWidgetOperations';
export type { UsePageOperationsResult } from './usePageOperations';
export type { UseLayoutOperationsResult } from './useLayoutOperations';
export type { UseVersionOperationsResult } from './useVersionOperations';
export type { UsePageWidgetsResult } from './usePageWidgets';
export type { UseBatchOperationsResult } from './useBatchOperations';
export type { UseDataSubscriptionsResult } from './useDataSubscriptions';
