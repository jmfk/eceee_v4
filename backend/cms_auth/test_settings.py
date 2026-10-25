"""Self-contained auth tests: no application env files, services or live credentials."""

SECRET_KEY = "cms-auth-test-key-only-not-for-production-12345678901234567890"
DEBUG = False
DEV_AUTO_LOGIN = False
USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
ALLOWED_HOSTS = ["testserver", "localhost"]
SITE_ID = 1
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.sites",
    "django.contrib.messages",
    "rest_framework",
    "rest_framework.authtoken",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.apple",
    "allauth.headless",
    "allauth.mfa",
    "cms_auth",
    "core",
    "kanban",
]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
MIDDLEWARE = [
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "cms_auth.middleware.AccountSecurityMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "cms_auth.test_urls"
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
DEFAULT_FROM_EMAIL = "noreply@example.invalid"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "APP_DIRS": True}]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "cms_auth.authentication.PersonalJWTAuthentication",
        "cms_auth.authentication.PersonalTokenAuthentication",
        "cms_auth.authentication.BrowserSessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}
ACCOUNT_ADAPTER = "cms_auth.adapters.AccountAdapter"
SOCIALACCOUNT_ADAPTER = "cms_auth.adapters.SocialAccountAdapter"
MFA_ADAPTER = "cms_auth.adapters.MFAAdapter"
# Fixed synthetic test material; real keys must come from protected environment configuration.
CMS_MFA_ENCRYPTION_KEYS = ["MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="]
CMS_WEBAUTHN_RP_ID = "testserver"
ACCOUNT_LOGIN_METHODS = {"username", "email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "username*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "optional"
ACCOUNT_EMAIL_VERIFICATION_BY_CODE_ENABLED = False
ACCOUNT_EMAIL_VERIFICATION_SUPPORTS_RESEND = True
ACCOUNT_REAUTHENTICATION_REQUIRED = True
ACCOUNT_REAUTHENTICATION_TIMEOUT = 300
ACCOUNT_LOGIN_TIMEOUT = 300
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = False
MFA_SUPPORTED_TYPES = ["totp", "webauthn", "recovery_codes"]
MFA_RECOVERY_CODES_SHOW_ONCE = True
MFA_RECOVERY_CODE_COUNT = 10
MFA_PASSKEY_LOGIN_ENABLED = False
MFA_PASSKEY_SIGNUP_ENABLED = False
HEADLESS_ADAPTER = "cms_auth.adapters.HeadlessAdapter"
HEADLESS_ONLY = True
HEADLESS_CLIENTS = ["browser"]
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": "/login?emailKey={key}",
    "account_reset_password_from_key": "/login?resetKey={key}",
    "socialaccount_login_error": "/login?providerError=failed",
}
SOCIALACCOUNT_EMAIL_AUTHENTICATION = False
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = False
SOCIALACCOUNT_PROVIDERS = {}

SESSION_SERIALIZER = "cms_auth.session_serializer.SecuritySessionSerializer"
