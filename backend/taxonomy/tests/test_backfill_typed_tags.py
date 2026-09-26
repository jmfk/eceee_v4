from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from content.models import Namespace
from content.models import Tag as ContentTag
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile, MediaTag
from taxonomy.models import LegacyTagMapping, Tag, TagBackfillRun, TagBackfillUnit
from webpages.models import PageVersion, PageVersionTag, WebPage


class TypedTagBackfillTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("tagger")
        self.tenant = Tenant.objects.create(
            name="Test tenant",
            identifier="tag-backfill-test",
            created_by=self.user,
        )
        self.namespace = Namespace.objects.create(
            name="Tag backfill namespace",
            slug="tag-backfill",
            is_active=True,
            is_default=True,
            created_by=self.user,
            tenant=self.tenant,
        )
        self.content_tag = ContentTag.objects.create(
            name="Energy",
            slug="energy",
            namespace=self.namespace,
            tenant=self.tenant,
        )
        self.media_tag = MediaTag.objects.create(
            name="Energy",
            slug="energy",
            namespace=self.namespace,
            created_by=self.user,
            color="#112233",
        )
        self.page = WebPage.objects.create(
            title="Tagged page",
            slug="tagged-page",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.version = PageVersion.objects.create(
            page=self.page,
            version_number=1,
            version_title="Tagged",
            tags=["Energy", "Stockholm"],
            created_by=self.user,
        )
        self.media_file = MediaFile.objects.create(
            title="Tagged image",
            slug="tagged-image",
            original_filename="tagged.jpg",
            file_path="tests/tagged.jpg",
            file_size=100,
            content_type="image/jpeg",
            file_hash="a" * 64,
            file_type="image",
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.media_file.tags.add(self.media_tag)
        self.collection = MediaCollection.objects.create(
            title="Tagged collection",
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.collection.tags.add(self.media_tag)

    def test_complete_backfill_preserves_relations_and_is_idempotent(self):
        call_command("backfill_typed_tags", run_id="complete-test", batch_size=2)

        run = TagBackfillRun.objects.get(pk="complete-test")
        self.assertEqual(run.status, TagBackfillRun.Status.COMPLETE)
        self.assertEqual(run.total_work_units, 5)
        self.assertEqual(run.completed_work_units, 5)
        self.assertEqual(run.failed_work_units, 0)
        self.assertEqual(Tag.objects.count(), 2)
        self.assertEqual(LegacyTagMapping.objects.count(), 2)
        self.assertEqual(Tag.objects.get(name="Energy").color, "#112233")

        ordered_names = list(
            PageVersionTag.objects.filter(page_version=self.version)
            .order_by("position")
            .values_list("tag__name", flat=True)
        )
        self.assertEqual(ordered_names, ["Energy", "Stockholm"])
        self.assertEqual(list(self.media_file.canonical_tags.values_list("name", flat=True)), ["Energy"])
        self.assertEqual(list(self.collection.canonical_tags.values_list("name", flat=True)), ["Energy"])

        call_command("backfill_typed_tags", run_id="complete-test", batch_size=2)
        call_command("backfill_typed_tags", run_id="complete-test", verify_only=True)

        self.assertEqual(Tag.objects.count(), 2)
        self.assertEqual(LegacyTagMapping.objects.count(), 2)
        self.assertEqual(TagBackfillUnit.objects.filter(run=run).count(), 5)

    def test_interrupted_run_resumes_without_duplicate_work(self):
        call_command("backfill_typed_tags", run_id="resume-test", stop_after=2)
        run = TagBackfillRun.objects.get(pk="resume-test")
        self.assertEqual(run.status, TagBackfillRun.Status.INTERRUPTED)
        self.assertEqual(run.completed_work_units, 2)

        call_command("backfill_typed_tags", run_id="resume-test")
        run.refresh_from_db()
        self.assertEqual(run.status, TagBackfillRun.Status.COMPLETE)
        self.assertEqual(run.completed_work_units, 5)
        self.assertEqual(TagBackfillUnit.objects.filter(run=run).count(), 5)

    def test_resume_refuses_changed_source_snapshot(self):
        call_command("backfill_typed_tags", run_id="mismatch-test", stop_after=1)
        ContentTag.objects.create(
            name="New source tag",
            slug="new-source-tag",
            namespace=self.namespace,
            tenant=self.tenant,
        )

        with self.assertRaisesMessage(CommandError, "Run identity does not match"):
            call_command("backfill_typed_tags", run_id="mismatch-test")

    def test_preflight_is_read_only(self):
        legacy_counts = (
            ContentTag.objects.count(),
            MediaTag.objects.count(),
            PageVersion.objects.count(),
            MediaFile.objects.with_deleted().count(),
            MediaCollection.objects.count(),
        )

        call_command("backfill_typed_tags", preflight_only=True)

        self.assertEqual(Tag.objects.count(), 0)
        self.assertEqual(LegacyTagMapping.objects.count(), 0)
        self.assertEqual(TagBackfillRun.objects.count(), 0)
        self.assertEqual(TagBackfillUnit.objects.count(), 0)
        self.assertEqual(PageVersionTag.objects.count(), 0)
        self.assertEqual(
            (
                ContentTag.objects.count(),
                MediaTag.objects.count(),
                PageVersion.objects.count(),
                MediaFile.objects.with_deleted().count(),
                MediaCollection.objects.count(),
            ),
            legacy_counts,
        )

    def test_preflight_rejects_lossy_slug_collisions(self):
        self.version.tags = ["C++", "C#"]
        self.version.save(update_fields=["tags"])

        with self.assertRaisesMessage(CommandError, "same canonical identity"):
            call_command("backfill_typed_tags", preflight_only=True)

        self.assertEqual(Tag.objects.count(), 0)
        self.assertEqual(TagBackfillRun.objects.count(), 0)

    def test_preflight_rejects_stale_canonical_slug_collision(self):
        Tag.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            name="C++",
            slug="c",
        )
        self.version.tags = ["C#"]
        self.version.save(update_fields=["tags"])

        with self.assertRaisesMessage(CommandError, "same canonical identity"):
            call_command("backfill_typed_tags", preflight_only=True)

        self.assertEqual(Tag.objects.get(slug="c").name, "C++")
        self.assertEqual(TagBackfillRun.objects.count(), 0)

    def test_backfill_rejects_stale_canonical_slug_collision_without_preflight(self):
        Tag.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            name="C++",
            slug="c",
        )
        self.version.tags = ["C#"]
        self.version.save(update_fields=["tags"])

        with self.assertRaisesMessage(CommandError, "Backfill recorded 1 failed work unit"):
            call_command("backfill_typed_tags", run_id="stale-canonical")

        failed = TagBackfillUnit.objects.get(
            run_id="stale-canonical",
            work_unit_id=f"page-version:{self.version.pk}",
        )
        self.assertIn("conflicts with source name 'C#'", failed.error)
        self.assertEqual(Tag.objects.get(slug="c").name, "C++")

    def test_preflight_rejects_stale_legacy_mapping(self):
        wrong_tag = Tag.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            name="Wrong",
            slug="wrong",
        )
        LegacyTagMapping.objects.create(
            source_kind=LegacyTagMapping.SourceKind.CONTENT,
            source_id=str(self.content_tag.pk),
            canonical_tag=wrong_tag,
            source_name=self.content_tag.name,
        )

        with self.assertRaisesMessage(CommandError, "mapping does not match its current source identity"):
            call_command("backfill_typed_tags", preflight_only=True)

    def test_preflight_rejects_cross_tenant_legacy_mapping(self):
        other_tenant = Tenant.objects.create(
            name="Other tenant",
            identifier="other-tag-backfill-test",
            created_by=self.user,
        )
        other_namespace = Namespace.objects.create(
            name="Other tag backfill namespace",
            slug="other-tag-backfill",
            is_active=True,
            created_by=self.user,
            tenant=other_tenant,
        )
        cross_tenant_tag = Tag.objects.create(
            tenant=other_tenant,
            namespace=other_namespace,
            name=self.content_tag.name,
            slug=self.content_tag.slug,
        )
        LegacyTagMapping.objects.create(
            source_kind=LegacyTagMapping.SourceKind.CONTENT,
            source_id=str(self.content_tag.pk),
            canonical_tag=cross_tenant_tag,
            source_name=self.content_tag.name,
        )

        with self.assertRaisesMessage(CommandError, "mapping does not match its current source identity"):
            call_command("backfill_typed_tags", preflight_only=True)

    def test_interrupted_canary_fails_if_a_processed_unit_failed(self):
        self.version.tags = ["   "]
        self.version.save(update_fields=["tags"])

        with self.assertRaisesMessage(CommandError, "Canary recorded 1 failed work unit"):
            call_command("backfill_typed_tags", run_id="failed-canary", stop_after=3)

        run = TagBackfillRun.objects.get(pk="failed-canary")
        self.assertEqual(run.status, TagBackfillRun.Status.INTERRUPTED)
        self.assertEqual(run.completed_work_units, 2)
        self.assertEqual(run.failed_work_units, 1)
