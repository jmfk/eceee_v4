from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.exceptions import ValidationError
from django.utils import timezone
import json

from .models import WebPage, PageLayout, PageTheme, WidgetType, PageWidget, PageVersion


class WidgetTypeModelTest(TestCase):
    """Test WidgetType model functionality"""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_widget_type_creation(self):
        """Test creating a widget type with valid JSON schema"""
        schema = {
            "type": "object",
            "properties": {"title": {"type": "string"}, "content": {"type": "string"}},
            "required": ["content"],
        }

        widget_type = WidgetType.objects.create(
            name="Test Widget",
            description="A test widget",
            json_schema=schema,
            template_name="test_widget.html",
            created_by=self.user,
        )

        self.assertEqual(widget_type.name, "Test Widget")
        self.assertEqual(widget_type.json_schema, schema)
        self.assertTrue(widget_type.is_active)
        self.assertEqual(str(widget_type), "Test Widget")

    def test_widget_type_ordering(self):
        """Test widget types are ordered by name"""
        widget_b = WidgetType.objects.create(
            name="B Widget",
            description="Widget B",
            json_schema={"type": "object"},
            template_name="b.html",
            created_by=self.user,
        )

        widget_a = WidgetType.objects.create(
            name="A Widget",
            description="Widget A",
            json_schema={"type": "object"},
            template_name="a.html",
            created_by=self.user,
        )

        widgets = list(WidgetType.objects.all())
        self.assertEqual(widgets[0], widget_a)
        self.assertEqual(widgets[1], widget_b)


class PageLayoutModelTest(TestCase):
    """Test cases for PageLayout model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_layout_creation(self):
        """Test creating a layout with slot configuration"""
        layout = PageLayout.objects.create(
            name="Test Layout",
            description="A test layout",
            slot_configuration={
                "slots": [
                    {
                        "name": "header",
                        "display_name": "Header Section",
                        "description": "Main header area",
                        "css_classes": "header-slot",
                        "allows_multiple": False,
                    },
                    {
                        "name": "content",
                        "display_name": "Main Content",
                        "description": "Primary content area",
                        "css_classes": "content-slot",
                        "allows_multiple": True,
                    },
                ]
            },
            css_classes=".test-layout { display: grid; }",
            created_by=self.user,
        )

        self.assertEqual(layout.name, "Test Layout")
        self.assertEqual(len(layout.slot_configuration["slots"]), 2)
        self.assertTrue(layout.is_active)
        self.assertEqual(str(layout), "Test Layout")


class PageThemeModelTest(TestCase):
    """Test cases for PageTheme model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_theme_creation(self):
        """Test creating a theme with CSS variables"""
        theme = PageTheme.objects.create(
            name="Blue Theme",
            description="A blue color scheme",
            css_variables={
                "primary": "#3b82f6",
                "secondary": "#64748b",
                "background": "#ffffff",
                "text": "#1f2937",
            },
            custom_css="""
                .blue-theme {
                    background: var(--background);
                    color: var(--text);
                }
            """,
            created_by=self.user,
        )

        self.assertEqual(theme.name, "Blue Theme")
        self.assertEqual(theme.css_variables["primary"], "#3b82f6")
        self.assertTrue(theme.is_active)
        self.assertEqual(str(theme), "Blue Theme")


class PageWidgetModelTest(TestCase):
    """Test PageWidget model functionality"""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.layout = PageLayout.objects.create(
            name="Test Layout",
            description="A test layout",
            slot_configuration={
                "slots": [
                    {"name": "header", "display_name": "Header"},
                    {"name": "content", "display_name": "Content"},
                ]
            },
            created_by=self.user,
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            layout=self.layout,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.widget_type = WidgetType.objects.create(
            name="Text Block",
            description="A text widget",
            json_schema={
                "type": "object",
                "properties": {"content": {"type": "string"}},
            },
            template_name="text_block.html",
            created_by=self.user,
        )

    def test_page_widget_creation(self):
        """Test creating a page widget"""
        widget = PageWidget.objects.create(
            page=self.page,
            widget_type=self.widget_type,
            slot_name="header",
            sort_order=0,
            configuration={"content": "Hello World"},
            created_by=self.user,
        )

        self.assertEqual(widget.page, self.page)
        self.assertEqual(widget.widget_type, self.widget_type)
        self.assertEqual(widget.slot_name, "header")
        self.assertEqual(widget.configuration["content"], "Hello World")
        self.assertTrue(widget.inherit_from_parent)
        self.assertFalse(widget.override_parent)

    def test_page_widget_ordering(self):
        """Test page widgets are ordered by slot and sort_order"""
        widget1 = PageWidget.objects.create(
            page=self.page,
            widget_type=self.widget_type,
            slot_name="content",
            sort_order=1,
            configuration={"content": "Second"},
            created_by=self.user,
        )

        widget2 = PageWidget.objects.create(
            page=self.page,
            widget_type=self.widget_type,
            slot_name="header",
            sort_order=0,
            configuration={"content": "First"},
            created_by=self.user,
        )

        widget3 = PageWidget.objects.create(
            page=self.page,
            widget_type=self.widget_type,
            slot_name="content",
            sort_order=0,
            configuration={"content": "Third"},
            created_by=self.user,
        )

        widgets = list(PageWidget.objects.all())
        # Should be ordered by slot_name, then sort_order
        self.assertEqual(widgets[0], widget3)  # content, 0
        self.assertEqual(widgets[1], widget1)  # content, 1
        self.assertEqual(widgets[2], widget2)  # header, 0

    def test_page_widget_string_representation(self):
        """Test PageWidget string representation"""
        widget = PageWidget.objects.create(
            page=self.page,
            widget_type=self.widget_type,
            slot_name="header",
            sort_order=0,
            configuration={"content": "Test"},
            created_by=self.user,
        )

        expected = f"{self.page.title} - {self.widget_type.name} in header"
        self.assertEqual(str(widget), expected)


class WebPageInheritanceTest(TestCase):
    """Test cases for WebPage inheritance functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create layout and theme
        self.layout = PageLayout.objects.create(
            name="Two Column Layout",
            slot_configuration={"slots": [{"name": "main"}, {"name": "sidebar"}]},
            created_by=self.user,
        )

        self.theme = PageTheme.objects.create(
            name="Default Theme",
            css_variables={"primary": "#3b82f6"},
            created_by=self.user,
        )

        # Create page hierarchy: root -> services -> web-dev
        self.root_page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            layout=self.layout,
            theme=self.theme,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.services_page = WebPage.objects.create(
            title="Services",
            slug="services",
            parent=self.root_page,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.webdev_page = WebPage.objects.create(
            title="Web Development",
            slug="web-development",
            parent=self.services_page,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_layout_inheritance(self):
        """Test that pages inherit layout from parent"""
        # Services page should inherit layout from root
        self.assertEqual(self.services_page.get_effective_layout(), self.layout)

        # Web dev page should inherit layout from root (through services)
        self.assertEqual(self.webdev_page.get_effective_layout(), self.layout)

        # Test override
        new_layout = PageLayout.objects.create(
            name="Single Column",
            slot_configuration={"slots": [{"name": "main"}]},
            created_by=self.user,
        )
        self.services_page.layout = new_layout
        self.services_page.save()

        # Services should now use new layout
        self.assertEqual(self.services_page.get_effective_layout(), new_layout)
        # Web dev should inherit new layout from services
        self.assertEqual(self.webdev_page.get_effective_layout(), new_layout)

    def test_theme_inheritance(self):
        """Test that pages inherit theme from parent"""
        # Services page should inherit theme from root
        self.assertEqual(self.services_page.get_effective_theme(), self.theme)

        # Web dev page should inherit theme from root (through services)
        self.assertEqual(self.webdev_page.get_effective_theme(), self.theme)

    def test_inheritance_chain(self):
        """Test getting the complete inheritance chain"""
        chain = self.webdev_page.get_inheritance_chain()

        self.assertEqual(len(chain), 3)
        self.assertEqual(chain[0], self.root_page)
        self.assertEqual(chain[1], self.services_page)
        self.assertEqual(chain[2], self.webdev_page)

    def test_layout_inheritance_info(self):
        """Test getting detailed layout inheritance information"""
        info = self.webdev_page.get_layout_inheritance_info()

        self.assertEqual(info["effective_layout"], self.layout)
        self.assertEqual(info["inherited_from"], self.root_page)
        self.assertEqual(len(info["inheritance_chain"]), 3)

    def test_theme_inheritance_info(self):
        """Test getting detailed theme inheritance information"""
        info = self.webdev_page.get_theme_inheritance_info()

        self.assertEqual(info["effective_theme"], self.theme)
        self.assertEqual(info["inherited_from"], self.root_page)
        self.assertEqual(len(info["inheritance_chain"]), 3)

    def test_inheritance_conflicts(self):
        """Test inheritance conflict detection"""
        conflicts = self.webdev_page.get_inheritance_conflicts()

        # Should have no conflicts initially
        self.assertEqual(len(conflicts), 0)

    def test_apply_inheritance_override(self):
        """Test applying inheritance overrides"""
        new_layout = PageLayout.objects.create(
            name="Override Layout",
            slot_configuration={"slots": [{"name": "main"}]},
            created_by=self.user,
        )

        # Apply layout override
        success = self.webdev_page.apply_inheritance_override("layout", new_layout)
        self.assertTrue(success)
        self.assertEqual(self.webdev_page.layout, new_layout)

        # Clear layout override
        success = self.webdev_page.apply_inheritance_override("clear_layout")
        self.assertTrue(success)
        self.assertIsNone(self.webdev_page.layout)

    def test_circular_reference_prevention(self):
        """Test that circular references are prevented"""
        with self.assertRaises(ValidationError):
            self.root_page.parent = self.webdev_page
            self.root_page.full_clean()


class WidgetTypeAPITest(APITestCase):
    """Test WidgetType API endpoints"""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

        self.widget_type_data = {
            "name": "API Test Widget",
            "description": "Test widget via API",
            "json_schema": {
                "type": "object",
                "properties": {"title": {"type": "string"}},
            },
            "template_name": "api_test.html",
            "is_active": True,
        }

    def test_create_widget_type(self):
        """Test creating a widget type via API"""
        url = reverse("api:widgettype-list")
        response = self.client.post(url, self.widget_type_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WidgetType.objects.count(), 1)

        widget_type = WidgetType.objects.first()
        self.assertEqual(widget_type.name, "API Test Widget")
        self.assertEqual(widget_type.created_by, self.user)

    def test_list_widget_types(self):
        """Test listing widget types"""
        # Clear any existing widget types first
        WidgetType.objects.all().delete()

        WidgetType.objects.create(
            name="Widget 1",
            description="First widget",
            json_schema={"type": "object"},
            template_name="widget1.html",
            created_by=self.user,
        )

        WidgetType.objects.create(
            name="Widget 2",
            description="Second widget",
            json_schema={"type": "object"},
            template_name="widget2.html",
            is_active=False,
            created_by=self.user,
        )

        url = reverse("api:widgettype-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check that we get paginated results with our 2 widgets
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 2)

    def test_active_widget_types_filter(self):
        """Test filtering active widget types"""
        # Clear any existing widget types first
        WidgetType.objects.all().delete()

        WidgetType.objects.create(
            name="Active Widget",
            description="Active widget",
            json_schema={"type": "object"},
            template_name="active.html",
            is_active=True,
            created_by=self.user,
        )

        WidgetType.objects.create(
            name="Inactive Widget",
            description="Inactive widget",
            json_schema={"type": "object"},
            template_name="inactive.html",
            is_active=False,
            created_by=self.user,
        )

        url = reverse("api:widgettype-active")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # This endpoint should return a list directly (not paginated)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Active Widget")


class PageLayoutAPITest(APITestCase):
    """Test cases for PageLayout API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.layout_data = {
            "name": "Test Layout",
            "description": "A test layout",
            "slot_configuration": {
                "slots": [
                    {
                        "name": "header",
                        "display_name": "Header",
                        "description": "Header area",
                    }
                ]
            },
            "css_classes": ".test { color: red; }",
            "is_active": True,
        }

    def test_create_layout(self):
        """Test creating a layout via API"""
        url = reverse("api:pagelayout-list")
        response = self.client.post(url, self.layout_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PageLayout.objects.count(), 1)

        layout = PageLayout.objects.first()
        self.assertEqual(layout.name, "Test Layout")
        self.assertEqual(layout.created_by, self.user)

    def test_list_layouts(self):
        """Test listing layouts via API"""
        # Create a layout
        layout = PageLayout.objects.create(
            name="Test Layout", slot_configuration={"slots": []}, created_by=self.user
        )

        url = reverse("api:pagelayout-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Debug response structure - API returns paginated results
        self.assertIn("results", response.data)
        self.assertIsInstance(response.data["results"], list)
        self.assertGreaterEqual(len(response.data["results"]), 1)

        # Check that our layout is in the response
        layout_names = [item["name"] for item in response.data["results"]]
        self.assertIn("Test Layout", layout_names)

    def test_get_active_layouts(self):
        """Test getting only active layouts"""
        # Create active and inactive layouts
        PageLayout.objects.create(
            name="Active Layout",
            slot_configuration={"slots": []},
            is_active=True,
            created_by=self.user,
        )
        PageLayout.objects.create(
            name="Inactive Layout",
            slot_configuration={"slots": []},
            is_active=False,
            created_by=self.user,
        )

        url = reverse("api:pagelayout-active")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Active Layout")

    def test_slot_configuration_validation(self):
        """Test slot configuration validation"""
        invalid_data = self.layout_data.copy()
        invalid_data["slot_configuration"] = {"invalid": "structure"}

        url = reverse("api:pagelayout-list")
        response = self.client.post(url, invalid_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PageThemeAPITest(APITestCase):
    """Test cases for PageTheme API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.theme_data = {
            "name": "Test Theme",
            "description": "A test theme",
            "css_variables": {"primary": "#3b82f6", "secondary": "#64748b"},
            "custom_css": ".test { color: var(--primary); }",
            "is_active": True,
        }

    def test_create_theme(self):
        """Test creating a theme via API"""
        url = reverse("api:pagetheme-list")
        response = self.client.post(url, self.theme_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PageTheme.objects.count(), 1)

        theme = PageTheme.objects.first()
        self.assertEqual(theme.name, "Test Theme")
        self.assertEqual(theme.created_by, self.user)

    def test_list_themes(self):
        """Test listing themes via API"""
        # Create a theme
        theme = PageTheme.objects.create(
            name="Test Theme",
            css_variables={"primary": "#3b82f6"},
            created_by=self.user,
        )

        url = reverse("api:pagetheme-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # API returns paginated results
        self.assertIn("results", response.data)
        self.assertIsInstance(response.data["results"], list)
        self.assertGreaterEqual(len(response.data["results"]), 1)

        # Check that our theme is in the response
        theme_names = [item["name"] for item in response.data["results"]]
        self.assertIn("Test Theme", theme_names)

    def test_css_variables_validation(self):
        """Test CSS variables validation"""
        invalid_data = self.theme_data.copy()
        invalid_data["css_variables"] = "invalid_format"

        url = reverse("api:pagetheme-list")
        response = self.client.post(url, invalid_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PageWidgetAPITest(APITestCase):
    """Test PageWidget API endpoints"""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

        self.layout = PageLayout.objects.create(
            name="Test Layout",
            description="A test layout",
            slot_configuration={
                "slots": [
                    {"name": "header", "display_name": "Header"},
                    {"name": "content", "display_name": "Content"},
                ]
            },
            created_by=self.user,
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            layout=self.layout,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.widget_type = WidgetType.objects.create(
            name="Text Block",
            description="A text widget",
            json_schema={
                "type": "object",
                "properties": {"content": {"type": "string"}},
            },
            template_name="text_block.html",
            created_by=self.user,
        )

    def test_create_page_widget(self):
        """Test creating a page widget via API"""
        url = reverse("api:pagewidget-list")
        data = {
            "page": self.page.id,
            "widget_type_id": self.widget_type.id,
            "slot_name": "header",
            "sort_order": 0,
            "configuration": {"content": "Hello World"},
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PageWidget.objects.count(), 1)

        widget = PageWidget.objects.first()
        self.assertEqual(widget.page, self.page)
        self.assertEqual(widget.configuration["content"], "Hello World")

    def test_get_widgets_by_page(self):
        """Test getting widgets for a specific page"""
        PageWidget.objects.create(
            page=self.page,
            widget_type=self.widget_type,
            slot_name="header",
            sort_order=0,
            configuration={"content": "Header Content"},
            created_by=self.user,
        )

        PageWidget.objects.create(
            page=self.page,
            widget_type=self.widget_type,
            slot_name="content",
            sort_order=0,
            configuration={"content": "Main Content"},
            created_by=self.user,
        )

        url = reverse("api:pagewidget-by-page")
        response = self.client.get(url, {"page_id": self.page.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["widgets"]), 2)

    def test_reorder_widget(self):
        """Test reordering widgets via API"""
        widget = PageWidget.objects.create(
            page=self.page,
            widget_type=self.widget_type,
            slot_name="header",
            sort_order=0,
            configuration={"content": "Test Content"},
            created_by=self.user,
        )

        url = reverse("api:pagewidget-reorder", kwargs={"pk": widget.id})
        response = self.client.post(url, {"sort_order": 5}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        widget.refresh_from_db()
        self.assertEqual(widget.sort_order, 5)


class WebPageAPITest(APITestCase):
    """Test cases for WebPage API endpoints including Phase 3 features"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Create layout and theme
        self.layout = PageLayout.objects.create(
            name="Test Layout",
            slot_configuration={"slots": [{"name": "main"}]},
            created_by=self.user,
        )

        self.theme = PageTheme.objects.create(
            name="Test Theme",
            css_variables={"primary": "#3b82f6"},
            created_by=self.user,
        )

        # Create test page
        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            layout=self.layout,
            theme=self.theme,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_page_preview_endpoint(self):
        """Test the page preview API endpoint"""
        url = reverse("api:webpage-preview", kwargs={"pk": self.page.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check response structure
        self.assertIn("page", response.data)
        self.assertIn("effective_layout", response.data)
        self.assertIn("effective_theme", response.data)
        self.assertIn("widgets_by_slot", response.data)

        # Check that effective layout and theme are returned
        self.assertEqual(response.data["effective_layout"]["name"], "Test Layout")
        self.assertEqual(response.data["effective_theme"]["name"], "Test Theme")

    def test_page_preview_with_overrides(self):
        """Test page preview with layout and theme overrides"""
        # Create alternative layout and theme
        alt_layout = PageLayout.objects.create(
            name="Alt Layout",
            slot_configuration={"slots": [{"name": "sidebar"}]},
            created_by=self.user,
        )

        alt_theme = PageTheme.objects.create(
            name="Alt Theme", css_variables={"primary": "#ef4444"}, created_by=self.user
        )

        url = reverse("api:webpage-preview", kwargs={"pk": self.page.pk})
        response = self.client.get(
            url, {"layout_id": alt_layout.id, "theme_id": alt_theme.id}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check that overrides are applied
        self.assertEqual(response.data["effective_layout"]["name"], "Alt Layout")
        self.assertEqual(response.data["effective_theme"]["name"], "Alt Theme")

    def test_inheritance_info_endpoint(self):
        """Test the inheritance info API endpoint"""
        url = reverse("api:webpage-inheritance-info", kwargs={"pk": self.page.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check response structure
        self.assertIn("page_id", response.data)
        self.assertIn("inheritance_chain", response.data)
        self.assertIn("layout_info", response.data)
        self.assertIn("theme_info", response.data)
        self.assertIn("widgets_info", response.data)
        self.assertIn("conflicts", response.data)

        self.assertEqual(response.data["page_id"], self.page.id)

    def test_apply_override_endpoint(self):
        """Test the apply override API endpoint"""
        alt_layout = PageLayout.objects.create(
            name="Override Layout",
            slot_configuration={"slots": [{"name": "content"}]},
            created_by=self.user,
        )

        url = reverse("api:webpage-apply-override", kwargs={"pk": self.page.pk})
        response = self.client.post(
            url,
            {"override_type": "layout", "override_value": alt_layout.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        # Verify the override was applied
        self.page.refresh_from_db()
        self.assertEqual(self.page.layout, alt_layout)

    def test_apply_clear_override(self):
        """Test clearing an override via API"""
        url = reverse("api:webpage-apply-override", kwargs={"pk": self.page.pk})
        response = self.client.post(
            url, {"override_type": "clear_layout"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        # Verify the override was cleared
        self.page.refresh_from_db()
        self.assertIsNone(self.page.layout)


class WidgetInheritanceTest(TestCase):
    """Test cases for widget inheritance functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create widget type
        self.widget_type = WidgetType.objects.create(
            name="TextBlock",
            description="Text content widget",
            json_schema={
                "type": "object",
                "properties": {"content": {"type": "string"}},
            },
            template_name="widgets/text_block.html",
            created_by=self.user,
        )

        # Create layout
        self.layout = PageLayout.objects.create(
            name="Test Layout",
            slot_configuration={
                "slots": [
                    {"name": "main", "allows_multiple": True},
                    {"name": "sidebar", "allows_multiple": False},
                ]
            },
            created_by=self.user,
        )

        # Create page hierarchy
        self.parent_page = WebPage.objects.create(
            title="Parent Page",
            slug="parent",
            layout=self.layout,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.child_page = WebPage.objects.create(
            title="Child Page",
            slug="child",
            parent=self.parent_page,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create widgets on parent page
        self.parent_widget = PageWidget.objects.create(
            page=self.parent_page,
            widget_type=self.widget_type,
            slot_name="main",
            sort_order=0,
            configuration={"content": "Parent content"},
            inherit_from_parent=True,
            created_by=self.user,
        )

    def test_widgets_inheritance_info(self):
        """Test getting widget inheritance information"""
        info = self.child_page.get_widgets_inheritance_info()

        # Should have info for both slots
        self.assertIn("main", info)
        self.assertIn("sidebar", info)

        # Main slot should have inherited widget
        main_info = info["main"]
        self.assertEqual(len(main_info["widgets"]), 1)

        widget_info = main_info["widgets"][0]
        self.assertEqual(widget_info["widget"], self.parent_widget)
        self.assertEqual(widget_info["inherited_from"], self.parent_page)
        self.assertFalse(widget_info["is_override"])

    def test_widget_override(self):
        """Test widget override functionality"""
        # Create override widget on child page
        override_widget = PageWidget.objects.create(
            page=self.child_page,
            widget_type=self.widget_type,
            slot_name="main",
            sort_order=0,
            configuration={"content": "Child override content"},
            override_parent=True,
            created_by=self.user,
        )

        info = self.child_page.get_widgets_inheritance_info()
        main_info = info["main"]

        # Should have both widgets - the inherited one and the override
        self.assertEqual(len(main_info["widgets"]), 2)

        # Check that we have both widgets
        widget_ids = [w["widget"].id for w in main_info["widgets"]]
        self.assertIn(self.parent_widget.id, widget_ids)
        self.assertIn(override_widget.id, widget_ids)

        # Check that the override widget is marked correctly
        override_widget_info = next(
            w for w in main_info["widgets"] if w["widget"].id == override_widget.id
        )
        self.assertTrue(override_widget_info["is_override"])

    def test_widget_inheritance_flag(self):
        """Test widget inherit_from_parent flag"""
        # Create inheritable widget on parent
        parent_widget = PageWidget.objects.create(
            page=self.parent_page,
            widget_type=self.widget_type,
            slot_name="sidebar",
            sort_order=0,
            configuration={"content": "Parent Content"},
            inherit_from_parent=True,
            created_by=self.user,
        )

        # Create non-inheritable widget on parent
        non_inherit_widget = PageWidget.objects.create(
            page=self.parent_page,
            widget_type=self.widget_type,
            slot_name="sidebar",
            sort_order=1,
            configuration={"content": "Non-inherit Content"},
            inherit_from_parent=False,
            created_by=self.user,
        )

        self.assertTrue(parent_widget.inherit_from_parent)
        self.assertFalse(non_inherit_widget.inherit_from_parent)

    def test_widget_override_flag(self):
        """Test widget override_parent flag"""
        # Create widget that overrides parent
        override_widget = PageWidget.objects.create(
            page=self.child_page,
            widget_type=self.widget_type,
            slot_name="sidebar",
            sort_order=0,
            configuration={"content": "Override Content"},
            override_parent=True,
            created_by=self.user,
        )

        self.assertTrue(override_widget.override_parent)


class SeededWidgetTypesTest(TestCase):
    """Test the seeded widget types from management command"""

    def setUp(self):
        from django.core.management import call_command

        call_command("seed_widget_types")

    def test_seeded_widget_types_exist(self):
        """Test that basic widget types are seeded correctly"""
        expected_widgets = ["Text Block", "Image", "Button", "Spacer", "HTML Block"]

        for widget_name in expected_widgets:
            self.assertTrue(
                WidgetType.objects.filter(name=widget_name).exists(),
                f"Widget type '{widget_name}' should exist",
            )

    def test_text_block_schema(self):
        """Test Text Block widget schema is correct"""
        text_widget = WidgetType.objects.get(name="Text Block")
        schema = text_widget.json_schema

        self.assertEqual(schema["type"], "object")
        self.assertIn("content", schema["properties"])
        self.assertIn("content", schema["required"])
        self.assertEqual(schema["properties"]["content"]["type"], "string")

    def test_image_widget_schema(self):
        """Test Image widget schema is correct"""
        image_widget = WidgetType.objects.get(name="Image")
        schema = image_widget.json_schema

        required_fields = ["image_url", "alt_text"]
        for field in required_fields:
            self.assertIn(field, schema["required"])
            self.assertIn(field, schema["properties"])

    def test_button_widget_schema(self):
        """Test Button widget schema is correct"""
        button_widget = WidgetType.objects.get(name="Button")
        schema = button_widget.json_schema

        required_fields = ["text", "url"]
        for field in required_fields:
            self.assertIn(field, schema["required"])
            self.assertIn(field, schema["properties"])

        # Test enum fields
        self.assertIn("style", schema["properties"])
        self.assertEqual(
            schema["properties"]["style"]["enum"], ["primary", "secondary", "outline"]
        )

    def test_all_seeded_widgets_are_active(self):
        """Test all seeded widgets are active by default"""
        seeded_widgets = WidgetType.objects.all()
        for widget in seeded_widgets:
            self.assertTrue(
                widget.is_active, f"Widget '{widget.name}' should be active"
            )

    def test_seeded_widgets_have_templates(self):
        """Test all seeded widgets have template names assigned"""
        seeded_widgets = WidgetType.objects.all()
        for widget in seeded_widgets:
            self.assertTrue(
                widget.template_name,
                f"Widget '{widget.name}' should have a template name",
            )
            self.assertTrue(
                widget.template_name.startswith("webpages/widgets/"),
                f"Widget '{widget.name}' template should be in correct directory",
            )
