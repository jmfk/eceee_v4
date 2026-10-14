from django.apps import AppConfig


class TenantPluginsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "tenant_plugins"

    def ready(self):
        from . import builtins  # noqa: F401
