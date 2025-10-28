<!-- a09a0151-aefa-4985-8214-46fd07ae3194 68007291-648b-43d0-a3ea-b71e08dcd27a -->
# Authenticated Proxy System for Paywalled Sites

## Overview

Extend the proxy service to support authentication on paywalled sites by storing encrypted credentials, managing login sessions, and reusing cookies for subsequent requests.

## Architecture Components

### 1. Database Model - Site Credentials

**File**: `backend/content_import/models.py`

Add new `SiteCredential` model:

- `site_domain` - Domain pattern (e.g., "nytimes.com", "*.wsj.com")
- `site_name` - Human-readable name for admin UI
- `login_url` - Full URL to the login page
- `username_field` - Form field name for username (default: "username")
- `password_field` - Form field name for password (default: "password")  
- `username` - Plain text username
- `encrypted_password` - Encrypted password (using Fernet)
- `cookies` - JSONField storing session cookies
- `headers` - JSONField for custom headers (user-agent, etc.)
- `last_login_attempt` - Timestamp
- `last_successful_login` - Timestamp
- `login_success` - Boolean flag
- `is_active` - Enable/disable credential
- `created_by` - ForeignKey to User (admin who configured)
- `notes` - TextField for admin notes

### 2. Encryption Service

**File**: `backend/content_import/services/encryption_service.py` (new)

Create encryption utility using Django's cryptography:

- Use `cryptography.fernet.Fernet` for symmetric encryption
- Derive encryption key from environment variable `CREDENTIAL_ENCRYPTION_KEY`
- Methods: `encrypt_password(plain_text)`, `decrypt_password(encrypted_text)`
- Key generation helper for initial setup
- Fallback to Django SECRET_KEY if CREDENTIAL_ENCRYPTION_KEY not set (with warning)

**Environment**: Add to `.env` and `env.production.example`:

```
CREDENTIAL_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
```

### 3. Authentication Service  

**File**: `backend/content_import/services/authentication_service.py` (new)

Create `AuthenticationService` class with methods:

- `authenticate(site_credential)` - Perform login and capture cookies
  - Fetch login page
  - Parse form fields (detect username/password inputs)
  - Submit credentials via POST
  - Capture session cookies from response
  - Validate login success (check for redirect, error messages)
  - Update SiteCredential model with cookies and status
- `get_authenticated_session(url)` - Get or create requests.Session with cookies
  - Match URL domain to stored credentials
  - Return session with cookies loaded
  - Check cookie expiry (attempt re-auth if expired)
- `test_credentials(site_credential)` - Test if credentials work
- `_detect_login_form(html)` - Parse HTML to find login form fields
- `_validate_login_success(response)` - Heuristics to detect successful login

### 4. Enhanced Proxy Service

**File**: `backend/content_import/services/proxy_service.py`

Modify existing `ProxyService`:

- Add `use_authentication` parameter (default: True)
- In `fetch_and_rewrite()` method:
  - Check if URL domain matches any SiteCredential
  - If match found, use authenticated session
  - Handle 401/403/paywall detection → trigger re-authentication
  - Fallback to non-authenticated request if no credentials
- Update `fetch_asset()` to also support authentication
- Add `_get_session_for_url(url)` helper method

Example change to `fetch_and_rewrite()`:

```python
def fetch_and_rewrite(self, url, request=None, strip_design=True, use_auth=True):
    session = None
    if use_auth:
        from .authentication_service import AuthenticationService
        auth_service = AuthenticationService()
        session = auth_service.get_authenticated_session(url)
    
    if session:
        response = session.get(url, timeout=30, headers={...})
    else:
        response = requests.get(url, timeout=30, headers={...})
    # ... rest of existing code
```

### 5. Admin Interface

**File**: `backend/content_import/admin.py` (create/modify)

Register `SiteCredential` model in Django admin:

- Custom admin form with password input widget (type="password")
- Readonly field showing last successful login time
- Action: "Test Credentials" - trigger login test
- Display login status with colored indicator
- List display: site_name, site_domain, username, login_success, last_successful_login
- List filter: is_active, login_success
- Search: site_name, site_domain, username

### 6. API Endpoints

**File**: `backend/content_import/views/credentials.py` (new)

Admin-only API endpoints:

- `GET /api/v1/content-import/credentials/` - List all credentials
- `POST /api/v1/content-import/credentials/` - Create new credential
- `PUT /api/v1/content-import/credentials/{id}/` - Update credential  
- `DELETE /api/v1/content-import/credentials/{id}/` - Delete credential
- `POST /api/v1/content-import/credentials/{id}/test/` - Test login
- `POST /api/v1/content-import/credentials/{id}/refresh/` - Force re-authentication

Permission: `IsAdminUser` only

**File**: `backend/content_import/serializers.py`

Add `SiteCredentialSerializer`:

- Write-only password field (never return in responses)
- Return encrypted_password as boolean (has_password)
- Serialize cookies as redacted in list view, full in detail view

### 7. Frontend UI (Settings)

**File**: `frontend/src/pages/SettingsManager.jsx`

Add new "Site Credentials" tab:

- Table showing configured sites
- Add/Edit credential modal form
- Test button for each credential (shows success/failure)
- Status indicators (green=working, red=failed, yellow=untested)
- Last login timestamp display

**File**: `frontend/src/api/credentials.js` (new)

API client for credential management endpoints.

### 8. Database Migration

**File**: `backend/content_import/migrations/000X_add_site_credentials.py`

Create migration for SiteCredential model.

### 9. Security & Dependencies

**File**: `backend/requirements/base.txt`

Add:

```
cryptography>=41.0.0  # For Fernet encryption
```

**Security Checklist**:

- Passwords encrypted at rest using Fernet
- Admin-only access to credential management
- Audit logging for credential access (extend ImportLog)
- Secure key storage in environment variables
- No credentials in API responses (write-only)
- Session cookies stored encrypted in database
- HTTPS required in production (existing)

### 10. Documentation

**File**: `backend/docs/authenticated-proxy.md` (new)

Document:

- How to configure site credentials
- How to generate encryption key
- Supported login form types
- Troubleshooting authentication failures
- Security best practices

## Implementation Order

1. Install cryptography dependency
2. Create encryption service and add environment variable
3. Create SiteCredential model and migration
4. Create authentication service with basic login flow
5. Enhance proxy service to use authentication
6. Add Django admin interface for testing
7. Create API endpoints and serializers
8. Build frontend UI in SettingsManager
9. Add comprehensive error handling and logging
10. Write tests for authentication flow
11. Update documentation

## Testing Strategy

- Unit tests for encryption/decryption
- Unit tests for form parsing and authentication
- Integration test: mock login flow end-to-end
- Manual test: configure real site (e.g., test paywall site)
- Security test: verify passwords encrypted, not exposed in APIs

## Future Enhancements (Out of Scope)

- 2FA/CAPTCHA support
- OAuth/SSO flows  
- Personal credentials (per-user instead of site-wide)
- Auto-detect login form fields
- Cookie expiry prediction
- Headless browser for JavaScript-heavy login forms

### To-dos

- [ ] Create encryption service and add CREDENTIAL_ENCRYPTION_KEY to environment
- [ ] Create SiteCredential model and run migrations
- [ ] Implement AuthenticationService for login flow and cookie management
- [ ] Extend ProxyService to use authentication when available
- [ ] Add Django admin for SiteCredential management and testing
- [ ] Create API endpoints and serializers for credential management
- [ ] Build Site Credentials UI in SettingsManager
- [ ] Add tests and documentation for authenticated proxy system