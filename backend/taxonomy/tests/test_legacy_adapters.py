import pytest
from rest_framework.test import APIClient

from taxonomy.models import LegacyTagMapping

pytestmark = pytest.mark.django_db


def test_legacy_content_create_obeys_structure_rights_and_delete_archives(scope):
    owner, member, _, definition = scope
    client = APIClient()
    headers = {"HTTP_X_TENANT_ID": str(definition.tenant_id)}
    client.force_authenticate(member)
    values = {"name": "Legacy", "namespace": definition.namespace_id}
    assert client.post("/api/v1/tags/", values, format="json", **headers).status_code == 403
    client.force_authenticate(owner)
    response = client.post("/api/v1/tags/", values, format="json", **headers)
    assert response.status_code == 201, response.data
    source_id = response.data["id"]
    mapping = LegacyTagMapping.objects.get(source_kind="content", source_id=str(source_id))
    term = mapping.canonical_tag
    assert term.name == "Legacy"
    assert client.delete(f"/api/v1/tags/{source_id}/", **headers).status_code == 204
    term.refresh_from_db()
    assert term.status == "archived"
    from content.models import Tag as ContentTag

    assert ContentTag.objects.filter(pk=source_id).exists()


def test_legacy_media_bulk_archive_obeys_rights_and_keeps_rows(scope):
    from file_manager.models import MediaTag

    owner, member, _, definition = scope
    client = APIClient()
    headers = {"HTTP_X_TENANT_ID": str(definition.tenant_id)}
    client.force_authenticate(owner)
    response = client.post(
        "/api/v1/media/tags/",
        {"name": "Media", "slug": "media", "namespace": definition.namespace.slug},
        format="json",
        **headers,
    )
    assert response.status_code == 201, response.data
    source_id = response.data["id"]
    client.force_authenticate(member)
    assert (
        client.post("/api/v1/media/tags/bulk_delete/", {"tag_ids": [source_id]}, format="json", **headers).status_code
        == 403
    )
    client.force_authenticate(owner)
    response = client.post("/api/v1/media/tags/bulk_delete/", {"tag_ids": [source_id]}, format="json", **headers)
    assert response.status_code == 200
    assert response.data["deleted_count"] == 0
    assert MediaTag.objects.filter(pk=source_id).exists()
    assert LegacyTagMapping.objects.get(source_kind="media", source_id=source_id).canonical_tag.status == "archived"


def test_legacy_media_merge_preserves_sources(scope):
    from file_manager.models import MediaTag

    owner, _, _, definition = scope
    client = APIClient()
    client.force_authenticate(owner)
    headers = {"HTTP_X_TENANT_ID": str(definition.tenant_id)}
    ids = [
        client.post(
            "/api/v1/media/tags/",
            {"name": name, "slug": name.lower(), "namespace": definition.namespace.slug},
            format="json",
            **headers,
        ).data["id"]
        for name in ["Source", "Target"]
    ]
    response = client.post(
        "/api/v1/media/tags/merge_tags/",
        {"target_tag_id": ids[1], "source_tag_ids": [ids[0]]},
        format="json",
        **headers,
    )
    assert response.status_code == 200
    assert MediaTag.objects.filter(pk__in=ids).count() == 2
    assert LegacyTagMapping.objects.get(source_kind="media", source_id=ids[0]).canonical_tag.status == "merged"
