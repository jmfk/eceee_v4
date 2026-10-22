"""Atomic authoring and publication operations for Object versions."""

from copy import deepcopy

from django.core.exceptions import ValidationError as ModelValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import APIException, ValidationError

from core.models import Tenant

from ..models import ObjectInstance, ObjectVersion

EXPIRY_UNSET = object()


class ObjectWorkflowConflict(APIException):
    status_code = 409
    default_code = "object_version_conflict"
    default_detail = "The Object changed. Reload before trying again."


class ObjectVersionWorkflow:
    def __init__(self, obj, user=None):
        self.obj = obj
        self.user = user
        self.now = timezone.now()

    def _lock(self):
        Tenant.objects.select_for_update().get(pk=self.obj.tenant_id)
        try:
            self.obj = ObjectInstance.objects.select_for_update().get(pk=self.obj.pk, tenant_id=self.obj.tenant_id)
        except ObjectInstance.DoesNotExist as error:
            raise ObjectWorkflowConflict(
                "The Object moved to another workspace. Reload before trying again."
            ) from error
        # A schedule may have activated while waiting for the Object lock.
        self.now = timezone.now()

    def versions(self):
        return self.obj.versions.order_by("-version_number")

    def editable(self):
        latest_public = self.versions().filter(effective_date__lte=self.now).first()
        candidates = self.versions().filter(Q(effective_date__isnull=True) | Q(effective_date__gt=self.now))
        if latest_public:
            candidates = candidates.filter(version_number__gt=latest_public.version_number)
        return candidates.first()

    def live(self):
        return self.obj.get_current_published_version(self.now)

    def schedules(self):
        return self.versions().filter(effective_date__gt=self.now).order_by("effective_date", "-version_number")

    @staticmethod
    def summary(version):
        if not version:
            return None
        return {
            "id": version.id,
            "version_number": version.version_number,
            "title": version.content_title,
            "edit_revision": version.edit_revision,
            "updated_at": version.updated_at,
            "effective_date": version.effective_date,
            "expiry_date": version.expiry_date,
            "is_featured": version.is_featured,
        }

    def payload(self):
        editable, live, scheduled = self.editable(), self.live(), self.schedules().first()
        if live:
            state = (
                "live_with_scheduled_changes" if scheduled else "live_with_unpublished_changes" if editable else "live"
            )
        else:
            state = (
                "scheduled"
                if scheduled
                else (
                    "not_published"
                    if editable
                    else "publication_ended" if self.versions().exists() else "not_published"
                )
            )
        drafts = self.versions().filter(effective_date__isnull=True)
        if editable:
            drafts = drafts.exclude(pk=editable.pk)
        return {
            "object_id": self.obj.id,
            "state": state,
            "editable_version": self.summary(editable),
            "live_version": self.summary(live),
            "scheduled_version": self.summary(scheduled),
            "scheduled_at": scheduled.effective_date if scheduled else None,
            "legacy_conflicts": {
                "older_draft_count": drafts.count(),
                "additional_scheduled_count": max(0, self.schedules().count() - 1),
            },
        }

    def reviewed(self, version, version_id, revision):
        if not version or str(version.pk) != str(version_id) or version.edit_revision != revision:
            raise ObjectWorkflowConflict(
                {
                    "message": "The reviewed Object version changed. Reload before trying again.",
                    "server_version_id": version.pk if version else None,
                    "server_revision": version.edit_revision if version else None,
                }
            )

    def require_editable(self, version_id, revision):
        version = self.editable()
        self.reviewed(version, version_id, revision)
        return version

    def _copy(self, source):
        if source and not source.title:
            # Preserve the known legacy title before a later publish changes the Object title.
            source.title = self.obj.title
            source.save(update_fields=["title"], sync_relationships=False)
        latest = self.versions().first()
        version = ObjectVersion(
            object_instance=self.obj,
            version_number=latest.version_number + 1 if latest else 1,
            title=source.content_title if source else self.obj.title,
            data=deepcopy(source.data) if source else {},
            widgets=deepcopy(source.widgets) if source else {},
            is_featured=source.is_featured if source else False,
            created_by=self.user,
            change_description="Working copy",
        )
        try:
            version.save(sync_relationships=False)
        except ModelValidationError as error:
            raise ValidationError({"widgets": error.messages}) from error
        if source:
            from taxonomy.assignments import copy_assignments

            copy_assignments(source, version)
        return version

    def _point_to(self, version):
        self.obj.current_version = version
        self.obj.version = version.version_number
        self.obj.save(update_fields=["current_version", "version", "updated_at"])

    @staticmethod
    def _save(version, fields):
        version.edit_revision += 1
        try:
            version.save(
                update_fields=[*fields, "edit_revision", "updated_at"], sync_relationships=False, advance_revision=False
            )
        except ModelValidationError as error:
            raise ValidationError({"widgets": error.messages}) from error
        return version

    def _validate_content(self, version):
        from django.core.exceptions import ValidationError as DjangoValidationError

        from utils.schema_system import validate_object_reference

        from ..serializers import ObjectInstanceSerializer

        serializer = ObjectInstanceSerializer(
            self.obj,
            data={
                "title": version.content_title,
                "data": version.data,
                "widgets": version.widgets,
            },
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer._validate_data_against_schema(version.data, self.obj.object_type)
        serializer._validate_widgets_against_slots(version.widgets, self.obj.object_type)
        for field in self.obj.object_type.get_schema_fields():
            if field.get("field_type", field.get("type")) != "object_reference":
                continue
            value = version.data.get(field["name"])
            references = value if isinstance(value, list) else ([] if value is None or value == "" else [value])
            try:
                ids = [int(reference) for reference in references]
                if any(isinstance(reference, bool) for reference in references) or (
                    ObjectInstance.objects.filter(tenant_id=self.obj.tenant_id, pk__in=ids).count() != len(set(ids))
                ):
                    raise ValueError("Referenced Objects must belong to this workspace.")
                validate_object_reference(value, field)
            except (ValueError, TypeError, DjangoValidationError) as error:
                raise ValidationError({"data": {field["name"]: str(error)}}) from error

    @transaction.atomic
    def save(self, *, version_id, revision, content):
        self._lock()
        target = self.editable()
        source = target or self.live() or self.versions().first()
        self.reviewed(source, version_id, revision)
        if not target:
            target = self._copy(source)
        for field in ("title", "data", "widgets", "is_featured", "change_description"):
            if field in content:
                setattr(target, field, deepcopy(content[field]))
        self._validate_content(target)
        self._save(target, ["title", "data", "widgets", "is_featured", "change_description"])
        if "classification_ids" in content:
            from taxonomy.assignments import replace_assignments

            replace_assignments(target, content["classification_ids"], self.user)
        self._point_to(target)
        return target

    def _assert_no_other_schedule(self, version):
        if self.schedules().exclude(pk=version.pk).exists():
            raise ObjectWorkflowConflict("Cancel the other scheduled versions before publishing or scheduling changes.")

    def _restore_predecessor(self, version):
        metadata = deepcopy(version.workflow_metadata)
        predecessors = metadata.pop("scheduled_predecessors", [])
        for previous in predecessors:
            predecessor = self.versions().filter(pk=previous["id"]).first()
            if predecessor and predecessor.expiry_date == version.effective_date:
                predecessor.expiry_date = parse_datetime(previous["expiry"]) if previous["expiry"] else None
                self._save(predecessor, ["expiry_date"])
        version.workflow_metadata = metadata

    @transaction.atomic
    def publish(self, *, version_id, revision):
        self._lock()
        if not self.editable():
            live = self.live()
            if live and str(live.pk) == str(version_id) and revision in (live.edit_revision, live.edit_revision - 1):
                return live
        version = self.require_editable(version_id, revision)
        self._validate_content(version)
        from content_migration.legacy_content.validation import assert_publishable

        assert_publishable(version)
        self._assert_no_other_schedule(version)
        self._restore_predecessor(version)
        for previous in (
            self.versions()
            .filter(effective_date__lte=self.now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=self.now))
        ):
            previous.title = previous.content_title
            previous.expiry_date = self.now
            self._save(previous, ["expiry_date", "title"])
        version.workflow_metadata.pop("scheduled_activation_pending", None)
        version.effective_date = self.now
        version.expiry_date = None
        if not version.title:
            version.title = self.obj.title
        self._save(version, ["effective_date", "expiry_date", "workflow_metadata", "title"])
        self._point_to(version)
        self.obj.title = version.title
        self.obj.save(update_fields=["title", "updated_at"])
        version.sync_relationships_from_data()
        return version

    @transaction.atomic
    def schedule(self, *, version_id, revision, effective_date, expiry_date=EXPIRY_UNSET):
        self._lock()
        version = self.require_editable(version_id, revision)
        if expiry_date is EXPIRY_UNSET:
            expiry_date = version.expiry_date
        if effective_date <= self.now or (expiry_date and expiry_date <= effective_date):
            raise ValidationError("Choose a future publication time and an expiry after publication.")
        self._validate_content(version)
        from content_migration.legacy_content.validation import assert_publishable

        assert_publishable(version)
        self._assert_no_other_schedule(version)
        self._restore_predecessor(version)
        predecessors = []
        for previous in (
            self.versions()
            .filter(effective_date__lte=self.now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=effective_date))
        ):
            predecessors.append(
                {
                    "id": previous.pk,
                    "expiry": previous.expiry_date.isoformat() if previous.expiry_date else None,
                }
            )
            previous.title = previous.content_title
            previous.expiry_date = effective_date
            self._save(previous, ["expiry_date", "title"])
        if predecessors:
            version.workflow_metadata["scheduled_predecessors"] = predecessors
        version.workflow_metadata["scheduled_activation_pending"] = True
        version.effective_date = effective_date
        version.expiry_date = expiry_date
        return self._save(version, ["effective_date", "expiry_date", "workflow_metadata"])

    @transaction.atomic
    def cancel_schedule(self, *, version_id, revision):
        self._lock()
        # Legacy extra schedules can be cancelled explicitly, without becoming editable.
        version = self.schedules().filter(pk=version_id).first()
        self.reviewed(version, version_id, revision)
        self._restore_predecessor(version)
        version.workflow_metadata.pop("scheduled_activation_pending", None)
        version.effective_date = None
        version.expiry_date = None
        return self._save(version, ["effective_date", "expiry_date", "workflow_metadata"])

    @transaction.atomic
    def unpublish(self, *, version_id, revision):
        self._lock()
        version = self.live()
        self.reviewed(version, version_id, revision)
        for previous in (
            self.versions()
            .filter(effective_date__lte=self.now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=self.now))
        ):
            previous.expiry_date = self.now
            self._save(previous, ["expiry_date"])
        # A later schedule cancellation must not bring this live version back.
        for scheduled in self.schedules():
            if "scheduled_predecessors" in scheduled.workflow_metadata:
                scheduled.workflow_metadata = deepcopy(scheduled.workflow_metadata)
                scheduled.workflow_metadata.pop("scheduled_predecessors")
                self._save(scheduled, ["workflow_metadata"])
        version.refresh_from_db()
        return version

    @transaction.atomic
    def restore(self, *, source_id, version_id, revision):
        self._lock()
        source = self.versions().filter(pk=source_id).first()
        if not source:
            raise ValidationError("The historical version does not belong to this Object.")
        target = self.editable()
        self.reviewed(target or self.live() or self.versions().first(), version_id, revision)
        if target and target.pk == source.pk:
            return target
        if not target:
            target = self._copy(source)
        else:
            for field in ("data", "widgets", "is_featured"):
                setattr(target, field, deepcopy(getattr(source, field)))
            target.title = source.content_title
        target.change_description = f"Restored from version {source.version_number}"
        self._validate_content(target)
        self._save(target, ["title", "data", "widgets", "is_featured", "change_description"])
        self._point_to(target)
        return target


def refresh_scheduled_object_publications(now=None):
    """Refresh derived title/relationship projections in the existing publication worker.

    Public content selection remains date based and does not wait for this worker.
    A pending marker makes retries bounded and idempotent after downtime.
    """
    import logging

    now = now or timezone.now()
    pending = ObjectVersion.objects.filter(
        workflow_metadata__scheduled_activation_pending=True, effective_date__lte=now
    ).values_list("pk", "object_instance_id")
    refreshed = 0
    for version_id, object_id in pending.iterator():
        try:
            with transaction.atomic():
                service = ObjectVersionWorkflow(ObjectInstance.objects.get(pk=object_id))
                service._lock()
                obj = service.obj
                version = ObjectVersion.objects.get(pk=version_id, object_instance=obj)
                # The candidate may have been rescheduled or cancelled while waiting for the lock.
                if (
                    not version.workflow_metadata.get("scheduled_activation_pending")
                    or version.effective_date is None
                    or version.effective_date > now
                ):
                    continue
                live = obj.get_current_published_version(now)
                if live and live.pk == version.pk:
                    obj.title = version.content_title
                    obj.save(update_fields=["title", "updated_at"])
                    version.sync_relationships_from_data()
                metadata = deepcopy(version.workflow_metadata)
                metadata.pop("scheduled_activation_pending", None)
                ObjectVersion.objects.filter(pk=version_id).update(workflow_metadata=metadata)
                refreshed += 1
        except Exception:
            logging.getLogger(__name__).exception("Scheduled Object projection refresh failed for %s", object_id)
    return refreshed
