from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import MigrationPlan, MigrationJob, MigrationTask
from .serializers import MigrationPlanSerializer, MigrationJobSerializer, MigrationTaskSerializer
from .tasks import run_migration_job

class MigrationPlanViewSet(viewsets.ModelViewSet):
    serializer_class = MigrationPlanSerializer

    def get_queryset(self):
        return MigrationPlan.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        plan = self.get_object()
        job = MigrationJob.objects.create(
            plan=plan,
            tenant=request.tenant,
            created_by=request.user
        )
        run_migration_job.delay(str(job.id))
        return Response(MigrationJobSerializer(job).data, status=status.HTTP_201_CREATED)


class MigrationJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MigrationJobSerializer

    def get_queryset(self):
        return MigrationJob.objects.filter(tenant=self.request.tenant).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        job = self.get_object()
        if job.status in ["PENDING", "RUNNING"]:
            job.status = "CANCELLED"
            job.save(update_fields=["status"])
            return Response({"status": "cancelled"})
        return Response({"error": "Job is already finished"}, status=status.HTTP_400_BAD_REQUEST)


class MigrationTaskViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MigrationTaskSerializer
    filterset_fields = ['job', 'status', 'source_id']

    def get_queryset(self):
        return MigrationTask.objects.filter(job__tenant=self.request.tenant).order_by('-started_at')
