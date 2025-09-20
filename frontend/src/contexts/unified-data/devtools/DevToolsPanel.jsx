import React, { useState, useEffect } from 'react';
import {
    Play,
    Square,
    RotateCcw,
    Download,
    Upload,
    Trash2,
    Eye,
    BarChart3,
    Search,
    Settings,
    Bug
} from 'lucide-react';
import { useDevTools } from '../hooks/useDevTools';

/**
 * Visual DevTools Panel for UnifiedDataContext
 * Provides a comprehensive debugging interface
 */
export function DevToolsPanel({ isOpen, onClose }) {
    const devTools = useDevTools();
    const [activeTab, setActiveTab] = useState('operations');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSession, setSelectedSession] = useState(null);

    // Auto-update data
    const [operationLogs, setOperationLogs] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [stats, setStats] = useState({});

    useEffect(() => {
        if (isOpen) {
            const updateData = () => {
                setOperationLogs(devTools.getOperationLogs());
                setSessions(devTools.getSessions());
                setStats(devTools.getOperationStats());
            };

            updateData();
            const interval = setInterval(updateData, 1000);
            return () => clearInterval(interval);
        }
    }, [isOpen, devTools]);

    if (!isOpen) return null;

    const tabs = [
        { id: 'operations', label: 'Operations', icon: Bug },
        { id: 'state', label: 'State', icon: Eye },
        { id: 'performance', label: 'Performance', icon: BarChart3 },
        { id: 'sessions', label: 'Sessions', icon: Play },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];

    const filteredOperations = operationLogs.filter(log =>
        !searchTerm ||
        log.operation.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.operation.payload).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-2xl w-11/12 h-5/6 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-900">
                        UnifiedDataContext DevTools
                    </h2>
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${devTools.isEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-sm text-gray-600">
                            {devTools.isEnabled ? 'Active' : 'Disabled'}
                        </span>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'operations' && (
                        <div className="h-full flex flex-col">
                            {/* Operations toolbar */}
                            <div className="p-4 border-b bg-gray-50">
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => devTools.startRecording()}
                                            disabled={devTools.isRecording}
                                            className="flex items-center space-x-1 px-3 py-1 bg-red-500 text-white rounded text-sm disabled:opacity-50"
                                        >
                                            <Play className="w-4 h-4" />
                                            <span>Record</span>
                                        </button>
                                        <button
                                            onClick={() => devTools.stopRecording()}
                                            disabled={!devTools.isRecording}
                                            className="flex items-center space-x-1 px-3 py-1 bg-gray-500 text-white rounded text-sm disabled:opacity-50"
                                        >
                                            <Square className="w-4 h-4" />
                                            <span>Stop</span>
                                        </button>
                                    </div>

                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            placeholder="Search operations..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full px-3 py-1 border rounded text-sm"
                                        />
                                    </div>

                                    <button
                                        onClick={() => devTools.clearDebugData()}
                                        className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Clear</span>
                                    </button>
                                </div>
                            </div>

                            {/* Operations list */}
                            <div className="flex-1 overflow-auto">
                                {filteredOperations.map((log, index) => (
                                    <div
                                        key={log.id}
                                        className="border-b p-3 hover:bg-gray-50 cursor-pointer"
                                        onClick={() => console.log('Operation details:', log)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <span className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <span className="font-mono text-sm font-medium">
                                                    {log.operation.type}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {log.duration ? `${log.duration.toFixed(2)}ms` : ''}
                                            </div>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-600 font-mono">
                                            {JSON.stringify(log.operation.payload, null, 0).substring(0, 100)}...
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'state' && (
                        <div className="h-full p-4">
                            <div className="mb-4">
                                <button
                                    onClick={() => devTools.showStateInspector()}
                                    className="flex items-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                    <Eye className="w-4 h-4" />
                                    <span>Inspect Current State</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-gray-50 p-3 rounded">
                                    <h3 className="font-medium text-gray-900 mb-2">Pages</h3>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {Object.keys(state.pages || {}).length}
                                    </p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <h3 className="font-medium text-gray-900 mb-2">Widgets</h3>
                                    <p className="text-2xl font-bold text-green-600">
                                        {Object.keys(state.widgets || {}).length}
                                    </p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <h3 className="font-medium text-gray-900 mb-2">Layouts</h3>
                                    <p className="text-2xl font-bold text-purple-600">
                                        {Object.keys(state.layouts || {}).length}
                                    </p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <h3 className="font-medium text-gray-900 mb-2">Versions</h3>
                                    <p className="text-2xl font-bold text-orange-600">
                                        {Object.keys(state.versions || {}).length}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded">
                                <h3 className="font-medium text-gray-900 mb-2">State Status</h3>
                                <div className="space-y-1 text-sm">
                                    <div>isDirty: <span className={`font-medium ${state.metadata?.isDirty ? 'text-red-600' : 'text-green-600'}`}>
                                        {state.metadata?.isDirty ? 'true' : 'false'}
                                    </span></div>
                                    <div>isLoading: <span className={`font-medium ${state.metadata?.isLoading ? 'text-yellow-600' : 'text-green-600'}`}>
                                        {state.metadata?.isLoading ? 'true' : 'false'}
                                    </span></div>
                                    <div>Unsaved Changes: <span className="font-medium text-blue-600">
                                        {Object.keys(state.metadata?.widgetStates?.unsavedChanges || {}).length}
                                    </span></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'performance' && (
                        <div className="h-full p-4">
                            <div className="mb-4">
                                <button
                                    onClick={() => devTools.showPerformanceProfiler()}
                                    className="flex items-center space-x-2 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                    <BarChart3 className="w-4 h-4" />
                                    <span>Show Performance Profile</span>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-medium text-gray-900">Operation Performance</h3>
                                {Object.entries(stats).map(([type, stat]) => (
                                    <div key={type} className="bg-gray-50 p-3 rounded">
                                        <div className="flex justify-between items-center">
                                            <span className="font-mono text-sm">{type}</span>
                                            <span className="text-sm text-gray-600">
                                                {stat.count} operations
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-600">
                                            Avg: {stat.averageTime?.toFixed(2)}ms |
                                            Success: {stat.successRate?.toFixed(1)}% |
                                            Errors: {stat.errors}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'sessions' && (
                        <div className="h-full p-4">
                            <div className="mb-4 flex justify-between items-center">
                                <h3 className="font-medium text-gray-900">Recording Sessions</h3>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = '.json';
                                            input.onchange = (e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (e) => {
                                                        try {
                                                            devTools.importSession(e.target.result);
                                                            setSessions(devTools.getSessions());
                                                        } catch (error) {
                                                            alert('Failed to import session');
                                                        }
                                                    };
                                                    reader.readAsText(file);
                                                }
                                            };
                                            input.click();
                                        }}
                                        className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded text-sm"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>Import</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        className={`border rounded p-3 cursor-pointer hover:bg-gray-50 ${selectedSession?.id === session.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                            }`}
                                        onClick={() => setSelectedSession(session)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="font-medium">{session.name}</h4>
                                                <p className="text-sm text-gray-600">
                                                    {session.operations.length} operations • {session.status}
                                                </p>
                                            </div>
                                            <div className="flex space-x-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        devTools.replaySession(session.id);
                                                    }}
                                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                                    title="Replay session"
                                                >
                                                    <Play className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const data = devTools.exportSession(session.id);
                                                        const blob = new Blob([data], { type: 'application/json' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `session-${session.name}-${session.id}.json`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                                    title="Export session"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        devTools.deleteSession(session.id);
                                                        setSessions(devTools.getSessions());
                                                        if (selectedSession?.id === session.id) {
                                                            setSelectedSession(null);
                                                        }
                                                    }}
                                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                                    title="Delete session"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="h-full p-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={devTools.isEnabled}
                                            onChange={(e) => devTools.enableDevTools(e.target.checked)}
                                        />
                                        <span>Enable DevTools</span>
                                    </label>
                                </div>

                                <div className="border-t pt-4">
                                    <h4 className="font-medium mb-2">Quick Actions</h4>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => devTools.clearDebugData()}
                                            className="block w-full text-left px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                        >
                                            Clear All Debug Data
                                        </button>
                                        <button
                                            onClick={() => {
                                                const data = devTools.exportDebugData();
                                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `unified-data-debug-${Date.now()}.json`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="block w-full text-left px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                        >
                                            Export Debug Data
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * DevTools trigger button
 */
export function DevToolsTrigger() {
    const [isOpen, setIsOpen] = useState(false);

    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 z-40"
                title="Open UnifiedDataContext DevTools"
            >
                <Bug className="w-5 h-5" />
            </button>

            <DevToolsPanel
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </>
    );
}
