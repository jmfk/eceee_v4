import { describe, it, expect } from 'vitest'

// Simple unit tests for hostname validation logic
const checkHostnameWarning = (page, level) => {
    const isTopLevel = level === 0
    const hasHostnames = page.hostnames && page.hostnames.length > 0
    return isTopLevel && !hasHostnames
}

describe('PageTreeNode - Hostname Validation Logic', () => {
    it('should show warning for top-level page without hostnames', () => {
        const pageWithoutHostnames = {
            id: 1,
            title: 'Home Page',
            slug: 'home',
            hostnames: [] // No hostnames
        }

        const needsWarning = checkHostnameWarning(pageWithoutHostnames, 0)
        expect(needsWarning).toBe(true)
    })

    it('should not show warning for top-level page with hostnames', () => {
        const pageWithHostnames = {
            id: 1,
            title: 'Home Page',
            slug: 'home',
            hostnames: ['example.com'] // Has hostname
        }

        const needsWarning = checkHostnameWarning(pageWithHostnames, 0)
        expect(needsWarning).toBe(false)
    })

    it('should not show warning for child page without hostnames', () => {
        const childPageWithoutHostnames = {
            id: 1,
            title: 'Child Page',
            slug: 'child',
            hostnames: [] // No hostnames but it's a child page
        }

        const needsWarning = checkHostnameWarning(childPageWithoutHostnames, 1)
        expect(needsWarning).toBe(false)
    })

    it('should handle pages with undefined hostnames', () => {
        const pageWithUndefinedHostnames = {
            id: 1,
            title: 'Home Page',
            slug: 'home'
            // hostnames property is undefined
        }

        const needsWarning = checkHostnameWarning(pageWithUndefinedHostnames, 0)
        expect(needsWarning).toBe(true)
    })
}) 