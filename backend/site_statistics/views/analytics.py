from django.db.models import Avg, Sum
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from site_statistics.models import ConversionStats, Experiment, PageStats
from site_statistics.serializers import ExperimentSerializer, PageStatsSerializer, VariantSerializer
from site_statistics.services.ab_testing import ABTestingService


class TenantScopedQuerySetMixin:
    permission_classes = [IsAuthenticated]

    def get_tenant(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            raise serializers.ValidationError("Tenant is required. Provide X-Tenant-ID header.")

        user = self.request.user
        if not tenant.user_has_access(user):
            raise PermissionDenied("You do not have access to this tenant.")

        return tenant

    def get_queryset(self):
        return super().get_queryset().filter(tenant=self.get_tenant())


class PageStatsViewSet(TenantScopedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = PageStats.objects.all()
    serializer_class = PageStatsSerializer
    filterset_fields = ["url", "date"]

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """
        Returns a summary of page stats for a date range.
        """
        start_date = request.query_params.get("start")
        end_date = request.query_params.get("end")

        tenant = self.get_tenant()
        queryset = PageStats.objects.filter(tenant=tenant)
        conversion_queryset = ConversionStats.objects.filter(tenant=tenant)
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
            conversion_queryset = conversion_queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
            conversion_queryset = conversion_queryset.filter(date__lte=end_date)

        summary = queryset.aggregate(
            total_views=Sum("pageviews"),
            total_uniques=Sum("unique_visitors"),
            avg_time=Avg("avg_time_on_page"),
        )

        conversion_summary = conversion_queryset.aggregate(
            total_impressions=Sum("impressions"),
            total_conversions=Sum("conversions"),
        )
        total_impressions = conversion_summary["total_impressions"] or 0
        total_conversions = conversion_summary["total_conversions"] or 0

        traffic_overview = list(queryset.values("date").annotate(views=Sum("pageviews")).order_by("date"))
        top_pages = list(queryset.values("url").annotate(views=Sum("pageviews")).order_by("-views", "url")[:5])

        summary.update(
            {
                "total_views": summary["total_views"] or 0,
                "total_uniques": summary["total_uniques"] or 0,
                "avg_time": summary["avg_time"] or 0,
                "conversion_rate": ((total_conversions / total_impressions) * 100 if total_impressions else 0),
                "traffic_overview": traffic_overview,
                "top_pages": top_pages,
            }
        )

        return Response(summary)


class ExperimentViewSet(TenantScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Experiment.objects.all()
    serializer_class = ExperimentSerializer

    def perform_create(self, serializer):
        serializer.save(tenant=self.get_tenant())

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        experiment = self.get_object()
        experiment.status = "running"
        experiment.save()
        return Response({"status": "experiment started"})

    @action(detail=True, methods=["get"])
    def results(self, request, pk=None):
        experiment = self.get_object()
        # Calculate results for each variant
        results = []
        for variant in experiment.variants.all():
            metrics = variant.metrics.all()
            results.append(
                {
                    "variant_id": variant.id,
                    "variant_name": variant.name,
                    "metrics": {m.metric_name: m.value for m in metrics},
                }
            )
        return Response({"experiment_id": experiment.id, "status": experiment.status, "results": results})

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        experiment = self.get_object()
        user_id = request.data.get("userId")
        if not user_id:
            return Response({"error": "userId required"}, status=status.HTTP_400_BAD_REQUEST)

        variant = ABTestingService.get_variant(experiment.id, user_id)
        if not variant:
            return Response({"error": "No active experiment or variants"}, status=status.HTTP_404_NOT_FOUND)

        return Response(VariantSerializer(variant).data)
