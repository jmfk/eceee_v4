import { useState } from 'react'
import { Calendar, MapPin, Clock, Users, ExternalLink, Eye, DollarSign } from 'lucide-react'
import BaseWidgetEditor from './BaseWidgetEditor'

/**
 * EventsEditor - Specialized editor for Events widgets
 * 
 * Features:
 * - Event title and description editing
 * - Start and end date/time controls
 * - Location and venue information
 * - Registration URL and pricing
 * - Capacity management
 * - Event type categorization
 * - Live event preview
 */
const EventsEditor = ({ config, onChange, errors, widgetType }) => {
    const [showPreview, setShowPreview] = useState(false)

    const eventTypeOptions = [
        { value: 'conference', label: 'Conference' },
        { value: 'workshop', label: 'Workshop' },
        { value: 'seminar', label: 'Seminar' },
        { value: 'meeting', label: 'Meeting' },
        { value: 'social', label: 'Social Event' },
        { value: 'other', label: 'Other' }
    ]

    // Format datetime for input field
    const formatDateTimeForInput = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        // Return in format: YYYY-MM-DDTHH:MM
        return date.toISOString().slice(0, 16)
    }

    // Calculate event duration
    const getEventDuration = (startDateParam, endDateParam) => {
        const start = startDateParam || config?.start_date
        const end = endDateParam || config?.end_date

        if (!start || !end) return null

        const startDate = new Date(start)
        const endDate = new Date(end)
        const diffMs = endDate - startDate

        if (diffMs <= 0) return 'Invalid duration'

        const hours = Math.floor(diffMs / (1000 * 60 * 60))
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

        if (hours === 0) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`
        } else if (minutes === 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`
        } else {
            return `${hours}h ${minutes}m`
        }
    }

    const renderEventPreview = () => {
        const previewConfig = config || {}
        const duration = getEventDuration(previewConfig.start_date, previewConfig.end_date)

        return (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="p-6">
                    {/* Event Header */}
                    <div className="mb-4">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-xl font-bold text-gray-900">
                                {previewConfig.event_title || 'Event Title'}
                            </h3>
                            {previewConfig.event_type && (
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                    {previewConfig.event_type.charAt(0).toUpperCase() + previewConfig.event_type.slice(1)}
                                </span>
                            )}
                        </div>

                        {previewConfig.description && (
                            <p className="text-gray-700 mb-4">{previewConfig.description}</p>
                        )}
                    </div>

                    {/* Event Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Date and Time */}
                        {previewConfig.start_date && (
                            <div className="flex items-start space-x-3">
                                <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-sm text-gray-900">Date & Time</div>
                                    <div className="text-sm text-gray-600">
                                        <div>Start: {new Date(previewConfig.start_date).toLocaleString()}</div>
                                        {previewConfig.end_date && (
                                            <div>End: {new Date(previewConfig.end_date).toLocaleString()}</div>
                                        )}
                                        {duration && (
                                            <div className="text-xs text-gray-500 mt-1">Duration: {duration}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Location */}
                        {previewConfig.location && (
                            <div className="flex items-start space-x-3">
                                <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-sm text-gray-900">Location</div>
                                    <div className="text-sm text-gray-600">{previewConfig.location}</div>
                                </div>
                            </div>
                        )}

                        {/* Price */}
                        {previewConfig.price && (
                            <div className="flex items-start space-x-3">
                                <DollarSign className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-sm text-gray-900">Price</div>
                                    <div className="text-sm text-gray-600">{previewConfig.price}</div>
                                </div>
                            </div>
                        )}

                        {/* Capacity */}
                        {previewConfig.capacity && (
                            <div className="flex items-start space-x-3">
                                <Users className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-sm text-gray-900">Capacity</div>
                                    <div className="text-sm text-gray-600">{previewConfig.capacity} attendees</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Registration Button */}
                    {previewConfig.registration_url && (
                        <div className="pt-4 border-t border-gray-200">
                            <button
                                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                                onClick={() => window.open(previewConfig.registration_url, '_blank')}
                            >
                                <span>Register for Event</span>
                                <ExternalLink className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
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
                renderTextArea,
                renderSelectField,
                renderUrlField
            }) => (
                <>
                    {/* Event Title */}
                    {renderTextField('event_title', 'Event Title', {
                        placeholder: 'Enter the name of your event'
                    })}

                    {/* Event Description */}
                    {renderTextArea('description', 'Event Description (Optional)', {
                        placeholder: 'Provide a brief description of the event',
                        rows: 4
                    })}

                    {/* Date and Time Section */}
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-sm font-medium text-blue-900 flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>Event Schedule</span>
                        </h4>

                        {/* Start Date/Time */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Start Date & Time *
                            </label>
                            <input
                                type="datetime-local"
                                value={formatDateTimeForInput(localConfig.start_date)}
                                onChange={(e) => handleFieldChange('start_date', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.start_date ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                                    }`}
                            />
                            {errors.start_date && (
                                <div className="flex items-center space-x-1 text-red-600">
                                    <span className="text-xs">{errors.start_date}</span>
                                </div>
                            )}
                        </div>

                        {/* End Date/Time */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                End Date & Time (Optional)
                            </label>
                            <input
                                type="datetime-local"
                                value={formatDateTimeForInput(localConfig.end_date)}
                                onChange={(e) => handleFieldChange('end_date', e.target.value)}
                                min={formatDateTimeForInput(localConfig.start_date)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.end_date ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                                    }`}
                            />
                            {getEventDuration(localConfig.start_date, localConfig.end_date) && (
                                <div className="text-xs text-blue-600">
                                    Event duration: {getEventDuration(localConfig.start_date, localConfig.end_date)}
                                </div>
                            )}
                            {errors.end_date && (
                                <div className="flex items-center space-x-1 text-red-600">
                                    <span className="text-xs">{errors.end_date}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Location */}
                    {renderTextField('location', 'Location/Venue (Optional)', {
                        placeholder: 'Event venue or address'
                    })}

                    {/* Registration URL */}
                    {renderUrlField('registration_url', 'Registration URL (Optional)', {
                        placeholder: 'https://example.com/register'
                    })}

                    {/* Event Details Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Price */}
                        {renderTextField('price', 'Price (Optional)', {
                            placeholder: 'Free, $25, $10-50, etc.'
                        })}

                        {/* Capacity */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Capacity (Optional)
                            </label>
                            <input
                                type="number"
                                value={localConfig.capacity || ''}
                                onChange={(e) => handleFieldChange('capacity', e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="Maximum attendees"
                                min="1"
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.capacity ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                                    }`}
                            />
                            {errors.capacity && (
                                <div className="flex items-center space-x-1 text-red-600">
                                    <span className="text-xs">{errors.capacity}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Event Type */}
                    {renderSelectField('event_type', 'Event Type', eventTypeOptions)}

                    {/* Live Preview Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                            Event Preview
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

                    {/* Event Preview */}
                    {showPreview && (
                        <div className="space-y-2">
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                {renderEventPreview()}
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>• Preview shows how the event will appear to visitors</p>
                                <p>• Registration button appears if URL is provided</p>
                                <p>• Event duration is calculated automatically</p>
                            </div>
                        </div>
                    )}

                    {/* Event Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-900">Event Management Tips</h4>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• Use clear, descriptive event titles</li>
                                    <li>• Include specific date, time, and location details</li>
                                    <li>• Add registration links for easy sign-ups</li>
                                    <li>• Specify pricing clearly (use "Free" if no cost)</li>
                                    <li>• Set capacity limits to manage attendance</li>
                                    <li>• Choose appropriate event types for categorization</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </BaseWidgetEditor>
    )
}

export default EventsEditor 