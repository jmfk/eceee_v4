from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.test import override_settings
import json

from .models import WebPage, PageTheme, WidgetType, PageVersion


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


# PageLayoutModelTest removed - now using code-based layouts only


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

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            code_layout="single_column",  # Using code-based layout
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

        # Create theme
        self.theme = PageTheme.objects.create(
            name="Default Theme",
            css_variables={"primary": "#3b82f6"},
            created_by=self.user,
        )

        # Create page hierarchy: root -> services -> web-dev
        self.root_page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            code_layout="two_column",  # Using code-based layout
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
        """Test that pages inherit code layout from parent"""
        # Services page should inherit layout from root
        effective_layout = self.services_page.get_effective_layout()
        self.assertIsNotNone(effective_layout)
        self.assertEqual(effective_layout.name, "two_column")

        # Web dev page should inherit layout from root (through services)
        effective_layout = self.webdev_page.get_effective_layout()
        self.assertIsNotNone(effective_layout)
        self.assertEqual(effective_layout.name, "two_column")

        # Test override with different code layout
        self.services_page.code_layout = "single_column"
        self.services_page.save()

        # Services should now use new layout
        effective_layout = self.services_page.get_effective_layout()
        self.assertIsNotNone(effective_layout)
        self.assertEqual(effective_layout.name, "single_column")

        # Web dev should inherit new layout from services
        effective_layout = self.webdev_page.get_effective_layout()
        self.assertIsNotNone(effective_layout)
        self.assertEqual(effective_layout.name, "single_column")

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
        """Test getting detailed code layout inheritance information"""
        info = self.webdev_page.get_layout_inheritance_info()

        self.assertIsNotNone(info["effective_layout"])
        self.assertEqual(info["effective_layout_dict"]["name"], "two_column")
        self.assertEqual(info["layout_type"], "code")
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
        """Test applying code layout inheritance overrides"""
        # Apply layout override with code layout name
        success = self.webdev_page.apply_inheritance_override("layout", "single_column")
        self.assertTrue(success)
        self.assertEqual(self.webdev_page.code_layout, "single_column")

        # Clear layout override
        success = self.webdev_page.apply_inheritance_override("clear_layout")
        self.assertTrue(success)
        self.assertEqual(self.webdev_page.code_layout, "")

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


# PageLayoutAPITest removed - now using code-based layouts only


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

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            code_layout="single_column",  # Using code-based layout
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


class WebPageHostnameTest(TestCase):
    """Test WebPage hostname functionality for multi-site support"""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_root_page_can_have_hostnames(self):
        """Test that root pages can have hostnames"""
        page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            hostnames=["example.com", "www.example.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertTrue(page.is_root_page())
        self.assertEqual(page.hostnames, ["example.com", "www.example.com"])
        self.assertEqual(page.get_hostname_display(), "example.com, www.example.com")

    def test_child_page_cannot_have_hostnames(self):
        """Test that child pages cannot have hostnames"""
        root_page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            child_page = WebPage(
                title="Child Page",
                slug="child",
                parent=root_page,
                hostnames=["child.example.com"],
                created_by=self.user,
                last_modified_by=self.user,
            )
            child_page.clean()

        self.assertIn("Only root pages", str(context.exception))

    def test_hostname_format_validation(self):
        """Test hostname format validation"""
        # Valid hostnames should work
        page = WebPage(
            title="Test Page",
            slug="test",
            hostnames=["example.com", "sub.example.com", "*", "default"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        try:
            page.clean()  # Should not raise
        except ValidationError:
            self.fail("Valid hostnames should not raise ValidationError")

        # Invalid hostname should fail
        invalid_page = WebPage(
            title="Invalid Page",
            slug="invalid",
            hostnames=["invalid..hostname"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            invalid_page.clean()

        self.assertIn("Invalid hostname format", str(context.exception))

    def test_hostname_conflict_prevention(self):
        """Test that hostname conflicts are prevented"""
        # Create first page with hostname
        page1 = WebPage.objects.create(
            title="Page 1",
            slug="page1",
            hostnames=["example.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Try to create second page with same hostname
        page2 = WebPage(
            title="Page 2",
            slug="page2",
            hostnames=["example.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            page2.clean()

        self.assertIn("already used by page", str(context.exception))

    def test_add_hostname_to_root_page(self):
        """Test adding hostname to root page"""
        page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            hostnames=["example.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        result = page.add_hostname("new.example.com")
        self.assertTrue(result)
        page.refresh_from_db()
        self.assertIn("new.example.com", page.hostnames)

        # Adding duplicate should not create duplicate
        page.add_hostname("example.com")
        page.refresh_from_db()
        hostname_count = page.hostnames.count("example.com")
        self.assertEqual(hostname_count, 1)

    def test_add_hostname_to_child_page_fails(self):
        """Test that adding hostname to child page fails"""
        root_page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            created_by=self.user,
            last_modified_by=self.user,
        )

        child_page = WebPage.objects.create(
            title="Child Page",
            slug="child",
            parent=root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError):
            child_page.add_hostname("child.example.com")

    def test_remove_hostname(self):
        """Test removing hostname from page"""
        page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            hostnames=["example.com", "www.example.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        result = page.remove_hostname("www.example.com")
        self.assertTrue(result)
        page.refresh_from_db()
        self.assertNotIn("www.example.com", page.hostnames)
        self.assertIn("example.com", page.hostnames)

    def test_serves_hostname_method(self):
        """Test serves_hostname method"""
        root_page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            hostnames=["example.com", "www.example.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        child_page = WebPage.objects.create(
            title="Child Page",
            slug="child",
            parent=root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Root page should serve its hostnames
        self.assertTrue(root_page.serves_hostname("example.com"))
        self.assertTrue(root_page.serves_hostname("www.example.com"))
        self.assertFalse(root_page.serves_hostname("other.com"))

        # Child page should not serve any hostnames
        self.assertFalse(child_page.serves_hostname("example.com"))

    def test_serves_hostname_case_insensitive(self):
        """Test that hostname matching is case insensitive"""
        page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            hostnames=["Example.Com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertTrue(page.serves_hostname("example.com"))
        self.assertTrue(page.serves_hostname("EXAMPLE.COM"))
        self.assertTrue(page.serves_hostname("Example.Com"))

    def test_get_root_page_for_hostname(self):
        """Test get_root_page_for_hostname class method"""
        page1 = WebPage.objects.create(
            title="Site 1",
            slug="site1",
            hostnames=["site1.com", "www.site1.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        page2 = WebPage.objects.create(
            title="Site 2",
            slug="site2",
            hostnames=["site2.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Test exact hostname matches
        found_page1 = WebPage.get_root_page_for_hostname("site1.com")
        self.assertEqual(found_page1.id, page1.id)

        found_page2 = WebPage.get_root_page_for_hostname("site2.com")
        self.assertEqual(found_page2.id, page2.id)

        # Test non-existent hostname
        not_found = WebPage.get_root_page_for_hostname("nonexistent.com")
        self.assertIsNone(not_found)

    def test_get_root_page_for_hostname_wildcard(self):
        """Test wildcard hostname support"""
        wildcard_page = WebPage.objects.create(
            title="Wildcard Site",
            slug="wildcard",
            hostnames=["*"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        default_page = WebPage.objects.create(
            title="Default Site",
            slug="default",
            hostnames=["default"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Test that wildcard matches unknown hostnames
        found_page = WebPage.get_root_page_for_hostname("unknown.com")
        self.assertIsNotNone(found_page)
        self.assertIn(found_page.hostnames[0], ["*", "default"])

    def test_get_all_hostnames(self):
        """Test get_all_hostnames class method"""
        page1 = WebPage.objects.create(
            title="Site 1",
            slug="site1",
            hostnames=["site1.com", "www.site1.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        page2 = WebPage.objects.create(
            title="Site 2",
            slug="site2",
            hostnames=["site2.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        all_hostnames = WebPage.get_all_hostnames()

        self.assertIn("site1.com", all_hostnames)
        self.assertIn("www.site1.com", all_hostnames)
        self.assertIn("site2.com", all_hostnames)
        self.assertEqual(len(set(all_hostnames)), len(all_hostnames))  # No duplicates

    def test_hostname_display_method(self):
        """Test get_hostname_display method"""
        # Page with no hostnames
        empty_page = WebPage.objects.create(
            title="Empty Page",
            slug="empty",
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.assertEqual(empty_page.get_hostname_display(), "No hostnames")

        # Page with hostnames
        page_with_hostnames = WebPage.objects.create(
            title="Page With Hostnames",
            slug="with-hostnames",
            hostnames=["example.com", "www.example.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )
        expected = "example.com, www.example.com"
        self.assertEqual(page_with_hostnames.get_hostname_display(), expected)

    def test_hostname_validation_edge_cases(self):
        """Test edge cases in hostname validation"""
        # Empty string hostname should fail
        page_empty_hostname = WebPage(
            title="Empty Hostname",
            slug="empty-hostname",
            hostnames=[""],
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError):
            page_empty_hostname.clean()

        # Non-string hostname should fail
        page_invalid_type = WebPage(
            title="Invalid Type",
            slug="invalid-type",
            hostnames=[123],
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError):
            page_invalid_type.clean()

    def test_version_includes_hostnames(self):
        """Test that page versions include hostname data"""
        page = WebPage.objects.create(
            title="Versioned Page",
            slug="versioned",
            hostnames=["version.example.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create a version
        version = page.create_version(self.user, "Initial version")

        # Check that hostname data is included in version
        page_data = version.page_data
        self.assertIn("hostnames", page_data)
        self.assertEqual(page_data["hostnames"], ["version.example.com"])

        # Modify hostnames and create new version
        page.hostnames = ["new.example.com", "version.example.com"]
        page.save()

        new_version = page.create_version(self.user, "Updated hostnames")
        new_page_data = new_version.page_data
        self.assertEqual(
            new_page_data["hostnames"], ["new.example.com", "version.example.com"]
        )

    def test_is_root_page_method(self):
        """Test is_root_page method"""
        root_page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            created_by=self.user,
            last_modified_by=self.user,
        )

        child_page = WebPage.objects.create(
            title="Child Page",
            slug="child",
            parent=root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertTrue(root_page.is_root_page())
        self.assertFalse(child_page.is_root_page())

    def test_hostname_operations_integration(self):
        """Test integration of all hostname operations"""
        # Create site with initial hostname
        site = WebPage.objects.create(
            title="Integration Test Site",
            slug="integration",
            hostnames=["initial.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Add additional hostnames
        site.add_hostname("www.initial.com")
        site.add_hostname("alt.initial.com")

        # Verify all hostnames are present
        site.refresh_from_db()
        self.assertEqual(len(site.hostnames), 3)
        self.assertIn("initial.com", site.hostnames)
        self.assertIn("www.initial.com", site.hostnames)
        self.assertIn("alt.initial.com", site.hostnames)

        # Test hostname resolution
        found = WebPage.get_root_page_for_hostname("www.initial.com")
        self.assertEqual(found.id, site.id)

        # Remove a hostname
        site.remove_hostname("alt.initial.com")
        site.refresh_from_db()
        self.assertEqual(len(site.hostnames), 2)
        self.assertNotIn("alt.initial.com", site.hostnames)

        # Verify the site still serves other hostnames
        self.assertTrue(site.serves_hostname("initial.com"))
        self.assertTrue(site.serves_hostname("www.initial.com"))
        self.assertFalse(site.serves_hostname("alt.initial.com"))


@override_settings(ALLOWED_HOSTS=["*"])
class HostnameViewTest(TestCase):
    """Test hostname-aware view functionality for multi-site routing"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_superuser(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create test sites with different hostnames
        self.site1 = WebPage.objects.create(
            title="Main Site",
            slug="main-site",
            hostnames=["example.com", "www.example.com"],
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.site2 = WebPage.objects.create(
            title="Blog Site",
            slug="blog-site",
            hostnames=["blog.example.com"],
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create child pages for site1
        self.about_page = WebPage.objects.create(
            title="About Us",
            slug="about",
            parent=self.site1,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.team_page = WebPage.objects.create(
            title="Our Team",
            slug="team",
            parent=self.about_page,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create child pages for site2
        self.blog_post = WebPage.objects.create(
            title="First Post",
            slug="first-post",
            parent=self.site2,
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_hostname_root_resolution(self):
        """Test that domain root resolves to correct root page based on hostname"""
        # Test main site root
        response = self.client.get("/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page"].id, self.site1.id)
        self.assertEqual(response.context["current_hostname"], "example.com")
        self.assertTrue(response.context["is_root_page"])

        # Test www variant
        response = self.client.get("/", HTTP_HOST="www.example.com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page"].id, self.site1.id)

        # Test blog site root
        response = self.client.get("/", HTTP_HOST="blog.example.com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page"].id, self.site2.id)
        self.assertEqual(response.context["current_hostname"], "blog.example.com")

    def test_hostname_hierarchical_page_resolution(self):
        """Test that hierarchical paths resolve correctly within hostname context"""
        # Test about page on main site
        response = self.client.get("/about/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page"].id, self.about_page.id)
        self.assertEqual(response.context["site_root_page"].id, self.site1.id)
        self.assertFalse(response.context["is_root_page"])

        # Test nested team page on main site
        response = self.client.get("/about/team/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page"].id, self.team_page.id)
        self.assertEqual(response.context["site_root_page"].id, self.site1.id)

        # Test blog post on blog site
        response = self.client.get("/first-post/", HTTP_HOST="blog.example.com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page"].id, self.blog_post.id)
        self.assertEqual(response.context["site_root_page"].id, self.site2.id)

    def test_hostname_isolation(self):
        """Test that pages are isolated between different hostnames"""
        # About page should not be accessible on blog site
        response = self.client.get("/about/", HTTP_HOST="blog.example.com")
        self.assertEqual(response.status_code, 404)

        # Blog post should not be accessible on main site
        response = self.client.get("/first-post/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 404)

    def test_unknown_hostname(self):
        """Test handling of unknown hostnames"""
        response = self.client.get("/", HTTP_HOST="unknown.com")
        self.assertEqual(response.status_code, 404)

        response = self.client.get("/about/", HTTP_HOST="unknown.com")
        self.assertEqual(response.status_code, 404)

    def test_nonexistent_page(self):
        """Test 404 handling for nonexistent pages"""
        response = self.client.get("/nonexistent/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 404)

        response = self.client.get("/about/nonexistent/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 404)

    def test_unpublished_page_handling(self):
        """Test that unpublished pages return 404"""
        # Create unpublished page
        unpublished_page = WebPage.objects.create(
            title="Unpublished Page",
            slug="unpublished",
            parent=self.site1,
            publication_status="unpublished",
            created_by=self.user,
            last_modified_by=self.user,
        )

        response = self.client.get("/unpublished/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 404)

    def test_scheduled_page_handling(self):
        """Test that pages scheduled for future return 404"""
        from django.utils import timezone
        from datetime import timedelta

        # Create page scheduled for future
        future_date = timezone.now() + timedelta(days=1)
        scheduled_page = WebPage.objects.create(
            title="Future Page",
            slug="future",
            parent=self.site1,
            publication_status="published",
            effective_date=future_date,
            created_by=self.user,
            last_modified_by=self.user,
        )

        response = self.client.get("/future/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 404)

    def test_expired_page_handling(self):
        """Test that expired pages return 404"""
        from django.utils import timezone
        from datetime import timedelta

        # Create expired page
        past_date = timezone.now() - timedelta(days=1)
        expired_page = WebPage.objects.create(
            title="Expired Page",
            slug="expired",
            parent=self.site1,
            publication_status="published",
            expiry_date=past_date,
            created_by=self.user,
            last_modified_by=self.user,
        )

        response = self.client.get("/expired/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 404)

    def test_breadcrumbs_in_hostname_context(self):
        """Test that breadcrumbs work correctly in hostname context"""
        response = self.client.get("/about/team/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 200)

        breadcrumbs = response.context["breadcrumbs"]
        self.assertEqual(len(breadcrumbs), 3)
        self.assertEqual(breadcrumbs[0].id, self.site1.id)  # Root
        self.assertEqual(breadcrumbs[1].id, self.about_page.id)  # About
        self.assertEqual(breadcrumbs[2].id, self.team_page.id)  # Team

    def test_case_insensitive_hostname_matching(self):
        """Test that hostname matching is case insensitive"""
        response = self.client.get("/", HTTP_HOST="EXAMPLE.COM")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page"].id, self.site1.id)

        response = self.client.get("/", HTTP_HOST="Blog.Example.Com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page"].id, self.site2.id)

    def test_wildcard_hostname_support(self):
        """Test wildcard hostname fallback"""
        # Create wildcard site
        wildcard_site = WebPage.objects.create(
            title="Wildcard Site",
            slug="wildcard",
            hostnames=["*"],
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Test unknown hostname falls back to wildcard
        response = self.client.get("/", HTTP_HOST="random.com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page"].id, wildcard_site.id)

    def test_template_name_resolution(self):
        """Test that template names include hostname-specific paths"""
        # Test that the view works and can find appropriate templates
        response = self.client.get("/about/", HTTP_HOST="example.com")
        self.assertEqual(response.status_code, 200)

        # Test that the view context contains hostname information
        self.assertEqual(response.context["current_hostname"], "example.com")
        self.assertEqual(response.context["page"].slug, "about")

        # Test with different hostname
        response2 = self.client.get("/first-post/", HTTP_HOST="blog.example.com")
        self.assertEqual(response2.status_code, 200)
        self.assertEqual(response2.context["current_hostname"], "blog.example.com")

        # The template resolution works if we get 200 responses with correct context


class HostnameNormalizationTest(TestCase):
    """Test hostname normalization functionality for development and production use"""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_normalize_hostname_basic(self):
        """Test basic hostname normalization"""
        # Test normal hostnames
        self.assertEqual(WebPage.normalize_hostname("example.com"), "example.com")
        self.assertEqual(WebPage.normalize_hostname("EXAMPLE.COM"), "example.com")
        self.assertEqual(
            WebPage.normalize_hostname("www.Example.Com"), "www.example.com"
        )

    def test_normalize_hostname_with_ports(self):
        """Test hostname normalization with port numbers"""
        self.assertEqual(WebPage.normalize_hostname("localhost:8000"), "localhost:8000")
        self.assertEqual(
            WebPage.normalize_hostname("example.com:3000"), "example.com:3000"
        )
        self.assertEqual(
            WebPage.normalize_hostname("dev.site.com:8080"), "dev.site.com:8080"
        )

    def test_normalize_hostname_with_http_prefix(self):
        """Test stripping HTTP/HTTPS prefixes"""
        self.assertEqual(
            WebPage.normalize_hostname("http://example.com"), "example.com"
        )
        self.assertEqual(
            WebPage.normalize_hostname("https://example.com"), "example.com"
        )
        self.assertEqual(
            WebPage.normalize_hostname("http://localhost:8000"), "localhost:8000"
        )
        self.assertEqual(
            WebPage.normalize_hostname("https://dev.site.com:3000"), "dev.site.com:3000"
        )

    def test_normalize_hostname_with_paths(self):
        """Test stripping paths and query parameters"""
        self.assertEqual(WebPage.normalize_hostname("example.com/path"), "example.com")
        self.assertEqual(
            WebPage.normalize_hostname("http://example.com/admin/"), "example.com"
        )
        self.assertEqual(
            WebPage.normalize_hostname("localhost:8000/path/to/page"), "localhost:8000"
        )
        self.assertEqual(
            WebPage.normalize_hostname("example.com?param=value"), "example.com"
        )
        self.assertEqual(
            WebPage.normalize_hostname("example.com#fragment"), "example.com"
        )
        self.assertEqual(
            WebPage.normalize_hostname("example.com/path?param=value#fragment"),
            "example.com",
        )

    def test_normalize_hostname_complex_cases(self):
        """Test complex normalization cases"""
        cases = [
            (
                "https://WWW.EXAMPLE.COM:8080/admin/pages/?tab=all#top",
                "www.example.com:8080",
            ),
            ("HTTP://Dev.Site.COM:3000/", "dev.site.com:3000"),
            ("localhost:8000/webpages/", "localhost:8000"),
            ("  https://example.com/  ", "example.com"),
        ]

        for input_hostname, expected in cases:
            with self.subTest(input=input_hostname):
                self.assertEqual(WebPage.normalize_hostname(input_hostname), expected)

    def test_normalize_hostname_edge_cases(self):
        """Test edge cases for hostname normalization"""
        self.assertEqual(WebPage.normalize_hostname(""), "")
        self.assertEqual(WebPage.normalize_hostname(None), "")
        self.assertEqual(WebPage.normalize_hostname("   "), "")
        self.assertEqual(WebPage.normalize_hostname(123), "")

    def test_hostname_validation_with_ports(self):
        """Test that hostname validation accepts valid ports"""
        page = WebPage(
            title="Test Page",
            slug="test",
            hostnames=["localhost:8000", "example.com:3000", "dev.site.com:8080"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        try:
            page.clean()  # Should not raise
        except ValidationError:
            self.fail("Valid hostnames with ports should not raise ValidationError")

    def test_hostname_validation_invalid_ports(self):
        """Test that invalid port numbers are rejected"""
        # Port too high
        invalid_page = WebPage(
            title="Invalid Page",
            slug="invalid",
            hostnames=["example.com:99999"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            invalid_page.clean()

        self.assertIn("Port number must be between 1-65535", str(context.exception))

        # Port of 0
        invalid_page2 = WebPage(
            title="Invalid Page 2",
            slug="invalid2",
            hostnames=["example.com:0"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            invalid_page2.clean()

        self.assertIn("Port number must be between 1-65535", str(context.exception))

    def test_add_hostname_with_normalization(self):
        """Test that add_hostname automatically normalizes input"""
        page = WebPage.objects.create(
            title="Test Page",
            slug="test",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Add various formats that should all normalize to the same thing
        page.add_hostname("http://example.com/path")
        page.add_hostname("HTTPS://Example.Com:8080/admin/")
        page.add_hostname("localhost:3000")

        page.refresh_from_db()
        expected_hostnames = ["example.com", "example.com:8080", "localhost:3000"]
        self.assertEqual(set(page.hostnames), set(expected_hostnames))

    def test_serves_hostname_with_normalization(self):
        """Test that serves_hostname works with different hostname formats"""
        page = WebPage.objects.create(
            title="Test Page",
            slug="test",
            hostnames=["example.com", "localhost:8000"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Test various formats that should match
        self.assertTrue(page.serves_hostname("example.com"))
        self.assertTrue(page.serves_hostname("EXAMPLE.COM"))
        self.assertTrue(page.serves_hostname("http://example.com"))
        self.assertTrue(page.serves_hostname("https://example.com/path"))

        self.assertTrue(page.serves_hostname("localhost:8000"))
        self.assertTrue(page.serves_hostname("http://localhost:8000"))
        self.assertTrue(page.serves_hostname("https://localhost:8000/admin/"))

        # Test non-matching hostnames
        self.assertFalse(page.serves_hostname("other.com"))
        self.assertFalse(page.serves_hostname("localhost:3000"))

    def test_get_root_page_for_hostname_normalization(self):
        """Test hostname resolution with normalization"""
        page = WebPage.objects.create(
            title="Dev Site",
            slug="dev-site",
            hostnames=["localhost:8000"],
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Test various input formats
        test_cases = [
            "localhost:8000",
            "http://localhost:8000",
            "https://localhost:8000/admin/",
            "HTTP://LOCALHOST:8000/path/?param=value#fragment",
        ]

        for hostname_input in test_cases:
            with self.subTest(hostname=hostname_input):
                found_page = WebPage.get_root_page_for_hostname(hostname_input)
                self.assertEqual(found_page.id, page.id)

    def test_hostname_conflict_prevention_with_normalization(self):
        """Test that hostname conflicts are detected even with different formats"""
        # Create first page
        page1 = WebPage.objects.create(
            title="Page 1",
            slug="page1",
            hostnames=["example.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Try to create second page with same hostname in different format
        page2 = WebPage(
            title="Page 2",
            slug="page2",
            hostnames=["http://example.com/path"],  # Should normalize to example.com
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            page2.clean()

        self.assertIn("already used by page", str(context.exception))

    def test_development_workflow_example(self):
        """Test a realistic development workflow with various hostname formats"""
        # Create a development site
        dev_site = WebPage.objects.create(
            title="Development Site",
            slug="dev",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Add hostnames as a developer might
        dev_site.add_hostname("http://localhost:8000")
        dev_site.add_hostname("https://dev.mysite.com:3000/")
        dev_site.add_hostname("192.168.1.100:8080")

        dev_site.refresh_from_db()
        expected = ["localhost:8000", "dev.mysite.com:3000", "192.168.1.100:8080"]
        self.assertEqual(set(dev_site.hostnames), set(expected))

        # Test that all formats work for resolution
        test_hostnames = [
            "localhost:8000",
            "http://localhost:8000/admin/",
            "dev.mysite.com:3000",
            "https://dev.mysite.com:3000/webpages/",
        ]

        for hostname in test_hostnames:
            with self.subTest(hostname=hostname):
                self.assertTrue(dev_site.serves_hostname(hostname))
