from copy import deepcopy

from django.contrib.auth import get_user_model
from django.test import TestCase

from content.models import Namespace
from content_migration.legacy_news.repository import (
    LegacyNewsDefinitionError,
    LegacyNewsRepository,
)
from content_migration.legacy_news.transformer import LegacyNewsPayload
from core.models import Tenant
from object_storage.models import ObjectInstance, ObjectTypeDefinition

TAXONOMY_FIELDS = {
    "types": ("news_type", "news_types"),
    "categories": ("news_category", "news_categories"),
    "sources": ("news_source", "news_sources"),
    "topics": ("news_topic", "news_topics"),
    "keywords": ("news_keyword", "news_keywords"),
}


def news_schema():
    properties = {
        "summary": {"component_type": "textarea"},
        "presentational_publishing_date": {"componentType": "datetime"},
        "source_date": {"componentType": "date"},
        "external_url": {"componentType": "url"},
        "featured_image": {"componentType": "image"},
    }
    for field_name, (object_type, relationship_type) in TAXONOMY_FIELDS.items():
        properties[field_name] = {
            "component_type": "object_reference",
            "multiple": True,
            "allowed_object_types": [object_type],
            "relationship_type": relationship_type,
        }
    return {"type": "object", "properties": properties}


class LegacyNewsRepositoryDefinitionTest(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="legacy-news")
        self.tenant = Tenant.objects.create(name="Legacy News", identifier="legacy-news", created_by=self.user)
        self.namespace = Namespace.objects.create(
            name="Legacy News",
            slug="legacy-news",
            tenant=self.tenant,
            created_by=self.user,
        )
        self.definitions = {}
        for name in ["news", *(value[0] for value in TAXONOMY_FIELDS.values())]:
            self.definitions[name] = ObjectTypeDefinition.objects.create(
                name=name,
                label=name,
                plural_label=name,
                namespace=self.namespace,
                created_by=self.user,
                schema=news_schema() if name == "news" else {"type": "object", "properties": {}},
                slot_configuration=({"slots": [{"name": "main", "label": "Article body"}]} if name == "news" else {}),
            )

    def repository(self):
        return LegacyNewsRepository(tenant=self.tenant, namespace=self.namespace, user=self.user)

    def test_loads_database_definitions_without_modifying_them(self):
        original = {
            name: {
                "schema": deepcopy(definition.schema),
                "slots": deepcopy(definition.slot_configuration),
                "updated_at": definition.updated_at,
            }
            for name, definition in self.definitions.items()
        }

        repository = self.repository()

        self.assertEqual(set(repository.object_types), set(self.definitions))
        for name, definition in self.definitions.items():
            definition.refresh_from_db()
            self.assertEqual(definition.schema, original[name]["schema"])
            self.assertEqual(definition.slot_configuration, original[name]["slots"])
            self.assertEqual(definition.updated_at, original[name]["updated_at"])

    def test_rejects_missing_definition_instead_of_creating_it(self):
        self.definitions["news_topic"].delete()

        with self.assertRaisesMessage(LegacyNewsDefinitionError, "missing object types: news_topic"):
            self.repository()

        self.assertFalse(ObjectTypeDefinition.objects.filter(name="news_topic").exists())

    def test_rejects_incompatible_relationship_field(self):
        news = self.definitions["news"]
        news.schema["properties"]["topics"]["allowed_object_types"] = ["news_keyword"]
        news.save(update_fields=["schema"])

        with self.assertRaisesMessage(LegacyNewsDefinitionError, "news.topics must allow news_topic"):
            self.repository()

    def test_rejects_definition_from_another_namespace(self):
        other_namespace = Namespace.objects.create(
            name="Other",
            slug="other",
            tenant=self.tenant,
            created_by=self.user,
        )
        news_source = self.definitions["news_source"]
        news_source.namespace = other_namespace
        news_source.save(update_fields=["namespace"])

        with self.assertRaisesMessage(
            LegacyNewsDefinitionError,
            "news_source is not assigned to namespace legacy-news",
        ):
            self.repository()

    def test_rejects_news_without_main_slot(self):
        news = self.definitions["news"]
        news.slot_configuration = {"slots": []}
        news.save(update_fields=["slot_configuration"])

        with self.assertRaisesMessage(LegacyNewsDefinitionError, "news must define a main widget slot"):
            self.repository()

    def test_marks_instance_only_changes_as_changed_without_extra_version(self):
        repository = self.repository()
        data = {
            "summary": "Summary",
            "presentationalPublishingDate": "2026-09-30T00:00:00+00:00",
            "sourceDate": "2026-09-30",
            "externalUrl": "",
            "featuredImage": None,
        }
        payload = LegacyNewsPayload(
            title="Original title",
            slug="instance-change",
            data=data,
            widgets={"main": []},
            metadata={"legacy": True, "legacy_content_checksum": "first"},
        )
        obj, created, changed = repository.upsert(payload)
        self.assertTrue(created)
        self.assertTrue(changed)

        updated_payload = LegacyNewsPayload(
            title="Updated title",
            slug=payload.slug,
            data=data,
            widgets=payload.widgets,
            metadata={"legacy": True, "legacy_content_checksum": "second"},
        )
        obj, created, changed = repository.upsert(updated_payload)

        self.assertFalse(created)
        self.assertTrue(changed)
        self.assertEqual(obj.title, "Updated title")
        self.assertEqual(obj.metadata["legacy_content_checksum"], "second")
        self.assertEqual(obj.versions.count(), 1)

        _, _, unchanged = repository.upsert(updated_payload)
        self.assertFalse(unchanged)
        self.assertEqual(ObjectInstance.objects.get(pk=obj.pk).versions.count(), 1)

    def test_marks_relationship_repairs_as_changed_without_extra_version(self):
        repository = self.repository()
        payload = LegacyNewsPayload(
            title="Relationship repair",
            slug="relationship-repair",
            data={"presentationalPublishingDate": "2026-09-30T00:00:00+00:00"},
            widgets={"main": []},
            metadata={"legacy": True},
            taxonomy={"sources": ["Example source"]},
        )
        obj, _, _ = repository.upsert(payload)
        version_count = obj.versions.count()
        obj.relationships = []
        obj.save(update_fields=["relationships"])

        obj, created, changed = repository.upsert(payload)

        self.assertFalse(created)
        self.assertTrue(changed)
        self.assertEqual(obj.versions.count(), version_count)
        self.assertEqual([relationship["type"] for relationship in obj.relationships], ["news_sources"])
