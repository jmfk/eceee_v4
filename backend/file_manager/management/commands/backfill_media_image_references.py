"""Convert unambiguous saved media image URLs to stable UUID references."""

from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import models, transaction

from core.models import Tenant
from file_manager.models import MediaFile, MediaFileVersion
from file_manager.storage import storage
from object_storage.models import ObjectInstance, ObjectVersion
from webpages.models import PageTheme, PageVersion, ThemeDesignerDraft, WebPage


def _rewrite(value, references):
    if isinstance(value, dict):
        return {key: _rewrite(child, references) for key, child in value.items()}
    if isinstance(value, list):
        return [_rewrite(child, references) for child in value]
    if not isinstance(value, str):
        return value
    if value in references:
        return references[value]
    for old_url, stable_url in references.items():
        if "://" in old_url and old_url in value:
            value = value.replace(old_url, stable_url)
    return value


def _references_for_tenant(tenant):
    owners = defaultdict(set)
    for media in MediaFile.objects.filter(tenant=tenant, file_type="image"):
        stable_url = media.get_uuid_url()
        for reference in (media.file_path, media.file_url, storage.url(media.file_path)):
            if reference:
                owners[reference].add(stable_url)
        for version in MediaFileVersion.objects.filter(media_file=media):
            owners[version.file_path].add(stable_url)
            owners[storage.url(version.file_path)].add(stable_url)
    return {reference: next(iter(urls)) for reference, urls in owners.items() if len(urls) == 1}, sum(
        len(urls) > 1 for urls in owners.values()
    )


def _sources(tenant):
    return (
        PageVersion.objects.filter(page__tenant=tenant),
        WebPage.objects.filter(tenant=tenant),
        ObjectVersion.objects.filter(object_instance__tenant=tenant),
        ObjectInstance.objects.filter(tenant=tenant),
        PageTheme.objects.filter(tenant=tenant),
        ThemeDesignerDraft.objects.filter(theme__tenant=tenant),
    )


class Command(BaseCommand):
    help = "Preview or convert unambiguous stored media image URLs to stable UUID references"

    def add_arguments(self, parser):
        parser.add_argument("--tenant", help="Tenant identifier; omit to inspect all tenants")
        parser.add_argument("--apply", action="store_true", help="Apply the previewed updates")

    def handle(self, *args, **options):
        tenants = Tenant.objects.all()
        if options["tenant"]:
            tenants = tenants.filter(identifier=options["tenant"])
        total_rows = 0
        total_ambiguous = 0
        for tenant in tenants.iterator():
            references, ambiguous = _references_for_tenant(tenant)
            total_ambiguous += ambiguous
            changed_rows = 0
            with transaction.atomic():
                for queryset in _sources(tenant):
                    fields = [
                        field.name
                        for field in queryset.model._meta.concrete_fields
                        if isinstance(field, (models.JSONField, models.TextField))
                    ]
                    for item in queryset.only("pk", *fields).iterator(chunk_size=100):
                        changes = {}
                        for field in fields:
                            original = getattr(item, field)
                            rewritten = _rewrite(original, references)
                            if rewritten != original:
                                changes[field] = rewritten
                        if changes:
                            changed_rows += 1
                            if options["apply"]:
                                queryset.model.objects.filter(pk=item.pk).update(**changes)
            total_rows += changed_rows
            self.stdout.write(f"{tenant.identifier}: rows={changed_rows}, ambiguous_references={ambiguous}")
        self.stdout.write(
            f"{'Updated' if options['apply'] else 'Would update'} {total_rows} rows; "
            f"{total_ambiguous} ambiguous reference keys left unchanged"
        )
