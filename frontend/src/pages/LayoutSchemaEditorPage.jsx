import React from 'react'
import { useParams, Link } from 'react-router-dom'
import SettingsTabs from '../components/SettingsTabs'
import LayoutSchemaManager from '../components/LayoutSchemaManager'

const LayoutSchemaEditorPage = () => {
    const { layoutName } = useParams()

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <SettingsTabs />
            <div className="bg-white rounded-lg shadow p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Edit Layout Schema</h1>
                        <p className="text-gray-600 mt-1">Editing schema extensions for layout: <span className="font-medium text-gray-900">{layoutName}</span></p>
                    </div>
                    <Link to="/schemas/layout" className="text-blue-600 hover:underline text-sm">Back to Layouts</Link>
                </div>
                <LayoutSchemaManager fixedLayoutName={layoutName} />
            </div>
        </div>
    )
}

export default LayoutSchemaEditorPage


