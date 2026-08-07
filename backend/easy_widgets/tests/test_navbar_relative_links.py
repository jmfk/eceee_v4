from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase

from core.models import Tenant
from easy_widgets.widgets.navbar import NavbarWidget
from webpages.models import WebPage


class NavbarWidgetInternalLinkTests(TestCase):
    def setUp(self):
        self.widget = NavbarWidget()
        self.user = User.objects.create_user(
            username="navbar-test",
            email="navbar@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name="Navbar Tenant",
            identifier="navbar",
            created_by=self.user,
        )

    def test_internal_links_render_as_site_relative_paths(self):
        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")

        root = WebPage.objects.create(
            title="Other Site",
            slug="other-site",
            hostnames=["other-site.test"],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )
        target = WebPage.objects.create(
            title="Target",
            slug="target",
            parent=root,
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
            is_currently_published=True,
        )
        WebPage.objects.filter(pk=target.pk).update(
            cached_path="/target/",
            cached_root_hostnames=["other-site.test"],
            is_currently_published=True,
        )

        request = type("Request", (), {"get_host": lambda self: "localhost:8000"})()
        context = self.widget.prepare_template_context(
            {
                "menu_items": [
                    {
                        "order": 0,
                        "link_data": {
                            "type": "internal",
                            "label": "Target",
                            "page_id": target.id,
                            "anchor": "details",
                            "is_active": True,
                        },
                    }
                ]
            },
            {"request": request},
        )

        self.assertEqual(context["menuItems"][0]["url"], "/target/#details")
