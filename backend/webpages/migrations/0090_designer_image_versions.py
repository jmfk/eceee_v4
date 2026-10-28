import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("webpages", "0089_merge_theme_widgets_and_outlines"),
    ]

    operations = [
        migrations.CreateModel(
            name="DesignerImageSeries",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("protected_from_cleanup", models.BooleanField(default=False)),
                ("theme", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="designer_image_series", to="webpages.pagetheme")),
            ],
        ),
        migrations.CreateModel(
            name="DesignerImageVersion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("version_number", models.PositiveIntegerField()),
                ("file_path", models.CharField(max_length=500, unique=True)),
                ("file_size", models.BigIntegerField()),
                ("content_type", models.CharField(max_length=100)),
                ("width", models.PositiveIntegerField(blank=True, null=True)),
                ("height", models.PositiveIntegerField(blank=True, null=True)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("superseded_at", models.DateTimeField(blank=True, null=True)),
                ("series", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="versions", to="webpages.designerimageseries")),
                ("uploaded_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="uploaded_designer_images", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-version_number"]},
        ),
        migrations.AddConstraint(
            model_name="designerimageversion",
            constraint=models.UniqueConstraint(fields=("series", "version_number"), name="unique_designer_image_version"),
        ),
        migrations.AddIndex(
            model_name="designerimageversion",
            index=models.Index(fields=["superseded_at"], name="designer_image_superseded_idx"),
        ),
    ]
