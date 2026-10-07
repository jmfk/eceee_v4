import io
import zipfile
from datetime import timedelta
from unittest.mock import patch

from celery.exceptions import Retry
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
    rebuild_imported_reverse_relationships,
)
from object_storage.tasks import cleanup_expired_object_packages, import_remote_object_package
from taxonomy.models import Tag as TaxonomyTag
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
        with patch.object(ObjectInstance, "get_descendants", side_effect=AssertionError("Use direct children")):
            graph = collect_object_graph(self.tenant, [self.root.id])
        self.assertEqual({item.id for item in graph}, {self.root.id, self.child.id, self.related.id})

    def test_preflight_counts_referenced_managed_media(self):
        result = build_preflight(self.tenant, [self.root.id])
        self.assertEqual(result["object_count"], 3)
        self.assertEqual(result["media_count"], 1)

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
