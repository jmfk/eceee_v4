"""Make stored Designer preview page links portable across local environments."""

import copy

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from webpages.models import PageTheme, ThemeDesignerDraft, ThemeDesignerRevision
from webpages.services.theme_preview_content import materialize_theme_preview_page_links
from webpages.services.theme_versions import record_theme_version


class Command(BaseCommand):
    help = "Normalize same-tenant absolute links in live themes and active Designer drafts."

    def add_arguments(self, parser):
        parser.add_argument("--theme-id", action="append", type=int, dest="theme_ids")
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Persist changes. Without this flag the command only reports them.",
        )

    def handle(self, *args, **options):
        themes = PageTheme.objects.select_related("tenant", "created_by").order_by("id")
        theme_ids = options.get("theme_ids") or []
        if theme_ids:
            themes = themes.filter(id__in=theme_ids)
            found_ids = set(themes.values_list("id", flat=True))
            missing_ids = sorted(set(theme_ids) - found_ids)
            if missing_ids:
                raise CommandError(f"Theme IDs not found: {', '.join(map(str, missing_ids))}")

        changed_themes = 0
        changed_drafts = 0
        for candidate in themes:
            with transaction.atomic():
                theme = (
                    PageTheme.objects.select_for_update().select_related("tenant", "created_by").get(id=candidate.id)
                )
                portable_live = materialize_theme_preview_page_links(theme, theme.designer_preview)
                live_changed = portable_live != theme.designer_preview

                draft = (
                    ThemeDesignerDraft.objects.select_for_update()
                    .select_related("updated_by")
                    .filter(theme=theme)
                    .first()
                )
                draft_preview = (draft.snapshot or {}).get("designer_preview", {}) if draft else {}
                portable_draft = materialize_theme_preview_page_links(theme, draft_preview) if draft else None
                draft_changed = bool(draft and portable_draft != draft_preview)

                if not live_changed and not draft_changed:
                    continue

                changed_themes += int(live_changed)
                changed_drafts += int(draft_changed)
                self.stdout.write(
                    f"Theme {theme.id} ({theme.name}): live={'yes' if live_changed else 'no'}, "
                    f"draft={'yes' if draft_changed else 'no'}"
                )
                if not options["apply"]:
                    continue

                if live_changed:
                    record_theme_version(
                        theme,
                        source="maintenance",
                        source_label="Before normalizing Designer preview links",
                        name="Before normalizing Designer preview links",
                        created_by=theme.created_by,
                        force=True,
                    )
                    theme.designer_preview = portable_live
                    theme.save(
                        update_fields=["designer_preview", "updated_at"],
                        version_source="maintenance",
                        version_source_label="Normalized Designer preview links",
                        version_created_by=theme.created_by,
                        force_version=True,
                    )

                if draft_changed:
                    ThemeDesignerRevision.objects.create(
                        theme=theme,
                        created_by=draft.updated_by,
                        snapshot=copy.deepcopy(draft.snapshot),
                        summary="Before normalizing Designer preview links",
                    )
                    draft.snapshot = {
                        **copy.deepcopy(draft.snapshot),
                        "designer_preview": portable_draft,
                    }
                    if live_changed:
                        draft.base_sync_version = theme.sync_version
                    draft.version += 1
                    draft.save(
                        update_fields=[
                            "snapshot",
                            "base_sync_version",
                            "version",
                            "updated_at",
                        ]
                    )

        mode = "Updated" if options["apply"] else "Would update"
        self.stdout.write(self.style.SUCCESS(f"{mode} {changed_themes} live theme(s) and {changed_drafts} draft(s)."))
