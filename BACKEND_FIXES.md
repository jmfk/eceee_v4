# Backend Startup Fixes

## Issues Fixed

### 1. Missing Template Tag Library
**Error**: `'widget_tags' is not a registered tag library`

**Solution**: Created `/backend/webpages/templatetags/widget_tags.py` with commonly used widget template tags.

### 2. Import Error in Widget API
**Error**: `ModuleNotFoundError: No module named 'webpages.api.widget_type_views'`

**Solution**: Fixed import path in `/backend/webpages/api/widget_api.py`:
```python
# Changed from:
from .widget_type_views import format_pydantic_errors
# To:
from ..views.widget_type_views import format_pydantic_errors
```

## Backend is Now Running Successfully

The backend should now start without errors using:
```bash
make backend
# or
docker-compose up backend
```

## Testing the Backend

### Check Status
```bash
# Check if backend is running
docker-compose ps backend

# View logs
docker-compose logs backend --tail 50
```

### Test API Endpoints (Requires Authentication)

1. **Create a superuser** (if not already done):
```bash
docker-compose exec backend python manage.py createsuperuser
```

2. **Get authentication token**:
```bash
# Using HTTPie (install with: pip install httpie)
http POST localhost:8000/api/v1/auth/token/ username=your_username password=your_password

# Using curl
curl -X POST http://localhost:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'
```

3. **Test widget endpoints with token**:
```bash
# Replace YOUR_TOKEN with the token from step 2
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/v1/webpages/widget-types/
```

### Test Without Authentication (Development)

If you want to test without authentication during development, you can temporarily modify the permission classes in `/backend/webpages/views/widget_type_views.py`:

```python
# Change from:
permission_classes = [permissions.IsAuthenticated]
# To:
permission_classes = [permissions.AllowAny]  # FOR DEVELOPMENT ONLY
```

**Important**: Remember to change it back before deploying to production!

## Common Backend Commands

```bash
# Run migrations
docker-compose exec backend python manage.py migrate

# Create sample data
make sample-data

# Access Django shell
docker-compose exec backend python manage.py shell

# Run backend tests
docker-compose exec backend python manage.py test

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput
```

## Verify Widget System

```bash
# Check registered widgets
docker-compose exec backend python -c "
from webpages.widget_registry import widget_type_registry
widgets = widget_type_registry.get_all_widget_types()
for w in widgets:
    print(f'{w.name}: {w.slug}')
"
```

## Next Steps

1. Start the frontend: `cd frontend && npm run dev`
2. Access the application at http://localhost:5173
3. Test the widget system features:
   - Widget editors
   - Widget preview
   - Widget APIs

## Troubleshooting

If you still see errors:

1. **Clear Python cache**:
```bash
find backend -name "*.pyc" -delete
find backend -name "__pycache__" -delete
```

2. **Rebuild containers**:
```bash
docker-compose down
docker-compose build backend
docker-compose up backend
```

3. **Check database migrations**:
```bash
docker-compose exec backend python manage.py showmigrations
docker-compose exec backend python manage.py migrate
```

4. **Reset database** (WARNING: This will delete all data):
```bash
docker-compose down -v
docker-compose up -d db
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```