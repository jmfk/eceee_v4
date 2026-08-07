from celery import shared_task
from .models import MigrationJob, MigrationPlan
from .services.engine import MigrationEngine
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

@shared_task
def run_migration_job(job_id):
    """
    Coordinator task for a migration job.
    Fetches items from source and dispatches batch processing tasks.
    """
    try:
        job = MigrationJob.objects.select_related('plan', 'plan__source_connection').get(id=job_id)
    except MigrationJob.DoesNotExist:
        return

    job.status = "RUNNING"
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])

    try:
        # 1. Fetch data from source
        from data_connections.services.engine import get_engine
        connection = job.plan.source_connection
        engine = get_engine(connection.connection_type)
        
        query_dsl = job.plan.query_dsl
        items = engine.execute(query_dsl, connection.config)
        
        if not items:
            job.status = "COMPLETED"
            job.completed_at = timezone.now()
            job.save(update_fields=["status", "completed_at"])
            return

        if not isinstance(items, list):
            items = [items]
            
        job.total_items = len(items)
        job.save(update_fields=["total_items"])
        
        # 2. Split into batches and queue processing
        batch_size = job.plan.config.get("batch_size", 50)
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            process_migration_batch.delay(str(job.id), batch)
            
    except Exception as e:
        logger.exception(f"Migration job {job_id} initialization failed")
        job.status = "FAILED"
        job.error_log.append({
            "error": f"Initialization failed: {str(e)}", 
            "timestamp": timezone.now().isoformat()
        })
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "error_log", "completed_at"])

@shared_task
def process_migration_batch(job_id, items):
    """
    Executor task for a batch of items.
    """
    try:
        job = MigrationJob.objects.select_related('plan', 'plan__source_connection', 'plan__target_object_type').get(id=job_id)
    except MigrationJob.DoesNotExist:
        return

    engine = MigrationEngine(job)
    for item in items:
        engine.process_item(item)
        
    # Check if job is finished
    # Note: This simple completion check might have race conditions 
    # but works for most cases where total items is known upfront.
    job.refresh_from_db()
    if job.processed_items + job.failed_items + job.skipped_items >= job.total_items:
        if job.status == "RUNNING":
            job.status = "COMPLETED"
            job.completed_at = timezone.now()
            job.save(update_fields=["status", "completed_at"])

