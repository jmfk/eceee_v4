"""Article-specific consumption rules on top of the shared multi-term taxonomy."""

from rest_framework.exceptions import ValidationError

from taxonomy.assignments import assert_publishable as assert_terms
from taxonomy.assignments import links_for
from taxonomy.services import resolve_term


def assert_publishable(version):
    assert_terms(version)
    if version.object_instance.object_type.name != "article":
        return
    kinds = [resolve_term(link.tag) for link in links_for(version) if link.tag.tag_type == "article_kind"]
    if len(kinds) != 1 or kinds[0].slug not in {"news", "column", "press-release"}:
        raise ValidationError({"classification_ids": "Choose exactly one approved article kind."})
    if kinds[0].slug == "column" and not version.data.get("authors"):
        raise ValidationError({"authors": "A column requires at least one real columnist."})
