"""
Create a deterministic public site fixture for browser regression tests.
"""

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import Tenant
from webpages.models import PageVersion, WebPage


def content_widget(widget_id, html):
    return {
        "id": widget_id,
        "type": "Content",
        "config": {
            "content": html,
            "allowScripts": False,
            "sanitizeHtml": True,
        },
        "isPublished": True,
        "inheritanceLevel": 0,
        "inheritanceBehavior": "override_parent",
    }


class Command(BaseCommand):
    help = "Seed the public hostname fixture used by Playwright regression tests"

    def add_arguments(self, parser):
        parser.add_argument(
            "--hostname",
            default="public-regression.localhost",
            help="Hostname to attach to the public regression root page",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        hostname = WebPage.normalize_hostname(options["hostname"])

        user, _ = User.objects.get_or_create(
            username="playwright_regression",
            defaults={
                "email": "playwright-regression@example.com",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])

        tenant, _ = Tenant.objects.get_or_create(
            identifier="playwright-regression",
            defaults={"name": "Playwright Regression", "created_by": user},
        )

        root, _ = WebPage.objects.update_or_create(
            slug="public-regression-root",
            parent=None,
            tenant=tenant,
            defaults={
                "title": "Public Regression Home",
                "description": "Public regression home page",
                "hostnames": [hostname],
                "created_by": user,
                "last_modified_by": user,
                "sort_order": 0,
            },
        )

        about, _ = WebPage.objects.update_or_create(
            slug="about",
            parent=root,
            tenant=tenant,
            defaults={
                "title": "Public Regression About",
                "description": "Public regression child page",
                "created_by": user,
                "last_modified_by": user,
                "sort_order": 10,
            },
        )

        now = timezone.now()
        self._upsert_published_version(
            page=root,
            user=user,
            title="Public Regression Home",
            description="Public regression home meta description",
            content='<h1>Public Regression Home</h1><p>eceee-public-regression-home</p>',
            widget_id="public-regression-home-content",
            effective_date=now,
        )
        self._upsert_published_version(
            page=about,
            user=user,
            title="Public Regression About",
            description="Public regression about meta description",
            content='<h1>Public Regression About</h1><p>eceee-public-regression-about</p>',
            widget_id="public-regression-about-content",
            effective_date=now,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded public regression site at http://{hostname}:8000/"
            )
        )

    def _upsert_published_version(
        self,
        *,
        page,
        user,
        title,
        description,
        content,
        widget_id,
        effective_date,
    ):
        version, _ = PageVersion.objects.update_or_create(
            page=page,
            version_number=1,
            defaults={
                "version_title": "Playwright public regression fixture",
                "meta_title": title,
                "meta_description": description,
                "code_layout": "main_layout",
                "page_data": {
                    "metaTitle": title,
                    "metaDescription": description,
                },
                "widgets": {
                    "main": [
                        content_widget(widget_id, content),
                    ],
                },
                "change_summary": {"action": "seed_public_regression_site"},
                "created_by": user,
                "effective_date": effective_date,
                "expiry_date": None,
            },
        )
        return version
