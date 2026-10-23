import pytest
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from file_manager.models import PendingMediaFile
from taxonomy.assignments import classification_ids, replace_assignments
from taxonomy.context import actor_context
from taxonomy.models import ClassificationRollout
from taxonomy.rollout import reconciliation_report
from taxonomy.services import mutate

from .test_governance import create

pytestmark = pytest.mark.django_db


def test_native_collection_creation_needs_taxonomy_not_legacy_tags(scope):
    owner, member, _, definition = scope
    term = create(owner, definition, "Collection")
    client = APIClient()
    client.force_authenticate(member)
    headers = {"HTTP_X_TENANT_ID": str(definition.tenant_id)}
    response = client.post(
        "/api/v1/media/collections/",
        {"title": "Native", "namespace": definition.namespace.slug, "classification_ids": [str(term.pk)]},
        format="json",
        **headers,
    )
    assert response.status_code == 201, response.data
    assert response.data["classification_ids"] == [str(term.pk)]
    response = client.post(
        "/api/v1/media/collections/",
        {"title": "Empty", "namespace": definition.namespace.slug},
        format="json",
        **headers,
    )
    assert response.status_code == 400


def test_legacy_and_canonical_writes_are_one_assignment(scope, resources):
    owner, member, _, definition = scope
    one, two = create(owner, definition, "One"), create(owner, definition, "Two")
    media = resources[2]
    replace_assignments(media, [str(one.pk)], member)
    assert media.tags.count() == 1
    with actor_context(member):
        from taxonomy.context import projection_context
        from taxonomy.projections import media_alias

        with projection_context():
            alias = media_alias(two, owner)
        media.tags.add(alias)
    assert set(classification_ids(media)) == {str(one.pk), str(two.pk)}
    assert set(media.canonical_tags.values_list("pk", flat=True)) == {one.pk, two.pk}


def test_pending_approval_without_tags_fails_before_creating_file(scope):
    owner, member, _, definition = scope
    from datetime import timedelta

    from django.utils import timezone

    pending = PendingMediaFile.objects.create(
        expires_at=timezone.now() + timedelta(days=1),
        namespace=definition.namespace,
        uploaded_by=member,
        original_filename="required.txt",
        file_path="test/required.txt",
        file_size=1,
        content_type="text/plain",
        file_type="document",
        file_hash="d" * 64,
    )
    with pytest.raises(ValidationError):
        pending.approve_and_create_media_file(title="Required", user=member)
    pending.refresh_from_db()
    assert pending.status == "pending"


def test_readiness_reports_unclassified_media_without_defaulting(scope, resources):
    _, _, _, definition = scope
    report = reconciliation_report(definition.namespace)
    assert not report["ready"]
    assert {error["error"] for error in report["errors"]} == {"missing_required_classification"}


@pytest.mark.django_db(transaction=True)
def test_database_rejects_bypassed_mandatory_assignment_after_activation(scope, resources):
    owner, _, _, definition = scope
    term = create(owner, definition, "Required")
    for resource in resources[2:]:
        replace_assignments(resource, [str(term.pk)], owner)
    ClassificationRollout.objects.create(namespace=definition.namespace, phase="canonical")
    assert reconciliation_report(definition.namespace)["ready"]
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            resources[2].classification_links.all().delete()
    assert classification_ids(resources[2]) == [str(term.pk)]


def test_reconciliation_canary_resume_verify_and_guarded_activation(scope, resources):
    from io import StringIO

    from django.core.management import call_command

    from taxonomy.models import TagBackfillRun
    from taxonomy.rollout import activate

    owner, member, _, definition = scope
    term = create(owner, definition, "Canary")
    for resource in resources[2:]:
        replace_assignments(resource, [str(term.pk)], owner)
    output = StringIO()
    call_command("reconcile_classifications", run_id="required-media-canary", stop_after=1, stdout=output)
    assert TagBackfillRun.objects.get(pk="required-media-canary").status == "interrupted"
    call_command("reconcile_classifications", run_id="required-media-canary", stdout=output)
    call_command("reconcile_classifications", run_id="required-media-canary", verify_only=True, stdout=output)
    from rest_framework.exceptions import PermissionDenied

    with pytest.raises(PermissionDenied):
        activate(definition.namespace, member, "required-media-canary")
    assert activate(definition.namespace, owner, "required-media-canary")["ready"]
    assert ClassificationRollout.objects.get(namespace=definition.namespace).phase == "canonical"


@pytest.mark.django_db(transaction=True)
def test_database_rechecks_taxonomy_metadata_and_refuses_invalid_activation(scope, resources):
    from taxonomy.models import Tag

    owner, _, _, definition = scope
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ClassificationRollout.objects.create(namespace=definition.namespace, phase="canonical")
    assert not ClassificationRollout.objects.filter(namespace=definition.namespace).exists()
    term = create(owner, definition, "Guarded")
    for resource in resources[2:]:
        replace_assignments(resource, [str(term.pk)], owner)
    ClassificationRollout.objects.create(namespace=definition.namespace, phase="canonical")
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Tag.objects.filter(pk=term.pk).update(status="proposed")
    term.refresh_from_db()
    assert term.status == "approved"


def test_collection_inherits_approved_terms_without_archived_suggestions(scope, resources):
    from taxonomy.assignments import collection_upload_ids
    from taxonomy.services import mutate

    owner, member, _, definition = scope
    active, historical = create(owner, definition, "Active"), create(owner, definition, "Historical")
    collection = resources[3]
    replace_assignments(collection, [str(active.pk), str(historical.pk)], owner)
    mutate(owner, definition, "archive", term=historical, revision=historical.revision)
    assert collection_upload_ids(collection, member) == [str(active.pk)]
    assert classification_ids(collection) == [str(active.pk), str(historical.pk)]


def test_transfer_preserves_hierarchy_aliases_archived_status_and_order(scope, resources):
    from types import SimpleNamespace

    from content.models import Namespace
    from file_manager.models import MediaCollection
    from taxonomy.assignments import links_for
    from taxonomy.services import mutate
    from taxonomy.transfer import assignment_payload_matches, export_assignments, finish_transfer, import_assignments

    owner, _, _, definition = scope
    parent = create(owner, definition, "Parent")
    child = create(owner, definition, "Child", parent_id=str(parent.pk), alternative_names=["Synonym"])
    replace_assignments(resources[3], [str(child.pk), str(parent.pk)], owner)
    mutate(owner, definition, "archive", term=child, revision=child.revision)
    payload = export_assignments(resources[3])
    destination = Namespace.objects.create(
        tenant=definition.tenant, name="Destination", slug="destination", created_by=owner
    )
    collection = MediaCollection.objects.create(
        namespace=destination, title="Imported", created_by=owner, last_modified_by=owner
    )
    importer = SimpleNamespace(job=SimpleNamespace(created_by=owner))
    import_assignments(importer, collection, payload, destination)
    finish_transfer(importer)
    terms = [link.tag for link in links_for(collection)]
    assert [term.name for term in terms] == ["Child", "Parent"]
    assert terms[0].parent_id == terms[1].pk
    assert terms[0].alternative_names == ["Synonym"]
    assert terms[0].status == "archived"
    assert all(term.namespace_id == destination.pk for term in terms)
    # Reusing a matching version must not temporarily reactivate its archived terms.
    revision = terms[0].revision
    assert assignment_payload_matches(collection, payload, destination, owner)
    terms[0].refresh_from_db()
    assert terms[0].status == "archived"
    assert terms[0].revision == revision


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("resource_index", [2, 3])
def test_database_rejects_new_disallowed_links_but_keeps_history(scope, resources, resource_index):
    from taxonomy.assignments import restore_assignment_snapshot

    owner, _, _, definition = scope
    first, second = create(owner, definition, "First"), create(owner, definition, "Second")
    for resource in resources[2:]:
        replace_assignments(resource, [str(first.pk), str(second.pk)], owner)
    ClassificationRollout.objects.create(namespace=definition.namespace, phase="canonical")
    definition.allowed_uses = ["pages"]
    definition.save(update_fields=["allowed_uses"])
    resource = resources[resource_index]
    rows = set(resource.classification_links.values_list("pk", flat=True))
    replace_assignments(resource, [str(second.pk), str(first.pk)], owner)
    assert set(resource.classification_links.values_list("pk", flat=True)) == rows
    assert classification_ids(resource) == [str(second.pk), str(first.pk)]
    restore_assignment_snapshot(resource, [str(first.pk), str(second.pk)], owner)
    assert set(resource.classification_links.values_list("pk", flat=True)) == rows
    assert classification_ids(resource) == [str(first.pk), str(second.pk)]
    third = create(owner, definition, "Third")
    model = resource.classification_links.model
    owner_field = "media_file" if resource_index == 2 else "collection"
    with pytest.raises(IntegrityError, match="unavailable for this media kind"):
        with transaction.atomic():
            model.objects.create(**{owner_field: resource, "tag": third, "position": 2})


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("resource_index", [2, 3])
def test_concurrent_direct_deletes_cannot_remove_all_media_classifications(scope, resources, resource_index):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django.db import connection, connections

    owner, _, _, definition = scope
    terms = [create(owner, definition, name) for name in ("One", "Two")]
    for resource in resources[2:]:
        replace_assignments(resource, [str(term.pk) for term in terms], owner)
    ClassificationRollout.objects.create(namespace=definition.namespace, phase="canonical")
    resource = resources[resource_index]
    table = resource.classification_links.model._meta.db_table
    link_ids = list(resource.classification_links.values_list("pk", flat=True))
    deleted = Barrier(2)

    def remove(link_id):
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL lock_timeout = '5s'")
                    cursor.execute(f'DELETE FROM "{table}" WHERE id=%s', [link_id])
                    deleted.wait(timeout=5)
            return "committed"
        except IntegrityError:
            return "rejected"
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(remove, link_ids))
    assert sorted(results) == ["committed", "rejected"]
    assert resource.classification_links.count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("resource_index", [2, 3])
@pytest.mark.parametrize("redirect", [False, True])
def test_new_media_link_waits_for_concurrent_term_status(scope, resources, resource_index, redirect):
    from concurrent.futures import ThreadPoolExecutor
    from queue import Queue
    from time import monotonic, sleep

    from django.db import connection, connections

    from taxonomy.services import mutate

    owner, _, _, definition = scope
    base, source, target = [create(owner, definition, name) for name in ("Base", "Source", "Target")]
    if redirect:
        mutate(
            owner,
            definition,
            "merge",
            term=source,
            revision=source.revision,
            payload={"target_id": str(target.pk), "target_revision": target.revision},
        )
    changed_term = target if redirect else source
    for resource in resources[2:]:
        replace_assignments(resource, [str(base.pk)], owner)
    ClassificationRollout.objects.create(namespace=definition.namespace, phase="canonical")
    resource = resources[resource_index]
    table = resource.classification_links.model._meta.db_table
    owner_column = "media_file_id" if resource_index == 2 else "collection_id"
    started = Queue()

    def insert():
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL lock_timeout = '10s'")
                    cursor.execute("SELECT pg_backend_pid()")
                    started.put(cursor.fetchone()[0])
                    cursor.execute(
                        f'INSERT INTO "{table}" ("{owner_column}",tag_id,position) VALUES (%s,%s,1)',
                        [resource.pk, source.pk],
                    )
                    cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
            return "committed"
        except IntegrityError:
            return "rejected"
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=1) as workers:
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("UPDATE taxonomy_tag SET status='proposed' WHERE id=%s", [changed_term.pk])
                future = workers.submit(insert)
                writer_pid = started.get(timeout=5)
                deadline = monotonic() + 5
                blocked = False
                while monotonic() < deadline and not future.done():
                    cursor.execute("SELECT pg_backend_pid() = ANY(pg_blocking_pids(%s))", [writer_pid])
                    blocked = cursor.fetchone()[0]
                    if blocked:
                        break
                    sleep(0.01)
                assert blocked, "New link must wait for the uncommitted taxonomy change"
                cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
        assert future.result(timeout=5) == "rejected"
    assert classification_ids(resource) == [str(base.pk)]


@pytest.mark.django_db(transaction=True)
def test_taxonomy_mutation_locks_namespace_before_definition(scope):
    from concurrent.futures import ThreadPoolExecutor
    from queue import Queue
    from threading import Event
    from time import monotonic, sleep

    from django.db import connection, connections

    from content.models import Namespace
    from taxonomy.services import locked_definition

    _, _, _, definition = scope
    started = Queue()
    locked = Event()
    release = Event()

    def mutation():
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL lock_timeout = '10s'")
                    cursor.execute("SELECT pg_backend_pid()")
                    started.put(cursor.fetchone()[0])
                locked_definition(definition)
                locked.set()
                release.wait(timeout=5)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=1) as workers:
        try:
            with transaction.atomic():
                Namespace.objects.select_for_update().get(pk=definition.namespace_id)
                future = workers.submit(mutation)
                writer_pid = started.get(timeout=5)
                deadline = monotonic() + 5
                blocked = False
                with connection.cursor() as cursor:
                    while monotonic() < deadline and not locked.is_set():
                        cursor.execute("SELECT pg_backend_pid() = ANY(pg_blocking_pids(%s))", [writer_pid])
                        blocked = cursor.fetchone()[0]
                        if blocked:
                            break
                        sleep(0.01)
                    assert blocked, "Taxonomy mutation must join the namespace gate before taking its type lock"
                    # An assignment holding the namespace gate can still acquire
                    # its definition lock; the metadata writer cannot invert it.
                    type(definition).objects.select_for_update(nowait=True).get(pk=definition.pk)
        finally:
            release.set()
        future.result(timeout=5)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("resource_index", [2, 3])
def test_media_serializer_locks_namespace_before_resource(scope, resources, resource_index):
    from concurrent.futures import ThreadPoolExecutor
    from queue import Queue
    from time import monotonic, sleep
    from types import SimpleNamespace

    from django.db import connection, connections

    from content.models import Namespace
    from file_manager.serializers import MediaCollectionSerializer, MediaFileDetailSerializer

    owner, _, _, definition = scope
    term = create(owner, definition, "Preserved")
    resource = resources[resource_index]
    replace_assignments(resource, [str(term.pk)], owner)
    serializer_type = MediaFileDetailSerializer if resource_index == 2 else MediaCollectionSerializer
    started = Queue()

    def update():
        try:
            with transaction.atomic(), actor_context(owner):
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL lock_timeout = '10s'")
                    cursor.execute("SELECT pg_backend_pid()")
                    started.put(cursor.fetchone()[0])
                serializer = serializer_type(
                    resource,
                    data={"title": "Updated", "classification_ids": [str(term.pk)]},
                    partial=True,
                    context={"request": SimpleNamespace(user=owner)},
                )
                assert serializer.is_valid(), serializer.errors
                serializer.save()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=1) as workers:
        with transaction.atomic():
            Namespace.objects.select_for_update().get(pk=definition.namespace_id)
            future = workers.submit(update)
            writer_pid = started.get(timeout=5)
            deadline = monotonic() + 5
            blocked = False
            with connection.cursor() as cursor:
                while monotonic() < deadline and not future.done():
                    cursor.execute("SELECT pg_backend_pid() = ANY(pg_blocking_pids(%s))", [writer_pid])
                    blocked = cursor.fetchone()[0]
                    if blocked:
                        break
                    sleep(0.01)
                assert blocked
            type(resource)._base_manager.select_for_update(nowait=True).get(pk=resource.pk)
        future.result(timeout=5)
    resource.refresh_from_db()
    assert resource.title == "Updated"
    assert classification_ids(resource) == [str(term.pk)]


def test_reconciliation_preflight_refuses_unmigrated_legacy_tags(scope):
    from django.core.management import call_command
    from django.core.management.base import CommandError

    from file_manager.models import MediaTag

    owner, _, _, definition = scope
    MediaTag.objects.create(namespace=definition.namespace, name="Unmigrated", slug="unmigrated", created_by=owner)
    with pytest.raises(CommandError, match="backfill_typed_tags first"):
        call_command("reconcile_classifications", preflight_only=True)


def test_legacy_page_save_preserves_identity_after_a_canonical_rename(scope, resources):
    from taxonomy.services import mutate

    owner, member, _, definition = scope
    term = create(owner, definition, "Original name")
    version = resources[0]
    replace_assignments(version, [str(term.pk)], member)
    mutate(owner, definition, "edit", term=term, revision=term.revision, payload={"name": "Renamed"})
    from taxonomy.transfer import export_assignments

    exported = export_assignments(version)
    assert [item["source_id"] for item in exported] == [str(term.pk)]
    assert [item["name"] for item in exported] == ["Renamed"]
    with actor_context(member):
        version.save()
    assert classification_ids(version) == [str(term.pk)]
    from taxonomy.models import Tag

    assert Tag.objects.filter(namespace=definition.namespace, tag_type="general").count() == 1


@pytest.mark.parametrize("source_status", ["archived", "merged"])
def test_transfer_does_not_change_unmapped_destination_term_status(scope, source_status):
    from content.models import Namespace
    from taxonomy.models import ClassificationType, LegacyTagMapping
    from taxonomy.services import mutate
    from taxonomy.transfer import export_term, import_term

    owner, _, _, definition = scope
    source = create(owner, definition, "Collision")
    if source_status == "archived":
        mutate(owner, definition, "archive", term=source, revision=source.revision)
    else:
        target = create(owner, definition, "Target")
        mutate(
            owner,
            definition,
            "merge",
            term=source,
            revision=source.revision,
            payload={"target_id": str(target.pk), "target_revision": target.revision},
        )
    source.refresh_from_db()
    namespace = Namespace.objects.create(tenant=definition.tenant, name="Destination", slug="dest", created_by=owner)
    destination_type = ClassificationType.objects.create(
        namespace=namespace, tenant=definition.tenant, key="general", name="General", allowed_uses=["pages"]
    )
    destination_term = create(owner, destination_type, "Collision")
    revision = destination_term.revision
    with pytest.raises(ValidationError, match="conflicts with the transferred identity"):
        import_term(export_term(source), namespace, owner)
    destination_term.refresh_from_db()
    assert destination_term.status == "approved"
    assert destination_term.revision == revision
    assert not LegacyTagMapping.objects.filter(source_kind="transfer", canonical_tag__namespace=namespace).exists()


def pending_upload(namespace, user, file_hash):
    from datetime import timedelta

    from django.utils import timezone

    return PendingMediaFile.objects.create(
        expires_at=timezone.now() + timedelta(days=1),
        namespace=namespace,
        uploaded_by=user,
        original_filename="pending.txt",
        file_path="test/pending.txt",
        file_size=1,
        content_type="text/plain",
        file_type="document",
        file_hash=file_hash,
    )


@pytest.mark.parametrize("duplicate", [False, True])
@pytest.mark.parametrize("collection_case", ["allowed", "disallowed", "missing"])
def test_approval_and_requested_collection_are_atomic(scope, resources, duplicate, collection_case):
    from unittest.mock import patch

    from file_manager.models import MediaCollection, MediaFile

    owner, _, _, definition = scope
    if collection_case == "disallowed":
        definition.allowed_uses = ["media_files"]
        definition.save(update_fields=["allowed_uses"])
    term = create(owner, definition, "Approval")
    original = create(owner, definition, "Original")
    replace_assignments(resources[2], [str(original.pk)], owner)
    pending = pending_upload(definition.namespace, owner, resources[2].file_hash if duplicate else "e" * 64)
    client = APIClient()
    client.force_authenticate(owner)
    collection_payload = (
        {"collection_id": "c8046e26-6627-41b1-a9fa-3b5d270d78ee"}
        if collection_case == "missing"
        else {"collection_name": "Requested collection"}
    )
    with patch.object(
        PendingMediaFile,
        "approve_and_create_media_file",
        autospec=True,
        side_effect=PendingMediaFile.approve_and_create_media_file,
    ) as approve:
        response = client.post(
            f"/api/v1/media/pending-files/{pending.pk}/approve/",
            {"title": "Approval", "classification_ids": [str(term.pk)], **collection_payload},
            format="json",
            HTTP_X_TENANT_ID=str(definition.tenant_id),
        )
        if collection_case != "allowed":
            approve.assert_not_called()
    pending.refresh_from_db()
    if collection_case == "allowed":
        assert response.status_code == (200 if duplicate else 201), response.data
        assert pending.status == "approved"
        approved = MediaFile.objects.get(pk=response.data["media_file"]["id"])
        collection = approved.collections.get(title="Requested collection")
        assert str(term.pk) in classification_ids(collection)
    else:
        assert response.status_code == 400, response.data
        assert pending.status == "pending"
        assert MediaFile.objects.count() == 1
        assert not MediaCollection.objects.filter(title="Requested collection").exists()
        assert classification_ids(resources[2]) == [str(original.pk)]


@pytest.mark.parametrize("case", ["owner", "member", "private", "archived"])
def test_duplicate_approval_merges_classifications_with_access_gate(scope, resources, case):
    from taxonomy.services import mutate

    owner, member, _, definition = scope
    first, second = create(owner, definition, "Existing"), create(owner, definition, "Added")
    existing = resources[2]
    replace_assignments(existing, [str(first.pk)], owner)
    if case == "archived":
        mutate(owner, definition, "archive", term=first, revision=first.revision)
    if case == "private":
        existing.access_level = "private"
        existing.save(update_fields=["access_level"])
    actor = owner if case in {"owner", "archived"} else member
    pending = pending_upload(definition.namespace, actor, existing.file_hash)
    client = APIClient()
    client.force_authenticate(actor)
    response = client.post(
        f"/api/v1/media/pending-files/{pending.pk}/approve/",
        {"classification_ids": [str(second.pk)]},
        format="json",
        HTTP_X_TENANT_ID=str(definition.tenant_id),
    )
    pending.refresh_from_db()
    if case == "private":
        assert response.status_code == 403, response.data
        assert pending.status == "pending"
        assert classification_ids(existing) == [str(first.pk)]
    else:
        assert response.status_code == 200, response.data
        assert pending.status == "approved"
        assert classification_ids(existing) == [str(first.pk), str(second.pk)]


def test_legacy_removal_follows_merge_redirect_and_retains_required_tag(scope, resources):
    from taxonomy.projections import media_alias
    from taxonomy.services import mutate

    owner, member, _, definition = scope
    source = create(owner, definition, "Old media term")
    target = create(owner, definition, "Replacement")
    retained = create(owner, definition, "Retained")
    media = resources[2]
    replace_assignments(media, [str(source.pk), str(retained.pk)], owner)
    alias = media_alias(source, owner)
    mutate(
        owner,
        definition,
        "merge",
        term=source,
        revision=source.revision,
        payload={"target_id": str(target.pk), "target_revision": target.revision},
    )
    client = APIClient()
    client.force_authenticate(member)
    response = client.post(
        f"/api/v1/media/files/{media.pk}/remove_tags/",
        {"tag_ids": [str(alias.pk)]},
        format="json",
        HTTP_X_TENANT_ID=str(definition.tenant_id),
    )
    assert response.status_code == 200, response.data
    assert classification_ids(media) == [str(retained.pk)]


@pytest.mark.django_db(transaction=True)
def test_upgrade_from_merged_main_preserves_classified_media(scope, resources):
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    owner, _, _, definition = scope
    term = create(owner, definition, "Upgrade classification")
    for resource in resources[2:]:
        replace_assignments(resource, [str(term.pk)], owner)
    ClassificationRollout.objects.create(namespace=definition.namespace, phase="canonical")
    targets = MigrationExecutor(connection).loader.graph.leaf_nodes()
    previous_targets = [
        (app, "0006_restrict_media_function_execute" if app == "taxonomy" else name) for app, name in targets
    ]
    try:
        MigrationExecutor(connection).migrate(previous_targets)
        assert classification_ids(resources[2]) == [str(term.pk)]
        MigrationExecutor(connection).migrate(targets)
        for resource in resources[2:]:
            assert classification_ids(resource) == [str(term.pk)]
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                resources[2].classification_links.all().delete()
        assert classification_ids(resources[2]) == [str(term.pk)]
    finally:
        MigrationExecutor(connection).migrate(targets)


@pytest.mark.parametrize("resource_index", [0, 1, 2, 3])
def test_transfer_preserves_destination_classifications_only_on_shared_media(scope, resources, resource_index):
    from types import SimpleNamespace

    from taxonomy.transfer import export_term, import_assignments

    owner, _, _, definition = scope
    local = create(owner, definition, "Local editorial selection")
    incoming = create(owner, definition, "Imported selection")
    resource = resources[resource_index]
    replace_assignments(resource, [str(local.pk)], owner)
    importer = SimpleNamespace(job=SimpleNamespace(created_by=owner))
    import_assignments(importer, resource, [export_term(incoming)], definition.namespace)
    expected = [str(local.pk), str(incoming.pk)] if resource_index in [2, 3] else [str(incoming.pk)]
    assert classification_ids(resource) == expected


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("resource_index", [2, 3])
@pytest.mark.parametrize("redirect", [False, True])
def test_direct_new_media_links_reject_archived_terms(scope, resources, resource_index, redirect):
    from taxonomy.assignments import assignment_context

    owner, _, _, definition = scope
    active = create(owner, definition, "Existing active")
    archived = create(owner, definition, "Archived candidate")
    candidate = archived
    if redirect:
        candidate = create(owner, definition, "Redirect source")
        mutate(
            owner,
            definition,
            "merge",
            term=candidate,
            revision=candidate.revision,
            payload={"target_id": str(archived.pk), "target_revision": archived.revision},
        )
        archived.refresh_from_db()
    mutate(owner, definition, "archive", term=archived, revision=archived.revision)
    for resource in resources[2:]:
        replace_assignments(resource, [str(active.pk)], owner)
    ClassificationRollout.objects.create(namespace=definition.namespace, phase="canonical")
    resource = resources[resource_index]
    model, field, *_ = assignment_context(resource)
    with pytest.raises(IntegrityError, match="approved taxonomy term"):
        with transaction.atomic():
            model.objects.bulk_create([model(**{field: resource, "tag": candidate, "position": 1})])
    assert classification_ids(resource) == [str(active.pk)]


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("resource_index", [2, 3])
def test_permission_checked_snapshot_restore_can_recreate_archived_media_links(scope, resources, resource_index):
    from django.db import connection
    from rest_framework.exceptions import PermissionDenied

    from taxonomy.assignments import restore_assignment_snapshot

    owner, member, _, definition = scope
    historical = create(owner, definition, "Historical")
    replacement = create(owner, definition, "Replacement")
    for resource in resources[2:]:
        replace_assignments(resource, [str(historical.pk)], owner)
    mutate(owner, definition, "archive", term=historical, revision=historical.revision)
    ClassificationRollout.objects.create(namespace=definition.namespace, phase="canonical")
    resource = resources[resource_index]
    replace_assignments(resource, [str(replacement.pk)], owner)
    with pytest.raises(PermissionDenied):
        restore_assignment_snapshot(resource, [str(historical.pk)], member)
    assert classification_ids(resource) == [str(replacement.pk)]
    restore_assignment_snapshot(resource, [str(historical.pk)], owner)
    assert classification_ids(resource) == [str(historical.pk)]
    historical.refresh_from_db()
    assert historical.status == "archived"
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_setting('eceee.classification_restore', true)")
        assert not cursor.fetchone()[0]


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("resource_index", [2, 3])
def test_media_transfer_preserves_a_concurrent_destination_selection(scope, resources, resource_index):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from types import SimpleNamespace
    from unittest.mock import patch

    from django.db import close_old_connections

    from content.models import Namespace
    from taxonomy.transfer import export_term, import_assignments, import_term

    owner, _, _, definition = scope
    original = create(owner, definition, "Original")
    concurrent = create(owner, definition, "Concurrent")
    incoming = create(owner, definition, "Incoming")
    resource = resources[resource_index]
    replace_assignments(resource, [str(original.pk)], owner)
    payload = export_term(incoming)
    import_term(payload, definition.namespace, owner)
    started, read = Event(), Event()
    real_classification_ids = classification_ids

    def observe_read(instance):
        read.set()
        return real_classification_ids(instance)

    def import_in_other_connection():
        close_old_connections()
        try:
            importer = SimpleNamespace(job=SimpleNamespace(created_by=owner))
            started.set()
            with patch("taxonomy.assignments.classification_ids", side_effect=observe_read):
                import_assignments(importer, resource, [payload], definition.namespace)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as workers:
        with transaction.atomic():
            Namespace.objects.select_for_update().get(pk=definition.namespace_id)
            future = workers.submit(import_in_other_connection)
            assert started.wait(5)
            # An old pre-lock union would read the stale [original] here.
            read.wait(0.25)
            replace_assignments(resource, [str(original.pk), str(concurrent.pk)], owner)
        future.result(timeout=10)
    assert classification_ids(resource) == [str(original.pk), str(concurrent.pk), str(incoming.pk)]
