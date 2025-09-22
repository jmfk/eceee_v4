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
export { useObjectData } from './useObjectData';
export { useFormData } from './useFormData';

// Utility hooks
export { useBatchOperations } from './useBatchOperations';
export { useDataSubscriptions } from './useDataSubscriptions';
export { useDataLoader } from './useDataLoader';
export { useWidgetSync } from './useWidgetSync';
export { useAPIIntegration } from './useAPIIntegration';
export { useAutoSave } from './useAutoSave';
export { useValidation } from './useValidation';
// usePerformanceMonitor removed with DevTools
// useDevTools removed to simplify the system

// Re-export types for convenience
export type { UseWidgetOperationsResult } from './useWidgetOperations';
export type { UsePageOperationsResult } from './usePageOperations';
export type { UseLayoutOperationsResult } from './useLayoutOperations';
export type { UseVersionOperationsResult } from './useVersionOperations';
export type { UsePageWidgetsResult } from './usePageWidgets';
export type { UseObjectDataResult } from './useObjectData';
export type { UseFormDataResult } from './useFormData';
export type { UseBatchOperationsResult } from './useBatchOperations';
export type { UseDataSubscriptionsResult } from './useDataSubscriptions';
