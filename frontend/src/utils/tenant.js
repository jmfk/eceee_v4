const LEGACY_TENANT_STORAGE_KEY = 'eceee_tenant_id'
let currentTenantId = ''
const tenantListeners = new Set()

export const getCurrentTenantId = () => {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_TENANT_ID || ''
  }

  return (
    window.__ECEEE_TENANT_ID ||
    currentTenantId ||
    import.meta.env.VITE_TENANT_ID ||
    ''
  )
}

export const setCurrentTenantId = (identifier) => {
  const nextTenantId = identifier || ''
  if (nextTenantId === currentTenantId) return currentTenantId

  currentTenantId = nextTenantId
  tenantListeners.forEach((listener) => listener(currentTenantId))
  return currentTenantId
}

export const subscribeToCurrentTenantId = (listener) => {
  tenantListeners.add(listener)
  return () => tenantListeners.delete(listener)
}

export const reconcileCurrentTenantId = (currentWorkspace, availableWorkspaces = []) => {
  if (typeof window === 'undefined') return ''

  const serverWorkspace = availableWorkspaces.find((workspace) =>
    workspace.id === currentWorkspace?.id || workspace.identifier === currentWorkspace?.identifier
  ) || currentWorkspace || availableWorkspaces[0]
  const identifier = serverWorkspace?.identifier || ''

  // Workspace selection used to live in localStorage, where it could outlive
  // the authenticated session or change underneath another open tab. The
  // server session now rehydrates this runtime value after every app load.
  localStorage.removeItem(LEGACY_TENANT_STORAGE_KEY)

  return setCurrentTenantId(identifier)
}
