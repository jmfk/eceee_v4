import React from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { validateFieldName } from '../utils/schemaValidation'
import LayoutSchemaManager from '../components/LayoutSchemaManager'
import ErrorBoundary from '../components/ErrorBoundary'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const LayoutSchemaEditorPage = () => {
    const { layoutName } = useParams()
    
    // Set document title
    useDocumentTitle(layoutName ? `${layoutName} Schema` : 'Layout Schema')
    
    const isValidLayout = typeof layoutName === 'string' && /^[a-zA-Z0-9_-]+$/.test(layoutName)

    if (!isValidLayout) {
        return <Navigate to="/schemas/layout" replace />
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <ErrorBoundary>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-semibold" role="heading" aria-level="1">Edit Layout Schema</div>
                            <div className="text-gray-600 mt-1">Editing schema extensions for layout: <span className="font-medium text-gray-900">{layoutName}</span></div>
                        </div>
                        <Link to="/schemas/layout" className="text-blue-600 hover:underline text-sm">Back to Layouts</Link>
                    </div>
                    <LayoutSchemaManager fixedLayoutName={layoutName} />
                </div>
            </ErrorBoundary>
        </div>
    )
}

export default LayoutSchemaEditorPage


