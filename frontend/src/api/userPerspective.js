import client from './client'

const PATH = '/api/v1/utils/user-perspective/'
export const IDENTITY_CHANGE_KEY = 'cms-identity-changed'

// A full navigation also discards React Query, editor, clipboard and websocket state.
export function navigateAfterIdentityChange(destination) {
    try {
        localStorage.setItem(IDENTITY_CHANGE_KEY, String(Date.now()) + Math.random())
    } finally {
        window.location.assign(destination)
    }
}

export async function startUserPerspective(userId) {
    await client.post(PATH, { userId }, { skipTenantHeader: true, skipSessionQueue: true })
    navigateAfterIdentityChange('/')
}

export async function stopUserPerspective() {
    await client.delete(PATH, { skipTenantHeader: true, skipSessionQueue: true })
    navigateAfterIdentityChange('/settings/roles')
}
