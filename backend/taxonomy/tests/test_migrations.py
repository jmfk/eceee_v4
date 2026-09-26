from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class TypedTagUpgradeMigrationTests(TransactionTestCase):
    """Exercise the same populated-schema upgrade path used in production."""

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        self.current_targets = executor.loader.graph.leaf_nodes()
        migrate_from = []
        state_targets = []
        for app_label, migration_name in self.current_targets:
            if app_label == "taxonomy":
                migrate_from.append((app_label, None))
                continue
            if app_label == "file_manager":
                migration_name = "0013_make_tenant_required_on_mediafile"
            elif app_label == "webpages":
                migration_name = "0071_pagetheme_designer_preview"
            target = (app_label, migration_name)
            migrate_from.append(target)
            state_targets.append(target)

        executor.migrate(migrate_from)
        old_apps = executor.loader.project_state(state_targets).apps
        self._seed_legacy_data(old_apps)

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.current_targets)
        super().tearDown()

    def _seed_legacy_data(self, apps):
        User = apps.get_model("auth", "User")
        Tenant = apps.get_model("core", "Tenant")
        Namespace = apps.get_model("content", "Namespace")
        ContentTag = apps.get_model("content", "Tag")
        MediaTag = apps.get_model("file_manager", "MediaTag")
        MediaFile = apps.get_model("file_manager", "MediaFile")
        MediaCollection = apps.get_model("file_manager", "MediaCollection")
        WebPage = apps.get_model("webpages", "WebPage")
        PageVersion = apps.get_model("webpages", "PageVersion")

        user = User.objects.create(username="typed-tag-upgrade-validator")
        tenant_one = Tenant.objects.create(
            name="Upgrade tenant one",
            identifier="typed-tag-upgrade-one",
            created_by_id=user.pk,
        )
        tenant_two = Tenant.objects.create(
            name="Upgrade tenant two",
            identifier="typed-tag-upgrade-two",
            created_by_id=user.pk,
        )
        namespace_one = Namespace.objects.create(
            name="Upgrade namespace one",
            slug="typed-tag-upgrade-one",
            is_active=True,
            is_default=True,
            created_by_id=user.pk,
            tenant_id=tenant_one.pk,
        )
        namespace_two = Namespace.objects.create(
            name="Upgrade namespace two",
            slug="typed-tag-upgrade-two",
            is_active=True,
            is_default=True,
            created_by_id=user.pk,
            tenant_id=tenant_two.pk,
        )

        content_one = ContentTag.objects.create(
            name="Upgrade Energy",
            slug="upgrade-energy",
            namespace_id=namespace_one.pk,
            tenant_id=tenant_one.pk,
        )
        content_two = ContentTag.objects.create(
            name="Upgrade Climate",
            slug="upgrade-climate",
            namespace_id=None,
            tenant_id=tenant_two.pk,
        )
        media_one = MediaTag.objects.create(
            name="Upgrade Energy",
            slug="upgrade-energy",
            namespace_id=namespace_one.pk,
            created_by_id=user.pk,
            color="#112233",
        )
        media_two = MediaTag.objects.create(
            name="Upgrade Energy",
            slug="upgrade-energy",
            namespace_id=namespace_two.pk,
            created_by_id=user.pk,
            color="#445566",
        )
        media_archive = MediaTag.objects.create(
            name="Upgrade Archive",
            slug="upgrade-archive",
            namespace_id=namespace_one.pk,
            created_by_id=user.pk,
        )

        page_one = WebPage.objects.create(
            title="Existing upgrade page one",
            slug="existing-upgrade-one",
            tenant_id=tenant_one.pk,
            created_by_id=user.pk,
            last_modified_by_id=user.pk,
        )
        page_two = WebPage.objects.create(
            title="Existing upgrade page two",
            slug="existing-upgrade-two",
            tenant_id=tenant_two.pk,
            created_by_id=user.pk,
            last_modified_by_id=user.pk,
        )
        version_one = PageVersion.objects.create(
            page_id=page_one.pk,
            version_number=1,
            version_title="Legacy version one",
            tags=["Upgrade Energy", "Upgrade Shared", "Upgrade Shared"],
            created_by_id=user.pk,
        )
        version_two = PageVersion.objects.create(
            page_id=page_two.pk,
            version_number=1,
            version_title="Legacy version two",
            tags=["Upgrade Climate", "Upgrade Energy"],
            created_by_id=user.pk,
        )

        active_file = MediaFile.objects.create(
            title="Active upgrade image",
            slug="active-upgrade-image",
            original_filename="active-upgrade.jpg",
            file_path="legacy/active-upgrade.jpg",
            file_size=100,
            content_type="image/jpeg",
            file_hash="d" * 64,
            file_type="image",
            namespace_id=namespace_one.pk,
            tenant_id=tenant_one.pk,
            created_by_id=user.pk,
            last_modified_by_id=user.pk,
        )
        active_file.tags.add(media_one)
        deleted_file = MediaFile.objects.create(
            title="Deleted upgrade image",
            slug="deleted-upgrade-image",
            original_filename="deleted-upgrade.jpg",
            file_path="legacy/deleted-upgrade.jpg",
            file_size=200,
            content_type="image/jpeg",
            file_hash="e" * 64,
            file_type="image",
            namespace_id=namespace_one.pk,
            tenant_id=tenant_one.pk,
            created_by_id=user.pk,
            last_modified_by_id=user.pk,
            is_deleted=True,
        )
        deleted_file.tags.add(media_archive)
        tenant_two_file = MediaFile.objects.create(
            title="Tenant two upgrade image",
            slug="tenant-two-upgrade-image",
            original_filename="tenant-two-upgrade.jpg",
            file_path="legacy/tenant-two-upgrade.jpg",
            file_size=300,
            content_type="image/jpeg",
            file_hash="f" * 64,
            file_type="image",
            namespace_id=namespace_two.pk,
            tenant_id=tenant_two.pk,
            created_by_id=user.pk,
            last_modified_by_id=user.pk,
        )
        tenant_two_file.tags.add(media_two)

        collection_one = MediaCollection.objects.create(
            title="Upgrade collection one",
            slug="upgrade-collection-one",
            namespace_id=namespace_one.pk,
            created_by_id=user.pk,
            last_modified_by_id=user.pk,
        )
        collection_one.tags.add(media_one, media_archive)
        collection_two = MediaCollection.objects.create(
            title="Upgrade collection two",
            slug="upgrade-collection-two",
            namespace_id=namespace_two.pk,
            created_by_id=user.pk,
            last_modified_by_id=user.pk,
        )
        collection_two.tags.add(media_two)

        self.legacy_ids = {
            "content": [content_one.pk, content_two.pk],
            "media": [media_one.pk, media_two.pk, media_archive.pk],
            "versions": [version_one.pk, version_two.pk],
            "files": [active_file.pk, deleted_file.pk, tenant_two_file.pk],
            "collections": [collection_one.pk, collection_two.pk],
            "tenant_one": tenant_one.pk,
            "tenant_two": tenant_two.pk,
            "deleted_file": deleted_file.pk,
        }

    def test_populated_schema_upgrade_and_resumable_backfill(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.current_targets)

        from content.models import Tag as ContentTag
        from file_manager.models import MediaCollection, MediaFile, MediaTag
        from taxonomy.models import LegacyTagMapping, Tag, TagBackfillRun, TagBackfillUnit
        from webpages.models import PageVersion, PageVersionTag

        self.assertEqual(ContentTag.objects.filter(pk__in=self.legacy_ids["content"]).count(), 2)
        self.assertEqual(MediaTag.objects.filter(pk__in=self.legacy_ids["media"]).count(), 3)
        self.assertEqual(PageVersion.objects.filter(pk__in=self.legacy_ids["versions"]).count(), 2)
        self.assertEqual(MediaFile.objects.with_deleted().filter(pk__in=self.legacy_ids["files"]).count(), 3)
        self.assertEqual(MediaCollection.objects.filter(pk__in=self.legacy_ids["collections"]).count(), 2)
        self.assertEqual(Tag.objects.count(), 0)
        self.assertEqual(PageVersionTag.objects.count(), 0)

        call_command("backfill_typed_tags", preflight_only=True)
        call_command("backfill_typed_tags", run_id="populated-upgrade", batch_size=2, stop_after=4)
        run = TagBackfillRun.objects.get(pk="populated-upgrade")
        self.assertEqual(run.status, TagBackfillRun.Status.INTERRUPTED)
        self.assertEqual(run.completed_work_units, 4)

        call_command("backfill_typed_tags", run_id="populated-upgrade", batch_size=2)
        call_command("backfill_typed_tags", run_id="populated-upgrade", verify_only=True)
        run.refresh_from_db()
        self.assertEqual(run.status, TagBackfillRun.Status.COMPLETE)
        self.assertEqual(run.completed_work_units, run.total_work_units)
        self.assertEqual(run.failed_work_units, 0)
        self.assertEqual(TagBackfillUnit.objects.filter(run=run).count(), run.total_work_units)
        self.assertEqual(LegacyTagMapping.objects.count(), 5)

        version_one = PageVersion.objects.get(pk=self.legacy_ids["versions"][0])
        self.assertEqual(version_one.tags, ["Upgrade Energy", "Upgrade Shared", "Upgrade Shared"])
        self.assertEqual(
            list(
                PageVersionTag.objects.filter(page_version=version_one)
                .order_by("position")
                .values_list("tag__name", flat=True)
            ),
            ["Upgrade Energy", "Upgrade Shared", "Upgrade Shared"],
        )
        self.assertTrue(
            MediaFile.objects.with_deleted()
            .get(pk=self.legacy_ids["deleted_file"])
            .canonical_tags.filter(name="Upgrade Archive")
            .exists()
        )
        self.assertEqual(
            Tag.objects.filter(tenant_id=self.legacy_ids["tenant_one"], name="Upgrade Energy").count(),
            1,
        )
        self.assertEqual(
            Tag.objects.filter(tenant_id=self.legacy_ids["tenant_two"], name="Upgrade Energy").count(),
            1,
        )

        counts_before = (
            Tag.objects.count(),
            LegacyTagMapping.objects.count(),
            PageVersionTag.objects.count(),
            TagBackfillUnit.objects.count(),
        )
        call_command("backfill_typed_tags", run_id="populated-upgrade", batch_size=3)
        call_command("backfill_typed_tags", run_id="populated-upgrade", verify_only=True)
        self.assertEqual(
            (
                Tag.objects.count(),
                LegacyTagMapping.objects.count(),
                PageVersionTag.objects.count(),
                TagBackfillUnit.objects.count(),
            ),
            counts_before,
        )
