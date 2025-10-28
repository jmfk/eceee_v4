# Email Templates for Django Allauth

This directory contains customizable email templates for user authentication flows using django-allauth and Postmark.

## Available Templates

### Email Confirmation
- `email_confirmation_subject.txt` - Subject line for email verification
- `email_confirmation_message.txt` - Body of email verification message

### Password Reset
- `password_reset_key_subject.txt` - Subject line for password reset
- `password_reset_key_message.txt` - Body of password reset message

## Customization

These templates are plain text by default. You can customize them to:
- Change the wording and tone
- Add your brand voice
- Include additional instructions

### Available Context Variables

#### Email Confirmation Templates
- `user_display` - The user's display name
- `activate_url` - The confirmation link
- `current_site.name` - Site name (from Django sites framework)
- `current_site.domain` - Site domain

#### Password Reset Templates
- `password_reset_url` - The password reset link
- `password_reset_timeout_days` - Number of days until link expires
- `user` - The user object

## HTML Email Templates

To use HTML emails instead of plain text, create corresponding `.html` files:
- `email_confirmation_message.html`
- `password_reset_key_message.html`

Django-allauth will automatically use HTML templates if they exist, falling back to plain text for email clients that don't support HTML.

## Testing Email Templates

You can test email templates using Django's shell:

```python
docker-compose exec backend python manage.py shell

from django.core.mail import send_mail
from django.conf import settings

# Test basic email sending
send_mail(
    'Test Email',
    'This is a test message.',
    settings.DEFAULT_FROM_EMAIL,
    ['your-email@example.com'],
    fail_silently=False,
)
```

## Postmark Configuration

Emails are sent through Postmark in production. Make sure to:
1. Configure `POSTMARK_API_KEY` in your environment variables
2. Verify your sender domain in Postmark dashboard
3. Set up DKIM/SPF records for better deliverability
4. Configure `DEFAULT_FROM_EMAIL` to use a verified domain

In development, emails are logged to the console by default (see `EMAIL_BACKEND` in settings.py).

