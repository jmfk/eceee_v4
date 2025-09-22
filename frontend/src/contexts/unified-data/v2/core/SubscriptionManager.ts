import { PathString, parsePath, isParentPath, getAncestorPaths } from '../types/paths';

export type Subscriber = {
    id: string;
    callback: (value: any) => void;
    options?: SubscriptionOptions;
};

export type SubscriptionOptions = {
    // If true, include updates to child paths
    includeChildren?: boolean;
    // Custom equality function for update detection
    equalityFn?: (prev: any, next: any) => boolean;
    // Debounce time in ms (0 for immediate)
    debounceTime?: number;
};

export class SubscriptionManager {
    private subscriptions = new Map<PathString, Map<string, Subscriber>>();
    private debouncedUpdates = new Map<string, NodeJS.Timeout>();

    /**
     * Subscribe to updates at a specific path
     */
    subscribe(
        path: PathString,
        callback: (value: any) => void,
        options: SubscriptionOptions = {}
    ): string {
        const subscriberId = Math.random().toString(36).substr(2, 9);
        
        if (!this.subscriptions.has(path)) {
            this.subscriptions.set(path, new Map());
        }
        
        this.subscriptions.get(path)!.set(subscriberId, {
            id: subscriberId,
            callback,
            options
        });

        return subscriberId;
    }

    /**
     * Unsubscribe using the subscription ID
     */
    unsubscribe(subscriberId: string): void {
        for (const [path, subscribers] of this.subscriptions) {
            if (subscribers.delete(subscriberId)) {
                if (subscribers.size === 0) {
                    this.subscriptions.delete(path);
                }
                break;
            }
        }

        // Clear any pending debounced updates
        if (this.debouncedUpdates.has(subscriberId)) {
            clearTimeout(this.debouncedUpdates.get(subscriberId)!);
            this.debouncedUpdates.delete(subscriberId);
        }
    }

    /**
     * Notify subscribers of an update at a specific path
     */
    notify(path: PathString, value: any): void {
        // Get all affected paths (including ancestors if they have includeChildren: true)
        const affectedPaths = new Set([path, ...getAncestorPaths(path)]);

        // Notify all relevant subscribers
        for (const [subscriberPath, subscribers] of this.subscriptions) {
            if (!affectedPaths.has(subscriberPath) && 
                !this.shouldNotifyParent(subscriberPath, path)) {
                continue;
            }

            for (const [id, subscriber] of subscribers) {
                this.notifySubscriber(subscriber, value);
            }
        }
    }

    /**
     * Check if a subscriber at parentPath should be notified of changes at childPath
     */
    private shouldNotifyParent(parentPath: PathString, childPath: PathString): boolean {
        const subscribers = this.subscriptions.get(parentPath);
        if (!subscribers) return false;

        // Check if any subscriber at this path has includeChildren: true
        for (const [_, subscriber] of subscribers) {
            if (subscriber.options?.includeChildren && isParentPath(parentPath, childPath)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Notify a single subscriber, handling debouncing if configured
     */
    private notifySubscriber(subscriber: Subscriber, value: any): void {
        const { id, callback, options } = subscriber;
        
        // Clear any existing debounced update
        if (this.debouncedUpdates.has(id)) {
            clearTimeout(this.debouncedUpdates.get(id)!);
            this.debouncedUpdates.delete(id);
        }

        // Handle debouncing if configured
        if (options?.debounceTime) {
            const timeout = setTimeout(() => {
                callback(value);
                this.debouncedUpdates.delete(id);
            }, options.debounceTime);
            
            this.debouncedUpdates.set(id, timeout);
        } else {
            // Immediate notification
            callback(value);
        }
    }

    /**
     * Clean up all subscriptions
     */
    destroy(): void {
        // Clear all debounced updates
        for (const timeout of this.debouncedUpdates.values()) {
            clearTimeout(timeout);
        }
        this.debouncedUpdates.clear();

        // Clear all subscriptions
        this.subscriptions.clear();
    }
}
