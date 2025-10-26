# Instructions: Fix Hostname Validation Issue for summerstudy.eceee.org

## Problem
The hostname `summerstudy.eceee.org` is returning a `DisallowedHost` error even though it's configured in WebPage.objects.get(id=3).hostnames.

## Root Cause
The middleware only recognizes hostnames from ROOT pages (pages with `parent=None`). If page ID 3 has a parent, its hostnames won't be recognized.

## Step-by-Step Fix Instructions

### Step 1: Diagnose the Issue
Run the audit command to identify the problem:

```bash
docker-compose exec backend python manage.py audit_hostnames
```

**Expected Output Analysis:**
- Look for page ID 3 in the "Pages with Hostnames" section
- Check if it shows "✗ INVALID" status
- Check if it says "ERROR: This page has a parent"
- Verify if `summerstudy.eceee.org` appears in "Currently Active Database Hostnames" (it probably won't)

### Step 2: Check Current Page Configuration
Verify the current state of page 3:

```bash
docker-compose exec backend python manage.py shell
```

Then run:
```python
from webpages.models import WebPage

page = WebPage.objects.get(id=3)
print(f"Page ID: {page.id}")
print(f"Slug: {page.slug}")
print(f"Hostnames: {page.hostnames}")
print(f"Parent: {page.parent}")
print(f"Is Root Page: {page.parent is None}")

# Exit the shell
exit()
```

### Step 3: Fix the Configuration

**If the page should serve its own hostname** (most likely scenario):
Make it a root page by removing its parent:

```bash
docker-compose exec backend python manage.py shell
```

```python
from webpages.models import WebPage

# Get the page
page = WebPage.objects.get(id=3)

# Make it a root page
page.parent = None
page.save()

print(f"✓ Page {page.id} is now a root page")
print(f"✓ Hostnames: {page.hostnames}")

exit()
```

**Alternative: If the page should remain a child page:**
Remove the hostnames instead:

```bash
docker-compose exec backend python manage.py shell
```

```python
from webpages.models import WebPage

page = WebPage.objects.get(id=3)
page.hostnames = []
page.save()

print(f"✓ Removed hostnames from page {page.id}")

exit()
```

### Step 4: Clear the Hostname Cache
The middleware caches hostnames for 5 minutes. Clear the cache to apply changes immediately:

```bash
docker-compose exec backend python manage.py shell
```

```python
from webpages.middleware import DynamicHostValidationMiddleware

DynamicHostValidationMiddleware.clear_hostname_cache()
print("✓ Hostname cache cleared")

exit()
```

**OR** simply restart the backend service:
```bash
docker-compose restart backend
```

### Step 5: Verify the Fix
Run the audit command again to confirm:

```bash
docker-compose exec backend python manage.py audit_hostnames
```

**Expected Success Indicators:**
- Page ID 3 should show "✓ VALID" status
- `summerstudy.eceee.org` should appear in "Currently Active Database Hostnames"
- No invalid configurations should be reported

### Step 6: Test the Hostname
Try accessing the site with the hostname to confirm it works:

```bash
curl -H "Host: summerstudy.eceee.org" http://localhost:8000/
```

If successful, you should get a valid response (not a 400 Bad Request).

## Additional Notes

### Understanding the System
- Only ROOT pages (parent=None) can have hostnames
- The middleware combines STATIC_ALLOWED_HOSTS from settings + database hostnames from root pages
- Hostnames are cached for 5 minutes for performance
- The validation happens in `clean()` method, so invalid configurations can't be saved through the admin

### Viewing in Django Admin
After the fix, when you view the page in Django admin at `/admin/webpages/webpage/3/`:
- The "Multi-Site Configuration" section will show the page status
- "System-wide Active Hostnames" will display all recognized hostnames
- Any invalid configurations will show red error warnings

### Debugging Logs
If you still have issues, check the backend logs for detailed information:
```bash
docker-compose logs backend | grep -i hostname
```

The enhanced logging will show:
- Which hostnames were loaded from the database
- Why a specific hostname was denied
- What hostnames are available
- Hints about fixing the configuration

## Expected Result
After completing these steps, requests to `summerstudy.eceee.org` should be accepted by the middleware and the `DisallowedHost` error should be resolved.

