import logging
from datetime import timedelta

from celery import shared_task
from django.db.models import Count
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from site_statistics.models import EventRaw, PageStats, ConversionStats, Experiment, Assignment, ExperimentMetric
from core.models import Tenant

logger = logging.getLogger(__name__)


@shared_task
def ingest_events(tenant_id, events):
    """Persist a validated batch of analytics events from the Celery queue."""
    try:
        tenant = Tenant.objects.get(id=tenant_id, is_active=True)
    except Tenant.DoesNotExist:
        logger.warning("Discarding statistics batch for missing tenant %s", tenant_id)
        return 0

    rows = []
    for event in events:
        event_time = parse_datetime(event.get("event_time", "")) or timezone.now()
        if timezone.is_naive(event_time):
            event_time = timezone.make_aware(event_time, timezone.get_current_timezone())

        rows.append(
            EventRaw(
                tenant=tenant,
                user_id=event.get("user_id") or "anonymous",
                event_type=event.get("event_type") or "pageview",
                event_time=event_time,
                url=event.get("url"),
                referrer=event.get("referrer"),
                metadata=event.get("metadata") or {},
            )
        )

    EventRaw.objects.bulk_create(rows)
    return len(rows)


@shared_task
def aggregate_daily_stats():
    """
    Aggregates raw events into daily statistics for all tenants.
    """
    yesterday = timezone.now().date() - timedelta(days=1)
    tenants = Tenant.objects.all()

    for tenant in tenants:
        # Aggregating page views and unique visitors
        page_events = (
            EventRaw.objects.filter(tenant=tenant, event_time__date=yesterday, event_type="pageview")
            .values("url")
            .annotate(pageviews=Count("id"), unique_visitors=Count("user_id", distinct=True))
        )

        for entry in page_events:
            PageStats.objects.update_or_create(
                date=yesterday,
                tenant=tenant,
                url=entry["url"],
                defaults={
                    "pageviews": entry["pageviews"],
                    "unique_visitors": entry["unique_visitors"],
                    # avg_time_on_page and other metrics would require more complex session analysis
                },
            )

        # Aggregating conversion goals
        conversion_events = (
            EventRaw.objects.filter(tenant=tenant, event_time__date=yesterday, event_type="conversion")
            .values("metadata__goal_name")
            .annotate(conversions=Count("id"))
        )

        for entry in conversion_events:
            goal_name = entry.get("metadata__goal_name") or "default"
            ConversionStats.objects.update_or_create(
                date=yesterday,
                tenant=tenant,
                goal_name=goal_name,
                defaults={
                    "conversions": entry["conversions"],
                    # impressions would be tracked separately via 'experiment_impression' events
                },
            )

    logger.info(f"Daily aggregation completed for {yesterday}")


@shared_task
def update_experiment_metrics():
    """
    Updates metrics for active A/B testing experiments.
    """
    active_experiments = Experiment.objects.filter(status="running")

    for experiment in active_experiments:
        for variant in experiment.variants.all():
            # Calculate conversion rate for this variant
            total_assigned = Assignment.objects.filter(variant=variant).count()

            # Count conversions for users in this variant
            # This assumes we track the variant_id in conversion events
            conversions = (
                EventRaw.objects.filter(
                    tenant=experiment.tenant,
                    event_type="conversion",
                    metadata__experiment_id=str(experiment.id),
                    metadata__variant_id=str(variant.id),
                )
                .values("user_id")
                .distinct()
                .count()
            )

            # Update metrics
            ExperimentMetric.objects.update_or_create(
                variant=variant, metric_name="conversions", defaults={"value": float(conversions)}
            )

            ExperimentMetric.objects.update_or_create(
                variant=variant, metric_name="assignment_count", defaults={"value": float(total_assigned)}
            )

            if total_assigned > 0:
                conversion_rate = (conversions / total_assigned) * 100
                ExperimentMetric.objects.update_or_create(
                    variant=variant, metric_name="conversion_rate", defaults={"value": conversion_rate}
                )

    logger.info("Experiment metrics updated")
