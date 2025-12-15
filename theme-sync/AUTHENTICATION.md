# Theme Sync Authentication Guide

The theme sync service requires authentication to access the API. You have three options:

## Option 1: Username/Password (Easiest - Recommended)

The sync service will automatically fetch a JWT token using your Django username and password.

### Setup

1. **Use an existing Django user** or create one:
   ```bash
   docker exec eceee_v4_backend python manage.py createsuperuser
   ```

2. **Add to `docker-compose.dev.yml`**:
   ```yaml
   theme-sync:
     environment:
       - API_USERNAME=your-username
       - API_PASSWORD=your-password
   ```

3. **Restart the service**:
   ```bash
   docker-compose -f docker-compose.dev.yml restart theme-sync
   ```

The service will automatically:
- Get a JWT token from `/api/auth/token/`
- Use it for all subsequent API requests
- Refresh the token when it expires

## Option 2: JWT Token (Manual)

Get a JWT token manually and use it directly.

### Setup

1. **Get a JWT token**:
   ```bash
   curl -X POST http://localhost:8000/api/auth/token/ \
     -H "Content-Type: application/json" \
     -d '{"username": "your-username", "password": "your-password"}'
   ```

   Response:
   ```json
   {
     "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
   }
   ```

2. **Add to `docker-compose.dev.yml`**:
   ```yaml
   theme-sync:
     environment:
       - API_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGc...  # Use the "access" token
   ```

3. **Restart the service**:
   ```bash
   docker-compose -f docker-compose.dev.yml restart theme-sync
   ```

**Note:** JWT tokens expire after 60 minutes. You'll need to refresh them periodically, or use Option 1 which handles this automatically.

## Option 3: DRF Token (Long-lived)

Create a permanent token that doesn't expire (until you delete it).

### Setup

1. **Create a token for your user**:
   ```bash
   docker exec eceee_v4_backend python manage.py drf_create_token <username>
   ```

   Example:
   ```bash
   docker exec eceee_v4_backend python manage.py drf_create_token admin
   ```

   Output:
   ```
   Generated token abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
   ```

2. **Add to `docker-compose.dev.yml`**:
   ```yaml
   theme-sync:
     environment:
       - API_TOKEN=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
   ```

3. **Restart the service**:
   ```bash
   docker-compose -f docker-compose.dev.yml restart theme-sync
   ```

**Note:** DRF tokens don't expire but can be deleted. They're good for long-running services.

## Managing Tokens

### List all tokens

```bash
docker exec eceee_v4_backend python manage.py shell
```

Then in Python:
```python
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User

# List all tokens
for user in User.objects.all():
    token, created = Token.objects.get_or_create(user=user)
    print(f"{user.username}: {token.key}")
```

### Delete a token

```bash
docker exec eceee_v4_backend python manage.py shell
```

Then in Python:
```python
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User

user = User.objects.get(username="your-username")
Token.objects.filter(user=user).delete()
```

### Regenerate a token

```bash
docker exec eceee_v4_backend python manage.py drf_create_token <username>
```

This will delete the old token and create a new one.

## Testing Authentication

Test if your authentication works:

```bash
# Test JWT token
curl -X GET http://localhost:8000/api/themes/sync/status/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test DRF token
curl -X GET http://localhost:8000/api/themes/sync/status/ \
  -H "Authorization: Token YOUR_DRF_TOKEN"

# Test username/password (will get JWT)
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your-username", "password": "your-password"}'
```

## Security Recommendations

1. **For Development**: Use username/password (Option 1) - simplest and auto-refreshes
2. **For Production**: Use DRF tokens (Option 3) - long-lived, no expiration
3. **For CI/CD**: Use JWT tokens (Option 2) - short-lived, more secure

## Troubleshooting

### "401 Unauthorized" or "403 Forbidden"

- Check that your username/password are correct
- Verify the token hasn't expired (JWT tokens expire after 60 minutes)
- Ensure `THEME_SYNC_ENABLED=True` is set in backend environment

### "CSRF verification failed"

- This means authentication isn't working
- Check that your token/credentials are correct
- Verify the Authorization header format:
  - JWT: `Authorization: Bearer <token>`
  - DRF Token: `Authorization: Token <token>`

### Token expired

- JWT tokens expire after 60 minutes
- Use Option 1 (username/password) for automatic token refresh
- Or manually refresh: `POST /api/auth/token/refresh/` with the refresh token

