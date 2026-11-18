"""The reserved, namespace-local origin classification for generated media."""

from rest_framework.exceptions import ValidationError

from .models import ClassificationType, Tag

ORIGIN_TYPE = "media_origin"
AI_SLUG = "ai"


def system_ai_term(namespace):
    definition, _ = ClassificationType.objects.get_or_create(
        tenant=namespace.tenant,
        namespace=namespace,
        key=ORIGIN_TYPE,
        defaults={"name": "Media origin", "allowed_uses": ["media_files"]},
    )
    term, _ = Tag.objects.get_or_create(
        tenant=namespace.tenant,
        namespace=namespace,
        tag_type=ORIGIN_TYPE,
        slug=AI_SLUG,
        defaults={"name": "AI", "classification_type": definition},
    )
    if term.status != "approved" or term.classification_type_id != definition.pk:
        raise ValidationError("The AI media tag is unavailable. Contact a taxonomy administrator.")
    return term
