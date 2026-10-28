import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("file_manager", "0014_mediacollection_canonical_tags_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mediafile",
            name="file_hash",
            field=models.CharField(db_index=True, help_text="SHA-256 hash of the current file", max_length=64),
        ),
        migrations.AlterField(
            model_name="pendingmediafile",
            name="file_hash",
            field=models.CharField(db_index=True, help_text="SHA-256 hash of the pending file", max_length=64),
        ),
        migrations.AddField(
            model_name="mediafile",
            name="version_number",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="mediafile",
            name="version_uploaded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mediafile",
            name="protected_from_cleanup",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="MediaFileVersion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("version_number", models.PositiveIntegerField()),
                ("file_path", models.CharField(db_index=True, max_length=500)),
                ("original_filename", models.CharField(max_length=255)),
                ("file_size", models.BigIntegerField()),
                ("content_type", models.CharField(max_length=100)),
                ("file_hash", models.CharField(max_length=64)),
                ("width", models.PositiveIntegerField(blank=True, null=True)),
                ("height", models.PositiveIntegerField(blank=True, null=True)),
                ("uploaded_at", models.DateTimeField()),
                ("superseded_at", models.DateTimeField()),
                ("media_file", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="image_versions", to="file_manager.mediafile")),
                ("uploaded_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="uploaded_media_versions", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-version_number"]},
        ),
        migrations.AddConstraint(
            model_name="mediafileversion",
            constraint=models.UniqueConstraint(fields=("media_file", "version_number"), name="unique_media_image_version"),
        ),
        migrations.AddIndex(
            model_name="mediafileversion",
            index=models.Index(fields=["superseded_at"], name="media_version_superseded_idx"),
        ),
    ]
