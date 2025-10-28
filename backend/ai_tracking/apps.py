"""
AI Tracking App Configuration
"""

from django.apps import AppConfig


class AiTrackingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ai_tracking"
    verbose_name = "AI Usage Tracking"
