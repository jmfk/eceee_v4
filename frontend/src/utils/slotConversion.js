const slotWarning = /^Slot '([^']+)' is not used by layout '([^']+)' and its widgets will not appear publicly\. Convert this slot to '([^']+)' to show its widgets\.$/

export const slotConversionFromWarning = (warning) => {
    const match = String(warning).match(slotWarning)
    return match ? { from: match[1], layout: match[2], to: match[3] } : null
}

export const ignoredSlotWarningKey = ({ from, layout }) => `${layout}:${from}`

export const convertSlotWidgets = (widgets, from, to) => {
    if (!widgets || from === to || !Array.isArray(widgets[from])) return null
    const next = { ...widgets }
    if (!Array.isArray(widgets[to]) || !widgets[to].length) next[to] = widgets[from]
    delete next[from]
    return next
}

export const applySlotWarningChoices = (widgets, ignoredKeys, items, choices) => {
    let nextWidgets = widgets
    const ignored = new Set(ignoredKeys)
    for (const item of items) {
        const choice = choices[item.id]
        if (choice === 'convert') {
            if (!item.slotConversion) return null
            const converted = convertSlotWidgets(nextWidgets, item.slotConversion.from, item.slotConversion.to)
            if (!converted) return null
            nextWidgets = converted
            ignored.delete(ignoredSlotWarningKey(item.slotConversion))
        } else if (choice === 'ignore' && item.slotConversion) {
            ignored.add(ignoredSlotWarningKey(item.slotConversion))
        }
    }
    return { widgets: nextWidgets, ignoredSlotWarnings: [...ignored] }
}
