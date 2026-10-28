"""Register surviving Designer draft objects without changing theme snapshots."""

import mimetypes
import uuid

from django.db import migrations, transaction
from django.utils import timezone


def _paths(value, prefix):
    if isinstance(value, dict):
        for child in value.values():
            yield from _paths(child, prefix)
    elif isinstance(value, list):
        for child in value:
            yield from _paths(child, prefix)
    elif isinstance(value, str) and prefix in value:
        yield value[value.index(prefix) :].split("?", 1)[0].split("#", 1)[0]


def backfill(apps, schema_editor):
    Theme = apps.get_model("webpages", "PageTheme")
    Draft = apps.get_model("webpages", "ThemeDesignerDraft")
    Revision = apps.get_model("webpages", "ThemeDesignerRevision")
    ThemeVersion = apps.get_model("webpages", "ThemeVersion")
    ExportJob = apps.get_model("webpages", "ThemeDesignerExportJob")
    Series = apps.get_model("webpages", "DesignerImageSeries")
    Version = apps.get_model("webpages", "DesignerImageVersion")
    db = schema_editor.connection.alias
    now = timezone.now()

    for theme in Theme.objects.using(db).iterator(chunk_size=100):
        prefix = f"theme_images/{theme.pk}/designer_drafts/"
        live_paths = set(
            _paths([theme.design_groups, theme.designer_preview, theme.image.name, theme.site_icon.name], prefix)
        )
        draft_paths = set()
        for snapshot in Draft.objects.using(db).filter(theme_id=theme.pk).values_list("snapshot", flat=True):
            draft_paths.update(_paths(snapshot, prefix))
        historical_paths = set()
        for model in (Revision, ThemeVersion, ExportJob):
            for snapshot in model.objects.using(db).filter(theme_id=theme.pk).values_list("snapshot", flat=True):
                historical_paths.update(_paths(snapshot, prefix))
        for path in live_paths | draft_paths | historical_paths:
            if Version.objects.using(db).filter(file_path=path).exists():
                continue
            with transaction.atomic(using=db):
                series = Series.objects.using(db).create(id=uuid.uuid4(), theme_id=theme.pk)
                Version.objects.using(db).create(
                    id=uuid.uuid4(),
                    series_id=series.pk,
                    version_number=1,
                    file_path=path,
                    file_size=0,
                    content_type=mimetypes.guess_type(path)[0] or "application/octet-stream",
                    uploaded_by_id=theme.created_by_id,
                    superseded_at=None if path in live_paths | draft_paths else now,
                )


class Migration(migrations.Migration):
    atomic = False  # Existing-path checks make a partial backfill safe to resume.
    dependencies = [("webpages", "0090_designer_image_versions")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
