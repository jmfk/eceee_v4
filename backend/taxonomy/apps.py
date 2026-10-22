from django.apps import AppConfig


class TaxonomyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "taxonomy"
    verbose_name = "Taxonomy"

    def ready(self):
        from .signals import connect

        connect()
