// Mirror API capabilities for navigation; backend authorization remains authoritative.
const routes = [
    ['/pages/new', ['page.write']], ['/pages', ['page.read']],
    ['/objects', ['object.read']], ['/media', ['media.read']],
    ['/statistics', ['statistics.read']], ['/tags', ['content.read']],
    ['/designer', ['theme.read']], ['/kanban', ['kanban.read']],
    ['/settings/roles', ['roles.manage']], ['/settings/support', ['roles.manage']],
    ['/settings/users', []], ['/settings/tenants', []], ['/settings/versions', []], ['/settings/experiments', []],
    ['/settings/content-migration', []], ['/settings/publishing', ['page.read']],
    ['/settings/namespaces', ['site.read']], ['/settings/remote-sites', ['integrations.manage']],
    ['/settings/data-connections', ['integrations.manage']], ['/settings/themes', ['theme.read']],
    ['/settings/object-types', ['object.read']], ['/settings/value-lists', ['site.read']],
    ['/settings/widgets', ['layout.read']], ['/schemas/layout', ['layout.read']],
    ['/schemas/system', ['site.read']],
    ['/settings', ['settings.read', 'settings.write', 'roles.manage', 'theme.read', 'object.read', 'site.read', 'layout.read', 'page.read', 'integrations.manage']],
]

export const canAccessCmsPath = (user, path) => {
    if (path === '/settings/users' || path === '/settings/tenants') return Boolean(user?.isSuperuser)
    if (!Array.isArray(user?.permissions) || user.isSuperuser || user.permissions.includes('tenant.admin')) return true
    const match = routes.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))
    return !match || match[1].some((permission) => user.permissions.includes(permission))
}
