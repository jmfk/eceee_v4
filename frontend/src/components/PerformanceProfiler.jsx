import React, { Profiler } from 'react'

/**
 * Performance Profiler wrapper to track component render performance
 * Wraps components to measure render times and identify performance bottlenecks
 */

const PerformanceProfiler = ({
    id,
    children,
    onRender = null,
    logToConsole = true,
    threshold = 16.67 // 60fps threshold
}) => {
    const handleRender = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        // Log to console if enabled
        if (logToConsole) {
            const isSlowRender = actualDuration > threshold
            const logLevel = isSlowRender ? 'warn' : 'log'

            console[logLevel](
                `⚡ Profiler [${id}]:`,
                `${actualDuration.toFixed(2)}ms`,
                `(phase: ${phase})`,
                isSlowRender ? '🐌 SLOW' : '✅'
            )

            if (isSlowRender) {
                console.warn(`  Base duration: ${baseDuration.toFixed(2)}ms`)
                console.warn(`  This render was ${(actualDuration / threshold).toFixed(1)}x slower than 60fps`)
            }
        }

        // Track in global monitor if available
        if (window.renderMonitor) {
            window.renderMonitor.track(id, {}, actualDuration)
        }

        // Call custom onRender if provided
        if (onRender) {
            onRender(id, phase, actualDuration, baseDuration, startTime, commitTime)
        }
    }

    return (
        <Profiler id={id} onRender={handleRender}>
            {children}
        </Profiler>
    )
}

/**
 * Higher-order component to wrap any component with performance profiling
 */
export const withPerformanceProfiler = (Component, profileId) => {
    const WrappedComponent = (props) => (
        <PerformanceProfiler id={profileId || Component.displayName || Component.name}>
            <Component {...props} />
        </PerformanceProfiler>
    )

    WrappedComponent.displayName = `withProfiler(${Component.displayName || Component.name})`
    return WrappedComponent
}

export default PerformanceProfiler
