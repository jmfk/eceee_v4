/**
 * Start Render Investigation - Comprehensive Re-render Detection
 * 
 * Import this in your main App.jsx or index.jsx to start monitoring
 */

import { initializeGlobalMonitor } from './renderInvestigationScript'

// Initialize the global monitor
const monitor = initializeGlobalMonitor()

// Add investigation commands to window for easy access
window.investigateRenders = {
    // Quick commands
    report: () => monitor.generateReport(),
    stats: () => monitor.getStats(),

    // Component-specific investigation
    checkComponent: (name) => {
        const stats = monitor.components.get(name)
        if (!stats) {
            console.warn(`Component "${name}" not found. Available:`, Array.from(monitor.components.keys()))
            return null
        }

        console.group(`🔍 ${name} Investigation`)
        console.log(`Renders: ${stats.renderCount}`)
        console.log(`Avg render time: ${stats.avgRenderTime.toFixed(2)}ms`)
        console.log(`Recent prop changes:`, stats.propChanges.slice(-5))
        console.groupEnd()
        return stats
    },

    // Find problem components
    findProblems: () => {
        const problems = Array.from(monitor.components.entries())
            .filter(([name, stats]) => stats.renderCount > 20)
            .sort((a, b) => b[1].renderCount - a[1].renderCount)

        console.group('🚨 Problematic Components (>20 renders)')
        problems.forEach(([name, stats]) => {
            console.error(`${name}: ${stats.renderCount} renders`)
        })
        console.groupEnd()
        return problems
    },

    // Performance analysis
    performance: () => {
        const allStats = Array.from(monitor.components.entries())
        const slowComponents = allStats.filter(([name, stats]) => stats.avgRenderTime > 16.67)

        console.group('🐌 Slow Components (>16.67ms avg)')
        slowComponents.forEach(([name, stats]) => {
            console.warn(`${name}: ${stats.avgRenderTime.toFixed(2)}ms average`)
        })
        console.groupEnd()

        return {
            totalComponents: allStats.length,
            slowComponents: slowComponents.length,
            totalRenders: monitor.totalRenders,
            avgRendersPerComponent: monitor.totalRenders / allStats.length
        }
    },

    // Reset monitoring
    reset: () => {
        monitor.components.clear()
        monitor.totalRenders = 0
        monitor.startTime = Date.now()
        console.log('🔄 Render monitoring reset')
    },

    // Export data for analysis
    exportData: () => {
        const data = {
            timestamp: new Date().toISOString(),
            totalRenders: monitor.totalRenders,
            elapsed: Date.now() - monitor.startTime,
            components: Object.fromEntries(monitor.components.entries())
        }

        console.log('📊 Render investigation data:', data)

        // Copy to clipboard if available
        if (navigator.clipboard) {
            navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                .then(() => console.log('📋 Data copied to clipboard'))
                .catch(() => console.log('❌ Failed to copy to clipboard'))
        }

        return data
    }
}

// Add helpful console message
console.log(`
🔍 RENDER INVESTIGATION ACTIVE

Available commands:
- investigateRenders.report()          - Generate full report
- investigateRenders.findProblems()    - Find components with >20 renders  
- investigateRenders.checkComponent('ContentWidget') - Check specific component
- investigateRenders.performance()     - Performance analysis
- investigateRenders.reset()           - Reset monitoring
- investigateRenders.exportData()      - Export data for analysis

React DevTools Profiler is also recommended for detailed analysis.
`)

export default monitor
