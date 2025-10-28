# Email Configuration with Postmark

This document explains how to configure and use Postmark for transactional emails in the ECEEE v4 application.

## Overview

The application uses [Postmark](https://postmarkapp.com/) for sending transactional emails including:
- User registration and email verification
- Password reset requests
- Admin error notifications
- System alerts and notifications

## Environment Variables

The following environment variables need to be configured:

```bash
# Postmark API Token (get from Postmark dashboard)
POSTMARK_API_KEY=your-postmark-server-api-token

# Email addresses
DEFAULT_FROM_EMAIL=noreply@eceee.fred.nu
SERVER_EMAIL=server@eceee.fred.nu
ADMIN_EMAIL=admin@eceee.fred.nu
```

### Development vs Production

- **Development**: Emails are logged to the console by default (no Postmark API key needed)
- **Production**: Emails are sent via Postmark (requires valid API key)

You can override the email backend in development by setting:
```bash
EMAIL_BACKEND=postmark.django_backend.EmailBackend
```

## Getting Your Postmark API Key

1. Log in to your [Postmark account](https://account.postmarkapp.com/)
2. Select your server
3. Go to **Settings** → **API Tokens**
4. Copy the **Server API token**
5. Add it to your `.env` file as `POSTMARK_API_KEY`

## Sender Domain Verification

Before sending emails, you must verify your sender domain in Postmark:

1. In Postmark dashboard, go to **Sender Signatures**
2. Add your domain (`eceee.fred.nu`)
3. Add the provided DNS records to your domain:
   - DKIM record (for authentication)
   - Return-Path record (for bounce handling)
4. Wait for DNS propagation and verification

## Email Templates

Email templates are located in `backend/templates/account/email/`:

- `email_confirmation_subject.txt` / `email_confirmation_message.txt`
- `password_reset_key_subject.txt` / `password_reset_key_message.txt`

See `backend/templates/account/email/README.md` for customization details.

## Testing Email Functionality

### 1. Test Email Sending (Django Shell)

```bash
docker-compose exec backend python manage.py shell
```

```python
from django.core.mail import send_mail
from django.conf import settings

send_mail(
    subject='Test Email',
    message='This is a test message from ECEEE v4.',
    from_email=settings.DEFAULT_FROM_EMAIL,
    recipient_list=['your-email@example.com'],
    fail_silently=False,
)
```

### 2. Test User Registration Flow

1. Start the frontend: `docker-compose up frontend`
2. Navigate to the registration page
3. Register a new user with your email address
4. Check your email for the confirmation link
5. Click the link to verify your email
6. You should be automatically logged in

### 3. Test Password Reset Flow

1. Navigate to the password reset page
2. Enter your email address
3. Check your email for the reset link
4. Click the link and set a new password

### 4. Test Admin Error Notifications

Django will automatically send error emails to the addresses listed in the `ADMINS` setting when an unhandled exception occurs in production (when `DEBUG=False`).

## Monitoring Email Delivery

1. Log in to [Postmark dashboard](https://account.postmarkapp.com/)
2. Go to **Activity** to see recent email activity
3. Check delivery status, opens, bounces, and spam complaints
4. Use **Message Streams** to separate transactional vs. broadcast emails

## Troubleshooting

### Emails not sending in development

- Check that `EMAIL_BACKEND` is set correctly in your settings
- By default, development mode logs emails to console
- Look for email output in the backend container logs

### Emails not sending in production

1. Verify `POSTMARK_API_KEY` is set correctly
2. Check that sender domain is verified in Postmark
3. Ensure `DEFAULT_FROM_EMAIL` uses a verified domain
4. Check Postmark activity log for error messages
5. Review Django logs for any email-related errors

### Email links not working

1. Verify `ALLOWED_HOSTS` includes your domain
2. Check that `CSRF_TRUSTED_ORIGINS` includes your frontend URL
3. Ensure the Django `Site` framework is configured correctly:
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

### Common Error Messages

**"Postmark API returned 401 Unauthorized"**
- Your API key is invalid or not set
- Check that `POSTMARK_API_KEY` environment variable is correct

**"Postmark API returned 422 Unprocessable Entity"**
- Your sender email address is not verified
- Verify your sender domain in Postmark dashboard

**"SMTPAuthenticationError"**
- This means Django is trying to use SMTP instead of Postmark
- Check that `EMAIL_BACKEND` is set to `postmark.django_backend.EmailBackend`

## Advanced Configuration

### Custom Email Headers

You can add custom headers to emails in your code:

```python
from django.core.mail import EmailMessage

email = EmailMessage(
    subject='Subject',
    body='Body',
    from_email='sender@eceee.fred.nu',
    to=['recipient@example.com'],
    headers={
        'X-PM-Tag': 'registration',  # Postmark tag for filtering
        'X-PM-Metadata-user-id': '12345',  # Custom metadata
    }
)
email.send()
```

### Message Streams

Postmark supports message streams to separate different types of emails:
- **Transactional** (default) - For user-triggered emails
- **Broadcasts** - For newsletters and marketing (use Mailchimp instead)

### Bounce Handling

Postmark automatically handles bounces. To process bounce webhooks:

1. Set up a webhook endpoint in your Django app
2. Configure the webhook URL in Postmark dashboard
3. Process bounce notifications and update user records

## Integration with Mailchimp

For newsletter and marketing emails, continue using Mailchimp. The separation is:

- **Postmark**: User registration, password resets, transactional notifications
- **Mailchimp**: Newsletters, marketing campaigns, bulk communications

This separation ensures better deliverability for both types of emails.

## Best Practices

1. **Never use no-reply addresses** - Use `noreply@eceee.fred.nu` but make sure it can receive emails
2. **Monitor bounce rates** - High bounce rates hurt sender reputation
3. **Use plain text + HTML** - Provide both formats for better compatibility
4. **Test before deploying** - Always test email changes in development first
5. **Keep templates simple** - Avoid complex HTML that might be flagged as spam
6. **Respect user preferences** - Honor unsubscribe requests promptly
7. **Monitor Postmark activity** - Check for delivery issues regularly

## Support

- **Postmark Documentation**: https://postmarkapp.com/developer
- **Django-Postmark**: https://github.com/themartorana/django-postmark
- **Django-Allauth**: https://django-allauth.readthedocs.io/

