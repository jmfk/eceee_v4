import logging
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Sum, Avg
from celery import shared_task
from statistics.models import EventRaw, PageStats, ConversionStats, Experiment, Assignment, ExperimentMetric
from core.models import Tenant

logger = logging.getLogger(__name__)

@shared_task
def aggregate_daily_stats():
    """
    Aggregates raw events into daily statistics for all tenants.
    """
    yesterday = timezone.now().date() - timedelta(days=1)
    tenants = Tenant.objects.all()

    for tenant in tenants:
        # Aggregating page views and unique visitors
        page_events = EventRaw.objects.filter(
            tenant_id=tenant,
            event_time__date=yesterday,
            event_type="pageview"
        ).values("url").annotate(
            pageviews=Count("id"),
            unique_visitors=Count("user_id", distinct=True)
        )

        for entry in page_events:
            PageStats.objects.update_or_create(
                date=yesterday,
                tenant_id=tenant,
                url=entry["url"],
                defaults={
                    "pageviews": entry["pageviews"],
                    "unique_visitors": entry["unique_visitors"],
                    # avg_time_on_page and other metrics would require more complex session analysis
                }
            )

        # Aggregating conversion goals
        conversion_events = EventRaw.objects.filter(
            tenant_id=tenant,
            event_time__date=yesterday,
            event_type="conversion"
        ).values("metadata__goal_name").annotate(
            conversions=Count("id")
        )

        for entry in conversion_events:
            goal_name = entry.get("metadata__goal_name", "default")
            ConversionStats.objects.update_or_create(
                date=yesterday,
                tenant_id=tenant,
                goal_name=goal_name,
                defaults={
                    "conversions": entry["conversions"],
                    # impressions would be tracked separately via 'experiment_impression' events
                }
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
            conversions = EventRaw.objects.filter(
                tenant_id=experiment.tenant_id,
                event_type="conversion",
                metadata__experiment_id=str(experiment.id),
                metadata__variant_id=str(variant.id)
            ).values("user_id").distinct().count()

            # Update metrics
            ExperimentMetric.objects.update_or_create(
                variant=variant,
                metric_name="conversions",
                defaults={"value": float(conversions)}
            )
            
            ExperimentMetric.objects.update_or_create(
                variant=variant,
                metric_name="assignment_count",
                defaults={"value": float(total_assigned)}
            )

            if total_assigned > 0:
                conversion_rate = (conversions / total_assigned) * 100
                ExperimentMetric.objects.update_or_create(
                    variant=variant,
                    metric_name="conversion_rate",
                    defaults={"value": conversion_rate}
                )

    logger.info("Experiment metrics updated")

