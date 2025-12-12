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
    design_groups = models.JSONField(
        default=dict,
        help_text=(
            "Grouped HTML element styles with optional widget_type/slot targeting. "
            "Each group can have an 'isDefault' boolean field to mark it as the base/default group for style inheritance. "
            "Groups can also include 'layoutProperties' to define responsive layout and styling settings "
            "(width, height, padding, margin, gap, background-color, color, border properties, etc.) "
            "for widget layout parts (e.g., container, header, image, content) across mobile-first breakpoints (sm, md, lg, xl). "
            "Supports two targeting modes via 'targetingMode' field: 'widget-slot' (default) for widget_types/slots arrays, "
            "or 'css-classes' for custom CSS selectors defined in 'targetCssClasses' field (string with comma or newline-separated selectors)."
        ),
    )
    component_styles = models.JSONField(
        default=dict,
        help_text="Named component styles with HTML templates and optional CSS",
    )
    image_styles = models.JSONField(
        default=dict,
        help_text=(
            "Unified image styles (gallery and carousel) with Mustache templates and CSS. "
            "Each style supports: template (required), styleType (gallery|carousel, required), "
            "usageType (standard|inline|both, defaults to 'both'), "
            "css, variables, imgproxy_config, lightbox_config, enableLightbox (boolean), "
            "lightboxTemplate (string), defaultShowCaptions (boolean), defaultLightboxGroup (string), "
            "defaultRandomize (boolean). Carousel styles also support: defaultAutoPlay (boolean), "
            "defaultAutoPlayInterval (number 1-30)."
        ),
    )
    gallery_styles = models.JSONField(
        default=dict,
        help_text="DEPRECATED: Use 'image_styles' field instead",
    )
    carousel_styles = models.JSONField(
        default=dict,
        help_text="DEPRECATED: Use 'image_styles' field instead",
    )
    table_templates = models.JSONField(
        default=dict, help_text="Predefined table templates for the Table widget"
    )
    breakpoints = models.JSONField(
        default=dict,
        help_text=(
            "Responsive breakpoint configuration with pixel values for media queries. "
            "Format: {'sm': 640, 'md': 768, 'lg': 1024, 'xl': 1280}. "
            "If not specified, defaults to standard breakpoints."
        ),
    )

    # Deprecated fields (kept for migration compatibility)
    css_variables = models.JSONField(
        default=dict, help_text="DEPRECATED: Use 'colors' field instead"
    )
    html_elements = models.JSONField(
        default=dict,
        help_text="DEPRECATED: Use 'design_groups' field instead",
    )
    custom_css = models.TextField(
        blank=True, help_text="Additional custom CSS for this theme"
    )
    image = models.ImageField(
        upload_to="theme_images/",
        blank=True,
        null=True,
        help_text=(
            "Theme preview image for listings and selection. "
            "Note: Files uploaded to theme_images/ should have public-read ACL "
            "in object storage for direct browser access. "
            "Set AWS_DEFAULT_ACL='public-read' in production settings or configure "
            "bucket policy to allow public read access to theme_images/* objects."
        ),
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

    def get_breakpoints(self):
        """
        Get responsive breakpoints for this theme.
        Returns theme-specific breakpoints or hard defaults.

        Returns:
            dict: Breakpoint configuration with keys 'sm', 'md', 'lg', 'xl'
        """
        DEFAULT_BREAKPOINTS = {
            "sm": 640,  # Tailwind sm
            "md": 768,  # Tailwind md (Bootstrap md)
            "lg": 1024,  # Tailwind lg (Bootstrap lg)
            "xl": 1280,  # Tailwind xl (Bootstrap xl)
        }

        if self.breakpoints and isinstance(self.breakpoints, dict):
            # Merge with defaults to ensure all keys exist
            return {**DEFAULT_BREAKPOINTS, **self.breakpoints}

        return DEFAULT_BREAKPOINTS

    def to_dict(self):
        """Convert theme to dictionary representation"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            # New fields
            "fonts": self.fonts,
            "colors": self.colors,
            "design_groups": self.design_groups,
            "component_styles": self.component_styles,
            "image_styles": self.image_styles,
            "gallery_styles": self.gallery_styles,  # Deprecated
            "carousel_styles": self.carousel_styles,  # Deprecated
            "table_templates": self.table_templates,
            "breakpoints": self.get_breakpoints(),  # Always include computed breakpoints
            # Deprecated fields (for backwards compatibility)
            "css_variables": self.css_variables,
            "html_elements": self.html_elements,
            "custom_css": self.custom_css,
            "image": self.image.url if self.image else None,
            "is_active": self.is_active,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by.username if self.created_by else None,
        }

    def save(self, *args, **kwargs):
        """Override save to ensure only one default theme exists and invalidate CSS cache"""
        if self.is_default:
            # Clear any existing default themes
            PageTheme.objects.filter(is_default=True).exclude(id=self.id).update(
                is_default=False
            )
        super().save(*args, **kwargs)

        # Invalidate CSS cache for this theme
        if self.id:
            from webpages.services import ThemeCSSGenerator

            generator = ThemeCSSGenerator()
            generator.invalidate_cache(self.id)

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
                component_styles=cls.get_default_component_styles(),
                image_styles=cls.get_default_image_styles(),
                gallery_styles={},  # Deprecated
                carousel_styles={},  # Deprecated
                table_templates={},
                is_active=True,
                is_default=True,
                created_by=admin_user,
            )
            return default_theme

    @staticmethod
    def get_default_image_styles():
        """Default image styles (unified gallery and carousel) with styleType"""
        gallery_styles = PageTheme.get_default_gallery_styles()
        carousel_styles = PageTheme.get_default_carousel_styles()

        # Merge and add styleType
        image_styles = {}

        # Add gallery styles with styleType
        for key, style in gallery_styles.items():
            image_styles[key] = {**style, "styleType": "gallery"}

        # Add carousel styles with styleType
        for key, style in carousel_styles.items():
            image_styles[key] = {**style, "styleType": "carousel"}

        return image_styles

    @staticmethod
    def get_default_gallery_styles():
        """Default gallery style templates extracted from widget templates"""
        return {
            "grid-gallery": {
                "name": "Grid Gallery",
                "description": "Responsive grid gallery with hover effects and captions",
                "usageType": "standard",
                "template": """<div class="gallery-widget">
  <div class="gallery-grid" style="grid-template-columns: repeat({{columns}}, 1fr);">
    {{#images}}
      <div class="gallery-item" data-index="{{index}}">
        <div class="image-container">
          <img src="{{url}}" alt="{{alt}}" class="gallery-image" loading="lazy">
        </div>
        {{#showCaptions}}
          {{#caption}}
            <div class="image-caption">
              <h4 class="caption-title">{{caption}}</h4>
              {{#description}}<p class="caption-description">{{description}}</p>{{/description}}
            </div>
          {{/caption}}
        {{/showCaptions}}
      </div>
    {{/images}}
  </div>
</div>""",
                "css": """.gallery-widget {
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1rem 0;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.gallery-grid {
  display: grid;
  gap: 1rem;
}
.gallery-item {
  border-radius: 8px;
  overflow: hidden;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}
.gallery-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.image-container {
  position: relative;
  overflow: hidden;
}
.gallery-image {
  max-width: 100%;
  height: auto;
  display: block;
  transition: transform 0.3s;
}
.gallery-item:hover .gallery-image {
  transform: scale(1.05);
}
.image-caption {
  padding: 1rem;
}
.caption-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 0.5rem 0;
}
.caption-description {
  font-size: 0.875rem;
  color: #718096;
  margin: 0;
  line-height: 1.4;
}
@media (max-width: 768px) {
  .gallery-widget {
    padding: 1rem;
  }
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 0.75rem;
  }
}
@media (max-width: 480px) {
  .gallery-grid {
    grid-template-columns: 1fr !important;
  }
}""",
                "variables": {
                    "columns": {"type": "number", "default": 3, "min": 1, "max": 6}
                },
                "imgproxy_config": {
                    "width": 800,
                    "height": 600,
                    "resize_type": "fill",
                    "gravity": "sm",
                },
            },
            "grid-with-overlay": {
                "name": "Grid with Overlay",
                "description": "Grid gallery with hover overlay and expand icon",
                "usageType": "standard",
                "template": """<div class="gallery-widget">
  <div class="gallery-grid" style="grid-template-columns: repeat({{columns}}, 1fr);">
    {{#images}}
      <div class="gallery-item" data-index="{{index}}">
        <div class="image-container">
          <img src="{{url}}" alt="{{alt}}" class="gallery-image" loading="lazy">
          <div class="image-overlay">
            <span class="expand-icon"></span>
          </div>
        </div>
        {{#showCaptions}}
          {{#caption}}
            <div class="image-caption">{{caption}}</div>
          {{/caption}}
        {{/showCaptions}}
      </div>
    {{/images}}
  </div>
</div>""",
                "css": """.gallery-widget {
  border-radius: 8px;
  padding: 1rem;
}
.gallery-grid {
  display: grid;
  gap: 1rem;
}
.gallery-item {
  border-radius: 8px;
  overflow: hidden;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}
.gallery-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.image-container {
  position: relative;
  overflow: hidden;
}
.gallery-image {
  max-width: 100%;
  height: auto;
  display: block;
  transition: transform 0.3s;
}
.gallery-item:hover .gallery-image {
  transform: scale(1.05);
}
.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}
.gallery-item:hover .image-overlay {
  opacity: 1;
}
.expand-icon {
  width: 40px;
  height: 40px;
  border: 2px solid white;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  animation: expandPulse 1.5s ease-in-out infinite;
}
@keyframes expandPulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
}
.image-caption {
  padding: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}
@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 0.75rem;
  }
}
@media (max-width: 480px) {
  .gallery-grid {
    grid-template-columns: 1fr !important;
  }
}""",
                "variables": {
                    "columns": {"type": "number", "default": 3, "min": 1, "max": 6}
                },
                "imgproxy_config": {
                    "width": 800,
                    "height": 600,
                    "resize_type": "fill",
                    "gravity": "sm",
                },
            },
        }

    @staticmethod
    def get_default_carousel_styles():
        """Default carousel style templates with Alpine.js, extracted from widget templates"""
        return {
            "default-carousel": {
                "name": "Default Carousel",
                "description": "Clean carousel with prev/next buttons",
                "usageType": "standard",
                "template": """<div class="gallery-carousel">
  <div class="carousel-container">
    <div class="carousel-track" id="carousel-track">
      {{#images}}
        <div class="carousel-slide" data-index="{{index}}">
          <img src="{{url}}" alt="{{alt}}" class="carousel-image" loading="lazy">
        </div>
      {{/images}}
    </div>
    {{#multipleImages}}
    <button class="carousel-btn carousel-prev" data-direction="-1" aria-label="Previous">
      <span class="icon-prev"></span>
    </button>
    <button class="carousel-btn carousel-next" data-direction="1" aria-label="Next">
      <span class="icon-next"></span>
    </button>
    {{/multipleImages}}
  </div>
</div>""",
                "css": """.gallery-carousel {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}
.carousel-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}
.carousel-track {
  display: flex;
  transition: transform 0.5s ease;
}
.carousel-slide {
  min-width: 100%;
  position: relative;
}
.carousel-image {
  max-width: 100%;
  height: 400px;
  object-fit: cover;
  display: block;
}
.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.9);
  border: none;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.25rem;
  color: #2d3748;
  transition: background-color 0.2s;
  z-index: 2;
}
.carousel-btn:hover {
  background: white;
}
.carousel-prev { left: 1rem; }
.carousel-next { right: 1rem; }
.icon-prev::before { content: "◀"; }
.icon-next::before { content: "▶"; }
@media (max-width: 768px) {
  .carousel-image {
    height: 250px;
  }
  .carousel-btn {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }
}
@media (max-width: 480px) {
  .carousel-btn {
    width: 2rem;
    height: 2rem;
    font-size: 0.875rem;
  }
  .carousel-prev { left: 0.5rem; }
  .carousel-next { right: 0.5rem; }
}""",
                "alpine": False,
                "variables": {},
                "imgproxy_config": {
                    "width": 1200,
                    "height": 400,
                    "resize_type": "fill",
                    "gravity": "sm",
                },
            },
            "carousel-with-indicators": {
                "name": "Carousel with Indicators",
                "description": "Carousel with dot navigation indicators",
                "usageType": "standard",
                "template": """<div class="gallery-carousel">
  <div class="carousel-container">
    <div class="carousel-track" id="carousel-track">
      {{#images}}
        <div class="carousel-slide" data-index="{{index}}">
          <img src="{{url}}" alt="{{alt}}" class="carousel-image" loading="lazy">
        </div>
      {{/images}}
    </div>
    {{#multipleImages}}
    <button class="carousel-btn carousel-prev" data-direction="-1" aria-label="Previous">
      <span class="icon-prev"></span>
    </button>
    <button class="carousel-btn carousel-next" data-direction="1" aria-label="Next">
      <span class="icon-next"></span>
    </button>
    <div class="carousel-indicators">
      {{#images}}
        <button class="indicator-dot{{#first}} active{{/first}}" data-slide-index="{{index}}"></button>
      {{/images}}
    </div>
    {{/multipleImages}}
  </div>
</div>""",
                "css": """.gallery-carousel {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}
.carousel-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}
.carousel-track {
  display: flex;
  transition: transform 0.5s ease;
}
.carousel-slide {
  min-width: 100%;
  position: relative;
}
.carousel-image {
  max-width: 100%;
  height: 400px;
  object-fit: cover;
  display: block;
}
.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.9);
  border: none;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.25rem;
  color: #2d3748;
  transition: background-color 0.2s;
  z-index: 2;
}
.carousel-btn:hover {
  background: white;
}
.carousel-prev { left: 1rem; }
.carousel-next { right: 1rem; }
.carousel-indicators {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  z-index: 2;
}
.indicator-dot {
  width: 0.75rem;
  height: 0.75rem;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.5);
  cursor: pointer;
  transition: background-color 0.2s;
}
.indicator-dot.active {
  background: white;
}
.icon-prev::before { content: "◀"; }
.icon-next::before { content: "▶"; }
@media (max-width: 768px) {
  .carousel-image {
    height: 250px;
  }
  .carousel-btn {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }
}
@media (max-width: 480px) {
  .carousel-btn {
    width: 2rem;
    height: 2rem;
    font-size: 0.875rem;
  }
  .carousel-prev { left: 0.5rem; }
  .carousel-next { right: 0.5rem; }
}""",
                "alpine": False,
                "variables": {},
                "imgproxy_config": {
                    "width": 1200,
                    "height": 400,
                    "resize_type": "fill",
                    "gravity": "sm",
                },
            },
            "carousel-with-captions": {
                "name": "Carousel with Captions",
                "description": "Carousel with gradient caption overlay",
                "usageType": "standard",
                "template": """<div class="gallery-carousel">
  <div class="carousel-container">
    <div class="carousel-track" id="carousel-track">
      {{#images}}
        <div class="carousel-slide" data-index="{{index}}">
          <img src="{{url}}" alt="{{alt}}" class="carousel-image" loading="lazy">
          {{#showCaptions}}
            {{#caption}}
              <div class="carousel-caption">{{caption}}</div>
            {{/caption}}
          {{/showCaptions}}
        </div>
      {{/images}}
    </div>
    {{#multipleImages}}
    <button class="carousel-btn carousel-prev" data-direction="-1" aria-label="Previous">
      <span class="icon-prev"></span>
    </button>
    <button class="carousel-btn carousel-next" data-direction="1" aria-label="Next">
      <span class="icon-next"></span>
    </button>
    <div class="carousel-indicators">
      {{#images}}
        <button class="indicator-dot{{#first}} active{{/first}}" data-slide-index="{{index}}"></button>
      {{/images}}
    </div>
    {{/multipleImages}}
  </div>
</div>""",
                "css": """.gallery-carousel {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}
.carousel-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}
.carousel-track {
  display: flex;
  transition: transform 0.5s ease;
}
.carousel-slide {
  min-width: 100%;
  position: relative;
}
.carousel-image {
  max-width: 100%;
  height: 400px;
  object-fit: cover;
  display: block;
}
.carousel-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  color: white;
  padding: 2rem 1.5rem 1rem;
  font-size: 1.125rem;
  font-weight: 500;
}
.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.9);
  border: none;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.25rem;
  color: #2d3748;
  transition: background-color 0.2s;
  z-index: 2;
}
.carousel-btn:hover {
  background: white;
}
.carousel-prev { left: 1rem; }
.carousel-next { right: 1rem; }
.carousel-indicators {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  z-index: 2;
}
.indicator-dot {
  width: 0.75rem;
  height: 0.75rem;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.5);
  cursor: pointer;
  transition: background-color 0.2s;
}
.indicator-dot.active {
  background: white;
}
.icon-prev::before { content: "◀"; }
.icon-next::before { content: "▶"; }
@media (max-width: 768px) {
  .carousel-image {
    height: 250px;
  }
  .carousel-btn {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }
}
@media (max-width: 480px) {
  .carousel-btn {
    width: 2rem;
    height: 2rem;
    font-size: 0.875rem;
  }
  .carousel-prev { left: 0.5rem; }
  .carousel-next { right: 0.5rem; }
}""",
                "alpine": False,
                "variables": {},
                "imgproxy_config": {
                    "width": 1200,
                    "height": 400,
                    "resize_type": "fill",
                    "gravity": "sm",
                },
            },
        }

    @staticmethod
    def get_default_component_styles():
        """Default component styles for reusable elements, extracted from widget templates"""
        return {
            "content-card": {
                "name": "Card",
                "description": "Content wrapped in a card with shadow and padding",
                "template": """<div class="content-card">
  {{#anchor}}
    <h2 class="card-heading" id="{{anchor}}">{{anchor}}</h2>
  {{/anchor}}
  <div class="card-body">
    {{{content}}}
  </div>
</div>""",
                "css": """.content-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin: 1.5rem 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.content-card .card-heading {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
  border-bottom: 2px solid #3b82f6;
  padding-bottom: 0.5rem;
}
.content-card .card-body {
  color: #374151;
  line-height: 1.6;
}""",
                "variables": {},
            },
            "content-callout": {
                "name": "Callout Box",
                "description": "Highlighted callout box with colored border",
                "template": """<div class="content-callout">
  {{#anchor}}
    <h3 class="callout-heading" id="{{anchor}}">{{anchor}}</h3>
  {{/anchor}}
  <div class="callout-body">
    {{{content}}}
  </div>
</div>""",
                "css": """.content-callout {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  padding: 1.25rem;
  margin: 1.5rem 0;
  border-radius: 0.25rem;
}
.content-callout .callout-heading {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e40af;
  margin: 0 0 0.75rem 0;
}
.content-callout .callout-body {
  color: #1e3a8a;
  line-height: 1.6;
}""",
                "variables": {},
            },
            "content-banner": {
                "name": "Banner",
                "description": "Full-width banner with background color",
                "template": """<div class="content-banner">
  {{#anchor}}
    <h2 class="banner-heading" id="{{anchor}}">{{anchor}}</h2>
  {{/anchor}}
  <div class="banner-body">
    {{{content}}}
  </div>
</div>""",
                "css": """.content-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  padding: 2.5rem 2rem;
  margin: 2rem 0;
  border-radius: 0.75rem;
  text-align: center;
}
.content-banner .banner-heading {
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 1rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.content-banner .banner-body {
  font-size: 1.125rem;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.95);
}""",
                "variables": {},
            },
            "content-sidebar-box": {
                "name": "Sidebar Box",
                "description": "Compact sidebar-styled content box",
                "template": """<div class="content-sidebar-box">
  {{#anchor}}
    <h4 class="sidebar-heading" id="{{anchor}}">{{anchor}}</h4>
  {{/anchor}}
  <div class="sidebar-body">
    {{{content}}}
  </div>
</div>""",
                "css": """.content-sidebar-box {
  background: #f9fafb;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  padding: 1.25rem;
  margin: 1rem 0;
  font-size: 0.875rem;
}
.content-sidebar-box .sidebar-heading {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.75rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}
.content-sidebar-box .sidebar-body {
  color: #4b5563;
  line-height: 1.5;
}""",
                "variables": {},
            },
            "content-highlight": {
                "name": "Highlight (CSS Only)",
                "description": "Adds highlight styling without changing HTML structure",
                "template": "{{passthru}}",
                "css": """.content-widget {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  padding: 1rem;
  margin: 1rem 0;
  border-radius: 0.25rem;
}""",
                "variables": {},
            },
            "content-info-box": {
                "name": "Info Box (CSS Only)",
                "description": "Blue info box styling with default HTML",
                "template": "{{passthru}}",
                "css": """.content-widget {
  background: #dbeafe;
  border: 1px solid #3b82f6;
  border-radius: 0.5rem;
  padding: 1.25rem;
  margin: 1.5rem 0;
  color: #1e40af;
}""",
                "variables": {},
            },
            "image-simple": {
                "name": "Simple Image",
                "description": "Basic image with size and alignment options",
                "usageType": "both",
                "template": """<div class="image-widget image-size-{{size}} image-align-{{alignment}}">
  <div class="image-container">
    {{content}}
  </div>
  {{#caption}}
    <div class="image-caption">{{caption}}</div>
  {{/caption}}
</div>""",
                "css": """.image-widget {
  margin: 1rem 0;
}
.image-widget.image-align-left {
  text-align: left;
}
.image-widget.image-align-center {
  text-align: center;
}
.image-widget.image-align-right {
  text-align: right;
}
.image-widget.image-size-small .widget-image {
  max-width: 200px;
  width: 100%;
}
.image-widget.image-size-medium .widget-image {
  max-width: 400px;
  width: 100%;
}
.image-widget.image-size-large .widget-image {
  max-width: 600px;
  width: 100%;
}
.image-widget.image-size-full .widget-image {
  width: 100%;
}
.widget-image {
  height: auto;
  border-radius: 0;
}
.image-caption {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  font-style: italic;
}""",
                "variables": {},
            },
            "lightbox-modal": {
                "name": "Lightbox Modal",
                "description": "Full-screen lightbox for image viewing",
                "template": """<div class="lightbox-modal" id="lightbox-modal" style="display: none;">
  <div class="lightbox-content">
    <button class="lightbox-close">&times;</button>
    <div class="lightbox-image-container">
      <img id="lightbox-image" src="" alt="" class="lightbox-image">
      <button class="lightbox-btn lightbox-prev">◀</button>
      <button class="lightbox-btn lightbox-next">▶</button>
    </div>
    <div class="lightbox-info" id="lightbox-info">
      <h3 id="lightbox-caption"></h3>
      <p id="lightbox-description"></p>
    </div>
    <div class="lightbox-counter" id="lightbox-counter"></div>
  </div>
</div>""",
                "css": """.lightbox-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}
.lightbox-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: white;
  border-radius: 0;
  overflow: hidden;
}
.lightbox-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(0,0,0,0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.5rem;
  cursor: pointer;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lightbox-image-container {
  position: relative;
}
.lightbox-image {
  max-width: 100%;
  max-height: 70vh;
  width: auto;
  height: auto;
  display: block;
  border-radius: 0;
}
.lightbox-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  font-size: 1.25rem;
  cursor: pointer;
  transition: background-color 0.2s;
}
.lightbox-btn:hover {
  background: rgba(0,0,0,0.9);
}
.lightbox-prev { left: 1rem; }
.lightbox-next { right: 1rem; }
.lightbox-info {
  padding: 1.5rem;
}
.lightbox-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  color: #2d3748;
}
.lightbox-info p {
  margin: 0;
  color: #718096;
  line-height: 1.5;
}
.lightbox-counter {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}
@media (max-width: 768px) {
  .lightbox-modal {
    padding: 1rem;
  }
  .lightbox-btn {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }
}""",
                "variables": {},
            },
        }

    def generate_css(
        self, scope="", widget_type=None, slot=None, frontend_scoped=False
    ):
        """
        Generate complete CSS for this theme including colors, design groups, and custom CSS.
        Supports both new design_groups structure and legacy html_elements for backwards compatibility.

        Args:
            scope: CSS scope selector (default: "" for root, uses data attributes for targeting)
            widget_type: Optional widget type for targeted design groups
            slot: Optional slot name for targeted design groups
            frontend_scoped: If True, prepend .cms-content to design group selectors (for frontend editor)
        """
        css_parts = []

        # CSS Variables from colors (new) or css_variables (legacy)
        colors = self.colors or self.css_variables
        if colors:
            # Use :root for CSS variables when no scope, otherwise scope them
            var_scope = ":root" if not scope else scope
            variables_css = f"{var_scope} {{\n"
            for var_name, var_value in colors.items():
                variables_css += f"  --{var_name}: {var_value};\n"
            variables_css += "}"
            css_parts.append(variables_css)

        # Design groups styling (new structure with groups)
        if self.design_groups and self.design_groups.get("groups"):
            design_groups_css = self._generate_design_groups_css(
                scope, widget_type, slot, frontend_scoped
            )
            if design_groups_css:
                css_parts.append(design_groups_css)
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

    def _generate_design_groups_css(
        self, scope, widget_type=None, slot=None, frontend_scoped=False
    ):
        """
        Generate CSS for design groups with optional targeting by widget_type/slot.
        Groups are applied in order, with more specific groups overriding general ones.
        Converts named color references to CSS variables.

        Args:
            scope: CSS scope selector
            widget_type: Optional widget type for filtering
            slot: Optional slot name for filtering
            frontend_scoped: If True, prepend .cms-content to all selectors
        """
        import re

        css_parts = []

        # When generating complete CSS, include ALL groups (don't filter)
        # The groups themselves define their targeting via widgetTypes/slots arrays
        # So we just process all groups and let them generate their own selectors
        applicable_groups = self.design_groups.get("groups", [])

        # Generate CSS for each applicable group
        for group in applicable_groups:
            # Get widget types and slots (handle both camelCase and snake_case, array and single value)
            widget_types = group.get("widgetTypes", []) or group.get("widget_types", [])
            if not widget_types:
                # Check for single value (both camelCase and snake_case)
                single_wt = group.get("widgetType") or group.get("widget_type")
                if single_wt:
                    widget_types = [single_wt]

            slots = group.get("slots", [])
            if not slots and group.get("slot"):
                slots = [group["slot"]]

            # Build all selector combinations using CSS classes
            base_selectors = []

            # Helper to normalize names for CSS class names (lowercase, replace spaces/dots with hyphens)
            def normalize_for_css(name):
                import re

                return re.sub(r"[^a-z0-9-]", "-", name.lower())

            if not widget_types and not slots:
                # Global - no targeting, no class prefix (applies to all elements globally)
                base_selectors.append(scope if scope else "")
            elif not widget_types and slots:
                # Slot targeting only
                if scope:
                    base_selectors = [
                        f"{scope}.slot-{normalize_for_css(slot)}" for slot in slots
                    ]
                else:
                    base_selectors = [
                        f".slot-{normalize_for_css(slot)}" for slot in slots
                    ]
            elif widget_types and not slots:
                # Widget type targeting only
                if scope:
                    base_selectors = [
                        f"{scope}.widget-type-{normalize_for_css(wt)}"
                        for wt in widget_types
                    ]
                else:
                    base_selectors = [
                        f".widget-type-{normalize_for_css(wt)}" for wt in widget_types
                    ]
            else:
                # Both widget type and slot targeting (all combinations)
                # Use child combinator (>) to prevent cascading to nested widgets
                for wt in widget_types:
                    for slot in slots:
                        wt_normalized = normalize_for_css(wt)
                        slot_normalized = normalize_for_css(slot)
                        if scope:
                            base_selectors.append(
                                f"{scope}.slot-{slot_normalized} > .widget-type-{wt_normalized}"
                            )
                        else:
                            base_selectors.append(
                                f".slot-{slot_normalized} > .widget-type-{wt_normalized}"
                            )

            # Apply frontend scoping if requested
            if frontend_scoped:
                base_selectors = [
                    f".cms-content {sel}".strip() if sel else ".cms-content"
                    for sel in base_selectors
                ]

            elements = group.get("elements", {})
            for element, styles in elements.items():
                if not styles:
                    continue

                # Generate element rules for all base selectors
                # If base is empty (global styles), use element directly without space
                element_selectors = [
                    f"{base} {element}".strip() if base else element
                    for base in base_selectors
                ]
                selector = ",\n".join(element_selectors)
                css_rule = f"{selector} {{\n"
                # Convert camelCase (or snake_case) to kebab-case for CSS properties
                for property_name, property_value in styles.items():
                    # Handle both camelCase and snake_case input
                    # If already snake_case, just replace underscores with hyphens
                    if "_" in property_name:
                        css_property = property_name.replace("_", "-")
                    else:
                        # Convert camelCase to kebab-case
                        css_property = self._camel_to_kebab(property_name)

                    # Handle color references (named colors from palette)
                    # Check for any color-related property
                    color_properties = [
                        "color",
                        "background_color",
                        "border_color",
                        "border_left_color",
                        "border_right_color",
                        "border_top_color",
                        "border_bottom_color",
                    ]
                    if (
                        property_name in color_properties
                        and property_value in self.colors
                    ):
                        property_value = f"var(--{property_value})"

                    # Handle font-family - wrap fonts with spaces in quotes
                    # Check both camelCase and snake_case variants
                    if property_name in ["fontFamily", "font_family"]:
                        # Split by comma to handle font stacks
                        fonts = property_value.split(",")
                        quoted_fonts = []
                        generic_families = [
                            "serif",
                            "sans-serif",
                            "monospace",
                            "cursive",
                            "fantasy",
                            "system-ui",
                        ]

                        for font in fonts:
                            trimmed = font.strip()

                            # Remove ALL quotes (both single and double) from the font name
                            # This handles cases like 'Source Sans 3", "Source Sans 3', etc.
                            unquoted = re.sub(r'["\']', "", trimmed)

                            # If it's a generic family, use without quotes
                            if unquoted in generic_families:
                                quoted_fonts.append(unquoted)
                            # If contains spaces, wrap in double quotes
                            elif " " in unquoted:
                                quoted_fonts.append(f'"{unquoted}"')
                            # Single word font names don't need quotes
                            else:
                                quoted_fonts.append(unquoted)

                        property_value = ", ".join(quoted_fonts)

                    # Sanitize duplicate units (e.g., "36pxpx" -> "36px", "2remrem" -> "2rem")
                    # This fixes legacy data that may have accumulated duplicate units
                    duplicate_unit_pattern = r"^([-\d.]+)(px|rem|em|%|vh|vw|ch|ex)\2+$"
                    match = re.match(duplicate_unit_pattern, str(property_value))
                    if match:
                        # Extract number and first unit only
                        property_value = f"{match.group(1)}{match.group(2)}"

                    # Handle list-specific properties
                    if element in ["ul", "ol"] and property_name == "bulletType":
                        css_property = "list-style-type"

                    css_rule += f"  {css_property}: {property_value};\n"

                css_rule += "}"
                css_parts.append(css_rule)

            # Generate layout properties CSS for widget layout parts
            layout_properties = group.get("layoutProperties") or group.get(
                "layout_properties"
            )
            if layout_properties:
                # Get theme breakpoints for media queries
                breakpoints = self.get_breakpoints()

                # Get widget type metadata to look up selectors for layout parts
                part_selector_map = {}  # part_id -> custom selector
                if widget_types:
                    from webpages.widget_registry import widget_type_registry
                    for wt_type in widget_types:
                        wt_class = widget_type_registry.get_widget_type_by_type(wt_type)
                        if wt_class and hasattr(wt_class, 'layout_parts'):
                            for part_id, part_config in wt_class.layout_parts.items():
                                if isinstance(part_config, dict) and part_config.get("selector"):
                                    part_selector_map[part_id] = part_config["selector"]

                for part, part_breakpoints in layout_properties.items():
                    # Handle each breakpoint in mobile-first order
                    for bp_key in ["sm", "md", "lg", "xl"]:
                        # Get properties for this breakpoint with legacy support
                        if bp_key == "sm":
                            # Merge legacy formats into sm (base)
                            bp_props = {}
                            if part_breakpoints.get("default"):  # Legacy: default -> sm
                                bp_props.update(part_breakpoints["default"])
                            if part_breakpoints.get(
                                "desktop"
                            ):  # Very old: desktop -> sm
                                bp_props.update(part_breakpoints["desktop"])
                            if part_breakpoints.get(
                                "mobile"
                            ):  # Legacy: mobile -> sm (lower priority)
                                temp = (
                                    part_breakpoints["mobile"].copy()
                                    if isinstance(part_breakpoints.get("mobile"), dict)
                                    else {}
                                )
                                temp.update(bp_props)
                                bp_props = temp
                            if part_breakpoints.get(
                                "sm"
                            ):  # New format (takes precedence)
                                bp_props.update(part_breakpoints["sm"])
                        elif bp_key == "md":
                            bp_props = (
                                part_breakpoints.get("md")
                                or part_breakpoints.get("tablet")
                                or {}
                            )
                        else:
                            bp_props = part_breakpoints.get(bp_key) or {}

                        if not bp_props or len(bp_props) == 0:
                            continue

                        # Build selectors using layout part classes or custom selectors
                        # Check if this part has a custom selector defined in widget metadata
                        custom_selector = part_selector_map.get(part)
                        
                        if custom_selector:
                            # Use custom selector (e.g., ".nav-container a")
                            # Prefix with base selectors for scoping
                            part_selectors = []
                            for base in base_selectors:
                                if base:
                                    # Append custom selector as descendant
                                    part_selectors.append(f"{base} {custom_selector}".strip())
                                else:
                                    # Global - use custom selector as-is
                                    part_selectors.append(custom_selector)
                        else:
                            # Default behavior: use part id as class name
                            # base_selectors contain widget-type classes like:
                            # .widget-type-easy-widgets-contentcardwidget
                            #
                            # For widget root elements (parts ending in '-widget' or named 'container'),
                            # the widget-type class and part class are on the SAME element,
                            # so we use a same-element selector (no space).
                            # For child elements, we use descendant selectors (with space).
                            is_root_element = (
                                part.endswith("-widget") or part == "container"
                            )

                            part_selectors = []
                            for base in base_selectors:
                                if base:
                                    if is_root_element:
                                        # Root element: both classes on same div
                                        # .slot-main .widget-type-{type}.{part}
                                        part_selectors.append(f"{base}.{part}".strip())
                                    else:
                                        # Child element: descendant selector
                                        # .slot-main .widget-type-{type} .{part}
                                        part_selectors.append(f"{base} .{part}".strip())
                                else:
                                    # Fallback for global layout parts
                                    part_selectors.append(f".{part}")

                        selector = ",\n".join(part_selectors)

                        # Convert properties to CSS
                        css_rules = []
                        for prop_name, prop_value in bp_props.items():
                            css_prop = (
                                self._camel_to_kebab(prop_name)
                                if "_" not in prop_name
                                else prop_name.replace("_", "-")
                            )

                            # Convert color names to CSS variables
                            color_properties = [
                                "color",
                                "background-color",
                                "border-color",
                                "border-left-color",
                                "border-right-color",
                                "border-top-color",
                                "border-bottom-color",
                            ]
                            if (
                                css_prop in color_properties
                                and self.colors
                                and prop_value in self.colors
                            ):
                                prop_value = f"var(--{prop_value})"

                            css_rules.append(f"  {css_prop}: {prop_value};")

                        # Generate CSS rule
                        if bp_key == "sm":
                            # Base styles - NO media query
                            rule = f"{selector} {{\n" + "\n".join(css_rules) + "\n}"
                        else:
                            # Media query for larger breakpoints (mobile-first)
                            bp_px = breakpoints.get(bp_key)
                            rule = f"@media (min-width: {bp_px}px) {{\n"
                            rule += f"  {selector} {{\n"
                            rule += "\n".join(f"  {r}" for r in css_rules)
                            rule += "\n  }\n}"

                        css_parts.append(rule)

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
            design_groups=self.design_groups.copy() if self.design_groups else {},
            component_styles=(
                self.component_styles.copy() if self.component_styles else {}
            ),
            image_styles=self.image_styles.copy() if self.image_styles else {},
            gallery_styles=self.gallery_styles.copy() if self.gallery_styles else {},
            carousel_styles=self.carousel_styles.copy() if self.carousel_styles else {},
            table_templates=self.table_templates.copy() if self.table_templates else {},
            breakpoints=self.breakpoints.copy() if self.breakpoints else {},
            css_variables=self.css_variables.copy() if self.css_variables else {},
            html_elements=self.html_elements.copy() if self.html_elements else {},
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
