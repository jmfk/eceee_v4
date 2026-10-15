"""
Content Object Models for Object Publishing System

This module defines content objects that can be published as web pages:
- News: News articles and announcements
- Event: Events and activities
- LibraryItem: Documents, resources, and library materials
- Member: Organization members and staff
"""

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.text import slugify


class Namespace(models.Model):
    """
    Namespace for organizing content objects and preventing slug conflicts.
    Each namespace provides a separate slug space for content objects.
    Pages are not affected by namespaces and use hostname-based routing instead.
    """

    KIND_CONTENT = "content"
    KIND_THEME_MEDIA = "theme_media"
    KIND_CHOICES = [
        (KIND_CONTENT, "Content"),
        (KIND_THEME_MEDIA, "Theme media"),
    ]

    name = models.CharField(max_length=100, help_text="Human-readable namespace name")
    slug = models.SlugField(max_length=100, help_text="URL-safe namespace identifier")
    description = models.TextField(blank=True, help_text="Description of this namespace")

    # Namespace configuration
    is_active = models.BooleanField(default=True, help_text="Whether this namespace is active")
    is_default = models.BooleanField(default=False, help_text="Whether this is the default namespace")
    is_hidden = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Hide this namespace from ordinary user-facing namespace and media views",
    )
    kind = models.CharField(
        max_length=32,
        choices=KIND_CHOICES,
        default=KIND_CONTENT,
        db_index=True,
        help_text="System purpose of this namespace",
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_namespaces")

    # Multi-tenancy support
    tenant = models.ForeignKey(
        "core.Tenant",
        on_delete=models.CASCADE,
        related_name="namespaces",
        help_text="Tenant this namespace belongs to",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Namespace"
        verbose_name_plural = "Namespaces"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "name"], name="unique_namespace_name_per_tenant"),
            models.UniqueConstraint(fields=["tenant", "slug"], name="unique_namespace_slug_per_tenant"),
            models.UniqueConstraint(
                fields=["tenant"],
                condition=Q(is_default=True),
                name="unique_default_namespace_per_tenant",
            ),
            models.UniqueConstraint(
                fields=["tenant"],
                condition=Q(kind="theme_media"),
                name="one_theme_media_namespace_per_tenant",
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Ensure only one default namespace exists for this tenant."""
        if self.kind == self.KIND_THEME_MEDIA:
            self.is_hidden = True
            self.is_default = False
        if self.is_hidden:
            self.is_default = False
        if self.is_default:
            Namespace.objects.filter(tenant_id=self.tenant_id, is_default=True).exclude(pk=self.pk).update(
                is_default=False
            )
        super().save(*args, **kwargs)

    @classmethod
    def get_default(cls, tenant=None):
        """Get the default namespace, scoped to a tenant when provided."""
        queryset = cls.objects.filter(kind=cls.KIND_CONTENT)
        if tenant is not None:
            queryset = queryset.filter(tenant=tenant)
        default = queryset.filter(is_default=True).first()
        if not default:
            if tenant is None:
                default = queryset.filter(is_active=True).first()
            else:
                default = queryset.filter(slug="default").first()
                if default:
                    default.is_default = True
                    default.save(update_fields=["is_default", "updated_at"])
            if not default:
                user = User.objects.first()
                if not user:
                    user = User.objects.create_user(
                        username="system",
                        email="system@localhost",
                    )

                if tenant is None:
                    from core.models import Tenant

                    tenant, _ = Tenant.objects.get_or_create(
                        identifier="default",
                        defaults={
                            "name": "Default Tenant",
                            "created_by": user,
                        },
                    )

                # Create a default namespace if none exists
                default = cls.objects.create(
                    name="Default",
                    slug="default",
                    description="Default namespace for content",
                    is_default=True,
                    created_by=user,
                    tenant=tenant,
                )
        return default

    @classmethod
    def resolve(cls, slug, tenant=None):
        """Resolve a namespace slug within a tenant boundary."""
        if slug == "default":
            return cls.get_default(tenant=tenant)
        queryset = cls.objects.all()
        if tenant is not None:
            queryset = queryset.filter(tenant=tenant)
        return queryset.get(slug=slug)

    @classmethod
    def get_or_create_theme_media(cls, tenant, created_by=None):
        """Return the tenant-wide, system-owned namespace used by theme editors."""
        namespace = cls.objects.filter(tenant=tenant, kind=cls.KIND_THEME_MEDIA).first()
        if namespace:
            return namespace

        owner = created_by or tenant.created_by
        name_prefix = "Theme media · "
        name_suffix = f" · {tenant.id.hex}"
        name = f"{name_prefix}{tenant.identifier}"
        if len(name) > 100:
            identifier_length = 100 - len(name_prefix) - len(name_suffix)
            name = f"{name_prefix}{tenant.identifier[:identifier_length]}{name_suffix}"
        namespace, _created = cls.objects.get_or_create(
            tenant=tenant,
            kind=cls.KIND_THEME_MEDIA,
            defaults={
                "name": name,
                "slug": f"theme-media-{tenant.id.hex}",
                "description": "System-owned media shared by this tenant's themes.",
                "is_active": True,
                "is_default": False,
                "is_hidden": True,
                "created_by": owner,
            },
        )
        return namespace

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
    color = models.CharField(max_length=7, default="#3B82F6", help_text="Hex color code for this category")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Multi-tenancy support
    tenant = models.ForeignKey(
        "core.Tenant",
        on_delete=models.CASCADE,
        related_name="categories",
        help_text="Tenant this category belongs to",
    )

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
    usage_count = models.PositiveIntegerField(default=0, help_text="Number of times this tag has been used")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    # Multi-tenancy support
    tenant = models.ForeignKey(
        "core.Tenant",
        on_delete=models.CASCADE,
        related_name="tags",
        help_text="Tenant this tag belongs to",
    )

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
        queryset = queryset.filter(Q(name__icontains=query)).order_by("-usage_count", "name")[:limit]

        return queryset
