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
        max_length=100, unique=True, help_text="URL-safe namespace identifier"
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
        count += self.categories.count()
        count += self.tags.count()

        return count


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

    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)

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
        """Override save to ensure default namespace and generate slug"""
        # Ensure default namespace exists and assign it if none provided
        if not self.namespace:
            self.namespace = Namespace.get_default()

        # Normalize the name and generate slug
        self.name = self.name.strip()
        self.slug = slugify(self.name)

        # Check for uniqueness of both name and slug
        if Tag.objects.exclude(pk=self.pk).filter(name=self.name).exists():
            raise ValidationError("A tag with this name already exists")
        if Tag.objects.exclude(pk=self.pk).filter(slug=self.slug).exists():
            raise ValidationError("A tag with this slug already exists")

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
        normalized_name = name.strip()
        normalized_slug = slugify(normalized_name)

        # Try to get existing tag
        try:
            tag = cls.objects.get(namespace=namespace, slug=normalized_slug)
            if tag is None:
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
