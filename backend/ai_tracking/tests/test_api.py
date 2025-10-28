"""
Tests for AI Tracking API Endpoints
"""

from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from ai_tracking.models import AIModelPrice, AIUsageLog, AIBudgetAlert

User = get_user_model()


class AIModelPriceAPITestCase(TestCase):
    """Tests for AIModelPrice API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.admin = User.objects.create_user(
            username="admin", password="adminpass123", is_staff=True, is_superuser=True
        )

        self.price = AIModelPrice.objects.create(
            provider="openai",
            model_name="gpt-4o-mini",
            input_price_per_1k=Decimal("0.000150"),
            output_price_per_1k=Decimal("0.000600"),
        )

    def test_list_prices_authenticated(self):
        """Test listing prices as authenticated user."""
        self.client.force_authenticate(user=self.user)
        url = reverse("api:ai_tracking:price-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data["results"]), 0)

    def test_list_prices_unauthenticated(self):
        """Test listing prices requires authentication."""
        url = reverse("api:ai_tracking:price-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_price_admin(self):
        """Test creating price as admin."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("api:ai_tracking:price-list")
        data = {
            "provider": "anthropic",
            "model_name": "claude-3-5-sonnet-20241022",
            "input_price_per_1k": "0.003000",
            "output_price_per_1k": "0.015000",
            "notes": "Test price",
        }
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            AIModelPrice.objects.filter(
                model_name="claude-3-5-sonnet-20241022"
            ).count(),
            1,
        )

    def test_create_price_non_admin(self):
        """Test creating price requires admin."""
        self.client.force_authenticate(user=self.user)
        url = reverse("api:ai_tracking:price-list")
        data = {
            "provider": "anthropic",
            "model_name": "claude-3-haiku",
            "input_price_per_1k": "0.000250",
            "output_price_per_1k": "0.001250",
        }
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AIUsageLogAPITestCase(TestCase):
    """Tests for AIUsageLog API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.other_user = User.objects.create_user(
            username="otheruser", password="otherpass123"
        )
        self.admin = User.objects.create_user(
            username="admin", password="adminpass123", is_staff=True
        )

        # Create usage logs
        self.log = AIUsageLog.objects.create(
            provider="openai",
            model_name="gpt-4o-mini",
            user=self.user,
            input_tokens=1000,
            output_tokens=500,
            total_cost=Decimal("0.000450"),
            task_description="Test task",
        )

        self.other_log = AIUsageLog.objects.create(
            provider="openai",
            model_name="gpt-4o-mini",
            user=self.other_user,
            input_tokens=2000,
            output_tokens=1000,
            total_cost=Decimal("0.000900"),
            task_description="Other task",
        )

    def test_list_usage_own_logs(self):
        """Test listing usage logs shows only own logs for non-admin."""
        self.client.force_authenticate(user=self.user)
        url = reverse("api:ai_tracking:usage-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["id"], self.log.id)

    def test_list_usage_all_logs_admin(self):
        """Test admin can see all usage logs."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("api:ai_tracking:usage-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)

    def test_list_usage_filter_by_provider(self):
        """Test filtering by provider."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("api:ai_tracking:usage-list")
        response = self.client.get(url, {"provider": "openai"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)

    def test_retrieve_usage_detail(self):
        """Test retrieving usage log detail."""
        self.client.force_authenticate(user=self.user)
        url = reverse("api:ai_tracking:usage-detail", args=[self.log.id])
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.log.id)
        self.assertEqual(response.data["total_tokens"], 1500)


class AnalyticsAPITestCase(TestCase):
    """Tests for Analytics API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.admin = User.objects.create_user(
            username="admin", password="adminpass123", is_staff=True
        )

        # Create usage logs
        for i in range(5):
            AIUsageLog.objects.create(
                provider="openai",
                model_name="gpt-4o-mini",
                user=self.user,
                input_tokens=1000,
                output_tokens=500,
                total_cost=Decimal("10.00"),
                task_description=f"Test task {i}",
            )

    def test_analytics_summary(self):
        """Test analytics summary endpoint."""
        self.client.force_authenticate(user=self.user)
        url = reverse("api:ai_tracking:analytics-summary")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_calls"], 5)
        self.assertEqual(Decimal(response.data["total_cost"]), Decimal("50.00"))

    def test_analytics_by_model(self):
        """Test analytics by model endpoint."""
        self.client.force_authenticate(user=self.user)
        url = reverse("api:ai_tracking:analytics-by-model")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)

    def test_analytics_by_provider(self):
        """Test analytics by provider endpoint."""
        self.client.force_authenticate(user=self.user)
        url = reverse("api:ai_tracking:analytics-by-provider")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)

    def test_analytics_by_user_admin_only(self):
        """Test analytics by user requires admin."""
        self.client.force_authenticate(user=self.user)
        url = reverse("api:ai_tracking:analytics-by-user")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_analytics_trends(self):
        """Test analytics trends endpoint."""
        self.client.force_authenticate(user=self.user)
        url = reverse("api:ai_tracking:analytics-trends")
        response = self.client.get(url, {"period": "daily"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class BudgetAlertAPITestCase(TestCase):
    """Tests for BudgetAlert API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="admin", password="adminpass123", is_staff=True, is_superuser=True
        )

        self.alert = AIBudgetAlert.objects.create(
            name="Test Budget",
            budget_amount=Decimal("100.00"),
            period="monthly",
            email_recipients=["admin@example.com"],
        )

    def test_list_budgets(self):
        """Test listing budget alerts."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("api:ai_tracking:budget-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_check_budgets(self):
        """Test checking budget status."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("api:ai_tracking:budget-check")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_create_budget(self):
        """Test creating budget alert."""
        self.client.force_authenticate(user=self.admin)
        url = reverse("api:ai_tracking:budget-list")
        data = {
            "name": "Weekly Budget",
            "budget_amount": "50.00",
            "period": "weekly",
            "email_recipients": ["admin@example.com"],
            "threshold_percentage": 80,
        }
        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AIBudgetAlert.objects.filter(name="Weekly Budget").count(), 1)
