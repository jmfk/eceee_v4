import { useState } from 'react'
import { Calendar, Plus, Trash2, Edit3, Eye, Settings } from 'lucide-react'
import BaseWidgetEditor from './BaseWidgetEditor'

/**
 * CalendarEditor - Specialized editor for Calendar widgets
 * 
 * Features:
 * - Calendar title and view type selection
 * - Event management (add, edit, delete events)
 * - Calendar display settings
 * - Live calendar preview
 * - Event source configuration
 */
const CalendarEditor = ({ config, onChange, errors, widgetType }) => {
    const [showPreview, setShowPreview] = useState(false)
    const [editingEvent, setEditingEvent] = useState(null)
    const [showEventForm, setShowEventForm] = useState(false)

    const viewTypeOptions = [
        { value: 'month', label: 'Month View' },
        { value: 'week', label: 'Week View' },
        { value: 'agenda', label: 'Agenda View' }
    ]

    const eventSourceOptions = [
        { value: 'manual', label: 'Manual Events' },
        { value: 'api', label: 'API Source' },
        { value: 'external', label: 'External Calendar' }
    ]

    // Format date for input field
    const formatDateForInput = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        return date.toISOString().split('T')[0]
    }

    // Add or update event
    const handleEventSave = (eventData) => {
        const events = config?.events || []
        const eventId = editingEvent?.id || Date.now().toString()

        const updatedEvent = {
            ...eventData,
            id: eventId
        }

        let updatedEvents
        if (editingEvent) {
            updatedEvents = events.map(event =>
                event.id === eventId ? updatedEvent : event
            )
        } else {
            updatedEvents = [...events, updatedEvent]
        }

        onChange({
            ...config,
            events: updatedEvents
        })

        setEditingEvent(null)
        setShowEventForm(false)
    }

    // Delete event
    const handleEventDelete = (eventId) => {
        const events = config?.events || []
        const updatedEvents = events.filter(event => event.id !== eventId)
        onChange({
            ...config,
            events: updatedEvents
        })
    }

    // Generate calendar preview
    const renderCalendarPreview = () => {
        const previewConfig = config || {}
        const events = previewConfig.events || []
        const viewType = previewConfig.view_type || 'month'

        // Simple calendar representation
        const today = new Date()
        const currentMonth = today.getMonth()
        const currentYear = today.getFullYear()

        // Get events for current month
        const monthEvents = events.filter(event => {
            const eventDate = new Date(event.date)
            return eventDate.getMonth() === currentMonth &&
                eventDate.getFullYear() === currentYear
        })

        return (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {/* Calendar Header */}
                <div className="bg-blue-600 text-white p-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">
                            {previewConfig.title || 'Calendar'}
                        </h3>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs bg-blue-500 px-2 py-1 rounded">
                                {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
                            </span>
                        </div>
                    </div>
                    <div className="text-sm opacity-90 mt-1">
                        {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                </div>

                {/* Calendar Content */}
                <div className="p-4">
                    {viewType === 'month' && (
                        <div className="space-y-4">
                            {/* Month grid representation */}
                            <div className="grid grid-cols-7 gap-1 text-center text-xs">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <div key={day} className="font-medium text-gray-600 p-2">
                                        {day}
                                    </div>
                                ))}
                                {/* Sample calendar days */}
                                {Array.from({ length: 35 }, (_, i) => {
                                    const dayNumber = i - 5 + 1 // Offset for month start
                                    const isCurrentMonth = dayNumber > 0 && dayNumber <= 31
                                    const isToday = dayNumber === today.getDate()
                                    const hasEvent = monthEvents.some(event =>
                                        new Date(event.date).getDate() === dayNumber
                                    )

                                    return (
                                        <div
                                            key={i}
                                            className={`p-2 h-8 flex items-center justify-center text-xs ${!isCurrentMonth ? 'text-gray-300' :
                                                    isToday ? 'bg-blue-100 text-blue-800 font-bold rounded' :
                                                        hasEvent ? 'bg-green-100 text-green-800 rounded' :
                                                            'text-gray-700'
                                                }`}
                                        >
                                            {isCurrentMonth ? dayNumber : ''}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {viewType === 'agenda' && (
                        <div className="space-y-3">
                            <h4 className="font-medium text-gray-900">Upcoming Events</h4>
                            {events.length > 0 ? (
                                <div className="space-y-2">
                                    {events.slice(0, 5).map(event => (
                                        <div key={event.id} className="flex items-start space-x-3 p-2 bg-gray-50 rounded">
                                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">{event.title}</div>
                                                <div className="text-xs text-gray-600">
                                                    {new Date(event.date).toLocaleDateString()}
                                                    {event.time && ` at ${event.time}`}
                                                </div>
                                                {event.description && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {event.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-4">
                                    No events scheduled
                                </div>
                            )}
                        </div>
                    )}

                    {viewType === 'week' && (
                        <div className="space-y-3">
                            <h4 className="font-medium text-gray-900">This Week</h4>
                            <div className="grid grid-cols-7 gap-2">
                                {Array.from({ length: 7 }, (_, i) => {
                                    const date = new Date()
                                    date.setDate(date.getDate() - date.getDay() + i)
                                    const dayEvents = events.filter(event =>
                                        new Date(event.date).toDateString() === date.toDateString()
                                    )

                                    return (
                                        <div key={i} className="border rounded p-2 h-20 overflow-hidden">
                                            <div className="text-xs font-medium text-gray-600">
                                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                            </div>
                                            <div className="text-sm font-bold">
                                                {date.getDate()}
                                            </div>
                                            {dayEvents.map(event => (
                                                <div key={event.id} className="text-xs bg-blue-100 text-blue-800 px-1 rounded mt-1 truncate">
                                                    {event.title}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Event Legend */}
                    {events.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center space-x-4 text-xs">
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                    <span className="text-gray-600">Today</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                                    <span className="text-gray-600">Has Events</span>
                                </div>
                                <span className="text-gray-500">{events.length} total events</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Event form component
    const EventForm = ({ event, onSave, onCancel }) => {
        const [formData, setFormData] = useState({
            title: event?.title || '',
            date: event?.date || '',
            time: event?.time || '',
            description: event?.description || ''
        })

        const handleSubmit = (e) => {
            e.preventDefault()
            if (formData.title && formData.date) {
                onSave({
                    ...formData,
                    id: event?.id
                })
            }
        }

        return (
            <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">
                        {event ? 'Edit Event' : 'Add New Event'}
                    </h4>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        ×
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Event Title *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Event title"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date *
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Time (Optional)
                        </label>
                        <input
                            type="time"
                            value={formData.time}
                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description (Optional)
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Event description"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        {event ? 'Update Event' : 'Add Event'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        )
    }

    return (
        <BaseWidgetEditor
            config={config}
            onChange={onChange}
            errors={errors}
            widgetType={widgetType}
        >
            {({
                config: localConfig,
                handleFieldChange,
                renderTextField,
                renderSelectField,
                renderCheckboxField,
                renderDateField
            }) => (
                <>
                    {/* Calendar Title */}
                    {renderTextField('title', 'Calendar Title (Optional)', {
                        placeholder: 'Enter a title for your calendar'
                    })}

                    {/* View Type */}
                    {renderSelectField('view_type', 'Calendar View', viewTypeOptions)}

                    {/* Default Date */}
                    {renderDateField('default_date', 'Default Date (Optional)')}

                    {/* Event Source */}
                    {renderSelectField('event_source', 'Event Source', eventSourceOptions)}

                    {/* Manual Events Management */}
                    {localConfig.event_source !== 'api' && localConfig.event_source !== 'external' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700">
                                    Calendar Events
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowEventForm(true)}
                                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Event</span>
                                </button>
                            </div>

                            {/* Event Form */}
                            {showEventForm && (
                                <EventForm
                                    event={editingEvent}
                                    onSave={handleEventSave}
                                    onCancel={() => {
                                        setShowEventForm(false)
                                        setEditingEvent(null)
                                    }}
                                />
                            )}

                            {/* Events List */}
                            <div className="space-y-2">
                                {(localConfig.events || []).map(event => (
                                    <div key={event.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                        <div className="flex-1">
                                            <div className="font-medium text-sm">{event.title}</div>
                                            <div className="text-xs text-gray-600">
                                                {new Date(event.date).toLocaleDateString()}
                                                {event.time && ` at ${event.time}`}
                                            </div>
                                            {event.description && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {event.description}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingEvent(event)
                                                    setShowEventForm(true)
                                                }}
                                                className="p-1 text-gray-400 hover:text-blue-600"
                                                title="Edit event"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleEventDelete(event.id)}
                                                className="p-1 text-gray-400 hover:text-red-600"
                                                title="Delete event"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {(!localConfig.events || localConfig.events.length === 0) && (
                                    <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
                                        <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                        <p>No events added yet</p>
                                        <p className="text-xs">Click "Add Event" to get started</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Calendar Settings */}
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                            <Settings className="w-4 h-4" />
                            <span>Display Settings</span>
                        </h4>

                        {renderCheckboxField(
                            'show_navigation',
                            'Show navigation controls',
                            'Allow users to navigate between months/weeks'
                        )}

                        {renderCheckboxField(
                            'highlight_today',
                            'Highlight current date',
                            'Visually emphasize today\'s date'
                        )}
                    </div>

                    {/* Live Preview Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                            Calendar Preview
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                            <Eye className="w-3 h-3" />
                            <span>{showPreview ? 'Hide' : 'Show'} Preview</span>
                        </button>
                    </div>

                    {/* Calendar Preview */}
                    {showPreview && (
                        <div className="space-y-2">
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                {renderCalendarPreview()}
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>• Preview shows current month with your events</p>
                                <p>• Different view types display events differently</p>
                                <p>• Blue highlights indicate today, green shows event days</p>
                            </div>
                        </div>
                    )}

                    {/* Calendar Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-900">Calendar Best Practices</h4>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• Use descriptive event titles for clarity</li>
                                    <li>• Include specific times for scheduled events</li>
                                    <li>• Add brief descriptions for context</li>
                                    <li>• Choose the right view type for your audience</li>
                                    <li>• Keep event information up to date</li>
                                    <li>• Consider using different colors for event types</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </BaseWidgetEditor>
    )
}

export default CalendarEditor 