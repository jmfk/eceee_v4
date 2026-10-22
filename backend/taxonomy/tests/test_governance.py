import pytest
from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from content.models import Namespace
from core.models import Tenant
from taxonomy.models import ClassificationGrant, ClassificationType, Tag
from taxonomy.services import (
    ClassificationConflict,
    decide,
    descendants,
    mutate,
    permissions_for,
    propose,
    resolve_term,
    restore,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def scope():
    User = get_user_model()
    owner = User.objects.create_user(username="classification-owner")
    member = User.objects.create_user(username="classification-member")
    outsider = User.objects.create_user(username="classification-outsider")
    tenant = Tenant.objects.create(name="Classification", identifier="classification", created_by=owner)
    tenant.members.add(member)
    namespace = Namespace.objects.create(
        tenant=tenant, name="Editorial", slug="editorial", created_by=owner, is_default=True
    )
    definition = ClassificationType.objects.create(
        tenant=tenant,
        namespace=namespace,
        key="general",
        name="Allmänt",
        allowed_uses=["pages", "media_files", "media_collections"],
    )
    return owner, member, outsider, definition


def create(owner, definition, name, **payload):
    operation = mutate(owner, definition, "create", payload={"name": name, **payload})
    return Tag.objects.get(pk=next(iter(operation.after)))


def test_members_only_use_and_propose(scope):
    owner, member, outsider, definition = scope
    assert permissions_for(member, definition) == {"use", "propose"}
    assert not permissions_for(outsider, definition)
    with pytest.raises(PermissionDenied):
        create(member, definition, "Forbidden")
    with pytest.raises(PermissionDenied):
        propose(outsider, definition, "create", payload={"name": "Forbidden"})
    assert "administer" in permissions_for(owner, definition)


def test_term_path_identifies_the_type_before_the_term_hierarchy(scope):
    from taxonomy.serializers import TermSerializer

    owner, _, _, definition = scope
    first = create(owner, definition, "Energy")
    child = create(owner, definition, "Buildings", parent_id=str(first.pk))
    other = ClassificationType.objects.create(
        tenant=definition.tenant, namespace=definition.namespace, key="topic", name="Topic"
    )
    second = create(owner, other, "Energy")
    assert TermSerializer(first).data["path"] == "Allmänt / Energy"
    assert TermSerializer(child).data["path"] == "Allmänt / Energy / Buildings"
    assert TermSerializer(second).data["path"] == "Topic / Energy"


def test_proposed_identity_survives_approval(scope):
    owner, member, _, definition = scope
    proposal = propose(member, definition, "create", payload={"name": "Climate"})
    term_id = proposal.term_id
    assert proposal.term.status == "proposed"
    decide(owner, proposal, "approved", "Useful")
    assert Tag.objects.get(pk=term_id).status == "approved"
    with pytest.raises(ClassificationConflict):
        decide(owner, proposal, "approved")


def test_approval_needs_action_permission(scope):
    owner, member, _, definition = scope
    term = create(owner, definition, "Source")
    proposal = propose(member, definition, "edit", term=term, revision=term.revision, payload={"name": "Changed"})
    ClassificationGrant.objects.create(classification_type=definition, user=member, permissions=["approve"])
    with pytest.raises(PermissionDenied):
        decide(member, proposal, "approved")
    term.refresh_from_db()
    assert term.name == "Source"


def test_revision_conflict_is_atomic(scope):
    owner, member, _, definition = scope
    term = create(owner, definition, "Source")
    proposal = propose(member, definition, "edit", term=term, revision=term.revision, payload={"name": "Proposed"})
    mutate(owner, definition, "edit", term=term, revision=term.revision, payload={"name": "Current"})
    with pytest.raises(ClassificationConflict):
        decide(owner, proposal, "approved")
    proposal.refresh_from_db()
    assert proposal.status == "pending"
    term.refresh_from_db()
    assert term.name == "Current"


def test_move_cycle_rejected_and_subtree_preserved(scope):
    owner, _, _, definition = scope
    root = create(owner, definition, "Root")
    child = create(owner, definition, "Child", parent_id=str(root.pk))
    leaf = create(owner, definition, "Leaf", parent_id=str(child.pk))
    with pytest.raises(ValidationError):
        mutate(owner, definition, "move", term=root, revision=root.revision, payload={"parent_id": str(leaf.pk)})
    destination = create(owner, definition, "Destination")
    mutate(owner, definition, "move", term=child, revision=child.revision, payload={"parent_id": str(destination.pk)})
    assert leaf.pk in descendants(destination)
    assert leaf.pk not in descendants(root)


def test_cross_type_parent_and_merge_rejected(scope):
    owner, _, _, definition = scope
    term = create(owner, definition, "Source")
    other = ClassificationType.objects.create(
        tenant=definition.tenant, namespace=definition.namespace, key="other", name="Other"
    )
    foreign = create(owner, other, "Foreign")
    for action, payload in [
        ("move", {"parent_id": str(foreign.pk)}),
        ("merge", {"target_id": str(foreign.pk), "target_revision": foreign.revision}),
    ]:
        with pytest.raises(ValidationError):
            mutate(owner, definition, action, term=term, revision=term.revision, payload=payload)


def test_merge_preserves_identity_moves_children_and_undo(scope):
    owner, _, _, definition = scope
    source = create(owner, definition, "Old", alternative_names=["Older"])
    child = create(owner, definition, "Child", parent_id=str(source.pk))
    target = create(owner, definition, "New")
    operation = mutate(
        owner,
        definition,
        "merge",
        term=source,
        revision=source.revision,
        payload={"target_id": str(target.pk), "target_revision": target.revision},
    )
    source.refresh_from_db()
    child.refresh_from_db()
    target.refresh_from_db()
    assert resolve_term(source).pk == target.pk
    assert child.parent_id == target.pk
    assert "Old" in target.alternative_names and "Older" in target.alternative_names
    restore(owner, operation)
    source.refresh_from_db()
    child.refresh_from_db()
    target.refresh_from_db()
    assert source.status == "approved" and source.merged_into_id is None
    assert child.parent_id == source.pk
    assert target.alternative_names == []


def test_merge_into_descendant_rejected(scope):
    owner, _, _, definition = scope
    source = create(owner, definition, "Source")
    target = create(owner, definition, "Child", parent_id=str(source.pk))
    with pytest.raises(ValidationError):
        mutate(
            owner,
            definition,
            "merge",
            term=source,
            revision=source.revision,
            payload={"target_id": str(target.pk), "target_revision": target.revision},
        )
    source.refresh_from_db()
    assert source.status == "approved"


def test_archive_and_restore_conflict(scope):
    owner, _, _, definition = scope
    root = create(owner, definition, "Root")
    child = create(owner, definition, "Child", parent_id=str(root.pk))
    with pytest.raises(ValidationError):
        mutate(owner, definition, "archive", term=root, revision=root.revision)
    operation = mutate(owner, definition, "archive", term=child, revision=child.revision)
    create(owner, definition, "Later")
    with pytest.raises(ClassificationConflict):
        restore(owner, operation)
    child.refresh_from_db()
    assert child.status == "archived"


def test_reject_and_withdraw(scope):
    owner, member, outsider, definition = scope
    proposal = propose(member, definition, "create", payload={"name": "Proposal"})
    with pytest.raises(PermissionDenied):
        decide(outsider, proposal, "withdrawn")
    decide(member, proposal, "withdrawn")
    assert Tag.objects.get(pk=proposal.term_id).status == "rejected"


def test_api_tenant_scope_and_no_delete(scope):
    owner, member, outsider, definition = scope
    term = create(owner, definition, "Searchable", alternative_names=["Alias"])
    client = APIClient()
    client.force_authenticate(owner)
    headers = {"HTTP_X_TENANT_ID": str(definition.tenant_id)}
    response = client.get("/api/v1/taxonomy/terms/?search=Alias", **headers)
    assert response.status_code == 200
    assert response.data["results"][0]["id"] == str(term.pk)
    assert client.delete(f"/api/v1/taxonomy/terms/{term.pk}/", **headers).status_code == 405
    client.force_authenticate(outsider)
    assert client.get("/api/v1/taxonomy/terms/", **headers).status_code == 403
    client.force_authenticate(member)
    assert (
        client.post(
            "/api/v1/taxonomy/terms/",
            {
                "classification_type": str(definition.pk),
                "payload": {"name": "Unauthorized"},
            },
            format="json",
            **headers,
        ).status_code
        == 403
    )


def test_archived_term_can_be_reactivated_after_other_changes(scope):
    owner, _, _, definition = scope
    term = create(owner, definition, "Archived")
    mutate(owner, definition, "archive", term=term, revision=term.revision)
    create(owner, definition, "Later")
    term.refresh_from_db()
    mutate(owner, definition, "reactivate", term=term, revision=term.revision)
    term.refresh_from_db()
    assert term.status == "approved"


def test_rejected_decision_is_audited_but_cannot_be_undone_as_term_edit(scope):
    from taxonomy.models import ClassificationOperation

    owner, member, _, definition = scope
    proposal = propose(member, definition, "create", payload={"name": "Rejected"})
    decide(owner, proposal, "rejected", "Not appropriate")
    operation = ClassificationOperation.objects.get(proposal=proposal)
    assert operation.action == "reject"
    assert operation.before[str(proposal.term_id)]["status"] == "proposed"
    assert operation.after[str(proposal.term_id)]["status"] == "rejected"
    with pytest.raises(ClassificationConflict):
        restore(owner, operation)
