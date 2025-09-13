# Website Rendering API Documentation

This document describes the website rendering feature that allows you to capture screenshots of external websites as PNG images.

## Overview

The website rendering feature provides a secure, server-side solution for capturing screenshots of external websites. It uses Playwright (Chromium) to render websites and return them as PNG images.

## Features

- **Secure URL validation**: Blocks access to internal/private networks
- **Configurable viewport sizes**: Customize screenshot dimensions
- **Full page or viewport capture**: Choose between capturing just the visible area or the entire page
- **Timeout handling**: Configurable timeouts to prevent hanging requests
- **Authentication required**: All endpoints require user authentication

## API Endpoints

### 1. Render Website to PNG

**Endpoint**: `POST /api/v1/utils/render-website/`

**Description**: Renders an external website and returns the screenshot as a PNG image.

**Authentication**: Required

**Request Body**:
```json
{
  "url": "https://example.com",
  "viewport_width": 1920,     // optional, default: 1920
  "viewport_height": 1080,    // optional, default: 1080
  "full_page": false,         // optional, default: false
  "timeout": 30000           // optional, default: 30000 (30 seconds)
}
```

**Response**:
- **Success (200)**: Binary PNG image data with headers:
  - `Content-Type: image/png`
  - `Content-Disposition: attachment; filename="website_screenshot.png"`
  - `Content-Length: [size in bytes]`
- **Error (400)**: JSON error response for invalid URLs or parameters
- **Error (500)**: JSON error response for server errors

**Example Usage**:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com", "full_page": true}' \
  http://localhost:8000/api/v1/utils/render-website/ \
  --output screenshot.png
```

### 2. Validate Website URL

**Endpoint**: `POST /api/v1/utils/render-website-info/`

**Description**: Validates a URL and returns available rendering options without actually rendering the website.

**Authentication**: Required

**Request Body**:
```json
{
  "url": "https://example.com"
}
```

**Response**:
```json
{
  "valid": true,
  "url": "https://example.com",
  "message": "URL is valid and can be rendered",
  "default_config": {
    "viewport_width": 1920,
    "viewport_height": 1080,
    "timeout": 30000,
    "wait_for_load_state": "networkidle",
    "full_page": false,
    "quality": 90
  },
  "available_options": {
    "viewport_width": "Width of the browser viewport (default: 1920)",
    "viewport_height": "Height of the browser viewport (default: 1080)",
    "full_page": "Capture full page or just viewport (default: false)",
    "timeout": "Maximum time to wait for page load in milliseconds (default: 30000)"
  }
}
```

## Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `viewport_width` | integer | 1920 | Width of the browser viewport in pixels |
| `viewport_height` | integer | 1080 | Height of the browser viewport in pixels |
| `full_page` | boolean | false | Whether to capture the full page or just the viewport |
| `timeout` | integer | 30000 | Maximum time to wait for page load (milliseconds) |

## Security Features

### URL Validation

The service includes security measures to prevent access to internal resources:

**Blocked Domains/IPs**:
- `localhost`
- `127.0.0.1`
- `0.0.0.0`
- Private IP ranges (`10.*`, `172.*`, `192.168.*`)
- Internal domains (`.local`, `internal`)

**Allowed Schemes**:
- `http://`
- `https://`

### Error Handling

The service provides detailed error messages for different failure scenarios:

- **Invalid URL format**: Malformed URLs
- **Blocked domains**: Attempts to access internal resources
- **Timeout errors**: Pages that take too long to load
- **Network errors**: Connection failures
- **Rendering errors**: Browser-related issues

## Usage Examples

### Python (using requests)

```python
import requests

# Render a website
response = requests.post(
    'http://localhost:8000/api/v1/utils/render-website/',
    headers={
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json'
    },
    json={
        'url': 'https://www.github.com',
        'viewport_width': 1280,
        'viewport_height': 720,
        'full_page': True
    }
)

if response.status_code == 200:
    with open('github_screenshot.png', 'wb') as f:
        f.write(response.content)
    print("Screenshot saved!")
else:
    print(f"Error: {response.json()}")
```

### JavaScript (using fetch)

```javascript
const renderWebsite = async (url, options = {}) => {
  try {
    const response = await fetch('/api/v1/utils/render-website/', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        ...options
      })
    });

    if (response.ok) {
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      
      // Display or download the image
      const img = document.createElement('img');
      img.src = imageUrl;
      document.body.appendChild(img);
    } else {
      const error = await response.json();
      console.error('Rendering failed:', error);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
};

// Usage
renderWebsite('https://www.example.com', {
  viewport_width: 1920,
  viewport_height: 1080,
  full_page: true
});
```

## Testing

### Management Command

Test the rendering functionality using the Django management command:

```bash
# Basic test
python manage.py test_website_rendering

# Test specific URL
python manage.py test_website_rendering --url https://www.github.com

# Save screenshot to file
python manage.py test_website_rendering --url https://www.github.com --save-file /tmp/github.png

# Custom viewport size
python manage.py test_website_rendering --url https://www.github.com --viewport-width 1280 --viewport-height 720

# Full page screenshot
python manage.py test_website_rendering --url https://www.github.com --full-page
```

### Docker Installation

The feature requires Playwright and Chromium to be installed. This is handled automatically in the Docker container, but for local development:

```bash
# Install Playwright browsers
pip install playwright
playwright install chromium
```

## Performance Considerations

- **Memory Usage**: Each rendering process uses significant memory (100-200MB per request)
- **CPU Usage**: Rendering is CPU-intensive
- **Network**: Downloads the entire webpage and its resources
- **Timeouts**: Configure appropriate timeouts based on expected page load times

## Limitations

- Only supports HTTP/HTTPS URLs
- Cannot access password-protected sites
- JavaScript-heavy sites may take longer to render
- Large pages may consume significant resources
- No support for custom authentication headers

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success - PNG image returned |
| 400 | Bad Request - Invalid URL or parameters |
| 401 | Unauthorized - Authentication required |
| 500 | Internal Server Error - Rendering failed |

## Troubleshooting

### Common Issues

1. **"Module not found: playwright"**
   - Solution: Install Playwright browsers: `playwright install chromium`

2. **"Access denied" errors**
   - Solution: Check if the URL is in the blocked domains list

3. **Timeout errors**
   - Solution: Increase the timeout value or check if the website is responsive

4. **Memory errors**
   - Solution: Limit concurrent rendering requests or increase available memory

### Logs

Check the Django logs for detailed error information:

```bash
tail -f backend/logs/django.log
```

## Future Enhancements

Potential future improvements:
- PDF rendering support
- Custom CSS injection
- Mobile viewport simulation
- Batch rendering of multiple URLs
- Caching of rendered images
- Integration with CDN for image storage