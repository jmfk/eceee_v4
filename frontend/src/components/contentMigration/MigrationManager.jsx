import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
    Plus, 
    Search, 
    Trash2, 
    Edit3, 
    Play, 
    RefreshCw,
    ClipboardList,
    Activity,
    History,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle
} from 'lucide-react'
import { api } from '../../api/client'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import MigrationPlanEditor from './MigrationPlanEditor'
import MigrationJobDashboard from './MigrationJobDashboard'

const MigrationManager = () => {
    const [currentView, setCurrentView] = useState('list') // 'list', 'edit-plan', 'job-dashboard'
    const [selectedPlan, setSelectedPlan] = useState(null)
    const [selectedJob, setSelectedJob] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Fetch Plans
    const { data: plans = [], isLoading: plansLoading } = useQuery({
        queryKey: ['migration-plans'],
        queryFn: async () => {
            const response = await api.get('/api/v1/content-migration/plans/')
            return response.data.results || response.data
        }
    })

    // Fetch Jobs (latest 10)
    const { data: recentJobs = [] } = useQuery({
        queryKey: ['migration-jobs-recent'],
        queryFn: async () => {
            const response = await api.get('/api/v1/content-migration/jobs/?limit=10')
            return response.data.results || response.data
        },
        refetchInterval: 5000 // Poll for updates
    })

    const runPlanMutation = useMutation({
        mutationFn: async (planId) => await api.post(`/api/v1/content-migration/plans/${planId}/run/`),
        onSuccess: (data) => {
            addNotification('Migration job started', 'success')
            setSelectedJob(data.data)
            setCurrentView('job-dashboard')
        }
    })

    const deletePlanMutation = useMutation({
        mutationFn: async (id) => await api.delete(`/api/v1/content-migration/plans/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries(['migration-plans'])
            addNotification('Plan deleted', 'success')
        }
    })

    if (plansLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        )
    }

    if (currentView === 'edit-plan') {
        return <MigrationPlanEditor plan={selectedPlan} onBack={() => { setCurrentView('list'); queryClient.invalidateQueries(['migration-plans']); }} />
    }

    if (currentView === 'job-dashboard') {
        return <MigrationJobDashboard job={selectedJob} onBack={() => { setCurrentView('list'); queryClient.invalidateQueries(['migration-jobs-recent']); }} />
    }

    const filteredPlans = plans.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Content Migrations</h1>
                    <p className="text-gray-600">Batch import content from external systems into object storage</p>
                </div>
                <button 
                    onClick={() => {
                        setSelectedPlan(null)
                        setCurrentView('edit-plan')
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Migration Plan</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Plans List */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="p-4 border-b border-gray-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input 
                                    type="text"
                                    placeholder="Search plans..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {filteredPlans.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                    <p>No migration plans found</p>
                                </div>
                            ) : (
                                filteredPlans.map(plan => (
                                    <div key={plan.id} className="p-4 hover:bg-gray-50 flex items-center justify-between group">
                                        <div className="flex-1 min-w-0 pr-4 cursor-pointer" onClick={() => { setSelectedPlan(plan); setCurrentView('edit-plan'); }}>
                                            <h3 className="font-semibold text-gray-900 truncate">{plan.name}</h3>
                                            <p className="text-sm text-gray-500 truncate">{plan.description || 'No description'}</p>
                                            <div className="flex items-center mt-1 space-x-4 text-xs text-gray-400 font-medium uppercase tracking-wider">
                                                <span className="flex items-center"><Activity className="w-3 h-3 mr-1" /> {plan.sourceConnectionDetails?.name}</span>
                                                <span className="flex items-center"><History className="w-3 h-3 mr-1" /> {plan.targetObjectTypeDetails?.label}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button 
                                                onClick={() => runPlanMutation.mutate(plan.id)}
                                                disabled={runPlanMutation.isPending}
                                                className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                                                title="Run Migration"
                                            >
                                                <Play className="w-5 h-5 fill-current" />
                                            </button>
                                            <button 
                                                onClick={() => { setSelectedPlan(plan); setCurrentView('edit-plan'); }}
                                                className="p-2 text-gray-400 hover:text-blue-600 rounded-full transition-colors"
                                                title="Edit"
                                            >
                                                <Edit3 className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (window.confirm('Are you sure you want to delete this plan?')) {
                                                        deletePlanMutation.mutate(plan.id)
                                                    }
                                                }}
                                                className="p-2 text-gray-400 hover:text-red-600 rounded-full transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Jobs */}
                <div className="lg:col-span-1">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <History className="w-5 h-5 mr-2 text-gray-400" />
                        Recent Jobs
                    </h2>
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
                        {recentJobs.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm italic">
                                No jobs recorded yet
                            </div>
                        ) : (
                            recentJobs.map(job => (
                                <div key={job.id} 
                                     className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                     onClick={() => { setSelectedJob(job); setCurrentView('job-dashboard'); }}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-sm text-gray-900 truncate pr-2">{job.planName}</span>
                                        <JobStatusBadge status={job.status} />
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>{new Date(job.createdAt).toLocaleString()}</span>
                                        <div className="flex space-x-2">
                                            <span className="text-green-600 font-semibold">{job.processedItems}</span>
                                            <span className="text-red-600 font-semibold">{job.failedItems}</span>
                                            <span className="text-gray-400">{job.totalItems} total</span>
                                        </div>
                                    </div>
                                    {job.status === 'RUNNING' && (
                                        <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-blue-600 h-full transition-all duration-500" 
                                                 style={{ width: `${(job.processedItems + job.failedItems + job.skippedItems) / (job.totalItems || 1) * 100}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const JobStatusBadge = ({ status }) => {
    switch (status) {
        case 'COMPLETED':
            return <span className="flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> DONE</span>
        case 'FAILED':
            return <span className="flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> FAIL</span>
        case 'RUNNING':
            return <span className="flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 animate-pulse"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> RUN</span>
        case 'CANCELLED':
            return <span className="flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1" /> STOP</span>
        default:
            return <span className="flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> WAIT</span>
    }
}

export default MigrationManager

