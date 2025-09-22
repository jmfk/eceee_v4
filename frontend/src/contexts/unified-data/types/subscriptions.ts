/**
 * Subscription types for the Unified Data Context
 */

import { AppState, StateSelector } from './state';
import { Operation } from './operations';

/**
 * Callback types for different subscription scenarios
 */
export type StateUpdateCallback<T = any> = (newValue: T, operation: Operation) => void;
export type OperationCallback = (operation: Operation) => void;
export type ErrorCallback = (error: Error) => void;

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  // If true, callback is called immediately with current state
  immediate?: boolean;
  // Custom equality function for state comparison
  equalityFn?: (a: any, b: any) => boolean;
  // Error handling
  onError?: ErrorCallback;
  // Component ID for filtering updates
  componentId?: string;
}

/**
 * Subscription interface
 */
export interface Subscription<T = any> {
  id: string;
  selector: StateSelector<T>;
  callback: StateUpdateCallback<T>;
  options: SubscriptionOptions;
  lastValue?: T;
}

/**
 * Operation subscription interface
 */
export interface OperationSubscription {
  id: string;
  operationType?: string | string[];
  callback: OperationCallback;
  options?: SubscriptionOptions;
}

/**
 * Unsubscribe function type
 */
export type Unsubscribe = () => void;

/**
 * Subscription manager interface
 */
export interface SubscriptionManager {
  // State subscriptions
  subscribe: <T>(
    selector: StateSelector<T>,
    callback: (value: T, operation?: Operation) => void,
    options?: SubscriptionOptions
  ) => Unsubscribe;
  
  // Operation subscriptions
  subscribeToOperations: (
    callback: OperationCallback,
    operationType?: string | string[],
    options?: SubscriptionOptions
  ) => Unsubscribe;
  
  // Notify subscribers
  notifyStateUpdate: (state: AppState, operation?: Operation) => void;
  notifyOperation: (operation: Operation) => void;
  
  // Cleanup
  clearAllSubscriptions: () => void;
}

/**
 * Default equality function
 */
export const defaultEqualityFn = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => defaultEqualityFn(item, b[index]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return (
      keysA.length === keysB.length &&
      keysA.every(key => defaultEqualityFn(a[key], b[key]))
    );
  }
  return false;
};
