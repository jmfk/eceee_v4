from django.apps import AppConfig


class CMSAuthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "cms_auth"

    def ready(self):
        from . import checks, signals  # noqa: F401
