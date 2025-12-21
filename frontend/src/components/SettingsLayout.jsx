import React from 'react'
import Navbar from './Navbar'
import SettingsSidebar from './SettingsSidebar'
import StatusBar from './StatusBar'
import { useLocation } from 'react-router-dom'

const SettingsLayout = ({ children, statusContent }) => {
    const location = useLocation()

    // Determine status content based on path if not provided
    const getStatusContent = () => {
        if (statusContent) return statusContent
        const path = location.pathname
        if (path === '/settings') return 'Settings - Dashboard'
        if (path.includes('/users')) return 'Settings - Users'
        if (path.includes('/layouts')) return 'Settings - Layouts'
        if (path.includes('/themes')) return 'Settings - Themes'
        if (path.includes('/widgets')) return 'Settings - Widgets'
        if (path.includes('/value-lists')) return 'Settings - Value Lists'
        if (path.includes('/object-types')) return 'Settings - Object Types'
        if (path.includes('/versions')) return 'Settings - Versions'
        if (path.includes('/publishing')) return 'Settings - Publishing'
        if (path.includes('/namespaces')) return 'Settings - Namespaces'
        if (path.includes('/schemas/system')) return 'System Schema'
        if (path.includes('/schemas/layout')) return 'Layout Schemas'
        return 'Settings'
    }

    return (
        <div className="fixed inset-0 bg-gray-50 flex flex-col">
            <Navbar />
            <div className="flex-1 flex overflow-hidden">
                <SettingsSidebar />
                <main className="flex-1 overflow-y-auto bg-gray-50">
                    <div className="px-6 py-8 sm:px-10">
                        {children}
                    </div>
                </main>
            </div>
            <StatusBar customStatusContent={<span>{getStatusContent()}</span>} />
        </div>
    )
}

export default SettingsLayout

