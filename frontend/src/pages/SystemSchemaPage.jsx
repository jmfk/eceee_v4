import React from 'react'
import SystemSchemaManager from '../components/SystemSchemaManager'
import ErrorBoundary from '../components/ErrorBoundary'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const SystemSchemaPage = () => {
    // Set document title
    useDocumentTitle('System Schema')
    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <ErrorBoundary>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-4">
                        <div className="text-2xl font-semibold" role="heading" aria-level="1">System Schema</div>
                        <div className="text-gray-600 mt-1">Define base fields available on all pages.</div>
                    </div>
                    <SystemSchemaManager />
                </div>
            </ErrorBoundary>
        </div>
    )
}

export default SystemSchemaPage


