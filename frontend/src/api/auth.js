// Keep allauth's published snake_case contract at this boundary.
const BASE = '/_allauth/browser/v1'

export const safeDestination = (value, fallback = '/') => {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin && !url.pathname.startsWith('/login') ? `${url.pathname}${url.search}${url.hash}` : fallback
}

export const clearLegacyTokens = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
}

export async function authRequest(path, { method = 'GET', data, headers = {} } = {}) {
    if (method !== 'GET') {
        // Django rotates the CSRF secret at login. Fetch a fresh masked token
        // instead of caching one across login, logout or OAuth callbacks.
        const csrf = await fetch('/csrf-token/', { credentials: 'same-origin', cache: 'no-store' })
        if (!csrf.ok) throw new Error('Could not prepare secure sign-in. Please try again.')
        headers = { ...headers, 'X-CSRFToken': (await csrf.json()).csrfToken }
    }
    const response = await fetch(`${BASE}${path}`, {
        method, credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    })
    const result = await response.json().catch(() => ({ errors: [{ message: 'The server could not complete this request. Please try again.' }] }))
    return { ...result, status: response.status }
}

export function authError(result) {
    if (result.status === 429) return 'Too many attempts. Wait a moment before trying again.'
    return result.errors?.map(error => error.message).filter(Boolean).join(' ') || 'Could not complete authentication. Please try again.'
}

export async function requireAuthResult(path, options) {
    const result = await authRequest(path, options)
    if (result.status >= 400) {
        const error = new Error(authError(result))
        error.status = result.status
        error.result = result
        throw error
    }
    return result
}

export async function redirectToProvider(provider, process = 'login', destination = '/') {
    const csrf = await fetch('/csrf-token/', { credentials: 'same-origin', cache: 'no-store' })
    if (!csrf.ok) throw new Error('Could not start secure sign-in. Please try again.')
    const { csrfToken } = await csrf.json()
    sessionStorage.setItem('cms_auth_destination', safeDestination(destination))
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = `${BASE}/auth/provider/redirect`
    const fields = {
        provider, process, csrfmiddlewaretoken: csrfToken,
        callback_url: `${window.location.origin}${process === 'connect' ? '/profile' : '/login'}`,
    }
    for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input')
        input.type = 'hidden'; input.name = name; input.value = value
        form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
    form.remove()
}

const fromBase64 = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
const toBase64 = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function webAuthnCredential(options, create = false) {
    if (!window.PublicKeyCredential || !navigator.credentials) throw new Error('This browser does not support passkeys or security keys. Use an authenticator or recovery code instead.')
    let publicKey = options.publicKey || options
    if (create && PublicKeyCredential.parseCreationOptionsFromJSON) {
        publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(publicKey)
    } else if (!create && PublicKeyCredential.parseRequestOptionsFromJSON) {
        publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(publicKey)
    } else {
        publicKey = { ...publicKey, challenge: fromBase64(publicKey.challenge) }
        if (publicKey.user) publicKey.user = { ...publicKey.user, id: fromBase64(publicKey.user.id) }
        for (const key of ['allowCredentials', 'excludeCredentials']) {
            if (publicKey[key]) publicKey[key] = publicKey[key].map(item => ({ ...item, id: fromBase64(item.id) }))
        }
    }
    let credential
    try {
        credential = await navigator.credentials[create ? 'create' : 'get']({ publicKey })
    } catch (error) {
        if (['NotAllowedError', 'AbortError'].includes(error.name)) throw new Error('Passkey verification was cancelled or timed out. Try again or use a code.')
        throw new Error('Could not use this passkey or security key. Try another factor.')
    }
    if (!credential) throw new Error('No credential was returned. Try again.')
    if (credential.toJSON) return credential.toJSON()
    const response = credential.response
    return {
        id: credential.id, rawId: toBase64(credential.rawId), type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: {
            clientDataJSON: toBase64(response.clientDataJSON),
            ...(create ? { attestationObject: toBase64(response.attestationObject), transports: response.getTransports?.() || [] } : {
                authenticatorData: toBase64(response.authenticatorData), signature: toBase64(response.signature),
                userHandle: response.userHandle ? toBase64(response.userHandle) : null,
            }),
        },
    }
}

export async function verifyWebAuthn(reauthenticate = false) {
    const path = `/auth/webauthn/${reauthenticate ? 'reauthenticate' : 'authenticate'}`
    const options = await requireAuthResult(path)
    const credential = await webAuthnCredential(options.data.request_options)
    return authRequest(path, { method: 'POST', data: { credential } })
}
