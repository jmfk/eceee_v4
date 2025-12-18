# Copyright (C) 2025 Johan Mats Fred Karlsson
#
# This file is part of eceee_v4.
#
# This program is licensed under the Server Side Public License, version 1,
# as published by MongoDB, Inc. See the LICENSE file for details.

"""
Django settings for EASY v4 AI-integrated development environment.

This configuration supports:
- PostgreSQL database integration
- Django REST Framework API
- CORS for React frontend
- HTMX integration
- Security best practices
- Development tools and debugging
- AI-assisted development workflows
"""

import os
from pathlib import Path
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Security Settings
SECRET_KEY = config(
    "SECRET_KEY",
    default="django-insecure-2e2!o&yhu%_-v)&9rydo7&rt7f!^m$tr244w18lmk2p=r9(_kr",
)
DEBUG = config("DEBUG", default=True, cast=bool)

# Layout caching configuration
if DEBUG:
    # Disable layout caching in development for immediate updates
    SIMPLIFIED_LAYOUT_CACHE_TIMEOUT = 0  # No caching
    LAYOUT_CACHE_ENABLED = False
else:
    # Enable caching in production
    SIMPLIFIED_LAYOUT_CACHE_TIMEOUT = 3600  # 1 hour
    LAYOUT_CACHE_ENABLED = True

# Theme CSS caching configuration
if DEBUG:
    # Disable theme CSS caching in development for immediate updates
    THEME_CSS_CACHE_TIMEOUT = 0  # No caching
else:
    # Enable caching in production (24 hours)
    THEME_CSS_CACHE_TIMEOUT = 3600 * 24  # 24 hours

# Theme sync configuration
THEME_SYNC_ENABLED = config("THEME_SYNC_ENABLED", default=False, cast=bool)

# Multi-tenancy configuration
TENANT_HEADER = config("TENANT_HEADER", default="X-Tenant-ID")
DEFAULT_TENANT_ID = config(
    "DEFAULT_TENANT_ID", default=None, cast=lambda x: x if x else None
)  # UUID string or identifier
REQUIRE_TENANT = config("REQUIRE_TENANT", default=not DEBUG, cast=bool)

# Security check for production secret key
if not DEBUG and SECRET_KEY == "dev-secret-key-change-in-production-12345":
    raise ValueError(
        "SECURITY ERROR: Default development SECRET_KEY detected in production! "
        "Set a strong SECRET_KEY environment variable for production deployment. "
        "Generate one with: python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'"
    )

# Additional security validation for secret key strength
if len(SECRET_KEY) < 50:
    import logging

    logger = logging.getLogger(__name__)
    logger.warning(
        f"SECRET_KEY is only {len(SECRET_KEY)} characters long. "
        "For better security, use a key of at least 50 characters."
    )
# Dynamic hostname validation settings
SKIP_HOST_VALIDATION_IN_DEBUG = config(
    "SKIP_HOST_VALIDATION_IN_DEBUG", default=True, cast=bool
)

# ALLOWED_HOSTS configuration
# We use a two-tier approach:
# 1. Django's ALLOWED_HOSTS is set to allow all hosts (for performance)
# 2. DynamicHostValidationMiddleware does the actual validation
_static_hosts = config(
    "ALLOWED_HOSTS", default="localhost,127.0.0.1,backend,frontend,testserver"
).split(",")

# Add common ports for backend and frontend services
_extended_hosts = []
for host in _static_hosts:
    _extended_hosts.append(host)
    # Add common development ports
    if host in ["backend", "localhost", "127.0.0.1"]:
        _extended_hosts.extend([f"{host}:8000", f"{host}:8080"])
    elif host in ["frontend"]:
        _extended_hosts.extend([f"{host}:3000", f"{host}:5173"])

# Allow all hosts at Django level - our middleware handles validation
# This can give security warnings but we are relying on
# webpages.middleware.DynamicHostValidationMiddleware to handle the actual
# validation.
# (So we keeping this to disable host validation in SecurityMiddleware)
ALLOWED_HOSTS = ["*"]

# Store static hosts for middleware validation
STATIC_ALLOWED_HOSTS = _extended_hosts

# Note: The DynamicHostValidationMiddleware handles all host validation
# using both STATIC_ALLOWED_HOSTS and database hostnames from WebPage.hostnames.
# This enables multi-site functionality where hostnames can be managed
# through the admin interface while maintaining security.

# Database failure fallback behavior for DynamicHostValidationMiddleware
# Options:
# - 'deny' (default): Deny hosts not in STATIC_ALLOWED_HOSTS during DB outages (most secure)
# - 'allow': Allow all hosts during DB outages (least secure, maximum availability)
# - 'static_only': Explicitly only check STATIC_ALLOWED_HOSTS (same as 'deny' but clearer)
DATABASE_FAILURE_FALLBACK = "deny"

# Wildcard hostname security control
# WARNING: Setting this to True allows "*" wildcard in database hostnames, which accepts ALL hosts
# This significantly reduces security and should only be used in development environments
# Production deployments should use specific hostnames instead of wildcards
ALLOW_WILDCARD_HOSTNAMES = False

# Hostname cache security configuration
# Prefix for hostname cache keys (used with SECRET_KEY hash for security)
# Changing this will invalidate existing hostname cache entries
HOSTNAME_CACHE_KEY_PREFIX = "webpages_hosts"

# Rate limiting configuration for API security
REST_FRAMEWORK = {
    # Add to existing REST_FRAMEWORK settings if any
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",  # Anonymous users
        "user": "1000/hour",  # Authenticated users
        "webpage_modifications": "50/hour",  # Webpage/hostname changes
    },
}

# Application definition
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
]

THIRD_PARTY_APPS = [
    # API and serialization
    "rest_framework",
    "rest_framework.authtoken",  # Token authentication for API
    "rest_framework_simplejwt",
    "django_filters",
    "drf_spectacular",
    # CORS for React frontend
    "corsheaders",
    # HTMX integration
    "django_htmx",
    # Authentication
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    # Development tools
    "django_extensions",
    "debug_toolbar",
    # Tree management
    "mptt",
    # Monitoring
    "django_prometheus",
    # WebSocket support
    "channels",
]

LOCAL_APPS = [
    # Add your local apps here as you create them
    # 'apps.core',
    # 'apps.users',
    # 'apps.api',
    "core",  # Core multi-tenancy support
    "htmx",
    "webpages",  # Core CMS system (required)
    "content",
    "content_import",  # Content import from external websites
    "easy_layouts",  # Easy layout definitions
    "easy_widgets",  # Easy widget definitions
    "file_manager",  # Comprehensive media file management system
    "object_storage",  # Non-hierarchical object storage system
    "utils",  # Utility features like value lists and schema system
    "ai_tracking",  # AI usage and cost tracking
    "statistics",  # Integrated statistics and analytics system
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "webpages.middleware.DynamicHostValidationMiddleware",  # Must be before SecurityMiddleware
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Serve static files (must be after SecurityMiddleware)
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.TenantContextMiddleware",  # Set tenant context for RLS (after auth, before other DB queries)
    "utils.middleware.dev_auth.DevAutoLoginMiddleware",  # Auto-login for development (only active when DEBUG=True)
    "allauth.account.middleware.AccountMiddleware",
    "django_htmx.middleware.HtmxMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "debug_toolbar.middleware.DebugToolbarMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

ROOT_URLCONF = "config.urls"

# ASGI Application for WebSocket support
ASGI_APPLICATION = "config.asgi.application"

# Channel Layers for WebSocket support
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [config("REDIS_URL", default="redis://redis:6379/0")],
        },
    },
}

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
            # Disable template caching in development for immediate updates
            "debug": DEBUG,
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database Configuration
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="eceee_v4"),
        "USER": config("POSTGRES_USER", default="postgres"),
        "PASSWORD": config("POSTGRES_PASSWORD", default="postgres"),
        "HOST": config("POSTGRES_HOST", default="db"),
        "PORT": config("POSTGRES_PORT", default="5432"),
    }
}

# Cache Configuration (Redis)
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": config("REDIS_URL", default="redis://redis:6379/0"),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Whitenoise configuration for production static file serving
WHITENOISE_AUTOREFRESH = DEBUG  # Only auto-refresh in development
WHITENOISE_USE_FINDERS = DEBUG
WHITENOISE_MANIFEST_STRICT = False  # Don't fail on missing files
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

# Media files
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Sites framework
SITE_ID = 1

# CORS Configuration for React frontend
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS", default="http://localhost:3000,http://127.0.0.1:3000"
).split(",")

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Only in development

# CSRF Configuration
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS", default="http://localhost:3000,http://127.0.0.1:3000"
).split(",")

# CSRF Cookie settings for React frontend
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript access to CSRF cookie
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_USE_SESSIONS = False  # Use cookies instead of sessions for CSRF tokens

# Django REST Framework Configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "djangorestframework_camel_case.render.CamelCaseJSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Configure camelCase conversion
    "JSON_UNDERSCOREIZE": {
        "no_underscore_before_number": True,
        # Exclude schema and pageData fields from case conversion
        # "ignore_fields": ["schema", "page_data", "pageData"],
        "ignore_fields": [],
    },
}

# File Upload Settings
# Increase upload limits for media files
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000  # Allow more form fields

# Media file settings
MEDIA_FILE_MAX_SIZE = 100 * 1024 * 1024  # 100MB per file
MEDIA_MAX_FILES_PER_UPLOAD = 50  # Allow up to 50 files per upload
MEDIA_ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
]

# Content Import Configuration
# Proxy asset token expiration time (in seconds)
CONTENT_IMPORT_PROXY_TOKEN_MAX_AGE = 3600  # 1 hour

# API Documentation with drf-spectacular
SPECTACULAR_SETTINGS = {
    "TITLE": "EASY v4 API",
    "DESCRIPTION": "AI-integrated CMS system for EASY project",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# JWT Configuration
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# Django Allauth Configuration
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

# Updated to use new allauth settings format (v0.50+)
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "mandatory"  # Require email verification
ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS = 3  # Confirmation links expire after 3 days
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True  # Auto-login after email confirmation

# Legacy settings (deprecated, kept for reference)
# ACCOUNT_USERNAME_REQUIRED = False
# ACCOUNT_AUTHENTICATION_METHOD = "email"

# Email Configuration (Postmark)
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default=(
        "django.core.mail.backends.console.EmailBackend"  # Console in dev
        if DEBUG
        else "postmark.django_backend.EmailBackend"
    ),  # Postmark in production
)
POSTMARK_API_KEY = config("POSTMARK_API_KEY", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@eceee.fred.nu")
SERVER_EMAIL = config("SERVER_EMAIL", default="server@eceee.fred.nu")

# Admin notifications for server errors
ADMINS = [
    ("EASY Admin", config("ADMIN_EMAIL", default="admin@eceee.fred.nu")),
]
MANAGERS = ADMINS

# Development Tools Configuration
if DEBUG:
    # Debug Toolbar
    INTERNAL_IPS = [
        "127.0.0.1",
        "localhost",
    ]

    # Django Extensions
    SHELL_PLUS_PRINT_SQL = True
    SHELL_PLUS = "ipython"


# Logging Configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "file": {
            "level": "INFO",
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "logs" / "django.log",
            "formatter": "verbose",
        },
        "console": {
            "level": "DEBUG" if DEBUG else "WARNING",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO" if DEBUG else "WARNING",
    },
    "loggers": {
        "django": {
            "handlers": ["file", "console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["file"],
            "level": "ERROR",
            "propagate": False,
        },
        "webpages": {
            "handlers": ["file", "console"],
            "level": "INFO" if DEBUG else "WARNING",
            "propagate": False,
        },
    },
}

# Create logs directory if it doesn't exist
os.makedirs(BASE_DIR / "logs", exist_ok=True)

# Security Settings for Production
if not DEBUG:
    # Proxy/Reverse proxy settings (for Caddy)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True

    # Security headers
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_REDIRECT_EXEMPT = []
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    X_FRAME_OPTIONS = "DENY"
else:
    # Disable COOP header in development to avoid warnings on non-HTTPS origins
    SECURE_CROSS_ORIGIN_OPENER_POLICY = None

# Celery Configuration (for background tasks)
CELERY_BROKER_URL = config("REDIS_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = config("REDIS_URL", default="redis://redis:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# Celery Beat Schedule for periodic tasks
CELERY_BEAT_SCHEDULE = {
    "check-ai-prices-weekly": {
        "task": "ai_tracking.tasks.check_ai_prices",
        "schedule": 604800.0,  # Every 7 days (in seconds)
    },
    "send-stale-price-reminders-weekly": {
        "task": "ai_tracking.tasks.send_stale_price_reminders",
        "schedule": 604800.0,  # Every 7 days
    },
    "check-budget-alerts-hourly": {
        "task": "ai_tracking.tasks.check_budget_alerts",
        "schedule": 3600.0,  # Every hour
    },
    "aggregate-statistics-daily": {
        "task": "statistics.tasks.aggregate_daily_stats",
        "schedule": 86400.0,  # Every 24 hours
    },
    "update-experiment-metrics-hourly": {
        "task": "statistics.tasks.update_experiment_metrics",
        "schedule": 3600.0,  # Every hour
    },
}

# Rate Limiting
RATELIMIT_ENABLE = True
RATELIMIT_USE_CACHE = "default"

# Health Check Endpoint
HEALTH_CHECK = {
    "DISK_USAGE_MAX": 90,  # percent
    "MEMORY_MIN": 100,  # in MB
}

# S3 Storage Configuration for Media Files
AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID", default="minioadmin")
AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY", default="minioadmin")
AWS_STORAGE_BUCKET_NAME = config("AWS_STORAGE_BUCKET_NAME", default="eceee-media")
AWS_S3_ENDPOINT_URL = config("AWS_S3_ENDPOINT_URL", default="http://minio:9000")
AWS_S3_REGION_NAME = config("AWS_S3_REGION_NAME", default="us-east-1")
AWS_S3_USE_SSL = config("AWS_S3_USE_SSL", default=False, cast=bool)

# S3 Client Configuration (for Linode Object Storage compatibility)
AWS_S3_SIGNATURE_VERSION = config("AWS_S3_SIGNATURE_VERSION", default="s3v4")
AWS_S3_ADDRESSING_STYLE = config("AWS_S3_ADDRESSING_STYLE", default="path")
AWS_S3_FILE_OVERWRITE = False
AWS_S3_OBJECT_PARAMETERS = {
    "CacheControl": "max-age=86400",
}
# Note: Production deployment adds Linode-specific settings via settings_production_override.py
# including STORAGES configuration, public-read ACL, and s3:// URL protocol

# Playwright Service Configuration for Content Import
PLAYWRIGHT_SERVICE_URL = config(
    "PLAYWRIGHT_SERVICE_URL", default="http://localhost:5000"
)

# Media File Handling Configuration
MEDIA_FILE_MAX_SIZE = 100 * 1024 * 1024  # 100MB
MEDIA_ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",  # Added for testing
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
]

# AI Integration Configuration
AI_TAGGING_ENABLED = config("AI_TAGGING_ENABLED", default=True, cast=bool)

# AI Tracking Configuration
AI_TRACKING = {
    "STORE_PROMPTS_BY_DEFAULT": config(
        "AI_STORE_PROMPTS_BY_DEFAULT", default=False, cast=bool
    ),
    "STORE_RESPONSES_BY_DEFAULT": config(
        "AI_STORE_RESPONSES_BY_DEFAULT", default=False, cast=bool
    ),
    "PRICE_STALE_DAYS": config("AI_PRICE_STALE_DAYS", default=30, cast=int),
    "ADMIN_EMAIL": config(
        "AI_TRACKING_ADMIN_EMAIL",
        default=config("DEFAULT_FROM_EMAIL", default="admin@example.com"),
    ),
    "BUDGET_CHECK_ENABLED": config("AI_BUDGET_CHECK_ENABLED", default=True, cast=bool),
}

# OpenAI Configuration for Content Import
OPENAI_API_KEY = config("OPENAI_API_KEY", default=None)

# Anthropic API Configuration (for AI tracking)
ANTHROPIC_API_KEY = config("ANTHROPIC_API_KEY", default=None)

# imgproxy Configuration
IMGPROXY_URL = config("IMGPROXY_URL", default="http://imgproxy:8080")
IMGPROXY_KEY = config("IMGPROXY_KEY", default="")
IMGPROXY_SALT = config("IMGPROXY_SALT", default="")
IMGPROXY_SIGNATURE_SIZE = config("IMGPROXY_SIGNATURE_SIZE", default=32, cast=int)

FM_SERVER_URL = "https://fms.eceee.org"
FM_USERNAME = "CWPAccount"
FM_PASSWORD = config("FM_PASSWORD", default="")

POSTMARK_API_KEY = config("POSTMARK_API_KEY", default="")
POSTMARK_SENDER = "eceee@eceee.org"
POSTMARK_TEST_MODE = False
POSTMARK_TRACK_OPENS = True
EMAIL_BACKEND = "postmark.django_backend.EmailBackend"
DEFAULT_FROM_EMAIL = "eceee@eceee.org"
EMAIL_HOST_USER = "eceee@eceee.org"

# EMAIL_BACKEND = "email_log.backends.EmailBackend"
# EMAIL_LOG_BACKEND = "postmark.django_backend.EmailBackend"
