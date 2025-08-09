import React from 'react'
import SchemaManager from '../components/SchemaManager'

const SystemSchemaPage = () => {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold">System Schema</h1>
                <p className="text-gray-600 mt-1">Define base fields available on all pages.</p>
            </div>
            <SchemaManager initialTab="system" hideTabNav />
        </div>
    )
}

export default SystemSchemaPage


