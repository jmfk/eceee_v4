"""Tenant-scoped taxonomy endpoints. No endpoint physically deletes taxonomy data."""

from django.core.exceptions import ValidationError as ModelValidationError
from django.db import transaction
from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .models import ClassificationGrant, ClassificationOperation, ClassificationProposal, ClassificationType, Tag
from .serializers import (
    ClassificationTypeSerializer,
    GrantSerializer,
    OperationSerializer,
    ProposalSerializer,
    TermSerializer,
)


class TaxonomyPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class ScopedViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = TaxonomyPagination
    filter_backends = [SearchFilter, OrderingFilter]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        tenant = getattr(request, "tenant", None)
        if not tenant or not services.is_member(request.user, tenant):
            raise PermissionDenied("Tenant membership is required for classification.")

    def scope(self, queryset, prefix=""):
        queryset = queryset.filter(**{f"{prefix}tenant": self.request.tenant})
        namespace = self.request.query_params.get("namespace")
        if namespace:
            key = f"{prefix}namespace_id" if str(namespace).isdigit() else f"{prefix}namespace__slug"
            queryset = queryset.filter(**{key: namespace})
        return queryset

    def definition(self, value):
        return get_object_or_404(ClassificationType, pk=value, tenant=self.request.tenant)


class ClassificationTypeViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, ScopedViewSet
):
    serializer_class = ClassificationTypeSerializer
    search_fields = ["name", "description", "key"]
    ordering_fields = ["sort_order", "name"]

    def get_queryset(self):
        return self.scope(ClassificationType.objects.select_related("tenant", "namespace"))

    @transaction.atomic
    def perform_create(self, serializer):
        tenant = self.request.tenant
        if not (self.request.user.is_superuser or tenant.created_by_id == self.request.user.pk):
            raise PermissionDenied("Only tenant owners may create classification types.")
        namespace = serializer.validated_data["namespace"]
        if namespace.tenant_id != tenant.pk:
            raise ValidationError({"namespace": "Namespace belongs to another tenant."})
        instance = ClassificationType(tenant=tenant, **serializer.validated_data)
        try:
            instance.full_clean()
        except ModelValidationError as exc:
            raise ValidationError(exc.message_dict) from exc
        serializer.save(tenant=tenant)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def configure(self, request, pk=None):
        definition = services.locked_definition(self.get_object())
        services.require(request.user, definition, "administer")
        if request.data.get("revision") != definition.revision:
            raise services.ClassificationConflict()
        allowed = {"name", "description", "sort_order", "allowed_uses", "revision"}
        if set(request.data) - allowed:
            raise ValidationError("Only name, description, order and allowed uses may be configured.")
        serializer = self.get_serializer(
            definition, data={k: v for k, v in request.data.items() if k != "revision"}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        before = {field: getattr(definition, field) for field in ("name", "description", "sort_order", "allowed_uses")}
        serializer.save(revision=definition.revision + 1)
        ClassificationOperation.objects.create(
            classification_type=definition,
            action="configure",
            actor=request.user,
            before={"type": before},
            after={"type": {field: getattr(definition, field) for field in before}},
            type_revision=definition.revision,
        )
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        from django.contrib.auth import get_user_model

        definition = self.get_object()
        services.require(request.user, definition, "administer")
        users = (
            get_user_model()
            .objects.filter(Q(member_tenants=definition.tenant) | Q(pk=definition.tenant.created_by_id))
            .distinct()
            .order_by("username")
        )
        search = request.query_params.get("search")
        if search:
            users = users.filter(username__icontains=search)
        page = self.paginate_queryset(users)
        return self.get_paginated_response(
            [{"id": user.pk, "name": user.get_full_name() or user.username} for user in page]
        )

    @action(detail=True, methods=["get"])
    def role_templates(self, request, pk=None):
        services.require(request.user, self.get_object(), "administer")
        return Response(services.ROLE_TEMPLATES)


class TermViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, ScopedViewSet):
    serializer_class = TermSerializer
    search_fields = ["name", "alternative_names", "legacy_mappings__source_name", "legacy_mappings__source_id"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        qs = self.scope(Tag.objects.select_related("classification_type", "parent", "merged_into"))
        for name in ["classification_type", "status", "tag_type"]:
            if self.request.query_params.get(name):
                qs = qs.filter(**{name: self.request.query_params[name]})
        use = self.request.query_params.get("use")
        if use:
            # JSON containment is PostgreSQL-native, like the existing page tag ArrayField.
            qs = qs.filter(classification_type__allowed_uses__contains=[use])
        root = self.request.query_params.get("descendant_of")
        if root:
            term = get_object_or_404(self.scope(Tag.objects.all()), pk=root)
            qs = qs.filter(pk__in=services.descendants(term))
        return qs.distinct()

    def create(self, request):
        definition = self.definition(request.data.get("classification_type"))
        operation = services.mutate(request.user, definition, "create", payload=request.data.get("payload", {}))
        term = Tag.objects.get(pk=next(iter(operation.after)))
        return Response(
            {"term": TermSerializer(term).data, "operation": OperationSerializer(operation).data}, status=201
        )

    @action(detail=True, methods=["get"])
    def usage(self, request, pk=None):
        from file_manager.models import MediaCollection, MediaFile
        from file_manager.security import filter_media_files_for_user, user_can_access_namespace
        from object_storage.models import ObjectVersion
        from webpages.models import PageVersion

        term = self.get_object()
        tenant = request.tenant
        querysets = {
            "pages": (PageVersion.objects.filter(page__tenant=tenant), "canonical_tag_links__tag_id"),
            "objects": (ObjectVersion.objects.filter(object_instance__tenant=tenant), "canonical_tag_links__tag_id"),
            "media_files": (
                filter_media_files_for_user(MediaFile.objects.all(), request.user, tenant),
                "classification_links__tag_id",
            ),
            "media_collections": (
                MediaCollection.objects.filter(namespace__tenant=tenant, namespace__is_hidden=False),
                "classification_links__tag_id",
            ),
        }
        result = {}
        for kind, (queryset, relation) in querysets.items():
            queryset = services.filter_classifications(
                queryset, relation, [term.pk], tenant=tenant, include_descendants=False
            )
            if kind == "media_collections":
                visible_ids = [
                    item.pk
                    for item in queryset.select_related("namespace")
                    if user_can_access_namespace(request.user, item.namespace)
                ]
                queryset = queryset.filter(pk__in=visible_ids)
            count, items = queryset.count(), []
            for item in queryset.order_by("pk")[:50]:
                if kind == "pages":
                    name, url = (
                        f"{item.page.title} · version {item.version_number}",
                        f"/pages/{item.page_id}/edit/settings?version={item.pk}",
                    )
                elif kind == "objects":
                    name, url = (
                        f"{item.content_title} · version {item.version_number}",
                        f"/objects/{item.object_instance_id}/edit/settings",
                    )
                else:
                    name = item.title
                    url = f"/api/v1/media/{'files' if kind == 'media_files' else 'collections'}/{item.pk}/"
                items.append({"id": str(item.pk), "name": name, "url": url})
            result[kind] = {"count": count, "results": items}
        return Response(result)

    def _mutate(self, request, action_name):
        term = self.get_object()
        if not term.classification_type_id:
            raise ValidationError("Run classification definition reconciliation for this legacy term first.")
        operation = services.mutate(
            request.user,
            term.classification_type,
            action_name,
            term=term,
            revision=request.data.get("revision"),
            payload=request.data.get("payload", {}),
        )
        return Response(OperationSerializer(operation).data)

    @action(detail=True, methods=["post"])
    def edit(self, request, pk=None):
        return self._mutate(request, "edit")

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        return self._mutate(request, "move")

    @action(detail=True, methods=["post"])
    def merge(self, request, pk=None):
        return self._mutate(request, "merge")

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        return self._mutate(request, "archive")

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        return self._mutate(request, "reactivate")


class ProposalViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, ScopedViewSet):
    serializer_class = ProposalSerializer
    search_fields = ["term__name", "reason"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        qs = self.scope(
            ClassificationProposal.objects.select_related("classification_type", "term"), "classification_type__"
        )
        if self.request.query_params.get("status"):
            qs = qs.filter(status=self.request.query_params["status"])
        if self.request.query_params.get("mine") == "true":
            qs = qs.filter(proposed_by=self.request.user)
        return qs

    def create(self, request):
        definition = self.definition(request.data.get("classification_type"))
        term = None
        if request.data.get("term"):
            term = get_object_or_404(Tag, pk=request.data["term"], tenant=request.tenant)
        proposal = services.propose(
            request.user,
            definition,
            request.data.get("action"),
            term=term,
            revision=request.data.get("revision"),
            payload=request.data.get("payload", {}),
        )
        return Response(self.get_serializer(proposal).data, status=201)

    @action(detail=True, methods=["post"])
    def decide(self, request, pk=None):
        proposal = services.decide(
            request.user, self.get_object(), request.data.get("decision"), request.data.get("reason", "")
        )
        return Response(self.get_serializer(proposal).data)


class OperationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, ScopedViewSet):
    serializer_class = OperationSerializer
    search_fields = ["action", "actor__username"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        qs = self.scope(ClassificationOperation.objects.all(), "classification_type__")
        if self.request.query_params.get("classification_type"):
            qs = qs.filter(classification_type_id=self.request.query_params["classification_type"])
        return qs

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        operation = services.restore(request.user, self.get_object())
        return Response(self.get_serializer(operation).data)


class GrantViewSet(mixins.ListModelMixin, ScopedViewSet):
    serializer_class = GrantSerializer

    def get_queryset(self):
        definition = self.definition(self.request.query_params.get("classification_type"))
        services.require(self.request.user, definition, "administer")
        return ClassificationGrant.objects.filter(classification_type=definition)

    @transaction.atomic
    def create(self, request):
        definition = services.locked_definition(self.definition(request.data.get("classification_type")))
        services.require(request.user, definition, "administer")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, permissions = serializer.validated_data["user"], serializer.validated_data["permissions"]
        if not services.is_member(user, definition.tenant):
            raise ValidationError({"user": "Grants require membership in this tenant."})
        if not isinstance(permissions, list) or any(
            not isinstance(p, str) or p not in services.PERMISSIONS for p in permissions
        ):
            raise ValidationError({"permissions": "Choose named classification permissions."})
        previous = ClassificationGrant.objects.filter(classification_type=definition, user=user).first()
        before = {"user": user.pk, "permissions": previous.permissions if previous else []}
        grant, _ = ClassificationGrant.objects.update_or_create(
            classification_type=definition, user=user, defaults={"permissions": permissions}
        )
        definition.revision += 1
        definition.save(update_fields=["revision"])
        ClassificationOperation.objects.create(
            classification_type=definition,
            action="grant",
            actor=request.user,
            before={"grant": before},
            after={"grant": {"user": user.pk, "permissions": permissions}},
            type_revision=definition.revision,
        )
        return Response(self.get_serializer(grant).data)
