/**
 * Debug hooks for investigating React re-rendering issues
 * These hooks help identify why components are re-rendering frequently
 * 
 * TO TURN OFF DEBUG LOGGING:
 * Set DEBUG_ENABLED to false below to disable all console output from debug hooks
 * 
 * TO TURN ON DEBUG LOGGING:
 * Set DEBUG_ENABLED to true below to enable all debug console output
 */

import { useEffect, useRef } from 'react'

// Global debug flag - set to false to disable all debug logging
const DEBUG_ENABLED = false

/**
 * Hook to track component renders and log when they happen
 * @param {string} componentName - Name of the component for logging
 * @param {Object} props - Component props to track changes
 */
export const useRenderTracker = (componentName, props = {}) => {
    const renderCount = useRef(0)
    const prevProps = useRef()

    renderCount.current += 1

    useEffect(() => {
        if (!DEBUG_ENABLED) return

        console.log(`🔄 ${componentName} rendered #${renderCount.current}`)

        if (prevProps.current) {
            // Check which props changed
            const changedProps = Object.keys(props).filter(key => {
                const prevValue = prevProps.current[key]
                const currentValue = props[key]

                // Deep comparison for objects/arrays
                if (typeof prevValue === 'object' && typeof currentValue === 'object') {
                    return JSON.stringify(prevValue) !== JSON.stringify(currentValue)
                }

                return prevValue !== currentValue
            })

            if (changedProps.length > 0) {
                console.log(`  📝 Changed props:`, changedProps.map(key => ({
                    prop: key,
                    from: prevProps.current[key],
                    to: props[key]
                })))
            } else {
                console.log(`  ⚠️  No props changed - unnecessary re-render!`)
            }
        }

        prevProps.current = { ...props }
    })

    return renderCount.current
}

/**
 * Hook to track useEffect triggers and their dependencies
 * @param {string} effectName - Name/description of the effect
 * @param {Array} dependencies - Dependency array
 * @param {Function} callback - Optional callback to run when effect triggers
 */
export const useEffectTracker = (effectName, dependencies, callback) => {
    const prevDeps = useRef()
    const runCount = useRef(0)

    useEffect(() => {
        runCount.current += 1

        if (DEBUG_ENABLED) {
            if (prevDeps.current) {
                const changedDeps = dependencies.filter((dep, index) => {
                    const prevDep = prevDeps.current[index]

                    // Deep comparison for objects/arrays
                    if (typeof dep === 'object' && typeof prevDep === 'object') {
                        return JSON.stringify(dep) !== JSON.stringify(prevDep)
                    }

                    return dep !== prevDep
                })

                console.log(`⚡ useEffect "${effectName}" triggered #${runCount.current}`)
                if (changedDeps.length > 0) {
                    console.log(`  📊 Changed dependencies:`, changedDeps)
                } else {
                    console.log(`  ⚠️  No dependencies changed - check dependency array!`)
                }
            } else {
                console.log(`🚀 useEffect "${effectName}" initial run`)
            }
        }

        prevDeps.current = [...dependencies]

        if (callback) callback()
    }, dependencies)
}

/**
 * Hook to track when objects/arrays are being recreated unnecessarily
 * @param {any} value - Value to track
 * @param {string} name - Name for logging
 */
export const useStabilityTracker = (value, name) => {
    const prevValue = useRef()
    const changeCount = useRef(0)

    useEffect(() => {
        if (prevValue.current !== undefined) {
            const hasChanged = prevValue.current !== value
            const hasDeepChanged = JSON.stringify(prevValue.current) !== JSON.stringify(value)

            if (hasChanged) {
                changeCount.current += 1

                if (DEBUG_ENABLED) {
                    if (!hasDeepChanged) {
                        console.warn(`🔄 ${name} reference changed but content is the same (change #${changeCount.current})`)
                        console.log('  Previous:', prevValue.current)
                        console.log('  Current:', value)
                    } else {
                        console.log(`✅ ${name} legitimately changed (change #${changeCount.current})`)
                    }
                }
            }
        }

        prevValue.current = value
    })

    return changeCount.current
}

/**
 * Performance monitoring hook to track render times
 * @param {string} componentName - Name of component
 */
export const usePerformanceTracker = (componentName) => {
    const startTime = useRef()
    const renderTimes = useRef([])

    // Mark render start
    startTime.current = performance.now()

    useEffect(() => {
        if (!DEBUG_ENABLED) return

        const endTime = performance.now()
        const renderTime = endTime - startTime.current

        renderTimes.current.push(renderTime)

        // Keep only last 10 renders
        if (renderTimes.current.length > 10) {
            renderTimes.current.shift()
        }

        const avgTime = renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length

        if (renderTime > 16.67) { // Slower than 60fps
            console.warn(`🐌 ${componentName} slow render: ${renderTime.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`)
        } else {
            console.log(`⚡ ${componentName} render: ${renderTime.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`)
        }
    })
}

/**
 * Hook to detect memory leaks from excessive re-renders
 * @param {string} componentName - Name of component
 */
export const useMemoryLeakDetector = (componentName) => {
    const mountTime = useRef(Date.now())
    const renderCount = useRef(0)

    renderCount.current += 1

    useEffect(() => {
        if (!DEBUG_ENABLED) return

        const now = Date.now()
        const timeAlive = now - mountTime.current
        const rendersPerSecond = renderCount.current / (timeAlive / 1000)

        if (rendersPerSecond > 10) { // More than 10 renders per second
            console.error(`🚨 ${componentName} potential memory leak detected!`)
            console.log(`  Renders: ${renderCount.current} in ${timeAlive}ms`)
            console.log(`  Rate: ${rendersPerSecond.toFixed(2)} renders/second`)
        }
    })
}
