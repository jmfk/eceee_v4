"""
Object Publishing System utilities for better OOP design.

This module implements the registry pattern, strategy pattern, and content formatters
to replace conditional logic and separate concerns.
"""

from typing import Dict, Any, Optional, Type
from django.db import models


class ObjectTypeRegistry:
    """Registry for managing object types and their corresponding models."""

    _types: Dict[str, Type[models.Model]] = {}

    @classmethod
    def register(cls, type_name: str, model_class: Type[models.Model]) -> None:
        """Register a new object type with its model class."""
        cls._types[type_name] = model_class

    @classmethod
    def get_model(cls, type_name: str) -> Optional[Type[models.Model]]:
        """Get the model class for a given type name."""
        return cls._types.get(type_name)

    @classmethod
    def get_registered_types(cls) -> Dict[str, Type[models.Model]]:
        """Get all registered types."""
        return cls._types.copy()

    @classmethod
    def is_registered(cls, type_name: str) -> bool:
        """Check if a type is registered."""
        return type_name in cls._types


class BaseContentTransformer:
    """Base class for content transformers."""

    def transform(self, content_object: models.Model) -> Dict[str, Any]:
        """Transform content object to standardized format."""
        return {
            "object_type": self._get_object_type(),
            "title": getattr(content_object, "title", ""),
            "slug": getattr(content_object, "slug", ""),
            "description": getattr(content_object, "description", ""),
            "content": getattr(content_object, "content", ""),
            "excerpt": getattr(content_object, "excerpt", ""),
            "featured_image": getattr(content_object, "featured_image", ""),
            "is_published": getattr(content_object, "is_published", False),
            "published_date": getattr(content_object, "published_date", None),
            "created_at": content_object.created_at,
            "updated_at": content_object.updated_at,
            "meta_title": getattr(content_object, "meta_title", ""),
            "meta_description": getattr(content_object, "meta_description", ""),
            "meta_keywords": getattr(content_object, "meta_keywords", ""),
        }

    def _get_object_type(self) -> str:
        """Get the object type name."""
        return getattr(self, "object_type", "unknown")


class NewsContentTransformer(BaseContentTransformer):
    """Transformer for News objects."""

    object_type = "news"

    def transform(self, news_object: models.Model) -> Dict[str, Any]:
        """Transform news object with news-specific fields."""
        base_content = super().transform(news_object)
        news_specific = {
            "author": getattr(news_object, "author", ""),
            "priority": getattr(news_object, "priority", "normal"),
            "category": getattr(news_object, "category", None),
            "source": getattr(news_object, "source", ""),
        }
        return {**base_content, **news_specific}


class EventContentTransformer(BaseContentTransformer):
    """Transformer for Event objects."""

    object_type = "event"

    def transform(self, event_object: models.Model) -> Dict[str, Any]:
        """Transform event object with event-specific fields."""
        base_content = super().transform(event_object)
        event_specific = {
            "start_date": getattr(event_object, "start_date", None),
            "end_date": getattr(event_object, "end_date", None),
            "location_name": getattr(event_object, "location_name", ""),
            "location_address": getattr(event_object, "location_address", ""),
            "organizer_name": getattr(event_object, "organizer_name", ""),
            "status": getattr(event_object, "status", "scheduled"),
        }
        return {**base_content, **event_specific}


class LibraryItemContentTransformer(BaseContentTransformer):
    """Transformer for LibraryItem objects."""

    object_type = "libraryitem"

    def transform(self, library_object: models.Model) -> Dict[str, Any]:
        """Transform library item with library-specific fields."""
        base_content = super().transform(library_object)
        library_specific = {
            "item_type": getattr(library_object, "item_type", "document"),
            "file_url": getattr(library_object, "file_url", ""),
            "file_size": getattr(library_object, "file_size", ""),
            "file_format": getattr(library_object, "file_format", ""),
            "access_level": getattr(library_object, "access_level", "public"),
        }
        return {**base_content, **library_specific}


class MemberContentTransformer(BaseContentTransformer):
    """Transformer for Member objects."""

    object_type = "member"

    def transform(self, member_object: models.Model) -> Dict[str, Any]:
        """Transform member object with member-specific fields."""
        base_content = super().transform(member_object)
        member_specific = {
            "first_name": getattr(member_object, "first_name", ""),
            "last_name": getattr(member_object, "last_name", ""),
            "job_title": getattr(member_object, "job_title", ""),
            "department": getattr(member_object, "department", ""),
            "member_type": getattr(member_object, "member_type", "staff"),
            "biography": getattr(member_object, "biography", ""),
        }
        return {**base_content, **member_specific}


class ContentTransformerFactory:
    """Factory for creating content transformers."""

    _transformers = {
        "news": NewsContentTransformer(),
        "event": EventContentTransformer(),
        "libraryitem": LibraryItemContentTransformer(),
        "member": MemberContentTransformer(),
    }

    @classmethod
    def create(cls, object_type: str) -> BaseContentTransformer:
        """Create a transformer for the given object type."""
        return cls._transformers.get(object_type, BaseContentTransformer())


class ObjectContentFormatter:
    """Main content formatter that delegates to specific transformers."""

    def __init__(self, content_object: models.Model, object_type: str):
        self.content_object = content_object
        self.object_type = object_type

    def format(self) -> Dict[str, Any]:
        """Format content using appropriate transformer."""
        transformer = ContentTransformerFactory.create(self.object_type)
        return transformer.transform(self.content_object)


class ObjectPublishingService:
    """Domain service for object publishing operations."""

    def __init__(self, page):
        self.page = page

    def link_object(self, object_type: str, object_id: int, user=None) -> bool:
        """Link an object to the page."""
        # Validate object type
        if not ObjectTypeRegistry.is_registered(object_type):
            raise ValueError(f"Object type '{object_type}' is not registered")

        # Validate object exists
        model_class = ObjectTypeRegistry.get_model(object_type)
        try:
            linked_object = model_class.objects.get(pk=object_id)
        except model_class.DoesNotExist:
            raise ValueError(f"Object with id {object_id} does not exist")

        # Perform linking
        self.page.linked_object_type = object_type
        self.page.linked_object_id = object_id

        # Update page metadata from object if not already set
        if not self.page.title:
            self.page.title = linked_object.title
        if not self.page.slug:
            self.page.slug = linked_object.slug
        if not self.page.description:
            self.page.description = linked_object.description
        if not self.page.meta_title and hasattr(linked_object, "meta_title"):
            self.page.meta_title = linked_object.meta_title
        if not self.page.meta_description and hasattr(
            linked_object, "meta_description"
        ):
            self.page.meta_description = linked_object.meta_description

        if user:
            self.page.last_modified_by = user

        self.page.save()

        return True

    def unlink_object(self, user=None) -> bool:
        """Unlink the current object from the page."""
        self.page.linked_object_type = ""
        self.page.linked_object_id = None

        if user:
            self.page.last_modified_by = user

        self.page.save()

        return True

    def get_linked_object(self):
        """Get the linked object using the registry."""
        if not self.page.linked_object_type or not self.page.linked_object_id:
            return None

        model_class = ObjectTypeRegistry.get_model(self.page.linked_object_type)
        if not model_class:
            return None

        try:
            return model_class.objects.get(pk=self.page.linked_object_id)
        except model_class.DoesNotExist:
            return None

    def get_formatted_content(self) -> Optional[Dict[str, Any]]:
        """Get formatted content from the linked object."""
        linked_object = self.get_linked_object()
        if not linked_object:
            return None

        formatter = ObjectContentFormatter(linked_object, self.page.linked_object_type)
        return formatter.format()

    def sync_with_object(self, user=None) -> bool:
        """Sync page metadata with the linked object."""
        if not self.page.is_object_page():
            return False

        linked_object = self.get_linked_object()
        if not linked_object:
            return False

        # Update page fields from object
        self.page.title = linked_object.title
        self.page.description = linked_object.description

        if hasattr(linked_object, "meta_title") and linked_object.meta_title:
            self.page.meta_title = linked_object.meta_title
        if (
            hasattr(linked_object, "meta_description")
            and linked_object.meta_description
        ):
            self.page.meta_description = linked_object.meta_description
        if hasattr(linked_object, "meta_keywords") and linked_object.meta_keywords:
            self.page.meta_keywords = linked_object.meta_keywords

        # Update publication status based on object
        if hasattr(linked_object, "is_published"):
            if (
                linked_object.is_published
                and self.page.publication_status == "unpublished"
            ):
                self.page.publication_status = "published"
            elif (
                not linked_object.is_published
                and self.page.publication_status == "published"
            ):
                self.page.publication_status = "unpublished"

        if user:
            self.page.last_modified_by = user

        self.page.save()
        return True


# Register content models on import
def register_content_models():
    """Register all content models with the registry."""
    try:
        from content.models import News, Event, LibraryItem, Member

        ObjectTypeRegistry.register("news", News)
        ObjectTypeRegistry.register("event", Event)
        ObjectTypeRegistry.register("libraryitem", LibraryItem)
        ObjectTypeRegistry.register("member", Member)
    except ImportError:
        # Content models not available
        pass


# Auto-register on import
register_content_models()
