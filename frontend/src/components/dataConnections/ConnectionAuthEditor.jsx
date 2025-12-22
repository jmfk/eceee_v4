import React from 'react'
import { Key, Lock, User, Globe, Shield } from 'lucide-react'
import TextInput from '../form-fields/TextInput'
import PasswordInput from '../form-fields/PasswordInput'
import SelectInput from '../form-fields/SelectInput'

const ConnectionAuthEditor = ({ connectionType, config, onChange }) => {
    const handleConfigChange = (field, value) => {
        onChange({ ...config, [field]: value })
    }

    if (connectionType === 'INTERNAL') {
        return null
    }

    return (
        <div className="space-y-6 mt-8 pt-8 border-t border-gray-200">
            <div className="flex items-center space-x-2 mb-4 text-gray-900">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Authentication & Security</h3>
            </div>

            {connectionType === 'EXTERNAL_REST' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-1 bg-gray-50 border-b border-gray-200">
                        <div className="flex">
                            {['none', 'basic', 'bearer', 'apiKey'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => handleConfigChange('authType', type)}
                                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all ${(config.authType || 'none') === type
                                            ? 'bg-white text-blue-600 shadow-sm rounded-lg border border-gray-200'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {type === 'none' ? 'No Auth' : type.replace(/([A-Z])/g, ' $1')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {(config.authType === 'basic') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TextInput
                                    label="Username"
                                    value={config.username}
                                    onChange={(val) => handleConfigChange('username', val)}
                                    placeholder="api_user"
                                    icon={<User className="w-4 h-4" />}
                                />
                                <PasswordInput
                                    label="Password"
                                    value={config.password}
                                    onChange={(val) => handleConfigChange('password', val)}
                                    placeholder="••••••••"
                                    icon={<Lock className="w-4 h-4" />}
                                />
                            </div>
                        )}

                        {config.authType === 'bearer' && (
                            <PasswordInput
                                label="Bearer Token"
                                description="Enter the personal access token or JWT"
                                value={config.token}
                                onChange={(val) => handleConfigChange('token', val)}
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                icon={<Key className="w-4 h-4" />}
                            />
                        )}

                        {config.authType === 'apiKey' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TextInput
                                    label="Header Name"
                                    value={config.apiKeyHeader}
                                    onChange={(val) => handleConfigChange('apiKeyHeader', val)}
                                    placeholder="X-API-KEY"
                                    icon={<Globe className="w-4 h-4" />}
                                />
                                <PasswordInput
                                    label="API Key Value"
                                    value={config.apiKeyValue}
                                    onChange={(val) => handleConfigChange('apiKeyValue', val)}
                                    placeholder="Secret Key"
                                    icon={<Key className="w-4 h-4" />}
                                />
                            </div>
                        )}

                        {(config.authType || 'none') === 'none' && (
                            <div className="text-center py-4 text-gray-500 text-sm italic">
                                No authentication required for this REST connection.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {connectionType === 'EXTERNAL_DB' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <TextInput
                            label="Username"
                            value={config.username}
                            onChange={(val) => handleConfigChange('username', val)}
                            placeholder="db_user"
                            icon={<User className="w-4 h-4" />}
                        />
                        <PasswordInput
                            label="Password"
                            value={config.password}
                            onChange={(val) => handleConfigChange('password', val)}
                            placeholder="••••••••"
                            icon={<Lock className="w-4 h-4" />}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export default ConnectionAuthEditor

