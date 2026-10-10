import hashlib
import io
import json
import threading
import zipfile
from contextlib import contextmanager
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

from celery.exceptions import Retry
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError, connection, connections, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework import serializers
from rest_framework.test import APIRequestFactory, force_authenticate

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile, MediaTag, MediaUsage
from object_storage.models import (
    ObjectInstance,
    ObjectTransferJob,
    ObjectTypeDefinition,
    ObjectVersion,
    TransferCheckpoint,
)
from object_storage.remote_views import (
    RemoteObjectSourceExportListView,
    RemoteObjectSourcePreflightView,
    TransferCheckpointListView,
    TransferCheckpointRestoreView,
    _decorate_preflight,
)
from object_storage.services.object_transfer import (
    MAX_ARCHIVE_BYTES,
    MAX_UNCOMPRESSED_BYTES,
    ObjectPackageExporter,
    ObjectPackageImporter,
    build_preflight,
    candidate_catalog,
    collect_object_graph,
    rebuild_imported_reverse_relationships,
)
from object_storage.services.transfer_checkpoints import (
    assert_import_checkpoint_current,
    capture_object_import_checkpoint,
    reference_write_barrier,
    restore_object_import_checkpoint,
    tenant_transfer_lock,
)
from object_storage.tasks import (
    _stream_package_response,
    cleanup_expired_object_packages,
    import_remote_object_package,
    restore_object_transfer_checkpoint,
)
from object_storage.views import upload_image
from taxonomy.models import Tag as TaxonomyTag
from webpages.models import PageVersion, WebPage
from webpages.services.theme_remote import RemoteTransportError


class MemoryStorage:
    def __init__(self):
        self.files = {}

    def _open(self, name, mode="rb"):
        return io.BytesIO(self.files[name])

    def _save(self, name, content):
        content.seek(0)
        self.files[name] = content.read()
        return name

    def open(self, name, mode="rb"):
        return self._open(name, mode)

    def save(self, name, content):
        return self._save(name, content)

    def save_private(self, name, content):
        return self._save(name, content)

    def url(self, name):
        return f"/media/{name}"

    def exists(self, name):
        return name in self.files

    def delete(self, name):
        self.files.pop(name, None)

    def copy(self, source, destination):
        self.files[destination] = self.files[source]

    def copy_from(self, source_storage, source, destination):
        self.files[destination] = source_storage.files[source]


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

    def test_source_views_return_validation_error_for_invalid_root_selection(self):
        request = SimpleNamespace(data={"rootIds": [self.root.id]}, tenant=self.tenant)
        error = ValueError("One or more selected root objects are unavailable.")

        for view_class in (RemoteObjectSourcePreflightView, RemoteObjectSourceExportListView):
            with self.subTest(view=view_class.__name__):
                with patch("object_storage.remote_views.build_preflight", side_effect=error):
                    with self.assertRaises(serializers.ValidationError) as raised:
                        view_class().post(request)

                self.assertEqual(str(raised.exception.detail["rootIds"]), str(error))

    def test_catalog_limits_roots_and_graph_follows_children_and_references(self):
        catalog = candidate_catalog(self.tenant, [{"object_type": self.root_type.name, "limit": 1}])
        self.assertEqual([item["id"] for item in catalog[0]["candidates"]], [self.root.id])
        with patch.object(ObjectInstance, "get_descendants", side_effect=AssertionError("Use direct children")):
            graph = collect_object_graph(self.tenant, [self.root.id])
        self.assertEqual({item.id for item in graph}, {self.root.id, self.child.id, self.related.id})

    def test_catalog_does_not_expose_types_from_another_tenant(self):
        foreign_user = User.objects.create_user("foreign-object-transfer")
        foreign_tenant = Tenant.objects.create(
            name="Foreign object transfer",
            identifier="foreign-object-transfer",
            created_by=foreign_user,
        )
        foreign_namespace = Namespace.objects.create(
            name="Foreign object transfer namespace",
            slug="foreign-object-transfer",
            tenant=foreign_tenant,
            created_by=foreign_user,
        )
        foreign_type = ObjectTypeDefinition.objects.create(
            name="foreign-transfer-root",
            label="Foreign root",
            plural_label="Foreign roots",
            namespace=foreign_namespace,
            schema={"type": "object", "properties": {"secret": {"type": "string"}}},
            slot_configuration={"slots": []},
            created_by=foreign_user,
        )
        ObjectInstance.objects.create(
            tenant=foreign_tenant,
            object_type=foreign_type,
            title="Foreign root",
            slug="foreign-root",
            created_by=foreign_user,
        )

        catalog = candidate_catalog(
            self.tenant,
            [
                {"object_type": self.root_type.name, "limit": 1},
                {"object_type": foreign_type.name, "limit": 1},
            ],
        )

        self.assertEqual([group["object_type"]["name"] for group in catalog], [self.root_type.name])

    def test_catalog_and_preflight_do_not_expose_foreign_topology_type_names(self):
        foreign_user = User.objects.create_user("foreign-topology")
        foreign_tenant = Tenant.objects.create(
            name="Foreign topology",
            identifier="foreign-topology",
            created_by=foreign_user,
        )
        foreign_namespace = Namespace.objects.create(
            name="Foreign topology namespace",
            slug="foreign-topology",
            tenant=foreign_tenant,
            created_by=foreign_user,
        )
        foreign_type = ObjectTypeDefinition.objects.create(
            name="foreign-topology-type",
            label="Foreign topology type",
            plural_label="Foreign topology types",
            namespace=foreign_namespace,
            created_by=foreign_user,
        )
        self.root_type.allowed_child_types.add(foreign_type)
        self.root_type.browser_group = foreign_type
        self.root_type.save(update_fields=["browser_group", "updated_at"])

        catalog = candidate_catalog(self.tenant, [{"object_type": self.root_type.name, "limit": 1}])
        preflight = build_preflight(self.tenant, [self.root.id])
        catalog_type = catalog[0]["object_type"]
        preflight_type = next(item for item in preflight["types"] if item["name"] == self.root_type.name)

        self.assertNotIn(foreign_type.name, catalog_type["allowed_child_types"])
        self.assertIsNone(catalog_type["browser_group"])
        self.assertNotIn(foreign_type.name, {item["name"] for item in preflight["types"]})
        self.assertNotIn(foreign_type.name, preflight_type["allowed_child_types"])
        self.assertIsNone(preflight_type["browser_group"])

    def test_preflight_counts_referenced_managed_media(self):
        result = build_preflight(self.tenant, [self.root.id])
        self.assertEqual(result["object_count"], 3)
        self.assertEqual(result["media_count"], 1)
        self.assertEqual(result["limits"]["entry_count"], 3)
        self.assertGreater(result["limits"]["uncompressed_bytes"], result["media_bytes"])

        with patch("object_storage.services.object_transfer.MAX_ENTRIES", 2):
            limited_result = build_preflight(self.tenant, [self.root.id])

        self.assertFalse(limited_result["limits"]["within_limits"])

        with patch("object_storage.services.object_transfer.MAX_UNCOMPRESSED_BYTES", result["media_bytes"]):
            size_limited_result = build_preflight(self.tenant, [self.root.id])

        self.assertFalse(size_limited_result["limits"]["within_limits"])

    def test_round_trip_includes_and_rewrites_media_referenced_by_url(self):
        for obj_type in (self.root_type, self.child_type):
            obj_type.namespace = None
            obj_type.save(update_fields=["namespace", "updated_at"])
        source_url = self.media.get_absolute_url()
        source_storage_url = self.media.get_file_url()
        external_url = "https://cdn.example/remote-only.jpg"
        self.root.current_version.data = {"image": source_url, "download": source_storage_url}
        self.root.current_version.widgets = {"main": [{"config": {"content": f'<img src="{external_url}">'}}]}
        self.root.current_version.save(update_fields=["data", "widgets", "updated_at"])

        preflight = build_preflight(self.tenant, [self.root.id])

        self.assertEqual(preflight["media_count"], 1)
        self.assertEqual(preflight["external_urls"], [external_url])

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

        destination_tenant = Tenant.objects.create(
            name="Media destination",
            identifier="media-destination",
            created_by=self.user,
        )
        destination_namespace = Namespace.objects.create(
            name="Media destination namespace",
            slug="media-destination",
            tenant=destination_tenant,
            created_by=self.user,
        )
        import_job = ObjectTransferJob.objects.create(
            tenant=destination_tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"namespace_resolutions": {self.namespace.slug: destination_namespace.slug}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            ObjectPackageImporter(import_job, storage=storage).import_package(package)

        imported = ObjectInstance.objects.get(
            tenant=destination_tenant,
            object_type=self.root_type,
            slug=self.root.slug,
        )
        imported_media = MediaFile.objects.get(tenant=destination_tenant)
        self.assertEqual(imported.current_version.data["image"], imported_media.get_absolute_url())
        self.assertEqual(imported.current_version.data["download"], imported_media.get_file_url())
        self.assertEqual(
            imported.current_version.widgets["main"][0]["config"]["content"], f'<img src="{external_url}">'
        )

    def test_export_rejects_packages_over_the_entry_limit(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"image"
        export_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_EXPORT,
            created_by=self.user,
            options={"root_ids": [self.root.id]},
        )

        with patch("object_storage.services.object_transfer.MAX_ENTRIES", 2):
            with zipfile.ZipFile(io.BytesIO(), "w", zipfile.ZIP_DEFLATED) as package:
                with self.assertRaisesMessage(ValueError, "exceeds safety limits"):
                    ObjectPackageExporter(export_job, storage=storage).write_package(package)

    def test_archive_download_limit_allows_zip_overhead(self):
        response = Mock()
        response.iter_content.return_value = [b"abc", b"def"]
        destination = io.BytesIO()

        self.assertGreater(MAX_ARCHIVE_BYTES, MAX_UNCOMPRESSED_BYTES)
        with patch("object_storage.tasks.MAX_ARCHIVE_BYTES", 6):
            self.assertEqual(_stream_package_response(response, destination), 6)

        with patch("object_storage.tasks.MAX_ARCHIVE_BYTES", 5):
            with self.assertRaisesMessage(ValueError, "safe archive download limit"):
                _stream_package_response(response, io.BytesIO())

    def test_export_includes_transitive_type_topology_dependencies(self):
        browser_type = ObjectTypeDefinition.objects.create(
            name="transfer-browser",
            label="Browser",
            plural_label="Browsers",
            namespace=self.namespace,
            created_by=self.user,
        )
        unused_child_type = ObjectTypeDefinition.objects.create(
            name="transfer-unused-child",
            label="Unused child",
            plural_label="Unused children",
            namespace=self.namespace,
            browser_group=browser_type,
            created_by=self.user,
        )
        self.root_type.allowed_child_types.add(unused_child_type)
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
        package_file.seek(0)
        with zipfile.ZipFile(package_file) as package:
            payload = json.loads(package.read("objects.json"))

        self.assertEqual(
            {item["name"] for item in payload["types"]},
            {self.root_type.name, self.child_type.name, unused_child_type.name, browser_type.name},
        )

    def test_skipped_type_is_not_restored_in_updated_type_topology(self):
        skipped_type = ObjectTypeDefinition.objects.create(
            name="transfer-skipped-child",
            label="Skipped child",
            plural_label="Skipped children",
            namespace=self.namespace,
            schema={"type": "object", "properties": {"remote": {"type": "string"}}},
            created_by=self.user,
        )
        self.root_type.allowed_child_types.add(skipped_type)
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

        self.root_type.allowed_child_types.remove(skipped_type)
        skipped_type.schema = {"type": "object", "properties": {"local": {"type": "string"}}}
        skipped_type.save(update_fields=["schema", "updated_at"])
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "type_resolutions": {
                    self.root_type.name: "update",
                    skipped_type.name: "skip",
                }
            },
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            ObjectPackageImporter(import_job, storage=storage).import_package(package)

        self.assertEqual(
            set(self.root_type.allowed_child_types.values_list("name", flat=True)),
            {self.child_type.name},
        )

    def test_skipping_a_type_also_skips_its_descendant_subtree(self):
        for obj_type in (self.root_type, self.child_type):
            obj_type.namespace = None
            obj_type.save(update_fields=["namespace", "updated_at"])
        skipped_type = ObjectTypeDefinition.objects.create(
            name="transfer-skipped-parent",
            label="Skipped parent",
            plural_label="Skipped parents",
            namespace=None,
            schema={"type": "object", "properties": {"remote": {"type": "string"}}},
            created_by=self.user,
        )
        skipped_parent = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=skipped_type,
            parent=self.root,
            title="Skipped parent",
            slug="skipped-parent",
            created_by=self.user,
        )
        ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.child_type,
            parent=skipped_parent,
            title="Skipped descendant",
            slug="skipped-descendant",
            created_by=self.user,
        )
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

        skipped_type.schema = {"type": "object", "properties": {"local": {"type": "string"}}}
        skipped_type.save(update_fields=["schema", "updated_at"])
        destination_tenant = Tenant.objects.create(
            name="Skipped subtree destination",
            identifier="skipped-subtree-destination",
            created_by=self.user,
        )
        destination_namespace = Namespace.objects.create(
            name="Skipped subtree destination",
            slug="skipped-subtree-destination",
            tenant=destination_tenant,
            created_by=self.user,
        )
        import_job = ObjectTransferJob.objects.create(
            tenant=destination_tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "type_resolutions": {skipped_type.name: "skip"},
                "namespace_resolutions": {self.namespace.slug: destination_namespace.slug},
            },
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            ObjectPackageImporter(import_job, storage=storage).import_package(package)

        self.assertTrue(ObjectInstance.objects.filter(tenant=destination_tenant, slug=self.root.slug).exists())
        self.assertFalse(ObjectInstance.objects.filter(tenant=destination_tenant, slug="skipped-parent").exists())
        self.assertFalse(ObjectInstance.objects.filter(tenant=destination_tenant, slug="skipped-descendant").exists())

    def test_reverse_relationship_rebuild_is_tenant_scoped(self):
        self.root.relationships = [{"type": "related", "object_id": self.related.id}]
        self.root.save(update_fields=["relationships", "updated_at"])
        foreign_tenant = Tenant.objects.create(name="Foreign", identifier="foreign-relations", created_by=self.user)
        foreign_source = ObjectInstance.objects.create(
            tenant=foreign_tenant,
            object_type=self.root_type,
            title="Foreign source",
            slug="root",
            relationships=[{"type": "foreign", "object_id": self.related.id}],
            created_by=self.user,
        )

        with patch.object(ObjectInstance, "rebuild_related_from", side_effect=AssertionError("Use the bulk rebuild")):
            rebuild_imported_reverse_relationships(self.tenant, [self.related])

        self.related.refresh_from_db()
        self.assertEqual(self.related.related_from, [{"type": "related", "object_id": self.root.id}])
        self.assertNotIn(foreign_source.id, [item["object_id"] for item in self.related.related_from])

    def test_import_clears_reverse_relationships_removed_from_existing_objects(self):
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

        local_target = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.child_type,
            title="Local target",
            slug="local-target",
            created_by=self.user,
            related_from=[{"type": "local", "object_id": self.root.id}],
        )
        self.root.relationships = [{"type": "local", "object_id": local_target.id}]
        self.root.save(update_fields=["relationships", "updated_at"])
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            ObjectPackageImporter(import_job, storage=storage).import_package(package)

        local_target.refresh_from_db()
        self.assertEqual(local_target.related_from, [])

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
        self.assertIn(self.root.id, result["object_map"].values())
        imported_media = MediaFile.objects.get(pk=self.media.pk)
        self.assertEqual(list(imported_media.tags.values_list("slug", flat=True)), ["portrait"])
        self.assertEqual(list(imported_media.canonical_tags.values_list("slug", flat=True)), ["people"])
        self.assertEqual(list(imported_media.collections.values_list("slug", flat=True)), ["portraits"])
        self.assertEqual(result["created_versions"], 0)
        self.assertEqual(TransferCheckpoint.objects.get(source_job=import_job).status, "available")

    def test_import_checkpoint_is_durable_before_worker_exit(self):
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
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        importer = ObjectPackageImporter(import_job, storage=storage)

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            with patch.object(importer, "_apply_package", side_effect=SystemExit("worker terminated")):
                with self.assertRaises(SystemExit):
                    importer.import_package(package)

        checkpoint = TransferCheckpoint.objects.get(source_job=import_job)
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_PREPARING)
        self.assertTrue(all(storage.exists(item["path"]) for item in checkpoint.snapshot["media_binaries"].values()))

    def test_import_checkpoint_redelivery_reuses_preparing_binary_snapshot(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"image"
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        payload = {
            "types": [{"name": self.root_type.name}],
            "objects": [],
            "media": [{"file_hash": self.media.file_hash, "collections": []}],
        }

        checkpoint = capture_object_import_checkpoint(import_job, payload, storage=storage)
        paths_before = set(storage.files)
        redelivered = capture_object_import_checkpoint(import_job, payload, storage=storage)

        self.assertEqual(redelivered.id, checkpoint.id)
        self.assertEqual(set(storage.files), paths_before)

    def test_failed_import_recapture_adopts_retry_stable_binary_snapshot(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"image"
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        payload = {
            "types": [{"name": self.root_type.name}],
            "objects": [],
            "media": [{"file_hash": self.media.file_hash, "collections": []}],
        }
        checkpoint = capture_object_import_checkpoint(import_job, payload, storage=storage)
        old_paths = {item["path"] for item in checkpoint.snapshot["media_binaries"].values()}
        checkpoint.status = TransferCheckpoint.STATUS_FAILED
        checkpoint.save(update_fields=["status", "updated_at"])

        with self.captureOnCommitCallbacks(execute=True):
            recaptured = capture_object_import_checkpoint(import_job, payload, storage=storage)

        recaptured.refresh_from_db()
        new_paths = {item["path"] for item in recaptured.snapshot["media_binaries"].values()}
        self.assertTrue(new_paths)
        self.assertEqual(new_paths, old_paths)
        self.assertTrue(all(storage.exists(path) for path in new_paths))

    def test_import_aborts_if_planned_collection_appears_after_checkpoint(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"image"
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        payload = {
            "types": [{"name": self.root_type.name}],
            "objects": [],
            "media": [
                {
                    "file_hash": self.media.file_hash,
                    "collections": [{"slug": "new-collection", "media_tags": [], "canonical_tags": []}],
                }
            ],
        }
        checkpoint = capture_object_import_checkpoint(import_job, payload, storage=storage)
        MediaCollection.objects.create(
            namespace=self.namespace,
            title="Concurrent collection",
            slug="new-collection",
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "changed after its import checkpoint"):
            assert_import_checkpoint_current(checkpoint, storage, storage)

    def test_import_checkpoint_restores_pre_import_object_and_media_state(self):
        storage = MemoryStorage()
        checkpoint_storage = MemoryStorage()
        storage.files[self.media.file_path] = b"image"
        original_tag = self.media.tags.get()
        original_tag_id = original_tag.id
        export_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_EXPORT,
            created_by=self.user,
            options={"root_ids": [self.root.id]},
        )
        package_file = io.BytesIO()
        with zipfile.ZipFile(package_file, "w", zipfile.ZIP_DEFLATED) as package:
            ObjectPackageExporter(export_job, storage=storage).write_package(package)

        self.root.title = "Destination title before import"
        self.root.save(update_fields=["title", "updated_at"])
        self.assertTrue(self.media.delete(user=self.user))
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            result = ObjectPackageImporter(
                import_job,
                storage=storage,
                checkpoint_storage_backend=checkpoint_storage,
                system_storage_backend=storage,
            ).import_package(package)

        checkpoint = TransferCheckpoint.objects.get(id=result["checkpoint_id"])
        checkpoint_binary = checkpoint.snapshot["media_binaries"][str(self.media.id)]["path"]
        self.assertIn(checkpoint_binary, checkpoint_storage.files)
        self.assertNotIn(checkpoint_binary, storage.files)
        self.root.refresh_from_db()
        self.media.refresh_from_db()
        self.assertEqual(self.root.title, "Root")
        self.assertFalse(self.media.is_deleted)
        original_tag.delete()
        del storage.files[self.media.file_path]

        restore_object_import_checkpoint(
            checkpoint,
            self.user,
            storage=storage,
            checkpoint_storage_backend=checkpoint_storage,
            system_storage_backend=storage,
        )

        self.root.refresh_from_db()
        restored_media = MediaFile.objects.with_deleted().get(pk=self.media.pk)
        checkpoint.refresh_from_db()
        self.assertEqual(self.root.title, "Destination title before import")
        self.assertTrue(restored_media.is_deleted)
        self.assertTrue(MediaTag.objects.filter(id=original_tag_id).exists())
        self.assertEqual(list(restored_media.tags.values_list("id", flat=True)), [original_tag_id])
        self.assertEqual(storage.files[self.media.file_path], b"image")
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_RESTORED)

    def test_import_checkpoint_restores_existing_collection_tag_membership(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"image"
        collection = self.media.collections.get(slug="portraits")
        imported_tag = MediaTag.objects.create(
            namespace=self.namespace,
            name="Imported tag",
            slug="imported-tag",
            created_by=self.user,
        )
        collection.tags.add(imported_tag)
        export_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_EXPORT,
            created_by=self.user,
            options={"root_ids": [self.root.id]},
        )
        package_file = io.BytesIO()
        with zipfile.ZipFile(package_file, "w", zipfile.ZIP_DEFLATED) as package:
            ObjectPackageExporter(export_job, storage=storage).write_package(package)
        collection.tags.remove(imported_tag)
        original_tag_ids = set(collection.tags.values_list("id", flat=True))
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            result = ObjectPackageImporter(import_job, storage=storage).import_package(package)

        self.assertIn(imported_tag.id, collection.tags.values_list("id", flat=True))
        restore_object_import_checkpoint(
            TransferCheckpoint.objects.get(id=result["checkpoint_id"]), self.user, storage=storage
        )
        self.assertEqual(set(collection.tags.values_list("id", flat=True)), original_tag_ids)

    def test_checkpoint_failure_prevents_import_mutation(self):
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
        self.root.title = "Must survive"
        self.root.save(update_fields=["title", "updated_at"])
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            with patch(
                "object_storage.services.transfer_checkpoints.capture_object_import_checkpoint",
                side_effect=RuntimeError("checkpoint unavailable"),
            ):
                with self.assertRaisesMessage(RuntimeError, "checkpoint unavailable"):
                    ObjectPackageImporter(import_job, storage=storage).import_package(package)

        self.root.refresh_from_db()
        self.assertEqual(self.root.title, "Must survive")
        self.assertFalse(TransferCheckpoint.objects.filter(source_job=import_job).exists())

    def test_checkpoint_endpoints_are_tenant_scoped_and_queue_restore(self):
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["objects", "media"],
            snapshot={"schema_version": 1},
            created_by=self.user,
        )
        factory = APIRequestFactory()
        list_request = factory.get("/api/v1/objects/remote/checkpoints/")
        list_request.tenant = self.tenant
        force_authenticate(list_request, self.user)
        response = TransferCheckpointListView.as_view()(list_request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["id"], str(checkpoint.id))

        foreign_tenant = Tenant.objects.create(name="Foreign", identifier="foreign-checkpoint", created_by=self.user)
        restore_request = factory.post(f"/api/v1/objects/remote/checkpoints/{checkpoint.id}/restore/", {})
        restore_request.tenant = foreign_tenant
        force_authenticate(restore_request, self.user)
        response = TransferCheckpointRestoreView.as_view()(restore_request, checkpoint_id=checkpoint.id)
        self.assertEqual(response.status_code, 404)

        restore_request = factory.post(f"/api/v1/objects/remote/checkpoints/{checkpoint.id}/restore/", {})
        restore_request.tenant = self.tenant
        force_authenticate(restore_request, self.user)
        with patch("object_storage.remote_views.restore_object_transfer_checkpoint.delay") as delayed:
            with self.captureOnCommitCallbacks(execute=True):
                response = TransferCheckpointRestoreView.as_view()(restore_request, checkpoint_id=checkpoint.id)
        self.assertEqual(response.status_code, 202)
        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_RESTORE_PENDING)
        delayed.assert_called_once_with(str(checkpoint.id), self.user.id)

        preparing = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            resource_scopes=["objects"],
            snapshot={"schema_version": 1},
            created_by=self.user,
        )
        restore_request = factory.post(f"/api/v1/objects/remote/checkpoints/{preparing.id}/restore/", {})
        restore_request.tenant = self.tenant
        force_authenticate(restore_request, self.user)
        response = TransferCheckpointRestoreView.as_view()(restore_request, checkpoint_id=preparing.id)
        self.assertEqual(response.status_code, 400)
        preparing.refresh_from_db()
        self.assertEqual(preparing.status, TransferCheckpoint.STATUS_PREPARING)

        cleanup = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_RESTORED,
            resource_scopes=["media"],
            snapshot={"schema_version": 1},
            source_details={"binary_cleanup_pending": True},
            operation_result={"restorable": True},
            created_by=self.user,
        )
        cleanup_request = factory.post(f"/api/v1/objects/remote/checkpoints/{cleanup.id}/restore/", {})
        cleanup_request.tenant = self.tenant
        force_authenticate(cleanup_request, self.user)
        with patch("object_storage.remote_views.restore_object_transfer_checkpoint.delay") as delayed:
            with self.captureOnCommitCallbacks(execute=True):
                response = TransferCheckpointRestoreView.as_view()(cleanup_request, checkpoint_id=cleanup.id)
        self.assertEqual(response.status_code, 202)
        cleanup.refresh_from_db()
        self.assertTrue(cleanup.source_details["binary_cleanup_retry_active"])
        delayed.assert_called_once_with(str(cleanup.id), self.user.id)
        rendered = json.loads(response.render().content)
        self.assertTrue(rendered["sourceDetails"]["binaryCleanupRetryActive"])
        self.assertNotIn("binary_cleanup_retry_active", rendered["sourceDetails"])

        duplicate_request = factory.post(f"/api/v1/objects/remote/checkpoints/{cleanup.id}/restore/", {})
        duplicate_request.tenant = self.tenant
        force_authenticate(duplicate_request, self.user)
        with patch("object_storage.remote_views.restore_object_transfer_checkpoint.delay") as duplicate_delay:
            response = TransferCheckpointRestoreView.as_view()(duplicate_request, checkpoint_id=cleanup.id)
        self.assertEqual(response.status_code, 202)
        self.assertFalse(response.data["canRestore"])
        duplicate_delay.assert_not_called()

    def test_restore_queue_failure_is_retryable(self):
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["objects"],
            snapshot={"schema_version": 1},
            operation_result={"restorable": True},
            created_by=self.user,
        )
        factory = APIRequestFactory()
        request = factory.post(f"/api/v1/objects/remote/checkpoints/{checkpoint.id}/restore/", {})
        request.tenant = self.tenant
        force_authenticate(request, self.user)

        with patch(
            "object_storage.remote_views.restore_object_transfer_checkpoint.delay",
            side_effect=RuntimeError("broker unavailable"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                response = TransferCheckpointRestoreView.as_view()(request, checkpoint_id=checkpoint.id)

        self.assertEqual(response.status_code, 202)
        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_FAILED)
        self.assertIn("could not be queued", checkpoint.errors[0])

        retry = factory.post(f"/api/v1/objects/remote/checkpoints/{checkpoint.id}/restore/", {})
        retry.tenant = self.tenant
        force_authenticate(retry, self.user)
        with patch("object_storage.remote_views.restore_object_transfer_checkpoint.delay") as delayed:
            with self.captureOnCommitCallbacks(execute=True):
                response = TransferCheckpointRestoreView.as_view()(retry, checkpoint_id=checkpoint.id)
        self.assertEqual(response.status_code, 202)
        delayed.assert_called_once_with(str(checkpoint.id), self.user.id)

    def test_failed_restore_rolls_back_and_records_failure(self):
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["objects"],
            snapshot={
                "schema_version": 1,
                "objects": [{"id": 999999, "version_ids": []}],
                "media": [],
                "types": [],
            },
            created_by=self.user,
        )

        with self.assertRaises(ObjectInstance.DoesNotExist):
            restore_object_import_checkpoint(checkpoint, self.user)

        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_FAILED)
        self.assertTrue(checkpoint.errors)

    def test_restore_preserves_created_media_referenced_outside_its_scope(self):
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["media"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={"media_ids": [str(self.media.id)]},
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "references imported media"):
            restore_object_import_checkpoint(checkpoint, self.user)

        self.assertTrue(MediaFile.objects.filter(id=self.media.id).exists())
        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_FAILED)
        inverse = TransferCheckpoint.objects.get(source_details__restore_of=str(checkpoint.id))
        self.assertEqual(inverse.status, TransferCheckpoint.STATUS_AVAILABLE)

    def test_restore_refuses_reused_created_media_path(self):
        self.root.current_version.data = {}
        self.root.current_version.save(update_fields=["data"])
        imported_media = MediaFile.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            title="Imported",
            slug="imported-path",
            original_filename="shared.jpg",
            file_path="object-transfer/shared.jpg",
            file_size=6,
            content_type="image/jpeg",
            file_hash="b" * 64,
            file_type="image",
            created_by=self.user,
            last_modified_by=self.user,
            uploaded_by=self.user,
        )
        other_tenant = Tenant.objects.create(
            name="Other media owner", identifier="other-media-owner", created_by=self.user
        )
        other_namespace = Namespace.objects.create(
            tenant=other_tenant,
            name="Other media",
            slug="other-media",
            created_by=self.user,
        )
        MediaFile.objects.create(
            tenant=other_tenant,
            namespace=other_namespace,
            title="Later",
            slug="later-path",
            original_filename="shared.jpg",
            file_path=imported_media.file_path,
            file_size=6,
            content_type="image/jpeg",
            file_hash="c" * 64,
            file_type="image",
            created_by=self.user,
            last_modified_by=self.user,
            uploaded_by=self.user,
        )
        storage = MemoryStorage()
        storage.files[imported_media.file_path] = b"shared"
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["media"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={
                "media_ids": [str(imported_media.id)],
                "media_paths": [imported_media.file_path],
            },
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "media path"):
            restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        self.assertEqual(storage.files[imported_media.file_path], b"shared")
        self.assertEqual(MediaFile.objects.filter(file_path=imported_media.file_path).count(), 2)

    def test_restore_refuses_to_delete_created_parent_with_external_children(self):
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        checkpoint = capture_object_import_checkpoint(
            import_job,
            {
                "types": [{"name": self.child_type.name}],
                "objects": [{"type": self.child_type.name, "slug": self.child.slug}],
                "media": [],
            },
        )
        created_parent = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.root_type,
            title="Imported parent",
            slug="imported-parent",
            created_by=self.user,
        )
        external_child = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.child_type,
            parent=created_parent,
            title="Later child",
            slug="later-child",
            created_by=self.user,
        )
        checkpoint.created_resources = {"object_ids": [created_parent.id]}
        checkpoint.status = TransferCheckpoint.STATUS_AVAILABLE
        checkpoint.save(update_fields=["created_resources", "status", "updated_at"])

        with self.assertRaisesMessage(ValueError, "nested below imported content"):
            restore_object_import_checkpoint(checkpoint, self.user)

        external_child.refresh_from_db()
        self.assertEqual(external_child.parent_id, created_parent.id)
        self.assertTrue(ObjectInstance.objects.filter(id=created_parent.id).exists())
        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_FAILED)

    def test_restore_refuses_to_delete_created_object_referenced_by_page_version(self):
        imported = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.child_type,
            title="Imported object",
            slug="imported-object",
            created_by=self.user,
        )
        page = WebPage.objects.create(
            tenant=self.tenant,
            title="Object listing",
            slug="object-listing",
            created_by=self.user,
            last_modified_by=self.user,
        )
        PageVersion.objects.create(
            page=page,
            version_number=1,
            page_data={},
            widgets={"main": [{"config": {"parent_object_id": imported.id}}]},
            created_by=self.user,
        )
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["objects"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={"object_ids": [imported.id]},
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "references imported content"):
            restore_object_import_checkpoint(checkpoint, self.user)

        self.assertTrue(ObjectInstance.objects.filter(id=imported.id).exists())

    def test_restore_refuses_to_delete_created_object_referenced_by_historical_object_version(self):
        imported = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.child_type,
            title="Imported object",
            slug="historical-imported-object",
            created_by=self.user,
        )
        ObjectVersion.objects.create(
            object_instance=self.child,
            version_number=1,
            data={},
            widgets={"main": [{"config": {"object_id": imported.id}}]},
            created_by=self.user,
        )
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["objects"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={"object_ids": [imported.id]},
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "references imported content"):
            restore_object_import_checkpoint(checkpoint, self.user)

        self.assertTrue(ObjectInstance.objects.filter(id=imported.id).exists())

    def test_restore_refuses_to_delete_created_media_referenced_by_page_version(self):
        page = WebPage.objects.create(
            tenant=self.tenant,
            title="Media page",
            slug="media-page",
            created_by=self.user,
            last_modified_by=self.user,
        )
        PageVersion.objects.create(
            page=page,
            version_number=1,
            widgets={"main": [{"config": {"mediaId": str(self.media.id)}}]},
            created_by=self.user,
        )
        self.root.current_version.data = {}
        self.root.current_version.save(update_fields=["data"])
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["media"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={"media_ids": [str(self.media.id)]},
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "references imported media"):
            restore_object_import_checkpoint(checkpoint, self.user)

        self.assertTrue(MediaFile.objects.filter(id=self.media.id).exists())

    def test_restore_refuses_to_delete_created_media_with_usage_record(self):
        self.root.current_version.data = {}
        self.root.current_version.save(update_fields=["data"])
        MediaUsage.objects.create(
            media_file=self.media,
            usage_type="content",
            object_id="later-content",
            object_type="ObjectInstance",
            created_by=self.user,
        )
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["media"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={"media_ids": [str(self.media.id)]},
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "now in use"):
            restore_object_import_checkpoint(checkpoint, self.user)

        self.assertTrue(MediaFile.objects.filter(id=self.media.id).exists())
        self.assertTrue(MediaUsage.objects.filter(media_file=self.media).exists())

    def test_restore_refuses_to_delete_created_taxonomy_tag_used_by_page(self):
        imported_tag = TaxonomyTag.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            name="Imported tag",
            slug="imported-tag",
            created_by=self.user,
        )
        page = WebPage.objects.create(
            tenant=self.tenant,
            title="Tagged page",
            slug="tagged-page",
            created_by=self.user,
            last_modified_by=self.user,
        )
        version = PageVersion.objects.create(page=page, version_number=1, created_by=self.user)
        version.canonical_tags.add(imported_tag, through_defaults={"position": 0})
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["objects"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={"taxonomy_tag_ids": [str(imported_tag.id)]},
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "Taxonomy tags"):
            restore_object_import_checkpoint(checkpoint, self.user)

        self.assertTrue(TaxonomyTag.objects.filter(id=imported_tag.id).exists())

    def test_import_reuses_media_tag_with_same_name_and_different_slug(self):
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

        MediaTag.objects.get(namespace=self.namespace, slug="portrait").delete()
        local_tag = MediaTag.objects.create(
            namespace=self.namespace,
            name="Portrait",
            slug="local-portrait",
            created_by=self.user,
        )
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            ObjectPackageImporter(import_job, storage=storage).import_package(package)

        self.assertEqual(list(self.media.tags.values_list("id", flat=True)), [local_tag.id])
        collection = self.media.collections.get(slug="portraits")
        self.assertEqual(list(collection.tags.values_list("id", flat=True)), [local_tag.id])

    def test_restore_allows_import_created_tag_on_affected_existing_media(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"image"
        source_tag = self.media.tags.get()
        export_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_EXPORT,
            created_by=self.user,
            options={"root_ids": [self.root.id]},
        )
        package_file = io.BytesIO()
        with zipfile.ZipFile(package_file, "w", zipfile.ZIP_DEFLATED) as package:
            ObjectPackageExporter(export_job, storage=storage).write_package(package)
        self.media.tags.clear()
        source_tag.delete()
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            result = ObjectPackageImporter(import_job, storage=storage).import_package(package)
        imported_tag = self.media.tags.get()

        restore_object_import_checkpoint(
            TransferCheckpoint.objects.get(id=result["checkpoint_id"]), self.user, storage=storage
        )

        self.assertFalse(MediaTag.objects.filter(id=imported_tag.id).exists())
        self.assertFalse(self.media.tags.exists())

    def test_import_restores_soft_deleted_media_with_the_same_hash(self):
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

        self.assertTrue(self.media.delete(user=self.user))
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            ObjectPackageImporter(import_job, storage=storage).import_package(package)

        restored = MediaFile.objects.get(pk=self.media.pk)
        self.assertFalse(restored.is_deleted)
        self.assertEqual(restored.file_hash, self.media.file_hash)

    def test_repeated_import_does_not_duplicate_multiple_versions(self):
        draft = ObjectVersion.objects.create(
            object_instance=self.root,
            version_number=2,
            data={"related": [self.related.id], "title": "Draft"},
            widgets={},
            created_by=self.user,
            effective_date=timezone.now() + timedelta(days=1),
        )
        self.root.current_version = draft
        self.root.version = 2
        self.root.save(update_fields=["current_version", "version", "updated_at"])
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

        for _attempt in range(2):
            import_job = ObjectTransferJob.objects.create(
                tenant=self.tenant,
                kind=ObjectTransferJob.KIND_IMPORT,
                created_by=self.user,
                options={"type_resolutions": {}},
            )
            package_file.seek(0)
            with zipfile.ZipFile(package_file, "r") as package:
                result = ObjectPackageImporter(import_job, storage=storage).import_package(package)
            self.assertEqual(result["created_versions"], 0)

        self.root.refresh_from_db()
        self.assertEqual(self.root.versions.count(), 2)
        self.assertEqual(self.root.current_version_id, draft.id)

    def test_same_import_job_redelivery_reuses_completed_checkpoint(self):
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
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )

        results = []
        for _attempt in range(2):
            package_file.seek(0)
            with zipfile.ZipFile(package_file, "r") as package:
                results.append(ObjectPackageImporter(import_job, storage=storage).import_package(package))

        self.assertEqual(results[0], results[1])
        self.assertEqual(TransferCheckpoint.objects.filter(source_job=import_job).count(), 1)

    def test_restore_creates_an_inverse_checkpoint_that_can_reverse_the_restore(self):
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
        self.root.title = "Destination title before import"
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
        root_id = self.root.id
        self.root.delete()
        self.assertFalse(ObjectInstance.objects.filter(id=root_id).exists())

        checkpoint = TransferCheckpoint.objects.get(id=result["checkpoint_id"])
        restore_object_import_checkpoint(checkpoint, self.user, storage=storage)
        self.root = ObjectInstance.objects.get(id=root_id)
        self.assertEqual(self.root.title, "Destination title before import")
        self.assertTrue(ObjectInstance.objects.filter(id=root_id).exists())

        checkpoint.refresh_from_db()
        inverse = TransferCheckpoint.objects.get(id=checkpoint.source_details["inverse_checkpoint_id"])
        restore_object_import_checkpoint(inverse, self.user, storage=storage)
        self.assertFalse(ObjectInstance.objects.filter(id=root_id).exists())

    def test_inverse_checkpoint_recreates_records_removed_by_restore(self):
        for obj_type in (self.root_type, self.child_type):
            obj_type.namespace = None
            obj_type.save(update_fields=["namespace", "updated_at"])
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
        destination = Tenant.objects.create(
            name="Restore destination", identifier="restore-destination", created_by=self.user
        )
        namespace = Namespace.objects.create(
            tenant=destination,
            name="Restore destination",
            slug="restore-destination",
            is_default=True,
            created_by=self.user,
        )
        import_job = ObjectTransferJob.objects.create(
            tenant=destination,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}, "namespace_resolutions": {self.namespace.slug: namespace.slug}},
        )
        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            result = ObjectPackageImporter(import_job, storage=storage).import_package(package)
        checkpoint = TransferCheckpoint.objects.get(id=result["checkpoint_id"])
        storage.files[self.media.file_path] = b"current-state"
        imported_object_ids = list(result["object_map"].values())
        imported_media_ids = list(result["media_map"].values())
        imported_media = MediaFile.objects.get(id=imported_media_ids[0])
        replacement = MediaFile.objects.create(
            tenant=destination,
            namespace=namespace,
            title="Replacement",
            slug="replacement",
            original_filename="replacement.jpg",
            file_path="restore-destination/replacement.jpg",
            file_size=11,
            content_type="image/jpeg",
            file_hash="b" * 64,
            file_type="image",
            created_by=self.user,
            last_modified_by=self.user,
            uploaded_by=self.user,
        )
        storage.files[replacement.file_path] = b"replacement"
        changed_at = timezone.now()
        imported_media.ai_suggested_title = "Suggested title"
        imported_media.ai_extracted_text = "Extracted text"
        imported_media.ai_confidence_score = 0.75
        imported_media.download_count = 9
        imported_media.last_accessed = changed_at
        imported_media.reference_count = 4
        imported_media.last_referenced = changed_at
        imported_media.referenced_in = {"pages": [42]}
        imported_media.replaced_by = replacement
        imported_media.save()
        storage.files[imported_media.file_path] = b"imported-state"

        restore_object_import_checkpoint(checkpoint, self.user, storage=storage)
        self.assertFalse(ObjectInstance.objects.filter(tenant=destination, id__in=imported_object_ids).exists())
        self.assertFalse(
            MediaFile.objects.with_deleted().filter(tenant=destination, id__in=imported_media_ids).exists()
        )
        self.assertNotIn(imported_media.file_path, storage.files)

        checkpoint.refresh_from_db()
        inverse = TransferCheckpoint.objects.get(id=checkpoint.source_details["inverse_checkpoint_id"])
        restore_object_import_checkpoint(inverse, self.user, storage=storage)
        self.assertEqual(
            ObjectInstance.objects.filter(tenant=destination, id__in=imported_object_ids).count(),
            len(imported_object_ids),
        )
        self.assertEqual(
            MediaFile.objects.filter(tenant=destination, id__in=imported_media_ids).count(),
            len(imported_media_ids),
        )
        restored_media = MediaFile.objects.get(id=imported_media.id)
        self.assertEqual(restored_media.ai_suggested_title, "Suggested title")
        self.assertEqual(restored_media.ai_extracted_text, "Extracted text")
        self.assertEqual(restored_media.ai_confidence_score, 0.75)
        self.assertEqual(restored_media.download_count, 9)
        self.assertEqual(restored_media.last_accessed, changed_at)
        self.assertEqual(restored_media.reference_count, 4)
        self.assertEqual(restored_media.last_referenced, changed_at)
        self.assertEqual(restored_media.referenced_in, {"pages": [42]})
        self.assertEqual(restored_media.replaced_by_id, replacement.id)
        self.assertEqual(storage.files[restored_media.file_path], b"imported-state")

        inverse.refresh_from_db()
        reverse_inverse = TransferCheckpoint.objects.get(id=inverse.source_details["inverse_checkpoint_id"])
        restore_object_import_checkpoint(reverse_inverse, self.user, storage=storage)

        self.assertFalse(
            MediaFile.objects.with_deleted().filter(tenant=destination, id__in=imported_media_ids).exists()
        )
        self.assertNotIn(restored_media.file_path, storage.files)

    def test_inverse_checkpoint_recreates_replacement_type_icon_without_leaking_it(self):
        storage = MemoryStorage()
        imported_type = ObjectTypeDefinition.objects.create(
            name="imported-type-with-icon",
            label="Imported type",
            plural_label="Imported types",
            namespace=self.namespace,
            schema={"type": "object", "properties": {}},
            slot_configuration={"slots": []},
            created_by=self.user,
        )
        icon_path = "object_types/icons/remote/imported-type/icon.svg"
        imported_type.icon_image.name = icon_path
        imported_type.save(update_fields=["icon_image", "updated_at"])
        storage.files[icon_path] = b"<svg/>"
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["types"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={
                "type_ids": [str(imported_type.id)],
                "type_icon_paths": [icon_path],
            },
            operation_result={"restorable": True},
            created_by=self.user,
        )
        replacement_path = "object_types/icons/replacement.svg"
        storage.files.pop(icon_path)
        storage.files[replacement_path] = b"<svg>replacement</svg>"
        imported_type.icon_image.name = replacement_path
        imported_type.save(update_fields=["icon_image", "updated_at"])

        restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        self.assertFalse(ObjectTypeDefinition.objects.filter(id=imported_type.id).exists())
        self.assertNotIn(icon_path, storage.files)
        self.assertNotIn(replacement_path, storage.files)
        checkpoint.refresh_from_db()
        inverse = TransferCheckpoint.objects.get(id=checkpoint.source_details["inverse_checkpoint_id"])

        restore_object_import_checkpoint(inverse, self.user, storage=storage)

        recreated = ObjectTypeDefinition.objects.get(id=imported_type.id)
        self.assertEqual(recreated.icon_image.name, replacement_path)
        self.assertEqual(storage.files[replacement_path], b"<svg>replacement</svg>")

        inverse.refresh_from_db()
        reverse_inverse = TransferCheckpoint.objects.get(id=inverse.source_details["inverse_checkpoint_id"])
        restore_object_import_checkpoint(reverse_inverse, self.user, storage=storage)

        self.assertFalse(ObjectTypeDefinition.objects.filter(id=imported_type.id).exists())
        self.assertNotIn(replacement_path, storage.files)

    def test_object_type_icon_upload_rejects_foreign_tenant_usage(self):
        other_tenant = Tenant.objects.create(name="Other icon tenant", identifier="other-icon", created_by=self.user)
        ObjectInstance.objects.create(
            tenant=other_tenant,
            object_type=self.root_type,
            title="Foreign type use",
            slug="foreign-type-use",
            created_by=self.user,
        )
        request = APIRequestFactory().post(
            "/api/v1/objects/upload-image/",
            {
                "object_type_id": self.root_type.id,
                "image": SimpleUploadedFile("icon.png", b"not-read", content_type="image/png"),
            },
            format="multipart",
        )
        request.tenant = self.tenant
        force_authenticate(request, self.user)

        response = upload_image(request)

        self.assertEqual(response.status_code, 403)

    def test_object_type_icon_upload_uses_the_model_field_storage(self):
        storage = MemoryStorage()
        field = ObjectTypeDefinition._meta.get_field("icon_image")
        request = APIRequestFactory().post(
            "/api/v1/objects/upload-image/",
            {
                "object_type_id": self.root_type.id,
                "image": SimpleUploadedFile("icon.png", b"image-bytes", content_type="image/png"),
            },
            format="multipart",
        )
        request.tenant = self.tenant
        force_authenticate(request, self.user)

        with (
            patch.object(field, "storage", storage),
            patch("object_storage.views.default_storage") as default,
            patch("rest_framework.throttling.SimpleRateThrottle.allow_request", return_value=True),
        ):
            response = upload_image(request)

        self.assertEqual(response.status_code, 201)
        self.root_type.refresh_from_db()
        self.assertEqual(storage.files[self.root_type.icon_image.name], b"image-bytes")
        default.save.assert_not_called()

    def test_restore_allows_affected_existing_type_to_reference_created_type(self):
        storage = MemoryStorage()
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {self.root_type.name: "update"}},
        )
        checkpoint = capture_object_import_checkpoint(
            import_job,
            {"types": [{"name": self.root_type.name}], "objects": [], "media": []},
            storage=storage,
        )
        imported_type = ObjectTypeDefinition.objects.create(
            name="created-related-type",
            label="Created related type",
            plural_label="Created related types",
            namespace=self.namespace,
            schema={"type": "object", "properties": {}},
            slot_configuration={"slots": []},
            created_by=self.user,
        )
        self.root_type.allowed_child_types.add(imported_type)
        checkpoint.created_resources = {"type_ids": [str(imported_type.id)]}
        checkpoint.operation_result = {"restorable": True}
        checkpoint.status = TransferCheckpoint.STATUS_AVAILABLE
        checkpoint.save(update_fields=["created_resources", "operation_result", "status", "updated_at"])

        restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        self.root_type.refresh_from_db()
        self.assertFalse(ObjectTypeDefinition.objects.filter(id=imported_type.id).exists())
        self.assertNotIn(imported_type.id, self.root_type.allowed_child_types.values_list("id", flat=True))

    def test_restore_updated_existing_type_icon_is_not_treated_as_external_use(self):
        storage = MemoryStorage()
        old_icon_path = "object_types/icons/original/root.svg"
        new_icon_path = "object_types/icons/remote/root/new.svg"
        self.root_type.icon_image.name = old_icon_path
        self.root_type.save(update_fields=["icon_image", "updated_at"])
        storage.files[old_icon_path] = b"old-icon"
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {self.root_type.name: "update"}},
        )
        checkpoint = capture_object_import_checkpoint(
            import_job,
            {"types": [{"name": self.root_type.name}], "objects": [], "media": []},
            storage=storage,
        )
        self.root_type.icon_image.name = new_icon_path
        self.root_type.save(update_fields=["icon_image", "updated_at"])
        storage.files[new_icon_path] = b"new-icon"
        checkpoint.created_resources = {"type_icon_paths": [new_icon_path]}
        checkpoint.operation_result = {"restorable": True}
        checkpoint.status = TransferCheckpoint.STATUS_AVAILABLE
        checkpoint.save(update_fields=["created_resources", "operation_result", "status", "updated_at"])

        restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        self.root_type.refresh_from_db()
        self.assertEqual(self.root_type.icon_image.name, old_icon_path)
        self.assertEqual(storage.files[old_icon_path], b"old-icon")
        self.assertNotIn(new_icon_path, storage.files)

    def test_failed_type_update_does_not_delete_a_preexisting_icon_path(self):
        storage = MemoryStorage()
        old_icon_path = "object_types/icons/original/root.svg"
        icon_bytes = b"shared-icon"
        checksum = hashlib.sha256(icon_bytes).hexdigest()
        remote_icon_path = f"object_types/icons/remote/{checksum}.svg"
        self.root_type.icon_image.name = old_icon_path
        self.root_type.save(update_fields=["icon_image", "updated_at"])
        storage.files[old_icon_path] = b"old-icon"
        storage.files[remote_icon_path] = icon_bytes
        shared_type = ObjectTypeDefinition.objects.create(
            name="shared-icon-owner",
            label="Shared icon owner",
            plural_label="Shared icon owners",
            namespace=self.namespace,
            icon_image=remote_icon_path,
            schema={"type": "object", "properties": {}},
            slot_configuration={"slots": []},
            created_by=self.user,
        )
        type_data = {
            "name": self.root_type.name,
            "label": self.root_type.label,
            "plural_label": self.root_type.plural_label,
            "description": self.root_type.description,
            "schema": self.root_type.schema,
            "slot_configuration": self.root_type.slot_configuration,
            "hierarchy_level": self.root_type.hierarchy_level,
            "is_active": self.root_type.is_active,
            "metadata": self.root_type.metadata,
            "icon_filename": "root.svg",
            "namespace": {"name": self.namespace.name, "slug": self.namespace.slug, "description": ""},
            "allowed_child_types": [],
            "browser_group": None,
        }
        payload_bytes = json.dumps({"types": [type_data], "objects": [], "media": []}).encode()
        icon_member = f"type-icons/{self.root_type.name}/root.svg"
        manifest = {
            "package_version": "object-transfer/1",
            "checksums": {
                "objects.json": hashlib.sha256(payload_bytes).hexdigest(),
                icon_member: checksum,
            },
        }
        package_file = io.BytesIO()
        with zipfile.ZipFile(package_file, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("objects.json", payload_bytes)
            package.writestr(icon_member, icon_bytes)
            package.writestr("manifest.json", json.dumps(manifest).encode())
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {self.root_type.name: "update"}},
        )
        importer = ObjectPackageImporter(import_job, storage=storage)

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            with patch.object(importer, "_import_media", side_effect=RuntimeError("later import failure")):
                with self.assertRaisesMessage(RuntimeError, "later import failure"):
                    importer.import_package(package)

        self.assertEqual(importer.created_type_icon_paths, [])
        self.assertEqual(storage.files[remote_icon_path], icon_bytes)
        self.assertTrue(ObjectTypeDefinition.objects.filter(id=shared_type.id, icon_image=remote_icon_path).exists())

    def test_failed_restore_compensates_media_and_keeps_durable_inverse(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"before-import"
        export_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_EXPORT,
            created_by=self.user,
            options={"root_ids": [self.root.id]},
        )
        package_file = io.BytesIO()
        with zipfile.ZipFile(package_file, "w", zipfile.ZIP_DEFLATED) as package:
            ObjectPackageExporter(export_job, storage=storage).write_package(package)
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            result = ObjectPackageImporter(import_job, storage=storage).import_package(package)
        checkpoint = TransferCheckpoint.objects.get(id=result["checkpoint_id"])
        storage.files[self.media.file_path] = b"current-state"
        with patch.object(TransferCheckpoint, "mark_restored", side_effect=RuntimeError("late DB failure")):
            with self.assertRaisesMessage(RuntimeError, "late DB failure"):
                restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        self.assertEqual(storage.files[self.media.file_path], b"current-state")
        inverse = TransferCheckpoint.objects.get(source_details__restore_of=str(checkpoint.id))
        self.assertEqual(inverse.status, TransferCheckpoint.STATUS_AVAILABLE)
        self.assertTrue(all(storage.exists(item["path"]) for item in inverse.snapshot["media_binaries"].values()))
        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_FAILED)

    def test_failed_binary_compensation_retry_reuses_recovery_checkpoint(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"before-import"
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        checkpoint = capture_object_import_checkpoint(
            import_job,
            {
                "types": [],
                "objects": [],
                "media": [{"file_hash": self.media.file_hash, "collections": []}],
            },
            storage=storage,
        )
        checkpoint.operation_result = {"restorable": True}
        checkpoint.status = TransferCheckpoint.STATUS_AVAILABLE
        checkpoint.save(update_fields=["operation_result", "status", "updated_at"])
        storage.files[self.media.file_path] = b"current-state"

        from object_storage.services import transfer_checkpoints as checkpoint_service

        original_restore_media = checkpoint_service._restore_media_binaries
        calls = 0

        def fail_compensation(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise RuntimeError("recovery storage unavailable")
            return original_restore_media(*args, **kwargs)

        with (
            patch.object(checkpoint_service, "_restore_media_binaries", side_effect=fail_compensation),
            patch.object(TransferCheckpoint, "mark_restored", side_effect=RuntimeError("late DB failure")),
        ):
            with self.assertRaisesMessage(RuntimeError, "late DB failure"):
                restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        checkpoint.refresh_from_db()
        inverse_id = checkpoint.source_details["inverse_checkpoint_id"]
        self.assertTrue(checkpoint.source_details["binary_recovery_failed"])

        factory = APIRequestFactory()
        request = factory.post(f"/api/v1/objects/remote/checkpoints/{checkpoint.id}/restore/", {})
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        with patch("object_storage.remote_views.restore_object_transfer_checkpoint.delay"):
            response = TransferCheckpointRestoreView.as_view()(request, checkpoint_id=checkpoint.id)
        self.assertEqual(response.status_code, 202)

        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.source_details["inverse_checkpoint_id"], inverse_id)
        restore_object_import_checkpoint(checkpoint, self.user, storage=storage)
        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_RESTORED)
        self.assertEqual(checkpoint.source_details["inverse_checkpoint_id"], inverse_id)
        self.assertNotIn("binary_recovery_failed", checkpoint.source_details)

    def test_post_commit_binary_cleanup_is_retryable(self):
        storage = MemoryStorage()
        imported_media = MediaFile.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            title="Cleanup media",
            slug="cleanup-media",
            original_filename="cleanup.jpg",
            file_path="object-transfer/cleanup.jpg",
            file_size=17,
            content_type="image/jpeg",
            file_hash="c" * 64,
            file_type="image",
            created_by=self.user,
            last_modified_by=self.user,
            uploaded_by=self.user,
        )
        storage.files[imported_media.file_path] = b"created-by-import"
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["media"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={
                "media_ids": [str(imported_media.id)],
                "media_paths": [imported_media.file_path],
            },
            operation_result={"restorable": True},
            created_by=self.user,
        )
        with patch(
            "object_storage.services.transfer_checkpoints._delete_created_media_binaries",
            side_effect=RuntimeError("storage cleanup unavailable"),
        ):
            with self.assertRaisesMessage(RuntimeError, "remains retryable"):
                restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_RESTORED)
        self.assertTrue(checkpoint.source_details["binary_cleanup_pending"])
        self.assertIn("Binary cleanup failed", checkpoint.errors[0])
        self.assertIn(imported_media.file_path, storage.files)

        restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        checkpoint.refresh_from_db()
        self.assertNotIn("binary_cleanup_pending", checkpoint.source_details)
        self.assertNotIn(imported_media.file_path, storage.files)

    def test_restore_locks_original_planned_hash_after_in_place_replacement(self):
        original_hash = "d" * 64
        replacement_hash = "e" * 64
        imported_media = MediaFile.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            title="Replaced import media",
            slug="replaced-import-media",
            original_filename="replaced.jpg",
            file_path=f"object-transfer/{original_hash}.jpg",
            file_size=8,
            content_type="image/jpeg",
            file_hash=replacement_hash,
            file_type="image",
            created_by=self.user,
            last_modified_by=self.user,
            uploaded_by=self.user,
        )
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["media"],
            snapshot={
                "schema_version": 1,
                "objects": [],
                "media": [],
                "types": [],
                "planned": {"media_hashes": [original_hash]},
            },
            created_resources={"media_ids": [str(imported_media.id)], "media_paths": [imported_media.file_path]},
            operation_result={"restorable": True},
            created_by=self.user,
        )
        captured_hashes = set()

        @contextmanager
        def capture_hash_locks(values):
            captured_hashes.update(value for value in values if value)
            yield

        with (
            patch(
                "object_storage.services.transfer_checkpoints.media_content_transfer_locks",
                side_effect=capture_hash_locks,
            ),
            patch(
                "object_storage.services.transfer_checkpoints._restore_object_import_checkpoint_locked",
                return_value=checkpoint,
            ),
        ):
            restore_object_import_checkpoint(checkpoint, self.user, storage=MemoryStorage())

        self.assertEqual(captured_hashes, {original_hash, replacement_hash})

    def test_restore_reads_current_icon_path_after_acquiring_the_type_lock(self):
        original_path = "object_types/icons/original.svg"
        replacement_path = "object_types/icons/replacement-after-wait.svg"
        self.root_type.icon_image.name = original_path
        self.root_type.save(update_fields=["icon_image", "updated_at"])
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["types"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={"type_ids": [str(self.root_type.id)]},
            operation_result={"restorable": True},
            created_by=self.user,
        )
        captured_paths = set()

        @contextmanager
        def wait_for_type_lock(_values):
            self.root_type.icon_image.name = replacement_path
            self.root_type.save(update_fields=["icon_image", "updated_at"])
            yield

        @contextmanager
        def capture_path_locks(values):
            captured_paths.update(value for value in values if value)
            yield

        with (
            patch(
                "object_storage.services.transfer_checkpoints.object_type_transfer_locks",
                side_effect=wait_for_type_lock,
            ),
            patch(
                "object_storage.services.transfer_checkpoints.type_icon_path_locks",
                side_effect=capture_path_locks,
            ),
            patch(
                "object_storage.services.transfer_checkpoints._restore_object_import_checkpoint_locked",
                return_value=checkpoint,
            ),
        ):
            restore_object_import_checkpoint(checkpoint, self.user, storage=MemoryStorage())

        self.assertIn(replacement_path, captured_paths)

    def test_restore_redelivery_reuses_durable_inverse_after_worker_exit(self):
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
        self.root.title = "Before import"
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
        checkpoint = TransferCheckpoint.objects.get(id=result["checkpoint_id"])
        storage.files[self.media.file_path] = b"current-state"

        with patch(
            "object_storage.services.transfer_checkpoints._restore_object_import_checkpoint",
            side_effect=SystemExit("worker terminated"),
        ):
            with self.assertRaises(SystemExit):
                restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_RESTORING)
        self.assertEqual(TransferCheckpoint.objects.filter(source_details__restore_of=str(checkpoint.id)).count(), 1)

        storage.files[self.media.file_path] = b"partial-worker-write"
        restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        checkpoint.refresh_from_db()
        self.root.refresh_from_db()
        self.assertEqual(checkpoint.status, TransferCheckpoint.STATUS_RESTORED)
        self.assertEqual(self.root.title, "Before import")
        self.assertEqual(storage.files[self.media.file_path], b"image")
        self.assertEqual(TransferCheckpoint.objects.filter(source_details__restore_of=str(checkpoint.id)).count(), 1)

    def test_restore_redelivery_preserves_user_change_after_worker_exit(self):
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"before-import"
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        checkpoint = capture_object_import_checkpoint(
            import_job,
            {
                "types": [{"name": self.root_type.name}],
                "objects": [],
                "media": [{"file_hash": self.media.file_hash, "collections": []}],
            },
            storage=storage,
        )
        checkpoint.operation_result = {"restorable": True}
        checkpoint.status = TransferCheckpoint.STATUS_AVAILABLE
        checkpoint.save(update_fields=["operation_result", "status", "updated_at"])

        with patch(
            "object_storage.services.transfer_checkpoints._restore_object_import_checkpoint",
            side_effect=SystemExit("worker terminated"),
        ):
            with self.assertRaises(SystemExit):
                restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        self.media.title = "User edit after worker loss"
        self.media.save(update_fields=["title", "updated_at"])
        storage.files[self.media.file_path] = b"user-replacement"
        with self.assertRaisesMessage(ValueError, "changed after its recovery checkpoint"):
            restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        self.assertEqual(storage.files[self.media.file_path], b"user-replacement")

    def test_restore_rejects_changes_after_inverse_commit(self):
        storage = MemoryStorage()
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        checkpoint = capture_object_import_checkpoint(
            import_job,
            {
                "types": [{"name": self.root_type.name}],
                "objects": [{"type": self.root_type.name, "slug": self.root.slug}],
                "media": [],
            },
            storage=storage,
        )
        self.root.title = "Imported title"
        self.root.save(update_fields=["title", "updated_at"])
        checkpoint.operation_result = {"restorable": True}
        checkpoint.status = TransferCheckpoint.STATUS_AVAILABLE
        checkpoint.save(update_fields=["operation_result", "status", "updated_at"])

        from object_storage.services import transfer_checkpoints as checkpoint_service

        original_prepare = checkpoint_service._prepare_inverse_checkpoint

        def prepare_then_edit(*args, **kwargs):
            inverse = original_prepare(*args, **kwargs)
            self.root.title = "Concurrent title"
            self.root.save(update_fields=["title", "updated_at"])
            return inverse

        with patch.object(checkpoint_service, "_prepare_inverse_checkpoint", side_effect=prepare_then_edit):
            with self.assertRaisesMessage(ValueError, "changed after its recovery checkpoint"):
                restore_object_import_checkpoint(checkpoint, self.user, storage=storage)

        self.root.refresh_from_db()
        self.assertEqual(self.root.title, "Concurrent title")

    def test_restore_task_requeues_when_worker_is_lost(self):
        self.assertTrue(restore_object_transfer_checkpoint.reject_on_worker_lost)
        self.assertTrue(import_remote_object_package.reject_on_worker_lost)

    def test_restore_task_stops_polling_state_after_cleanup_retries_are_exhausted(self):
        from object_storage.services.transfer_checkpoints import PostRestoreCleanupError

        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_RESTORED,
            resource_scopes=["media"],
            snapshot={"schema_version": 1},
            source_details={
                "binary_cleanup_pending": True,
                "binary_cleanup_retry_active": True,
            },
            operation_result={"restorable": True},
            created_by=self.user,
        )
        restore_object_transfer_checkpoint.push_request(retries=restore_object_transfer_checkpoint.max_retries)
        try:
            with patch(
                "object_storage.services.transfer_checkpoints.restore_object_import_checkpoint",
                side_effect=PostRestoreCleanupError("storage unavailable"),
            ):
                with self.assertRaisesMessage(PostRestoreCleanupError, "storage unavailable"):
                    restore_object_transfer_checkpoint.run(str(checkpoint.id), self.user.id)
        finally:
            restore_object_transfer_checkpoint.pop_request()

        checkpoint.refresh_from_db()
        self.assertTrue(checkpoint.source_details["binary_cleanup_pending"])
        self.assertNotIn("binary_cleanup_retry_active", checkpoint.source_details)

    def test_restore_task_stops_polling_state_after_a_terminal_lookup_failure(self):
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_RESTORED,
            resource_scopes=["media"],
            snapshot={"schema_version": 1},
            source_details={
                "binary_cleanup_pending": True,
                "binary_cleanup_retry_active": True,
            },
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaises(User.DoesNotExist):
            restore_object_transfer_checkpoint.run(str(checkpoint.id), self.user.id + 100_000)

        checkpoint.refresh_from_db()
        self.assertTrue(checkpoint.source_details["binary_cleanup_pending"])
        self.assertNotIn("binary_cleanup_retry_active", checkpoint.source_details)

    def test_restore_task_marks_cleanup_active_before_restored_state_is_visible(self):
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_RESTORE_PENDING,
            resource_scopes=["media"],
            snapshot={"schema_version": 1},
            operation_result={"restorable": True},
            created_by=self.user,
        )
        observed = {}

        def pause_after_restore_commit(current, _user):
            current.refresh_from_db()
            self.assertTrue(current.source_details["binary_cleanup_retry_active"])
            current.status = TransferCheckpoint.STATUS_RESTORED
            current.source_details = {
                **current.source_details,
                "binary_cleanup_pending": True,
            }
            current.save(update_fields=["status", "source_details", "updated_at"])

            request = APIRequestFactory().post(f"/api/v1/objects/remote/checkpoints/{current.id}/restore/", {})
            request.tenant = self.tenant
            force_authenticate(request, self.user)
            with patch("object_storage.remote_views.restore_object_transfer_checkpoint.delay") as duplicate_delay:
                response = TransferCheckpointRestoreView.as_view()(request, checkpoint_id=current.id)
            observed["status"] = response.status_code
            observed["can_restore"] = response.data["canRestore"]
            observed["dispatched"] = duplicate_delay.called

        with patch(
            "object_storage.services.transfer_checkpoints.restore_object_import_checkpoint",
            side_effect=pause_after_restore_commit,
        ):
            restore_object_transfer_checkpoint.run(str(checkpoint.id), self.user.id)

        self.assertEqual(observed, {"status": 202, "can_restore": False, "dispatched": False})
        checkpoint.refresh_from_db()
        self.assertNotIn("binary_cleanup_retry_active", checkpoint.source_details)

    def test_restore_refuses_created_type_moved_to_another_workspace(self):
        other_tenant = Tenant.objects.create(name="Other", identifier="other-type-owner", created_by=self.user)
        other_namespace = Namespace.objects.create(
            tenant=other_tenant,
            name="Other",
            slug="other-type-owner",
            created_by=self.user,
        )
        imported_type = ObjectTypeDefinition.objects.create(
            name="later-moved-type",
            label="Moved",
            plural_label="Moved",
            namespace=other_namespace,
            schema={"type": "object", "properties": {}},
            slot_configuration={"slots": []},
            created_by=self.user,
        )
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["types"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={"type_ids": [str(imported_type.id)]},
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "another workspace"):
            restore_object_import_checkpoint(checkpoint, self.user, storage=MemoryStorage())

        self.assertTrue(ObjectTypeDefinition.objects.filter(id=imported_type.id, namespace=other_namespace).exists())

    def test_unchanged_import_does_not_rewind_to_matching_historical_version(self):
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

        local_version = ObjectVersion.objects.create(
            object_instance=self.root,
            version_number=2,
            data={"title": "Local work"},
            widgets={},
            created_by=self.user,
        )
        self.root.current_version = local_version
        self.root.version = 2
        self.root.save(update_fields=["current_version", "version", "updated_at"])
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
        self.assertEqual(result["created_versions"], 0)
        self.assertEqual(self.root.versions.count(), 2)
        self.assertEqual(self.root.current_version_id, local_version.id)
        self.assertEqual(self.root.version, 2)

    def test_import_preserves_same_slug_in_another_tenant_and_remains_idempotent(self):
        for obj_type in (self.root_type, self.child_type):
            obj_type.namespace = None
            obj_type.save(update_fields=["namespace", "updated_at"])
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

        destination_tenant = Tenant.objects.create(
            name="Destination",
            identifier="destination",
            created_by=self.user,
        )
        destination_namespace = Namespace.objects.create(
            name="Destination namespace",
            slug="destination",
            tenant=destination_tenant,
            is_default=True,
            created_by=self.user,
        )
        options = {
            "type_resolutions": {},
            "namespace_resolutions": {self.namespace.slug: destination_namespace.slug},
        }

        for _attempt in range(2):
            import_job = ObjectTransferJob.objects.create(
                tenant=destination_tenant,
                kind=ObjectTransferJob.KIND_IMPORT,
                created_by=self.user,
                options=options,
            )
            package_file.seek(0)
            with zipfile.ZipFile(package_file, "r") as package:
                ObjectPackageImporter(import_job, storage=storage).import_package(package)

        imported_roots = ObjectInstance.objects.filter(
            tenant=destination_tenant,
            object_type=self.root_type,
        )
        self.assertEqual(imported_roots.count(), 1)
        self.assertEqual(imported_roots.get().slug, self.root.slug)

    def test_import_rejects_unchanged_type_owned_by_another_tenant(self):
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
        remote_preflight = build_preflight(self.tenant, [self.root.id])

        foreign_tenant = Tenant.objects.create(
            name="Foreign type owner",
            identifier="foreign-type-owner",
            created_by=self.user,
        )
        foreign_namespace = Namespace.objects.create(
            name="Foreign type namespace",
            slug="foreign-type-namespace",
            tenant=foreign_tenant,
            created_by=self.user,
        )
        self.root_type.namespace = foreign_namespace
        self.root_type.save(update_fields=["namespace", "updated_at"])

        decorated = _decorate_preflight(self.tenant, remote_preflight)
        conflict = next(item for item in decorated["type_conflicts"] if item["name"] == self.root_type.name)
        self.assertFalse(conflict["compatible"])
        self.assertTrue(conflict["usedByOtherTenants"])

        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            with self.assertRaisesMessage(ValueError, "used by another workspace"):
                ObjectPackageImporter(import_job, storage=storage).import_package(package)

    def test_new_import_does_not_keep_automatic_default_widget_version(self):
        obj_type = ObjectTypeDefinition.objects.create(
            name="transfer-precreated-widget",
            label="Pre-created widget",
            plural_label="Pre-created widgets",
            namespace=None,
            schema={"type": "object", "properties": {}},
            slot_configuration={
                "slots": [
                    {
                        "name": "main",
                        "label": "Main",
                        "widgetControls": [
                            {
                                "widgetType": "easy_widgets.ContentWidget",
                                "preCreate": True,
                                "defaultConfig": {"content": "Remote content"},
                            }
                        ],
                    }
                ]
            },
            created_by=self.user,
        )
        source = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=obj_type,
            title="Widget root",
            slug="widget-root",
            created_by=self.user,
        )
        source.refresh_from_db()
        self.assertEqual(source.versions.count(), 1)
        source_widgets = source.current_version.widgets
        storage = MemoryStorage()
        export_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_EXPORT,
            created_by=self.user,
            options={"root_ids": [source.id]},
        )
        package_file = io.BytesIO()
        with zipfile.ZipFile(package_file, "w", zipfile.ZIP_DEFLATED) as package:
            ObjectPackageExporter(export_job, storage=storage).write_package(package)

        destination_tenant = Tenant.objects.create(
            name="Widget destination",
            identifier="widget-destination",
            created_by=self.user,
        )
        import_job = ObjectTransferJob.objects.create(
            tenant=destination_tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={},
        )
        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            ObjectPackageImporter(import_job, storage=storage).import_package(package)

        imported = ObjectInstance.objects.get(tenant=destination_tenant, object_type=obj_type, slug=source.slug)
        self.assertEqual(imported.versions.count(), 1)
        self.assertEqual(imported.current_version.version_number, 1)
        self.assertEqual(imported.current_version.widgets, source_widgets)

    def test_import_cannot_update_type_owned_by_another_tenant(self):
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

        foreign_tenant = Tenant.objects.create(name="Foreign", identifier="foreign", created_by=self.user)
        foreign_namespace = Namespace.objects.create(
            name="Foreign namespace",
            slug="foreign",
            tenant=foreign_tenant,
            created_by=self.user,
        )
        self.root_type.namespace = foreign_namespace
        self.root_type.schema = {"type": "object", "properties": {}}
        self.root_type.save(update_fields=["namespace", "schema", "updated_at"])
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {self.root_type.name: "update"}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            with self.assertRaisesMessage(ValueError, "used by another workspace"):
                ObjectPackageImporter(import_job, storage=storage).import_package(package)

        self.root_type.refresh_from_db()
        self.assertEqual(self.root_type.namespace, foreign_namespace)

    def test_import_cannot_force_update_an_unchanged_type_used_by_another_tenant(self):
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
        foreign_tenant = Tenant.objects.create(name="Foreign", identifier="foreign-unchanged", created_by=self.user)
        ObjectInstance.objects.create(
            tenant=foreign_tenant,
            object_type=self.root_type,
            title="Foreign root",
            slug="foreign-root",
            created_by=self.user,
        )
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {self.root_type.name: "update"}},
        )

        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            with self.assertRaisesMessage(ValueError, "used by another workspace"):
                ObjectPackageImporter(import_job, storage=storage).import_package(package)

    @patch("object_storage.tasks.remote_object_request", side_effect=RemoteTransportError("Temporary failure"))
    def test_import_job_retries_transport_errors_without_marking_failed(self, remote_request):
        job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"root_ids": [self.root.id]},
        )

        with patch.object(import_remote_object_package, "retry", side_effect=Retry()) as retry:
            with self.assertRaises(Retry):
                import_remote_object_package.run(str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, ObjectTransferJob.STATUS_RUNNING)
        self.assertEqual(job.errors, [])
        remote_request.assert_called_once()
        retry.assert_called_once()

    @patch("object_storage.tasks.remote_object_request")
    def test_import_job_does_not_repeat_a_terminal_job(self, remote_request):
        job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            status=ObjectTransferJob.STATUS_COMPLETED,
            created_by=self.user,
            progress={"phase": "completed"},
        )

        self.assertEqual(import_remote_object_package.run(str(job.id)), {"phase": "completed"})
        remote_request.assert_not_called()

    @patch("object_storage.tasks.S3MediaStorage")
    def test_cleanup_processes_oldest_expired_jobs_first(self, storage_class):
        now = timezone.now()
        oldest = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_EXPORT,
            created_by=self.user,
            object_key="oldest.zip",
            expires_at=now - timedelta(days=2),
        )
        ObjectTransferJob.objects.bulk_create(
            [
                ObjectTransferJob(
                    tenant=self.tenant,
                    kind=ObjectTransferJob.KIND_EXPORT,
                    created_by=self.user,
                    object_key=f"newer-{index}.zip",
                    expires_at=now - timedelta(days=1),
                )
                for index in range(100)
            ]
        )

        self.assertEqual(cleanup_expired_object_packages(batch_size=100), 100)

        oldest.refresh_from_db()
        self.assertEqual(oldest.object_key, "")
        storage_class.return_value.delete.assert_any_call("oldest.zip")

    def test_restore_reparents_with_mptt_without_rebuilding_another_tenant(self):
        other_user = User.objects.create_user("other-tree-owner")
        other_tenant = Tenant.objects.create(name="Other tree", identifier="other-tree", created_by=other_user)
        other_namespace = Namespace.objects.create(
            name="Other tree",
            slug="other-tree",
            tenant=other_tenant,
            created_by=other_user,
        )
        other_type = ObjectTypeDefinition.objects.create(
            name="other-tree-type",
            label="Other tree",
            plural_label="Other trees",
            namespace=other_namespace,
            created_by=other_user,
        )
        other_root = ObjectInstance.objects.create(
            tenant=other_tenant,
            object_type=other_type,
            title="Other root",
            slug="other-root",
            created_by=other_user,
        )
        import_job = ObjectTransferJob.objects.create(
            tenant=self.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=self.user,
            options={"type_resolutions": {}},
        )
        checkpoint = capture_object_import_checkpoint(
            import_job,
            {
                "types": [{"name": self.child_type.name}],
                "objects": [{"type": self.child_type.name, "slug": self.child.slug}],
                "media": [],
            },
            storage=MemoryStorage(),
        )
        checkpoint.status = TransferCheckpoint.STATUS_AVAILABLE
        checkpoint.operation_result = {"restorable": True}
        checkpoint.save(update_fields=["status", "operation_result", "updated_at"])

        self.child.parent = self.related
        self.child.save(update_fields=["parent", "updated_at"])
        other_root.refresh_from_db()
        other_tree_state = (other_root.tree_id, other_root.lft, other_root.rght, other_root.level)

        restore_object_import_checkpoint(checkpoint, self.user, storage=MemoryStorage())

        self.child.refresh_from_db()
        other_root.refresh_from_db()
        self.assertEqual(self.child.parent_id, self.root.id)
        self.assertEqual(
            (other_root.tree_id, other_root.lft, other_root.rght, other_root.level),
            other_tree_state,
        )

    def test_restore_blocks_cross_tenant_json_reference(self):
        imported = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.child_type,
            title="Imported object",
            slug="cross-tenant-imported",
            created_by=self.user,
        )
        other_user = User.objects.create_user("cross-tenant-reference")
        other_tenant = Tenant.objects.create(
            name="Cross tenant reference",
            identifier="cross-tenant-reference",
            created_by=other_user,
        )
        other_namespace = Namespace.objects.create(
            name="Cross tenant reference",
            slug="cross-tenant-reference",
            tenant=other_tenant,
            created_by=other_user,
        )
        other_type = ObjectTypeDefinition.objects.create(
            name="cross-tenant-reference",
            label="Cross tenant reference",
            plural_label="Cross tenant references",
            namespace=other_namespace,
            created_by=other_user,
        )
        other_object = ObjectInstance.objects.create(
            tenant=other_tenant,
            object_type=other_type,
            title="Referencing object",
            slug="referencing-object",
            created_by=other_user,
        )
        ObjectVersion.objects.create(
            object_instance=other_object,
            version_number=1,
            widgets={"main": [{"object_id": imported.id}]},
            created_by=other_user,
        )
        checkpoint = TransferCheckpoint.objects.create(
            tenant=self.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=["objects"],
            snapshot={"schema_version": 1, "objects": [], "media": [], "types": []},
            created_resources={"object_ids": [imported.id]},
            operation_result={"restorable": True},
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValueError, "references imported content"):
            restore_object_import_checkpoint(checkpoint, self.user, storage=MemoryStorage())

        self.assertTrue(ObjectInstance.objects.filter(pk=imported.pk).exists())


class TenantReferenceWriteBarrierTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user("reference-barrier")
        self.tenant = Tenant.objects.create(
            name="Reference barrier",
            identifier="reference-barrier",
            created_by=self.user,
        )
        namespace = Namespace.objects.create(
            name="Reference barrier",
            slug="reference-barrier",
            tenant=self.tenant,
            created_by=self.user,
        )
        obj_type = ObjectTypeDefinition.objects.create(
            name="reference-barrier",
            label="Reference barrier",
            plural_label="Reference barriers",
            namespace=namespace,
            created_by=self.user,
        )
        obj = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=obj_type,
            title="Reference barrier",
            slug="reference-barrier",
            created_by=self.user,
        )
        self.version = ObjectVersion.objects.create(
            object_instance=obj,
            version_number=1,
            data={},
            widgets={},
            created_by=self.user,
        )

    def test_migration_installs_all_reference_write_triggers(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL-specific write barrier")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT tgname
                FROM pg_trigger
                WHERE NOT tgisinternal
                  AND tgname IN (
                    'objectinstance_tenant_reference_write_barrier',
                    'objectversion_tenant_reference_write_barrier',
                    'pageversion_tenant_reference_write_barrier'
                  )
                """
            )
            names = {row[0] for row in cursor.fetchall()}
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM pg_proc AS routine
                JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
                CROSS JOIN LATERAL aclexplode(
                    COALESCE(routine.proacl, acldefault('f', routine.proowner))
                ) AS acl
                WHERE namespace.nspname = 'public'
                  AND routine.proname = 'object_storage_lock_tenant_reference_write'
                  AND acl.grantee = 0
                  AND acl.privilege_type = 'EXECUTE'
                """
            )
            public_execute_grants = cursor.fetchone()[0]
        self.assertEqual(
            names,
            {
                "objectinstance_tenant_reference_write_barrier",
                "objectversion_tenant_reference_write_barrier",
                "pageversion_tenant_reference_write_barrier",
            },
        )
        self.assertEqual(public_execute_grants, 0)

    def test_object_version_write_waits_for_tenant_transfer_lock(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL-specific write barrier")
        started = threading.Event()
        finished = threading.Event()
        errors = []

        def update_version():
            try:
                started.set()
                ObjectVersion.objects.filter(pk=self.version.pk).update(data={"object_id": 123})
            except Exception as exc:  # pragma: no cover - asserted below
                errors.append(exc)
            finally:
                connections["default"].close()
                finished.set()

        with tenant_transfer_lock(self.tenant.id):
            worker = threading.Thread(target=update_version)
            worker.start()
            self.assertTrue(started.wait(1))
            self.assertFalse(finished.wait(0.2))

        worker.join(2)
        self.assertTrue(finished.is_set())
        self.assertEqual(errors, [])

    def test_object_version_write_waits_for_global_reference_barrier(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL-specific write barrier")
        started = threading.Event()
        finished = threading.Event()
        errors = []

        def update_version():
            try:
                started.set()
                ObjectVersion.objects.filter(pk=self.version.pk).update(data={"object_id": 456})
            except Exception as exc:  # pragma: no cover - asserted below
                errors.append(exc)
            finally:
                connections["default"].close()
                finished.set()

        with reference_write_barrier():
            worker = threading.Thread(target=update_version)
            worker.start()
            self.assertTrue(started.wait(1))
            self.assertFalse(finished.wait(0.2))

        worker.join(2)
        self.assertTrue(finished.is_set())
        self.assertEqual(errors, [])

    def test_database_rejects_cross_tenant_parent(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL-specific tenant constraint")
        other_user = User.objects.create_user("reference-barrier-other")
        other_tenant = Tenant.objects.create(
            name="Reference barrier other",
            identifier="reference-barrier-other",
            created_by=other_user,
        )
        other_namespace = Namespace.objects.create(
            name="Reference barrier other",
            slug="reference-barrier-other",
            tenant=other_tenant,
            created_by=other_user,
        )
        other_type = ObjectTypeDefinition.objects.create(
            name="reference-barrier-other",
            label="Reference barrier other",
            plural_label="Reference barrier others",
            namespace=other_namespace,
            created_by=other_user,
        )
        other_parent = ObjectInstance.objects.create(
            tenant=other_tenant,
            object_type=other_type,
            title="Other parent",
            slug="other-parent",
            created_by=other_user,
        )

        with self.assertRaises(DatabaseError), transaction.atomic():
            ObjectInstance.objects.filter(pk=self.version.object_instance_id).update(parent=other_parent)
