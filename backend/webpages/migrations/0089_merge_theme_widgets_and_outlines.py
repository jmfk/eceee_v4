"""Join independently developed theme fields without changing existing data."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("webpages", "0087_pagetheme_widget_types"),
        ("webpages", "0088_default_text_outline_styles"),
    ]
    operations = []
