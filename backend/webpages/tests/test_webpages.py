"""
Tests for the Web Page Publishing System

Updated to test code-based widget types instead of database WidgetType model.
"""

from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.test import override_settings
import json

from webpages.models import WebPage, PageTheme, PageVersion
from webpages.widget_registry import widget_type_registry


class WidgetRegistryTest(TestCase):
    """Test code-based widget registry functionality"""

    def test_widget_registry_has_built_in_widgets(self):
        """Test that built-in widgets are registered"""
        widget_names = widget_type_registry.get_widget_names()

        # Check that basic widgets are registered (updated names)
        expected_widgets = ["Content", "Image", "Header", "Footer", "Navigation"]
        for widget_name in expected_widgets:
            self.assertIn(widget_name, widget_names)

    def test_get_widget_type_by_name(self):
        """Test retrieving widget types by name"""
        content_widget = widget_type_registry.get_widget_type("Content")
        self.assertIsNotNone(content_widget)
        self.assertEqual(content_widget.name, "Content")
        # Test the widget class name
        self.assertEqual(content_widget.__class__.__name__, "ContentWidget")

    def test_widget_type_validation(self):
        """Test widget configuration validation"""
        content_widget = widget_type_registry.get_widget_type("Content")

        # Valid configuration
        valid_config = {"content": "Hello World", "text_align": "left"}
        is_valid, errors = content_widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

        # Invalid configuration (missing required field)
        invalid_config = {"alignment": "left"}  # missing content
        is_valid, errors = text_widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_widget_configuration_defaults(self):
        """Test getting default configuration values"""
        text_widget = widget_type_registry.get_widget_type("Text Block")
        defaults = text_widget.get_configuration_defaults()

        self.assertIsInstance(defaults, dict)
        # Text widget should have default alignment
        self.assertEqual(defaults.get("alignment"), "left")
        self.assertEqual(defaults.get("style"), "normal")

    def test_widget_to_dict(self):
        """Test widget type dictionary representation"""
        image_widget = widget_type_registry.get_widget_type("Image")
        widget_dict = image_widget.to_dict()

        self.assertEqual(widget_dict["name"], "Image")
        self.assertIn("description", widget_dict)
        self.assertIn("template_name", widget_dict)
        self.assertIn("configuration_schema", widget_dict)
        self.assertTrue(widget_dict["is_active"])


class WidgetTypeAPITest(APITestCase):
    """Test widget type API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

    def test_list_widget_types(self):
        """Test listing all widget types"""
        url = reverse("api:widgettype-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

        # Should have multiple widget types
        self.assertGreater(len(response.data), 0)

        # Check structure of first widget type
        widget_type = response.data[0]
        required_fields = [
            "name",
            "description",
            "template_name",
            "is_active",
            "configuration_schema",
        ]
        for field in required_fields:
            self.assertIn(field, widget_type)

    def test_get_specific_widget_type(self):
        """Test retrieving a specific widget type"""
        url = reverse("api:widgettype-detail", kwargs={"pk": "Text Block"})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Text Block")

    def test_get_nonexistent_widget_type(self):
        """Test retrieving a non-existent widget type"""
        url = reverse("api:widgettype-detail", kwargs={"pk": "Nonexistent Widget"})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_active_widget_types(self):
        """Test listing only active widget types"""
        url = reverse("api:widgettype-active")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # All returned widgets should be active
        for widget_type in response.data:
            self.assertTrue(widget_type["is_active"])

    def test_validate_widget_configuration(self):
        """Test widget configuration validation endpoint"""
        url = reverse(
            "api:widgettype-validate-configuration", kwargs={"pk": "Text Block"}
        )

        # Valid configuration
        data = {"configuration": {"content": "Test content", "alignment": "center"}}
        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_valid"])

        # Invalid configuration
        data = {
            "configuration": {"alignment": "invalid_alignment"}  # Invalid enum value
        }
        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_valid"])

    def test_get_configuration_defaults(self):
        """Test getting configuration defaults for a widget type"""
        url = reverse("api:widgettype-configuration-defaults", kwargs={"pk": "Button"})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("defaults", response.data)
        self.assertIn("schema", response.data)

        # Button should have default values
        defaults = response.data["defaults"]
        self.assertEqual(defaults.get("style"), "primary")
        self.assertEqual(defaults.get("size"), "medium")

    def test_get_widget_schema(self):
        """Test getting JSON schema for widget configuration"""
        url = reverse("api:widgettype-schema", kwargs={"pk": "Image"})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("schema", response.data)
        self.assertEqual(response.data["widget_type"], "Image")

        # Schema should have required structure
        schema = response.data["schema"]
        self.assertEqual(schema["type"], "object")
        self.assertIn("properties", schema)


class PageVersionTest(TestCase):
    """Test PageVersion with widget data"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_page_version_with_widgets(self):
        """Test creating page version with widget data"""
        widget_data = [
            {
                "widget_type": "Text Block",
                "slot_name": "main",
                "sort_order": 0,
                "configuration": {"content": "Hello World", "alignment": "center"},
            },
            {
                "widget_type": "Image",
                "slot_name": "main",
                "sort_order": 1,
                "configuration": {
                    "image_url": "https://example.com/image.jpg",
                    "alt_text": "Example image",
                },
            },
        ]

        version = PageVersion.objects.create(
            page=self.page,
            version_number=1,
            page_data={
                "title": self.page.title,
                "slug": self.page.slug,
                "is_published": False,
            },
            widgets=widget_data,
            created_by=self.user,
        )

        self.assertEqual(len(version.widgets), 2)
        self.assertEqual(version.widgets[0]["widget_type"], "Text Block")
        self.assertEqual(version.widgets[1]["widget_type"], "Image")

    def test_widget_validation_in_page_version(self):
        """Test that widget configurations can be validated"""
        from webpages.json_models import PageWidgetData

        # Valid widget data
        widget_data = {
            "widget_type": "Text Block",
            "slot_name": "main",
            "sort_order": 0,
            "configuration": {"content": "Test"},
        }

        # Should validate successfully with pydantic
        parsed_widget = PageWidgetData(**widget_data)
        self.assertEqual(parsed_widget.widget_type, "Text Block")
        self.assertEqual(parsed_widget.configuration["content"], "Test")


class WebPageTest(TestCase):
    """Test WebPage model functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_create_page(self):
        """Test creating a basic page"""
        page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertEqual(page.title, "Test Page")
        self.assertEqual(page.slug, "test-page")
        self.assertEqual(page.created_by, self.user)

    def test_page_hierarchy(self):
        """Test page parent-child relationships"""
        parent = WebPage.objects.create(
            title="Parent Page",
            slug="parent",
            created_by=self.user,
            last_modified_by=self.user,
        )

        child = WebPage.objects.create(
            title="Child Page",
            slug="child",
            parent=parent,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertEqual(child.parent, parent)
        self.assertIn(child, parent.children.all())


class PageThemeTest(TestCase):
    """Test PageTheme model functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_create_theme(self):
        """Test creating a page theme"""
        theme = PageTheme.objects.create(
            name="Test Theme",
            description="A test theme",
            css_variables={"--primary-color": "#007bff"},
            created_by=self.user,
        )

        self.assertEqual(theme.name, "Test Theme")
        self.assertEqual(theme.css_variables["--primary-color"], "#007bff")

    def test_theme_css_validation(self):
        """Test CSS variables validation"""
        from webpages.json_models import CSSVariables

        # Valid CSS variables
        valid_css = {"--primary-color": "#007bff", "--font-size": "16px"}
        css_model = CSSVariables(variables=valid_css)
        self.assertEqual(css_model.variables["--primary-color"], "#007bff")


class InheritanceEnhancementTest(TestCase):
    """Test enhanced widget inheritance functionality."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.theme = PageTheme.objects.create(
            name="Test Theme",
            description="Test theme",
            css_variables={},
            is_active=True,
            created_by=self.user,
        )

        self.root_page = WebPage.objects.create(
            title="Root", slug="root", created_by=self.user, last_modified_by=self.user
        )

        self.child_page = WebPage.objects.create(
            title="Child",
            slug="child",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_inheritance_level_filtering(self):
        """Test that inheritance_level controls widget inheritance depth."""

        # Root page version with widgets at different inheritance levels
        root_version = PageVersion.objects.create(
            page=self.root_page,
            version_number=1,
            widgets={
                "header": [
                    {
                        "id": "infinite-widget",
                        "type": "easy_widgets.HeaderWidget",
                        "config": {"content": "Infinite"},
                        "inheritance_level": -1,
                        "is_published": True,
                        "inherit_from_parent": True,
                    },
                    {
                        "id": "page-only-widget",
                        "type": "easy_widgets.HeaderWidget",
                        "config": {"content": "Page Only"},
                        "inheritance_level": 0,
                        "is_published": True,
                        "inherit_from_parent": True,
                    },
                ]
            },
            code_layout="main_layout",
            theme=self.theme,
            page_data={},
            created_by=self.user,
        )

        PageVersion.objects.create(
            page=self.child_page,
            version_number=1,
            widgets={},
            code_layout="main_layout",
            theme=self.theme,
            page_data={},
            created_by=self.user,
        )

        # Test child inheritance
        inheritance_info = self.child_page.get_widgets_inheritance_info()
        header_widgets = inheritance_info["header"]["widgets"]
        contents = [w["widget"]["config"]["content"] for w in header_widgets]

        # Should inherit infinite (-1) but not page-only (0)
        self.assertIn("Infinite", contents)
        self.assertNotIn("Page Only", contents)

    def test_publishing_filter(self):
        """Test that unpublished widgets are not inherited."""

        PageVersion.objects.create(
            page=self.root_page,
            version_number=1,
            widgets={
                "header": [
                    {
                        "id": "published-widget",
                        "type": "easy_widgets.HeaderWidget",
                        "config": {"content": "Published"},
                        "inheritance_level": -1,
                        "is_published": True,
                        "inherit_from_parent": True,
                    },
                    {
                        "id": "unpublished-widget",
                        "type": "easy_widgets.HeaderWidget",
                        "config": {"content": "Unpublished"},
                        "inheritance_level": -1,
                        "is_published": False,
                        "inherit_from_parent": True,
                    },
                ]
            },
            code_layout="main_layout",
            theme=self.theme,
            page_data={},
            created_by=self.user,
        )

        PageVersion.objects.create(
            page=self.child_page,
            version_number=1,
            widgets={},
            code_layout="main_layout",
            theme=self.theme,
            page_data={},
            created_by=self.user,
        )

        inheritance_info = self.child_page.get_widgets_inheritance_info()
        header_widgets = inheritance_info["header"]["widgets"]
        contents = [w["widget"]["config"]["content"] for w in header_widgets]

        # Should only inherit published widget
        self.assertIn("Published", contents)
        self.assertNotIn("Unpublished", contents)


class LayoutIntegrationTest(TestCase):
    """Test integration with layout system"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_page_with_code_layout(self):
        """Test page with code-based layout"""
        page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create a version with code_layout since it's stored in PageVersion now
        version = page.create_version(self.user, "Test version")
        version.code_layout = "single_column"
        version.save()

        # Code layout is now accessed via the version
        self.assertEqual(version.code_layout, "single_column")

        # Should be able to get layout from registry
        from webpages.layout_registry import layout_registry

        layout = layout_registry.get_layout("single_column")
        self.assertIsNotNone(layout)
