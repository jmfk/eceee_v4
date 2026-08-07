from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Tenant
from site_statistics.models import Experiment, PageStats, Variant


class StatisticsApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("stats-user", "stats@example.com", "pass")
        self.other_user = User.objects.create_user("other-user", "other@example.com", "pass")
        self.tenant = Tenant.objects.create(name="Tenant A", identifier="tenant-a", created_by=self.user)
        self.other_tenant = Tenant.objects.create(name="Tenant B", identifier="tenant-b", created_by=self.other_user)
        self.client.force_authenticate(self.user)

    def test_page_stats_summary_is_scoped_to_request_tenant(self):
        PageStats.objects.create(
            tenant=self.tenant,
            date=date(2026, 1, 1),
            url="https://tenant-a.example/page",
            pageviews=5,
            unique_visitors=3,
            avg_time_on_page=12,
        )
        PageStats.objects.create(
            tenant=self.other_tenant,
            date=date(2026, 1, 1),
            url="https://tenant-b.example/page",
            pageviews=99,
            unique_visitors=50,
            avg_time_on_page=300,
        )

        response = self.client.get(
            "/api/v1/statistics/page-stats/summary/",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_views"], 5)
        self.assertEqual(response.data["total_uniques"], 3)

    def test_experiment_create_uses_request_tenant(self):
        response = self.client.post(
            "/api/v1/statistics/experiments/",
            {
                "tenantId": str(self.other_tenant.id),
                "name": "Headline test",
                "goalMetric": "conversion",
                "variants": [
                    {"name": "Control", "allocationPercent": 50},
                    {"name": "Variant A", "allocationPercent": 50},
                ],
            },
            format="json",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        experiment = Experiment.objects.get()
        self.assertEqual(experiment.tenant, self.tenant)
        self.assertEqual(experiment.variants.count(), 2)

    def test_assign_cannot_cross_tenant_boundary(self):
        experiment = Experiment.objects.create(
            tenant=self.other_tenant,
            name="Other tenant experiment",
            goal_metric="conversion",
            status="running",
        )
        Variant.objects.create(experiment=experiment, name="Control", allocation_percent=100)

        response = self.client.post(
            f"/api/v1/statistics/experiments/{experiment.id}/assign/",
            {"userId": "visitor-1"},
            format="json",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class EventIngestionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("tenant-owner", "owner@example.com", "pass")
        self.tenant = Tenant.objects.create(name="Tenant A", identifier="tenant-a", created_by=self.user)

    @patch("site_statistics.views.ingestion.RabbitMqDriver")
    def test_ingest_publishes_to_resolved_tenant(self, driver_cls):
        driver = driver_cls.return_value

        response = self.client.post(
            "/api/v1/statistics/ingest/",
            {"events": [{"eventType": "pageview", "url": "https://example.com/"}]},
            format="json",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        driver.publish.assert_called_once()
        tenant_id, payload = driver.publish.call_args.args
        self.assertEqual(tenant_id, self.tenant.id)
        self.assertEqual(payload["tenant_id"], str(self.tenant.id))
        self.assertEqual(payload["event_type"], "pageview")
