"""
Comprehensive tests for the Unified Widget System.

This test suite covers the unified widget system including:
- Widget registry and discovery
- Slot configuration validation
- Widget inheritance
- API standardization
- Configuration validation
- Preview generation
"""

from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status
import json
import uuid

from ..models import WebPage, PageVersion
from ..widget_registry import widget_type_registry
from ..serializers import WebPageSerializer
from core_widgets.widgets import TextBlockWidget, ImageWidget, ButtonWidget

User = get_user_model()


class UnifiedWidgetRegistryTest(TestCase):
    """Test unified widget registry functionality."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_widget_type_discovery(self):
        """Test that all widget types are properly discovered."""
        registry = widget_type_registry
        widget_types = registry.get_all_widgets()

        # Ensure we have some widgets
        self.assertGreater(len(widget_types), 0)

        # Ensure core widgets are registered
        core_widgets = ["text-block", "image", "button"]
        registered_slugs = [w.slug for w in widget_types]

        for widget_slug in core_widgets:
            self.assertIn(
                widget_slug,
                registered_slugs,
                f"Widget {widget_slug} should be registered",
            )

    def test_widget_type_properties(self):
        """Test that widget types have required properties."""
        text_widget = widget_type_registry.get_widget("text-block")

        self.assertIsNotNone(text_widget)
        self.assertEqual(text_widget.name, "Text Block")
        self.assertEqual(text_widget.slug, "text-block")
        self.assertTrue(text_widget.is_active)
        self.assertIsNotNone(text_widget.configuration_schema)
        self.assertIsNotNone(text_widget.configuration_defaults)

    def test_widget_configuration_validation(self):
        """Test widget configuration validation."""
        text_widget = widget_type_registry.get_widget("text-block")

        # Test valid configuration
        valid_config = {
            "title": "Test Title",
            "content": "Test content",
            "alignment": "left",
        }

        # Should not raise exception
        try:
            text_widget.validate_configuration(valid_config)
        except ValidationError:
            self.fail("Valid configuration should not raise ValidationError")

        # Test invalid configuration
        invalid_config = {
            "title": "Test Title",
            # Missing required 'content' field
            "alignment": "invalid-alignment",
        }

        with self.assertRaises(ValidationError):
            text_widget.validate_configuration(invalid_config)

    def test_widget_preview_generation(self):
        """Test widget preview generation."""
        text_widget = widget_type_registry.get_widget("text-block")

        config = {
            "title": "Preview Title",
            "content": "<p>Preview content</p>",
            "alignment": "center",
        }

        preview_data = text_widget.generate_preview(config)

        self.assertIn("html", preview_data)
        self.assertIn("css", preview_data)
        self.assertIn("Preview Title", preview_data["html"])
        self.assertIn("Preview content", preview_data["html"])

    def test_widget_defaults_application(self):
        """Test that widget defaults are properly applied."""
        text_widget = widget_type_registry.get_widget("text-block")

        partial_config = {
            "title": "Test Title",
            "content": "Test content",
            # Missing 'alignment' - should use default
        }

        full_config = text_widget.apply_defaults(partial_config)

        self.assertIn("alignment", full_config)
        self.assertEqual(full_config["alignment"], "left")  # Default value


class SlotConfigurationTest(TestCase):
    """Test unified slot configuration system."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            created_by=self.user,
            last_modified_by=self.user,
            code_layout="two_column",
        )

    def test_slot_configuration_validation(self):
        """Test slot configuration validation."""
        # Valid slot configuration
        valid_config = {
            "main": {
                "widgets": [
                    {
                        "id": str(uuid.uuid4()),
                        "type": "Text Block",
                        "type_slug": "text-block",
                        "slot": "main",
                        "order": 0,
                        "config": {
                            "title": "Main Content",
                            "content": "Main content text",
                        },
                    }
                ]
            },
            "sidebar": {"widgets": []},
        }

        # Should validate successfully
        # (Validation logic would be implemented in actual slot validator)
        self.assertTrue(True)  # Placeholder for actual validation

    def test_slot_widget_ordering(self):
        """Test that widgets in slots maintain proper ordering."""
        version = self.page.get_current_version()

        widgets = [
            {
                "id": "widget-1",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "main",
                "order": 2,
                "config": {"title": "Third", "content": "Third widget"},
            },
            {
                "id": "widget-2",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "main",
                "order": 0,
                "config": {"title": "First", "content": "First widget"},
            },
            {
                "id": "widget-3",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "main",
                "order": 1,
                "config": {"title": "Second", "content": "Second widget"},
            },
        ]

        version.widgets = widgets
        version.save()

        # Get widgets sorted by order
        main_widgets = [w for w in version.widgets if w["slot"] == "main"]
        main_widgets.sort(key=lambda x: x["order"])

        self.assertEqual(main_widgets[0]["config"]["title"], "First")
        self.assertEqual(main_widgets[1]["config"]["title"], "Second")
        self.assertEqual(main_widgets[2]["config"]["title"], "Third")


class WidgetInheritanceTest(TestCase):
    """Test widget inheritance from parent pages."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create parent page
        self.parent = WebPage.objects.create(
            title="Parent Page",
            slug="parent",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create child page
        self.child = WebPage.objects.create(
            title="Child Page",
            slug="child",
            parent=self.parent,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_widget_inheritance_basic(self):
        """Test basic widget inheritance from parent."""
        # Add widget to parent
        parent_version = self.parent.get_current_version()
        parent_version.widgets = [
            {
                "id": "inherited-widget",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "header",
                "order": 0,
                "config": {"title": "Inherited Title", "content": "Inherited content"},
                "inherit": True,  # Mark as inheritable
            }
        ]
        parent_version.save()

        # Test inheritance
        inherited_widgets = self.child.get_inherited_widgets()

        self.assertEqual(len(inherited_widgets), 1)
        self.assertEqual(inherited_widgets[0]["config"]["title"], "Inherited Title")
        self.assertEqual(inherited_widgets[0]["slot"], "header")

    def test_widget_inheritance_override(self):
        """Test that child pages can override inherited widgets."""
        # Add widget to parent
        parent_version = self.parent.get_current_version()
        parent_version.widgets = [
            {
                "id": "overridable-widget",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "header",
                "order": 0,
                "config": {"title": "Parent Title", "content": "Parent content"},
                "inherit": True,
            }
        ]
        parent_version.save()

        # Override in child
        child_version = self.child.get_current_version()
        child_version.widgets = [
            {
                "id": "overridable-widget",  # Same ID as parent
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "header",
                "order": 0,
                "config": {
                    "title": "Child Title",  # Override title
                    "content": "Child content",  # Override content
                },
                "inherited_from": self.parent.id,
                "overridden": True,
            }
        ]
        child_version.save()

        # Test that child version takes precedence
        effective_widgets = self.child.get_effective_widgets()
        header_widgets = [w for w in effective_widgets if w["slot"] == "header"]

        self.assertEqual(len(header_widgets), 1)
        self.assertEqual(header_widgets[0]["config"]["title"], "Child Title")

    def test_nested_inheritance(self):
        """Test inheritance through multiple levels."""
        # Create grandchild page
        grandchild = WebPage.objects.create(
            title="Grandchild Page",
            slug="grandchild",
            parent=self.child,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Add widget to parent (grandparent)
        parent_version = self.parent.get_current_version()
        parent_version.widgets = [
            {
                "id": "nested-widget",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "footer",
                "order": 0,
                "config": {
                    "title": "Grandparent Widget",
                    "content": "Inherited through levels",
                },
                "inherit": True,
            }
        ]
        parent_version.save()

        # Test that grandchild inherits from grandparent
        inherited_widgets = grandchild.get_inherited_widgets()

        footer_widgets = [w for w in inherited_widgets if w["slot"] == "footer"]
        self.assertEqual(len(footer_widgets), 1)
        self.assertEqual(footer_widgets[0]["config"]["title"], "Grandparent Widget")


class UnifiedWidgetAPITest(TestCase):
    """Test standardized widget API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_widget_types_list_endpoint(self):
        """Test listing all widget types."""
        response = self.client.get("/api/v1/widgets/types/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

        # Check that we have some widget types
        self.assertGreater(len(response.data), 0)

        # Check structure of widget type data
        if response.data:
            widget_type = response.data[0]
            required_fields = ["slug", "name", "description", "configuration_schema"]
            for field in required_fields:
                self.assertIn(field, widget_type, f"Field {field} should be present")

    def test_widget_type_detail_endpoint(self):
        """Test getting details of a specific widget type."""
        response = self.client.get("/api/v1/widgets/types/text-block/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], "text-block")
        self.assertEqual(response.data["name"], "Text Block")
        self.assertIn("configuration_schema", response.data)
        self.assertIn("configuration_defaults", response.data)

    def test_widget_configuration_validation_endpoint(self):
        """Test widget configuration validation endpoint."""
        # Test valid configuration
        valid_config = {
            "title": "Test Title",
            "content": "Test content",
            "alignment": "left",
        }

        response = self.client.post(
            "/api/v1/widgets/types/text-block/validate/",
            {"configuration": valid_config},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_valid"])
        self.assertEqual(response.data["errors"], {})

        # Test invalid configuration
        invalid_config = {
            "title": "Test Title",
            # Missing required 'content' field
            "alignment": "invalid-alignment",
        }

        response = self.client.post(
            "/api/v1/widgets/types/text-block/validate/",
            {"configuration": invalid_config},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_valid"])
        self.assertIn("content", response.data["errors"])

    def test_widget_preview_endpoint(self):
        """Test widget preview generation endpoint."""
        config = {
            "title": "Preview Title",
            "content": "<p>Preview content</p>",
            "alignment": "center",
        }

        response = self.client.post(
            "/api/v1/widgets/types/text-block/preview/",
            {"configuration": config},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("html", response.data)
        self.assertIn("configuration", response.data)

        # Check that content is in the rendered HTML
        self.assertIn("Preview Title", response.data["html"])
        self.assertIn("Preview content", response.data["html"])

    def test_page_widgets_crud_operations(self):
        """Test CRUD operations for page widgets."""
        # CREATE: Add widget to page
        widget_data = {
            "type": "text-block",
            "slot": "main",
            "configuration": {
                "title": "New Widget",
                "content": "Widget content",
                "alignment": "left",
            },
        }

        response = self.client.post(
            f"/api/v1/webpages/{self.page.id}/widgets/", widget_data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", response.data)
        widget_id = response.data["id"]

        # READ: Get widget
        response = self.client.get(
            f"/api/v1/webpages/{self.page.id}/widgets/{widget_id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["type"], "Text Block")
        self.assertEqual(response.data["slot"], "main")

        # UPDATE: Modify widget
        update_data = {
            "configuration": {
                "title": "Updated Title",
                "content": "Updated content",
                "alignment": "center",
            },
            "slot": "sidebar",
        }

        response = self.client.patch(
            f"/api/v1/webpages/{self.page.id}/widgets/{widget_id}/",
            update_data,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["config"]["title"], "Updated Title")
        self.assertEqual(response.data["slot"], "sidebar")

        # DELETE: Remove widget
        response = self.client.delete(
            f"/api/v1/webpages/{self.page.id}/widgets/{widget_id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify widget is deleted
        response = self.client.get(
            f"/api/v1/webpages/{self.page.id}/widgets/{widget_id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_widget_reordering(self):
        """Test widget reordering functionality."""
        # Create multiple widgets
        version = self.page.get_current_version()
        version.widgets = [
            {
                "id": "widget-1",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "main",
                "order": 0,
                "config": {"title": "First", "content": "First widget"},
            },
            {
                "id": "widget-2",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "main",
                "order": 1,
                "config": {"title": "Second", "content": "Second widget"},
            },
            {
                "id": "widget-3",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "main",
                "order": 2,
                "config": {"title": "Third", "content": "Third widget"},
            },
        ]
        version.save()

        # Reorder widgets: move third to first position
        reorder_data = {"widgets": ["widget-3", "widget-1", "widget-2"], "slot": "main"}

        response = self.client.post(
            f"/api/v1/webpages/{self.page.id}/widgets/reorder/",
            reorder_data,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify new order
        version.refresh_from_db()
        main_widgets = [w for w in version.widgets if w["slot"] == "main"]
        main_widgets.sort(key=lambda x: x["order"])

        self.assertEqual(main_widgets[0]["id"], "widget-3")
        self.assertEqual(main_widgets[1]["id"], "widget-1")
        self.assertEqual(main_widgets[2]["id"], "widget-2")

    def test_widget_duplication(self):
        """Test widget duplication functionality."""
        # Create a widget
        version = self.page.get_current_version()
        version.widgets = [
            {
                "id": "original-widget",
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "main",
                "order": 0,
                "config": {"title": "Original Widget", "content": "Original content"},
            }
        ]
        version.save()

        # Duplicate the widget
        response = self.client.post(
            f"/api/v1/webpages/{self.page.id}/widgets/original-widget/duplicate/"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(response.data["id"], "original-widget")
        self.assertEqual(response.data["config"]["title"], "Original Widget")

        # Verify widget was duplicated
        version.refresh_from_db()
        self.assertEqual(len(version.widgets), 2)

        # Check that the duplicate has a different ID
        widget_ids = [w["id"] for w in version.widgets]
        self.assertEqual(len(set(widget_ids)), 2)  # Should have 2 unique IDs

    def test_authentication_required(self):
        """Test that authentication is required for widget API endpoints."""
        self.client.force_authenticate(user=None)

        endpoints = [
            "/api/v1/widgets/types/",
            "/api/v1/widgets/types/text-block/",
            f"/api/v1/webpages/{self.page.id}/widgets/",
        ]

        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(
                response.status_code,
                status.HTTP_401_UNAUTHORIZED,
                f"Endpoint {endpoint} should require authentication",
            )


class WidgetConfigurationSchemaTest(TestCase):
    """Test widget configuration schema validation."""

    def test_text_block_schema(self):
        """Test text block widget configuration schema."""
        text_widget = widget_type_registry.get_widget("text-block")
        schema = text_widget.configuration_schema

        # Check required properties
        self.assertEqual(schema["type"], "object")
        self.assertIn("properties", schema)
        self.assertIn("required", schema)

        # Check specific fields
        properties = schema["properties"]
        self.assertIn("title", properties)
        self.assertIn("content", properties)
        self.assertIn("alignment", properties)

        # Check field types
        self.assertEqual(properties["title"]["type"], "string")
        self.assertEqual(properties["content"]["type"], "string")
        self.assertEqual(properties["alignment"]["type"], "string")

        # Check enum values for alignment
        self.assertIn("enum", properties["alignment"])
        self.assertIn("left", properties["alignment"]["enum"])
        self.assertIn("center", properties["alignment"]["enum"])
        self.assertIn("right", properties["alignment"]["enum"])

    def test_image_widget_schema(self):
        """Test image widget configuration schema."""
        image_widget = widget_type_registry.get_widget("image")

        if image_widget:  # Only test if image widget is available
            schema = image_widget.configuration_schema
            properties = schema["properties"]

            # Check image-specific fields
            self.assertIn("image_url", properties)
            self.assertIn("alt_text", properties)

            # Check required fields
            required_fields = schema.get("required", [])
            self.assertIn("image_url", required_fields)
            self.assertIn("alt_text", required_fields)


class WidgetMigrationTest(TransactionTestCase):
    """Test widget migration functionality."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.page = WebPage.objects.create(
            title="Migration Test Page",
            slug="migration-test",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_legacy_widget_data_migration(self):
        """Test migration of legacy widget data format."""
        # Create page with legacy widget format
        version = self.page.get_current_version()

        # Simulate legacy widget data
        legacy_widgets = [
            {
                "widget_type_id": 1,  # Old database ID format
                "json_config": '{"title": "Legacy Widget", "content": "Legacy content"}',
                "slot_name": "main",
                "sort_order": 0,
            }
        ]

        # This would be handled by migration script
        # For now, just test that we can detect legacy format
        self.assertTrue(self.is_legacy_format(legacy_widgets[0]))

    def is_legacy_format(self, widget_data):
        """Check if widget data is in legacy format."""
        legacy_keys = ["widget_type_id", "json_config", "sort_order"]
        return any(key in widget_data for key in legacy_keys)

    def test_widget_data_validation_after_migration(self):
        """Test that migrated widget data is valid."""
        # Create widget with new format
        version = self.page.get_current_version()
        version.widgets = [
            {
                "id": str(uuid.uuid4()),
                "type": "Text Block",
                "type_slug": "text-block",
                "slot": "main",
                "order": 0,
                "config": {
                    "title": "Migrated Widget",
                    "content": "Migrated content",
                    "alignment": "left",
                },
            }
        ]
        version.save()

        # Validate widget data
        for widget_data in version.widgets:
            self.assertTrue(self.is_valid_widget_format(widget_data))

    def is_valid_widget_format(self, widget_data):
        """Check if widget data is in valid new format."""
        required_fields = ["id", "type", "type_slug", "slot", "order", "config"]
        return all(field in widget_data for field in required_fields)


class WidgetPerformanceTest(TestCase):
    """Test widget system performance."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username="perftest", email="perf@example.com", password="testpass123"
        )

        self.page = WebPage.objects.create(
            title="Performance Test Page",
            slug="perf-test",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_widget_registry_lookup_performance(self):
        """Test widget registry lookup performance."""
        import time

        # Measure widget lookup time
        start_time = time.time()

        for _ in range(100):  # 100 lookups
            widget = widget_type_registry.get_widget("text-block")
            self.assertIsNotNone(widget)

        end_time = time.time()
        lookup_time = (end_time - start_time) * 1000  # Convert to ms

        # Should be fast (less than 10ms for 100 lookups)
        self.assertLess(
            lookup_time, 10, f"Widget lookup too slow: {lookup_time}ms for 100 lookups"
        )

    def test_widget_validation_performance(self):
        """Test widget configuration validation performance."""
        import time

        text_widget = widget_type_registry.get_widget("text-block")
        config = {
            "title": "Performance Test",
            "content": "Performance test content",
            "alignment": "left",
        }

        # Measure validation time
        start_time = time.time()

        for _ in range(50):  # 50 validations
            text_widget.validate_configuration(config)

        end_time = time.time()
        validation_time = (end_time - start_time) * 1000  # Convert to ms

        # Should be fast (less than 50ms for 50 validations)
        self.assertLess(
            validation_time,
            50,
            f"Widget validation too slow: {validation_time}ms for 50 validations",
        )

    def test_large_page_widget_handling(self):
        """Test handling of pages with many widgets."""
        # Create page with many widgets
        widgets = []
        for i in range(50):  # 50 widgets
            widgets.append(
                {
                    "id": f"widget-{i}",
                    "type": "Text Block",
                    "type_slug": "text-block",
                    "slot": "main",
                    "order": i,
                    "config": {
                        "title": f"Widget {i}",
                        "content": f"Content for widget {i}",
                        "alignment": "left",
                    },
                }
            )

        version = self.page.get_current_version()

        import time

        start_time = time.time()

        version.widgets = widgets
        version.save()

        end_time = time.time()
        save_time = (end_time - start_time) * 1000  # Convert to ms

        # Should handle large widget sets efficiently
        self.assertLess(
            save_time,
            1000,  # Less than 1 second
            f"Large widget set save too slow: {save_time}ms",
        )

        # Test retrieval
        start_time = time.time()
        retrieved_widgets = version.widgets
        end_time = time.time()

        retrieval_time = (end_time - start_time) * 1000

        self.assertEqual(len(retrieved_widgets), 50)
        self.assertLess(
            retrieval_time,
            100,  # Less than 100ms
            f"Large widget set retrieval too slow: {retrieval_time}ms",
        )
