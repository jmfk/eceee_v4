from .base import BaseStep
from typing import Any, Dict, Optional
from object_storage.models import ObjectInstance, ObjectVersion
from django.utils.text import slugify
from django.utils import timezone

class TargetMappingStep(BaseStep):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Final step to create/update the ObjectInstance.
        config: {
            "title_var": "title", 
            "slug_var": "slug", 
            "field_mapping": {"schema_field": "var_name"},
            "status": "published"
        }
        """
        variables = context.get("variables", {})
        source_id = context.get("source", {}).get("id")
        
        # We need the job to get the plan and tenant
        # Since the engine passes context, we might need to inject the job into context
        # or have the handler access it via some other way.
        # Let's assume 'job' is in context (I should update engine.py to include it)
        job = context.get("job")
        if not job:
            raise ValueError("Migration job not found in context")
            
        plan = job.plan
        
        title = variables.get(config.get("title_var", "title"), "Untitled")
        slug = variables.get(config.get("slug_var", "slug"))
        if not slug:
            slug = slugify(title)
            
        # Mapping data to object schema
        field_mapping = config.get("field_mapping", {})
        object_data = {}
        for schema_field, var_name in field_mapping.items():
            object_data[schema_field] = variables.get(var_name)
            
        # Create or update ObjectInstance
        # We use metadata to store source_id for tracking
        obj_instance, created = ObjectInstance.objects.update_or_create(
            object_type=plan.target_object_type,
            slug=slug,
            tenant=job.tenant or plan.tenant,
            defaults={
                "title": title,
                "status": config.get("status", "published"),
                "created_by": job.created_by or plan.created_by,
                "tenant": job.tenant or plan.tenant,
            }
        )
        
        # Store source info in metadata
        obj_instance.metadata["source_id"] = source_id
        obj_instance.metadata["migration_plan_id"] = str(plan.id)
        obj_instance.save(update_fields=["metadata"])
        
        # Create a new version
        ObjectVersion.objects.create(
            object_instance=obj_instance,
            version_number=obj_instance.version + (0 if created else 1),
            data=object_data,
            widgets={}, # Widgets are empty for now or handled by another step
            created_by=job.created_by or plan.created_by,
            effective_date=timezone.now() if obj_instance.status == "published" else None,
            change_description=f"Migrated from {plan.name} (Job {job.id})"
        )
        
        if not created:
            obj_instance.version += 1
            obj_instance.save(update_fields=["version"])

        return context

