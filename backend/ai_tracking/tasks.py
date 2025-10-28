"""
Celery Tasks for AI Tracking

Scheduled tasks for price updates, budget monitoring, and notifications.
"""

import logging
from celery import shared_task
from django.utils import timezone
from .services import PriceUpdater

logger = logging.getLogger(__name__)


@shared_task
def check_ai_prices():
    """
    Weekly task to verify AI model prices.

    - Attempts to auto-fetch from provider APIs
    - Flags stale prices (>30 days by default)
    - Sends email digest to admins
    - Logs any price changes detected
    """
    logger.info("Starting AI price check task")

    updater = PriceUpdater()
    results = updater.check_all_prices()

    # Send email report if there are updates or issues
    updater.send_price_update_email(results)

    logger.info(
        f"AI price check complete. "
        f"Updated: {len(results['updated'])}, "
        f"Stale: {len(results['stale'])}, "
        f"Errors: {len(results['errors'])}"
    )

    return results


@shared_task
def send_stale_price_reminders():
    """
    Weekly task to remind admins about stale prices.
    """
    logger.info("Sending stale price reminders")

    updater = PriceUpdater()
    updater.send_stale_price_reminder()

    logger.info("Stale price reminders sent")


@shared_task
def check_budget_alerts():
    """
    Hourly task to check budget alerts and send notifications.
    """
    logger.info("Checking budget alerts")

    updater = PriceUpdater()
    triggered = updater.check_budget_alerts()

    logger.info(f"Budget alert check complete. Triggered: {len(triggered)}")

    return {
        "checked_at": str(timezone.now()),
        "triggered_count": len(triggered),
        "triggered_alerts": [alert.name for alert in triggered],
    }


@shared_task
def cleanup_old_usage_logs(days=90):
    """
    Optional task to clean up old usage logs.

    Args:
        days: Delete logs older than this many days (default 90)
    """
    from datetime import timedelta
    from django.utils import timezone
    from ai_tracking.models import AIUsageLog

    cutoff_date = timezone.now() - timedelta(days=days)

    # Only delete logs that don't have full data stored
    deleted_count = AIUsageLog.objects.filter(
        created_at__lt=cutoff_date, store_full_data=False
    ).delete()[0]

    logger.info(f"Cleaned up {deleted_count} old usage logs (older than {days} days)")

    return {"deleted_count": deleted_count, "cutoff_date": str(cutoff_date)}
