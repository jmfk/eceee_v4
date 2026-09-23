const CLIENT_APP_VERSION = import.meta.env.VITE_GIT_COMMIT_HASH || ''
const RELOAD_MARKER = 'eceee:last-app-version-reload'
export const APP_VERSION_RELOAD_RETRY_MS = 60_000
export const APP_VERSION_MISMATCH_EVENT = 'eceee:app-version-mismatch'

let pendingServerVersion = null

export const shouldReloadForAppVersion = (
    serverVersion,
    clientVersion = CLIENT_APP_VERSION,
    lastReloadAttempt = null,
    now = Date.now(),
) => Boolean(
    serverVersion
    && clientVersion
    && serverVersion !== 'unknown'
    && clientVersion !== 'unknown'
    && serverVersion !== clientVersion
    && !(
        serverVersion === lastReloadAttempt?.version
        && now - lastReloadAttempt.attemptedAt < APP_VERSION_RELOAD_RETRY_MS
    )
)

const readReloadAttempt = () => {
    const stored = window.sessionStorage.getItem(RELOAD_MARKER)
    if (!stored) return null
    try {
        return JSON.parse(stored)
    } catch {
        return { version: stored, attemptedAt: 0 }
    }
}

export const reloadForAppVersion = (serverVersion) => {
    if (!shouldReloadForAppVersion(
        serverVersion,
        CLIENT_APP_VERSION,
        readReloadAttempt(),
    )) {
        if (serverVersion && serverVersion === CLIENT_APP_VERSION) {
            window.sessionStorage.removeItem(RELOAD_MARKER)
        }
        return false
    }

    const mismatchEvent = new CustomEvent(APP_VERSION_MISMATCH_EVENT, {
        cancelable: true,
        detail: { serverVersion },
    })
    if (!window.dispatchEvent(mismatchEvent)) {
        pendingServerVersion = serverVersion
        return false
    }

    pendingServerVersion = null
    window.sessionStorage.setItem(RELOAD_MARKER, JSON.stringify({
        version: serverVersion,
        attemptedAt: Date.now(),
    }))
    window.location.reload()
    return true
}

export const resumePendingAppVersionReload = () => {
    if (!pendingServerVersion) return false
    return reloadForAppVersion(pendingServerVersion)
}

export const inspectAppVersionResponse = (response) => {
    const serverVersion = response?.headers?.['x-app-version']
    return reloadForAppVersion(serverVersion)
}

let versionCheckPromise = null

export const checkApplicationVersion = async () => {
    if (!CLIENT_APP_VERSION || CLIENT_APP_VERSION === 'unknown') return false
    if (versionCheckPromise) return versionCheckPromise

    versionCheckPromise = fetch('/api/v1/app-version/', {
        credentials: 'include',
        cache: 'no-store',
    })
        .then(response => response.ok ? response.json() : null)
        .then(data => reloadForAppVersion(data?.version))
        .catch(() => false)
        .finally(() => {
            versionCheckPromise = null
        })

    return versionCheckPromise
}

export const startApplicationVersionMonitor = () => {
    if (typeof window === 'undefined' || !CLIENT_APP_VERSION || CLIENT_APP_VERSION === 'unknown') return
    window.addEventListener('focus', checkApplicationVersion)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkApplicationVersion()
    })
}
