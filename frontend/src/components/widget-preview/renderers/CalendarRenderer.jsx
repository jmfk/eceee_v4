import React from 'react'

/**
 * CalendarRenderer - React renderer for Calendar widgets
 */
const CalendarRenderer = ({ configuration }) => {
  const {
    month = new Date().getMonth() + 1,
    year = new Date().getFullYear(),
    show_events = true,
    css_class = ''
  } = configuration

  // Generate calendar days
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()

  const days = []
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return (
    <div className={`calendar-widget ${css_class}`}>
      <div className="calendar-header text-center mb-4">
        <h3 className="text-xl font-bold">
          {monthNames[month - 1]} {year}
        </h3>
      </div>
      
      <div className="calendar-grid">
        <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-gray-600">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <div
              key={index}
              className={`p-2 text-center border rounded ${
                day ? 'bg-white hover:bg-gray-50' : ''
              } ${
                day === new Date().getDate() && 
                month === new Date().getMonth() + 1 && 
                year === new Date().getFullYear()
                  ? 'bg-blue-100 font-bold'
                  : ''
              }`}
            >
              {day || ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CalendarRenderer