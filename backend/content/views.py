"""
Content Object Views for Object Publishing System

Provides REST API views for content objects that can be published as pages.
"""

from django.shortcuts import render
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone

from .models import News, Event, LibraryItem, Member, Category, Tag, Namespace
from .serializers import (
    NewsSerializer,
    EventSerializer,
    LibraryItemSerializer,
    MemberSerializer,
    CategorySerializer,
    TagSerializer,
    NamespaceSerializer,
    NamespaceListSerializer,
    NewsListSerializer,
    EventListSerializer,
    LibraryItemListSerializer,
    MemberListSerializer,
)


class NamespaceViewSet(viewsets.ModelViewSet):
    """ViewSet for Namespace model"""

    queryset = Namespace.objects.all()
    serializer_class = NamespaceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "slug", "description"]
    ordering_fields = ["name", "slug", "created_at", "is_default"]
    ordering = ["-is_default", "name"]

    def get_serializer_class(self):
        if self.action == "list":
            return NamespaceListSerializer
        return NamespaceSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by active status
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        # Filter by default status
        is_default = self.request.query_params.get("is_default")
        if is_default is not None:
            queryset = queryset.filter(is_default=is_default.lower() == "true")

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        # If setting this namespace as default, unset others
        if serializer.validated_data.get("is_default", False):
            Namespace.objects.filter(is_default=True).exclude(
                pk=serializer.instance.pk
            ).update(is_default=False)
        serializer.save()

    @action(detail=True, methods=["post"])
    def set_as_default(self, request, pk=None):
        """Set this namespace as the default namespace"""
        namespace = self.get_object()

        # Unset all other namespaces as default
        Namespace.objects.filter(is_default=True).exclude(pk=namespace.pk).update(
            is_default=False
        )

        # Set this namespace as default
        namespace.is_default = True
        namespace.save()

        return Response(
            {
                "message": f"Namespace '{namespace.name}' set as default",
                "namespace": NamespaceSerializer(namespace).data,
            }
        )

    @action(detail=True, methods=["post"])
    def get_content_summary(self, request, pk=None):
        """Get detailed content summary for this namespace"""
        namespace = self.get_object()

        # Get counts for each content type
        news_count = namespace.news_objects.count()
        event_count = namespace.event_objects.count()
        library_count = namespace.libraryitem_objects.count()
        member_count = namespace.member_objects.count()
        category_count = namespace.categories.count()
        tag_count = namespace.tags.count()

        return Response(
            {
                "namespace": NamespaceSerializer(namespace).data,
                "content_summary": {
                    "news": news_count,
                    "events": event_count,
                    "library_items": library_count,
                    "members": member_count,
                    "categories": category_count,
                    "tags": tag_count,
                    "total": news_count
                    + event_count
                    + library_count
                    + member_count
                    + category_count
                    + tag_count,
                },
            }
        )


class CategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for Category model"""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by active status
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        return queryset


class TagViewSet(viewsets.ModelViewSet):
    """ViewSet for Tag model"""

    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class NewsViewSet(viewsets.ModelViewSet):
    """ViewSet for News model"""

    queryset = News.objects.all()
    serializer_class = NewsSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_published", "featured", "priority", "category", "tags"]
    search_fields = ["title", "description", "content", "author"]
    ordering_fields = [
        "title",
        "published_date",
        "created_at",
        "updated_at",
        "priority",
    ]
    ordering = ["-priority", "-published_date", "-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return NewsListSerializer
        return NewsSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by published status for public access
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(is_published=True)

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(last_modified_by=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish a news article"""
        news = self.get_object()
        news.publish(user=request.user)
        return Response({"status": "published"})

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        """Unpublish a news article"""
        news = self.get_object()
        news.unpublish(user=request.user)
        return Response({"status": "unpublished"})


class EventViewSet(viewsets.ModelViewSet):
    """ViewSet for Event model"""

    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_published", "featured", "status", "category", "tags"]
    search_fields = [
        "title",
        "description",
        "content",
        "location_name",
        "organizer_name",
    ]
    ordering_fields = [
        "title",
        "start_date",
        "published_date",
        "created_at",
        "updated_at",
    ]
    ordering = ["start_date", "title"]

    def get_serializer_class(self):
        if self.action == "list":
            return EventListSerializer
        return EventSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by published status for public access
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(is_published=True)

        # Filter by time period
        time_filter = self.request.query_params.get("time_filter")
        if time_filter == "upcoming":
            queryset = queryset.filter(start_date__gt=timezone.now())
        elif time_filter == "past":
            queryset = queryset.filter(start_date__lt=timezone.now())

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(last_modified_by=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish an event"""
        event = self.get_object()
        event.publish(user=request.user)
        return Response({"status": "published"})

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        """Unpublish an event"""
        event = self.get_object()
        event.unpublish(user=request.user)
        return Response({"status": "unpublished"})


class LibraryItemViewSet(viewsets.ModelViewSet):
    """ViewSet for LibraryItem model"""

    queryset = LibraryItem.objects.all()
    serializer_class = LibraryItemSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        "is_published",
        "featured",
        "item_type",
        "access_level",
        "category",
        "tags",
    ]
    search_fields = ["title", "description", "content"]
    ordering_fields = ["title", "published_date", "created_at", "updated_at"]
    ordering = ["-featured", "-published_date", "title"]

    def get_serializer_class(self):
        if self.action == "list":
            return LibraryItemListSerializer
        return LibraryItemSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by published status for public access
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(is_published=True, access_level="public")
        elif not self.request.user.is_staff:
            # Non-staff authenticated users can see public and members-only content
            queryset = queryset.filter(
                is_published=True, access_level__in=["public", "members"]
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(last_modified_by=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish a library item"""
        item = self.get_object()
        item.publish(user=request.user)
        return Response({"status": "published"})

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        """Unpublish a library item"""
        item = self.get_object()
        item.unpublish(user=request.user)
        return Response({"status": "unpublished"})

    @action(detail=True, methods=["post"])
    def track_download(self, request, pk=None):
        """Track a download of this library item"""
        item = self.get_object()
        item.download_count += 1
        item.save()
        return Response({"download_count": item.download_count})

    @action(detail=True, methods=["post"])
    def track_view(self, request, pk=None):
        """Track a view of this library item"""
        item = self.get_object()
        item.view_count += 1
        item.save()
        return Response({"view_count": item.view_count})


class MemberViewSet(viewsets.ModelViewSet):
    """ViewSet for Member model"""

    queryset = Member.objects.all()
    serializer_class = MemberSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        "is_published",
        "featured",
        "member_type",
        "is_current",
        "category",
        "tags",
    ]
    search_fields = [
        "first_name",
        "last_name",
        "display_name",
        "job_title",
        "department",
        "organization",
        "biography",
    ]
    ordering_fields = [
        "last_name",
        "first_name",
        "job_title",
        "created_at",
        "updated_at",
    ]
    ordering = ["last_name", "first_name"]

    def get_serializer_class(self):
        if self.action == "list":
            return MemberListSerializer
        return MemberSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by published status for public access
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(is_published=True, list_in_directory=True)

        # Filter by current status
        show_current = self.request.query_params.get("current_only")
        if show_current and show_current.lower() == "true":
            queryset = queryset.filter(is_current=True)

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(last_modified_by=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish a member profile"""
        member = self.get_object()
        member.publish(user=request.user)
        return Response({"status": "published"})

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        """Unpublish a member profile"""
        member = self.get_object()
        member.unpublish(user=request.user)
        return Response({"status": "unpublished"})
