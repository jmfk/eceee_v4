export const ALWAYS_SHOW_EDITOR_CONTROLS_KEY = 'eceee.pageEditor.alwaysShowControls'

const resolveStorage = (storage) => {
    if (storage) {
        return storage
    }
    if (typeof window === 'undefined') {
        return null
    }
    return window.localStorage
}

export const readAlwaysShowEditorControls = (storage) => {
    try {
        return resolveStorage(storage)?.getItem(ALWAYS_SHOW_EDITOR_CONTROLS_KEY) !== 'false'
    } catch {
        return true
    }
}

export const writeAlwaysShowEditorControls = (value, storage) => {
    try {
        resolveStorage(storage)?.setItem(ALWAYS_SHOW_EDITOR_CONTROLS_KEY, String(Boolean(value)))
    } catch {
        // Storage can be unavailable in restricted browser contexts; keep the in-memory preference.
    }
}
