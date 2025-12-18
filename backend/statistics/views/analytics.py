from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Avg, Count
from statistics.models import (
    PageStats, ConversionStats, Experiment, Variant
)
from statistics.serializers import (
    PageStatsSerializer, ConversionStatsSerializer, 
    ExperimentSerializer, VariantSerializer
)
from statistics.services.ab_testing import ABTestingService

class PageStatsViewSet(viewsets.ReadOnlyModelViewSet):
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
        
        queryset = self.get_queryset()
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
            
        summary = queryset.aggregate(
            total_views=Sum("pageviews"),
            total_uniques=Sum("unique_visitors"),
            avg_time=Avg("avg_time_on_page")
        )
        
        return Response(summary)


class ExperimentViewSet(viewsets.ModelViewSet):
    queryset = Experiment.objects.all()
    serializer_class = ExperimentSerializer

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
            results.append({
                "variant_id": variant.id,
                "variant_name": variant.name,
                "metrics": {m.metric_name: m.value for m in metrics}
            })
        return Response({
            "experiment_id": experiment.id,
            "status": experiment.status,
            "results": results
        })

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        user_id = request.data.get("userId")
        if not user_id:
            return Response({"error": "userId required"}, status=status.HTTP_400_BAD_REQUEST)
        
        variant = ABTestingService.get_variant(pk, user_id)
        if not variant:
            return Response({"error": "No active experiment or variants"}, status=status.HTTP_404_NOT_FOUND)
            
        return Response(VariantSerializer(variant).data)

