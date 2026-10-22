"""Article-specific consumption rules on top of the shared multi-term taxonomy."""

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from object_storage.models import ObjectVersion
from taxonomy.assignments import assert_publishable as assert_terms
from taxonomy.assignments import links_for
from taxonomy.services import resolve_term


def assert_publishable(version, *, at=None):
    assert_terms(version)
    if version.object_instance.object_type.name != "article":
        return
    kinds = [resolve_term(link.tag) for link in links_for(version) if link.tag.tag_type == "article_kind"]
    if len(kinds) != 1 or kinds[0].slug not in {"news", "column", "press-release"}:
        raise ValidationError({"classification_ids": "Choose exactly one approved article kind."})
    authors = version.data.get("authors") or []
    if kinds[0].slug == "column" and not authors:
        raise ValidationError({"authors": "A column requires at least one public columnist."})
    if authors:
        at = at or timezone.now()
        public_ids = set(
            ObjectVersion.objects.filter(
                object_instance_id__in=authors,
                object_instance__tenant_id=version.object_instance.tenant_id,
                object_instance__object_type__name="columnist",
                effective_date__lte=at,
            )
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=at))
            .values_list("object_instance_id", flat=True)
        )
        if {str(pk) for pk in public_ids} != {str(pk) for pk in authors}:
            raise ValidationError({"authors": "Publish every referenced columnist before this column."})
