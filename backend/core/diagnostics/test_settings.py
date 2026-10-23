"""Self-contained diagnostics tests; never load application env files or provider configuration."""

from tenant_support.test_settings import *  # noqa: F403

ROOT_URLCONF = "core.diagnostics.test_urls"
DEPLOYMENT_ENVIRONMENT = "development"
DIAGNOSTICS_ENABLED = True
DIAGNOSTICS_EXPORT_ROOT = "/nonexistent-diagnostic-test-export"
DIAGNOSTICS_LOG_SIGNING_KEY = ""
MIDDLEWARE = [
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.TenantContextMiddleware",
]
REST_FRAMEWORK = {"DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
ALLOWED_HOSTS = ["testserver"]
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"null": {"class": "logging.NullHandler"}},
    "root": {"handlers": ["null"]},
}

INSTALLED_APPS = [*INSTALLED_APPS, "drf_spectacular"]  # noqa: F405
REST_FRAMEWORK["DEFAULT_SCHEMA_CLASS"] = "drf_spectacular.openapi.AutoSchema"
