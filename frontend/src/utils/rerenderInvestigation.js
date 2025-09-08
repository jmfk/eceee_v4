/**
 * Rerender Investigation Script
 * 
 * This script helps identify components that are rerendering excessively
 * Run this in the browser console to monitor component render patterns
 */

// Global render monitor
window.renderInvestigation = {
    components: new Map(),
    startTime: Date.now(),

    // Track component renders
    trackRender: function (componentName, props = {}) {
        if (!this.components.has(componentName)) {
            this.components.set(componentName, {
                renderCount: 0,
                firstRender: Date.now(),
                lastRender: Date.now(),
                propChanges: [],
                averageInterval: 0
            });
        }

        const component = this.components.get(componentName);
        const now = Date.now();

        component.renderCount++;
        const timeSinceLastRender = now - component.lastRender;
        component.lastRender = now;

        // Calculate average render interval
        const totalTime = now - component.firstRender;
        component.averageInterval = totalTime / component.renderCount;

        // Log excessive rendering
        if (component.renderCount > 10 && component.averageInterval < 1000) {
            console.warn(`🚨 ${componentName} is rendering frequently!`, {
                renderCount: component.renderCount,
                averageInterval: `${component.averageInterval.toFixed(2)}ms`,
                timeSinceLastRender: `${timeSinceLastRender}ms`
            });
        }

        return component.renderCount;
    },

    // Generate report
    generateReport: function () {
        console.log('📊 Render Investigation Report');
        console.log('==============================');

        const sortedComponents = Array.from(this.components.entries())
            .sort((a, b) => b[1].renderCount - a[1].renderCount);

        sortedComponents.forEach(([name, stats]) => {
            const isProblematic = stats.renderCount > 10 && stats.averageInterval < 1000;
            const emoji = isProblematic ? '🚨' : stats.renderCount > 5 ? '⚠️' : '✅';

            console.log(`${emoji} ${name}:`, {
                renders: stats.renderCount,
                avgInterval: `${stats.averageInterval.toFixed(2)}ms`,
                totalTime: `${((stats.lastRender - stats.firstRender) / 1000).toFixed(2)}s`
            });
        });

        // Memory usage check
        if (performance.memory) {
            console.log('\n💾 Memory Usage:');
            console.log({
                used: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
                total: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
                limit: `${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
            });
        }

        return sortedComponents;
    },

    // Reset monitoring
    reset: function () {
        this.components.clear();
        this.startTime = Date.now();
        console.log('🔄 Render investigation reset');
    },

    // Watch for memory leaks
    watchMemory: function () {
        if (!performance.memory) {
            console.warn('Memory API not available');
            return;
        }

        const initialMemory = performance.memory.usedJSHeapSize;
        let checkCount = 0;

        const memoryWatcher = setInterval(() => {
            checkCount++;
            const currentMemory = performance.memory.usedJSHeapSize;
            const memoryDiff = currentMemory - initialMemory;
            const memoryDiffMB = (memoryDiff / 1024 / 1024).toFixed(2);

            if (memoryDiff > 50 * 1024 * 1024) { // 50MB increase
                console.error(`🚨 Memory leak detected! +${memoryDiffMB}MB in ${checkCount * 5}s`);
            } else if (memoryDiff > 20 * 1024 * 1024) { // 20MB increase
                console.warn(`⚠️ Memory usage increased by ${memoryDiffMB}MB`);
            }

            // Stop watching after 5 minutes
            if (checkCount >= 60) {
                clearInterval(memoryWatcher);
                console.log('Memory watching stopped');
            }
        }, 5000);

        console.log('👁️ Started memory leak detection (5min duration)');
        return memoryWatcher;
    }
};

// Auto-start memory watching
window.renderInvestigation.watchMemory();

// Export for module use
export default window.renderInvestigation;

// Instructions
console.log(`
🔍 Render Investigation Tools Available:

1. Track renders in your components:
   useRenderTracker('ComponentName', props)

2. Generate report:
   renderInvestigation.generateReport()

3. Reset monitoring:
   renderInvestigation.reset()

4. Manual tracking:
   renderInvestigation.trackRender('ComponentName')

Debug mode is enabled. Check console for render warnings.
`);
