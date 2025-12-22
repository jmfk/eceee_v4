import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
    ArrowLeft, 
    RefreshCw, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Activity,
    AlertCircle,
    FileText,
    ChevronDown,
    ChevronRight
} from 'lucide-react'
import { api } from '../../api/client'

const MigrationJobDashboard = ({ job: initialJob, onBack }) => {
    const queryClient = useQueryClient()
    
    const { data: job, isLoading } = useQuery({
        queryKey: ['migration-job', initialJob.id],
        queryFn: async () => {
            const response = await api.get(`/api/v1/content-migration/jobs/${initialJob.id}/`)
            return response.data
        },
        initialData: initialJob,
        refetchInterval: (data) => (data?.status === 'RUNNING' || data?.status === 'PENDING') ? 2000 : false
    })

    const { data: tasks = [] } = useQuery({
        queryKey: ['migration-tasks', initialJob.id],
        queryFn: async () => {
            const response = await api.get(`/api/v1/content-migration/tasks/?job=${initialJob.id}&limit=100`)
            return response.data.results || response.data
        },
        enabled: !!job,
        refetchInterval: (data) => (job?.status === 'RUNNING' || job?.status === 'PENDING') ? 3000 : false
    })

    const cancelMutation = useMutation({
        mutationFn: () => api.post(`/api/v1/content-migration/jobs/${job.id}/cancel/`),
        onSuccess: () => queryClient.invalidateQueries(['migration-job', job.id])
    })

    if (isLoading) return <div className="p-12 text-center"><RefreshCw className="animate-spin inline mr-2" /> Loading job data...</div>

    const progress = (job.processedItems + job.failedItems + job.skippedItems) / (job.totalItems || 1) * 100

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900 mb-6 group">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to overview
            </button>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-8 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-start">
                    <div>
                        <div className="flex items-center space-x-3 mb-1">
                            <h1 className="text-2xl font-bold text-gray-900">Job: {job.planName}</h1>
                            <JobStatusBadge status={job.status} />
                        </div>
                        <p className="text-sm text-gray-500 font-mono">ID: {job.id}</p>
                    </div>
                    {['PENDING', 'RUNNING'].includes(job.status) && (
                        <button 
                            onClick={() => cancelMutation.mutate()}
                            className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors"
                        >
                            Cancel Job
                        </button>
                    )}
                </div>

                <div className="p-6 bg-gray-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <StatCard label="Total Items" value={job.totalItems} icon={FileText} color="blue" />
                        <StatCard label="Processed" value={job.processedItems} icon={CheckCircle2} color="green" />
                        <StatCard label="Failed" value={job.failedItems} icon={XCircle} color="red" />
                        <StatCard label="Skipped" value={job.skippedItems} icon={Clock} color="gray" />
                    </div>

                    <div className="mt-8">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium text-gray-700">Overall Progress</span>
                            <span className="font-bold text-blue-600">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                            <div 
                                className={`h-full transition-all duration-1000 ease-out ${job.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-600'}`}
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Tasks */}
                <div>
                    <h3 className="text-lg font-bold mb-4 flex items-center"><Activity className="w-5 h-5 mr-2 text-blue-600" /> Recent Activity</h3>
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Source ID</th>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {tasks.map(task => (
                                    <tr key={task.id} className="text-sm">
                                        <td className="px-4 py-3 font-mono text-xs">{task.sourceId}</td>
                                        <td className="px-4 py-3">
                                            <TaskStatusBadge status={task.status} />
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {task.completedAt ? new Date(task.completedAt).toLocaleTimeString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {tasks.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="px-4 py-8 text-center text-gray-400 italic text-sm">No tasks recorded yet</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Error Log */}
                <div>
                    <h3 className="text-lg font-bold mb-4 flex items-center"><AlertCircle className="w-5 h-5 mr-2 text-red-600" /> Error Log</h3>
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-4 max-h-[400px] overflow-y-auto">
                        {job.errorLog && job.errorLog.length > 0 ? (
                            <div className="space-y-4">
                                {job.errorLog.map((error, idx) => (
                                    <div key={idx} className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-xs">
                                        <div className="flex justify-between font-bold text-red-800 mb-1">
                                            <span>{error.sourceId ? `Item: ${error.sourceId}` : 'System Error'}</span>
                                            <span>{new Date(error.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-red-700 whitespace-pre-wrap">{error.error}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-gray-400 italic text-sm">No errors recorded</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const StatCard = ({ label, value, icon: Icon, color }) => {
    const colors = {
        blue: 'text-blue-600 bg-blue-50',
        green: 'text-green-600 bg-green-50',
        red: 'text-red-600 bg-red-50',
        gray: 'text-gray-600 bg-gray-50'
    }
    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center space-x-4">
            <div className={`p-3 rounded-lg ${colors[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
            </div>
        </div>
    )
}

const JobStatusBadge = ({ status }) => {
    const styles = {
        COMPLETED: 'bg-green-100 text-green-800 border-green-200',
        FAILED: 'bg-red-100 text-red-800 border-red-200',
        RUNNING: 'bg-blue-100 text-blue-800 border-blue-200',
        PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return (
        <span className={`px-2 py-1 rounded text-xs font-bold border ${styles[status] || styles.PENDING}`}>
            {status}
        </span>
    )
}

const TaskStatusBadge = ({ status }) => {
    const styles = {
        COMPLETED: 'text-green-600',
        FAILED: 'text-red-600',
        SKIPPED: 'text-gray-400',
        PENDING: 'text-yellow-600'
    }
    return (
        <span className={`text-xs font-bold uppercase tracking-tight ${styles[status] || styles.PENDING}`}>
            {status}
        </span>
    )
}

export default MigrationJobDashboard

