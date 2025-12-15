# Theme Sync Service

The theme sync service synchronizes themes between local Python files and the server's JSON storage.

**🔄 Multi-Tenancy Support:** This service uses tenant-based directory structure. Each tenant has its own theme directory under `themes/{TENANT_ID}/`.

The theme sync service synchronizes themes between local Python files and the server's JSON storage.

## Quick Start

1. **Create a tenant** (if not using default):
   ```bash
   make create-tenant NAME="Your Org" IDENTIFIER=your_org
   ```

2. **Enable sync on backend** - Set `THEME_SYNC_ENABLED=True` in backend environment

3. **Configure tenant** in `docker-compose.dev.yml`:
   ```yaml
   theme-sync:
     environment:
       - TENANT_ID=your_org  # Use your tenant identifier
   ```

4. **Configure authentication** (if needed) - See Authentication section below

5. **Start the service** - Run `make theme-sync` or `docker-compose up theme-sync`

## Configuration Options

### Backend Configuration

The backend must have theme sync enabled. Add to your backend environment (`.env` or `docker-compose.dev.yml`):

```bash
THEME_SYNC_ENABLED=True
```

**Important:** This defaults to `False` for production safety. Only enable in development environments.

### Sync Service Configuration

Configuration is done via environment variables. You can set them in:

1. **docker-compose.dev.yml** (recommended for development)
2. **.env file** in project root (loaded automatically)
3. **Environment variables** (for production)

#### Required Configuration

- `TENANT_ID` - **Tenant identifier (REQUIRED)** - Used for directory structure and API requests
  ```yaml
  environment:
    - TENANT_ID=default  # Change to your tenant identifier
  ```
  
  **Important:** 
  - This must match a tenant identifier in your database
  - Themes will sync to `themes/{TENANT_ID}/` directory
  - API requests will include `X-Tenant-ID: {TENANT_ID}` header
  - See Multi-Tenancy section below for more details

- `BACKEND_URL` - Backend API URL (default: `http://backend:8000`)
  ```yaml
  environment:
    - BACKEND_URL=http://backend:8000
  ```

#### Optional Configuration

- `SYNC_INTERVAL` - How often to poll server for updates in seconds (default: `5`)
  ```yaml
  environment:
    - SYNC_INTERVAL=5
  ```

- `DEBOUNCE_DELAY` - Delay before processing file changes in seconds (default: `0.5`)
  ```yaml
  environment:
    - DEBOUNCE_DELAY=0.5
  ```

- `THEMES_DIR` - Local directory for theme files (default: `/themes`)
  ```yaml
  environment:
    - THEMES_DIR=/themes
  ```

### Authentication

The sync service supports three authentication methods:

#### 1. JWT Token Authentication (Recommended)

Get a JWT token from the API:

```bash
# Get JWT token
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your-username", "password": "your-password"}'
```

Then add to `docker-compose.dev.yml`:

```yaml
environment:
  - API_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGc...  # JWT token from above
```

Or use username/password (service will auto-fetch JWT token):

```yaml
environment:
  - API_USERNAME=your-username
  - API_PASSWORD=your-password
```

#### 2. DRF Token Authentication (Alternative)

Create a token for your user:

```bash
docker exec eceee_v4_backend python manage.py drf_create_token <username>
```

Then add to `docker-compose.dev.yml`:

```yaml
environment:
  - API_TOKEN=your-token-here  # Non-JWT token
```

#### 3. No Authentication

If your backend allows unauthenticated access (development only), you can omit authentication variables.

## Complete Example Configuration

### docker-compose.dev.yml

```yaml
theme-sync:
  build:
    context: ./theme-sync
  container_name: eceee_v4_theme_sync
  restart: unless-stopped
  depends_on:
    - backend
  environment:
    - BACKEND_URL=http://backend:8000
    - TENANT_ID=default  # Required - tenant identifier
    - SYNC_INTERVAL=5
    - DEBOUNCE_DELAY=0.5
    - THEMES_DIR=/themes
    - API_TOKEN=your-token-here  # Optional
  volumes:
    - ./themes:/themes
    - ./theme-sync:/app
  command: python sync_service.py
```

### .env File (Alternative)

Create a `.env` file in the project root:

```bash
# Theme Sync Configuration
THEME_SYNC_ENABLED=True
BACKEND_URL=http://backend:8000
SYNC_INTERVAL=5
DEBOUNCE_DELAY=0.5
API_TOKEN=your-token-here
```

## Directory Structure

The sync service creates a tenant-based directory structure:

```
themes/
└── {TENANT_ID}/             # Tenant identifier (e.g., "default", "eceee_org")
    ├── base/                # Base themes (no inheritance)
    │   ├── modern_blue/
    │   │   ├── theme.py     # Python class definition
    │   │   ├── colors.py    # Color palette module
    │   │   ├── fonts.py     # Font configuration module
    │   │   ├── component_styles/
    │   │   │   ├── card.mustache
    │   │   │   └── callout.mustache
    │   │   └── image_styles/
    │   │       ├── gallery.mustache
    │   │       └── carousel.mustache
    │   └── minimalist/
    │       └── theme.py
    ├── custom/              # Custom themes (can inherit)
    │   └── modern_blue_dark/
    │       ├── theme.py     # class ModernBlueDarkTheme(ModernBlueTheme)
    │       └── component_styles/
    │           └── card.mustache
    └── .sync_state.json     # Local version tracking (gitignored)
```

**Note:** Themes are organized by tenant. Each tenant has its own directory under `themes/{TENANT_ID}/`. The `TENANT_ID` must match a tenant identifier in the database.

## Workflow

1. **Initial Sync**: On first start, the service pulls all themes from the server and generates Python files
2. **File Monitoring**: Watches for changes to `.py` and `.mustache` files
3. **Auto-Sync**: Automatically converts Python → JSON and pushes to server
4. **Server Polling**: Polls server every `SYNC_INTERVAL` seconds for updates
5. **Conflict Detection**: Detects version conflicts and creates `.conflict` files

## Troubleshooting

### Sync is disabled error

**Error:** `Theme sync is disabled on server`

**Solution:** Set `THEME_SYNC_ENABLED=True` in backend environment and restart backend.

### Authentication errors

**Error:** `401 Unauthorized` or `403 Forbidden`

**Solution:** 
- Check that `API_TOKEN` or `API_USERNAME`/`API_PASSWORD` are set correctly
- Verify the backend API accepts the authentication method you're using
- For development, you may need to configure Django REST Framework authentication

### Connection errors

**Error:** `Connection refused` or `Cannot connect to backend`

**Solution:**
- Verify `BACKEND_URL` is correct (use `http://backend:8000` for Docker, `http://localhost:8000` for local)
- Ensure backend service is running: `docker ps | grep backend`
- Check network connectivity between containers

### File not found errors

**Error:** `Theme file not found`

**Solution:**
- Ensure `THEMES_DIR` is correctly mounted as a volume
- Check that the themes directory exists: `ls -la themes/`
- Verify file permissions allow the container to read/write

## Production Considerations

⚠️ **Theme sync is disabled by default in production** for security reasons.

To enable in production:
1. Set `THEME_SYNC_ENABLED=True` in production environment
2. Use secure authentication (API tokens, not passwords)
3. Consider restricting access to sync endpoints via firewall/network policies
4. Monitor sync activity and version conflicts

## API Endpoints

The sync service uses these backend endpoints:

- `GET /api/v1/webpages/themes/sync/status/?since_version=X` - Poll for updates
- `POST /api/v1/webpages/themes/sync/pull/` - Pull all themes (initial sync)
- `POST /api/v1/webpages/themes/sync/push/` - Push theme update
- `GET /api/v1/webpages/themes/sync/check-conflict/?name=X&version=Y` - Check conflicts
- `POST /api/v1/webpages/themes/sync/resolve-conflict/` - Force push after resolution

All endpoints require:
- Authentication (API_TOKEN or API_USERNAME/API_PASSWORD)
- `X-Tenant-ID` header (automatically added by sync service using TENANT_ID)
- `THEME_SYNC_ENABLED=True` on the backend

## Multi-Tenancy

The theme sync service supports multi-tenancy. Each tenant has:
- Separate theme directory: `themes/{TENANT_ID}/`
- Isolated themes (themes are filtered by tenant)
- Tenant-specific sync state

To work with a different tenant, change the `TENANT_ID` environment variable and restart the service.

