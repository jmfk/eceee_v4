"""
Tests for the example_custom_widgets Django app.

These tests demonstrate how to test custom widgets in the modular architecture.
"""

from django.test import TestCase
from webpages.widget_registry import widget_type_registry
from .widgets import TestimonialWidget, CallToActionWidget
from pydantic import ValidationError


class CustomWidgetsRegistrationTest(TestCase):
    """Test that custom widgets are properly registered"""

    def test_custom_widgets_registered(self):
        """Test that custom widgets are registered in the global registry"""
        expected_widgets = ["Testimonial", "Call to Action"]
        
        registered_names = widget_type_registry.get_widget_names()
        
        for widget_name in expected_widgets:
            self.assertIn(widget_name, registered_names, 
                         f"Custom widget '{widget_name}' not found in registered widgets")

    def test_custom_widget_instances_are_correct_types(self):
        """Test that registered custom widgets are instances of expected classes"""
        testimonial_widget = widget_type_registry.get_widget_type("Testimonial")
        cta_widget = widget_type_registry.get_widget_type("Call to Action")
        
        self.assertIsInstance(testimonial_widget, TestimonialWidget)
        self.assertIsInstance(cta_widget, CallToActionWidget)

    def test_custom_widgets_are_active(self):
        """Test that custom widgets are active by default"""
        testimonial_widget = widget_type_registry.get_widget_type("Testimonial")
        cta_widget = widget_type_registry.get_widget_type("Call to Action")
        
        self.assertTrue(testimonial_widget.is_active)
        self.assertTrue(cta_widget.is_active)


class TestimonialWidgetTest(TestCase):
    """Test Testimonial widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("Testimonial")

    def test_valid_testimonial_configuration_full(self):
        """Test valid testimonial configuration with all fields"""
        valid_config = {
            "quote": "This product changed my life!",
            "author": "Jane Smith",
            "title": "CEO",
            "company": "Tech Corp",
            "photo": "https://example.com/photo.jpg",
            "rating": 5
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_minimal_valid_testimonial_configuration(self):
        """Test minimal valid configuration (only required fields)"""
        minimal_config = {
            "quote": "Great product!",
            "author": "John Doe"
        }
        
        is_valid, errors = self.widget.validate_configuration(minimal_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_invalid_testimonial_missing_quote(self):
        """Test invalid configuration with missing required quote"""
        invalid_config = {
            "author": "John Doe",
            "title": "Manager"
        }
        
        is_valid, errors = self.widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_invalid_testimonial_missing_author(self):
        """Test invalid configuration with missing required author"""
        invalid_config = {
            "quote": "Great product!",
            "title": "Manager"
        }
        
        is_valid, errors = self.widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_invalid_rating_out_of_range(self):
        """Test invalid rating values"""
        invalid_config_low = {
            "quote": "Great product!",
            "author": "John Doe",
            "rating": 0  # Below minimum
        }
        
        invalid_config_high = {
            "quote": "Great product!",
            "author": "John Doe",
            "rating": 6  # Above maximum
        }
        
        is_valid_low, _ = self.widget.validate_configuration(invalid_config_low)
        is_valid_high, _ = self.widget.validate_configuration(invalid_config_high)
        
        self.assertFalse(is_valid_low)
        self.assertFalse(is_valid_high)

    def test_invalid_photo_url(self):
        """Test invalid photo URL format"""
        invalid_config = {
            "quote": "Great product!",
            "author": "John Doe",
            "photo": "not-a-valid-url"
        }
        
        is_valid, errors = self.widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_testimonial_has_css_properties(self):
        """Test that testimonial widget has proper CSS configuration"""
        self.assertTrue(self.widget.enable_css_injection)
        self.assertEqual(self.widget.css_scope, "widget")
        self.assertIsInstance(self.widget.widget_css, str)
        self.assertGreater(len(self.widget.widget_css), 0)
        
        # Check for testimonial-specific CSS classes
        self.assertIn("testimonial-widget", self.widget.widget_css)
        self.assertIn("testimonial-quote", self.widget.widget_css)
        self.assertIn("testimonial-author", self.widget.widget_css)

    def test_testimonial_css_variables(self):
        """Test testimonial widget CSS variables"""
        self.assertIsInstance(self.widget.css_variables, dict)
        self.assertIn("testimonial-bg", self.widget.css_variables)
        self.assertIn("photo-size", self.widget.css_variables)

    def test_testimonial_template_name(self):
        """Test testimonial widget template name"""
        self.assertEqual(self.widget.template_name, "example_custom_widgets/testimonial.html")


class CallToActionWidgetTest(TestCase):
    """Test Call to Action widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("Call to Action")

    def test_valid_cta_configuration_full(self):
        """Test valid CTA configuration with all fields"""
        valid_config = {
            "headline": "Join Us Today!",
            "subtext": "Don't miss out on this amazing opportunity",
            "button_text": "Sign Up Now",
            "button_url": "https://example.com/signup",
            "background_color": "#007bff",
            "text_color": "#ffffff"
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_minimal_valid_cta_configuration(self):
        """Test minimal valid CTA configuration (only required fields)"""
        minimal_config = {
            "headline": "Join Us Today!",
            "button_url": "https://example.com/signup"
        }
        
        is_valid, errors = self.widget.validate_configuration(minimal_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_invalid_cta_missing_headline(self):
        """Test invalid configuration with missing required headline"""
        invalid_config = {
            "button_text": "Click Me",
            "button_url": "https://example.com"
        }
        
        is_valid, errors = self.widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_invalid_cta_missing_button_url(self):
        """Test invalid configuration with missing required button URL"""
        invalid_config = {
            "headline": "Join Us Today!",
            "button_text": "Click Me"
        }
        
        is_valid, errors = self.widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_invalid_button_url_format(self):
        """Test invalid button URL format"""
        invalid_config = {
            "headline": "Join Us Today!",
            "button_url": "not-a-valid-url"
        }
        
        is_valid, errors = self.widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_cta_configuration_defaults(self):
        """Test CTA widget default configuration values"""
        defaults = self.widget.get_configuration_defaults()
        
        self.assertEqual(defaults.get("button_text"), "Learn More")
        self.assertEqual(defaults.get("background_color"), "#f8f9fa")
        self.assertEqual(defaults.get("text_color"), "#212529")

    def test_cta_has_css_properties(self):
        """Test that CTA widget has proper CSS configuration"""
        self.assertTrue(self.widget.enable_css_injection)
        self.assertEqual(self.widget.css_scope, "widget")
        self.assertIsInstance(self.widget.widget_css, str)
        self.assertGreater(len(self.widget.widget_css), 0)
        
        # Check for CTA-specific CSS classes
        self.assertIn("cta-widget", self.widget.widget_css)
        self.assertIn("cta-headline", self.widget.widget_css)
        self.assertIn("cta-button", self.widget.widget_css)

    def test_cta_css_variables(self):
        """Test CTA widget CSS variables"""
        self.assertIsInstance(self.widget.css_variables, dict)
        self.assertIn("cta-padding", self.widget.css_variables)
        self.assertIn("cta-headline-size", self.widget.css_variables)

    def test_cta_template_name(self):
        """Test CTA widget template name"""
        self.assertEqual(self.widget.template_name, "example_custom_widgets/call_to_action.html")


class CustomWidgetConfigurationModelsTest(TestCase):
    """Test Pydantic configuration models for custom widgets"""

    def test_testimonial_config_model_direct(self):
        """Test TestimonialConfig model directly"""
        from .widgets import TestimonialConfig
        
        config = TestimonialConfig(
            quote="Amazing product!",
            author="Test User",
            rating=4
        )
        
        self.assertEqual(config.quote, "Amazing product!")
        self.assertEqual(config.author, "Test User")
        self.assertEqual(config.rating, 4)
        self.assertIsNone(config.title)  # Optional field
        self.assertIsNone(config.company)  # Optional field

    def test_cta_config_model_direct(self):
        """Test CallToActionConfig model directly"""
        from .widgets import CallToActionConfig
        
        config = CallToActionConfig(
            headline="Join Now!",
            button_url="https://example.com"
        )
        
        self.assertEqual(config.headline, "Join Now!")
        self.assertTrue(str(config.button_url).startswith("https://example.com"))  # Account for trailing slash
        self.assertEqual(config.button_text, "Learn More")  # Default value
        self.assertEqual(config.background_color, "#f8f9fa")  # Default value

    def test_invalid_testimonial_config_model(self):
        """Test that invalid testimonial configurations raise ValidationError"""
        from .widgets import TestimonialConfig
        
        with self.assertRaises(ValidationError):
            TestimonialConfig()  # Missing required fields
            
        with self.assertRaises(ValidationError):
            TestimonialConfig(
                quote="Great!",
                author="Test",
                rating=10  # Invalid rating (> 5)
            )

    def test_invalid_cta_config_model(self):
        """Test that invalid CTA configurations raise ValidationError"""
        from .widgets import CallToActionConfig
        
        with self.assertRaises(ValidationError):
            CallToActionConfig()  # Missing required fields
            
        with self.assertRaises(ValidationError):
            CallToActionConfig(
                headline="Test",
                button_url="invalid-url"  # Invalid URL format
            )


class CustomWidgetIntegrationTest(TestCase):
    """Test custom widgets integration with the widget registry system"""

    def test_custom_widgets_coexist_with_core_widgets(self):
        """Test that custom widgets work alongside core widgets"""
        all_widgets = widget_type_registry.get_widget_names()
        
        # Should have both core widgets and custom widgets
        core_widgets = ["Text Block", "Image", "Button"]
        custom_widgets = ["Testimonial", "Call to Action"]
        
        for widget_name in core_widgets + custom_widgets:
            self.assertIn(widget_name, all_widgets,
                         f"Widget '{widget_name}' should be available")

    def test_custom_widget_dictionary_representation(self):
        """Test custom widget to_dict() functionality"""
        testimonial_widget = widget_type_registry.get_widget_type("Testimonial")
        widget_dict = testimonial_widget.to_dict()
        
        self.assertEqual(widget_dict["name"], "Testimonial")
        self.assertIn("description", widget_dict)
        self.assertIn("template_name", widget_dict)
        self.assertIn("configuration_schema", widget_dict)
        self.assertTrue(widget_dict["is_active"])

    def test_custom_widget_css_for_injection(self):
        """Test custom widget CSS injection functionality"""
        cta_widget = widget_type_registry.get_widget_type("Call to Action")
        
        css_data = cta_widget.get_css_for_injection(scope_id="test-123")
        
        self.assertIsInstance(css_data, dict)
        self.assertEqual(css_data["scope"], "widget")
        self.assertEqual(css_data["scope_id"], "test-123")
        self.assertTrue(css_data["enable_injection"])
        self.assertIsInstance(css_data["widget_css"], str)
        self.assertIsInstance(css_data["css_variables"], dict)