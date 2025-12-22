import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
    Database, 
    Plus, 
    Search, 
    Settings, 
    Trash2, 
    Edit3, 
    Play, 
    Link, 
    Code, 
    Layers,
    ChevronRight,
    ArrowLeft,
    Save,
    X,
    Activity,
    Globe,
    FileCode,
    RefreshCw
} from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useNotificationContext } from './NotificationManager'

import StreamEditor from './dataConnections/StreamEditor'
import ConnectionAuthEditor from './dataConnections/ConnectionAuthEditor'
import TextInput from './form-fields/TextInput'
import TextareaInput from './form-fields/TextareaInput'
import SelectInput from './form-fields/SelectInput'
import ComboboxInput from './form-fields/ComboboxInput'

const DataConnectionsManager = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const { id: routeId } = useParams()
    
    const [currentView, setCurrentView] = useState('list') // 'list', 'edit-connection', 'edit-stream'
    const [selectedConnection, setSelectedConnection] = useState(null)
    const [selectedStream, setSelectedStream] = useState(null)
    const [testResult, setTestResult] = useState(null)
    const [testingStreamId, setTestingStreamId] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [formErrors, setFormErrors] = useState({})
    const [connectionFormData, setConnectionFormData] = useState({
        name: '',
        connectionType: 'INTERNAL',
        description: '',
        isActive: true,
        config: {}
    })
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()
    const { showConfirm } = useNotificationContext()

    // Sync view with route
    useEffect(() => {
        if (location.pathname === '/settings/data-connections') {
            setCurrentView('list')
            setSelectedConnection(null)
        } else if (routeId) {
            setCurrentView('edit-connection')
            if (routeId !== 'new') {
                const parsedId = parseInt(routeId)
                if (!selectedConnection || selectedConnection.id !== parsedId) {
                    setSelectedConnection({ id: parsedId })
                }
            } else {
                setSelectedConnection(null)
            }
        }
    }, [location.pathname, routeId])

    // Fetch Connections
    const { data: connections = [], isLoading } = useQuery({
        queryKey: ['data-connections'],
        queryFn: async () => {
            const response = await api.get('/api/v1/data-connections/connections/')
            return response.data.results || response.data
        }
    })

    // Fetch full connection detail when editing
    const { data: connectionDetail } = useQuery({
        queryKey: ['data-connections', selectedConnection?.id],
        queryFn: async () => {
            const response = await api.get(`/api/v1/data-connections/connections/${selectedConnection.id}/`)
            return response.data
        },
        enabled: !!selectedConnection?.id
    })

    useEffect(() => {
        const source = connectionDetail || selectedConnection
        if (source) {
            setConnectionFormData({
                id: source.id,
                name: source.name || '',
                connectionType: source.connectionType || 'INTERNAL',
                description: source.description || '',
                isActive: source.isActive ?? true,
                config: source.config || {}
            })
        } else {
            setConnectionFormData({
                name: '',
                connectionType: 'INTERNAL',
                description: '',
                isActive: true,
                config: {}
            })
        }
    }, [selectedConnection, connectionDetail])

    // Mutations
    const saveConnectionMutation = useMutation({
        mutationFn: (data) => {
            if (data.id) {
                return api.patch(`/api/v1/data-connections/connections/${data.id}/`, data)
            }
            return api.post('/api/v1/data-connections/connections/', data)
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries(['data-connections'])
            addNotification('Connection saved successfully', 'success')
            setSelectedConnection(data.data)
            setFormErrors({})
            setCurrentView('edit-connection')
            if (!connectionFormData.id) {
                navigate(`/settings/data-connections/${data.data.id}`)
            }
        },
        onError: (error) => {
            if (error.response?.data) {
                setFormErrors(error.response.data)
            }
            addNotification('Failed to save connection', 'error')
        }
    })

    const deleteConnectionMutation = useMutation({
        mutationFn: (id) => api.delete(`/api/v1/data-connections/connections/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries(['data-connections'])
            addNotification('Connection deleted successfully', 'success')
        }
    })

    const saveStreamMutation = useMutation({
        mutationFn: (streamData) => {
            if (streamData.id) {
                return api.patch(`/api/v1/data-connections/streams/${streamData.id}/`, streamData)
            }
            return api.post('/api/v1/data-connections/streams/', { ...streamData, connection: selectedConnection.id })
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['data-connections', selectedConnection?.id])
            addNotification('Stream saved successfully', 'success')
            setFormErrors({})
            setCurrentView('edit-connection')
        },
        onError: (error) => {
            if (error.response?.data) {
                setFormErrors(error.response.data)
            }
            addNotification('Failed to save stream', 'error')
        }
    })

    const handleBackToList = () => {
        navigate('/settings/data-connections')
    }

    const handleTestStream = async (stream) => {
        setTestingStreamId(stream.id)
        setTestResult(null)
        try {
            const response = await api.post(`/api/v1/data-connections/streams/${stream.id}/execute/`, { bypass_cache: true })
            setTestResult({ streamId: stream.id, data: response.data })
        } catch (error) {
            addNotification('Stream execution failed', 'error')
        } finally {
            setTestingStreamId(null)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        )
    }

    if (currentView === 'list') {
        const filteredConnections = connections.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        )

        return (
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Data Connections</h1>
                        <p className="text-gray-600">Manage internal and external data sources and transformations</p>
                    </div>
                    <button 
                        onClick={() => {
                            setSelectedConnection(null)
                            setFormErrors({})
                            setCurrentView('edit-connection')
                            navigate('/settings/data-connections/new')
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Connection</span>
                    </button>
                </div>

                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text"
                        placeholder="Search connections..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredConnections.map(conn => (
                        <div key={conn.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
                             onClick={() => {
                                 setSelectedConnection(conn)
                                 setFormErrors({})
                                 setCurrentView('edit-connection')
                                 navigate(`/settings/data-connections/${conn.id}`)
                             }}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                        {conn.connectionType === 'INTERNAL' ? <Database className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{conn.name}</h3>
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{conn.connectionType}</span>
                                    </div>
                                </div>
                                <div className={`px-2 py-1 text-xs rounded-full ${conn.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {conn.isActive ? 'Active' : 'Inactive'}
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-500">
                                <div className="flex items-center">
                                    <Layers className="w-4 h-4 mr-1 text-gray-400" />
                                    <span>{conn.streamCount || 0} streams</span>
                                </div>
                                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1 hover:text-blue-600"><Edit3 className="w-4 h-4" /></button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            deleteConnectionMutation.mutate(conn.id)
                                        }}
                                        className="p-1 hover:text-red-600"
                                    ><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (currentView === 'edit-connection') {
        const detail = connectionDetail || selectedConnection
        return (
            <div className="p-6">
                <button onClick={handleBackToList} className="flex items-center text-gray-600 hover:text-gray-900 mb-6 group">
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to connections
                </button>
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="p-8 border-b">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">{selectedConnection ? `Edit ${selectedConnection.name}` : 'New Connection'}</h2>
                            <button 
                                onClick={() => saveConnectionMutation.mutate(connectionFormData)}
                                disabled={saveConnectionMutation.isPending}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm disabled:opacity-50"
                            >
                                {saveConnectionMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{selectedConnection ? 'Save Changes' : 'Create Connection'}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <TextInput 
                                    label="Name"
                                    value={connectionFormData.name} 
                                    onChange={(val) => setConnectionFormData(prev => ({ ...prev, name: val }))}
                                    validation={formErrors.name}
                                    required
                                />
                                
                                <ComboboxInput 
                                    label="Connection Type"
                                    value={connectionFormData.connectionType} 
                                    onChange={(val) => setConnectionFormData(prev => ({ ...prev, connectionType: val }))}
                                    options={[
                                        { value: 'INTERNAL', label: 'Internal System' },
                                        { value: 'EXTERNAL_REST', label: 'External REST API' },
                                        { value: 'EXTERNAL_DB', label: 'External Database', disabled: true, description: 'Coming soon' },
                                    ]}
                                />

                                <div className="flex items-center pt-2">
                                    <input 
                                        type="checkbox" 
                                        id="isActive"
                                        checked={connectionFormData.isActive}
                                        onChange={(e) => setConnectionFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900 font-medium">
                                        Connection is active and available for streams
                                    </label>
                                </div>
                            </div>
                            <div>
                                <TextareaInput 
                                    label="Description"
                                    rows={4} 
                                    value={connectionFormData.description} 
                                    onChange={(val) => setConnectionFormData(prev => ({ ...prev, description: val }))}
                                    placeholder="What is this connection used for?" 
                                />
                            </div>
                        </div>

                        {connectionFormData.connectionType === 'EXTERNAL_REST' && (
                            <div className="mt-8 pt-8 border-t border-gray-200">
                                <div className="flex items-center space-x-2 mb-6">
                                    <Globe className="w-5 h-5 text-blue-600" />
                                    <h3 className="text-lg font-semibold">REST API Configuration</h3>
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    <TextInput 
                                        label="Base URL"
                                        description="The root URL for all API requests in this connection"
                                        value={connectionFormData.config.baseUrl} 
                                        onChange={(val) => setConnectionFormData(prev => ({ 
                                            ...prev, 
                                            config: { ...prev.config, baseUrl: val } 
                                        }))}
                                        placeholder="https://api.example.com"
                                    />
                                    
                                    <TextareaInput 
                                        label="Default Headers (JSON)"
                                        description="Global headers sent with every request"
                                        rows={3} 
                                        value={JSON.stringify(connectionFormData.config.headers || {}, null, 2)} 
                                        onChange={(val) => {
                                            try {
                                                const headers = JSON.parse(val)
                                                setConnectionFormData(prev => ({ 
                                                    ...prev, 
                                                    config: { ...prev.config, headers } 
                                                }))
                                            } catch(err) {}
                                        }}
                                        className="font-mono text-sm"
                                        placeholder='{ "Accept": "application/json" }'
                                    />
                                </div>
                            </div>
                        )}

                        {connectionFormData.connectionType === 'EXTERNAL_DB' && (
                            <div className="mt-8 pt-8 border-t border-gray-200">
                                <div className="flex items-center space-x-2 mb-6">
                                    <Database className="w-5 h-5 text-blue-600" />
                                    <h3 className="text-lg font-semibold">Database Configuration</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ComboboxInput 
                                        label="Database Type"
                                        value={connectionFormData.config.dbType || 'postgresql'} 
                                        onChange={(val) => setConnectionFormData(prev => ({ 
                                            ...prev, 
                                            config: { ...prev.config, dbType: val } 
                                        }))}
                                        options={[
                                            { value: 'postgresql', label: 'PostgreSQL' },
                                            { value: 'mysql', label: 'MySQL' },
                                        ]}
                                    />
                                    <TextInput 
                                        label="Host"
                                        value={connectionFormData.config.host} 
                                        onChange={(val) => setConnectionFormData(prev => ({ 
                                            ...prev, 
                                            config: { ...prev.config, host: val } 
                                        }))}
                                        placeholder="localhost"
                                    />
                                    <TextInput 
                                        label="Port"
                                        type="number" 
                                        value={connectionFormData.config.port} 
                                        onChange={(val) => setConnectionFormData(prev => ({ 
                                            ...prev, 
                                            config: { ...prev.config, port: val } 
                                        }))}
                                        placeholder="5432"
                                    />
                                    <TextInput 
                                        label="Database Name"
                                        value={connectionFormData.config.databaseName} 
                                        onChange={(val) => setConnectionFormData(prev => ({ 
                                            ...prev, 
                                            config: { ...prev.config, databaseName: val } 
                                        }))}
                                        placeholder="my_database"
                                    />
                                </div>
                            </div>
                        )}

                        <ConnectionAuthEditor 
                            connectionType={connectionFormData.connectionType}
                            config={connectionFormData.config}
                            onChange={(newConfig) => setConnectionFormData(prev => ({
                                ...prev,
                                config: newConfig
                            }))}
                        />
                    </div>
                    
                    {selectedConnection && (
                        <div className="p-8 bg-gray-50/50">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Data Streams</h3>
                                    <p className="text-sm text-gray-500">Specific calls to retrieve sets of data</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setSelectedStream(null)
                                        setTestResult(null)
                                        setFormErrors({})
                                        setCurrentView('edit-stream')
                                    }}
                                    className="flex items-center space-x-1 text-sm bg-white border border-gray-300 px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Stream</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {(detail?.streams || []).length === 0 ? (
                                    <div className="text-center py-12 bg-white border-2 border-dashed rounded-lg">
                                        <Activity className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                        <p className="text-gray-500">No streams defined yet</p>
                                    </div>
                                ) : (
                                    (detail.streams || []).map(stream => (
                                        <div key={stream.id}>
                                            <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                                                <div className="flex items-center space-x-4">
                                                    <div className="p-2 bg-gray-100 rounded-md">
                                                        <Activity className="w-4 h-4 text-gray-600" />
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-gray-900">{stream.name}</span>
                                                        <div className="text-xs text-gray-500 font-mono mt-0.5">{stream.outputType} • TTL: {stream.cacheTtl}s</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <button 
                                                        onClick={() => handleTestStream(stream)}
                                                        disabled={!!testingStreamId}
                                                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50" 
                                                        title="Test Stream"
                                                    >
                                                        {testingStreamId === stream.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedStream(stream)
                                                            setFormErrors({})
                                                            setCurrentView('edit-stream')
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-gray-900 transition-colors" title="Settings"><Settings className="w-4 h-4" /></button>
                                                    <button className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            {testResult && testResult.streamId === stream.id && (
                                                <div className="mt-2 p-4 bg-gray-900 rounded-lg border border-gray-800 font-mono text-[10px] overflow-auto max-h-48 relative group/preview">
                                                    <button 
                                                        onClick={() => setTestResult(null)}
                                                        className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                    <div className="text-blue-400 mb-1">Example Output (First Item):</div>
                                                    <pre className="text-gray-300">
                                                        {JSON.stringify(Array.isArray(testResult.data) ? testResult.data[0] : testResult.data, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (currentView === 'edit-stream') {
        return (
            <div className="p-6">
                <button onClick={() => setCurrentView('edit-connection')} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to connection details
                </button>
                <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
                    <h2 className="text-xl font-bold mb-8 flex items-center">
                        <Activity className="w-6 h-6 mr-3 text-blue-600" />
                        {selectedStream ? `Edit Stream: ${selectedStream.name}` : 'New Data Stream'}
                    </h2>
                        <StreamEditor 
                            key={selectedStream?.id || 'new'}
                            stream={selectedStream}
                            connectionId={connectionFormData.id}
                            connectionType={connectionFormData.connectionType} 
                            onSave={(data) => saveStreamMutation.mutate(data)}
                            onCancel={() => {
                                setFormErrors({})
                                setCurrentView('edit-connection')
                            }}
                            errors={formErrors}
                        />
                </div>
            </div>
        )
    }

    return null
}

export default DataConnectionsManager

