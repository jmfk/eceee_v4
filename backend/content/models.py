"""
Content Object Models for Object Publishing System

This module defines content objects that can be published as web pages:
- News: News articles and announcements
- Event: Events and activities
- LibraryItem: Documents, resources, and library materials
- Member: Organization members and staff
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse
from django.core.validators import URLValidator
from django.utils.text import slugify


class Namespace(models.Model):
    """
    Namespace for organizing content objects and preventing slug conflicts.
    Each namespace provides a separate slug space for content objects.
    Pages are not affected by namespaces and use hostname-based routing instead.
    """

    name = models.CharField(
        max_length=100, unique=True, help_text="Human-readable namespace name"
    )
    slug = models.SlugField(
        max_length=50, unique=True, help_text="URL-safe namespace identifier"
    )
    description = models.TextField(
        blank=True, help_text="Description of this namespace"
    )

    # Namespace configuration
    is_active = models.BooleanField(
        default=True, help_text="Whether this namespace is active"
    )
    is_default = models.BooleanField(
        default=False, help_text="Whether this is the default namespace"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_namespaces"
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Namespace"
        verbose_name_plural = "Namespaces"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Ensure only one default namespace exists"""
        if self.is_default:
            # Set all other namespaces to not default
            Namespace.objects.filter(is_default=True).exclude(pk=self.pk).update(
                is_default=False
            )
        super().save(*args, **kwargs)

    @classmethod
    def get_default(cls):
        """Get the default namespace, creating one if none exists"""
        default = cls.objects.filter(is_default=True).first()
        if not default:
            default = cls.objects.filter(is_active=True).first()
            if not default:
                # Create a default namespace if none exists
                default = cls.objects.create(
                    name="Default",
                    slug="default",
                    description="Default namespace for content",
                    is_default=True,
                    created_by=User.objects.first() if User.objects.exists() else None,
                )
        return default

    def get_content_count(self):
        """Get total count of content objects in this namespace"""
        count = 0
        count += self.news_objects.count()
        count += self.event_objects.count()
        count += self.libraryitem_objects.count()
        count += self.member_objects.count()
        count += self.categories.count()
        count += self.tags.count()

        return count


class BaseContentModel(models.Model):
    """
    Abstract base model for all content objects that can be published as pages.
    Provides common fields and functionality for object publishing.
    """

    # Namespace for slug organization
    namespace = models.ForeignKey(
        Namespace,
        on_delete=models.CASCADE,
        related_name="%(class)s_objects",
        help_text="Namespace for this content object",
        null=True,
        blank=True,
    )

    # Basic information
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True)

    # Content
    content = models.TextField(blank=True, help_text="Main content body")
    excerpt = models.TextField(
        blank=True, max_length=500, help_text="Short excerpt for listings and previews"
    )

    # Publishing
    is_published = models.BooleanField(default=False)
    published_date = models.DateTimeField(null=True, blank=True)
    featured = models.BooleanField(default=False)

    # SEO and metadata
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.TextField(max_length=160, blank=True)
    meta_keywords = models.CharField(max_length=500, blank=True)

    # Media
    featured_image = models.URLField(blank=True, help_text="URL to featured image")
    gallery_images = models.JSONField(
        default=list, blank=True, help_text="List of image URLs for gallery"
    )

    # Timestamps and ownership
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_%(class)s_objects"
    )
    last_modified_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="modified_%(class)s_objects"
    )

    class Meta:
        abstract = True
        ordering = ["-published_date", "-created_at"]
        unique_together = ["namespace", "slug"]

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        """Generate the canonical URL for this object"""
        content_type = self.__class__.__name__.lower()

        # Map model names to URL patterns
        url_mapping = {
            "event": "events",
            "libraryitem": "library",
            "member": "members",
            "news": "news",
        }

        url_path = url_mapping.get(content_type, content_type)
        return f"/{url_path}/{self.slug}/"

    def get_api_url(self):
        """Generate the API URL for this object"""
        content_type = self.__class__.__name__.lower()
        return reverse(f"api:{content_type}-detail", args=[self.pk])

    def publish(self, user=None):
        """Publish this object"""
        self.is_published = True
        self.published_date = timezone.now()
        if user:
            self.last_modified_by = user
        self.save()

    def unpublish(self, user=None):
        """Unpublish this object"""
        self.is_published = False
        if user:
            self.last_modified_by = user
        self.save()


class Category(models.Model):
    """Categories for organizing content objects"""

    # Namespace for slug organization
    namespace = models.ForeignKey(
        Namespace,
        on_delete=models.CASCADE,
        related_name="categories",
        help_text="Namespace for this category",
        null=True,
        blank=True,
    )

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    color = models.CharField(
        max_length=7, default="#3B82F6", help_text="Hex color code for this category"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Categories"
        unique_together = ["namespace", "slug"]

    def __str__(self):
        return self.name


class Tag(models.Model):
    """Tags for content objects with enhanced features"""

    # Namespace for slug organization
    namespace = models.ForeignKey(
        Namespace,
        on_delete=models.CASCADE,
        related_name="tags",
        help_text="Namespace for this tag",
        null=True,
        blank=True,
    )

    name = models.CharField(max_length=50)

    # Usage tracking
    usage_count = models.PositiveIntegerField(
        default=0, help_text="Number of times this tag has been used"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = ["namespace", "name"]
        indexes = [
            models.Index(fields=["namespace", "name"], name="content_tag_ns_name_idx"),
            models.Index(fields=["usage_count"], name="content_tag_usage_idx"),
            models.Index(fields=["created_at"], name="content_tag_created_idx"),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Override save to ensure default namespace and auto-generate slug"""
        # Ensure default namespace exists and assign it if none provided
        if not self.namespace:
            self.namespace = Namespace.get_default()

        normalized_name = self.name.strip().lower()
        self.name = slugify(normalized_name)

        super().save(*args, **kwargs)

    def increment_usage(self):
        """Increment usage count"""
        self.usage_count += 1
        self.save(update_fields=["usage_count"])

    @classmethod
    def get_or_create_tag(cls, name, namespace=None, **kwargs):
        """
        Get existing tag or create a new one with proper defaults

        Args:
            name: Tag name
            namespace: Namespace object (uses default if None)
            **kwargs: Additional fields for tag creation

        Returns:
            tuple: (tag, created) where created is True if tag was created
        """
        # Use default namespace if none provided
        if not namespace:
            namespace = Namespace.get_default()

        # Normalize name
        normalized_name = name.strip().lower()

        # Try to get existing tag
        try:
            tag = cls.objects.get(namespace=namespace, name=normalized_name)
            return tag, False
        except cls.DoesNotExist:
            # Create new tag
            tag_data = {"name": normalized_name, "namespace": namespace, **kwargs}
            tag = cls(**tag_data)
            tag.save()
            return tag, True

    @classmethod
    def get_popular_tags(cls, namespace=None, limit=20):
        """Get most popular tags in a namespace"""
        queryset = cls.objects.filter(usage_count__gt=0)
        if namespace:
            queryset = queryset.filter(namespace=namespace)
        else:
            # Use default namespace if none specified
            queryset = queryset.filter(namespace=Namespace.get_default())

        return queryset.order_by("-usage_count", "name")[:limit]

    @classmethod
    def search_tags(cls, query, namespace=None, limit=10):
        """Search tags by name"""
        from django.db.models import Q

        queryset = cls.objects.all()
        if namespace:
            queryset = queryset.filter(namespace=namespace)
        else:
            # Use default namespace if none specified
            queryset = queryset.filter(namespace=Namespace.get_default())

        # Search by name
        queryset = queryset.filter(Q(name__icontains=query)).order_by(
            "-usage_count", "name"
        )[:limit]

        return queryset


class News(BaseContentModel):
    """News articles and announcements"""

    # News-specific fields
    author = models.CharField(max_length=255, blank=True)
    byline = models.CharField(
        max_length=500, blank=True, help_text="Author byline or credentials"
    )

    # Categorization
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="news_articles",
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="news_articles")

    # News metadata
    source = models.CharField(max_length=255, blank=True)
    source_url = models.URLField(blank=True)

    # Priority and display
    priority = models.CharField(
        max_length=20,
        choices=[
            ("low", "Low"),
            ("normal", "Normal"),
            ("high", "High"),
            ("urgent", "Urgent"),
        ],
        default="normal",
    )

    # Display settings
    show_author = models.BooleanField(default=True)
    show_publish_date = models.BooleanField(default=True)
    allow_comments = models.BooleanField(default=True)

    class Meta:
        ordering = ["-priority", "-published_date", "-created_at"]
        verbose_name_plural = "News Articles"


class Event(BaseContentModel):
    """Events and activities"""

    # Event timing
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    all_day = models.BooleanField(default=False)
    timezone = models.CharField(
        max_length=50,
        default="UTC",
        help_text="Event timezone (e.g., 'America/New_York')",
    )

    # Location
    location_name = models.CharField(max_length=255, blank=True)
    location_address = models.TextField(blank=True)
    location_url = models.URLField(blank=True, help_text="Google Maps or venue URL")
    virtual_meeting_url = models.URLField(blank=True)

    # Event details
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="events")

    # Registration and capacity
    registration_required = models.BooleanField(default=False)
    registration_url = models.URLField(blank=True)
    max_attendees = models.PositiveIntegerField(null=True, blank=True)
    current_attendees = models.PositiveIntegerField(default=0)

    # Organizer information
    organizer_name = models.CharField(max_length=255, blank=True)
    organizer_email = models.EmailField(blank=True)
    organizer_phone = models.CharField(max_length=20, blank=True)

    # Event status
    status = models.CharField(
        max_length=20,
        choices=[
            ("scheduled", "Scheduled"),
            ("cancelled", "Cancelled"),
            ("postponed", "Postponed"),
            ("completed", "Completed"),
        ],
        default="scheduled",
    )

    # Display settings
    show_location = models.BooleanField(default=True)
    show_organizer = models.BooleanField(default=True)

    class Meta:
        ordering = ["start_date", "title"]

    def is_upcoming(self):
        """Check if event is in the future"""
        return self.start_date > timezone.now()

    def is_past(self):
        """Check if event is in the past"""
        end_time = self.end_date or self.start_date
        return end_time < timezone.now()

    def duration_hours(self):
        """Calculate event duration in hours"""
        if not self.end_date:
            return None
        duration = self.end_date - self.start_date
        return duration.total_seconds() / 3600


class LibraryItem(BaseContentModel):
    """Documents, resources, and library materials"""

    # Item type
    item_type = models.CharField(
        max_length=30,
        choices=[
            ("document", "Document"),
            ("report", "Report"),
            ("policy", "Policy"),
            ("guide", "Guide"),
            ("manual", "Manual"),
            ("form", "Form"),
            ("template", "Template"),
            ("presentation", "Presentation"),
            ("video", "Video"),
            ("audio", "Audio"),
            ("dataset", "Dataset"),
            ("other", "Other"),
        ],
        default="document",
    )

    # File information
    file_url = models.URLField(blank=True, help_text="URL to the main file")
    file_size = models.CharField(max_length=50, blank=True, help_text="e.g., '2.5 MB'")
    file_format = models.CharField(
        max_length=20, blank=True, help_text="e.g., 'PDF', 'DOCX'"
    )

    # Additional files
    attachments = models.JSONField(
        default=list, blank=True, help_text="List of additional file URLs with metadata"
    )

    # Categorization
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="library_items",
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="library_items")

    # Access and permissions
    access_level = models.CharField(
        max_length=20,
        choices=[
            ("public", "Public"),
            ("members", "Members Only"),
            ("staff", "Staff Only"),
            ("restricted", "Restricted"),
        ],
        default="public",
    )

    # Metadata
    version = models.CharField(max_length=20, blank=True)
    isbn = models.CharField(max_length=20, blank=True, help_text="ISBN for books")
    doi = models.CharField(
        max_length=100, blank=True, help_text="DOI for academic papers"
    )

    # Usage tracking
    download_count = models.PositiveIntegerField(default=0)
    view_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-featured", "-published_date", "title"]


class Member(BaseContentModel):
    """Organization members and staff"""

    # Personal information
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    display_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Public display name (defaults to first + last name)",
    )

    # Professional information
    job_title = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True)
    organization = models.CharField(max_length=255, blank=True)

    # Contact information
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    office_location = models.CharField(max_length=255, blank=True)

    # Professional details
    biography = models.TextField(blank=True)
    expertise_areas = models.JSONField(
        default=list, blank=True, help_text="List of expertise areas or specializations"
    )
    qualifications = models.TextField(blank=True)

    # Social and web presence
    website_url = models.URLField(blank=True)
    linkedin_url = models.URLField(blank=True)
    twitter_handle = models.CharField(max_length=50, blank=True)

    # Member details
    member_type = models.CharField(
        max_length=20,
        choices=[
            ("staff", "Staff"),
            ("board", "Board Member"),
            ("volunteer", "Volunteer"),
            ("advisor", "Advisor"),
            ("alumni", "Alumni"),
            ("partner", "Partner"),
        ],
        default="staff",
    )

    # Categorization
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="members")

    # Employment/membership dates
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=True)

    # Display settings
    show_contact_info = models.BooleanField(default=True)
    show_biography = models.BooleanField(default=True)
    list_in_directory = models.BooleanField(default=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def get_full_name(self):
        """Return the member's full name"""
        if self.display_name:
            return self.display_name

        name_parts = [self.first_name]
        if self.middle_name:
            name_parts.append(self.middle_name)
        name_parts.append(self.last_name)
        return " ".join(name_parts)

    @property
    def full_name(self):
        """Property alias for get_full_name()"""
        return self.get_full_name()

    def get_short_name(self):
        """Return first name + last name"""
        return f"{self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        if not self.display_name:
            self.display_name = self.get_short_name()
        if not self.title:
            self.title = self.get_full_name()
        super().save(*args, **kwargs)
