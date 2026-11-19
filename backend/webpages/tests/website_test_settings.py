"""Complete application schema on an isolated local Unix-socket test cluster. No .env files."""

import os
from core.diagnostics.postgres_test_settings import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "postgres",
        "USER": "eceee_website_tests",
        "HOST": os.environ.get("WEBSITE_TEST_SOCKET", "/nonexistent-website-test-socket"),
        "PORT": "5432",
        "TEST": {"NAME": "test_eceee_website"},
    }
}
ROOT_URLCONF = "webpages.tests.website_test_urls"

REST_FRAMEWORK["JSON_UNDERSCOREIZE"] = {"ignore_fields": ["translations"]}
