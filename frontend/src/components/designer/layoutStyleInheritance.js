const hasStyleValue = (value) => value !== undefined && value !== null && value !== ''

const orderedStyleBreakpoints = (breakpoints = {}) => {
    const configured = Object.entries(breakpoints)
        .filter(([, minimum]) => Number.isFinite(Number(minimum)))
        .sort((left, right) => Number(left[1]) - Number(right[1]))
        .map(([key]) => key === 'xs' ? 'base' : key)
    return [...new Set(['base', ...configured])]
}

export const inheritedLayoutStyle = (node, field, activeBreakpoint, breakpoints) => {
    const activeKey = activeBreakpoint === 'xs' ? 'base' : activeBreakpoint
    const ordered = orderedStyleBreakpoints(breakpoints)
    const activeIndex = ordered.indexOf(activeKey)
    if (activeIndex <= 0) return null
    for (let index = activeIndex - 1; index >= 0; index -= 1) {
        const breakpoint = ordered[index]
        const value = node.styles?.[breakpoint]?.[field]
        if (hasStyleValue(value)) return { breakpoint, value }
    }
    return null
}
