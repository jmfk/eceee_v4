import React from 'react'
import SettingsTabs from '../components/SettingsTabs'
import LayoutSchemaManager from '../components/LayoutSchemaManager'
import ErrorBoundary from '../components/ErrorBoundary'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const LayoutSchemaPage = () => {
    // Set document title
    useDocumentTitle('Layout Schemas')

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <SettingsTabs />
            <ErrorBoundary>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-4">
                        <h1 className="text-2xl font-semibold">Layout Schemas</h1>
                        <p className="text-gray-600 mt-1">Select a layout to create or edit its schema extensions.</p>
                    </div>
                    <LayoutSchemaManager />
                </div>
            </ErrorBoundary>
        </div>
    )
}

export default LayoutSchemaPage


