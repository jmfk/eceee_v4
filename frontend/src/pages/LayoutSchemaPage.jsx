import React from 'react'
import SchemaManager from '../components/SchemaManager'

const LayoutSchemaPage = () => {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold">Layout Schemas</h1>
                <p className="text-gray-600 mt-1">Extend the system schema with layout-specific fields.</p>
            </div>
            <SchemaManager initialTab="layout" hideTabNav />
        </div>
    )
}

export default LayoutSchemaPage


