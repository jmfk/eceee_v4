import io
import json
import zipfile

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile, MediaTag
from object_storage.models import ObjectInstance, ObjectTransferJob, ObjectTypeDefinition, ObjectVersion
from object_storage.services.object_transfer import (
    ObjectPackageExporter,
    ObjectPackageImporter,
    build_preflight,
    candidate_catalog,
    collect_object_graph,
)
from taxonomy.models import Tag as TaxonomyTag


class MemoryStorage:
    def __init__(self):
        self.files = {}

    def _open(self, name, mode="rb"):
        return io.BytesIO(self.files[name])

    def _save(self, name, content):
        content.seek(0)
        self.files[name] = content.read()
        return name


class ObjectTransferServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("object-transfer")
        self.tenant = Tenant.objects.create(name="Object transfer", identifier="object-transfer", created_by=self.user)
        self.namespace = Namespace.objects.create(
            name="Object transfer namespace",
            slug="object-transfer",
            tenant=self.tenant,
            is_default=True,
            created_by=self.user,
        )
        self.child_type = ObjectTypeDefinition.objects.create(
            name="transfer-child",
            label="Child",
            plural_label="Children",
            namespace=self.namespace,
            schema={"type": "object", "properties": {}},
            slot_configuration={"slots": []},
            created_by=self.user,
        )
        self.root_type = ObjectTypeDefinition.objects.create(
            name="transfer-root",
            label="Root",
            plural_label="Roots",
            namespace=self.namespace,
            schema={
                "type": "object",
                "properties": {
                    "related": {
                        "type": "array",
                        "component_type": "object_reference",
                        "relationship_type": "related",
                    }
                },
            },
            slot_configuration={"slots": []},
            created_by=self.user,
        )
        self.root_type.allowed_child_types.add(self.child_type)
        self.root = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.root_type,
            title="Root",
            slug="root",
            created_by=self.user,
        )
        self.child = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.child_type,
            parent=self.root,
            title="Child",
            slug="child",
            created_by=self.user,
        )
        self.related = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.child_type,
            title="Related",
            slug="related",
            created_by=self.user,
        )
        self.media = MediaFile.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            title="Image",
            slug="image",
            original_filename="image.jpg",
            file_path="object-transfer/image.jpg",
            file_size=5,
            content_type="image/jpeg",
            file_hash="a" * 64,
            file_type="image",
            created_by=self.user,
            last_modified_by=self.user,
            uploaded_by=self.user,
        )
        media_tag = MediaTag.objects.create(
            namespace=self.namespace,
            name="Portrait",
            slug="portrait",
            created_by=self.user,
        )
        canonical_tag = TaxonomyTag.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            name="People",
            slug="people",
            tag_type="subject",
            created_by=self.user,
        )
        self.media.tags.add(media_tag)
        self.media.canonical_tags.add(canonical_tag)
        collection = MediaCollection.objects.create(
            namespace=self.namespace,
            title="Portraits",
            slug="portraits",
            created_by=self.user,
            last_modified_by=self.user,
        )
        collection.tags.add(media_tag)
        collection.canonical_tags.add(canonical_tag)
        self.media.collections.add(collection)
        version = ObjectVersion.objects.create(
            object_instance=self.root,
            version_number=1,
            data={"related": [self.related.id], "image": {"id": str(self.media.id)}},
            widgets={},
            created_by=self.user,
            effective_date=timezone.now(),
        )
        self.root.current_version = version
        self.root.version = 1
        self.root.save(update_fields=["current_version", "version", "updated_at"])

    def test_catalog_limits_roots_and_graph_follows_children_and_references(self):
        catalog = candidate_catalog(self.tenant, [{"object_type": self.root_type.name, "limit": 1}])
        self.assertEqual([item["id"] for item in catalog[0]["candidates"]], [self.root.id])
        graph = collect_object_graph(self.tenant, [self.root.id])
        self.assertEqual({item.id for item in graph}, {self.root.id, self.child.id, self.related.id})

    def test_preflight_counts_referenced_managed_media(self):
        result = build_preflight(self.tenant, [self.root.id])
        self.assertEqual(result["object_count"], 3)
        self.assertEqual(result["media_count"], 1)

    def test_package_round_trip_restores_changed_object_and_media_tags(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"image"
        export_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_EXPORT,
            created_by=self.user,
            options={"root_ids": [self.root.id]},
        )
        package_file = io.BytesIO()
        with zipfile.ZipFile(package_file, "w", zipfile.ZIP_DEFLATED) as package:
            ObjectPackageExporter(export_job, storage=storage).write_package(package)

        self.root.title = "Locally changed"
        self.root.save(update_fields=["title", "updated_at"])
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            result = ObjectPackageImporter(import_job, storage=storage).import_package(package)

        self.root.refresh_from_db()
        self.assertEqual(self.root.title, "Root")
        self.assertIn(str(self.root.id), result["object_map"].values())
        imported_media = MediaFile.objects.get(pk=self.media.pk)
        self.assertEqual(list(imported_media.tags.values_list("slug", flat=True)), ["portrait"])
        self.assertEqual(list(imported_media.canonical_tags.values_list("slug", flat=True)), ["people"])
        self.assertEqual(list(imported_media.collections.values_list("slug", flat=True)), ["portraits"])
        self.assertEqual(result["created_versions"], 0)
