# Notification System

## Overview

The Notification System provides a centralized way to display user-friendly notifications throughout the application. It supports multiple notification types (error, warning, info, success) and automatically closes notifications after a configurable duration.

## Architecture

### Core Components

1. **Notification Component** (`src/components/Notification.jsx`)
   - Displays individual notifications with auto-closing functionality
   - Supports multiple types: error, warning, info, success
   - Positioned in top-right corner with smooth animations
   - Configurable duration (default: 5000ms)

2. **NotificationManager Component** (`src/components/NotificationManager.jsx`)
   - Manages multiple notifications simultaneously
   - Provides React Context for global access
   - Renders all active notifications

3. **useNotifications Hook** (`src/hooks/useNotifications.js`)
   - Centralized state management for notifications
   - Provides methods to show, remove, and clear notifications
   - Maintains backward compatibility with error-specific methods

### Context Provider

The `NotificationProvider` wraps the application in `App.jsx` to provide global access to the notification system:

```jsx
import { NotificationProvider } from './components/NotificationManager'

function App() {
  return (
    <NotificationProvider>
      <Router>
        {/* Your app components */}
      </Router>
    </NotificationProvider>
  )
}
```

## Usage

### Basic Usage

```jsx
import { useNotificationContext } from './components/NotificationManager'

function MyComponent() {
  const { showNotification } = useNotificationContext()

  const handleError = () => {
    showNotification('Something went wrong!', 'error')
  }

  const handleSuccess = () => {
    showNotification('Operation completed successfully!', 'success')
  }

  return (
    <div>
      <button onClick={handleError}>Trigger Error</button>
      <button onClick={handleSuccess}>Trigger Success</button>
    </div>
  )
}
```

### Backward Compatibility

The system maintains backward compatibility with the previous error popup API:

```jsx
// These still work (aliases to new methods)
const { showError, removeError, clearAllErrors } = useNotificationContext()

showError('Error message') // Equivalent to showNotification('Error message', 'error')
```

### Notification Types

- **error**: Red styling with AlertCircle icon
- **warning**: Yellow styling with AlertTriangle icon  
- **info**: Blue styling with Info icon
- **success**: Green styling with CheckCircle icon

### Configuration

Each notification can be configured with:

- `message`: The notification text or error object
- `type`: One of 'error', 'warning', 'info', 'success' (default: 'error')
- `duration`: Auto-close duration in milliseconds (default: 5000)

## Features

### Auto-Closing
Notifications automatically close after the specified duration (default: 5 seconds). Users can also manually close them using the X button.

### Multiple Notifications
The system can display multiple notifications simultaneously, stacking them in the top-right corner.

### Error Object Support
The system can handle both simple strings and complex error objects:

```jsx
// Simple string
showNotification('Simple error message')

// Error object with details
showNotification({
  message: 'API Error',
  response: {
    data: {
      detail: 'Additional error details'
    }
  },
  stack: 'Error stack trace...'
})
```

### Development Mode
In development mode, error stack traces are displayed for debugging purposes.

## Styling

Notifications use Tailwind CSS classes and include:
- Smooth slide-in/out animations
- Type-specific colors and icons
- Responsive design
- Hover effects on close button
- Proper accessibility attributes

## Testing

The notification system includes comprehensive tests covering:
- Component rendering and behavior
- Auto-closing functionality
- Different notification types
- Context provider functionality
- Error object handling

Run tests with:
```bash
docker-compose exec frontend npm run test:run -- Notification.test.jsx NotificationManager.test.jsx
```

## Migration from Error Popup System

The system was refactored from a persistent error popup to a transient notification system:

### Key Changes
1. **Component Renames**:
   - `ErrorPopup` → `Notification`
   - `ErrorPopupManager` → `NotificationManager`
   - `useErrorPopup` → `useNotifications`

2. **Behavior Changes**:
   - Auto-closing instead of persistent display
   - Top-right positioning instead of centered modal
   - Support for multiple notification types
   - Smoother animations

3. **API Changes**:
   - `showError(error)` → `showNotification(message, type)`
   - Added support for success, warning, and info types
   - Maintained backward compatibility with error-specific methods

### Migration Guide
Existing code using the error popup system will continue to work without changes due to backward compatibility aliases. However, consider updating to use the new notification API for better type support and consistency. 