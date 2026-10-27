import hashlib
import json
from datetime import timedelta
from io import StringIO
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from content.models import Namespace
from content_migration.legacy_content.profile import CLASSIFICATIONS, initial_bundle
from content_migration.legacy_content.service import apply_item, apply_run, preflight, stage
from content_migration.legacy_content.source import validate_record
from content_migration.legacy_content.term_plan import identity
from content_migration.legacy_content.transform import BlockedRecord, normalize
from content_migration.models import EditorialImportBinding
from core.models import Tenant
from object_storage.models import ObjectInstance, ObjectTypeDefinition
from object_storage.serializers import ObjectTypeDefinitionSerializer
from object_storage.services.version_workflow import ObjectVersionWorkflow
from taxonomy.context import actor_context
from taxonomy.models import ClassificationType
from taxonomy.services import mutate


def record(resource="news", pk=1, **updates):
    models = {
        "news": "eceeenews.eceeenews",
        "columns": "eceeecolumnists.eceeecolumn",
        "columnists": "eceeecolumnists.eceeecolumnist",
        "events": "eceeecalendar.eceeecalenderevent",
        "publications": "eceeelibrary.eceeelibraryitem",
        "organizations": "eceeememberforum.eceeememberorganization",
    }
    data = (
        {"firstName": "Test", "lastName": "Writer"}
        if resource == "columnists"
        else {"authorIds": [1]} if resource == "columns" else {}
    )
    return {
        "legacyId": pk,
        "sourceModel": models[resource],
        "sourceSite": 2,
        "sourceUrl": f"https://legacy.example/{resource}/{pk}/",
        "title": "Public test title",
        "slug": "same-slug",
        "summary": "Summary",
        "content": "<p>Public body</p>",
        "status": 2,
        "isPublic": True,
        "publishDate": "2020-01-01T10:00:00Z",
        "expiryDate": None,
        "presentationalPublishingDate": "2020-01-02T10:00:00Z",
        "data": data,
        "taxonomy": {},
        "attachments": [],
        **updates,
    }


class EditorialTransformTests(SimpleTestCase):
    def test_does_not_invent_precise_event_dates(self):
        with self.assertRaisesRegex(BlockedRecord, "incomplete_event_date"):
            normalize(record("events", data={"eventStartDate": "2020-01"}), "events")

    def test_preserves_display_and_source_date_independently(self):
        row = record(data={"sourceDate": "2019-12-31T12:15:00Z"})
        result = normalize(row, "news")
        self.assertEqual(result["data"]["sourceDate"], "2019-12-31T12:15:00Z")
        self.assertTrue(result["data"]["presentationalPublishingDate"].startswith("2020-01-02"))

    def test_columns_require_real_author_bindings(self):
        with self.assertRaisesRegex(BlockedRecord, "missing_columnist_dependency"):
            normalize(record("columns"), "columns")
        self.assertEqual(normalize(record("columns"), "columns", author_ids={"1": 42})["data"]["authors"], [42])

    def test_protected_or_wrong_model_records_fail_closed(self):
        for changes in [{"isPublic": False}, {"sourceModel": "eceeeproceedings.proceedingpage"}, {"status": 1}]:
            with self.assertRaises(ValueError):
                validate_record(record(**changes), "news")

    def test_internal_organization_name_is_not_a_fallback(self):
        with self.assertRaisesRegex(BlockedRecord, "missing_public_organization_name"):
            normalize(record("organizations", data={"organization": "INTERNAL"}), "organizations")


class EditorialImportTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("editorial-owner")
        self.tenant = Tenant.objects.create(identifier="editorial-tests", name="Editorial", created_by=self.user)
        self.namespace = Namespace.objects.create(
            tenant=self.tenant, name="Editorial", slug="default", created_by=self.user
        )
        self.types = {}
        for item in initial_bundle()["definitions"]:
            self.types[item["name"]] = ObjectTypeDefinition.objects.create(
                name=item["name"],
                label=item["label"],
                plural_label=item["plural_label"],
                namespace=self.namespace,
                created_by=self.user,
                schema=ObjectTypeDefinitionSerializer()._convert_schema_keys_to_snake(item["schema"]),
                slot_configuration=item["slot_configuration"],
                metadata=item["metadata"],
            )
        self.facets = {}
        for key, (name, uses) in CLASSIFICATIONS.items():
            self.facets[key] = ClassificationType.objects.create(
                tenant=self.tenant,
                namespace=self.namespace,
                key=key,
                name=name,
                allowed_uses=[f"object:{self.types[use].pk}" for use in uses],
            )
        for name, slug in [("Nyhet", "news"), ("Krönika", "column")]:
            mutate(self.user, self.facets["article_kind"], "create", payload={"name": name, "slug": slug})

    def stage(self, rows, configuration=None):
        return stage(
            tenant=self.tenant,
            namespace=self.namespace,
            user=self.user,
            source_scope="legacy.example:site:2",
            records=rows,
            configuration=configuration,
        )

    def _media_term(self, name):
        from taxonomy.models import Tag

        definition = self.facets["general"]
        if "media_files" not in definition.allowed_uses:
            definition.allowed_uses.append("media_files")
            definition.save()
        return Tag.objects.create(
            tenant=self.tenant, namespace=self.namespace, classification_type=definition, name=name, slug=name.lower()
        )

    def _reviewed_source_plan(self):
        source_key = identity(2, "sources", "eceeenews.eceeenewssource", 4)
        term = {
            "type": "news_source",
            "slug": "group-okand-kalla",
            "name": "Okänd källa",
            "parent": None,
            "alternative_names": [],
        }
        mapping = {
            "format": "eceee-reviewed-legacy-term-map",
            "version": 2,
            "sourceSite": 2,
            "inventoryDigest": "inventory",
            "decisionsDigest": "decisions",
            "termRefs": {source_key: {"type": "news_source", "slug": term["slug"]}},
            "pressReleaseSourceTerms": ["4"],
        }
        return {"bundle": {"terms": [term]}, "mapping": mapping}

    def test_reviewed_blank_source_is_mapped_and_new_source_is_rejected(self):
        from taxonomy.assignments import classification_ids
        from taxonomy.models import Tag

        plan = self._reviewed_source_plan()
        operation = mutate(
            self.user,
            self.facets["news_source"],
            "create",
            payload={"name": "Okänd källa", "slug": "group-okand-kalla"},
        )
        target = Tag.objects.get(pk=next(iter(operation.after)))
        source = {"model": "eceeenews.eceeenewssource", "id": 4, "name": "", "parentId": None}
        with patch("content_migration.legacy_content.service.compile_plan", return_value=plan):
            run = self.stage([("news", record(taxonomy={"sources": [source]}))], plan["mapping"])
            self.assertEqual(apply_run(run, self.user), {"imported": 1})
            obj = EditorialImportBinding.objects.get().object_instance
            self.assertIn(str(target.pk), classification_ids(obj.current_version))
            unknown = {**source, "id": 9999, "name": "New source"}
            with self.assertRaisesRegex(BlockedRecord, "new_or_unmapped_source_term"):
                self.stage([("news", record(pk=2, taxonomy={"sources": [unknown]}))], plan["mapping"])
            reparented = {**source, "parentId": 99}
            with self.assertRaisesRegex(BlockedRecord, "source_term_hierarchy_changed"):
                self.stage([("news", record(pk=3, taxonomy={"sources": [reparented]}))], plan["mapping"])

    def test_reviewed_term_with_removed_object_use_is_blocked(self):
        plan = self._reviewed_source_plan()
        mutate(
            self.user,
            self.facets["news_source"],
            "create",
            payload={"name": "Okänd källa", "slug": "group-okand-kalla"},
        )
        source = {"model": "eceeenews.eceeenewssource", "id": 4, "name": "", "parentId": None}
        with patch("content_migration.legacy_content.service.compile_plan", return_value=plan):
            run = self.stage([("news", record(taxonomy={"sources": [source]}))], plan["mapping"])
            self.facets["news_source"].allowed_uses = []
            self.facets["news_source"].save(update_fields=["allowed_uses"])
            self.assertEqual(apply_run(run, self.user), {"blocked": 1})
            self.assertEqual(run.items.get().error_category, "taxonomy_mapping_wrong_use")
            kind_run = self.stage([("news", record(pk=2))], plan["mapping"])
            self.facets["article_kind"].allowed_uses = []
            self.facets["article_kind"].save(update_fields=["allowed_uses"])
            self.assertEqual(apply_run(kind_run, self.user), {"blocked": 1})
            self.assertEqual(kind_run.items.get().error_category, "taxonomy_mapping_wrong_use")

    def test_changed_reviewed_target_blocks_apply(self):
        from taxonomy.models import Tag

        plan = self._reviewed_source_plan()
        operation = mutate(
            self.user,
            self.facets["news_source"],
            "create",
            payload={"name": "Okänd källa", "slug": "group-okand-kalla"},
        )
        target = Tag.objects.get(pk=next(iter(operation.after)))
        source = {"model": "eceeenews.eceeenewssource", "id": 4, "name": "", "parentId": None}
        with patch("content_migration.legacy_content.service.compile_plan", return_value=plan):
            run = self.stage([("news", record(taxonomy={"sources": [source]}))], plan["mapping"])
            target.name = "Changed"
            target.save(update_fields=["name"])
            with self.assertRaisesRegex(BlockedRecord, "unprepared_or_changed_reviewed_term"):
                apply_run(run, self.user)

    def test_reviewed_event_choice_and_keyword_across_four_target_types(self):
        from taxonomy.assignments import classification_ids
        from taxonomy.models import Tag

        keyword = {"model": "generic.keyword", "id": 836, "name": "Climate change", "parentId": None}
        keyword_key = identity(2, "keywords", "generic.keyword", 836)
        choice_key = identity(2, "eventType", "choice", "Conference")
        terms = [
            {
                "type": "news_keyword",
                "slug": "climate-change-reviewed",
                "name": "Climate change",
                "parent": None,
                "alternative_names": [],
            },
            {
                "type": "event_type",
                "slug": "conference-reviewed",
                "name": "Conference",
                "parent": None,
                "alternative_names": [],
            },
        ]
        plan = {
            "bundle": {"terms": terms},
            "mapping": {
                "format": "eceee-reviewed-legacy-term-map",
                "version": 2,
                "sourceSite": 2,
                "inventoryDigest": "inventory",
                "decisionsDigest": "decisions",
                "termRefs": {
                    keyword_key: {"type": "news_keyword", "slug": "climate-change-reviewed"},
                    choice_key: {"type": "event_type", "slug": "conference-reviewed"},
                },
            },
        }
        for term in terms:
            mutate(
                self.user,
                self.facets[term["type"]],
                "create",
                payload={
                    "name": term["name"],
                    "slug": term["slug"],
                },
            )
        rows = [
            ("news", record(taxonomy={"keywords": [keyword]})),
            ("columnists", record("columnists", pk=2, taxonomy={"keywords": [keyword]})),
            (
                "events",
                record(
                    "events",
                    pk=3,
                    data={"eventStartDate": "2020-05-10", "eventType": "Conference"},
                    taxonomy={"keywords": [keyword]},
                ),
            ),
            (
                "organizations",
                record(
                    "organizations", pk=4, data={"fullName": "Example organization"}, taxonomy={"keywords": [keyword]}
                ),
            ),
        ]
        with patch("content_migration.legacy_content.service.compile_plan", return_value=plan):
            run = self.stage(rows, plan["mapping"])
            self.assertEqual(apply_run(run, self.user), {"imported": 4})
            keyword_tag = Tag.objects.get(
                classification_type=self.facets["news_keyword"], slug="climate-change-reviewed"
            )
            for binding in EditorialImportBinding.objects.all():
                self.assertIn(str(keyword_tag.pk), classification_ids(binding.object_instance.current_version))
            changed_choice = {**rows[2][1], "data": {"eventStartDate": "2020-05-10", "eventType": "conference"}}
            with self.assertRaisesRegex(BlockedRecord, "new_or_unmapped_source_term"):
                self.stage([("events", changed_choice)], plan["mapping"])

    def test_press_release_requires_reviewed_newstype_identity(self):
        from taxonomy.assignments import classification_ids
        from taxonomy.models import Tag

        news = Tag.objects.get(classification_type=self.facets["article_kind"], slug="news")
        mutate(
            self.user,
            self.facets["article_kind"],
            "create",
            payload={
                "name": "Pressmeddelande",
                "slug": "press-release",
                "parent_id": str(news.pk),
            },
        )
        mutate(
            self.user,
            self.facets["news_type"],
            "create",
            payload={
                "name": "Press Release",
                "slug": "press-release-source",
            },
        )
        source = {"model": "eceeenews.eceeenewstype", "id": 4, "name": "Press Release", "parentId": None}
        key = identity(2, "types", source["model"], source["id"])
        plan = {
            "bundle": {
                "terms": [
                    {"type": "article_kind", "slug": "news", "name": "Nyhet", "parent": None, "alternative_names": []},
                    {
                        "type": "article_kind",
                        "slug": "press-release",
                        "name": "Pressmeddelande",
                        "parent": "news",
                        "alternative_names": [],
                    },
                    {
                        "type": "news_type",
                        "slug": "press-release-source",
                        "name": "Press Release",
                        "parent": None,
                        "alternative_names": [],
                    },
                ]
            },
            "mapping": {
                "format": "eceee-reviewed-legacy-term-map",
                "version": 2,
                "sourceSite": 2,
                "inventoryDigest": "inventory",
                "decisionsDigest": "decisions",
                "termRefs": {key: {"type": "news_type", "slug": "press-release-source"}},
            },
        }
        with patch("content_migration.legacy_content.service.compile_plan", return_value=plan):
            run = self.stage([("news", record(taxonomy={"types": [source]}))], plan["mapping"])
            self.assertEqual(apply_run(run, self.user), {"imported": 1})
            assigned = classification_ids(EditorialImportBinding.objects.get().object_instance.current_version)
            press = Tag.objects.get(classification_type=self.facets["article_kind"], slug="press-release")
            self.assertIn(str(press.pk), assigned)
            other_model = {**source, "model": "other.eceeenewstype"}
            with self.assertRaisesRegex(BlockedRecord, "new_or_unmapped_source_term"):
                self.stage([("news", record(pk=2, taxonomy={"types": [other_model]}))], plan["mapping"])

    def _media_run(self, row, configuration):
        return stage(
            tenant=self.tenant,
            namespace=self.namespace,
            user=self.user,
            source_scope="legacy.example:site:2",
            records=[("publications", row)],
            configuration=configuration,
        )

    def test_canonical_images_and_attachments_use_reviewed_terms_and_preserve_existing_assignments(self):
        from file_manager.models import MediaFile
        from taxonomy.assignments import classification_ids, replace_assignments
        from taxonomy.models import ClassificationRollout

        first_term = self._media_term("Imported")
        manual_term = self._media_term("Manual")
        next_term = self._media_term("Reviewed")
        ClassificationRollout.objects.create(namespace=self.namespace, phase="canonical")
        row = record(
            "publications",
            content='<p>Report <img src="https://legacy.example/cover.png"></p>',
            attachments=[{"title": "Report", "url": "https://legacy.example/report.pdf"}],
        )

        def uploaded(path, file):
            content = file.read()
            return {
                "file_path": path,
                "file_size": len(content),
                "content_type": file.content_type,
                "file_hash": hashlib.sha256(content).hexdigest(),
                "width": 10,
                "height": 10,
            }

        response = Mock(status_code=200, content=b"%PDF-1.4 test", headers={"content-type": "application/pdf"})
        with (
            patch("content_migration.legacy_news.media.storage") as storage,
            patch("file_manager.storage.storage", storage),
            patch(
                "content_migration.legacy_news.media.LegacyMediaImporter._read_image",
                return_value=(b"image", "image/png"),
            ),
            patch("content_migration.legacy_news.remote.get_public_url", return_value=response) as download,
        ):
            storage.overwrite_file.side_effect = uploaded
            storage.get_public_url.side_effect = lambda path: "https://media.example/" + path
            first = self._media_run(row, {"mediaClassificationIds": [str(first_term.pk)]})
            self.assertEqual(apply_run(first, self.user), {"imported": 1})
            self.assertEqual(MediaFile.objects.count(), 2)
            for media in MediaFile.objects.all():
                self.assertEqual(classification_ids(media), [str(first_term.pk)])
                with actor_context(self.user):
                    replace_assignments(media, [str(first_term.pk), str(manual_term.pk)], self.user)
            connection.check_constraints()
            second = self._media_run(row, {"mediaClassificationIds": [str(next_term.pk)]})
            self.assertEqual(apply_run(second, self.user), {"imported": 1})
            self.assertEqual(MediaFile.objects.count(), 2)
            for media in MediaFile.objects.all():
                self.assertEqual(
                    classification_ids(media), [str(first_term.pk), str(manual_term.pk), str(next_term.pk)]
                )
            self.assertEqual(EditorialImportBinding.objects.get().object_instance.versions.count(), 2)
            self.assertEqual(download.call_count, 1)
            self.assertEqual(storage.overwrite_file.call_count, 2)
            connection.check_constraints()

    def test_identical_source_retries_placeholder_without_duplicate_versions_until_recovered(self):
        from file_manager.models import MediaFile
        from taxonomy.models import ClassificationRollout

        term = self._media_term("Imported")
        ClassificationRollout.objects.create(namespace=self.namespace, phase="canonical")
        row = record("publications", content='<p><img src="https://legacy.example/recover.png"></p>')
        config = {"mediaClassificationIds": [str(term.pk)]}
        objects = {}

        def upload(path, file):
            content = file.read()
            objects[path] = content
            return {
                "file_path": path,
                "file_size": len(content),
                "content_type": file.content_type,
                "file_hash": hashlib.sha256(content).hexdigest(),
                "width": 10,
                "height": 10,
            }

        with (
            patch("content_migration.legacy_news.media.storage") as storage,
            patch(
                "content_migration.legacy_news.media.LegacyMediaImporter._read_image",
                side_effect=[ValueError("http-404"), ValueError("http-503"), (b"recovered-image", "image/png")],
            ) as read,
        ):
            storage.overwrite_file.side_effect = upload
            storage.get_public_url.side_effect = lambda path: "https://media.example/" + path
            self.assertEqual(apply_run(self._media_run(row, config), self.user), {"imported": 1})
            media = MediaFile.objects.get()
            old_path, old_bytes = media.file_path, objects[media.file_path]
            obj = EditorialImportBinding.objects.get().object_instance
            self.assertEqual(apply_run(self._media_run(row, config), self.user), {"unchanged": 1})
            self.assertEqual(obj.versions.count(), 1)
            self.assertEqual(MediaFile.objects.get().pk, media.pk)
            self.assertEqual(objects, {old_path: old_bytes})
            self.assertEqual(apply_run(self._media_run(row, config), self.user), {"imported": 1})
            media.refresh_from_db()
            obj.refresh_from_db()
            self.assertEqual(MediaFile.objects.count(), 1)
            self.assertFalse(media.metadata["migration_placeholder"])
            self.assertNotEqual(media.file_path, old_path)
            self.assertEqual(objects[old_path], old_bytes)
            self.assertEqual(obj.versions.count(), 2)
            self.assertIn(media.file_url, json.dumps(obj.current_version.widgets))
            self.assertEqual(obj.current_version.workflow_metadata["legacy_editorial"]["placeholder_images"], [])
            self.assertEqual(apply_run(self._media_run(row, config), self.user), {"unchanged": 1})
            self.assertEqual(read.call_count, 3)
            self.assertEqual(obj.versions.count(), 2)
        connection.check_constraints()

    def test_canonical_media_without_reviewed_classification_blocks_before_io(self):
        from file_manager.models import MediaFile
        from taxonomy.models import ClassificationRollout

        ClassificationRollout.objects.create(namespace=self.namespace, phase="canonical")
        row = record("publications", attachments=[{"title": "Report", "url": "https://legacy.example/report.pdf"}])
        with (
            patch("content_migration.legacy_news.remote.get_public_url") as download,
            patch("file_manager.storage.storage") as storage,
        ):
            run = self._media_run(row, {})
            self.assertEqual(apply_run(run, self.user), {"blocked": 1})
            self.assertEqual(run.items.get().error_category, "media_classification_required")
            download.assert_not_called()
            storage.overwrite_file.assert_not_called()
        self.assertFalse(MediaFile.objects.exists())
        connection.check_constraints()

    def test_drafts_are_idempotent_and_resume_reuses_identity(self):
        run = self.stage([("news", record())])
        types, facets, _ = preflight(self.tenant, self.namespace, self.user)
        with actor_context(self.user):
            apply_item(run, run.items.get(), self.user, types, facets)
        self.assertEqual(apply_run(run, self.user), {"imported": 1})
        obj = EditorialImportBinding.objects.get().object_instance
        self.assertIsNone(obj.current_version.effective_date)
        apply_run(run, self.user)
        self.assertEqual(obj.versions.count(), 1)
        second = self.stage([("news", record())])
        self.assertEqual(apply_run(second, self.user), {"unchanged": 1})
        self.assertEqual(ObjectInstance.objects.filter(object_type=self.types["article"]).count(), 1)

    def test_shared_numeric_ids_and_slugs_do_not_merge_news_and_columns(self):
        run = self.stage([("columns", record("columns")), ("columnists", record("columnists")), ("news", record())])
        self.assertEqual(apply_run(run, self.user), {"imported": 3})
        news = EditorialImportBinding.objects.get(resource="news").object_instance
        column = EditorialImportBinding.objects.get(resource="columns").object_instance
        self.assertNotEqual(news.pk, column.pk)
        self.assertNotEqual(news.slug, column.slug)
        self.assertEqual(news.object_type_id, column.object_type_id)
        self.assertEqual(
            column.current_version.data["authors"],
            [EditorialImportBinding.objects.get(resource="columnists").object_instance_id],
        )

    def test_column_import_requires_successful_columnist_in_current_run(self):
        rows = [("columnists", record("columnists")), ("columns", record("columns"))]
        self.assertEqual(apply_run(self.stage(rows), self.user), {"imported": 2})
        column = EditorialImportBinding.objects.get(resource="columns").object_instance

        missing = self.stage([rows[1]])
        self.assertEqual(apply_run(missing, self.user), {"blocked": 1})
        self.assertEqual(missing.items.get().error_category, "missing_columnist_dependency")

        excluded = self.stage(rows, {"excludedSources": ["columnists:1"]})
        self.assertEqual(apply_run(excluded, self.user), {"excluded": 1, "blocked": 1})
        self.assertEqual(column.versions.count(), 1)

        self.assertEqual(apply_run(self.stage(rows), self.user), {"unchanged": 2})

    def test_column_publication_requires_live_columnist_at_publication_time(self):
        rows = [("columnists", record("columnists")), ("columns", record("columns"))]
        self.assertEqual(apply_run(self.stage(rows), self.user), {"imported": 2})
        columnist = EditorialImportBinding.objects.get(resource="columnists").object_instance
        column = EditorialImportBinding.objects.get(resource="columns").object_instance
        author_version = columnist.current_version
        column_version = column.current_version

        with self.assertRaisesRegex(ValidationError, "Publish every referenced columnist"):
            ObjectVersionWorkflow(column, self.user).publish(
                version_id=column_version.pk, revision=column_version.edit_revision
            )

        ObjectVersionWorkflow(columnist, self.user).publish(
            version_id=author_version.pk, revision=author_version.edit_revision
        )
        ObjectVersionWorkflow(column, self.user).publish(
            version_id=column_version.pk, revision=column_version.edit_revision
        )
        self.assertIsNotNone(column.get_current_published_version())

    def test_news_with_author_reference_requires_public_columnist(self):
        rows = [("columnists", record("columnists")), ("news", record())]
        self.assertEqual(apply_run(self.stage(rows), self.user), {"imported": 2})
        columnist = EditorialImportBinding.objects.get(resource="columnists").object_instance
        news = EditorialImportBinding.objects.get(resource="news").object_instance
        version = news.current_version
        version.data = {**version.data, "authors": [columnist.pk]}
        version.save()

        with self.assertRaisesRegex(ValidationError, "Publish every referenced columnist"):
            ObjectVersionWorkflow(news, self.user).publish(version_id=version.pk, revision=version.edit_revision)

    def test_scheduled_column_requires_columnist_live_at_effective_date(self):
        rows = [("columnists", record("columnists")), ("columns", record("columns"))]
        self.assertEqual(apply_run(self.stage(rows), self.user), {"imported": 2})
        columnist = EditorialImportBinding.objects.get(resource="columnists").object_instance
        column = EditorialImportBinding.objects.get(resource="columns").object_instance
        author_version = columnist.current_version
        column_version = column.current_version
        author_start = timezone.now() + timedelta(days=1)
        author_end = author_start + timedelta(days=2)
        ObjectVersionWorkflow(columnist, self.user).schedule(
            version_id=author_version.pk,
            revision=author_version.edit_revision,
            effective_date=author_start,
            expiry_date=author_end,
        )

        with self.assertRaisesRegex(ValidationError, "Publish every referenced columnist"):
            ObjectVersionWorkflow(column, self.user).schedule(
                version_id=column_version.pk,
                revision=column_version.edit_revision,
                effective_date=author_start - timedelta(hours=1),
            )
        with self.assertRaisesRegex(ValidationError, "Publish every referenced columnist"):
            ObjectVersionWorkflow(column, self.user).schedule(
                version_id=column_version.pk,
                revision=column_version.edit_revision,
                effective_date=author_end + timedelta(hours=1),
            )
        ObjectVersionWorkflow(column, self.user).schedule(
            version_id=column_version.pk,
            revision=column_version.edit_revision,
            effective_date=author_start + timedelta(hours=1),
        )
        column_version.refresh_from_db()
        self.assertIsNotNone(column_version.effective_date)

    def test_manual_target_changes_block_reimport(self):
        first = self.stage([("news", record())])
        apply_run(first, self.user)
        obj = EditorialImportBinding.objects.get().object_instance
        v = obj.current_version
        v.title = "Manual edit"
        v.save()
        second = self.stage([("news", record(content="<p>Source changed</p>"))])
        self.assertEqual(apply_run(second, self.user), {"conflict": 1})
        v.refresh_from_db()
        self.assertEqual(v.title, "Manual edit")

    def test_reviewed_exclusion_wins_over_unchanged_or_manually_edited_destination(self):
        row = record()
        self.assertEqual(apply_run(self.stage([("news", row)]), self.user), {"imported": 1})
        binding = EditorialImportBinding.objects.get()
        obj = binding.object_instance
        obj.current_version.title = "Manual edit"
        obj.current_version.save()

        excluded = self.stage([("news", row)], {"excludedSources": ["news:1"]})
        self.assertEqual(apply_run(excluded, self.user), {"excluded": 1})
        self.assertEqual(excluded.items.get().error_category, "reviewed_exclusion")
        self.assertEqual(obj.versions.count(), 1)
        binding.refresh_from_db()
        self.assertEqual(binding.object_instance_id, obj.pk)
        obj.current_version.refresh_from_db()
        self.assertEqual(obj.current_version.title, "Manual edit")

    def test_taxonomy_merge_does_not_create_import_conflict(self):
        from taxonomy.models import Tag

        original = mutate(self.user, self.facets["news_category"], "create", payload={"name": "Original"})
        replacement = mutate(self.user, self.facets["news_category"], "create", payload={"name": "Replacement"})
        original_term = Tag.objects.get(pk=next(iter(original.after)))
        replacement_term = Tag.objects.get(pk=next(iter(replacement.after)))
        row = record(taxonomy={"categories": [{"model": "legacy.category", "id": 1, "name": "Original"}]})
        config = {"approvedTermMap": {"legacy.category:1": str(original_term.pk)}}
        self.assertEqual(apply_run(self.stage([("news", row)], config), self.user), {"imported": 1})
        obj = EditorialImportBinding.objects.get().object_instance

        mutate(
            self.user,
            self.facets["news_category"],
            "merge",
            term=original_term,
            revision=original_term.revision,
            payload={"target_id": str(replacement_term.pk), "target_revision": replacement_term.revision},
        )
        self.assertEqual(apply_run(self.stage([("news", row)], config), self.user), {"unchanged": 1})

        changed = record(content="<p>Source changed after taxonomy merge</p>", taxonomy=row["taxonomy"])
        mapped = {"approvedTermMap": {"legacy.category:1": str(replacement_term.pk)}}
        self.assertEqual(apply_run(self.stage([("news", changed)], mapped), self.user), {"imported": 1})
        self.assertEqual(obj.versions.count(), 2)

    def test_reimport_refetches_editor_changes_committed_while_waiting_for_the_object_lock(self):
        first = self.stage([("news", record())])
        apply_run(first, self.user)
        obj = EditorialImportBinding.objects.get().object_instance
        version = obj.current_version
        second = self.stage([("news", record(content="<p>New source body</p>"))])
        lock = ObjectInstance.objects.select_for_update

        def editor_finishes_before_import_gets_lock(*args, **kwargs):
            type(version).objects.filter(pk=version.pk).update(title="Editor committed while import waited")
            return lock(*args, **kwargs)

        with patch.object(
            ObjectInstance.objects, "select_for_update", side_effect=editor_finishes_before_import_gets_lock
        ):
            self.assertEqual(apply_run(second, self.user), {"conflict": 1})
        version.refresh_from_db()
        self.assertEqual(version.title, "Editor committed while import waited")
        self.assertEqual(obj.versions.count(), 1)

    def test_manual_relationship_edits_are_not_overwritten_by_reimport(self):
        rows = [("columnists", record("columnists")), ("columns", record("columns"))]
        apply_run(self.stage(rows), self.user)
        obj = EditorialImportBinding.objects.get(resource="columns").object_instance
        self.assertEqual(len(obj.relationships), 1)
        self.assertEqual(obj.relationships[0]["type"], "authors")
        obj.relationships = []
        obj.save(update_fields=["relationships"])
        changed = self.stage(
            [("columnists", record("columnists")), ("columns", record("columns", content="<p>Source changed</p>"))]
        )
        self.assertEqual(apply_run(changed, self.user), {"unchanged": 1, "conflict": 1})
        obj.refresh_from_db()
        self.assertEqual(obj.relationships, [])
        self.assertEqual(obj.versions.count(), 1)

    def test_import_blocks_unprepared_taxonomy_without_creating_approved_terms(self):
        from taxonomy.models import Tag

        row = record(taxonomy={"categories": [{"model": "legacy.category", "id": 1, "name": "Unreviewed"}]})
        before = Tag.objects.count()
        run = self.stage([("news", row)])
        self.assertEqual(apply_run(run, self.user), {"blocked": 1})
        self.assertEqual(run.items.get().error_category, "unprepared_taxonomy_term")
        self.assertEqual(Tag.objects.count(), before)

    def test_reviewed_mapping_must_preserve_its_classification_dimension(self):
        from taxonomy.models import Tag

        row = record(taxonomy={"categories": [{"model": "legacy.category", "id": 1, "name": "Category"}]})
        for target_key, expected in [("news_source", {"blocked": 1}), ("news_category", {"imported": 1})]:
            operation = mutate(self.user, self.facets[target_key], "create", payload={"name": "Mapped"})
            term = Tag.objects.get(pk=next(iter(operation.after)))
            run = stage(
                tenant=self.tenant,
                namespace=self.namespace,
                user=self.user,
                source_scope="legacy.example:site:2",
                records=[("news", row)],
                configuration={"approvedTermMap": {"legacy.category:1": str(term.pk)}},
            )
            self.assertEqual(apply_run(run, self.user), expected)

    def test_changed_mapping_reimports_unchanged_source(self):
        from taxonomy.assignments import classification_ids
        from taxonomy.models import Tag

        row = record(taxonomy={"categories": [{"model": "legacy.category", "id": 1, "name": "Category"}]})
        for name in ["First", "Second"]:
            operation = mutate(self.user, self.facets["news_category"], "create", payload={"name": name})
            term = Tag.objects.get(pk=next(iter(operation.after)))
            run = stage(
                tenant=self.tenant,
                namespace=self.namespace,
                user=self.user,
                source_scope="legacy.example:site:2",
                records=[("news", row)],
                configuration={"approvedTermMap": {"legacy.category:1": str(term.pk)}},
            )
            self.assertEqual(apply_run(run, self.user), {"imported": 1})
            obj = EditorialImportBinding.objects.get().object_instance
            self.assertIn(str(term.pk), classification_ids(obj.current_version))
        self.assertEqual(obj.versions.count(), 2)
        self.assertEqual(
            apply_run(
                stage(
                    tenant=self.tenant,
                    namespace=self.namespace,
                    user=self.user,
                    source_scope="legacy.example:site:2",
                    records=[("news", row)],
                    configuration=run.configuration,
                ),
                self.user,
            ),
            {"unchanged": 1},
        )

    def test_all_six_resources_share_article_storage_and_preserve_dependencies_and_attachments(self):
        mutate(self.user, self.facets["event_type"], "create", payload={"name": "Conference", "slug": "conference"})
        attachments = [
            {"title": "First report", "externalUrl": "https://example.org/first"},
            {"title": "Second report", "externalUrl": "https://example.org/second"},
        ]
        rows = [
            ("news", record()),
            ("columns", record("columns")),
            ("columnists", record("columnists")),
            ("events", record("events", data={"eventStartDate": "2020-05-10", "eventType": "Conference"})),
            ("publications", record("publications", attachments=attachments)),
            ("organizations", record("organizations", data={"fullName": "Public organization", "country": "SE"})),
        ]
        run = self.stage(rows)
        self.assertEqual(apply_run(run, self.user), {"imported": 6})
        self.assertEqual(ObjectInstance.objects.filter(object_type=self.types["article"]).count(), 2)
        self.assertFalse(ObjectInstance.objects.filter(current_version__effective_date__isnull=False).exists())
        library = EditorialImportBinding.objects.get(resource="publications").object_instance
        self.assertEqual(library.current_version.workflow_metadata["legacy_editorial"]["attachments"], attachments)
        self.assertEqual(apply_run(self.stage(rows), self.user), {"unchanged": 6})

    @patch("content_migration.management.commands.migrate_legacy_editorial.NewsCommand._legacy_api_config")
    @patch("content_migration.legacy_content.source.EditorialSource._request")
    def test_preflight_inventory_is_read_only_and_reports_each_source_resource(self, request, config):
        from content_migration.legacy_content.source import DEFAULT_RESOURCES, RESOURCES

        config.return_value = {"base_url": "https://legacy.example/api/migration/v1/", "token": "test-only"}
        request.side_effect = lambda path: (
            {"contentContract": "1", "contentResources": list(RESOURCES), "resources": ["news"]}
            if path == "health/"
            else {
                "contentContract": "1",
                "sourceSite": 2,
                "summary": {"total": 8, "published": 5, "excludedUnpublished": 3},
            }
        )
        output = StringIO()
        call_command(
            "migrate_legacy_editorial",
            "preflight",
            tenant=self.tenant.identifier,
            user=self.user.username,
            inventory=True,
            stdout=output,
        )
        result = json.loads(output.getvalue())
        self.assertEqual(set(result["inventory"]), set(DEFAULT_RESOURCES))
        self.assertEqual(result["inventory"]["columns"]["excludedUnpublished"], 3)
        self.assertEqual(request.call_count, 6)
        self.assertFalse(EditorialImportBinding.objects.exists())
        self.assertFalse(ObjectInstance.objects.exists())

    def test_old_news_compatibility_sample_cannot_be_accepted_for_full_import(self):
        run = stage(
            tenant=self.tenant,
            namespace=self.namespace,
            user=self.user,
            source_scope="legacy.example:site:2",
            records=[("news", record())],
            configuration={"compatibility": "legacy-news-v1", "sourceScopeVerified": False},
        )
        apply_run(run, self.user)
        with self.assertRaisesRegex(CommandError, "compatibility sample"):
            call_command(
                "migrate_legacy_editorial",
                "accept-sample",
                tenant=self.tenant.identifier,
                user=self.user.username,
                run=str(run.pk),
                confirm_manifest=run.manifest_hash,
            )

    def test_full_import_requires_a_current_completed_reviewed_sample(self):
        plan = {
            "bundle": {
                "terms": [
                    {"type": "article_kind", "slug": slug, "name": name, "parent": parent, "alternative_names": []}
                    for slug, name, parent in [
                        ("news", "Nyhet", None),
                        ("column", "Krönika", None),
                        ("press-release", "Pressmeddelande", "news"),
                    ]
                ]
            },
            "mapping": {
                "format": "eceee-reviewed-legacy-term-map",
                "version": 2,
                "sourceSite": 2,
                "inventoryDigest": "inventory",
                "decisionsDigest": "decisions",
                "termRefs": {},
            },
        }
        from taxonomy.models import Tag

        mutate(
            self.user,
            self.facets["article_kind"],
            "create",
            payload={
                "name": "Pressmeddelande",
                "slug": "press-release",
                "parent_id": str(Tag.objects.get(classification_type=self.facets["article_kind"], slug="news").pk),
            },
        )
        config = {**plan["mapping"], "resources": ["news"], "mappingHash": "reviewed-mapping"}
        with patch("content_migration.legacy_content.service.compile_plan", return_value=plan):
            sample = stage(
                tenant=self.tenant,
                namespace=self.namespace,
                user=self.user,
                source_scope="legacy.example:site:2",
                records=[("news", record())],
                configuration=config,
            )
            apply_run(sample, self.user)
            sample.refresh_from_db()
            sample.reviewed_at = timezone.now()
            sample.reviewed_by = self.user
            sample.save()

            def full_run():
                return stage(
                    tenant=self.tenant,
                    namespace=self.namespace,
                    user=self.user,
                    source_scope="legacy.example:site:2",
                    records=[("news", record())],
                    preset="all",
                    configuration={**config, "acceptedSampleRun": str(sample.pk)},
                )

            self.assertEqual(apply_run(full_run(), self.user), {"unchanged": 1})
            sample.status = "partial"
            sample.save()
            with self.assertRaisesRegex(BlockedRecord, "reviewed_sample_required"):
                apply_run(full_run(), self.user)

    def test_changed_frozen_manifest_fails_before_writing(self):
        run = self.stage([("news", record())])
        item = run.items.get()
        item.record["title"] = "Changed"
        item.save()
        with self.assertRaisesRegex(BlockedRecord, "manifest_changed"):
            apply_run(run, self.user)
        self.assertFalse(EditorialImportBinding.objects.exists())

    def test_destination_definition_changes_invalidate_run(self):
        run = self.stage([("news", record())])
        definition = self.types["article"]
        definition.schema["required"] = ["summary"]
        definition.save()
        with self.assertRaisesRegex(BlockedRecord, "definitions_changed_since_staging"):
            apply_run(run, self.user)

    def test_incomplete_event_is_reported_without_losing_other_items(self):
        run = self.stage([("news", record()), ("events", record("events", data={"eventStartDate": "2020"}))])
        self.assertEqual(apply_run(run, self.user), {"imported": 1, "blocked": 1})
        self.assertEqual(run.items.get(resource="events").error_category, "incomplete_event_date")

    def test_an_interruption_after_first_committed_item_can_resume(self):
        from content_migration.legacy_content import service

        run = self.stage([("news", record(pk=1)), ("news", record(pk=2, slug="second"))])
        original = service.apply_item
        count = 0

        def interrupt(*args, **kwargs):
            nonlocal count
            count += 1
            if count == 2:
                raise KeyboardInterrupt
            return original(*args, **kwargs)

        with patch.object(service, "apply_item", side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                apply_run(run, self.user)
        self.assertEqual(EditorialImportBinding.objects.count(), 1)
        self.assertEqual(apply_run(run, self.user), {"imported": 2})
        self.assertEqual(EditorialImportBinding.objects.count(), 2)
