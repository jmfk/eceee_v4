type ManagedFont = {
    element: HTMLLinkElement
    users: Set<string>
}

const managedFonts = new Map<string, ManagedFont>()

export const registerRenderFont = (url: string, user: string) => {
    if (!url || typeof document === 'undefined') return
    const existing = managedFonts.get(url)
    if (existing) {
        existing.users.add(user)
        return
    }
    const element = document.createElement('link')
    element.rel = 'stylesheet'
    element.href = url
    element.dataset.eceeeRenderFont = ''
    document.head.appendChild(element)
    managedFonts.set(url, { element, users: new Set([user]) })
}

export const unregisterRenderFont = (url: string, user: string) => {
    const managed = managedFonts.get(url)
    if (!managed) return
    managed.users.delete(user)
    if (managed.users.size) return
    managed.element.remove()
    managedFonts.delete(url)
}
