import uuid

from django.db import migrations, models
import django.db.models.deletion


DEFAULT_LABELS = (
    ("question", "Question"),
    ("suggestion", "Suggestion"),
    ("content", "Content"),
    ("bug", "Bug Report"),
)


def seed_labels(apps, schema_editor):
    Tenant = apps.get_model("core", "Tenant")
    MessageLabel = apps.get_model("tenant_support", "MessageLabel")
    SupportThread = apps.get_model("tenant_support", "SupportThread")
    through = SupportThread.labels.through
    database = schema_editor.connection.alias
    for tenant_id in Tenant.objects.using(database).values_list("id", flat=True).iterator():
        labels = {}
        for position, (key, name) in enumerate(DEFAULT_LABELS):
            label, _ = MessageLabel.objects.using(database).get_or_create(
                tenant_id=tenant_id, name=name, defaults={"key": key, "position": position}
            )
            labels[key] = label.pk
        for kind, key in (("question", "question"), ("bug", "bug")):
            links = []
            thread_ids = (
                SupportThread.objects.using(database)
                .filter(tenant_id=tenant_id, kind=kind)
                .values_list("id", flat=True)
            )
            for thread_id in thread_ids.iterator(chunk_size=500):
                links.append(through(supportthread_id=thread_id, messagelabel_id=labels[key]))
                if len(links) == 500:
                    through.objects.using(database).bulk_create(links, batch_size=500, ignore_conflicts=True)
                    links.clear()
            if links:
                through.objects.using(database).bulk_create(links, batch_size=500, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [("tenant_support", "0004_instruction_language")]

    operations = [
        migrations.CreateModel(
            name="MessageLabel",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("name", models.CharField(max_length=40)),
                ("key", models.CharField(max_length=16, blank=True, default="")),
                ("active", models.BooleanField(default=True)),
                ("position", models.PositiveSmallIntegerField(default=0)),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="core.tenant")),
            ],
            options={"ordering": ["position", "name"]},
        ),
        migrations.AddConstraint(
            model_name="messagelabel",
            constraint=models.UniqueConstraint(fields=("tenant", "name"), name="support_label_tenant_name"),
        ),
        migrations.AddField(
            model_name="supportthread",
            name="labels",
            field=models.ManyToManyField(blank=True, related_name="threads", to="tenant_support.messagelabel"),
        ),
        migrations.RunPython(seed_labels, migrations.RunPython.noop),
    ]
