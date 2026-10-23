"""Isolated real-migration tests for the support/core contract; no providers or local secrets."""

SECRET_KEY = "support-tests-only"
DEBUG = False
USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "core",
    "kanban",
    "tenant_support",
]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
MIDDLEWARE = []
ROOT_URLCONF = "tenant_support.urls"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_RENDERER_CLASSES": ["djangorestframework_camel_case.render.CamelCaseJSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
        "djangorestframework_camel_case.parser.CamelCaseMultiPartParser",
    ],
}
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
DEFAULT_FROM_EMAIL = "noreply@example.invalid"
SUPPORT_STORAGE_BUCKET_NAME = "support-private-tests"
SUPPORT_APP_URL = "https://cms.example.invalid"
SUPPORT_EMAIL_ENABLED = True
SUPPORT_BUG_MAX_BYTES = 25 * 1024 * 1024
SUPPORT_INSTRUCTION_MAX_BYTES = 200 * 1024 * 1024
SUPPORT_DAILY_MAX_BYTES = 1024 * 1024 * 1024
SUPPORT_FFPROBE = "ffprobe"
SUPPORT_FFMPEG = "ffmpeg"
AWS_STORAGE_BUCKET_NAME = "public-tests"
AWS_CHECKPOINT_STORAGE_BUCKET_NAME = "checkpoints-tests"

# Shared authentication models are used by credential and ticket revocation.
INSTALLED_APPS += [
    "django.contrib.sites",
    "django.contrib.messages",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.mfa",
    "allauth.headless",
    "cms_auth",
]
ACCOUNT_ADAPTER = "cms_auth.adapters.AccountAdapter"
SOCIALACCOUNT_ADAPTER = "cms_auth.adapters.SocialAccountAdapter"
MFA_ADAPTER = "cms_auth.adapters.MFAAdapter"
CMS_MFA_ENCRYPTION_KEYS = []
CMS_WEBAUTHN_RP_ID = "testserver"
ACCOUNT_REAUTHENTICATION_TIMEOUT = 300
MIDDLEWARE += ["allauth.account.middleware.AccountMiddleware"]
