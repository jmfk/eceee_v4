import { Operation } from '../types/operations';
import { AppState } from '../types/state';

/**
 * Performance Profiler for UnifiedDataContext
 * Provides detailed performance analysis and optimization suggestions
 */

export interface PerformanceProfile {
    operationId: string;
    operationType: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    memoryBefore?: number;
    memoryAfter?: number;
    memoryDelta?: number;
    stateSizeBefore: number;
    stateSizeAfter?: number;
    stateSizeDelta?: number;
    subscriptionCount: number;
    stackTrace?: string;
}

export interface PerformanceReport {
    totalOperations: number;
    averageOperationTime: number;
    slowestOperations: PerformanceProfile[];
    memoryLeaks: PerformanceProfile[];
    heavyStateOperations: PerformanceProfile[];
    recommendations: string[];
    score: number; // 0-100
}

export class PerformanceProfiler {
    private profiles: Map<string, PerformanceProfile> = new Map();
    private isEnabled: boolean = true;
    private maxProfiles: number = 1000;

    constructor(config: { enabled?: boolean; maxProfiles?: number } = {}) {
        this.isEnabled = config.enabled ?? true;
        this.maxProfiles = config.maxProfiles ?? 1000;
    }

    /**
     * Start profiling an operation
     */
    startProfiling(operation: Operation, state: AppState, subscriptionCount: number = 0): string {
        if (!this.isEnabled) return '';

        const profileId = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const profile: PerformanceProfile = {
            operationId: profileId,
            operationType: operation.type,
            startTime: performance.now(),
            memoryBefore: this.getMemoryUsage(),
            stateSizeBefore: this.calculateStateSize(state),
            subscriptionCount,
            stackTrace: new Error().stack
        };

        this.profiles.set(profileId, profile);
        return profileId;
    }

    /**
     * End profiling an operation
     */
    endProfiling(profileId: string, state: AppState): PerformanceProfile | null {
        if (!this.isEnabled || !profileId) return null;

        const profile = this.profiles.get(profileId);
        if (!profile) return null;

        profile.endTime = performance.now();
        profile.duration = profile.endTime - profile.startTime;
        profile.memoryAfter = this.getMemoryUsage();
        profile.memoryDelta = (profile.memoryAfter || 0) - (profile.memoryBefore || 0);
        profile.stateSizeAfter = this.calculateStateSize(state);
        profile.stateSizeDelta = profile.stateSizeAfter - profile.stateSizeBefore;

        // Maintain max profiles
        if (this.profiles.size > this.maxProfiles) {
            const oldestKey = this.profiles.keys().next().value;
            this.profiles.delete(oldestKey);
        }

        // Log performance warnings
        this.checkPerformanceWarnings(profile);

        return profile;
    }

    /**
     * Generate performance report
     */
    generateReport(): PerformanceReport {
        const profiles = Array.from(this.profiles.values()).filter(p => p.duration !== undefined);
        
        if (profiles.length === 0) {
            return {
                totalOperations: 0,
                averageOperationTime: 0,
                slowestOperations: [],
                memoryLeaks: [],
                heavyStateOperations: [],
                recommendations: ['No performance data available'],
                score: 100
            };
        }

        const totalOperations = profiles.length;
        const averageOperationTime = profiles.reduce((sum, p) => sum + (p.duration || 0), 0) / totalOperations;

        // Find slowest operations (>100ms)
        const slowestOperations = profiles
            .filter(p => (p.duration || 0) > 100)
            .sort((a, b) => (b.duration || 0) - (a.duration || 0))
            .slice(0, 10);

        // Find potential memory leaks (memory increase >1MB)
        const memoryLeaks = profiles
            .filter(p => (p.memoryDelta || 0) > 1000000)
            .sort((a, b) => (b.memoryDelta || 0) - (a.memoryDelta || 0))
            .slice(0, 10);

        // Find operations that significantly increase state size
        const heavyStateOperations = profiles
            .filter(p => (p.stateSizeDelta || 0) > 100000) // >100KB increase
            .sort((a, b) => (b.stateSizeDelta || 0) - (a.stateSizeDelta || 0))
            .slice(0, 10);

        // Generate recommendations
        const recommendations = this.generateRecommendations({
            averageOperationTime,
            slowestOperations,
            memoryLeaks,
            heavyStateOperations,
            totalOperations
        });

        // Calculate performance score
        const score = this.calculatePerformanceScore({
            averageOperationTime,
            slowOperationCount: slowestOperations.length,
            memoryLeakCount: memoryLeaks.length,
            heavyStateOperationCount: heavyStateOperations.length
        });

        return {
            totalOperations,
            averageOperationTime,
            slowestOperations,
            memoryLeaks,
            heavyStateOperations,
            recommendations,
            score
        };
    }

    /**
     * Get memory usage (if available)
     */
    private getMemoryUsage(): number | undefined {
        if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
        }
        return undefined;
    }

    /**
     * Calculate state size in bytes
     */
    private calculateStateSize(state: AppState): number {
        return JSON.stringify(state).length;
    }

    /**
     * Check for performance warnings
     */
    private checkPerformanceWarnings(profile: PerformanceProfile): void {
        if ((profile.duration || 0) > 500) {
            console.warn(`⚠️ Slow operation detected: ${profile.operationType} took ${profile.duration}ms`);
        }

        if ((profile.memoryDelta || 0) > 5000000) { // 5MB
            console.warn(`⚠️ Memory increase detected: ${profile.operationType} increased memory by ${(profile.memoryDelta || 0) / 1000000}MB`);
        }

        if ((profile.stateSizeDelta || 0) > 500000) { // 500KB
            console.warn(`⚠️ Large state increase: ${profile.operationType} increased state size by ${(profile.stateSizeDelta || 0) / 1000}KB`);
        }
    }

    /**
     * Generate performance recommendations
     */
    private generateRecommendations(data: {
        averageOperationTime: number;
        slowestOperations: PerformanceProfile[];
        memoryLeaks: PerformanceProfile[];
        heavyStateOperations: PerformanceProfile[];
        totalOperations: number;
    }): string[] {
        const recommendations: string[] = [];

        if (data.averageOperationTime > 50) {
            recommendations.push('Average operation time is high - consider implementing operation batching');
        }

        if (data.slowestOperations.length > 0) {
            const slowTypes = [...new Set(data.slowestOperations.map(op => op.operationType))];
            recommendations.push(`Optimize slow operations: ${slowTypes.join(', ')}`);
        }

        if (data.memoryLeaks.length > 0) {
            recommendations.push('Potential memory leaks detected - review subscription cleanup and object references');
        }

        if (data.heavyStateOperations.length > 0) {
            recommendations.push('Some operations significantly increase state size - consider data normalization');
        }

        if (data.totalOperations > 1000) {
            recommendations.push('High operation count - implement operation debouncing or batching');
        }

        return recommendations;
    }

    /**
     * Calculate performance score
     */
    private calculatePerformanceScore(data: {
        averageOperationTime: number;
        slowOperationCount: number;
        memoryLeakCount: number;
        heavyStateOperationCount: number;
    }): number {
        let score = 100;

        // Deduct for slow average time
        if (data.averageOperationTime > 50) {
            score -= Math.min((data.averageOperationTime - 50) / 10, 20);
        }

        // Deduct for slow operations
        score -= Math.min(data.slowOperationCount * 5, 25);

        // Deduct for memory leaks
        score -= Math.min(data.memoryLeakCount * 10, 30);

        // Deduct for heavy state operations
        score -= Math.min(data.heavyStateOperationCount * 3, 15);

        return Math.max(Math.round(score), 0);
    }

    /**
     * Get all profiles
     */
    getProfiles(): PerformanceProfile[] {
        return Array.from(this.profiles.values());
    }

    /**
     * Clear all profiles
     */
    clearProfiles(): void {
        this.profiles.clear();
        console.log('🧹 Performance profiles cleared');
    }

    /**
     * Enable/disable profiling
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        console.log(`📊 Performance profiling ${enabled ? 'enabled' : 'disabled'}`);
    }
}
