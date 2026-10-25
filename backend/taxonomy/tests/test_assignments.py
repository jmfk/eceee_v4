import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.exceptions import ValidationError

from file_manager.models import MediaCollection, MediaFile
from object_storage.models import ObjectInstance, ObjectTypeDefinition
from object_storage.services.version_workflow import ObjectVersionWorkflow
from taxonomy.assignments import assert_publishable, classification_ids, replace_assignments
from taxonomy.models import LegacyTagMapping, MediaFileClassification, Tag, TagBackfillRun
from taxonomy.services import change_type, decide, mutate, propose
from webpages.models import PageVersion, WebPage

from .test_governance import create

pytestmark = pytest.mark.django_db


@pytest.fixture
def resources(scope):
    owner, member, outsider, definition = scope
    page = WebPage.objects.create(
        title="Classified", slug="classified", tenant=definition.tenant, created_by=owner, last_modified_by=owner
    )
    page_version = PageVersion.objects.create(page=page, version_number=1, created_by=owner)
    object_type = ObjectTypeDefinition.objects.create(
        name="classified",
        label="Classified",
        plural_label="Classified",
        schema={"type": "object", "properties": {}},
        created_by=owner,
        namespace=definition.namespace,
    )
    obj = ObjectInstance.objects.create(
        title="Object", tenant=definition.tenant, object_type=object_type, created_by=owner
    )
    obj_version = obj.create_version(owner, data={})
    definition.allowed_uses.append(f"object:{object_type.pk}")
    definition.save()
    media = MediaFile.objects.create(
        title="Image",
        slug="image",
        original_filename="image.jpg",
        file_path="tests/image.jpg",
        file_size=100,
        content_type="image/jpeg",
        file_hash="c" * 64,
        file_type="image",
        namespace=definition.namespace,
        tenant=definition.tenant,
        created_by=owner,
        last_modified_by=owner,
    )
    collection = MediaCollection.objects.create(
        title="Images", namespace=definition.namespace, created_by=owner, last_modified_by=owner
    )
    return page_version, obj_version, media, collection


def test_same_term_all_content_and_independent_order(scope, resources):
    owner, member, _, definition = scope
    first = create(owner, definition, "First")
    second = create(owner, definition, "Second")
    for resource in resources:
        replace_assignments(resource, [str(second.pk), str(first.pk), str(second.pk)], member)
        assert classification_ids(resource) == [str(second.pk), str(first.pk)]
    with pytest.raises(ValidationError):
        replace_assignments(resources[2], [], member)
    replace_assignments(resources[2], [str(first.pk)], member)
    assert classification_ids(resources[1]) == [str(second.pk), str(first.pk)]
    assert classification_ids(resources[2]) == [str(first.pk)]


def test_assigned_tag_cannot_change_type(scope, resources):
    from taxonomy.models import ClassificationType

    owner, member, _, source = scope
    target = ClassificationType.objects.create(
        tenant=source.tenant, namespace=source.namespace, key="topic", name="Topic"
    )
    term = create(owner, source, "Assigned")
    replace_assignments(resources[1], [str(term.pk)], member)
    with pytest.raises(ValidationError, match="assignments or legacy links"):
        change_type(owner, term, target.pk, revision=term.revision)
    term.refresh_from_db()
    assert term.classification_type_id == source.pk
    assert classification_ids(resources[1]) == [str(term.pk)]


def test_draft_proposal_blocks_publish_but_media_cannot_assign(scope, resources):
    owner, member, _, definition = scope
    proposal = propose(member, definition, "create", payload={"name": "Pending"})
    for draft in resources[:2]:
        replace_assignments(draft, [str(proposal.term_id)], member)
        with pytest.raises(ValidationError, match="Approve or remove"):
            assert_publishable(draft)
    for media in resources[2:]:
        with pytest.raises(ValidationError):
            replace_assignments(media, [str(proposal.term_id)], member)
    decide(owner, proposal, "approved")
    for draft in resources[:2]:
        assert_publishable(draft)


def test_rejected_proposed_term_blocks_publication(scope, resources):
    owner, member, _, definition = scope
    proposal = propose(member, definition, "create", payload={"name": "Rejected"})
    replace_assignments(resources[0], [str(proposal.term_id)], member)
    decide(owner, proposal, "rejected")
    with pytest.raises(ValidationError):
        assert_publishable(resources[0])


def test_archived_existing_can_remain_but_not_new(scope, resources):
    owner, member, _, definition = scope
    term = create(owner, definition, "Historical")
    version = resources[0]
    replace_assignments(version, [str(term.pk)], member)
    mutate(owner, definition, "archive", term=term, revision=term.revision)
    replace_assignments(version, [str(term.pk)], member)
    assert_publishable(version)
    with pytest.raises(ValidationError):
        replace_assignments(resources[1], [str(term.pk)], member)


def test_merge_deduplicates_read_without_rewriting_history(scope, resources):
    owner, member, _, definition = scope
    source, target = create(owner, definition, "Source"), create(owner, definition, "Target")
    version = resources[0]
    replace_assignments(version, [str(source.pk), str(target.pk)], member)
    mutate(
        owner,
        definition,
        "merge",
        term=source,
        revision=source.revision,
        payload={"target_id": str(target.pk), "target_revision": target.revision},
    )
    assert classification_ids(version) == [str(target.pk)]
    assert version.canonical_tag_links.filter(tag_id=source.pk).exists()
    replace_assignments(version, classification_ids(version), member)
    assert list(version.canonical_tag_links.values_list("tag_id", flat=True)) == [source.pk, target.pk]
    assert classification_ids(version) == [str(target.pk)]


def test_version_copy_keeps_independent_assignments(scope, resources):
    owner, member, _, definition = scope
    term = create(owner, definition, "Versioned")
    source = resources[1]
    replace_assignments(source, [str(term.pk)], member)
    published = ObjectVersionWorkflow(source.object_instance, owner).publish(
        version_id=source.pk, revision=source.edit_revision
    )
    copy = ObjectVersionWorkflow(source.object_instance, owner).save(
        version_id=published.pk,
        revision=published.edit_revision,
        content={"title": "Draft", "data": {}, "widgets": {}, "classification_ids": []},
    )
    assert copy.pk != source.pk
    assert classification_ids(source) == [str(term.pk)]
    assert classification_ids(copy) == []
    # A newer unclassified working copy must not hide the live version from a filtered list.
    assert [
        item.pk
        for item in ObjectInstance.get_published_objects(tenant=definition.tenant, classification_ids=[str(term.pk)])
    ] == [source.object_instance_id]


def test_invalid_and_disallowed_assignments_roll_back(scope, resources):
    owner, member, _, definition = scope
    term = create(owner, definition, "Scoped")
    replace_assignments(resources[0], [str(term.pk)], member)
    for invalid in [["not-a-uuid"], [str(term.pk), "not-a-uuid"]]:
        with pytest.raises(ValidationError):
            replace_assignments(resources[0], invalid, member)
    assert classification_ids(resources[0]) == [str(term.pk)]
    definition.allowed_uses = ["pages"]
    definition.save()
    with pytest.raises(ValidationError):
        replace_assignments(resources[2], [str(term.pk)], member)


def test_reconcile_can_interrupt_resume_and_verify(scope, resources):
    owner, _, _, definition = scope
    term = create(owner, definition, "Existing")
    resources[2].canonical_tags.add(term)
    call_command("reconcile_classifications", run_id="classification-canary", stop_after=1)
    run = TagBackfillRun.objects.get(pk="classification-canary")
    assert run.status == "interrupted"
    call_command("reconcile_classifications", run_id="classification-canary")
    call_command("reconcile_classifications", run_id="classification-canary", verify_only=True)
    assert MediaFileClassification.objects.filter(media_file=resources[2], tag=term).count() == 1
    call_command("reconcile_classifications", run_id="classification-canary")
    term.name = "Changed source"
    term.save()
    with pytest.raises(CommandError, match="identity"):
        call_command("reconcile_classifications", run_id="classification-canary")


def test_reconcile_preserves_five_news_meanings(scope):
    owner, _, _, definition = scope
    from taxonomy.management.commands.reconcile_classifications import NEWS_TYPES

    references = {}
    for key, (_, field) in NEWS_TYPES.items():
        object_type = ObjectTypeDefinition.objects.create(
            name=key,
            label=key,
            plural_label=key,
            schema={"type": "object", "properties": {}},
            created_by=owner,
            namespace=definition.namespace,
        )
        obj = ObjectInstance.objects.create(
            title="Same name", slug="same-name", tenant=definition.tenant, object_type=object_type, created_by=owner
        )
        references[field] = [obj.pk]
    news_type = ObjectTypeDefinition.objects.create(
        name="news",
        label="News",
        plural_label="News",
        schema={"type": "object", "properties": {}},
        created_by=owner,
        namespace=definition.namespace,
    )
    news = ObjectInstance.objects.create(
        title="News", object_type=news_type, tenant=definition.tenant, created_by=owner
    )
    version = news.create_version(owner, data=references)
    call_command("reconcile_classifications", run_id="news-classification")
    call_command("reconcile_classifications", run_id="news-classification", verify_only=True)
    assert len(classification_ids(version)) == 5
    assert set(Tag.objects.filter(pk__in=classification_ids(version)).values_list("tag_type", flat=True)) == set(
        NEWS_TYPES
    )
    assert LegacyTagMapping.objects.filter(source_kind="object").count() == 5
    version.refresh_from_db()
    assert version.data == references


def test_descendant_filters_follow_merges_and_can_be_disabled(scope, resources):
    from taxonomy.services import filter_classifications
    from webpages.models import PageVersion

    owner, member, _, definition = scope
    root = create(owner, definition, "Root")
    child = create(owner, definition, "Child", parent_id=str(root.pk))
    replace_assignments(resources[0], [str(child.pk)], member)
    qs = PageVersion.objects.filter(page__tenant=definition.tenant)
    assert filter_classifications(qs, "canonical_tag_links__tag_id", [root.pk], tenant=definition.tenant).count() == 1
    assert (
        filter_classifications(
            qs, "canonical_tag_links__tag_id", [root.pk], tenant=definition.tenant, include_descendants=False
        ).count()
        == 0
    )
    target = create(owner, definition, "Target")
    mutate(
        owner,
        definition,
        "merge",
        term=child,
        revision=child.revision,
        payload={"target_id": str(target.pk), "target_revision": target.revision},
    )
    assert filter_classifications(qs, "canonical_tag_links__tag_id", [target.pk], tenant=definition.tenant).count() == 1
    assert filter_classifications(qs, "canonical_tag_links__tag_id", [child.pk], tenant=definition.tenant).count() == 1


def test_media_api_classification_field_and_private_usage(scope, resources):
    from rest_framework.test import APIClient

    owner, member, _, definition = scope
    term = create(owner, definition, "Private")
    media = resources[2]
    media.access_level = "private"
    media.save(update_fields=["access_level"])
    replace_assignments(media, [str(term.pk)], owner)
    client = APIClient()
    client.force_authenticate(member)
    headers = {"HTTP_X_TENANT_ID": str(definition.tenant_id)}
    usage = client.get(f"/api/v1/taxonomy/terms/{term.pk}/usage/", **headers)
    assert usage.status_code == 200
    assert usage.data["media_files"]["count"] == 0
    client.force_authenticate(owner)
    response = client.get(f"/api/v1/media/files/{media.pk}/", **headers)
    assert response.status_code == 200
    assert response.data["classification_ids"] == [str(term.pk)]


def test_page_workflow_copies_and_blocks_proposed_terms(scope, resources):
    from webpages.services.page_version_workflow import PageVersionWorkflowService

    owner, member, _, definition = scope
    source = resources[0]
    proposal = propose(member, definition, "create", payload={"name": "Draft-only"})
    replace_assignments(source, [str(proposal.term_id)], member)
    service = PageVersionWorkflowService(source.page, owner)
    with pytest.raises(ValidationError):
        service.publish(source, expected_revision=source.edit_revision)
    source.refresh_from_db()
    assert source.effective_date is None


def test_object_creation_retains_selected_classifications(scope, resources):
    from rest_framework.test import APIClient

    owner, member, _, definition = scope
    term = create(owner, definition, "Initial object classification")
    client = APIClient()
    client.force_authenticate(member)
    response = client.post(
        "/api/v1/objects/objects/",
        {
            "object_type_id": resources[1].object_instance.object_type_id,
            "title": "Classified on creation",
            "data": {},
            "widgets": {},
            "classification_ids": [str(term.pk)],
        },
        format="json",
        HTTP_X_TENANT_ID=str(definition.tenant_id),
    )
    assert response.status_code == 201, response.data
    assert response.data["classification_ids"] == [str(term.pk)]


def test_page_save_canonical_selection_wins_over_legacy_projection(scope, resources):
    from types import SimpleNamespace

    from taxonomy.context import actor_context
    from webpages.serializers.version import PageVersionSerializer

    owner, member, _, definition = scope
    term = create(owner, definition, "Selected")
    version = resources[0]
    serializer = PageVersionSerializer(
        version,
        data={"classification_ids": [str(term.pk)], "tags": ["Stale legacy value"]},
        partial=True,
        context={"request": SimpleNamespace(user=member, data={})},
    )
    assert serializer.is_valid(), serializer.errors
    with actor_context(member):
        serializer.save()
    version.refresh_from_db()
    assert classification_ids(version) == [str(term.pk)]
    assert version.tags == ["Selected"]


def test_merged_source_round_trip_keeps_archived_or_disabled_assignment(scope, resources):
    owner, member, _, definition = scope
    source, target = create(owner, definition, "Source"), create(owner, definition, "Target")
    version = resources[0]
    other = PageVersion.objects.create(page=version.page, version_number=2, created_by=owner)
    replace_assignments(version, [str(source.pk)], member)
    mutate(
        owner,
        definition,
        "merge",
        term=source,
        revision=source.revision,
        payload={"target_id": str(target.pk), "target_revision": target.revision},
    )
    assert classification_ids(version) == [str(target.pk)]

    allowed_uses = definition.allowed_uses
    definition.allowed_uses = []
    definition.save(update_fields=["allowed_uses"])
    replace_assignments(version, classification_ids(version), member)
    assert list(version.canonical_tag_links.values_list("tag_id", flat=True)) == [source.pk]
    with pytest.raises(ValidationError, match="unavailable"):
        replace_assignments(other, [str(target.pk)], member)

    definition.allowed_uses = allowed_uses
    definition.save(update_fields=["allowed_uses"])
    target.refresh_from_db()
    mutate(owner, definition, "archive", term=target, revision=target.revision)
    replace_assignments(version, classification_ids(version), member)
    assert list(version.canonical_tag_links.values_list("tag_id", flat=True)) == [source.pk]
    with pytest.raises(ValidationError, match="archived"):
        replace_assignments(other, [str(target.pk)], member)


def test_media_approval_and_collection_upload_keep_selected_order(scope, resources):
    from taxonomy.assignments import collection_upload_ids, validate_media_selection

    owner, member, outsider, definition = scope
    first = create(owner, definition, "A first")
    second = create(owner, definition, "Z second")
    ids = [str(second.pk), str(first.pk)]
    assert validate_media_selection(definition.namespace, member, ids) == ids
    replace_assignments(resources[3], ids, owner)
    assert collection_upload_ids(resources[3], member) == ids
    from rest_framework.exceptions import PermissionDenied

    with pytest.raises(PermissionDenied):
        collection_upload_ids(resources[3], outsider)
    definition.allowed_uses = ["media_collections"]
    definition.save()
    with pytest.raises(ValidationError, match="media kind"):
        collection_upload_ids(resources[3], member)


def test_legacy_news_alias_cannot_reference_a_foreign_definition(scope):
    from content.models import Namespace
    from core.models import Tenant
    from object_storage.models import ObjectInstance, ObjectTypeDefinition
    from taxonomy.models import ClassificationType

    owner, _, outsider, definition = scope
    foreign = Tenant.objects.create(name="Other", identifier="other-news-alias", created_by=outsider)
    ns = Namespace.objects.create(name="Other", slug="other", tenant=foreign, created_by=outsider)
    foreign_definition = ObjectTypeDefinition.objects.create(
        name="news_type", label="Foreign", plural_label="Foreign", namespace=ns, created_by=outsider
    )
    news_definition = ObjectTypeDefinition.objects.create(
        name="news", label="News", plural_label="News", namespace=definition.namespace, created_by=owner
    )
    facet = ClassificationType.objects.create(
        tenant=definition.tenant,
        namespace=definition.namespace,
        key="news_type",
        name="News type",
        allowed_uses=[f"object:{news_definition.pk}"],
    )
    term = create(owner, facet, "Alias")
    obj = ObjectInstance.objects.create(
        tenant=definition.tenant, object_type=news_definition, title="News", created_by=owner
    )
    version = obj.create_version(owner, data={})
    with pytest.raises(ValidationError, match="definition is missing"):
        replace_assignments(version, [str(term.pk)], owner)
    assert not ObjectInstance.objects.filter(tenant=definition.tenant, object_type=foreign_definition).exists()
