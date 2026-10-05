from django.contrib.auth.models import User
from django.test import TestCase

from core.models import Tenant
from webpages.models import PageTheme, WebPage
from webpages.serializers import PageVersionSerializer


class ThemeInheritanceSerializationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("theme-inheritance-user", password="test")
        self.tenant = Tenant.objects.create(
            name="Theme inheritance tenant",
            identifier="theme-inheritance",
            created_by=self.user,
        )
        self.parent = WebPage.objects.create(
            title="Parent",
            slug="parent",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.child = WebPage.objects.create(
            title="Child",
            slug="child",
            parent=self.parent,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_draft_without_theme_resolves_parent_instead_of_live_override(self):
        """Clearing a draft theme must preview the inherited parent theme."""
        parent_theme = PageTheme.objects.create(
            name="Parent theme",
            tenant=self.tenant,
            created_by=self.user,
        )
        child_theme = PageTheme.objects.create(
            name="Child override",
            tenant=self.tenant,
            created_by=self.user,
        )

        parent_version = self.parent.create_version(self.user, "Parent live")
        parent_version.theme = parent_theme
        parent_version.save(update_fields=["theme"])
        self.parent.current_published_version = parent_version
        self.parent.save(update_fields=["current_published_version"])

        live_version = self.child.create_version(self.user, "Child live")
        live_version.theme = child_theme
        live_version.save(update_fields=["theme"])
        self.child.current_published_version = live_version
        self.child.save(update_fields=["current_published_version"])

        inheriting_draft = self.child.create_version(self.user, "Inheriting draft")
        data = PageVersionSerializer(inheriting_draft).data

        self.assertEqual(data["effective_theme"]["id"], parent_theme.id)
        self.assertEqual(data["theme_inheritance_info"]["source"], "inherited")
        self.assertEqual(
            data["theme_inheritance_info"]["inherited_from"]["theme_id"],
            parent_theme.id,
        )
