from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Tenant

from .models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from .services.version_workflow import ObjectVersionWorkflow, ObjectWorkflowConflict


class ObjectVersionWorkflowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("object-workflow", password="test")
        self.tenant = Tenant.objects.create(name="Workflow", identifier="object-workflow", created_by=self.user)
        self.obj_type = ObjectTypeDefinition.objects.create(
            name="workflow",
            label="Workflow",
            plural_label="Workflows",
            schema={"type": "object", "properties": {}},
            created_by=self.user,
        )
        self.obj = ObjectInstance.objects.create(
            title="Original",
            object_type=self.obj_type,
            tenant=self.tenant,
            created_by=self.user,
        )
        self.initial = self.obj.create_version(self.user, data={"body": "Original"})
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    def service(self):
        return ObjectVersionWorkflow(self.obj, self.user)

    def publish(self, version):
        return self.service().publish(version_id=version.pk, revision=version.edit_revision)

    def save(self, source, **changes):
        content = {"title": "Changed", "data": {"body": "Changed"}, "widgets": {}}
        content.update(changes)
        return self.service().save(version_id=source.pk, revision=source.edit_revision, content=content)

    def endpoint(self, action, version=None):
        name = "objectversion" if version else "objectinstance"
        return reverse(f"api:object_storage:{name}-{action}", args=[version.pk if version else self.obj.pk])

    def test_repeated_save_reuses_working_copy_without_changing_public_content(self):
        live = self.publish(self.initial)
        working = self.save(live)
        saved_again = self.save(working, title="Again")
        self.assertEqual(working.pk, saved_again.pk)
        self.assertNotEqual(live.pk, working.pk)
        live.refresh_from_db()
        self.obj.refresh_from_db()
        self.assertEqual(live.data, {"body": "Original"})
        self.assertEqual(self.obj.title, "Original")
        self.assertEqual(self.obj.get_current_published_version().pk, live.pk)
        detail = self.client.get(self.endpoint("detail")).data
        self.assertEqual(detail["title"], "Again")
        self.assertEqual(detail["version_id"], working.pk)
        self.assertEqual(detail["edit_revision"], saved_again.edit_revision)

    def test_stale_save_and_publish_are_rejected(self):
        stale_revision = self.initial.edit_revision
        working = self.save(self.initial)
        with self.assertRaises(ObjectWorkflowConflict):
            self.service().save(version_id=working.pk, revision=stale_revision, content={"title": "Lost"})
        with self.assertRaises(ObjectWorkflowConflict):
            self.service().publish(version_id=working.pk, revision=stale_revision)
        working.refresh_from_db()
        self.assertEqual(working.title, "Changed")

    def test_trashed_objects_and_types_hide_versions_and_block_workflow(self):
        version_url = reverse("api:object_storage:objectversion-detail", args=[self.initial.pk])
        self.obj.soft_delete(self.user)
        self.assertEqual(self.client.get(version_url).status_code, 404)
        with self.assertRaisesRegex(ObjectWorkflowConflict, "Restore the Object"):
            self.publish(self.initial)

        self.obj.restore(self.user)
        self.obj_type.soft_delete(self.user)
        self.assertEqual(self.client.get(version_url).status_code, 404)
        with self.assertRaisesRegex(ObjectWorkflowConflict, "Restore the Object"):
            self.publish(self.initial)

    def test_publish_retires_live_and_never_reactivates_old_drafts(self):
        old_draft = self.initial
        newer = self.obj.create_version(self.user, data={"body": "Newer"})
        live = self.publish(newer)
        self.assertIsNone(self.service().editable())
        self.assertEqual(self.service().payload()["legacy_conflicts"]["older_draft_count"], 1)
        with self.assertRaises(ObjectWorkflowConflict):
            self.publish(old_draft)
        working = self.save(live)
        published = self.publish(working)
        live.refresh_from_db()
        self.assertIsNotNone(live.expiry_date)
        self.assertEqual(self.obj.get_current_published_version().pk, published.pk)

    def test_schedule_remains_editable_until_activation_then_freezes(self):
        live = self.publish(self.initial)
        working = self.save(live)
        effective = timezone.now() + timedelta(hours=1)
        scheduled = self.service().schedule(
            version_id=working.pk, revision=working.edit_revision, effective_date=effective
        )
        saved = self.save(scheduled, title="Scheduled title")
        self.assertEqual(saved.pk, scheduled.pk)
        future = self.obj.get_current_published_version(effective + timedelta(seconds=1))
        self.assertEqual(future.title, "Scheduled title")
        self.assertEqual(future.data, {"body": "Changed"})
        from unittest.mock import patch

        with patch(
            "object_storage.services.version_workflow.timezone.now", return_value=effective + timedelta(seconds=1)
        ):
            new_working = self.save(saved, title="After activation")
        self.assertNotEqual(new_working.pk, saved.pk)
        saved.refresh_from_db()
        self.assertEqual(saved.title, "Scheduled title")

    def test_reschedule_and_cancel_restore_original_live_expiry(self):
        live = self.publish(self.initial)
        working = self.save(live)
        effective = timezone.now() + timedelta(hours=1)
        scheduled = self.service().schedule(
            version_id=working.pk, revision=working.edit_revision, effective_date=effective
        )
        live.refresh_from_db()
        self.assertEqual(live.expiry_date, effective)
        scheduled = self.service().schedule(
            version_id=scheduled.pk, revision=scheduled.edit_revision, effective_date=effective + timedelta(hours=1)
        )
        cancelled = self.service().cancel_schedule(version_id=scheduled.pk, revision=scheduled.edit_revision)
        live.refresh_from_db()
        self.assertIsNone(live.expiry_date)
        self.assertIsNone(cancelled.effective_date)
        self.assertEqual(self.obj.get_current_published_version().pk, live.pk)

    def test_api_reschedule_retains_expiry_until_explicitly_cleared(self):
        live = self.publish(self.initial)
        working = self.save(live)
        effective = timezone.now() + timedelta(hours=1)
        expiry = effective + timedelta(hours=3)
        url = self.endpoint("schedule", working)

        def schedule(revision, publication_time, **extra):
            return self.client.post(
                url,
                {
                    "expected_version_id": working.pk,
                    "expected_revision": revision,
                    "effective_date": publication_time.isoformat(),
                    **extra,
                },
                format="json",
            )

        first = schedule(working.edit_revision, effective, expiry_date=expiry.isoformat())
        self.assertEqual(first.status_code, 200, first.data)
        later = effective + timedelta(hours=1)
        retained = schedule(first.data["version"]["edit_revision"], later)
        self.assertEqual(retained.status_code, 200, retained.data)
        working.refresh_from_db()
        self.assertEqual(working.expiry_date, expiry)
        retained_revision = working.edit_revision

        invalid = schedule(retained_revision, expiry + timedelta(hours=1))
        self.assertEqual(invalid.status_code, 400, invalid.data)
        working.refresh_from_db()
        self.assertEqual(working.effective_date, later)
        self.assertEqual(working.expiry_date, expiry)
        self.assertEqual(working.edit_revision, retained_revision)

        cleared = schedule(retained_revision, later, expiry_date=None)
        self.assertEqual(cleared.status_code, 200, cleared.data)
        working.refresh_from_db()
        self.assertIsNone(working.expiry_date)

    def test_unpublish_does_not_reveal_legacy_predecessor_or_cancelled_schedule(self):
        older = self.initial
        older.effective_date = timezone.now() - timedelta(days=2)
        older.save()
        newer = self.obj.create_version(self.user)
        newer.effective_date = timezone.now() - timedelta(days=1)
        newer.save()
        working = self.save(newer)
        scheduled = self.service().schedule(
            version_id=working.pk, revision=working.edit_revision, effective_date=timezone.now() + timedelta(days=1)
        )
        newer.refresh_from_db()
        self.service().unpublish(version_id=newer.pk, revision=newer.edit_revision)
        self.assertIsNone(self.obj.get_current_published_version())
        scheduled.refresh_from_db()
        self.service().cancel_schedule(version_id=scheduled.pk, revision=scheduled.edit_revision)
        self.assertIsNone(self.obj.get_current_published_version())

    def test_restore_targets_working_copy_and_keeps_live_and_history(self):
        live = self.publish(self.initial)
        working = self.save(live)
        restored = self.service().restore(source_id=live.pk, version_id=working.pk, revision=working.edit_revision)
        self.assertEqual(restored.pk, working.pk)
        self.assertEqual(restored.data, live.data)
        self.assertEqual(self.obj.get_current_published_version().pk, live.pk)
        self.assertEqual(self.obj.versions.count(), 2)
        with self.assertRaises(ObjectWorkflowConflict):
            self.service().restore(source_id=live.pk, version_id=working.pk, revision=working.edit_revision)

    def test_extra_schedules_are_preserved_and_explicitly_cancellable(self):
        self.initial.effective_date = timezone.now() + timedelta(days=1)
        self.initial.save()
        working = self.obj.create_version(self.user)
        with self.assertRaises(ObjectWorkflowConflict):
            self.service().schedule(
                version_id=working.pk, revision=working.edit_revision, effective_date=timezone.now() + timedelta(days=2)
            )
        self.initial.refresh_from_db()
        self.assertIsNotNone(self.initial.effective_date)
        self.service().cancel_schedule(version_id=self.initial.pk, revision=self.initial.edit_revision)
        self.assertEqual(self.obj.versions.count(), 2)

    def test_api_requires_complete_validated_content_and_revision(self):
        url = self.endpoint("save-working-copy")
        invalid = self.client.post(url, {"title": "Missing content"}, format="json")
        self.assertEqual(invalid.status_code, 400)
        payload = {
            "title": "Saved",
            "data": {},
            "widgets": {},
            "expected_version_id": self.initial.pk,
            "expected_revision": self.initial.edit_revision,
        }
        success = self.client.post(url, payload, format="json")
        self.assertEqual(success.status_code, 200, success.data)
        stale = self.client.post(url, payload, format="json")
        self.assertEqual(stale.status_code, 409)
        published = self.client.post(
            self.endpoint("publish", self.initial),
            {"expected_version_id": self.initial.pk, "expected_revision": success.data["version"]["edit_revision"]},
            format="json",
        )
        self.assertEqual(published.status_code, 200, published.data)

    def test_content_save_preserves_concurrent_move_without_revision_change(self):
        parent = ObjectInstance.objects.create(
            title="New parent", object_type=self.obj_type, tenant=self.tenant, created_by=self.user
        )
        self.obj_type.allowed_child_types.add(self.obj_type)
        moved = self.client.post(self.endpoint("move-to"), {"new_parent_id": parent.pk}, format="json")
        self.assertEqual(moved.status_code, 200, moved.data)
        saved = self.client.post(
            self.endpoint("save-working-copy"),
            {
                "title": "Saved content",
                "data": {},
                "widgets": {},
                "expected_version_id": self.initial.pk,
                "expected_revision": self.initial.edit_revision,
            },
            format="json",
        )
        self.assertEqual(saved.status_code, 200, saved.data)
        self.obj.refresh_from_db()
        self.assertEqual(self.obj.parent_id, parent.pk)

    def test_stale_structural_edits_conflict_without_saving_content(self):
        parent = ObjectInstance.objects.create(
            title="New parent", object_type=self.obj_type, tenant=self.tenant, created_by=self.user
        )
        self.obj_type.allowed_child_types.add(self.obj_type)
        moved = self.client.post(self.endpoint("move-to"), {"new_parent_id": parent.pk}, format="json")
        self.assertEqual(moved.status_code, 200, moved.data)
        ObjectInstance.objects.filter(pk=self.obj.pk).update(metadata={"server": True})
        base = {
            "title": "Lost content",
            "data": {"body": "Lost"},
            "widgets": {},
            "expected_version_id": self.initial.pk,
            "expected_revision": self.initial.edit_revision,
        }
        for structural in (
            {"parent": None, "expected_parent_id": None},
            {"metadata": {"client": True}, "expected_metadata": {}},
        ):
            response = self.client.post(self.endpoint("save-working-copy"), {**base, **structural}, format="json")
            self.assertEqual(response.status_code, 409, response.data)
            self.initial.refresh_from_db()
            self.assertEqual(self.initial.edit_revision, base["expected_revision"])
            self.assertEqual(self.initial.data, {"body": "Original"})
            self.obj.refresh_from_db()
            self.assertEqual(self.obj.parent_id, parent.pk)
            self.assertEqual(self.obj.metadata, {"server": True})

    def test_fresh_structural_edits_require_baselines_and_save(self):
        parent = ObjectInstance.objects.create(
            title="New parent", object_type=self.obj_type, tenant=self.tenant, created_by=self.user
        )
        self.obj_type.allowed_child_types.add(self.obj_type)
        base = {
            "title": "Saved content",
            "data": {},
            "widgets": {},
            "expected_version_id": self.initial.pk,
            "expected_revision": self.initial.edit_revision,
        }
        missing_baseline = self.client.post(
            self.endpoint("save-working-copy"), {**base, "parent": parent.pk}, format="json"
        )
        self.assertEqual(missing_baseline.status_code, 400)
        missing_metadata_baseline = self.client.post(
            self.endpoint("save-working-copy"), {**base, "metadata": {"new": True}}, format="json"
        )
        self.assertEqual(missing_metadata_baseline.status_code, 400)
        saved = self.client.post(
            self.endpoint("save-working-copy"),
            {
                **base,
                "parent": parent.pk,
                "expected_parent_id": None,
                "metadata": {"new": True},
                "expected_metadata": {},
            },
            format="json",
        )
        self.assertEqual(saved.status_code, 200, saved.data)
        self.obj.refresh_from_db()
        self.assertEqual(self.obj.parent_id, parent.pk)
        self.assertEqual(self.obj.metadata, {"new": True})

    def test_legacy_editor_mutations_are_retired(self):
        for action in ("update-current-version", "update-widgets"):
            response = self.client.put(self.endpoint(action), {"data": {"body": "Bypass"}}, format="json")
            self.assertEqual(response.status_code, 410)
        self.assertEqual(
            self.client.patch(self.endpoint("detail"), {"title": "Bypass"}, format="json").status_code, 410
        )
        self.assertEqual(self.client.post(self.endpoint("publish"), {}, format="json").status_code, 410)
        self.assertEqual(
            self.client.patch(self.endpoint("detail", self.initial), {"is_featured": True}, format="json").status_code,
            410,
        )

    def test_version_api_rejects_foreign_workspace_and_nonmember(self):
        outsider = User.objects.create_user("outsider")
        other = Tenant.objects.create(name="Other", identifier="other-workflow", created_by=outsider)
        self.client.credentials(HTTP_X_TENANT_ID=other.identifier)
        self.assertIn(self.client.get(self.endpoint("detail", self.initial)).status_code, (403, 404))
        self.client.force_authenticate(outsider)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.assertEqual(self.client.get(self.endpoint("detail", self.initial)).status_code, 403)

    def test_restore_rejects_foreign_source(self):
        other = ObjectInstance.objects.create(
            title="Other", object_type=self.obj_type, tenant=self.tenant, created_by=self.user
        )
        foreign_source = other.create_version(self.user)
        response = self.client.post(
            self.endpoint("restore", self.initial),
            {
                "source_version_id": foreign_source.pk,
                "expected_version_id": self.initial.pk,
                "expected_revision": self.initial.edit_revision,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_public_list_annotations_ignore_featured_draft_and_sort_by_live_date(self):
        live = self.publish(self.initial)
        self.save(live, is_featured=True)
        public = ObjectInstance.published.with_published_versions().get(pk=self.obj.pk)
        self.assertFalse(public.is_featured)
        results = ObjectInstance.get_published_objects(
            object_type_ids=[self.obj_type.pk],
            prioritize_featured=True,
            tenant=self.tenant,
        )
        self.assertFalse(results[0].is_featured)
        self.assertEqual(results[0].live_effective_date, live.effective_date)

    def test_draft_save_keeps_relationship_projection_until_publish(self):
        from unittest.mock import patch

        live = self.publish(self.initial)
        with patch.object(ObjectVersion, "sync_relationships_from_data", autospec=True) as sync:
            working = self.save(live)
            sync.assert_not_called()
            self.publish(working)
            sync.assert_called_once()

    def test_scheduled_projection_refresh_is_idempotent(self):
        from unittest.mock import patch

        from .services.version_workflow import refresh_scheduled_object_publications

        live = self.publish(self.initial)
        working = self.save(live, title="Scheduled title")
        effective = timezone.now() + timedelta(hours=1)
        self.service().schedule(version_id=working.pk, revision=working.edit_revision, effective_date=effective)
        self.assertEqual(refresh_scheduled_object_publications(), 0)
        with patch.object(ObjectVersion, "sync_relationships_from_data", autospec=True) as sync:
            self.assertEqual(refresh_scheduled_object_publications(effective + timedelta(seconds=1)), 1)
            self.assertEqual(refresh_scheduled_object_publications(effective + timedelta(seconds=1)), 0)
            sync.assert_called_once()
        self.obj.refresh_from_db()
        self.assertEqual(self.obj.title, "Scheduled title")

    def test_scheduled_projection_keeps_pending_marker_after_concurrent_reschedule(self):
        from unittest.mock import patch

        from .services.version_workflow import refresh_scheduled_object_publications

        live = self.publish(self.initial)
        working = self.save(live, title="Scheduled title")
        effective = timezone.now() + timedelta(hours=1)
        scheduled = self.service().schedule(
            version_id=working.pk, revision=working.edit_revision, effective_date=effective
        )
        scan_time = effective + timedelta(seconds=1)
        later = scan_time + timedelta(hours=1)
        original_lock = ObjectVersionWorkflow._lock

        def reschedule_after_candidate_scan(service):
            original_lock(service)
            ObjectVersion.objects.filter(pk=scheduled.pk).update(effective_date=later)

        with patch.object(ObjectVersionWorkflow, "_lock", reschedule_after_candidate_scan):
            self.assertEqual(refresh_scheduled_object_publications(now=scan_time), 0)
        scheduled.refresh_from_db()
        self.obj.refresh_from_db()
        self.assertEqual(scheduled.effective_date, later)
        self.assertTrue(scheduled.workflow_metadata["scheduled_activation_pending"])
        self.assertEqual(self.obj.title, "Original")

    def test_scheduled_expiry_does_not_reveal_an_older_legacy_publication(self):
        self.initial.effective_date = timezone.now() - timedelta(days=2)
        self.initial.save()
        second = self.obj.create_version(self.user)
        second.effective_date = timezone.now() - timedelta(days=1)
        second.save()
        working = self.save(second)
        effective = timezone.now() + timedelta(hours=1)
        expiry = effective + timedelta(hours=1)
        self.service().schedule(
            version_id=working.pk, revision=working.edit_revision, effective_date=effective, expiry_date=expiry
        )
        self.assertIsNone(self.obj.get_current_published_version(expiry + timedelta(seconds=1)))

    def test_save_rejects_reference_to_another_workspace(self):
        other = Tenant.objects.create(name="Other", identifier="foreign-reference", created_by=self.user)
        foreign = ObjectInstance.objects.create(
            title="Foreign", object_type=self.obj_type, tenant=other, created_by=self.user
        )
        self.obj_type.schema = {
            "type": "object",
            "properties": {"link": {"type": "integer", "field_type": "object_reference"}},
        }
        self.obj_type.save()
        response = self.client.post(
            self.endpoint("save-working-copy"),
            {
                "title": "Saved",
                "data": {"link": foreign.pk},
                "widgets": {},
                "expected_version_id": self.initial.pk,
                "expected_revision": self.initial.edit_revision,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.initial.refresh_from_db()
        self.assertEqual(self.initial.data, {"body": "Original"})

    def test_publish_retry_does_not_duplicate_or_reactivate_history(self):
        revision = self.initial.edit_revision
        live = self.publish(self.initial)
        again = self.service().publish(version_id=live.pk, revision=revision)
        self.assertEqual(live.pk, again.pk)
        self.assertEqual(self.obj.versions.count(), 1)
        self.service().unpublish(version_id=live.pk, revision=live.edit_revision)
        with self.assertRaises(ObjectWorkflowConflict):
            self.service().publish(version_id=live.pk, revision=revision)

    def test_internal_version_update_invalidates_an_editor_revision(self):
        revision = self.initial.edit_revision
        changed = ObjectVersion.objects.get(pk=self.initial.pk)
        changed.data = {"body": "Imported content"}
        changed.save(update_fields=["data"])
        with self.assertRaises(ObjectWorkflowConflict):
            self.service().save(version_id=self.initial.pk, revision=revision, content={"title": "Stale editor"})
        self.assertGreater(changed.edit_revision, revision)

    def test_browser_status_and_filters_follow_version_publication(self):
        self.publish(self.initial)
        list_url = reverse("api:object_storage:objectinstance-list")
        published = self.client.get(list_url, {"status": "published"})
        self.assertEqual(published.status_code, 200)
        rows = published.data.get("results", published.data) if isinstance(published.data, dict) else published.data
        self.assertEqual([row["id"] for row in rows], [self.obj.pk])
        self.assertEqual(rows[0]["status"], "published")
        drafts = self.client.get(list_url, {"status": "draft"})
        rows = drafts.data.get("results", drafts.data) if isinstance(drafts.data, dict) else drafts.data
        self.assertEqual(rows, [])

    def test_working_copy_preserves_released_theme_widget_pins(self):
        from webpages.models import PageTheme
        from webpages.tests.test_theme_widgets import TYPE, working_document
        from webpages.theme_widgets import empty_widget_types, publish_widget_types

        PageTheme.objects.create(
            name="Object workflow theme",
            tenant=self.tenant,
            created_by=self.user,
            is_default=True,
            is_active=True,
            widget_types=publish_widget_types(working_document(), empty_widget_types()),
        )
        working = self.save(
            self.initial,
            widgets={"main": [{"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}]},
        )
        reviewed_widgets = working.widgets.copy()
        live = self.publish(working)
        copied = self.save(live, widgets=live.widgets)
        self.assertEqual(copied.widgets, reviewed_widgets)
        self.assertEqual(copied.widgets["main"][0]["type_version"], 1)
