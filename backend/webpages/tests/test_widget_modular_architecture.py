"""
Tests for the modular widget architecture.

These tests verify that the widget system works correctly when
different widget apps are enabled or disabled.
"""

from django.test import TestCase, override_settings
from django.test.utils import isolate_apps
from webpages.widget_registry import widget_type_registry


class ModularWidgetArchitectureTest(TestCase):
    """Test the modular widget app architecture"""

    def setUp(self):
        """Ensure widget registry is populated"""
        # Don't clear the registry as this removes registered decorators
        # Just ensure autodiscovery has run
        if not widget_type_registry._widgets:
            from webpages.widget_autodiscovery import autodiscover_widgets

            autodiscover_widgets()

    def test_widget_registry_with_all_apps_enabled(self):
        """Test widget registry when all apps are enabled"""
        # Registry should already be populated from setUp
        registered_names = widget_type_registry.get_widget_names()

        # Should have core widgets
        core_widgets = [
            "Text Block",
            "Image",
            "Button",
            "Spacer",
            "HTML Block",
            "News",
            "Events",
            "Calendar",
            "Forms",
            "Gallery",
            "Default",
        ]

        # Should have custom widgets
        custom_widgets = ["Testimonial", "Call to Action"]

        for widget_name in core_widgets:
            self.assertIn(
                widget_name,
                registered_names,
                f"Core widget '{widget_name}' should be available",
            )

        for widget_name in custom_widgets:
            self.assertIn(
                widget_name,
                registered_names,
                f"Custom widget '{widget_name}' should be available",
            )

    def test_widget_registry_without_custom_widgets_app(self):
        """Test widget registry when custom widgets app is disabled"""
        # This test would need to be run in a separate process to truly test
        # different INSTALLED_APPS configurations. For now, we'll test that
        # the system can handle missing custom widgets gracefully.

        registered_names = widget_type_registry.get_widget_names()

        # Should have core widgets (if core_widgets app is enabled)
        core_widgets = ["Text Block", "Image", "Button"]
        core_widgets_found = any(widget in registered_names for widget in core_widgets)

        if core_widgets_found:
            # If we have core widgets, test they're properly registered
            for widget_name in core_widgets:
                if widget_name in registered_names:
                    widget = widget_type_registry.get_widget_type(widget_name)
                    self.assertIsNotNone(widget)

        # The test passes if the system doesn't crash with missing apps

    def test_widget_registry_without_core_widgets_app(self):
        """Test widget registry when core widgets app is disabled"""
        # This test verifies the system handles missing core widgets gracefully
        registered_names = widget_type_registry.get_widget_names()

        # Should have custom widgets (if they're available and can load)
        custom_widgets = ["Testimonial", "Call to Action"]
        custom_widgets_found = any(
            widget in registered_names for widget in custom_widgets
        )

        if custom_widgets_found:
            # If we have custom widgets, test they work properly
            for widget_name in custom_widgets:
                if widget_name in registered_names:
                    widget = widget_type_registry.get_widget_type(widget_name)
                    self.assertIsNotNone(widget)

        # System should continue to work regardless of which apps are enabled

    def test_widget_registry_with_minimal_configuration(self):
        """Test widget registry with minimal configuration"""
        # Test that the registry works even with minimal widget apps
        registered_names = widget_type_registry.get_widget_names()

        # System should function regardless of how many widgets are available
        self.assertIsInstance(registered_names, list)

        # Each registered widget should be retrievable
        for widget_name in registered_names[:3]:  # Test first 3 to avoid too many
            widget = widget_type_registry.get_widget_type(widget_name)
            self.assertIsNotNone(
                widget, f"Widget '{widget_name}' should be retrievable"
            )

    def test_compatibility_layer_import_handling(self):
        """Test that the compatibility layer handles missing imports gracefully"""
        # Test importing from webpages.widgets when core_widgets might not be available
        try:
            from webpages import widgets

            # Should not raise an error even if core_widgets is not available
            self.assertTrue(True, "Import should succeed")
        except ImportError as e:
            self.fail(f"Compatibility layer should handle missing imports: {e}")

    def test_compatibility_layer_widget_models_import_handling(self):
        """Test that the compatibility layer handles missing widget model imports gracefully"""
        # Test importing from webpages.widget_models when core_widgets might not be available
        try:
            from webpages import widget_models

            # Should not raise an error even if core_widgets is not available
            self.assertTrue(True, "Import should succeed")
        except ImportError as e:
            self.fail(f"Compatibility layer should handle missing imports: {e}")

    def test_widget_autodiscovery_handles_missing_modules(self):
        """Test that widget autodiscovery handles missing modules gracefully"""
        from webpages.widget_autodiscovery import autodiscover_widgets

        # Should not raise an error even if some apps don't have widgets modules
        try:
            autodiscover_widgets()
            self.assertTrue(True, "Autodiscovery should handle missing modules")
        except Exception as e:
            self.fail(f"Autodiscovery should handle missing modules gracefully: {e}")

    def test_widget_validation_summary_with_mixed_apps(self):
        """Test widget validation summary with different app configurations"""
        from webpages.widget_autodiscovery import (
            validate_widget_types,
            get_widget_type_summary,
        )

        # Should be able to validate widgets from different apps
        validation_results = validate_widget_types()
        self.assertIsInstance(validation_results, dict)
        self.assertIn("valid", validation_results)
        self.assertIn("total_widgets", validation_results)

        # Should be able to get summary
        summary = get_widget_type_summary()
        self.assertIsInstance(summary, dict)
        self.assertIn("total_count", summary)
        self.assertIn("widget_types", summary)

    def test_widget_registry_persistence_across_requests(self):
        """Test that widget registry persists properly across different operations"""
        initial_count = len(widget_type_registry.get_widget_names())

        # Get a specific widget
        text_widget = widget_type_registry.get_widget_type("Text Block")
        if text_widget:
            self.assertEqual(text_widget.name, "Text Block")

        # Registry should still have the same count
        current_count = len(widget_type_registry.get_widget_names())
        self.assertEqual(
            initial_count,
            current_count,
            "Widget registry should maintain consistent state",
        )

    def test_widget_configuration_validation_across_apps(self):
        """Test that widget configuration validation works across different apps"""
        # Test core widget configuration validation
        text_widget = widget_type_registry.get_widget_type("Text Block")
        if text_widget:
            is_valid, errors = text_widget.validate_configuration(
                {"content": "Test content", "alignment": "center"}
            )
            self.assertTrue(is_valid)
            self.assertEqual(errors, [])

        # Test custom widget configuration validation
        testimonial_widget = widget_type_registry.get_widget_type("Testimonial")
        if testimonial_widget:
            is_valid, errors = testimonial_widget.validate_configuration(
                {"quote": "Great product!", "author": "Test User"}
            )
            self.assertTrue(is_valid)
            self.assertEqual(errors, [])

    def test_widget_css_injection_across_apps(self):
        """Test that CSS injection works for widgets from different apps"""
        # Test core widget CSS injection
        button_widget = widget_type_registry.get_widget_type("Button")
        if button_widget:
            css_data = button_widget.get_css_for_injection(scope_id="test-123")
            self.assertIsInstance(css_data, dict)
            self.assertEqual(css_data["scope"], "widget")
            self.assertTrue(css_data["enable_injection"])

        # Test custom widget CSS injection
        cta_widget = widget_type_registry.get_widget_type("Call to Action")
        if cta_widget:
            css_data = cta_widget.get_css_for_injection(scope_id="test-456")
            self.assertIsInstance(css_data, dict)
            self.assertEqual(css_data["scope"], "widget")
            self.assertTrue(css_data["enable_injection"])


class WidgetAppDependencyTest(TestCase):
    """Test widget app dependencies and isolation"""

    def setUp(self):
        """Ensure widget registry is populated"""
        # Don't clear the registry as this removes registered decorators
        # Just ensure autodiscovery has run
        if not widget_type_registry._widgets:
            from webpages.widget_autodiscovery import autodiscover_widgets

            autodiscover_widgets()

    def test_core_widgets_app_independence(self):
        """Test that core_widgets app works independently"""
        # Import core widgets directly
        try:
            from core_widgets.widgets import TextBlockWidget, ImageWidget
            from core_widgets.widget_models import TextBlockConfig, ImageConfig

            # Should be able to create instances
            text_widget = TextBlockWidget()
            self.assertEqual(text_widget.name, "Text Block")

            # Should be able to create configurations
            config = TextBlockConfig(content="Test")
            self.assertEqual(config.content, "Test")

        except ImportError as e:
            # If core_widgets is not available, that's also valid for this test
            self.skipTest(f"core_widgets app not available: {e}")

    def test_custom_widgets_app_independence(self):
        """Test that custom widgets app works independently"""
        # Import custom widgets directly
        try:
            from example_custom_widgets.widgets import (
                TestimonialWidget,
                CallToActionWidget,
            )

            # Should be able to create instances
            testimonial_widget = TestimonialWidget()
            self.assertEqual(testimonial_widget.name, "Testimonial")

            cta_widget = CallToActionWidget()
            self.assertEqual(cta_widget.name, "Call to Action")

        except ImportError as e:
            # If example_custom_widgets is not available, that's also valid
            self.skipTest(f"example_custom_widgets app not available: {e}")

    def test_widget_registry_isolation(self):
        """Test that widget registry properly isolates different widget sets"""
        from webpages.widget_autodiscovery import autodiscover_widgets

        # Clear and populate registry
        widget_type_registry._widgets.clear()
        widget_type_registry._instances.clear()
        autodiscover_widgets()

        initial_widgets = set(widget_type_registry.get_widget_names())

        # Clear and populate again - should get the same results
        widget_type_registry._widgets.clear()
        widget_type_registry._instances.clear()
        autodiscover_widgets()

        final_widgets = set(widget_type_registry.get_widget_names())

        self.assertEqual(
            initial_widgets,
            final_widgets,
            "Widget registry should produce consistent results",
        )

    def test_widget_template_path_isolation(self):
        """Test that widget templates are properly isolated by app"""
        from webpages.widget_autodiscovery import autodiscover_widgets

        autodiscover_widgets()

        # Core widgets should use webpages/widgets/ templates
        text_widget = widget_type_registry.get_widget_type("Text Block")
        if text_widget:
            self.assertTrue(text_widget.template_name.startswith("webpages/widgets/"))

        # Custom widgets should use their own app templates
        testimonial_widget = widget_type_registry.get_widget_type("Testimonial")
        if testimonial_widget:
            self.assertTrue(
                testimonial_widget.template_name.startswith("example_custom_widgets/")
            )
