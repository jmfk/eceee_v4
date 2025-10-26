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

    # New structure - 5 theme parts
    fonts = models.JSONField(
        default=dict,
        help_text="Google Fonts configuration with family, variants, and display settings",
    )
    colors = models.JSONField(
        default=dict,
        help_text="Named color palette (key-value pairs of color names and hex/rgb values)",
    )
    typography = models.JSONField(
        default=dict,
        help_text="Grouped HTML element styles with optional widget_type/slot targeting",
    )
    component_styles = models.JSONField(
        default=dict,
        help_text="Named component styles with HTML templates and optional CSS",
    )
    gallery_styles = models.JSONField(
        default=dict,
        help_text="Mustache templates for image gallery rendering with CSS",
    )
    carousel_styles = models.JSONField(
        default=dict,
        help_text="Mustache templates for image carousel rendering with CSS and Alpine.js",
    )
    table_templates = models.JSONField(
        default=dict, help_text="Predefined table templates for the Table widget"
    )

    # Deprecated fields (kept for migration compatibility)
    css_variables = models.JSONField(
        default=dict, help_text="DEPRECATED: Use 'colors' field instead"
    )
    html_elements = models.JSONField(
        default=dict,
        help_text="DEPRECATED: Use 'typography' field instead",
    )
    image_styles = models.JSONField(
        default=dict,
        help_text="DEPRECATED: Use 'component_styles' field instead",
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
            # New fields
            "fonts": self.fonts,
            "colors": self.colors,
            "typography": self.typography,
            "component_styles": self.component_styles,
            "gallery_styles": self.gallery_styles,
            "carousel_styles": self.carousel_styles,
            "table_templates": self.table_templates,
            # Deprecated fields (for backwards compatibility)
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
                fonts={
                    "google_fonts": [
                        {
                            "family": "Inter",
                            "variants": ["400", "500", "600", "700"],
                            "display": "swap",
                        }
                    ]
                },
                colors={
                    "primary": "#3b82f6",
                    "secondary": "#64748b",
                    "accent": "#f59e0b",
                    "text-dark": "#1f2937",
                    "text-light": "#6b7280",
                    "background": "#ffffff",
                    "border": "#e5e7eb",
                },
                typography={
                    "groups": [
                        {
                            "name": "Default Typography",
                            "widget_type": None,
                            "slot": None,
                            "elements": {
                                "h1": {
                                    "font": "Inter",
                                    "size": "2rem",
                                    "lineHeight": "1.2",
                                    "fontWeight": "700",
                                    "marginBottom": "1rem",
                                    "color": "primary",
                                },
                                "h2": {
                                    "font": "Inter",
                                    "size": "1.5rem",
                                    "lineHeight": "1.3",
                                    "fontWeight": "600",
                                    "marginBottom": "0.75rem",
                                    "color": "primary",
                                },
                                "p": {
                                    "font": "Inter",
                                    "size": "1rem",
                                    "lineHeight": "1.6",
                                    "marginBottom": "1rem",
                                    "color": "text-dark",
                                },
                                "a": {
                                    "color": "primary",
                                    "textDecoration": "underline",
                                },
                            },
                        }
                    ]
                },
                component_styles={},
                gallery_styles={},
                carousel_styles={},
                table_templates={},
                is_active=True,
                is_default=True,
                created_by=admin_user,
            )
            return default_theme

    @staticmethod
    def get_default_gallery_styles():
        """Default gallery style templates"""
        return {
            "default": {
                "name": "Default Gallery",
                "description": "Simple grid gallery with hover effects",
                "template": """<div class="image-gallery" data-columns="{{columns}}">
  {{#images}}
    <div class="gallery-item">
      <img src="{{url}}" alt="{{alt}}" width="{{width}}" height="{{height}}" loading="lazy">
      {{#showCaptions}}
        {{#caption}}<p class="caption">{{caption}}</p>{{/caption}}
      {{/showCaptions}}
    </div>
  {{/images}}
</div>""",
                "css": """.image-gallery {
  display: grid;
  grid-template-columns: repeat(var(--columns, 3), 1fr);
  gap: 1rem;
}
.gallery-item {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}
.gallery-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.gallery-item img {
  width: 100%;
  height: auto;
  display: block;
}
.caption {
  padding: 0.75rem;
  font-size: 0.875rem;
  color: #6b7280;
}""",
                "variables": {
                    "columns": {"type": "number", "default": 3, "min": 1, "max": 6}
                },
            }
        }

    @staticmethod
    def get_default_carousel_styles():
        """Default carousel style templates with Alpine.js"""
        return {
            "default": {
                "name": "Default Carousel",
                "description": "Clean carousel with Alpine.js interactions",
                "template": """<div class="image-carousel" x-data="{ current: 0, total: {{imageCount}} }">
  <div class="carousel-container">
    <div class="carousel-track" :style="'transform: translateX(-' + (current * 100) + '%)'">
      {{#images}}
        <div class="carousel-slide">
          <img src="{{url}}" alt="{{alt}}" loading="lazy">
          {{#showCaptions}}
            {{#caption}}<div class="carousel-caption">{{caption}}</div>{{/caption}}
          {{/showCaptions}}
        </div>
      {{/images}}
    </div>
    {{#multipleImages}}
    <button @click="current = (current - 1 + total) % total" class="carousel-btn carousel-prev" aria-label="Previous">‹</button>
    <button @click="current = (current + 1) % total" class="carousel-btn carousel-next" aria-label="Next">›</button>
    <div class="carousel-dots">
      {{#images}}
        <button @click="current = {{index}}" :class="current === {{index}} ? 'active' : ''" class="dot"></button>
      {{/images}}
    </div>
    {{/multipleImages}}
  </div>
</div>""",
                "css": """.image-carousel {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}
.carousel-container {
  position: relative;
  background: #000;
}
.carousel-track {
  display: flex;
  transition: transform 0.5s ease;
}
.carousel-slide {
  min-width: 100%;
  position: relative;
}
.carousel-slide img {
  width: 100%;
  height: 400px;
  object-fit: cover;
}
.carousel-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2rem 1.5rem 1rem;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  color: white;
  font-size: 1.125rem;
}
.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.9);
  border: none;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  z-index: 2;
}
.carousel-btn:hover {
  background: white;
}
.carousel-prev { left: 1rem; }
.carousel-next { right: 1rem; }
.carousel-dots {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  z-index: 2;
}
.dot {
  width: 0.75rem;
  height: 0.75rem;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.5);
  cursor: pointer;
}
.dot.active {
  background: white;
}""",
                "alpine": True,
                "variables": {},
            }
        }

    def generate_css(self, scope=".theme-content", widget_type=None, slot=None):
        """
        Generate complete CSS for this theme including colors, typography, and custom CSS.
        Supports both new typography structure and legacy html_elements for backwards compatibility.

        Args:
            scope: CSS scope selector (default: ".theme-content")
            widget_type: Optional widget type for targeted typography
            slot: Optional slot name for targeted typography
        """
        css_parts = []

        # CSS Variables from colors (new) or css_variables (legacy)
        colors = self.colors or self.css_variables
        if colors:
            variables_css = f"{scope} {{\n"
            for var_name, var_value in colors.items():
                variables_css += f"  --{var_name}: {var_value};\n"
            variables_css += "}"
            css_parts.append(variables_css)

        # Typography styling (new structure with groups)
        if self.typography and self.typography.get("groups"):
            typography_css = self._generate_typography_css(scope, widget_type, slot)
            if typography_css:
                css_parts.append(typography_css)
        # Fallback to legacy html_elements
        elif self.html_elements:
            element_css = self._generate_element_css(scope)
            if element_css:
                css_parts.append(element_css)

        # Custom CSS (scoped)
        if self.custom_css:
            scoped_custom_css = self._scope_custom_css(self.custom_css, scope)
            css_parts.append(scoped_custom_css)

        return "\n\n".join(css_parts)

    def _generate_typography_css(self, scope, widget_type=None, slot=None):
        """
        Generate CSS for typography groups with optional targeting by widget_type/slot.
        Groups are applied in order, with more specific groups overriding general ones.
        """
        css_parts = []

        # Find applicable groups
        applicable_groups = []
        for group in self.typography.get("groups", []):
            group_widget_type = group.get("widget_type")
            group_slot = group.get("slot")

            # Check if group applies to the current context
            # None means "applies to all"
            widget_match = group_widget_type is None or group_widget_type == widget_type
            slot_match = group_slot is None or group_slot == slot

            # AND relationship: both must match if specified
            if widget_match and slot_match:
                applicable_groups.append(group)

        # Generate CSS for each applicable group
        for group in applicable_groups:
            elements = group.get("elements", {})
            for element, styles in elements.items():
                if not styles:
                    continue

                selector = f"{scope} {element}"
                css_rule = f"{selector} {{\n"

                # Convert camelCase to kebab-case and handle special properties
                for property_name, property_value in styles.items():
                    css_property = self._camel_to_kebab(property_name)

                    # Handle color references (named colors from palette)
                    if property_name == "color" and property_value in self.colors:
                        property_value = f"var(--{property_value})"

                    # Handle list-specific properties
                    if element in ["ul", "ol"] and property_name == "bulletType":
                        css_property = "list-style-type"

                    css_rule += f"  {css_property}: {property_value};\n"

                css_rule += "}"
                css_parts.append(css_rule)

        return "\n\n".join(css_parts)

    def _camel_to_kebab(self, text):
        """Convert camelCase to kebab-case for CSS properties"""
        import re

        return re.sub(r"(?<!^)(?=[A-Z])", "-", text).lower()

    def _generate_element_css(self, scope):
        """Generate CSS for HTML elements defined in html_elements (legacy)"""
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

    def get_google_fonts_url(self):
        """Generate Google Fonts URL from fonts configuration"""
        if not self.fonts or not self.fonts.get("google_fonts"):
            return None

        font_families = []
        for font in self.fonts.get("google_fonts", []):
            family = font.get("family", "")
            variants = font.get("variants", ["regular"])
            display = font.get("display", "swap")

            if family:
                # Format: Family:variant1,variant2&display=swap
                variant_str = ":".join([",".join(str(v) for v in variants)])
                if variant_str:
                    font_families.append(f"{family.replace(' ', '+')}:{variant_str}")
                else:
                    font_families.append(family.replace(" ", "+"))

        if not font_families:
            return None

        base_url = "https://fonts.googleapis.com/css2"
        family_params = "&".join(f"family={f}" for f in font_families)
        return f"{base_url}?{family_params}&display=swap"

    def get_component_style(self, style_name):
        """Get a component style by name with fallback"""
        if self.component_styles and style_name in self.component_styles:
            return self.component_styles[style_name]
        # Fallback for legacy image_styles
        if self.image_styles and style_name in self.image_styles:
            # Convert legacy format to new format if needed
            legacy_style = self.image_styles[style_name]
            return {
                "name": style_name,
                "description": "",
                "template": "{{content}}",  # Basic passthrough
                "css": "",
                "legacy_config": legacy_style,  # Keep legacy data
            }
        return None

    def get_table_template(self, template_name):
        """Get a table template by name"""
        if self.table_templates and template_name in self.table_templates:
            return self.table_templates[template_name]
        return None

    def clone(self, new_name=None, created_by=None):
        """Create a copy of this theme with all data"""
        if not new_name:
            # Auto-generate name
            base_name = f"{self.name} (Copy)"
            counter = 1
            new_name = base_name
            while PageTheme.objects.filter(name=new_name).exists():
                counter += 1
                new_name = f"{self.name} (Copy {counter})"

        cloned_theme = PageTheme.objects.create(
            name=new_name,
            description=self.description,
            fonts=self.fonts.copy() if self.fonts else {},
            colors=self.colors.copy() if self.colors else {},
            typography=self.typography.copy() if self.typography else {},
            component_styles=(
                self.component_styles.copy() if self.component_styles else {}
            ),
            gallery_styles=self.gallery_styles.copy() if self.gallery_styles else {},
            carousel_styles=self.carousel_styles.copy() if self.carousel_styles else {},
            table_templates=self.table_templates.copy() if self.table_templates else {},
            css_variables=self.css_variables.copy() if self.css_variables else {},
            html_elements=self.html_elements.copy() if self.html_elements else {},
            image_styles=self.image_styles.copy() if self.image_styles else {},
            custom_css=self.custom_css,
            is_active=True,
            is_default=False,  # Clones are never default
            created_by=created_by or self.created_by,
        )

        # Copy image if it exists
        if self.image:
            cloned_theme.image = self.image
            cloned_theme.save()

        return cloned_theme
