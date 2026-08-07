const HOVER_CLICK_WINDOW_MS = 2200

const textValue = (value) => {
    if (value === undefined || value === null) return ''
    return String(value).trim()
}

const uniqueEvents = (events = []) => {
    const seen = new Set()

    return events.filter(event => {
        const key = [
            event.kind,
            event.url || '',
            event.value || '',
            event.target?.selector || '',
            event.target?.role || '',
            event.target?.name || '',
            event.target?.text || '',
            event.timestamp || ''
        ].join('|')

        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export const actionPathFromUrl = (url = '', baseUrl = '') => {
    if (!url) return ''

    try {
        const parsedUrl = new URL(url)
        const parsedBaseUrl = baseUrl ? new URL(baseUrl) : null

        if (parsedBaseUrl && parsedUrl.origin !== parsedBaseUrl.origin) {
            return parsedUrl.toString()
        }

        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || '/'
    } catch {
        return url
    }
}

const selectorFromTarget = (target = {}) => {
    if (target.testId) return `[data-testid="${String(target.testId).replace(/"/g, '\\"')}"]`
    return textValue(target.selector)
}

export const actionTargetFromRecordedTarget = (target = {}) => {
    const selector = selectorFromTarget(target)
    const role = textValue(target.role)
    const name = textValue(target.name)
    const label = textValue(target.label)
    const placeholder = textValue(target.placeholder)
    const text = textValue(target.text)

    if (selector) return { targetMode: 'selector', selector }
    if (role && name) return { targetMode: 'role', role, name }
    if (label) return { targetMode: 'label', label }
    if (placeholder) return { targetMode: 'placeholder', placeholder }
    if (text) return { targetMode: 'text', text }

    return { targetMode: 'selector', selector: '' }
}

export const hoverClickTargetFromRecordedTarget = (target = {}) => {
    const selector = selectorFromTarget(target)
    const role = textValue(target.role)
    const name = textValue(target.name)
    const label = textValue(target.label)
    const text = textValue(target.text)

    if (selector) return { clickSelector: selector }
    if (role && name) return { clickRole: role, clickName: name }
    if (label) return { clickLabel: label }
    if (text) return { clickText: text }

    return { clickSelector: '' }
}

const isInputTarget = (target = {}) => ['input', 'textarea'].includes(String(target.tagName || '').toLowerCase())
const isSelectTarget = (target = {}) => String(target.tagName || '').toLowerCase() === 'select'

const sameTarget = (first = {}, second = {}) => {
    const firstSelector = selectorFromTarget(first)
    const secondSelector = selectorFromTarget(second)

    if (firstSelector && secondSelector) return firstSelector === secondSelector
    if (first.role && second.role && first.name && second.name) return first.role === second.role && first.name === second.name
    if (first.label && second.label) return first.label === second.label
    if (first.placeholder && second.placeholder) return first.placeholder === second.placeholder
    if (first.text && second.text) return first.text === second.text
    return false
}

const shouldCreateHoverClick = (hoverEvent, clickEvent) => {
    if (!hoverEvent || !clickEvent) return false
    if (!hoverEvent.target || !clickEvent.target) return false
    if (sameTarget(hoverEvent.target, clickEvent.target)) return false
    if (!Number.isFinite(Number(hoverEvent.timestamp)) || !Number.isFinite(Number(clickEvent.timestamp))) return false

    const elapsed = Number(clickEvent.timestamp) - Number(hoverEvent.timestamp)
    if (elapsed < 0 || elapsed > HOVER_CLICK_WINDOW_MS) return false

    const hoverTagName = String(hoverEvent.target.tagName || '').toLowerCase()
    if (['button', 'a', 'input', 'textarea', 'select', 'option'].includes(hoverTagName)) return false

    return true
}

const block = (action) => ({ caption: '', action })

export const convertRecordedEventsToScriptBlocks = (events = [], options = {}) => {
    const baseUrl = options.baseUrl || ''
    const orderedEvents = uniqueEvents(events)
        .filter(event => event && event.kind)
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
    const blocks = []
    let lastPath = ''
    let pendingInput = null
    let lastHover = null

    const flushInput = () => {
        if (!pendingInput) return

        const target = actionTargetFromRecordedTarget(pendingInput.target)
        const action = pendingInput.kind === 'select'
            ? {
                type: 'select',
                ...target,
                value: textValue(pendingInput.value || pendingInput.selectedValue || pendingInput.selectedLabel),
                holdMs: 500
            }
            : {
                type: 'fill',
                ...target,
                value: pendingInput.value || '',
                holdMs: 500
            }

        blocks.push(block(action))
        pendingInput = null
    }

    orderedEvents.forEach(event => {
        if (event.kind === 'navigation') {
            flushInput()
            const path = actionPathFromUrl(event.url, baseUrl)
            if (path && path !== lastPath && path !== 'about:blank') {
                blocks.push(block({ type: 'goto', path, holdMs: 450 }))
                lastPath = path
            }
            return
        }

        if (event.kind === 'hover') {
            lastHover = event
            return
        }

        if (event.kind === 'input' || event.kind === 'select') {
            if (pendingInput && !sameTarget(pendingInput.target, event.target)) flushInput()
            pendingInput = event.kind === 'select' || isSelectTarget(event.target)
                ? { ...event, kind: 'select' }
                : event
            return
        }

        if (event.kind === 'click') {
            flushInput()
            if (isInputTarget(event.target) || isSelectTarget(event.target)) return

            const hoverCandidate = event.hoverTarget
                ? { kind: 'hover', target: event.hoverTarget, timestamp: event.hoverTarget.timestamp || Number(event.timestamp || 0) - 1 }
                : lastHover

            if (shouldCreateHoverClick(hoverCandidate, event)) {
                blocks.push(block({
                    type: 'hoverClick',
                    ...actionTargetFromRecordedTarget(hoverCandidate.target),
                    ...hoverClickTargetFromRecordedTarget(event.target),
                    hoverHoldMs: 300,
                    holdMs: 500
                }))
                lastHover = null
                return
            }

            blocks.push(block({
                type: 'click',
                ...actionTargetFromRecordedTarget(event.target),
                holdMs: 500
            }))
        }
    })

    flushInput()

    return blocks
}
