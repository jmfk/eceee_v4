# Email Quick Reference Guide

Quick reference for common email operations in ECEEE v4.

## Quick Start

### 1. Install Package

```bash
docker-compose exec backend pip install -r requirements/base.txt
```

### 2. Set Environment Variables

Add to your `.env` file:

```bash
POSTMARK_API_KEY=your-postmark-api-key
DEFAULT_FROM_EMAIL=noreply@eceee.fred.nu
SERVER_EMAIL=server@eceee.fred.nu
ADMIN_EMAIL=admin@eceee.fred.nu
```

### 3. Configure Django Site

```bash
docker-compose exec backend python manage.py shell
```

```python
from django.contrib.sites.models import Site
site = Site.objects.get_current()
site.domain = 'eceee.fred.nu'
site.name = 'ECEEE'
site.save()
```

## Common Operations

### Send Test Email

```python
from django.core.mail import send_mail
from django.conf import settings

send_mail(
    'Test Subject',
    'Test message body.',
    settings.DEFAULT_FROM_EMAIL,
    ['recipient@example.com'],
)
```

### Send HTML Email

```python
from django.core.mail import EmailMultiAlternatives

email = EmailMultiAlternatives(
    subject='Test Subject',
    body='Plain text version',
    from_email=settings.DEFAULT_FROM_EMAIL,
    to=['recipient@example.com'],
)
email.attach_alternative('<h1>HTML version</h1>', "text/html")
email.send()
```

### Send Email with Custom Headers

```python
from django.core.mail import EmailMessage

email = EmailMessage(
    subject='Subject',
    body='Body',
    from_email=settings.DEFAULT_FROM_EMAIL,
    to=['recipient@example.com'],
    headers={
        'X-PM-Tag': 'registration',  # Postmark tag
        'Reply-To': 'support@eceee.fred.nu',
    }
)
email.send()
```

### Check Email Configuration

```python
from django.conf import settings

print(f"Email Backend: {settings.EMAIL_BACKEND}")
print(f"From Email: {settings.DEFAULT_FROM_EMAIL}")
print(f"Server Email: {settings.SERVER_EMAIL}")
print(f"Admins: {settings.ADMINS}")
```

## Testing

### Test in Development (Console)

By default, emails are logged to console in development:

```bash
# Start backend and watch console
docker-compose up backend

# Emails will appear in console output
```

### Test with Postmark in Development

Override the email backend:

```bash
# Set environment variable
export EMAIL_BACKEND=postmark.django_backend.EmailBackend

# Or add to .env file
EMAIL_BACKEND=postmark.django_backend.EmailBackend
```

### Test User Registration

1. Start frontend: `docker-compose up frontend`
2. Navigate to registration page
3. Register with your email
4. Check email for confirmation link
5. Check Postmark dashboard for activity

### Test Password Reset

1. Navigate to password reset page
2. Enter your email address
3. Check email for reset link
4. Check Postmark dashboard for activity

## Monitoring

### View Recent Emails (Postmark Dashboard)

1. Log in to https://account.postmarkapp.com/
2. Go to **Activity**
3. View sent emails, delivery status, opens, bounces

### Check Django Logs

```bash
# View backend logs
docker-compose logs -f backend

# Look for email-related messages
docker-compose logs backend | grep -i email
```

## Troubleshooting

### Problem: Emails not sending

```python
# Check configuration
from django.core.mail import get_connection
connection = get_connection()
connection.open()  # Should not raise error
```

### Problem: 401 Unauthorized from Postmark

Check your API key:

```bash
echo $POSTMARK_API_KEY
```

Verify it matches your Postmark dashboard.

### Problem: 422 Unprocessable Entity

Your sender email is not verified. Verify domain in Postmark dashboard.

### Problem: Email links not working

Check Site configuration:

```python
from django.contrib.sites.models import Site
site = Site.objects.get_current()
print(f"Domain: {site.domain}")
print(f"Name: {site.name}")
```

Should match your actual domain (e.g., `eceee.fred.nu`).

## Email Template Locations

- **Django-Allauth**: `backend/templates/account/email/`
  - Email confirmation
  - Password reset
- **Custom Templates**: Create in your app's `templates/` directory

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `POSTMARK_API_KEY` | Postmark authentication | `abc123...` |
| `DEFAULT_FROM_EMAIL` | Default sender address | `noreply@eceee.fred.nu` |
| `SERVER_EMAIL` | System error emails | `server@eceee.fred.nu` |
| `ADMIN_EMAIL` | Admin notifications | `admin@eceee.fred.nu` |
| `EMAIL_BACKEND` | Override email backend | `postmark.django_backend.EmailBackend` |

## Useful Commands

```bash
# Install/update dependencies
docker-compose exec backend pip install -r requirements/base.txt

# Django shell
docker-compose exec backend python manage.py shell

# Check email in Django shell
python -c "from django.core.mail import send_mail; send_mail('Test', 'Body', 'from@example.com', ['to@example.com'])"

# View backend logs
docker-compose logs -f backend
```

## Production Checklist

- [ ] `POSTMARK_API_KEY` set in environment
- [ ] Sender domain verified in Postmark
- [ ] DNS records (DKIM, Return-Path) configured
- [ ] Django Site configured correctly
- [ ] Test emails sending successfully
- [ ] Email links working correctly
- [ ] Admin emails working (test by triggering an error)

## Additional Resources

- [Full Email Configuration Guide](email-configuration.md)
- [Email Template Customization](../templates/account/email/README.md)
- [Postmark Documentation](https://postmarkapp.com/developer)
- [Django Email Documentation](https://docs.djangoproject.com/en/4.2/topics/email/)

