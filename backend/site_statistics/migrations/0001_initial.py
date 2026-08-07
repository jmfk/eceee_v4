import uuid

import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Experiment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("start_date", models.DateTimeField(blank=True, null=True)),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("running", "Running"),
                            ("paused", "Paused"),
                            ("completed", "Completed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("goal_metric", models.CharField(max_length=100)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="experiments",
                        to="core.tenant",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="EventRaw",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("user_id", models.CharField(db_index=True, max_length=255)),
                ("event_time", models.DateTimeField(db_index=True, default=timezone.now)),
                ("event_type", models.CharField(db_index=True, max_length=50)),
                ("url", models.URLField(blank=True, max_length=2000, null=True)),
                ("referrer", models.URLField(blank=True, max_length=2000, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="raw_events",
                        to="core.tenant",
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "raw events",
            },
        ),
        migrations.CreateModel(
            name="ConversionStats",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(db_index=True)),
                ("goal_name", models.CharField(db_index=True, max_length=100)),
                ("impressions", models.IntegerField(default=0)),
                ("conversions", models.IntegerField(default=0)),
                ("conversion_rate", models.FloatField(default=0.0)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="conversion_stats",
                        to="core.tenant",
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "conversion stats",
                "unique_together": {("date", "tenant", "goal_name")},
            },
        ),
        migrations.CreateModel(
            name="PageStats",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(db_index=True)),
                ("url", models.URLField(db_index=True, max_length=2000)),
                ("pageviews", models.IntegerField(default=0)),
                ("unique_visitors", models.IntegerField(default=0)),
                ("avg_time_on_page", models.FloatField(default=0.0)),
                ("actions_per_visit", models.FloatField(default=0.0)),
                ("bounce_rate", models.FloatField(default=0.0)),
                ("exit_rate", models.FloatField(default=0.0)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_stats",
                        to="core.tenant",
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "page stats",
                "unique_together": {("date", "tenant", "url")},
            },
        ),
        migrations.CreateModel(
            name="Variant",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=255)),
                ("allocation_percent", models.IntegerField(default=50)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "experiment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="variants",
                        to="site_statistics.experiment",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="ExperimentMetric",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("metric_name", models.CharField(max_length=100)),
                ("value", models.FloatField(default=0.0)),
                ("last_updated", models.DateTimeField(auto_now=True)),
                (
                    "variant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="metrics",
                        to="site_statistics.variant",
                    ),
                ),
            ],
            options={
                "unique_together": {("variant", "metric_name")},
            },
        ),
        migrations.CreateModel(
            name="Assignment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("user_id", models.CharField(db_index=True, max_length=255)),
                ("assigned_at", models.DateTimeField(default=timezone.now)),
                (
                    "experiment",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="site_statistics.experiment"),
                ),
                (
                    "variant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="site_statistics.variant"),
                ),
            ],
            options={
                "unique_together": {("experiment", "user_id")},
            },
        ),
        migrations.AddIndex(
            model_name="eventraw",
            index=models.Index(fields=["tenant", "event_time"], name="site_statis_tenant__07b43b_idx"),
        ),
        migrations.AddIndex(
            model_name="conversionstats",
            index=models.Index(fields=["tenant", "date"], name="site_statis_tenant__ad8778_idx"),
        ),
        migrations.AddIndex(
            model_name="pagestats",
            index=models.Index(fields=["tenant", "date"], name="site_statis_tenant__5fb751_idx"),
        ),
    ]
