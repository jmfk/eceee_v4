/**
 * AI Agent Task Manager Component
 * 
 * Provides a comprehensive interface for managing AI agent tasks including:
 * - Creating new tasks with different types and configurations
 * - Monitoring task progress in real-time
 * - Viewing task results and history
 * - Managing task templates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import {
    Play,
    Square,
    RefreshCw,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Plus,
    Eye,
    Trash2
} from 'lucide-react';

// AI Agent Task API Service
class AIAgentTaskService {
    constructor() {
        this.baseUrl = '/api/v1/utils';
    }

    async createTask(taskData) {
        const response = await fetch(`${this.baseUrl}/ai-tasks/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
            body: JSON.stringify(taskData),
        });

        if (!response.ok) {
            throw new Error(`Failed to create task: ${response.statusText}`);
        }

        return response.json();
    }

    async getTasks() {
        const response = await fetch(`${this.baseUrl}/ai-tasks/`);
        if (!response.ok) {
            throw new Error(`Failed to fetch tasks: ${response.statusText}`);
        }
        return response.json();
    }

    async getTask(taskId) {
        const response = await fetch(`${this.baseUrl}/ai-tasks/${taskId}/`);
        if (!response.ok) {
            throw new Error(`Failed to fetch task: ${response.statusText}`);
        }
        return response.json();
    }

    async cancelTask(taskId) {
        const response = await fetch(`${this.baseUrl}/ai-tasks/${taskId}/cancel/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to cancel task: ${response.statusText}`);
        }

        return response.json();
    }

    async retryTask(taskId) {
        const response = await fetch(`${this.baseUrl}/ai-tasks/${taskId}/retry/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to retry task: ${response.statusText}`);
        }

        return response.json();
    }

    async getActiveTasks() {
        const response = await fetch(`${this.baseUrl}/ai-tasks/active/`);
        if (!response.ok) {
            throw new Error(`Failed to fetch active tasks: ${response.statusText}`);
        }
        return response.json();
    }

    async getTaskStatistics() {
        const response = await fetch(`${this.baseUrl}/task-statistics/`);
        if (!response.ok) {
            throw new Error(`Failed to fetch statistics: ${response.statusText}`);
        }
        return response.json();
    }

    // Server-Sent Events for real-time updates
    subscribeToTaskUpdates(taskId, onUpdate, onError) {
        const eventSource = new EventSource(`${this.baseUrl}/tasks/${taskId}/stream/`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onUpdate(data);
            } catch (error) {
                console.error('Failed to parse SSE data:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            if (onError) onError(error);
        };

        return () => eventSource.close();
    }

    getCsrfToken() {
        // Get CSRF token from cookie or meta tag
        const csrfCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];

        return csrfCookie || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    }
}

// Task Status Badge Component
const TaskStatusBadge = ({ status }) => {
    const statusConfig = {
        pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
        running: { variant: 'default', icon: Play, label: 'Running' },
        completed: { variant: 'success', icon: CheckCircle, label: 'Completed' },
        failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
        cancelled: { variant: 'outline', icon: Square, label: 'Cancelled' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <Badge variant={config.variant} className="flex items-center gap-1">
            <Icon size={12} />
            {config.label}
        </Badge>
    );
};

// Task Card Component
const TaskCard = ({ task, onCancel, onRetry, onView }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleCancel = async () => {
        setIsUpdating(true);
        try {
            await onCancel(task.id);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRetry = async () => {
        setIsUpdating(true);
        try {
            await onRetry(task.id);
        } finally {
            setIsUpdating(false);
        }
    };

    const formatDuration = (startTime, endTime) => {
        if (!startTime) return null;

        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date();
        const duration = Math.floor((end - start) / 1000);

        if (duration < 60) return `${duration}s`;
        if (duration < 3600) return `${Math.floor(duration / 60)}m`;
        return `${Math.floor(duration / 3600)}h`;
    };

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg">{task.title}</CardTitle>
                        <div className="text-sm text-muted-foreground mt-1">
                            {task.description || `${task.taskType} task`}
                        </div>
                    </div>
                    <TaskStatusBadge status={task.status} />
                </div>
            </CardHeader>

            <CardContent>
                <div className="space-y-3">
                    {/* Progress Bar */}
                    {task.status === 'running' && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span>{task.progress}%</span>
                            </div>
                            <Progress value={task.progress} className="h-2" />
                        </div>
                    )}

                    {/* Task Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-medium">Type:</span>
                            <span className="ml-2 capitalize">{task.taskType}</span>
                        </div>
                        <div>
                            <span className="font-medium">Priority:</span>
                            <span className="ml-2 capitalize">{task.priority}</span>
                        </div>
                        <div>
                            <span className="font-medium">Created:</span>
                            <span className="ml-2">
                                {new Date(task.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        {task.startedAt && (
                            <div>
                                <span className="font-medium">Duration:</span>
                                <span className="ml-2">
                                    {formatDuration(task.startedAt, task.completedAt)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {task.status === 'failed' && task.errorMessage && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                                {task.errorMessage.split('\n')[0]}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onView(task)}
                            className="flex items-center gap-1"
                        >
                            <Eye size={14} />
                            View Details
                        </Button>

                        {task.isActive && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancel}
                                disabled={isUpdating}
                                className="flex items-center gap-1"
                            >
                                <Square size={14} />
                                Cancel
                            </Button>
                        )}

                        {(task.status === 'failed' || task.status === 'cancelled') && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRetry}
                                disabled={isUpdating}
                                className="flex items-center gap-1"
                            >
                                <RefreshCw size={14} />
                                Retry
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// New Task Form Component
const NewTaskForm = ({ onSubmit, onCancel }) => {
    const [taskType, setTaskType] = useState('summary');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [config, setConfig] = useState({});
    const [priority, setPriority] = useState('normal');

    const taskTypeConfigs = {
        summary: {
            label: 'Content Summarization',
            fields: [
                { key: 'content', label: 'Content to Summarize', type: 'textarea' },
                { key: 'urls', label: 'URLs (one per line)', type: 'textarea' },
                { key: 'max_length', label: 'Max Summary Length', type: 'number', default: 500 }
            ]
        },
        research: {
            label: 'Research & Analysis',
            fields: [
                { key: 'topic', label: 'Research Topic', type: 'text' },
                { key: 'urls', label: 'Source URLs (one per line)', type: 'textarea' },
                { key: 'questions', label: 'Specific Questions (one per line)', type: 'textarea' }
            ]
        },
        content_generation: {
            label: 'Content Generation',
            fields: [
                { key: 'topic', label: 'Topic', type: 'text', required: true },
                { key: 'content_type', label: 'Content Type', type: 'select', options: ['article', 'blog_post', 'summary', 'report'], default: 'article' },
                { key: 'length', label: 'Target Length (words)', type: 'number', default: 1000 },
                { key: 'tone', label: 'Tone', type: 'select', options: ['professional', 'casual', 'academic', 'creative'], default: 'professional' },
                { key: 'keywords', label: 'Keywords (comma-separated)', type: 'text' }
            ]
        },
        data_analysis: {
            label: 'Data Analysis',
            fields: [
                { key: 'data', label: 'Data (JSON format)', type: 'textarea', required: true },
                { key: 'analysis_type', label: 'Analysis Type', type: 'select', options: ['summary', 'statistical', 'trend'], default: 'summary' }
            ]
        },
        custom: {
            label: 'Custom Task',
            fields: [
                { key: 'custom_config', label: 'Custom Configuration (JSON)', type: 'textarea' }
            ]
        }
    };

    const currentConfig = taskTypeConfigs[taskType];

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Process config based on task type
        let processedConfig = { ...config };

        if (taskType === 'summary' || taskType === 'research') {
            if (config.urls) {
                processedConfig.urls = config.urls.split('\n').filter(url => url.trim());
            }
        }

        if (taskType === 'research' && config.questions) {
            processedConfig.questions = config.questions.split('\n').filter(q => q.trim());
        }

        if (taskType === 'content_generation' && config.keywords) {
            processedConfig.keywords = config.keywords.split(',').map(k => k.trim()).filter(k => k);
        }

        if (taskType === 'data_analysis' && config.data) {
            try {
                processedConfig.data = JSON.parse(config.data);
            } catch (error) {
                alert('Invalid JSON data format');
                return;
            }
        }

        onSubmit({
            title,
            description,
            taskType,
            taskConfig: processedConfig,
            priority
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Task Type</label>
                <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full p-2 border rounded-md"
                >
                    {Object.entries(taskTypeConfigs).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    required
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2 border rounded-md h-20"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full p-2 border rounded-md"
                >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                </select>
            </div>

            {/* Dynamic Configuration Fields */}
            <div className="space-y-4">
                <div className="text-lg font-medium" role="heading" aria-level="3">Configuration</div>
                {currentConfig.fields.map(field => (
                    <div key={field.key} className="space-y-2">
                        <label className="text-sm font-medium">{field.label}</label>

                        {field.type === 'text' && (
                            <input
                                type="text"
                                value={config[field.key] || ''}
                                onChange={(e) => handleConfigChange(field.key, e.target.value)}
                                className="w-full p-2 border rounded-md"
                                required={field.required}
                            />
                        )}

                        {field.type === 'number' && (
                            <input
                                type="number"
                                value={config[field.key] || field.default || ''}
                                onChange={(e) => handleConfigChange(field.key, parseInt(e.target.value))}
                                className="w-full p-2 border rounded-md"
                                required={field.required}
                            />
                        )}

                        {field.type === 'textarea' && (
                            <textarea
                                value={config[field.key] || ''}
                                onChange={(e) => handleConfigChange(field.key, e.target.value)}
                                className="w-full p-2 border rounded-md h-24"
                                required={field.required}
                            />
                        )}

                        {field.type === 'select' && (
                            <select
                                value={config[field.key] || field.default || ''}
                                onChange={(e) => handleConfigChange(field.key, e.target.value)}
                                className="w-full p-2 border rounded-md"
                                required={field.required}
                            >
                                {field.options.map(option => (
                                    <option key={option} value={option}>
                                        {option.replace('_', ' ').toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex items-center gap-1">
                    <Plus size={14} />
                    Create Task
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    );
};

// Main AI Agent Task Manager Component
const AIAgentTaskManager = () => {
    const [tasks, setTasks] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showNewTaskForm, setShowNewTaskForm] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [activeTab, setActiveTab] = useState('tasks');

    const taskService = new AIAgentTaskService();

    // Load tasks and statistics
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [tasksResponse, statsResponse] = await Promise.all([
                taskService.getTasks(),
                taskService.getTaskStatistics()
            ]);

            setTasks(tasksResponse.results || tasksResponse);
            setStatistics(statsResponse);
            setError(null);
        } catch (err) {
            setError(err.message);
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load data on component mount
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Auto-refresh active tasks
    useEffect(() => {
        const interval = setInterval(() => {
            const hasActiveTasks = tasks.some(task => task.isActive);
            if (hasActiveTasks) {
                loadData();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [tasks, loadData]);

    // Handle task creation
    const handleCreateTask = async (taskData) => {
        try {
            await taskService.createTask(taskData);
            setShowNewTaskForm(false);
            loadData(); // Refresh task list
        } catch (err) {
            setError(`Failed to create task: ${err.message}`);
        }
    };

    // Handle task cancellation
    const handleCancelTask = async (taskId) => {
        try {
            await taskService.cancelTask(taskId);
            loadData(); // Refresh task list
        } catch (err) {
            setError(`Failed to cancel task: ${err.message}`);
        }
    };

    // Handle task retry
    const handleRetryTask = async (taskId) => {
        try {
            await taskService.retryTask(taskId);
            loadData(); // Refresh task list
        } catch (err) {
            setError(`Failed to retry task: ${err.message}`);
        }
    };

    // Handle task view
    const handleViewTask = (task) => {
        setSelectedTask(task);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="text-3xl font-bold" role="heading" aria-level="1">AI Agent Tasks</div>
                    <div className="text-muted-foreground">
                        Manage and monitor your AI agent tasks
                    </div>
                </div>

                {!showNewTaskForm && (
                    <Button
                        onClick={() => setShowNewTaskForm(true)}
                        className="flex items-center gap-2"
                    >
                        <Plus size={16} />
                        New Task
                    </Button>
                )}
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {showNewTaskForm ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Create New AI Agent Task</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <NewTaskForm
                            onSubmit={handleCreateTask}
                            onCancel={() => setShowNewTaskForm(false)}
                        />
                    </CardContent>
                </Card>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-6">
                        <TabsTrigger value="tasks">Tasks</TabsTrigger>
                        <TabsTrigger value="statistics">Statistics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="tasks">
                        <div className="space-y-4">
                            {tasks.length === 0 ? (
                                <Card>
                                    <CardContent className="text-center py-12">
                                        <div className="text-muted-foreground">
                                            No tasks found. Create your first AI agent task to get started.
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {tasks.map(task => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            onCancel={handleCancelTask}
                                            onRetry={handleRetryTask}
                                            onView={handleViewTask}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="statistics">
                        {statistics && (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Task Overview</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span>Total Tasks:</span>
                                                <span className="font-medium">{statistics.statistics.totalTasks}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Running:</span>
                                                <span className="font-medium text-blue-600">
                                                    {statistics.statistics.runningTasks}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Completed:</span>
                                                <span className="font-medium text-green-600">
                                                    {statistics.statistics.completedTasks}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Failed:</span>
                                                <span className="font-medium text-red-600">
                                                    {statistics.statistics.failedTasks}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Task Types</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {Object.entries(statistics.taskTypes).map(([type, data]) => (
                                                <div key={type} className="flex justify-between">
                                                    <span className="capitalize">{data.label}:</span>
                                                    <span className="font-medium">{data.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Recent Activity</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {statistics.recentActivity.count}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                tasks in the last {statistics.recentActivity.period}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            {/* Task Detail Modal - would implement this as a separate component */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>{selectedTask.title}</CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedTask(null)}
                                >
                                    Close
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <div className="font-medium mb-2" role="heading" aria-level="3">Task Configuration</div>
                                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                                        {JSON.stringify(selectedTask.taskConfig, null, 2)}
                                    </pre>
                                </div>

                                {selectedTask.resultData && Object.keys(selectedTask.resultData).length > 0 && (
                                    <div>
                                        <div className="font-medium mb-2" role="heading" aria-level="3">Results</div>
                                        <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                                            {JSON.stringify(selectedTask.resultData, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AIAgentTaskManager;
