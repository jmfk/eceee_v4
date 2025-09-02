import React from 'react'
import { Calendar, MapPin, Clock } from 'lucide-react'

/**
 * EventsRenderer - React renderer for Events widgets
 */
const EventsRenderer = ({ configuration }) => {
  const {
    title = 'Upcoming Events',
    items_count = 3,
    show_location = true,
    show_time = true,
    show_description = true,
    css_class = ''
  } = configuration

  // Mock events for preview
  const mockEvents = Array.from({ length: items_count }, (_, i) => ({
    id: i + 1,
    title: `Event ${i + 1}`,
    date: new Date(Date.now() + (i + 1) * 86400000).toLocaleDateString(),
    time: '10:00 AM',
    location: 'Conference Room A',
    description: 'Join us for this exciting event.'
  }))

  return (
    <div className={`events-widget ${css_class}`}>
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      
      <div className="space-y-4">
        {mockEvents.map(event => (
          <div key={event.id} className="event-item bg-gray-50 p-4 rounded-lg">
            <h4 className="text-lg font-semibold mb-2">{event.title}</h4>
            
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{event.date}</span>
              </div>
              
              {show_time && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{event.time}</span>
                </div>
              )}
              
              {show_location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>
            
            {show_description && (
              <p className="text-gray-700 mt-2">{event.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default EventsRenderer