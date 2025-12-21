import React from 'react'
import LayoutSchemaManager from '../components/LayoutSchemaManager'
import ErrorBoundary from '../components/ErrorBoundary'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const LayoutSchemaPage = () => {
    // Set document title
    useDocumentTitle('Layout Schemas')

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <ErrorBoundary>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-4">
                        <div className="text-2xl font-semibold" role="heading" aria-level="1">Layout Schemas</div>
                        <div className="text-gray-600 mt-1">Select a layout to create or edit its schema extensions.</div>
                    </div>
                    <LayoutSchemaManager />
                </div>
            </ErrorBoundary>
        </div>
    )
}

export default LayoutSchemaPage


