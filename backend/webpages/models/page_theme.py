"""
PageTheme Model

Theme configurations for page styling including colors, fonts, and CSS.
"""

from django.db import models
from django.contrib.auth.models import User


class PageTheme(models.Model):
    """
    Theme configurations for page styling including colors, fonts, and CSS.
    Themes can be inherited through the page hierarchy.
    Supports HTML element-specific styling and can be applied to pages, layouts, and object types.
    """

    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    css_variables = models.JSONField(
        default=dict, help_text="JSON object with CSS custom properties"
    )
    html_elements = models.JSONField(
        default=dict,
        help_text="JSON object defining styles for HTML elements (h1-h6, p, ul, ol, li, a, blockquote, code, pre, etc.)",
    )
    image_styles = models.JSONField(
        default=dict,
        help_text="JSON object defining named image styles for widgets (alignment, columns, spacing, etc.)",
    )
    custom_css = models.TextField(
        blank=True, help_text="Additional custom CSS for this theme"
    )
    image = models.ImageField(
        upload_to="theme_images/",
        blank=True,
        null=True,
        help_text="Theme preview image for listings and selection",
    )
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False,
        help_text="Whether this is the default theme for object content editors",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["created_at"]  # Oldest first

    def __str__(self):
        return self.name

    def to_dict(self):
        """Convert theme to dictionary representation"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "css_variables": self.css_variables,
            "html_elements": self.html_elements,
            "image_styles": self.image_styles,
            "custom_css": self.custom_css,
            "image": self.image.url if self.image else None,
            "is_active": self.is_active,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by.username if self.created_by else None,
        }

    def save(self, *args, **kwargs):
        """Override save to ensure only one default theme exists"""
        if self.is_default:
            # Clear any existing default themes
            PageTheme.objects.filter(is_default=True).exclude(id=self.id).update(
                is_default=False
            )
        super().save(*args, **kwargs)

    @classmethod
    def get_default_theme(cls):
        """Get the default theme for object content editors"""
        try:
            return cls.objects.get(is_default=True, is_active=True)
        except cls.DoesNotExist:
            # No default theme exists, try to create one
            return cls._ensure_default_theme_exists()
        except cls.MultipleObjectsReturned:
            # If somehow multiple defaults exist, return the first one and fix the data
            default_theme = cls.objects.filter(is_default=True, is_active=True).first()
            cls.objects.filter(is_default=True).exclude(id=default_theme.id).update(
                is_default=False
            )
            return default_theme

    @classmethod
    def _ensure_default_theme_exists(cls):
        """Ensure a default theme exists, create one if necessary"""
        from django.contrib.auth.models import User

        # Check if any active themes exist
        active_themes = cls.objects.filter(is_active=True)

        if active_themes.exists():
            # Set the first active theme as default
            first_theme = active_themes.first()
            first_theme.is_default = True
            first_theme.save()
            return first_theme
        else:
            # Create a basic default theme
            admin_user = User.objects.filter(is_superuser=True).first()
            if not admin_user:
                admin_user = User.objects.filter(is_staff=True).first()
            if not admin_user:
                # Create a system user if no admin exists
                admin_user = User.objects.create_user(
                    username="system", is_staff=True, is_superuser=True
                )

            default_theme = cls.objects.create(
                name="System Default",
                description="Automatically created default theme for object content editors",
                css_variables={
                    "primary": "#3b82f6",
                    "secondary": "#64748b",
                    "text": "#1f2937",
                    "background": "#ffffff",
                    "border": "#e5e7eb",
                },
                html_elements={
                    "h1": {
                        "color": "var(--primary)",
                        "font-size": "2rem",
                        "font-weight": "700",
                        "margin-bottom": "1rem",
                    },
                    "h2": {
                        "color": "var(--primary)",
                        "font-size": "1.5rem",
                        "font-weight": "600",
                        "margin-bottom": "0.75rem",
                    },
                    "p": {
                        "color": "var(--text)",
                        "line-height": "1.6",
                        "margin-bottom": "1rem",
                    },
                    "a": {"color": "var(--primary)", "text-decoration": "underline"},
                },
                is_active=True,
                is_default=True,
                created_by=admin_user,
            )
            return default_theme

    def generate_css(self, scope=".theme-content"):
        """Generate complete CSS for this theme including variables, HTML elements, and custom CSS"""
        css_parts = []

        # CSS Variables
        if self.css_variables:
            variables_css = f"{scope} {{\n"
            for var_name, var_value in self.css_variables.items():
                variables_css += f"  --{var_name}: {var_value};\n"
            variables_css += "}"
            css_parts.append(variables_css)

        # HTML Elements styling
        if self.html_elements:
            element_css = self._generate_element_css(scope)
            if element_css:
                css_parts.append(element_css)

        # Custom CSS (scoped)
        if self.custom_css:
            scoped_custom_css = self._scope_custom_css(self.custom_css, scope)
            css_parts.append(scoped_custom_css)

        return "\n\n".join(css_parts)

    def _generate_element_css(self, scope):
        """Generate CSS for HTML elements defined in html_elements"""
        css_parts = []

        for element, styles in self.html_elements.items():
            if not styles:
                continue

            # Build CSS rule for this element
            selector = f"{scope} {element}"
            css_rule = f"{selector} {{\n"

            for property_name, property_value in styles.items():
                css_rule += f"  {property_name}: {property_value};\n"

            css_rule += "}"
            css_parts.append(css_rule)

        return "\n\n".join(css_parts)

    def _scope_custom_css(self, custom_css, scope):
        """Scope custom CSS to the given scope selector"""
        if not custom_css.strip():
            return ""

        # Simple scoping - prepend scope to each rule
        # This is a basic implementation; for production, consider using a CSS parser
        lines = custom_css.split("\n")
        scoped_lines = []

        for line in lines:
            stripped = line.strip()
            if (
                stripped
                and not stripped.startswith("/*")
                and not stripped.startswith("*/")
                and "{" in stripped
            ):
                # This is a CSS rule, scope it
                if not stripped.startswith(scope):
                    line = line.replace(stripped, f"{scope} {stripped}")
            scoped_lines.append(line)

        return "\n".join(scoped_lines)
