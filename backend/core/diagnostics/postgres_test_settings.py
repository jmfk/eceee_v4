"""Dedicated existing disposable test PostgreSQL, never a development/production database."""

from .test_settings import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "eceee_diagnostics_checks",
        "USER": "postgres",
        "PASSWORD": "test-only",
        "HOST": "test-db",
        "PORT": "5432",
    },
    "diagnostics": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "eceee_diagnostics_checks",
        "USER": "eceee_diagnostics_reader",
        "PASSWORD": "test-diagnostics-only-password-00000000",
        "HOST": "test-db",
        "PORT": "5432",
        "TEST": {"MIRROR": "default"},
    },
}

# Include the real CMS model registry/migrations, including indirect ownership views.
INSTALLED_APPS = [
    *INSTALLED_APPS,  # noqa: F405
    "rest_framework.authtoken",
    "django_celery_beat",
    "mptt",
    "webpages",
    "content",
    "taxonomy",
    "content_import",
    "easy_layouts",
    "easy_widgets",
    "file_manager",
    "object_storage",
    "data_connections",
    "content_migration",
    "tenant_plugins",
    "utils",
    "ai_tracking",
    "site_statistics",
]  # noqa: F405
LAYOUT_AUTODISCOVERY_ENABLED = False
LAYOUT_VALIDATION_ON_STARTUP = False
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
CELERY_TASK_ALWAYS_EAGER = True
SITE_ID = 1
AWS_S3_ENDPOINT_URL = "http://test-minio:9000"
AWS_ACCESS_KEY_ID = "test-eceee"
AWS_SECRET_ACCESS_KEY = "test-eceee-secret"
AWS_S3_REGION_NAME = "us-east-1"
AWS_S3_ADDRESSING_STYLE = "path"
AWS_S3_USE_SSL = False
AWS_QUERYSTRING_AUTH = False
