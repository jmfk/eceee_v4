"""Tenant-scoped Trash across CMS resources that support restoration."""

import uuid

from django.core.paginator import Paginator
from django.db import models, transaction
from django.db.models import F, Q, Value
from django.db.models.functions import Cast
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Namespace
from core.roles import is_tenant_admin
from file_manager.models import MediaCollection, MediaFile
from file_manager.security import filter_media_files_for_user, user_can_access_namespace
from webpages.models import WebPage


class TrashView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    # Collection deletion locks the collection before its files; restore in the
    # same order to avoid a deadlock when both operations run concurrently.
    kinds = ("page", "collection", "media")

    def _tenant(self, request):
        tenant = getattr(request, "tenant", None)
        if tenant is None or not tenant.user_has_access(request.user):
            return None
        return tenant

    def _querysets(self, request, tenant):
        admin = is_tenant_admin(request.user, tenant)
        allowed_namespaces = [
            namespace.pk
            for namespace in Namespace.objects.filter(tenant=tenant).select_related("tenant", "created_by")
            if user_can_access_namespace(request.user, namespace)
        ]
        pages = WebPage.objects.filter(tenant=tenant, is_deleted=True)
        if not admin:
            pages = pages.none()
        files = filter_media_files_for_user(
            MediaFile.objects.with_deleted().filter(tenant=tenant, is_deleted=True),
            request.user,
            tenant=tenant,
            include_theme_media=True,
        ).filter(namespace_id__in=allowed_namespaces)
        if not admin:
            files = files.filter(created_by=request.user)
        collections = MediaCollection.objects.with_deleted().filter(
            namespace__tenant=tenant, namespace_id__in=allowed_namespaces, is_deleted=True
        )
        return {"page": pages, "media": files, "collection": collections}

    def get(self, request):
        tenant = self._tenant(request)
        if tenant is None:
            return Response({"detail": "Workspace access is required"}, status=status.HTTP_403_FORBIDDEN)
        kind = request.query_params.get("type", "all")
        if kind not in (*self.kinds, "all"):
            return Response({"type": "Unknown item type"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            page_number = int(request.query_params.get("page", 1))
            page_size = int(request.query_params.get("page_size", 25))
        except ValueError:
            return Response({"page": "Page and size must be integers"}, status=status.HTTP_400_BAD_REQUEST)
        if page_number < 1 or not 1 <= page_size <= 100:
            return Response({"page": "Invalid page or size"}, status=status.HTTP_400_BAD_REQUEST)

        search = request.query_params.get("search", "").strip()
        querysets = self._querysets(request, tenant)
        if search:
            querysets["page"] = querysets["page"].filter(Q(title__icontains=search) | Q(slug__icontains=search))
            querysets["media"] = querysets["media"].filter(
                Q(title__icontains=search) | Q(slug__icontains=search) | Q(original_filename__icontains=search)
            )
            querysets["collection"] = querysets["collection"].filter(
                Q(title__icontains=search) | Q(slug__icontains=search)
            )
        counts = {name: queryset.count() for name, queryset in querysets.items()}
        selected = self.kinds if kind == "all" else (kind,)
        rows = [
            querysets[name]
            .order_by()
            .annotate(
                item_type=Value(name, output_field=models.CharField()),
                item_id=Cast("id", output_field=models.CharField()),
                item_title=F("title"),
                trashed_at=F("deleted_at"),
            )
            .values("item_type", "item_id", "item_title", "trashed_at")
            for name in selected
        ]
        combined = rows[0].union(*rows[1:], all=True).order_by("-trashed_at", "item_type", "item_id")
        paginator = Paginator(combined, page_size)
        page = paginator.get_page(page_number)
        return Response(
            {
                "results": [
                    {
                        "type": row["item_type"],
                        "id": row["item_id"],
                        "title": row["item_title"],
                        "deleted_at": row["trashed_at"],
                    }
                    for row in page.object_list
                ],
                "count": paginator.count,
                "counts": counts,
                "page": page.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
            }
        )


class TrashRestoreView(TrashView):
    http_method_names = ["post", "options", "head"]

    def post(self, request):
        tenant = self._tenant(request)
        if tenant is None:
            return Response({"detail": "Workspace access is required"}, status=status.HTTP_403_FORBIDDEN)
        items = request.data.get("items")
        if not isinstance(items, list) or not 1 <= len(items) <= 100:
            return Response({"items": "Select between 1 and 100 items"}, status=status.HTTP_400_BAD_REQUEST)
        keys = set()
        for item in items:
            if not isinstance(item, dict) or item.get("type") not in self.kinds or not item.get("id"):
                return Response({"items": "Invalid item"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                item_id = int(item["id"]) if item["type"] == "page" else uuid.UUID(str(item["id"]))
                if item["type"] == "page" and item_id < 1:
                    raise ValueError
            except (TypeError, ValueError, AttributeError):
                return Response({"items": "Invalid item ID"}, status=status.HTTP_400_BAD_REQUEST)
            keys.add((item["type"], item_id))
        querysets = self._querysets(request, tenant)
        restored = []
        warnings = []
        with transaction.atomic():
            selected = {}
            for kind in self.kinds:
                ids = [item_id for item_type, item_id in keys if item_type == kind]
                if not ids:
                    continue
                objects = list(querysets[kind].filter(pk__in=ids).select_for_update())
                if len(objects) != len(ids):
                    return Response({"items": "One or more items are unavailable"}, status=status.HTTP_404_NOT_FOUND)
                selected[kind] = objects
            selected_pages = {page.pk: page for page in selected.get("page", [])}

            def selected_parent_depth(page):
                depth = 0
                parent_id = page.parent_id
                while parent_id in selected_pages:
                    depth += 1
                    parent_id = selected_pages[parent_id].parent_id
                return depth

            for page in sorted(selected_pages.values(), key=selected_parent_depth):
                result = page.restore(user=request.user, recursive=False)
                warnings.extend(result.get("warnings", []))
                restored.append({"type": "page", "id": str(page.pk)})
            for file in selected.get("media", []):
                file.restore(request.user)
                restored.append({"type": "media", "id": str(file.pk)})
            for collection in selected.get("collection", []):
                collection.restore()
                restored.append({"type": "collection", "id": str(collection.pk)})
        return Response({"restored_count": len(restored), "restored": restored, "warnings": warnings})
