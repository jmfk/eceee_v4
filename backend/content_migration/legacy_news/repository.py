"""Database upserts for canonical News and News taxonomy objects."""

from __future__ import annotations

import hashlib
from datetime import datetime, time
from typing import Mapping, Sequence

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.text import slugify

from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion

from .transformer import LegacyNewsPayload

TAXONOMY_FIELDS = {
    "types": ("news_type", "news_types"),
    "categories": ("news_category", "news_categories"),
    "sources": ("news_source", "news_sources"),
    "topics": ("news_topic", "news_topics"),
    "keywords": ("news_keyword", "news_keywords"),
}
NEWS_FIELDS = {
    "summary": {"component_type": "textarea"},
    "presentationalPublishingDate": {"component_type": "datetime"},
    "sourceDate": {"component_type": "date"},
    "externalUrl": {"component_type": "url"},
    "featuredImage": {"component_type": "image"},
    "types": {
        "component_type": "object_reference",
        "allowed_object_type": "news_type",
        "relationship_type": "news_types",
    },
    "categories": {
        "component_type": "object_reference",
        "allowed_object_type": "news_category",
        "relationship_type": "news_categories",
    },
    "sources": {
        "component_type": "object_reference",
        "allowed_object_type": "news_source",
        "relationship_type": "news_sources",
    },
    "topics": {
        "component_type": "object_reference",
        "allowed_object_type": "news_topic",
        "relationship_type": "news_topics",
    },
    "keywords": {
        "component_type": "object_reference",
        "allowed_object_type": "news_keyword",
        "relationship_type": "news_keywords",
    },
}
FIELD_ALIASES = {
    "presentationalPublishingDate": "presentational_publishing_date",
    "sourceDate": "source_date",
    "externalUrl": "external_url",
    "featuredImage": "featured_image",
}


class LegacyNewsDefinitionError(ValueError):
    """The database-owned News definitions cannot safely receive the import."""


def _value(mapping, snake_case, camel_case):
    return mapping.get(snake_case, mapping.get(camel_case))


class LegacyNewsRepository:
    def __init__(self, *, tenant, namespace, user):
        self.tenant = tenant
        self.namespace = namespace
        self.user = user
        self.object_types = self.load_object_types()

    def load_object_types(self) -> dict[str, ObjectTypeDefinition]:
        """Load and validate definitions configured in React and stored in PostgreSQL."""

        required_names = {"news", *(type_name for type_name, _ in TAXONOMY_FIELDS.values())}
        result = {
            object_type.name: object_type
            for object_type in ObjectTypeDefinition.objects.filter(name__in=required_names).select_related(
                "namespace__tenant"
            )
        }
        errors = []
        missing = sorted(required_names - result.keys())
        if missing:
            errors.append("missing object types: " + ", ".join(missing))

        for name, object_type in result.items():
            if not object_type.is_active:
                errors.append(f"{name} is inactive")
            if object_type.namespace_id != self.namespace.id:
                errors.append(f"{name} is not assigned to namespace {self.namespace.slug}")

        if "news" in result:
            self._validate_news_definition(result["news"], errors)

        if errors:
            raise LegacyNewsDefinitionError("; ".join(errors))
        return result

    @staticmethod
    def _validate_news_definition(object_type, errors):
        properties = (object_type.schema or {}).get("properties", {})
        for field_name, expected in NEWS_FIELDS.items():
            field = properties.get(field_name) or properties.get(FIELD_ALIASES.get(field_name, field_name))
            if not isinstance(field, dict):
                errors.append(f"news.{field_name} is missing")
                continue
            component_type = _value(field, "component_type", "componentType")
            if component_type != expected["component_type"]:
                errors.append(f"news.{field_name} must use component type {expected['component_type']}")
            allowed_type = expected.get("allowed_object_type")
            if not allowed_type:
                continue
            if field.get("multiple") is not True:
                errors.append(f"news.{field_name} must allow multiple references")
            allowed = _value(field, "allowed_object_types", "allowedObjectTypes") or []
            if allowed_type not in allowed:
                errors.append(f"news.{field_name} must allow {allowed_type}")
            relationship_type = _value(field, "relationship_type", "relationshipType")
            if relationship_type != expected["relationship_type"]:
                errors.append(f"news.{field_name} must use relationship type {expected['relationship_type']}")

        slots = (object_type.slot_configuration or {}).get("slots", [])
        if not any(isinstance(slot, dict) and slot.get("name") == "main" for slot in slots):
            errors.append("news must define a main widget slot")

    @transaction.atomic
    def upsert(
        self,
        payload: LegacyNewsPayload,
        *,
        published_at=None,
        expires_at=None,
        featured=False,
    ):
        taxonomy_ids = self._upsert_taxonomy(payload.taxonomy)
        data = dict(payload.data)
        for field_name, ids in taxonomy_ids.items():
            data[field_name] = ids

        news_type = self.object_types["news"]
        obj, created = ObjectInstance.objects.get_or_create(
            tenant=self.tenant,
            object_type=news_type,
            slug=payload.slug,
            defaults={
                "title": payload.title,
                "status": "published",
                "created_by": self.user,
                "metadata": payload.metadata,
            },
        )
        if obj.tenant_id != self.tenant.id:
            raise ValueError(f"News slug {payload.slug!r} belongs to a different tenant")
        if not created and not (obj.metadata or {}).get("legacy"):
            raise ValueError(f"News slug {payload.slug!r} already exists and is not migration-owned")

        merged_metadata = {**(obj.metadata or {}), **payload.metadata}
        previous_source_url = (obj.metadata or {}).get("legacy_source_url")
        incoming_source_url = payload.metadata.get("legacy_source_url")
        if previous_source_url and incoming_source_url and previous_source_url != incoming_source_url:
            merged_metadata["legacy_source_url"] = previous_source_url
            merged_metadata["legacy_database_source_url"] = incoming_source_url
        if published_at is None:
            source_date = data.get("presentationalPublishingDate")
            if source_date:
                published_at = timezone.make_aware(
                    datetime.combine(datetime.fromisoformat(source_date).date(), time.min)
                )
            else:
                published_at = obj.publish_date or timezone.now()
        if published_at and timezone.is_naive(published_at):
            published_at = timezone.make_aware(published_at)
        if expires_at and timezone.is_naive(expires_at):
            expires_at = timezone.make_aware(expires_at)

        instance_changed = created or any(
            [
                obj.title != payload.title,
                obj.status != "published",
                obj.metadata != merged_metadata,
                obj.publish_date != published_at,
                obj.unpublish_date != expires_at,
            ]
        )
        if instance_changed:
            obj.title = payload.title
            obj.status = "published"
            obj.metadata = merged_metadata
            obj.publish_date = published_at
            obj.unpublish_date = expires_at
            obj.save()

        current = obj.current_version
        version_changed = not current or any(
            [
                current.data != data,
                current.widgets != payload.widgets,
                current.effective_date != published_at,
                current.expiry_date != expires_at,
                current.is_featured != featured,
            ]
        )
        if version_changed:
            number = (obj.versions.aggregate(value=Max("version_number"))["value"] or 0) + 1
            current = ObjectVersion.objects.create(
                object_instance=obj,
                version_number=number,
                data=data,
                widgets=payload.widgets,
                created_by=self.user,
                change_description="Legacy News migration",
                effective_date=published_at,
                expiry_date=expires_at,
                is_featured=featured,
            )
            obj.current_version = current
            obj.version = number
            obj.save(update_fields=["current_version", "version", "updated_at"])

        relationship_changed = False
        for field_name, (_, relationship_type) in TAXONOMY_FIELDS.items():
            relationship_ids = taxonomy_ids.get(field_name, [])
            current_ids = [
                relationship.get("object_id")
                for relationship in (obj.relationships or [])
                if relationship.get("type") == relationship_type
            ]
            if current_ids != relationship_ids:
                relationship_changed = True
                obj.set_relationships(relationship_type, relationship_ids)
        return obj, created, instance_changed or version_changed or relationship_changed

    def _upsert_taxonomy(self, taxonomy: Mapping[str, Sequence[str]]) -> dict[str, list[int]]:
        result = {}
        for field_name, (type_name, _) in TAXONOMY_FIELDS.items():
            result[field_name] = []
            seen = set()
            for raw_name in taxonomy.get(field_name, []):
                name = " ".join(str(raw_name).split())
                key = name.casefold()
                if not name or key in seen:
                    continue
                seen.add(key)
                slug = slugify(name)[:290] or "legacy-term"
                collision = ObjectInstance.objects.filter(
                    tenant=self.tenant,
                    object_type=self.object_types[type_name],
                    slug=slug,
                ).first()
                if collision and collision.title.casefold() != key:
                    digest = hashlib.sha256(name.encode("utf-8")).hexdigest()[:8]
                    slug = f"{slug[:281]}-{digest}"
                obj, _ = ObjectInstance.objects.get_or_create(
                    tenant=self.tenant,
                    object_type=self.object_types[type_name],
                    slug=slug,
                    defaults={
                        "title": name,
                        "status": "published",
                        "created_by": self.user,
                        "metadata": {"legacy": True},
                    },
                )
                if obj.tenant_id != self.tenant.id:
                    raise ValueError(f"Taxonomy slug {slug!r} belongs to a different tenant")
                if not obj.current_version:
                    version = ObjectVersion.objects.create(
                        object_instance=obj,
                        version_number=1,
                        data={},
                        widgets={},
                        created_by=self.user,
                        effective_date=timezone.now(),
                        change_description="Legacy News taxonomy migration",
                    )
                    obj.current_version = version
                    obj.save(update_fields=["current_version", "updated_at"])
                result[field_name].append(obj.id)
        return result
