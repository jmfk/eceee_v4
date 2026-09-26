"""Theme snapshot, comparison, and restoration helpers."""

import hashlib
import json

from django.db import transaction
from django.db.models import Max

SNAPSHOT_FIELDS = (
    "name",
    "description",
    "image",
    "site_icon",
    "fonts",
    "colors",
    "design_groups",
    "component_styles",
    "designer_preview",
    "image_styles",
    "gallery_styles",
    "carousel_styles",
    "table_templates",
    "breakpoints",
    "css_variables",
    "html_elements",
    "custom_css",
    "is_active",
    "is_default",
)

ASSET_FIELDS = {"image", "site_icon"}


def theme_snapshot(theme):
    snapshot = {}
    for field in SNAPSHOT_FIELDS:
        value = getattr(theme, field)
        snapshot[field] = (value.name or None) if field in ASSET_FIELDS else value
    return snapshot


def snapshot_hash(snapshot):
    encoded = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def snapshots_equal(left, right):
    """Compare snapshots while treating absent legacy asset fields as empty."""
    return all(left.get(field) == right.get(field) for field in SNAPSHOT_FIELDS)


def snapshot_matches_current(snapshot, current):
    """Match legacy snapshots whose asset values were not recorded at the time."""
    return all(
        (field in ASSET_FIELDS and field not in snapshot) or snapshot.get(field) == current.get(field)
        for field in SNAPSHOT_FIELDS
    )


def record_theme_version(theme, *, source="web", source_label="", name="", created_by=None, force=False, snapshot=None):
    from webpages.models import PageTheme, ThemeVersion

    with transaction.atomic():
        PageTheme.objects.select_for_update().get(pk=theme.pk)
        snapshot = snapshot or theme_snapshot(theme)
        content_hash = snapshot_hash(snapshot)
        latest = ThemeVersion.objects.filter(theme=theme).first()
        if latest and not force and (latest.content_hash == content_hash or snapshots_equal(latest.snapshot, snapshot)):
            return latest
        next_number = (
            ThemeVersion.objects.filter(theme=theme).aggregate(value=Max("version_number"))["value"] or 0
        ) + 1
        return ThemeVersion.objects.create(
            theme=theme,
            version_number=next_number,
            name=name,
            sync_version=theme.sync_version,
            snapshot=snapshot,
            content_hash=content_hash,
            source=source,
            source_label=source_label,
            created_by=created_by,
        )


@transaction.atomic
def restore_theme_version(theme, version, *, user):
    if version.theme_id != theme.id:
        raise ValueError("Version does not belong to this theme.")
    for field in SNAPSHOT_FIELDS:
        if field in version.snapshot:
            setattr(theme, field, version.snapshot[field])
    theme.save(
        version_source="restore",
        version_source_label=f"Restored version {version.version_number}",
        version_created_by=user,
        force_version=True,
    )
    return theme.versions.first()


def _different_paths(left, right, prefix=""):
    if isinstance(left, dict) and isinstance(right, dict):
        paths = []
        for key in sorted(set(left) | set(right)):
            path = f"{prefix}.{key}" if prefix else key
            if key not in left or key not in right:
                paths.append(path)
            else:
                paths.extend(_different_paths(left[key], right[key], path))
        return paths
    if isinstance(left, list) and isinstance(right, list):
        paths = []
        for index in range(max(len(left), len(right))):
            path = f"{prefix}[{index}]"
            if index >= len(left) or index >= len(right):
                paths.append(path)
            else:
                paths.extend(_different_paths(left[index], right[index], path))
        return paths
    return [] if left == right else [prefix]


def compare_themes(left, right):
    metadata_fields = {"name", "description", "is_active", "is_default"}
    left_snapshot = {key: value for key, value in theme_snapshot(left).items() if key not in metadata_fields}
    right_snapshot = {key: value for key, value in theme_snapshot(right).items() if key not in metadata_fields}
    paths = _different_paths(left_snapshot, right_snapshot)
    if left.updated_at == right.updated_at:
        newer_theme_id = None
    else:
        newer_theme_id = left.id if left.updated_at > right.updated_at else right.id
    return {
        "identical": not paths,
        "changedAreas": sorted({path.split(".", 1)[0].split("[", 1)[0] for path in paths}),
        "changedPaths": paths,
        "newerThemeId": newer_theme_id,
    }
