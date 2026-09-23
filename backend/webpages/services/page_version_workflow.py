"""Canonical editing and publishing workflow for page versions."""

from copy import copy, deepcopy
from dataclasses import dataclass

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from ..models import PageVersion, WebPage

PAGE_ATTRIBUTE_FIELDS = {
    "title": "title",
    "description": "description",
    "slug": "slug",
    "path_pattern_key": "path_pattern_key",
    "pathPatternKey": "path_pattern_key",
    "hostnames": "hostnames",
}


def normalize_change_summary(value):
    """Return the object form used by workflow metadata for legacy JSON values."""
    if isinstance(value, dict):
        return deepcopy(value)
    if value:
        return {"description": str(value)}
    return {}


def page_with_attributes(page, attributes):
    """Return an unsaved page copy with delayed working-copy attributes applied."""
    candidate = copy(page)
    for source_field, target_field in PAGE_ATTRIBUTE_FIELDS.items():
        if source_field not in attributes:
            continue
        model_field = WebPage._meta.get_field(target_field)
        value = model_field.clean(attributes[source_field], candidate)
        setattr(candidate, target_field, value)
    return candidate


def find_page_slug_conflict(page, slug):
    """Return the first active sibling that already owns the proposed slug."""
    if not slug:
        return None
    queryset = WebPage.objects.filter(
        parent_id=page.parent_id,
        tenant_id=page.tenant_id,
        slug=slug,
        is_deleted=False,
    )
    if page.pk:
        queryset = queryset.exclude(pk=page.pk)
    return queryset.order_by("pk").first()


class WorkflowError(ValueError):
    """A workflow invariant prevented the requested operation."""

    code = "workflow_error"

    def __init__(self, message, *, details=None):
        super().__init__(message)
        self.details = details or {}


class VersionNotEditableError(WorkflowError):
    code = "version_not_editable"


class ScheduleConflictError(WorkflowError):
    code = "schedule_conflict"


class VersionConflictError(WorkflowError):
    code = "version_conflict"


class PageAttributeConflictError(VersionConflictError):
    code = "page_attribute_conflict"


class SlugConflictError(PageAttributeConflictError):
    code = "slug_conflict"


@dataclass(frozen=True)
class WorkflowSnapshot:
    page: WebPage
    editable_version: PageVersion | None
    live_version: PageVersion | None
    scheduled_version: PageVersion | None
    state: str
    has_unpublished_changes: bool
    legacy_draft_count: int
    additional_scheduled_count: int


class PageVersionWorkflowService:
    """Single source of truth for the page author's version workflow."""

    COPY_FIELDS = (
        "meta_title",
        "meta_description",
        "code_layout",
        "page_data",
        "widgets",
        "theme",
        "page_css_variables",
        "page_custom_css",
        "enable_css_injection",
        "tags",
    )
    SCHEDULE_PREDECESSOR_KEY = "scheduled_predecessor"

    def __init__(self, page, user=None, now=None):
        self.page = page
        self.user = user
        self.now = now or timezone.now()

    def _versions(self, *, lock=False):
        queryset = self.page.versions.select_related("created_by")
        return queryset.select_for_update() if lock else queryset

    def editable_versions(self, *, lock=False):
        return self._versions(lock=lock).filter(Q(effective_date__isnull=True) | Q(effective_date__gt=self.now))

    def canonical_editable_version(self, *, lock=False):
        return self.editable_versions(lock=lock).order_by("-version_number").first()

    def live_version(self, *, lock=False):
        return (
            self._versions(lock=lock)
            .filter(effective_date__lte=self.now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=self.now))
            .order_by("-effective_date", "-version_number")
            .first()
        )

    def scheduled_versions(self, *, lock=False):
        return (
            self._versions(lock=lock).filter(effective_date__gt=self.now).order_by("effective_date", "-version_number")
        )

    @classmethod
    def snapshot_from_versions(cls, page, versions, *, now=None):
        """Apply the canonical state rules to an already loaded collection."""
        snapshot_time = now or timezone.now()
        versions = list(versions)
        editable_versions = sorted(
            (
                version
                for version in versions
                if version.effective_date is None or version.effective_date > snapshot_time
            ),
            key=lambda version: version.version_number,
            reverse=True,
        )
        live_versions = sorted(
            (
                version
                for version in versions
                if version.effective_date
                and version.effective_date <= snapshot_time
                and (version.expiry_date is None or version.expiry_date > snapshot_time)
            ),
            key=lambda version: (version.effective_date, version.version_number),
            reverse=True,
        )
        scheduled_versions = sorted(
            (version for version in versions if version.effective_date and version.effective_date > snapshot_time),
            key=lambda version: (version.effective_date, -version.version_number),
        )
        editable = editable_versions[0] if editable_versions else None
        live = live_versions[0] if live_versions else None
        scheduled = scheduled_versions[0] if scheduled_versions else None
        legacy_draft_count = len(
            [
                version
                for version in versions
                if version.effective_date is None and (not editable or version.id != editable.id)
            ]
        )
        additional_scheduled_count = max(len(scheduled_versions) - 1, 0)
        has_unpublished_changes = editable is not None

        if live and scheduled:
            state = "live_with_scheduled_changes"
        elif live and editable:
            state = "live_with_unpublished_changes"
        elif live:
            state = "live"
        elif scheduled:
            state = "scheduled"
        elif editable:
            state = "not_published"
        elif any(version.expiry_date and version.expiry_date <= snapshot_time for version in versions):
            state = "publication_ended"
        else:
            state = "not_published"

        return WorkflowSnapshot(
            page=page,
            editable_version=editable,
            live_version=live,
            scheduled_version=scheduled,
            state=state,
            has_unpublished_changes=has_unpublished_changes,
            legacy_draft_count=legacy_draft_count,
            additional_scheduled_count=additional_scheduled_count,
        )

    def snapshot(self):
        return self.snapshot_from_versions(
            self.page,
            self._versions(),
            now=self.now,
        )

    def is_canonical_editable(self, version):
        editable = self.canonical_editable_version()
        return bool(editable and editable.id == version.id)

    def assert_canonical_editable(self, version):
        editable = self.canonical_editable_version(lock=True)
        if not editable or editable.id != version.id:
            raise VersionNotEditableError(
                "Only the current working version can be changed.",
                details={
                    "requested_version_id": version.id,
                    "editable_version_id": editable.id if editable else None,
                },
            )
        return editable

    @staticmethod
    def lock_hostname_namespace():
        """Lock the global root-page namespace before locking a publication target."""
        list(
            WebPage.objects.select_for_update()
            .filter(parent__isnull=True, is_deleted=False)
            .order_by("pk")
            .values_list("pk", flat=True)
        )

    @staticmethod
    def _normalized_page_data(page_data):
        """Move legacy delayed page attributes into the canonical namespace."""
        normalized = deepcopy(page_data) if isinstance(page_data, dict) else {}
        legacy_attributes = normalized.pop("pageAttributes", {})
        attributes = normalized.pop("page_attributes", legacy_attributes)
        attributes = deepcopy(attributes) if isinstance(attributes, dict) else {}
        for field in ("title", "description"):
            if field in normalized:
                attributes.setdefault(field, normalized.pop(field))
        if attributes:
            normalized["page_attributes"] = attributes
        return normalized

    @classmethod
    def _copied_fields(cls, source):
        values = {}
        for field in cls.COPY_FIELDS:
            value = getattr(source, field)
            values[field] = value if field == "theme" else deepcopy(value)
        values["page_data"] = cls._normalized_page_data(values["page_data"])
        return values

    def _create_version_from(self, source=None, *, title="Working copy"):
        latest = self._versions(lock=True).order_by("-version_number").first()
        values = (
            self._copied_fields(source)
            if source
            else {
                "page_data": {
                    "page_attributes": {
                        "title": self.page.title,
                        "description": self.page.description or "",
                    },
                },
                "widgets": {},
            }
        )
        return PageVersion.objects.create(
            page=self.page,
            version_number=(latest.version_number + 1) if latest else 1,
            version_title=title,
            change_summary={"action": "working_copy_created"},
            created_by=self.user,
            **values,
        )

    @transaction.atomic
    def get_or_create_working_copy(self):
        self.page = WebPage.objects.select_for_update().get(pk=self.page.pk)
        editable = self.canonical_editable_version(lock=True)
        if editable:
            return editable, False
        source = self.live_version(lock=True) or self._versions(lock=True).order_by("-version_number").first()
        return self._create_version_from(source), True

    @staticmethod
    def _page_attributes(version):
        page_data = version.page_data if isinstance(version.page_data, dict) else {}
        attributes = page_data.get("page_attributes", page_data.get("pageAttributes", {}))
        return attributes if isinstance(attributes, dict) else {}

    def assert_page_attributes_publishable(self, version, *, lock_namespace=False):
        """Revalidate delayed page attributes against current public state."""
        attributes = self._page_attributes(version)
        if not attributes:
            return

        if lock_namespace and "hostnames" in attributes:
            # Hostnames form one global routing namespace. Lock the current root
            # set so concurrent workflow publications serialize their checks.
            list(
                WebPage.objects.select_for_update()
                .filter(parent__isnull=True, is_deleted=False)
                .order_by("pk")
                .values_list("pk", flat=True)
            )
        elif lock_namespace and "slug" in attributes:
            if self.page.parent_id:
                WebPage.objects.select_for_update().only("pk").get(pk=self.page.parent_id)
            else:
                tenant_model = self.page._meta.get_field("tenant").remote_field.model
                tenant_model.objects.select_for_update().only("pk").get(pk=self.page.tenant_id)

        if "slug" in attributes:
            conflict = find_page_slug_conflict(self.page, attributes["slug"])
            if conflict:
                raise SlugConflictError(
                    "The requested public slug is already used by a sibling page.",
                    details={"slug": attributes["slug"]},
                )

        try:
            page_with_attributes(self.page, attributes).clean()
        except DjangoValidationError as error:
            details = getattr(error, "message_dict", None) or error.messages
            raise PageAttributeConflictError(
                "The requested page attributes are no longer publishable.",
                details={"page_attributes": details},
            ) from error

    @transaction.atomic
    def publish(self, version, *, expected_updated_at=None):
        self.lock_hostname_namespace()
        self.page = WebPage.objects.select_for_update().get(pk=self.page.pk)
        version = PageVersion.objects.select_for_update().get(pk=version.pk)
        self.assert_canonical_editable(version)
        if expected_updated_at and version.updated_at != expected_updated_at:
            raise VersionConflictError(
                "The reviewed working version has changed.",
                details={"server_updated_at": version.updated_at.isoformat()},
            )
        self.assert_page_attributes_publishable(version, lock_namespace=True)
        now = timezone.now()
        previous_live = self.live_version(lock=True)
        if previous_live and previous_live.id != version.id:
            previous_live.expiry_date = now
            previous_live.save(update_fields=["expiry_date", "updated_at"])
        version.effective_date = now
        version.expiry_date = None
        version.save(update_fields=["effective_date", "expiry_date", "updated_at"])
        self.page.refresh_from_db()
        version.page = self.page
        version._apply_version_data()
        self.page.last_modified_by = self.user
        self.page.save()
        return version

    def _restore_scheduled_predecessor(self, version):
        summary = normalize_change_summary(version.change_summary)
        predecessor = summary.pop(self.SCHEDULE_PREDECESSOR_KEY, None)
        if not predecessor:
            return summary

        previous = self._versions(lock=True).filter(pk=predecessor.get("version_id")).first()
        if previous and previous.expiry_date == version.effective_date:
            original_expiry = predecessor.get("original_expiry_date")
            previous.expiry_date = parse_datetime(original_expiry) if original_expiry else None
            previous.save(update_fields=["expiry_date", "updated_at"])
        return summary

    @transaction.atomic
    def schedule(self, version, effective_date, expiry_date=None, *, expected_updated_at=None):
        self.lock_hostname_namespace()
        self.page = WebPage.objects.select_for_update().get(pk=self.page.pk)
        version = PageVersion.objects.select_for_update().get(pk=version.pk)
        self.assert_canonical_editable(version)
        if expected_updated_at and version.updated_at != expected_updated_at:
            raise VersionConflictError(
                "The reviewed working version has changed.",
                details={"server_updated_at": version.updated_at.isoformat()},
            )
        self.assert_page_attributes_publishable(version, lock_namespace=True)
        now = timezone.now()
        if effective_date <= now:
            raise WorkflowError("Scheduled publication must be in the future.")
        conflicts = self.scheduled_versions(lock=True).exclude(pk=version.pk)
        if conflicts.exists():
            raise ScheduleConflictError(
                "This page already has another scheduled version.",
                details={"scheduled_version_ids": list(conflicts.values_list("id", flat=True))},
            )
        if expiry_date and expiry_date <= effective_date:
            raise WorkflowError("Expiry must be later than the scheduled publication.")
        summary = self._restore_scheduled_predecessor(version)
        previous_live = self.live_version(lock=True)
        if (
            previous_live
            and previous_live.id != version.id
            and (previous_live.expiry_date is None or previous_live.expiry_date > effective_date)
        ):
            summary[self.SCHEDULE_PREDECESSOR_KEY] = {
                "version_id": previous_live.id,
                "original_expiry_date": (previous_live.expiry_date.isoformat() if previous_live.expiry_date else None),
            }
            previous_live.expiry_date = effective_date
            previous_live.save(update_fields=["expiry_date", "updated_at"])
        version.effective_date = effective_date
        version.expiry_date = expiry_date
        version.change_summary = summary
        version.save(update_fields=["effective_date", "expiry_date", "change_summary", "updated_at"])
        return version

    @transaction.atomic
    def cancel_schedule(self, version):
        self.page = WebPage.objects.select_for_update().get(pk=self.page.pk)
        version = PageVersion.objects.select_for_update().get(pk=version.pk)
        if not version.effective_date or version.effective_date <= timezone.now():
            raise WorkflowError("The requested version is not scheduled.")
        version.change_summary = self._restore_scheduled_predecessor(version)
        version.effective_date = None
        version.expiry_date = None
        version.save(update_fields=["effective_date", "expiry_date", "change_summary", "updated_at"])
        return version

    @transaction.atomic
    def fail_scheduled_activation(self, version, *, reason):
        """Return a rejected scheduled publication to a safe working copy."""
        self.page = WebPage.objects.select_for_update().get(pk=self.page.pk)
        version = PageVersion.objects.select_for_update().get(pk=version.pk, page=self.page)
        summary = self._restore_scheduled_predecessor(version)
        summary["scheduled_activation_failure"] = {
            "reason": str(reason),
            "failed_at": timezone.now().isoformat(),
        }
        version.change_summary = summary
        version.effective_date = None
        version.expiry_date = None
        version.save(update_fields=["effective_date", "expiry_date", "change_summary", "updated_at"])
        return version

    @transaction.atomic
    def unpublish(self, version):
        self.page = WebPage.objects.select_for_update().get(pk=self.page.pk)
        version = PageVersion.objects.select_for_update().get(pk=version.pk)
        live = self.live_version(lock=True)
        if not live or live.id != version.id:
            raise WorkflowError(
                "Only the current live version can be unpublished.",
                details={"live_version_id": live.id if live else None},
            )
        version.expiry_date = timezone.now()
        version.save(update_fields=["expiry_date", "updated_at"])
        return version

    @transaction.atomic
    def restore_as_working_copy(self, source, *, expected_updated_at=None):
        self.page = WebPage.objects.select_for_update().get(pk=self.page.pk)
        source = PageVersion.objects.select_for_update().get(pk=source.pk, page=self.page)
        editable = self.canonical_editable_version(lock=True)
        if not editable:
            return self._create_version_from(source, title=f"Restored from version {source.version_number}")
        if expected_updated_at is None or editable.updated_at != expected_updated_at:
            raise VersionConflictError(
                "The working version has changed since it was reviewed.",
                details={"server_updated_at": editable.updated_at.isoformat()},
            )
        if editable.id == source.id:
            return editable
        for field, value in self._copied_fields(source).items():
            setattr(editable, field, value)
        editable.version_title = f"Restored from version {source.version_number}"
        summary = {
            "action": "restored",
            "source_version_id": source.id,
        }
        predecessor = normalize_change_summary(editable.change_summary).get(self.SCHEDULE_PREDECESSOR_KEY)
        if predecessor:
            summary[self.SCHEDULE_PREDECESSOR_KEY] = deepcopy(predecessor)
        editable.change_summary = summary
        editable.save()
        return editable


def version_summary(version):
    if not version:
        return None
    return {
        "id": version.id,
        "version_number": version.version_number,
        "version_title": version.version_title,
        "publication_status": version.get_publication_status(),
        "effective_date": version.effective_date,
        "expiry_date": version.expiry_date,
        "created_at": version.created_at,
        "updated_at": version.updated_at,
    }


def workflow_payload(page):
    snapshot = PageVersionWorkflowService(page).snapshot()
    return {
        "page_id": page.id,
        "state": snapshot.state,
        "editable_version": version_summary(snapshot.editable_version),
        "live_version": version_summary(snapshot.live_version),
        "scheduled_version": version_summary(snapshot.scheduled_version),
        "has_unpublished_changes": snapshot.has_unpublished_changes,
        "scheduled_at": (snapshot.scheduled_version.effective_date if snapshot.scheduled_version else None),
        "legacy_conflicts": {
            "older_draft_count": snapshot.legacy_draft_count,
            "additional_scheduled_count": snapshot.additional_scheduled_count,
        },
    }
