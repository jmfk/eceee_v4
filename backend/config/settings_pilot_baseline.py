"""Settings for the runner's sanitized, disposable PostgreSQL test sources."""

import os

from .settings import *  # noqa: F401,F403

# The runner creates this alias inside its own unpublished Docker network.
# Refuse arbitrary hosts/databases so a typo cannot select development data.
if os.environ.get("PILOT_DATABASE_HOST", "pilot-db") != "pilot-db":
    raise RuntimeError("Pilot tests require the isolated pilot-db network alias")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "eceee_pilot_reference",
        "USER": "postgres",
        "PASSWORD": "",
        "HOST": "pilot-db",
        "PORT": "5432",
        "TEST": {"NAME": "test_eceee_pilot_reference"},
    }
}
# Existing error-page regressions use this synthetic site host and plain HTTP.
# These settings are used only on the runner's unpublished disposable network.
ALLOWED_HOSTS = ["testserver", "localhost", "testsite.com"]
SECURE_SSL_REDIRECT = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
LOGGING = {"version": 1, "disable_existing_loggers": False, "root": {"handlers": [], "level": "ERROR"}}
