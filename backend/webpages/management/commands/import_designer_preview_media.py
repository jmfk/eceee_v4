"""Import legacy relative Designer preview images into theme-owned storage."""

import copy

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from file_manager.storage import system_storage
from webpages.models import PageTheme, ThemeDesignerDraft, ThemeDesignerRevision
from webpages.services.theme_preview_content import (
    import_legacy_preview_images,
    legacy_preview_image_references,
)
from webpages.services.theme_versions import record_theme_version


class Command(BaseCommand):
    help = "Copy scoped legacy preview images into a theme library and rewrite live and draft references."

    def add_arguments(self, parser):
        parser.add_argument("--theme-id", type=int, required=True)
        parser.add_argument("--source-origin", required=True)
        parser.add_argument("--source-prefix", default="/files/")
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Persist changes. Without this flag the command only reports matching references.",
        )

    def handle(self, *args, **options):
        theme = PageTheme.objects.select_related("tenant", "created_by").filter(id=options["theme_id"]).first()
        if not theme:
            raise CommandError(f"Theme ID {options['theme_id']} was not found.")
        draft = ThemeDesignerDraft.objects.select_related("updated_by").filter(theme=theme).first()
        documents = {"live": theme.designer_preview}
        if draft:
            documents["draft"] = (draft.snapshot or {}).get("designer_preview", {})
        references = legacy_preview_image_references(documents, options["source_prefix"])
        self.stdout.write(f"Theme {theme.id} ({theme.name}): {len(references)} matching image reference(s).")
        if not options["apply"] or not references:
            return

        saved_paths = []
        try:
            with transaction.atomic():
                theme = PageTheme.objects.select_for_update().select_related("created_by").get(id=theme.id)
                draft = (
                    ThemeDesignerDraft.objects.select_for_update()
                    .select_related("updated_by")
                    .filter(theme=theme)
                    .first()
                )
                documents = {"live": theme.designer_preview}
                if draft:
                    documents["draft"] = (draft.snapshot or {}).get("designer_preview", {})
                rewritten, copied_count, saved_paths = import_legacy_preview_images(
                    theme,
                    documents,
                    options["source_origin"],
                    options["source_prefix"],
                )

                record_theme_version(
                    theme,
                    source="maintenance",
                    source_label="Before importing legacy Designer preview media",
                    name="Before importing legacy Designer preview media",
                    created_by=theme.created_by,
                    force=True,
                )
                theme.designer_preview = rewritten["live"]
                theme.save(
                    update_fields=["designer_preview", "updated_at"],
                    version_source="maintenance",
                    version_source_label="Imported legacy Designer preview media",
                    version_created_by=theme.created_by,
                    force_version=True,
                )

                if draft:
                    ThemeDesignerRevision.objects.create(
                        theme=theme,
                        created_by=draft.updated_by,
                        snapshot=copy.deepcopy(draft.snapshot),
                        summary="Before importing legacy Designer preview media",
                    )
                    draft.snapshot = {
                        **copy.deepcopy(draft.snapshot),
                        "designer_preview": rewritten["draft"],
                    }
                    draft.base_sync_version = theme.sync_version
                    draft.version += 1
                    draft.save(update_fields=["snapshot", "base_sync_version", "version", "updated_at"])
        except Exception:
            for saved_path in saved_paths:
                try:
                    system_storage.delete(saved_path)
                except Exception:
                    pass
            raise

        self.stdout.write(self.style.SUCCESS(f"Imported {copied_count} image(s) into the theme library."))
