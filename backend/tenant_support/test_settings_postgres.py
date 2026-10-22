"""For an isolated disposable local test cluster, never an application database."""

import os

from .test_settings import *  # noqa: F401, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "postgres",
        "USER": "eceee_support_tests",
        "HOST": "127.0.0.1",
        "PORT": os.environ.get("SUPPORT_TEST_POSTGRES_PORT", "12801"),
        "TEST": {"NAME": "test_eceee_tenant_support"},
    }
}
