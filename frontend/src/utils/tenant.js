const DEFAULT_TENANT_ID = 'default'

export const getCurrentTenantId = () => {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_TENANT_ID || DEFAULT_TENANT_ID
  }

  return (
    window.__ECEEE_TENANT_ID ||
    localStorage.getItem('eceee_tenant_id') ||
    import.meta.env.VITE_TENANT_ID ||
    DEFAULT_TENANT_ID
  )
}
