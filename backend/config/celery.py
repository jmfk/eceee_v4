"""
Celery configuration for EASY v4.

This module sets up Celery for background task processing including
AI agent tasks, scheduled tasks, and other async operations.
"""

import os
from celery import Celery
from django.conf import settings

# Set the default Django settings module for the 'celery' program
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("eceee_v4")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django apps
app.autodiscover_tasks()

# Configure task routes for different queues
app.conf.task_routes = {
    # AI Agent tasks
    "utils.tasks.execute_ai_agent_task": {"queue": "ai_agents"},
    "utils.tasks.cleanup_old_tasks": {"queue": "maintenance"},
    "utils.tasks.cancel_stuck_tasks": {"queue": "maintenance"},
    # File manager tasks
    "file_manager.tasks.analyze_media_file": {"queue": "ai_analysis"},
    "file_manager.tasks.generate_thumbnails": {"queue": "thumbnails"},
    "file_manager.tasks.cleanup_files": {"queue": "maintenance"},
    # Default queue for other tasks
    "*": {"queue": "default"},
}

# Configure task priorities
app.conf.task_default_priority = 5
app.conf.worker_prefetch_multiplier = 1
app.conf.task_acks_late = True
app.conf.worker_max_tasks_per_child = 1000

# Configure result backend settings
app.conf.result_expires = 3600  # 1 hour
app.conf.result_persistent = True

# Configure retry settings
app.conf.task_default_retry_delay = 60  # 1 minute
app.conf.task_max_retries = 3

# Timezone configuration
app.conf.timezone = settings.TIME_ZONE


@app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery setup."""
    logger.debug(f"Request: {self.request!r}")
    return "Debug task completed"


# Periodic task configuration
from celery.schedules import crontab

app.conf.beat_schedule = {
    # Clean up old AI agent tasks daily at 2 AM
    "cleanup-old-ai-tasks": {
        "task": "utils.tasks.cleanup_old_tasks",
        "schedule": crontab(hour=2, minute=0),
    },
    # Clean up soft-deleted files daily at 3 AM
    "cleanup-deleted-files": {
        "task": "file_manager.tasks.cleanup_deleted_files",
        "schedule": crontab(hour=3, minute=0),
        "args": (30, 100),  # 30 days retention, batch size 100
    },
    # Cancel stuck tasks every 30 minutes
    "cancel-stuck-tasks": {
        "task": "utils.tasks.cancel_stuck_tasks",
        "schedule": crontab(minute="*/30"),
    },
    # Send duplicate page report daily at 9 AM
    "send-duplicate-page-report": {
        "task": "webpages.tasks.send_duplicate_page_report",
        "schedule": crontab(hour=9, minute=0),
        "kwargs": {"period": "day"},
    },
    # Health check every 5 minutes
    "health-check": {
        "task": "config.celery.debug_task",
        "schedule": crontab(minute="*/5"),
    },
}


# Error handling
@app.task(bind=True)
def error_handler(self, uuid, exception, traceback):
    """Handle task errors."""
    logger.error(f"Task {uuid} failed: {exception}")
    logger.error(f"Traceback: {traceback}")


if __name__ == "__main__":
    app.start()
