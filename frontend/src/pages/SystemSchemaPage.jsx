import React from 'react'
import SettingsTabs from '../components/SettingsTabs'
import SystemSchemaManager from '../components/SystemSchemaManager'

const SystemSchemaPage = () => {
    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <SettingsTabs />
            <div className="bg-white rounded-lg shadow p-6">
                <div className="mb-4">
                    <h1 className="text-2xl font-semibold">System Schema</h1>
                    <p className="text-gray-600 mt-1">Define base fields available on all pages.</p>
                </div>
                <SystemSchemaManager />
            </div>
        </div>
    )
}

export default SystemSchemaPage


