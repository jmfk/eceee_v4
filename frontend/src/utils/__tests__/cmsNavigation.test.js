import { describe, expect, it } from 'vitest'
import { canAccessCmsPath } from '../cmsNavigation'

describe('CMS role navigation', () => {
    it('limits role managers to role/support settings and personal tools', () => {
        const user = { permissions: ['roles.manage'] }
        for (const path of ['/settings', '/settings/roles', '/settings/support', '/profile', '/inbox']) {
            expect(canAccessCmsPath(user, path)).toBe(true)
        }
        for (const path of ['/settings/themes', '/settings/users', '/settings/object-types', '/settings/data-connections', '/statistics', '/kanban']) {
            expect(canAccessCmsPath(user, path)).toBe(false)
        }
    })
    it('allows readers to browse their resources without creation actions', () => {
        const user = { permissions: ['theme.read', 'page.read', 'kanban.read'] }
        for (const path of ['/pages', '/settings/themes/abc', '/kanban']) expect(canAccessCmsPath(user, path)).toBe(true)
        expect(canAccessCmsPath(user, '/pages/new')).toBe(false)
        expect(canAccessCmsPath(user, '/settings/roles')).toBe(false)
    })
    it('retains owner recovery but reserves global user administration for system owners', () => {
        expect(canAccessCmsPath({ permissions: ['tenant.admin'] }, '/settings/users')).toBe(false)
        expect(canAccessCmsPath({ permissions: ['tenant.admin'] }, '/settings/themes')).toBe(true)
        expect(canAccessCmsPath({ isSuperuser: true, permissions: [] }, '/settings/users')).toBe(true)
    })
})
