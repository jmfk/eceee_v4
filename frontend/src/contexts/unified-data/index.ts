/**
 * Unified Data Context
 * 
 * A comprehensive data management system that provides:
 * - Centralized state management
 * - Type-safe operations
 * - Flexible subscription system
 * - Specialized hooks for common operations
 * - Performance optimizations
 * - Error handling and validation
 */

// Core context and provider
export { UnifiedDataProvider, useUnifiedData } from './context/UnifiedDataContext';

// All specialized hooks
export * from './hooks';

// Core types
export type { AppState, StateSelector, StateUpdate } from './types/state';
export type { Operation, OperationTypes } from './types/operations';
export type { SubscriptionOptions, StateUpdateCallback } from './types/subscriptions';
export type { UnifiedDataContextValue, UnifiedDataProviderProps } from './types/context';

// Utility functions
export { defaultEqualityFn, shallowEqual, deepEqual } from './utils/equality';

// Error types and utilities
export { OperationError, ValidationError, StateError, ErrorCodes } from './utils/errors';
