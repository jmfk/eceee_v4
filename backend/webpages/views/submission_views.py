"""Private editorial review over the existing public form store; no publication side effects."""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import MachineAPIKey
from core.permissions import HasTenantAccess
from core.roles import permissions_for
from webpages.models import PublicFormSubmission


class SubmissionSerializer(serializers.ModelSerializer):
    page_title = serializers.CharField(source="page.title", read_only=True)

    class Meta:
        model = PublicFormSubmission
        fields = [
            "id",
            "page_id",
            "page_title",
            "widget_id",
            "form_title",
            "data",
            "submitted_at",
            "status",
            "review_note",
            "reviewed_at",
        ]
        read_only_fields = fields


class ReviewInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=["pending", "reviewing", "accepted", "rejected"])
    review_note = serializers.CharField(max_length=4000, allow_blank=True, default="")
    expected_reviewed_at = serializers.DateTimeField(allow_null=True)


class SubmissionView(APIView):
    permission_classes = [IsAuthenticated, HasTenantAccess]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if isinstance(request.auth, MachineAPIKey) or "page.write" not in permissions_for(request.user, request.tenant):
            raise PermissionDenied("Editorial page access is required to review submissions.")

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "private, no-store"
        return response

    def get(self, request):
        rows = (
            PublicFormSubmission.objects.filter(tenant=request.tenant, page__tenant=request.tenant)
            .select_related("page")
            .order_by("-submitted_at", "-id")
        )
        status = request.query_params.get("status", "pending")
        if status != "all":
            if status not in dict(PublicFormSubmission._meta.get_field("status").choices):
                return Response({"detail": "Invalid review status."}, status=400)
            rows = rows.filter(status=status)
        search = request.query_params.get("search", "").strip()
        if len(search) > 200:
            return Response({"detail": "Search is limited to 200 characters."}, status=400)
        if search:
            rows = rows.filter(form_title__icontains=search)
        paginator = PageNumberPagination()
        paginator.page_size = 30
        page = paginator.paginate_queryset(rows, request, view=self)
        return paginator.get_paginated_response(SubmissionSerializer(page, many=True).data)

    @transaction.atomic
    def patch(self, request, pk):
        data = ReviewInput(data=request.data)
        data.is_valid(raise_exception=True)
        row = get_object_or_404(
            PublicFormSubmission.objects.select_for_update().select_related("page"),
            pk=pk,
            tenant=request.tenant,
            page__tenant=request.tenant,
        )
        if row.reviewed_at != data.validated_data["expected_reviewed_at"]:
            return Response({"detail": "Another editor changed this submission. Reload before reviewing."}, status=409)
        row.status = data.validated_data["status"]
        row.review_note = data.validated_data["review_note"]
        row.reviewed_at = timezone.now()
        row.reviewed_by = request.user
        row.save(update_fields=["status", "review_note", "reviewed_at", "reviewed_by"])
        return Response(SubmissionSerializer(row).data)
