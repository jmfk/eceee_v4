import React, { useState } from 'react'
import Navbar from './Navbar'
import SettingsSidebar from './SettingsSidebar'
import StatusBar from './StatusBar'
import { useLocation } from 'react-router-dom'
import { cmsText, getCmsCopyLanguage } from '../utils/cmsCopy'

const SettingsLayout = ({ children, statusContent }) => {
    const location = useLocation()
    const language = getCmsCopyLanguage()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const menuLabel = language === 'sv-se' ? 'Inställningsmeny' : 'Settings menu'
    const closeMenuLabel = language === 'sv-se' ? 'Stäng inställningsmenyn' : 'Close settings menu'

    // Determine status content based on path if not provided
    const getStatusContent = () => {
        if (statusContent) return statusContent
        const path = location.pathname
        if (path === '/settings') return 'Settings - Dashboard'
        if (path.includes('/experiments')) return 'Settings - A/B Testing'
        if (path.includes('/users')) return 'Settings - Users'
        if (path.includes('/layouts')) return 'Settings - Layouts'
        if (path.includes('/themes')) return 'Settings - Themes'
        if (path.includes('/widgets')) return 'Settings - Widgets'
        if (path.includes('/value-lists')) return 'Settings - Value Lists'
        if (path.includes('/object-types')) return 'Settings - Object Types'
        if (path.includes('/versions')) return 'Settings - Versions'
        if (path.includes('/publishing')) return 'Settings - Publishing'
        if (path.includes('/namespaces')) return 'Settings - Namespaces'
        if (path.includes('/remote-sites')) return 'Settings - Remote Sites'
        if (path.includes('/data-connections')) return 'Settings - Data Connections'
        if (path.includes('/schemas/system')) return 'System Schema'
        if (path.includes('/schemas/layout')) return 'Layout Schemas'
        return 'Settings'
    }

    return (
        <div className="fixed inset-0 bg-gray-50 flex flex-col">
            <Navbar />
            <div className="flex-1 flex overflow-hidden">
                {mobileMenuOpen && <button type="button" aria-label={closeMenuLabel} className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setMobileMenuOpen(false)} />}
                <div className={`${mobileMenuOpen ? 'fixed left-0 top-16 bottom-8 z-30 shadow-lg' : 'hidden'} md:static md:block md:h-full md:shadow-none`}>
                    <SettingsSidebar onNavigate={() => setMobileMenuOpen(false)} />
                </div>
                <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50">
                    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
                        <button type="button" className="mb-4 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 md:hidden" aria-expanded={mobileMenuOpen} aria-controls="settings-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>{mobileMenuOpen ? closeMenuLabel : menuLabel}</button>
                        {children}
                    </div>
                </main>
            </div>
            <StatusBar customStatusContent={<span>{cmsText(getStatusContent(), language)}</span>} />
        </div>
    )
}

export default SettingsLayout
