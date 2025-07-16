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
import uuid


class BaseContentModel(models.Model):
    """
    Abstract base model for all content objects that can be published as pages.
    Provides common fields and functionality for object publishing.
    """

    # Basic information
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
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

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        """Generate the canonical URL for this object"""
        content_type = self.__class__.__name__.lower()
        return f"/{content_type}/{self.slug}/"

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

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(
        max_length=7, default="#3B82F6", help_text="Hex color code for this category"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Tag(models.Model):
    """Tags for content objects"""

    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


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

    def get_short_name(self):
        """Return first name + last name"""
        return f"{self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        if not self.display_name:
            self.display_name = self.get_short_name()
        if not self.title:
            self.title = self.get_full_name()
        super().save(*args, **kwargs)
