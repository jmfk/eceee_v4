import logging
from typing import Any, Dict, List, Optional
from django.utils import timezone
from ..models import MigrationJob, MigrationTask, MigrationPlan

logger = logging.getLogger(__name__)


class MigrationEngine:
    """
    Core engine for executing migration workflows.
    Processes items through a sequence of steps.
    """

    def __init__(self, job: MigrationJob):
        self.job = job
        self.plan = job.plan
        self.step_handlers = {}
        self._register_default_handlers()

    def _register_default_handlers(self):
        """Register built-in step handlers."""
        # We will register handlers here as we implement them
        from .steps.variables import ExtractVariablesStep
        from .steps.conditions import ConditionStep
        from .steps.mapping import TargetMappingStep
        from .steps.media import MediaImportStep
        from .steps.html import ProcessHTMLStep

        self.register_handler("extract_variables", ExtractVariablesStep())
        self.register_handler("condition", ConditionStep())
        self.register_handler("target_mapping", TargetMappingStep())
        self.register_handler("media_import", MediaImportStep())
        self.register_handler("process_html", ProcessHTMLStep())

    def register_handler(self, step_type: str, handler: Any):
        self.step_handlers[step_type] = handler

    def process_item(self, source_item: Dict[str, Any]) -> bool:
        """
        Process a single item from the source.
        Returns True if successful, False otherwise.
        """
        source_id = str(source_item.get("id", source_item.get("uid", "")))
        if not source_id:
            # Fallback to hash if no ID
            import hashlib
            import json

            source_id = hashlib.md5(
                json.dumps(source_item, sort_keys=True).encode()
            ).hexdigest()

        task, created = MigrationTask.objects.get_or_create(
            job=self.job,
            source_id=source_id,
        )

        if task.status == "COMPLETED" and not self.plan.config.get(
            "reprocess_existing", False
        ):
            self.job.skipped_items += 1
            self.job.save(update_fields=["skipped_items"])
            return True

        task.status = "PENDING"
        task.started_at = timezone.now()
        task.context_data = {
            "source": source_item,
            "variables": {},
            "job": self.job,  # Pass job for tenant/plan access in steps
        }
        task.save()

        try:
            for step_config in self.plan.workflow:
                step_type = step_config.get("type")
                config = step_config.get("config", {})

                handler = self.step_handlers.get(step_type)
                if not handler:
                    raise ValueError(f"Unknown step type: {step_type}")

                result = handler.execute(task.context_data, config)

                if result is None:  # Step indicated to stop (e.g., condition not met)
                    task.status = "SKIPPED"
                    self.job.skipped_items += 1
                    break

                task.context_data = result
            else:
                # If loop finished without break
                task.status = "COMPLETED"
                self.job.processed_items += 1

        except Exception as e:
            logger.exception(f"Error processing item {source_id}")
            task.status = "FAILED"
            task.error_message = str(e)
            self.job.failed_items += 1
            self.job.error_log.append(
                {
                    "source_id": source_id,
                    "error": str(e),
                    "timestamp": timezone.now().isoformat(),
                }
            )

        task.completed_at = timezone.now()
        task.save()
        self.job.save(
            update_fields=[
                "processed_items",
                "failed_items",
                "skipped_items",
                "error_log",
            ]
        )

        return task.status == "COMPLETED"
