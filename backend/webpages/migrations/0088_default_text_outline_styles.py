"""Seed editable defaults only where no theme outlines have been defined."""

import copy

from django.db import migrations, models
import webpages.text_outline_styles


# Freeze the migration values so future default changes cannot alter this backfill.
DEFAULTS = {
    "dark": {
        "name": "Dark outline",
        "style": "outline",
        "colorMode": "black",
        "color": "#000000",
        "thickness": 1,
        "radius": 4,
        "angle": 45,
        "offset": 2,
        "opacity": 100,
    },
    "light": {
        "name": "Light outline",
        "style": "outline",
        "colorMode": "white",
        "color": "#000000",
        "thickness": 1,
        "radius": 4,
        "angle": 45,
        "offset": 2,
        "opacity": 100,
    },
}


def seed_empty_themes(apps, schema_editor):
    Theme = apps.get_model("webpages", "PageTheme")
    Draft = apps.get_model("webpages", "ThemeDesignerDraft")
    alias = schema_editor.connection.alias
    for theme in Theme.objects.using(alias).filter(text_outline_styles={}).iterator():
        updated = (
            Theme.objects.using(alias).filter(pk=theme.pk, text_outline_styles={}).update(text_outline_styles=DEFAULTS)
        )
        if not updated:
            continue
        for draft in Draft.objects.using(alias).filter(theme_id=theme.pk).iterator():
            if draft.snapshot.get("text_outline_styles"):
                continue
            snapshot = copy.deepcopy(draft.snapshot)
            snapshot["text_outline_styles"] = copy.deepcopy(DEFAULTS)
            Draft.objects.using(alias).filter(pk=draft.pk, snapshot=draft.snapshot).update(snapshot=snapshot)


class Migration(migrations.Migration):
    dependencies = [("webpages", "0087_pagetheme_text_outline_styles")]
    operations = [
        migrations.AlterField(
            model_name="pagetheme",
            name="text_outline_styles",
            field=models.JSONField(
                default=webpages.text_outline_styles.default_text_outline_styles,
                blank=True,
                help_text="Named theme-wide text effects",
            ),
        ),
        # Keep authored definitions on reversal; never remove user styles.
        migrations.RunPython(seed_empty_themes, migrations.RunPython.noop),
    ]
