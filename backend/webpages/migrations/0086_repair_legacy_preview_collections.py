import copy
import os
import uuid

from django.db import migrations
from django.utils.text import slugify


def _collection_selectors(value):
    if isinstance(value, dict):
        selector = value.get("image")
        if isinstance(selector, dict) and selector.get("id") and (
            selector.get("type") == "collection"
            or any(key in selector for key in ("fileCount", "file_count", "sampleImages", "sample_images", "slug"))
        ):
            yield selector
        for child in value.values():
            yield from _collection_selectors(child)
    elif isinstance(value, list):
        for child in value:
            yield from _collection_selectors(child)


def _namespace_for_selector(Namespace, tenant_id, selector):
    namespace_value = selector.get("namespace")
    namespace_slug = namespace_value.get("slug") if isinstance(namespace_value, dict) else namespace_value
    namespaces = Namespace.objects.filter(tenant_id=tenant_id)
    if not namespace_slug or namespace_slug == "default":
        return namespaces.filter(is_default=True).first() or namespaces.filter(slug="default").first()
    return namespaces.filter(slug=namespace_slug).first()


def _repair_collection(MediaCollection, MediaFile, Namespace, selector, tenant_id, owner_id):
    try:
        collection_id = uuid.UUID(str(selector.get("id")))
    except (TypeError, ValueError, AttributeError):
        return None
    collection = MediaCollection.objects.filter(pk=collection_id).first()
    if collection:
        return collection if collection.namespace.tenant_id == tenant_id else None

    namespace = _namespace_for_selector(Namespace, tenant_id, selector)
    if namespace is None or owner_id is None:
        return None
    title = str(selector.get("title") or selector.get("slug") or "Recovered media collection")[:255]
    base_slug = slugify(selector.get("slug") or title)[:240] or "recovered-collection"
    slug = base_slug
    suffix = 1
    while MediaCollection.objects.filter(namespace=namespace, slug=slug).exists():
        slug = f"{base_slug[:230]}-{suffix}"
        suffix += 1
    collection = MediaCollection.objects.create(
        id=collection_id,
        title=title,
        slug=slug,
        description=str(selector.get("description") or "")[:1000],
        access_level=selector.get("access_level") or "public",
        namespace=namespace,
        created_by_id=owner_id,
        last_modified_by_id=owner_id,
    )
    samples = selector.get("sampleImages") or selector.get("sample_images") or []
    sample_ids = []
    for sample in samples:
        if not isinstance(sample, dict) or not sample.get("id"):
            continue
        try:
            sample_ids.append(uuid.UUID(str(sample["id"])))
        except (TypeError, ValueError, AttributeError):
            continue
    files = MediaFile.objects.filter(
        id__in=sample_ids,
        tenant_id=tenant_id,
        namespace__tenant_id=tenant_id,
        is_deleted=False,
    )
    for media_file in files.iterator():
        media_file.collections.add(collection)
    return collection


def _media_items(MediaFile, collection, selector, tenant_id):
    files = []
    if collection:
        files = list(
            MediaFile.objects.filter(
                collections=collection,
                tenant_id=tenant_id,
                namespace__tenant_id=tenant_id,
                file_type="image",
                is_deleted=False,
            ).order_by("-created_at", "id")
        )
    if files:
        def file_url(item):
            return item.file_url or f"/files/{item.namespace.slug}/{item.slug}{os.path.splitext(item.original_filename)[1].lower()}"

        return [
            {
                "url": file_url(item),
                "type": "image",
                "altText": item.title or "Image",
                "caption": item.description or "",
                "annotation": (item.metadata or {}).get("annotation", ""),
                "title": item.title or "",
                "width": item.width,
                "height": item.height,
                "thumbnailUrl": file_url(item),
            }
            for item in files
        ]

    items = []
    for sample in selector.get("sampleImages") or selector.get("sample_images") or []:
        if not isinstance(sample, dict):
            continue
        sample_id = sample.get("id")
        if sample_id:
            try:
                if MediaFile.objects.filter(id=sample_id).exclude(tenant_id=tenant_id).exists():
                    continue
            except (TypeError, ValueError):
                continue
        url = (
            sample.get("imgproxyBaseUrl")
            or sample.get("imgproxy_base_url")
            or sample.get("fileUrl")
            or sample.get("file_url")
            or sample.get("url")
        )
        if url:
            items.append(
                {
                    "url": url,
                    "type": "image",
                    "altText": sample.get("altText") or sample.get("alt_text") or sample.get("title") or "Image",
                    "caption": sample.get("caption") or "",
                    "annotation": sample.get("annotation") or "",
                    "title": sample.get("title") or "",
                    "width": sample.get("width"),
                    "height": sample.get("height"),
                    "thumbnailUrl": sample.get("thumbnailUrl") or sample.get("thumbnail_url") or url,
                }
            )
    return items


def _normalize_preview(value, tenant_id, collections, MediaFile):
    if isinstance(value, dict):
        selector = value.get("image")
        is_collection = isinstance(selector, dict) and selector.get("id") and (
            selector.get("type") == "collection"
            or any(key in selector for key in ("fileCount", "file_count", "sampleImages", "sample_images", "slug"))
        )
        result = {key: _normalize_preview(child, tenant_id, collections, MediaFile) for key, child in value.items()}
        if is_collection:
            collection = collections.get(str(selector["id"]))
            items = _media_items(MediaFile, collection, selector, tenant_id)
            result.pop("image", None)
            result.pop("collectionId", None)
            result.pop("collection_id", None)
            if items:
                result["mediaItems"] = items
                result.pop("media_items", None)
        return result
    if isinstance(value, list):
        return [_normalize_preview(child, tenant_id, collections, MediaFile) for child in value]
    return copy.deepcopy(value)


def repair_legacy_preview_collections(apps, schema_editor):
    Namespace = apps.get_model("content", "Namespace")
    MediaCollection = apps.get_model("file_manager", "MediaCollection")
    MediaFile = apps.get_model("file_manager", "MediaFile")
    PageVersion = apps.get_model("webpages", "PageVersion")
    PageTheme = apps.get_model("webpages", "PageTheme")
    ThemeDesignerDraft = apps.get_model("webpages", "ThemeDesignerDraft")

    for version in PageVersion.objects.select_related("page").all().iterator():
        for selector in _collection_selectors(version.widgets):
            _repair_collection(
                MediaCollection,
                MediaFile,
                Namespace,
                selector,
                version.page.tenant_id,
                version.page.created_by_id,
            )

    for theme in PageTheme.objects.all().iterator():
        collections = {}
        for selector in _collection_selectors(theme.designer_preview):
            collection = _repair_collection(
                MediaCollection,
                MediaFile,
                Namespace,
                selector,
                theme.tenant_id,
                theme.created_by_id,
            )
            if collection:
                collections[str(selector["id"])] = collection
        normalized = _normalize_preview(theme.designer_preview, theme.tenant_id, collections, MediaFile)
        if normalized != theme.designer_preview:
            PageTheme.objects.filter(pk=theme.pk).update(designer_preview=normalized)

        for draft in ThemeDesignerDraft.objects.filter(theme_id=theme.pk).iterator():
            snapshot = copy.deepcopy(draft.snapshot) if isinstance(draft.snapshot, dict) else {}
            preview = snapshot.get("designer_preview")
            if not isinstance(preview, dict):
                continue
            normalized = _normalize_preview(preview, theme.tenant_id, collections, MediaFile)
            if normalized != preview:
                snapshot["designer_preview"] = normalized
                ThemeDesignerDraft.objects.filter(pk=draft.pk).update(snapshot=snapshot)


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0024_namespace_is_hidden"),
        ("file_manager", "0014_mediacollection_canonical_tags_and_more"),
        ("webpages", "0085_transfer_legacy_layout_styles"),
    ]

    operations = [migrations.RunPython(repair_legacy_preview_collections, migrations.RunPython.noop)]
