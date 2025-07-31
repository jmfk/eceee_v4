# Dynamic ALLOWED_HOSTS System

The eceee_v4 project includes a dynamic ALLOWED_HOSTS system that extends Django's static host validation by automatically including hostnames registered in the database.

## Overview

This system allows hostnames to be managed through the WebPage admin interface while maintaining security through proper host validation. It combines:

- **Static ALLOWED_HOSTS** - Traditional Django setting for core hostnames
- **Database hostnames** - Hostnames stored in WebPage.hostnames field
- **Caching** - Performance optimization with automatic cache invalidation
- **Security** - Proper validation and error handling

## Components

### 1. DynamicHostValidationMiddleware

Located in `webpages/middleware.py`, this middleware:
- Validates incoming requests against both static and database hostnames
- Uses caching for performance (5-minute cache timeout)
- Automatically normalizes hostnames for comparison
- Provides detailed error messages in development

### 2. WebPage Model Integration

The `WebPage` model automatically:
- Clears hostname cache when hostnames are updated
- Validates hostname format during save
- Supports wildcard (`*`) and default hostnames
- Normalizes hostnames consistently

### 3. Management Command

The `sync_hostnames` command provides:
- Listing all hostnames (static + database)
- Cache management
- Hostname validation testing
- Statistics and monitoring

## Configuration

### Settings

```python
# Static hostnames (existing Django setting)
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'example.com']

# Optional: Skip validation in DEBUG mode
SKIP_HOST_VALIDATION_IN_DEBUG = False
```

### Middleware

Add to `MIDDLEWARE` setting:
```python
MIDDLEWARE = [
    # ... other middleware
    'webpages.middleware.DynamicHostValidationMiddleware',
    # ... rest of middleware
]
```

## Usage

### Adding Hostnames via Admin

1. Navigate to WebPages admin
2. Edit a root page (page without parent)
3. Add hostnames to the `hostnames` field
4. Save - cache is automatically cleared

### Adding Hostnames via Code

```python
from webpages.models import WebPage

# Get a root page
page = WebPage.objects.get(slug='home', parent__isnull=True)

# Add hostname
page.add_hostname('newsite.example.com')

# Remove hostname  
page.remove_hostname('oldsite.example.com')
```

### Management Commands

```bash
# List all hostnames
python manage.py sync_hostnames --list

# List only database hostnames
python manage.py sync_hostnames --list-db

# List only static hostnames
python manage.py sync_hostnames --list-static

# Validate a hostname
python manage.py sync_hostnames --validate example.com

# Add hostname to page
python manage.py sync_hostnames --add-hostname newsite.com --page-id 1

# Remove hostname from page
python manage.py sync_hostnames --remove-hostname oldsite.com --page-id 1

# Clear cache
python manage.py sync_hostnames --clear-cache

# Show statistics
python manage.py sync_hostnames --stats
```

## Hostname Normalization

Hostnames are automatically normalized:

- `http://example.com/path` → `example.com`
- `https://localhost:8000` → `localhost:8000`
- `EXAMPLE.COM` → `example.com`
- `www.site.com:443/` → `www.site.com:443`

## Special Hostnames

- `*` - Wildcard that allows any hostname (use with caution!)
- `default` - Fallback hostname for unmatched requests

## Caching

- **Cache Key**: `webpages_allowed_hosts`
- **Timeout**: 5 minutes (configurable)
- **Auto-invalidation**: When WebPage hostnames are modified
- **Manual clearing**: Via management command or admin

## Error Handling

### Development Mode
- Detailed error messages showing rejected hostname
- Suggestions for fixing the issue
- Debug information in logs

### Production Mode
- Generic error messages to prevent information disclosure
- Detailed logging for debugging
- Graceful fallbacks when database is unavailable

## Security Considerations

### Validation
- All hostnames are validated against proper format
- Port numbers are validated (1-65535)
- Special characters are rejected
- Normalization prevents bypass attempts

### Performance
- Caching prevents database queries on every request
- Cache invalidation ensures consistency
- Fallback to static ALLOWED_HOSTS if database fails

### Monitoring
- Failed validation attempts are logged
- Statistics available via management command
- Cache hit/miss tracking

## Examples

### Multi-Site Setup

```python
# Create root pages for different sites
home_page = WebPage.objects.create(
    title='Main Site Home',
    slug='home',
    hostnames=['example.com', 'www.example.com']
)

blog_page = WebPage.objects.create(
    title='Blog Site Home', 
    slug='blog',
    hostnames=['blog.example.com']
)

app_page = WebPage.objects.create(
    title='App Site Home',
    slug='app', 
    hostnames=['app.example.com', 'myapp.com']
)
```

### Development Setup

```python
# Local development
dev_page = WebPage.objects.create(
    title='Development Home',
    slug='dev',
    hostnames=['localhost:3000', 'localhost:8000', '127.0.0.1:3000']
)
```

### Wildcard Setup (Use Carefully!)

```python
# Allow any hostname (testing only)
test_page = WebPage.objects.create(
    title='Test Home',
    slug='test',
    hostnames=['*']
)
```

## Troubleshooting

### Common Issues

1. **"Invalid HTTP_HOST header" errors**
   - Check if hostname is in static ALLOWED_HOSTS or database
   - Use `sync_hostnames --validate <hostname>` to test
   - Verify hostname normalization

2. **Cache not updating**
   - Use `sync_hostnames --clear-cache` to force refresh
   - Check if WebPage.save() is being called properly
   - Verify cache backend is working

3. **Performance issues**
   - Monitor cache hit rate with `sync_hostnames --stats`
   - Consider increasing cache timeout
   - Check database query performance

### Debug Commands

```bash
# Full diagnostic
python manage.py sync_hostnames --stats
python manage.py sync_hostnames --list
python manage.py sync_hostnames --validate yourdomain.com

# Clear everything and start fresh
python manage.py sync_hostnames --clear-cache
python manage.py runserver
```

## API Integration

The dynamic hostname system integrates with the backend renderer:

```python
from webpages.middleware import get_dynamic_allowed_hosts

# Get all allowed hosts for API responses
all_hosts = get_dynamic_allowed_hosts()

# Use in CORS settings or other host-based logic
CORS_ALLOWED_ORIGINS = [f'https://{host}' for host in all_hosts]
```

## Testing

```python
from django.test import TestCase
from webpages.models import WebPage
from webpages.middleware import DynamicHostValidationMiddleware

class DynamicHostTest(TestCase):
    def test_hostname_validation(self):
        # Create page with hostname
        page = WebPage.objects.create(
            title='Test',
            hostnames=['test.example.com']
        )
        
        middleware = DynamicHostValidationMiddleware()
        
        # Should allow registered hostname
        self.assertTrue(middleware.is_host_allowed('test.example.com'))
        
        # Should reject unregistered hostname
        self.assertFalse(middleware.is_host_allowed('evil.com'))
```

## Migration Guide

### From Static ALLOWED_HOSTS

1. Keep existing ALLOWED_HOSTS for core domains
2. Add middleware to settings
3. Migrate site-specific domains to WebPage hostnames
4. Test with management commands
5. Monitor logs for validation issues

### Performance Optimization

1. Set appropriate cache timeout based on hostname change frequency
2. Use Redis cache backend for better performance
3. Monitor cache hit rates
4. Consider CDN integration for static hostname validation

This system provides a flexible, secure, and performant way to manage hostnames in a multi-site Django application while maintaining all of Django's security features.