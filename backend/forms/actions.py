import json
import requests
import logging
from django.conf import settings
from django.core.mail import send_mail
from django.template import Context, Template
from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion

logger = logging.getLogger(__name__)

class ActionRegistry:
    """
    Registry for form submission actions.
    """
    def __init__(self):
        self._actions = {}

    def register(self, action_type, handler_func):
        self._actions[action_type] = handler_func

    def execute(self, action_type, submission, action_config):
        if action_type not in self._actions:
            logger.error(f"Action type '{action_type}' not registered.")
            return False, f"Action type '{action_type}' not registered."
        
        try:
            return self._actions[action_type](submission, action_config)
        except Exception as e:
            logger.exception(f"Error executing action '{action_type}': {str(e)}")
            return False, str(e)

registry = ActionRegistry()

def action_save_to_object_storage(submission, config):
    """
    Saves form data to object storage.
    Config: { 
        "object_type": "slug", 
        "field_mapping": { "form_field": "object_property" },
        "title_field": "form_field_for_title"
    }
    """
    object_type_slug = config.get("object_type")
    field_mapping = config.get("field_mapping", {})
    title_field = config.get("title_field")
    
    try:
        object_type = ObjectTypeDefinition.objects.get(name=object_type_slug)
    except ObjectTypeDefinition.DoesNotExist:
        return False, f"Object type '{object_type_slug}' not found."

    # Map data
    object_data = {}
    for form_field, obj_prop in field_mapping.items():
        if form_field in submission.data:
            object_data[obj_prop] = submission.data[form_field]

    title = submission.data.get(title_field, f"Submission for {submission.form.label}")
    
    # Create object instance
    instance = ObjectInstance.objects.create(
        object_type=object_type,
        title=title,
        status="draft",
        created_by=submission.form.created_by, # Or use a system user
        tenant=submission.tenant
    )
    
    # Create initial version
    ObjectVersion.objects.create(
        object_instance=instance,
        version_number=1,
        data=object_data,
        widgets={},
        created_by=submission.form.created_by
    )
    
    return True, f"Saved to object storage as ID {instance.id}"

def action_send_email(submission, config):
    """
    Sends an email notification.
    Config: {
        "to": "email@example.com",
        "subject": "New submission",
        "template": "Hello {{ name }}, you submitted {{ data }}",
        "from_email": "noreply@example.com"
    }
    """
    to_email = config.get("to")
    subject = config.get("subject", "New Form Submission")
    template_str = config.get("template", "New submission received.")
    from_email = config.get("from_email", settings.DEFAULT_FROM_EMAIL)

    # Simple template rendering
    ctx = Context({"data": submission.data, "form": submission.form, "submission": submission})
    body = Template(template_str).render(ctx)

    try:
        send_mail(subject, body, from_email, [to_email])
        return True, f"Email sent to {to_email}"
    except Exception as e:
        return False, f"Failed to send email: {str(e)}"

def action_webhook(submission, config):
    """
    Sends a webhook.
    Config: { "url": "https://example.com/webhook", "headers": {} }
    """
    url = config.get("url")
    headers = config.get("headers", {})
    
    if not url:
        return False, "Webhook URL missing."

    try:
        payload = {
            "form_name": submission.form.name,
            "submission_id": str(submission.id),
            "data": submission.data,
            "created_at": submission.created_at.isoformat()
        }
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        return True, f"Webhook sent to {url}, status {response.status_code}"
    except Exception as e:
        return False, f"Webhook failed: {str(e)}"

# Register actions
registry.register("save_to_object_storage", action_save_to_object_storage)
registry.register("send_email", action_send_email)
registry.register("webhook", action_webhook)

