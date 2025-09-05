/**
 * Comprehensive Re-render Investigation Script
 * 
 * This script provides a complete toolkit for investigating React re-rendering issues.
 * Add this to any component to get detailed insights into rendering behavior.
 */

// Global render monitor (initialize once)
let globalMonitor = null

const initializeGlobalMonitor = () => {
    if (!globalMonitor && typeof window !== 'undefined') {
        globalMonitor = {
            components: new Map(),
            startTime: Date.now(),
            totalRenders: 0,

            track: (componentName, props = {}, renderTime = 0) => {
                globalMonitor.totalRenders++

                if (!globalMonitor.components.has(componentName)) {
                    globalMonitor.components.set(componentName, {
                        renderCount: 0,
                        lastRender: 0,
                        props: {},
                        propChanges: [],
                        avgRenderTime: 0,
                        totalRenderTime: 0
                    })
                }

                const stats = globalMonitor.components.get(componentName)
                stats.renderCount++
                stats.lastRender = Date.now()
                stats.totalRenderTime += renderTime
                stats.avgRenderTime = stats.totalRenderTime / stats.renderCount

                // Track prop changes
                if (Object.keys(stats.props).length > 0) {
                    const changedProps = Object.keys(props).filter(key => {
                        const oldVal = stats.props[key]
                        const newVal = props[key]

                        if (typeof oldVal === 'object' && typeof newVal === 'object') {
                            return JSON.stringify(oldVal) !== JSON.stringify(newVal)
                        }
                        return oldVal !== newVal
                    })

                    if (changedProps.length > 0) {
                        stats.propChanges.push({
                            timestamp: Date.now(),
                            changedProps,
                            renderCount: stats.renderCount
                        })
                    } else {
                        console.warn(`⚠️  ${componentName} re-rendered with no prop changes (render #${stats.renderCount})`)
                    }
                }

                stats.props = { ...props }

                // Alert for excessive renders
                if (stats.renderCount > 20 && stats.renderCount % 10 === 0) {
                    console.error(`🚨 ${componentName} has rendered ${stats.renderCount} times!`)
                }
            },

            generateReport: () => {
                console.group('🔍 COMPREHENSIVE RENDER INVESTIGATION REPORT')

                const elapsed = Date.now() - globalMonitor.startTime
                console.log(`⏱️  Time elapsed: ${elapsed}ms`)
                console.log(`🔄 Total renders: ${globalMonitor.totalRenders}`)
                console.log(`📊 Renders per second: ${(globalMonitor.totalRenders / (elapsed / 1000)).toFixed(2)}`)

                console.group('📈 Component Render Stats (sorted by count)')
                const sortedComponents = Array.from(globalMonitor.components.entries())
                    .sort((a, b) => b[1].renderCount - a[1].renderCount)

                sortedComponents.forEach(([name, stats]) => {
                    const style = stats.renderCount > 50 ? 'color: red; font-weight: bold' :
                        stats.renderCount > 20 ? 'color: orange' : 'color: green'

                    console.log(
                        `%c${name}: ${stats.renderCount} renders (avg: ${stats.avgRenderTime.toFixed(2)}ms)`,
                        style
                    )

                    if (stats.propChanges.length > 0) {
                        console.log(`  Recent prop changes:`, stats.propChanges.slice(-3))
                    }
                })
                console.groupEnd()

                // Find potential issues
                const problematicComponents = sortedComponents.filter(([, stats]) => stats.renderCount > 20)
                if (problematicComponents.length > 0) {
                    console.group('🚨 Potentially Problematic Components')
                    problematicComponents.forEach(([name, stats]) => {
                        console.error(`${name}: ${stats.renderCount} renders`)

                        // Analyze prop change patterns
                        const recentChanges = stats.propChanges.slice(-5)
                        if (recentChanges.length > 0) {
                            const commonProps = recentChanges
                                .flatMap(change => change.changedProps)
                                .reduce((acc, prop) => {
                                    acc[prop] = (acc[prop] || 0) + 1
                                    return acc
                                }, {})

                            console.log(`  Most frequently changing props:`, commonProps)
                        }
                    })
                    console.groupEnd()
                }

                console.groupEnd()
                return globalMonitor
            }
        }

        // Add to window for easy access
        window.renderMonitor = globalMonitor

        // Auto-report every 30 seconds
        setInterval(() => {
            if (globalMonitor.totalRenders > 0) {
                globalMonitor.generateReport()
            }
        }, 30000)
    }

    return globalMonitor
}

// Investigation commands to run in browser console
export const INVESTIGATION_COMMANDS = `
// === RENDER INVESTIGATION COMMANDS ===
// Run these in your browser console to investigate re-rendering:

// 1. Generate current render report
renderMonitor.generateReport()

// 2. Start monitoring a specific component
// (Add this to any component's render function)
renderMonitor.track('MyComponent', props)

// 3. Check React DevTools Profiler
// Open React DevTools > Profiler tab > Start profiling > Interact with page > Stop

// 4. Monitor prop stability
Object.keys(renderMonitor.components.get('ContentWidget')?.props || {}).forEach(prop => {
  console.log(prop + ':', typeof renderMonitor.components.get('ContentWidget').props[prop])
})

// 5. Check for memory leaks
setInterval(() => {
  const stats = renderMonitor.components.get('ContentWidget')
  if (stats && stats.renderCount > 100) {
    console.error('Potential memory leak in ContentWidget:', stats)
  }
}, 5000)

// 6. Monitor specific props
const monitorProp = (componentName, propName) => {
  const original = renderMonitor.track
  renderMonitor.track = (name, props, renderTime) => {
    if (name === componentName && props[propName] !== undefined) {
      console.log(\`🔍 \${componentName}.\${propName}:\`, props[propName])
    }
    return original(name, props, renderTime)
  }
}

// Usage: monitorProp('ContentWidget', 'config')
`

// Initialize on import
initializeGlobalMonitor()

export { initializeGlobalMonitor }
