"""Generate or validate the standalone publisher's checked-in renderer manifest."""

from django.core.management.base import BaseCommand, CommandError

from webpages.publisher_manifest import MANIFEST_PATH, serialize_publisher_manifest


class Command(BaseCommand):
    help = "Generate the standalone publisher renderer manifest"

    def add_arguments(self, parser):
        parser.add_argument("--check", action="store_true", help="Fail if the checked-in manifest is stale")

    def handle(self, *args, **options):
        generated = serialize_publisher_manifest()
        if options["check"]:
            current = MANIFEST_PATH.read_text(encoding="utf-8") if MANIFEST_PATH.exists() else ""
            if current != generated:
                raise CommandError("Publisher renderer manifest is stale; run export_publisher_manifest.")
            self.stdout.write(self.style.SUCCESS("Publisher renderer manifest is current."))
            return

        MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST_PATH.write_text(generated, encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Wrote {MANIFEST_PATH}"))
