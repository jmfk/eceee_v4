"""
Utility views for media file management.
"""

import logging
import re
from django.utils import timezone
from django.http import Http404
from django.shortcuts import redirect
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from ..models import MediaFile, MediaTag, MediaCollection
from ..serializers import BulkOperationSerializer
from ..storage import storage

logger = logging.getLogger(__name__)


class MediaSlugValidationView(APIView):
    """Validate slug uniqueness and generate alternatives if needed."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        Validate slug uniqueness and return a unique slug.

        Expected payload:
        {
            "slug": "my-custom-slug",  # Optional: slug to validate
            "title": "My Article Title",  # Optional: generate slug from title if slug not provided
            "namespace": "blog",
            "file_id": "uuid-string",  # Optional: exclude this file from uniqueness check
            "current_slugs": ["existing-slug-1", "existing-slug-2"]  # Optional: current session slugs
        }

        Returns:
        {
            "slug": "my-article-title-2",  # Original or alternative if conflict
            "is_valid": true,  # Whether the slug is valid and unique
            "message": "Slug is available"  # Status message
        }
        """
        try:
            # Handle both DRF request.data and regular request.POST/request.body
            if hasattr(request, "data"):
                data = request.data
            else:
                import json

                try:
                    data = json.loads(request.body) if request.body else {}
                except (json.JSONDecodeError, AttributeError):
                    data = request.POST

            slug = str(data.get("slug", "")).strip()
            title = str(data.get("title", "")).strip()
            namespace_slug = str(data.get("namespace", "")).strip()
            file_id = data.get("file_id")
            current_slugs = data.get("current_slugs", [])

            # Either slug or title must be provided
            if not slug and not title:
                return Response(
                    {"error": "Either 'slug' or 'title' is required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not namespace_slug:
                return Response(
                    {"error": "Namespace is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate current_slugs is a list
            if not isinstance(current_slugs, list):
                current_slugs = []

            # Get namespace object by slug
            from content.models import Namespace

            try:
                namespace = Namespace.objects.get(slug=namespace_slug)
            except Namespace.DoesNotExist:
                return Response(
                    {"error": f"Namespace '{namespace_slug}' not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Generate base slug from slug or title
            if slug:
                base_slug = self._generate_slug(slug)
            else:
                base_slug = self._generate_slug(title)

            # Check for uniqueness and generate alternative if needed
            unique_slug = self._get_unique_slug(base_slug, namespace, current_slugs, file_id)

            # Check if the provided slug is valid and unique
            is_valid = base_slug == unique_slug
            message = "Slug is available" if is_valid else f"Slug is taken. Suggestion: {unique_slug}"

            return Response({
                "slug": unique_slug,
                "is_valid": is_valid,
                "message": message
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error validating slug: {str(e)}")
            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _generate_slug(self, title):
        """Generate a slug from title."""
        # Convert to lowercase and replace non-alphanumeric with hyphens
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower())
        # Remove leading/trailing hyphens
        slug = slug.strip("-")
        return slug

    def _get_unique_slug(self, base_slug, namespace, current_slugs=None, file_id=None):
        """Get a unique slug by checking existing media files and current session slugs."""
        if current_slugs is None:
            current_slugs = []

        # Check against existing media files in database
        queryset = MediaFile.objects.filter(namespace=namespace)
        
        # Exclude the current file if file_id is provided
        if file_id:
            queryset = queryset.exclude(id=file_id)
        
        db_slugs = set(queryset.values_list("slug", flat=True))

        # Combine database slugs with current session slugs
        all_existing_slugs = db_slugs | set(current_slugs)

        # If base slug is unique, return it
        if base_slug not in all_existing_slugs:
            return base_slug

        # Generate alternative with counter
        counter = 2
        while f"{base_slug}-{counter}" in all_existing_slugs:
            counter += 1

        return f"{base_slug}-{counter}"


class BulkMediaOperationsView(APIView):
    """
    API view for bulk operations on media files.

    Supports operations like:
    - Adding/removing tags
    - Setting access levels
    - Adding/removing from collections
    - Deleting files
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Execute bulk operation on multiple files."""
        from ..serializers import BulkOperationSerializer
        from ..security import SecurityAuditLogger

        serializer = BulkOperationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        file_ids = data["file_ids"]
        operation = data["operation"]

        # Get files that user has permission to modify
        files = MediaFile.objects.filter(id__in=file_ids)

        # Filter by permissions
        if not request.user.is_staff:
            # Regular users can only modify their own files or files in accessible namespaces
            from content.models import Namespace

            accessible_namespaces = Namespace.objects.filter(
                models.Q(created_by=request.user) | models.Q(is_active=True)
            )
            files = files.filter(
                models.Q(created_by=request.user)
                | models.Q(namespace__in=accessible_namespaces)
            )

        results = []
        successful_count = 0
        errors = []

        for file_obj in files:
            try:
                file_id = str(file_obj.id)  # Store file ID before any operations

                if operation == "add_tags":
                    tag_names = data.get("tag_names", [])
                    for tag_name in tag_names:
                        tag, created = MediaTag.objects.get_or_create(
                            name=tag_name, namespace=file_obj.namespace
                        )
                        file_obj.tags.add(tag)

                elif operation == "remove_tags":
                    tag_names = data.get("tag_names", [])
                    for tag_name in tag_names:
                        try:
                            tag = MediaTag.objects.get(
                                name=tag_name, namespace=file_obj.namespace
                            )
                            file_obj.tags.remove(tag)
                        except MediaTag.DoesNotExist:
                            pass

                elif operation == "set_access_level":
                    access_level = data.get("access_level")
                    if access_level:
                        file_obj.access_level = access_level
                        file_obj.save()

                elif operation == "add_to_collection":
                    collection_id = data.get("collection_id")
                    if collection_id:
                        try:
                            collection = MediaCollection.objects.get(id=collection_id)
                            file_obj.collections.add(collection)
                        except MediaCollection.DoesNotExist:
                            errors.append(
                                {
                                    "file_id": str(file_obj.id),
                                    "message": "Collection not found",
                                }
                            )
                            continue

                elif operation == "remove_from_collection":
                    collection_id = data.get("collection_id")
                    if collection_id:
                        try:
                            collection = MediaCollection.objects.get(id=collection_id)
                            file_obj.collections.remove(collection)
                        except MediaCollection.DoesNotExist:
                            errors.append(
                                {
                                    "file_id": str(file_obj.id),
                                    "message": "Collection not found",
                                }
                            )
                            continue

                elif operation == "delete":
                    # Log the deletion for security audit
                    SecurityAuditLogger.log_file_deletion(
                        user=request.user,
                        file_obj=file_obj,
                        context={"bulk_operation": True},
                    )
                    file_obj.delete()

                successful_count += 1
                results.append({"file_id": file_id, "status": "success"})

            except Exception as e:
                # Use stored file_id if available, otherwise try to get current id
                error_file_id = file_id if "file_id" in locals() else str(file_obj.id)
                errors.append({"file_id": error_file_id, "message": str(e)})

        return Response(
            {
                "successful_count": successful_count,
                "total_count": len(file_ids),
                "results": results,
                "errors": errors,
            }
        )


class MediaFileBySlugView(APIView):
    """Access media files by SEO-friendly slug."""

    permission_classes = [permissions.AllowAny]  # Adjust based on your needs

    def get(self, request, namespace_slug, file_slug):
        """Get media file by namespace and file slug."""
        try:
            from content.models import Namespace

            namespace = Namespace.objects.get(slug=namespace_slug)
            media_file = MediaFile.objects.get(slug=file_slug, namespace=namespace)

            # Update access tracking
            media_file.download_count += 1
            media_file.last_accessed = timezone.now()
            media_file.save(update_fields=["download_count", "last_accessed"])

            # Get signed URL for secure access
            signed_url = storage.get_signed_url(media_file.file_path)

            if signed_url:
                return redirect(signed_url)
            else:
                # Fallback to public URL
                public_url = storage.get_public_url(media_file.file_path)
                return redirect(public_url)

        except (Namespace.DoesNotExist, MediaFile.DoesNotExist):
            raise Http404("Media file not found")


class MediaFileByUUIDView(APIView):
    """Access media files by UUID (fallback/direct access)."""

    permission_classes = [permissions.AllowAny]  # Adjust based on your needs

    def get(self, request, file_uuid):
        """Get media file by UUID."""
        try:
            media_file = MediaFile.objects.get(id=file_uuid)

            # Update access tracking
            media_file.download_count += 1
            media_file.last_accessed = timezone.now()
            media_file.save(update_fields=["download_count", "last_accessed"])

            # Get signed URL for secure access
            signed_url = storage.get_signed_url(media_file.file_path)

            if signed_url:
                return redirect(signed_url)
            else:
                # Fallback to public URL
                public_url = storage.get_public_url(media_file.file_path)
                return redirect(public_url)

        except MediaFile.DoesNotExist:
            raise Http404("Media file not found")


class MediaFileDownloadView(APIView):
    """Download media files with proper headers."""

    permission_classes = [permissions.AllowAny]  # Adjust based on your needs

    def get(self, request, namespace_slug, file_slug):
        """Download media file by namespace and file slug."""
        try:
            from content.models import Namespace

            namespace = Namespace.objects.get(slug=namespace_slug)
            media_file = MediaFile.objects.get(slug=file_slug, namespace=namespace)

            # Update access tracking
            media_file.download_count += 1
            media_file.last_accessed = timezone.now()
            media_file.save(update_fields=["download_count", "last_accessed"])

            # Get signed URL for secure access
            signed_url = storage.get_signed_url(media_file.file_path)

            if signed_url:
                response = redirect(signed_url)
                # Add download headers
                response["Content-Disposition"] = (
                    f'attachment; filename="{media_file.original_filename}"'
                )
                return response
            else:
                # Fallback to public URL
                public_url = storage.get_public_url(media_file.file_path)
                response = redirect(public_url)
                response["Content-Disposition"] = (
                    f'attachment; filename="{media_file.original_filename}"'
                )
                return response

        except (Namespace.DoesNotExist, MediaFile.DoesNotExist):
            raise Http404("Media file not found")
