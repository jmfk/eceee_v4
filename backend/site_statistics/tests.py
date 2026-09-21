from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Tenant
from site_statistics.models import ConversionStats, EventRaw, Experiment, PageStats, Variant
from site_statistics.tasks import ingest_events


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
        ConversionStats.objects.create(
            tenant=self.tenant,
            date=date(2026, 1, 1),
            goal_name="signup",
            impressions=20,
            conversions=5,
            conversion_rate=25,
        )

        response = self.client.get(
            "/api/v1/statistics/page-stats/summary/",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_views"], 5)
        self.assertEqual(response.data["total_uniques"], 3)
        self.assertEqual(response.data["conversion_rate"], 25)
        self.assertEqual(response.data["traffic_overview"], [{"date": date(2026, 1, 1), "views": 5}])
        self.assertEqual(
            response.data["top_pages"],
            [{"url": "https://tenant-a.example/page", "views": 5}],
        )

    def test_statistics_rejects_tenant_selected_by_unrelated_user(self):
        response = self.client.get(
            "/api/v1/statistics/page-stats/summary/",
            HTTP_X_TENANT_ID=self.other_tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

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

    @patch("site_statistics.views.ingestion.ingest_events.delay")
    def test_ingest_queues_validated_batch_for_resolved_tenant(self, delay):
        response = self.client.post(
            "/api/v1/statistics/ingest/",
            {
                "events": [
                    {
                        "eventType": "click",
                        "sessionId": "session-1",
                        "url": "https://example.com/",
                    }
                ]
            },
            format="json",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        delay.assert_called_once()
        tenant_id, payloads = delay.call_args.args
        self.assertEqual(tenant_id, str(self.tenant.id))
        self.assertEqual(payloads[0]["event_type"], "click")
        self.assertEqual(payloads[0]["metadata"]["session_id"], "session-1")

    @patch("site_statistics.views.ingestion.ingest_events.delay")
    def test_ingest_accepts_a_single_event_payload(self, delay):
        response = self.client.post(
            "/api/v1/statistics/ingest/",
            {"eventType": "conversion", "metadata": {"goalName": "signup"}},
            format="json",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        _, payloads = delay.call_args.args
        self.assertEqual(len(payloads), 1)
        self.assertEqual(payloads[0]["event_type"], "conversion")

    @patch("site_statistics.views.ingestion.ingest_events.delay")
    def test_ingest_rejects_non_array_events(self, delay):
        response = self.client.post(
            "/api/v1/statistics/ingest/",
            {"events": {"eventType": "pageview"}},
            format="json",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        delay.assert_not_called()

    def test_ingest_task_persists_the_queued_batch(self):
        count = ingest_events.run(
            str(self.tenant.id),
            [
                {
                    "user_id": "visitor-1",
                    "event_type": "pageview",
                    "event_time": "2026-01-01T12:00:00Z",
                    "url": "https://example.com/",
                    "metadata": {"session_id": "session-1"},
                }
            ],
        )

        self.assertEqual(count, 1)
        event = EventRaw.objects.get()
        self.assertEqual(event.tenant, self.tenant)
        self.assertEqual(event.user_id, "visitor-1")
        self.assertEqual(event.metadata["session_id"], "session-1")
