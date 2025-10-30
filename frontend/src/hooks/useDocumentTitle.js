/*
 * Copyright (C) 2025 Johan Mats Fred Karlsson
 *
 * This file is part of easy_v4.
 *
 * This program is licensed under the Server Side Public License, version 1,
 * as published by MongoDB, Inc. See the LICENSE file for details.
 */

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Custom hook to set the document title
 * @param {string} title - The title to set
 * @param {string} [suffix='easy v4'] - The suffix to append to the title
 */
export function useDocumentTitle(title, suffix = 'easy v4') {
    const prevTitle = useRef(document.title)

    useEffect(() => {
        const fullTitle = title ? `${title} | ${suffix}` : suffix
        document.title = fullTitle

        return () => {
            document.title = prevTitle.current
        }
    }, [title, suffix])
}

/**
 * Auto-update document title based on current route
 */
export function useAutoPageTitle() {
    const location = useLocation()

    useEffect(() => {
        const path = location.pathname
        let title = 'easy v4'

        if (path === '/pages') title = 'Pages'
        else if (path === '/media') title = 'Media'
        else if (path === '/tags') title = 'Tags'
        else if (path === '/profile') title = 'Profile'
        else if (path === '/objects') title = 'Objects'
        else if (path.startsWith('/objects/')) title = 'Objects'
        else if (path.startsWith('/settings/users')) title = 'User Management'
        else if (path.startsWith('/settings/layouts')) title = 'Layouts'
        else if (path.startsWith('/settings/themes')) title = 'Themes'
        else if (path.startsWith('/settings/widgets')) title = 'Widgets'
        else if (path.startsWith('/settings/value-lists')) title = 'Value Lists'
        else if (path.startsWith('/settings/object-types')) title = 'Object Types'
        else if (path.startsWith('/settings/versions')) title = 'Version History'
        else if (path.startsWith('/settings/publishing')) title = 'Publishing'
        else if (path.startsWith('/settings/namespaces')) title = 'Namespaces'
        else if (path.startsWith('/schemas/system')) title = 'System Schema'
        else if (path.startsWith('/schemas/layout')) title = 'Layout Schemas'
        else if (path.startsWith('/pages/') && path.includes('/edit')) title = 'Edit Page'
        else if (path.startsWith('/pages/') && path.includes('/versions')) title = 'Version Timeline'
        else if (path.startsWith('/demo/')) title = 'Demo'
        else if (path === '/login') title = 'Login'

        document.title = title === 'easy v4' ? title : `${title} | easy v4`
    }, [location])
}
