"""Isolated Kanban test settings; never select a development database."""

from config import settings as base_settings
from config.settings import *  # noqa: F403,F401

DEBUG = False
INSTALLED_APPS = [app for app in base_settings.INSTALLED_APPS if app != "debug_toolbar"]
MIDDLEWARE = [item for item in base_settings.MIDDLEWARE if "debug_toolbar" not in item]
# Role regressions need the same API routes as the CMS.
ROOT_URLCONF = "config.urls"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "kanban_test",
        "USER": "postgres",
        "PASSWORD": "",
        "HOST": "kanban-db",
        "PORT": "5432",
    }
}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CELERY_TASK_ALWAYS_EAGER = True
OPENAI_API_KEY = None
LOGGING = {"version": 1, "disable_existing_loggers": False, "root": {"handlers": [], "level": "ERROR"}}
