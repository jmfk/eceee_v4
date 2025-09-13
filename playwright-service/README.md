# Playwright Website Renderer Service

A lightweight Flask microservice for rendering websites to PNG images using Playwright in Docker.

## Features

- **Simple REST API**: Easy-to-use endpoints for website rendering
- **Docker-based**: Uses official Microsoft Playwright Docker image
- **Security-first**: URL validation and blocked domains protection
- **Configurable**: Viewport sizes, timeouts, full-page capture
- **Cookie Consent Handling**: Automatically removes cookie banners and consent dialogs
- **Production-ready**: Gunicorn WSGI server with health checks

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Start the service
docker-compose up -d

# Check if it's running
curl http://localhost:5000/health
```

### Using Docker Build

```bash
# Build the image
docker build -t playwright-renderer .

# Run the container
docker run -d -p 5000:5000 --name playwright-renderer playwright-renderer
```

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Run the Flask app
python app.py
```

## API Endpoints

### 1. Health Check
```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "playwright-website-renderer",
  "version": "1.0.0"
}
```

### 2. Render Website
```bash
POST /render
Content-Type: application/json

{
  "url": "https://example.com",
  "viewport_width": 1920,
  "viewport_height": 1080,
  "full_page": false,
  "timeout": 30000,
  "remove_cookie_warnings": true
}
```

**Response:** PNG image file download

### 3. Validate URL
```bash
POST /validate
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "valid": true,
  "url": "https://example.com",
  "message": "URL is valid and can be rendered",
  "default_config": {...},
  "available_options": {...}
}
```

### 4. API Documentation
```bash
GET /
```

Returns API documentation and example requests.

## Usage Examples

### cURL Examples

```bash
# Render a website
curl -X POST http://localhost:5000/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.github.com", "full_page": true}' \
  --output github.png

# Validate a URL
curl -X POST http://localhost:5000/validate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com"}'

# Health check
curl http://localhost:5000/health
```

### Python Example

```python
import requests

# Render website
response = requests.post('http://localhost:5000/render',     json={
        'url': 'https://www.github.com',
        'viewport_width': 1280,
        'viewport_height': 720,
        'full_page': True,
        'remove_cookie_warnings': True
    })

if response.status_code == 200:
    with open('screenshot.png', 'wb') as f:
        f.write(response.content)
    print("Screenshot saved!")
else:
    print(f"Error: {response.json()}")
```

### JavaScript Example

```javascript
const renderWebsite = async (url, options = {}) => {
  try {
    const response = await fetch('http://localhost:5000/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        remove_cookie_warnings: true,
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

## Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `viewport_width` | integer | 1920 | Width of the browser viewport in pixels |
| `viewport_height` | integer | 1080 | Height of the browser viewport in pixels |
| `full_page` | boolean | false | Whether to capture the full page or just the viewport |
| `timeout` | integer | 30000 | Maximum time to wait for page load (milliseconds) |
| `remove_cookie_warnings` | boolean | true | Automatically handle cookie consent dialogs and banners |

## Cookie Consent Handling

The service includes intelligent cookie consent handling that automatically:

### 🍪 **What It Does:**
- **Detects** cookie consent dialogs and banners automatically
- **Clicks** "Accept", "OK", "Got it" buttons in multiple languages
- **Handles** popular consent solutions (OneTrust, Usercentrics, etc.)
- **Hides** remaining banners with CSS if buttons don't work
- **Restores** page scroll if disabled by modals

### 🌍 **Multi-Language Support:**
- English: "Accept", "Accept All", "Got it", "OK"
- French: "Accepter"
- German: "Akzeptieren" 
- Spanish: "Aceptar"
- Italian: "Accetta"
- Portuguese: "Aceitar"
- Swedish: "Godkänn"
- Dutch: "Accepteren"

### 🔧 **Supported Consent Solutions:**
- OneTrust
- Usercentrics
- Custom implementations
- Generic GDPR banners
- Cookie Law banners

### 📝 **Usage Examples:**

```bash
# Clean screenshots (default behavior)
curl -X POST http://localhost:5001/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "remove_cookie_warnings": true}'

# Keep cookie banners visible
curl -X POST http://localhost:5001/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "remove_cookie_warnings": false}'
```

## Security Features

### Blocked Domains
The service blocks access to:
- `localhost`, `127.0.0.1`, `0.0.0.0`
- Private IP ranges: `10.*`, `172.*`, `192.168.*`
- Internal domains: `.local`, `internal`

### URL Validation
- Only HTTP and HTTPS schemes allowed
- Hostname validation required
- Malformed URL detection

## Production Deployment

### Environment Variables

- `PORT`: Server port (default: 5000)
- `DEBUG`: Enable debug mode (default: false)

### Docker Compose with Reverse Proxy

```yaml
version: '3.8'

services:
  playwright-renderer:
    build: .
    expose:
      - "5000"
    environment:
      - PORT=5000
      - DEBUG=false
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - playwright-renderer
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: playwright-renderer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: playwright-renderer
  template:
    metadata:
      labels:
        app: playwright-renderer
    spec:
      containers:
      - name: playwright-renderer
        image: playwright-renderer:latest
        ports:
        - containerPort: 5000
        resources:
          limits:
            memory: "1Gi"
            cpu: "500m"
          requests:
            memory: "512Mi"
            cpu: "250m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: playwright-renderer-service
spec:
  selector:
    app: playwright-renderer
  ports:
  - port: 80
    targetPort: 5000
  type: LoadBalancer
```

## Performance Considerations

- **Memory Usage**: ~100-200MB per rendering request
- **CPU Usage**: High during rendering, low when idle
- **Concurrency**: Limited by available memory and CPU
- **Timeouts**: Configure based on expected page load times

## Troubleshooting

### Common Issues

1. **Container fails to start**
   ```bash
   # Check logs
   docker logs playwright-renderer
   
   # Check if port is available
   netstat -tulpn | grep :5000
   ```

2. **Out of memory errors**
   ```bash
   # Increase memory limits in docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

3. **Rendering timeouts**
   ```bash
   # Increase timeout in request
   {
     "url": "https://slow-website.com",
     "timeout": 60000
   }
   ```

### Health Monitoring

```bash
# Check service health
curl http://localhost:5000/health

# Monitor container stats
docker stats playwright-renderer

# View logs
docker logs -f playwright-renderer
```

## Development

### Testing

```bash
# Test all endpoints
python -m pytest tests/

# Manual testing
python test_service.py
```

### Building

```bash
# Build image
docker build -t playwright-renderer:latest .

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t playwright-renderer:latest .
```

## License

MIT License - see LICENSE file for details.
