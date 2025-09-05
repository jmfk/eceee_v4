/**
 * Comprehensive re-render investigation utilities
 * Use these to identify performance bottlenecks and unnecessary re-renders
 */

/**
 * Create a global render monitor that tracks all component renders
 */
export const createGlobalRenderMonitor = () => {
    const renderStats = {
        totalRenders: 0,
        componentStats: new Map(),
        renderTimes: [],
        suspiciousPatterns: []
    }

    const startTime = Date.now()

    // Monitor function to be called by components
    const trackRender = (componentName, renderTime = 0) => {
        renderStats.totalRenders++

        if (!renderStats.componentStats.has(componentName)) {
            renderStats.componentStats.set(componentName, {
                count: 0,
                lastRender: 0,
                avgRenderTime: 0,
                totalTime: 0
            })
        }

        const stats = renderStats.componentStats.get(componentName)
        stats.count++
        stats.lastRender = Date.now()
        stats.totalTime += renderTime
        stats.avgRenderTime = stats.totalTime / stats.count

        // Detect suspicious patterns
        const now = Date.now()
        const timeSinceStart = now - startTime

        if (stats.count > 50 && timeSinceStart < 10000) { // More than 50 renders in 10 seconds
            const pattern = `${componentName}: ${stats.count} renders in ${timeSinceStart}ms`
            if (!renderStats.suspiciousPatterns.includes(pattern)) {
                renderStats.suspiciousPatterns.push(pattern)
                console.warn('🚨 Suspicious render pattern detected:', pattern)
            }
        }
    }

    // Generate report
    const generateReport = () => {
        console.group('🔍 Render Investigation Report')
        console.log(`Total renders: ${renderStats.totalRenders}`)
        console.log(`Time elapsed: ${Date.now() - startTime}ms`)

        console.group('📊 Component Stats (sorted by render count)')
        const sortedStats = Array.from(renderStats.componentStats.entries())
            .sort((a, b) => b[1].count - a[1].count)

        sortedStats.forEach(([name, stats]) => {
            console.log(`${name}: ${stats.count} renders (avg: ${stats.avgRenderTime.toFixed(2)}ms)`)
        })
        console.groupEnd()

        if (renderStats.suspiciousPatterns.length > 0) {
            console.group('⚠️  Suspicious Patterns')
            renderStats.suspiciousPatterns.forEach(pattern => console.warn(pattern))
            console.groupEnd()
        }

        console.groupEnd()
        return renderStats
    }

    // Auto-generate report every 30 seconds
    const reportInterval = setInterval(generateReport, 30000)

    return {
        trackRender,
        generateReport,
        getStats: () => renderStats,
        cleanup: () => clearInterval(reportInterval)
    }
}

/**
 * Add this to window for global access
 */
if (typeof window !== 'undefined') {
    window.renderMonitor = createGlobalRenderMonitor()
}

/**
 * Utility to detect object reference changes vs content changes
 */
export const analyzeObjectChanges = (obj1, obj2, name = 'object') => {
    const refChanged = obj1 !== obj2
    const contentChanged = JSON.stringify(obj1) !== JSON.stringify(obj2)

    if (refChanged && !contentChanged) {
        console.warn(`🔄 ${name}: Reference changed but content is identical`)
        console.log('This causes unnecessary re-renders!')
        return { refChanged, contentChanged, isUnnecessary: true }
    }

    return { refChanged, contentChanged, isUnnecessary: false }
}

/**
 * Hook to detect when props are causing unnecessary re-renders
 */
export const usePropChangeDetector = (props, componentName) => {
    const prevProps = React.useRef()

    React.useEffect(() => {
        if (prevProps.current) {
            Object.keys(props).forEach(key => {
                const analysis = analyzeObjectChanges(
                    prevProps.current[key],
                    props[key],
                    `${componentName}.${key}`
                )

                if (analysis.isUnnecessary) {
                    console.warn(`Unnecessary re-render in ${componentName} due to ${key}`)
                }
            })
        }
        prevProps.current = { ...props }
    })
}

/**
 * Advanced effect dependency analyzer
 */
export const analyzeEffectDependencies = (deps, effectName) => {
    const issues = []

    deps.forEach((dep, index) => {
        // Check for functions (should usually be memoized)
        if (typeof dep === 'function') {
            issues.push(`Dependency ${index} is a function - consider useCallback`)
        }

        // Check for objects/arrays (should usually be memoized)
        if (typeof dep === 'object' && dep !== null) {
            issues.push(`Dependency ${index} is an object/array - consider useMemo`)
        }
    })

    if (issues.length > 0) {
        console.warn(`⚠️  useEffect "${effectName}" dependency issues:`, issues)
    }

    return issues
}

export default {
    createGlobalRenderMonitor,
    analyzeObjectChanges,
    usePropChangeDetector,
    analyzeEffectDependencies
}
