"""Report pages that have live content but no editable working version."""

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from webpages.models import PageVersion, WebPage


class Command(BaseCommand):
    help = "Report live pages that will create their working version on first save."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant",
            help="Limit the audit to one tenant identifier.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=20,
            help="Maximum number of matching page IDs to print (default: 20).",
        )

    def handle(self, *args, **options):
        if options["limit"] < 0:
            raise CommandError("--limit must be zero or greater.")

        now = timezone.now()
        versions = PageVersion.objects.filter(page_id=OuterRef("pk"))
        live_versions = versions.filter(effective_date__lte=now).filter(
            Q(expiry_date__isnull=True) | Q(expiry_date__gt=now)
        )
        editable_versions = versions.filter(Q(effective_date__isnull=True) | Q(effective_date__gt=now))
        pages = (
            WebPage.objects.filter(is_deleted=False)
            .annotate(has_live_version=Exists(live_versions), has_editable_version=Exists(editable_versions))
            .filter(has_live_version=True, has_editable_version=False)
            .order_by("tenant_id", "id")
        )

        tenant_identifier = options.get("tenant")
        if tenant_identifier:
            pages = pages.filter(tenant__identifier=tenant_identifier)

        count = pages.count()
        self.stdout.write(f"Live-only pages: {count}")
        if options["limit"]:
            for page in pages.select_related("tenant")[: options["limit"]]:
                self.stdout.write(f"{page.id}\t{page.tenant.identifier}\t{page.title}")

        self.stdout.write("Read-only audit; no working versions were created.")
