/**
 * Unified Data Context Hooks
 * 
 * This module exports all specialized hooks for working with the UnifiedDataContext.
 * Each hook provides a focused API for specific data operations and state management.
 */

// Core hooks
export { useUnifiedData } from '../context/UnifiedDataContext';

// Specialized operation hooks
export { usePageOperations } from './usePageOperations';
export { useLayoutOperations } from './useLayoutOperations';
export { useVersionOperations } from './useVersionOperations';

// Utility hooks
export { useBatchOperations } from './useBatchOperations';
export { useDataSubscriptions } from './useDataSubscriptions';
export { useEditorContext } from './useEditorContext';

// Re-export types for convenience
export type { UsePageOperationsResult } from './usePageOperations';
export type { UseLayoutOperationsResult } from './useLayoutOperations';
export type { UseVersionOperationsResult } from './useVersionOperations';
export type { UseBatchOperationsResult } from './useBatchOperations';
export type { UseDataSubscriptionsResult } from './useDataSubscriptions';
