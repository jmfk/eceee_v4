"""
Import a site package ZIP from the local filesystem.

This is intended for local/demo workflows where a site export should be
replayed into a fresh database without going through the async upload API.
"""

import zipfile
from datetime import timedelta

from botocore.exceptions import ClientError
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from content.models import Namespace
from core.models import Tenant
from file_manager.storage import S3MediaStorage
from webpages.models import SitePackageJob
from webpages.services.site_package import SitePackageImporter

User = get_user_model()


def parse_csv(value):
    return [item.strip() for item in (value or "").split(",") if item.strip()]


class Command(BaseCommand):
    help = "Import a site package ZIP into the current database."

    def add_arguments(self, parser):
        parser.add_argument("package_path", help="Path to a site package ZIP file.")
        parser.add_argument(
            "--username",
            default="demo",
            help="User to own imported content. Created as a superuser if missing.",
        )
        parser.add_argument(
            "--password",
            default="demo",
            help="Password to set for the owner user.",
        )
        parser.add_argument(
            "--tenant-identifier",
            default="demo",
            help="Tenant identifier for imported content.",
        )
        parser.add_argument(
            "--tenant-name",
            default="Demo Site",
            help="Tenant name for imported content.",
        )
        parser.add_argument(
            "--namespace-slug",
            default="demo",
            help="Namespace slug for imported media/content.",
        )
        parser.add_argument(
            "--namespace-name",
            default="Demo",
            help="Namespace name for imported media/content.",
        )
        parser.add_argument(
            "--hostnames",
            default="localhost,127.0.0.1",
            help="Comma-separated hostnames to assign to the imported root page.",
        )
        parser.add_argument(
            "--no-preserve-publication-status",
            action="store_true",
            help="Import versions as drafts instead of preserving publication dates.",
        )

    def handle(self, *args, **options):
        package_path = options["package_path"]
        hostnames = parse_csv(options["hostnames"])

        user = self.get_or_create_user(options["username"], options["password"])
        tenant = self.get_or_create_tenant(
            identifier=options["tenant_identifier"],
            name=options["tenant_name"],
            user=user,
        )
        self.get_or_create_namespace(
            slug=options["namespace_slug"],
            name=options["namespace_name"],
            tenant=tenant,
            user=user,
        )

        storage = S3MediaStorage()
        self.ensure_bucket(storage)

        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_RUNNING,
            created_by=user,
            options={
                "tenant_id": str(tenant.id),
                "preserve_publication_status": not options[
                    "no_preserve_publication_status"
                ],
            },
            expires_at=timezone.now() + timedelta(hours=24),
        )

        try:
            with zipfile.ZipFile(package_path, "r") as package:
                imported_root = SitePackageImporter(
                    job, storage=storage
                ).import_package(package)
        except FileNotFoundError as exc:
            job.mark_failed(exc)
            raise CommandError(f"Package not found: {package_path}") from exc
        except zipfile.BadZipFile as exc:
            job.mark_failed(exc)
            raise CommandError(f"Invalid ZIP package: {package_path}") from exc
        except Exception as exc:
            job.mark_failed(exc)
            raise

        imported_root.hostnames = hostnames
        imported_root.tenant = tenant
        imported_root.save()

        job.mark_completed(
            imported_root_page=imported_root,
            progress={
                **(job.progress or {}),
                "status": "completed",
                "hostnames": hostnames,
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported '{imported_root.title}' as page {imported_root.id}"
            )
        )
        self.stdout.write(f"Tenant: {tenant.name} ({tenant.identifier})")
        self.stdout.write(f"User: {user.username}")
        self.stdout.write(f"Hostnames: {', '.join(imported_root.hostnames) or '(none)'}")

    def get_or_create_user(self, username, password):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": f"{username}@localhost.local",
                "first_name": "Demo",
                "last_name": "User",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        update_fields = []
        if created or password:
            user.set_password(password)
            update_fields.append("password")
        if not user.is_staff or not user.is_superuser:
            user.is_staff = True
            user.is_superuser = True
            update_fields.extend(["is_staff", "is_superuser"])
        if update_fields:
            user.save(update_fields=update_fields)
        return user

    def get_or_create_tenant(self, identifier, name, user):
        tenant, created = Tenant.objects.get_or_create(
            identifier=identifier,
            defaults={
                "name": name,
                "created_by": user,
            },
        )
        if not created and tenant.name != name:
            tenant.name = name
            tenant.save(update_fields=["name", "updated_at"])
        return tenant

    def get_or_create_namespace(self, slug, name, tenant, user):
        namespace, created = Namespace.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "tenant": tenant,
                "is_default": True,
                "created_by": user,
            },
        )
        updates = []
        if namespace.tenant_id != tenant.id:
            namespace.tenant = tenant
            updates.append("tenant")
        if namespace.name != name:
            namespace.name = name
            updates.append("name")
        if not namespace.is_default:
            namespace.is_default = True
            updates.append("is_default")
        if updates:
            namespace.save(update_fields=[*updates, "updated_at"])
        return namespace

    def ensure_bucket(self, storage):
        try:
            storage.client.head_bucket(Bucket=storage.bucket_name)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code not in ("404", "NoSuchBucket"):
                raise
            storage.client.create_bucket(Bucket=storage.bucket_name)
