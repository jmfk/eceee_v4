# Enhanced Template Error Debugging

## Overview

The eceee_v4 frontend now includes enhanced error debugging for widget and template rendering issues. Instead of generic "[Element processing error]" messages, you'll now get detailed debugging information to help identify and fix rendering problems.

## Features

### 🔍 Detailed Error Information
- **Error Message**: Specific error details instead of generic messages
- **Structure Context**: Shows the template structure type, tag, and attributes that failed
- **Configuration Data**: Displays relevant widget configuration (in debug mode)
- **Stack Trace**: Full error stack trace for debugging
- **Timestamp**: When the error occurred

### 🎨 Visual Error Indicators
- **Color-coded Errors**: Red styling for different error types
- **Contextual Information**: Shows what was being processed when the error occurred
- **Click-to-Debug**: Click on error messages (in debug mode) for detailed console output

### 🐛 Debug Mode

Debug mode is automatically enabled during development (localhost) but can be controlled manually:

#### Enable Debug Mode Globally
```javascript
// In browser console or your code
window.enableTemplateDebug(true);  // Enable
window.enableTemplateDebug(false); // Disable
```

#### For Individual Renderer Instances
```javascript
const renderer = new DjangoTemplateRenderer({ debug: true });
// or
renderer.setDebugMode(true);
```

## Error Types and Information

### Element Processing Errors
When a widget element fails to render, you'll see:
- **Error Type**: "Element Processing Error"
- **Element Info**: Tag name, structure type
- **Attribute Info**: Failed attributes (first 3 shown)
- **Config Context**: Widget configuration keys (in debug mode)

Example error display:
```
Element Processing Error: Cannot read property 'undefined' of null
Type: element, Tag: button
Attributes: class, id, onclick
Config keys: title, color, action...
```

### Text Processing Errors
When text content fails to render:
- **Error Type**: "Text Processing Error"
- **Content Preview**: First 50 characters of failed content
- **Template Variables**: Shows failed template variable resolution

Example error display:
```
Text Processing Error: Invalid template syntax
Content: "Welcome {{user.name|default:'Guest'}}..."
```

### Template Structure Errors
For unknown or malformed template structures:
- **Structure Type**: Shows the unrecognized structure type
- **Error Context**: What was attempted

## Debugging Workflow

### 1. Enable Debug Mode (if not already enabled)
```javascript
window.enableTemplateDebug();
```

### 2. Reproduce the Error
Navigate to the page/widget that's showing the error.

### 3. Check Error Details
Look for the enhanced error message in the UI, which will show:
- Specific error message
- Structure information
- Context about what failed

### 4. Click for Full Debug Info (Debug Mode)
Click on the error message to get a detailed console log with:
- Complete error stack trace
- Full template structure
- Complete widget configuration
- Timestamp

### 5. Check Console Logs
Enhanced error logging provides structured information:
```javascript
{
  error: "Cannot read property 'undefined' of null",
  stack: "Error: Cannot read property...",
  structure: { type: "element", tag: "button", ... },
  config: { title: "Click me", color: "blue", ... },
  timestamp: "2024-01-20T10:30:45.123Z"
}
```

## Common Error Scenarios

### Missing Widget Configuration
**Error**: `Cannot read property 'title' of undefined`
**Cause**: Widget expects configuration that wasn't provided
**Solution**: Check widget configuration object

### Invalid Template Syntax
**Error**: `Invalid template syntax in variable`
**Cause**: Malformed template variables like `{{config.}`
**Solution**: Fix template variable syntax

### Missing Widget Methods
**Error**: `render is not a function`
**Cause**: Widget class missing required methods
**Solution**: Implement missing widget methods

### DOM Manipulation Errors
**Error**: `Cannot appendChild of null`
**Cause**: Trying to append to non-existent DOM element
**Solution**: Check element creation and DOM structure

## Performance Impact

The enhanced error handling has minimal performance impact:
- Error details are only generated when errors occur
- Debug information is only collected in debug mode
- Click handlers are only added in debug mode
- Console logging is structured and efficient

## Development vs Production

### Development (localhost)
- Debug mode enabled by default
- Full error details shown
- Click-to-debug functionality
- Detailed console logging

### Production
- Debug mode disabled by default
- Basic error messages shown
- Minimal console logging
- Can be enabled manually if needed

## Best Practices

1. **Enable Debug Mode During Development**
   ```javascript
   window.enableTemplateDebug();
   ```

2. **Check Console for Structured Errors**
   Look for grouped console messages with full context

3. **Use Click-to-Debug**
   Click error messages to get detailed debugging information

4. **Test Error Scenarios**
   Intentionally create errors to test error handling

5. **Disable Debug in Production**
   Ensure debug mode is disabled in production builds

## Troubleshooting

### Error Messages Not Showing Details
- Check if debug mode is enabled: `window.TEMPLATE_DEBUG_MODE`
- Enable debug mode: `window.enableTemplateDebug()`

### Click-to-Debug Not Working
- Ensure debug mode is enabled
- Check browser console for any JavaScript errors

### Too Much Debug Information
- Disable debug mode: `window.enableTemplateDebug(false)`
- Use individual renderer debug control

This enhanced error system transforms widget debugging from guesswork into systematic problem solving with detailed, actionable information.