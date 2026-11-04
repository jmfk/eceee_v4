const slotWarning = /^Slot '([^']+)' is not used by layout '[^']+' and its widgets will not appear publicly\. Convert this slot to '([^']+)' to show its widgets\.$/

export const slotConversionFromWarning = (warning) => {
    const match = String(warning).match(slotWarning)
    return match ? { from: match[1], to: match[2] } : null
}

export const convertSlotWidgets = (widgets, from, to) => {
    if (!widgets || from === to || !Array.isArray(widgets[from]) || !widgets[from].length || widgets[to]?.length) return null
    const next = { ...widgets, [to]: widgets[from] }
    delete next[from]
    return next
}
