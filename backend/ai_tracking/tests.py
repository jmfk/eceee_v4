"""
Tests for AI Tracking System
"""

from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from ai_tracking.models import AIModelPrice, AIUsageLog, AIBudgetAlert

User = get_user_model()


# =============================================================================
# Model Tests
# =============================================================================


class AIModelPriceTestCase(TestCase):
    """Tests for AIModelPrice model."""

    def setUp(self):
        """Set up test data."""
        self.price = AIModelPrice.objects.create(
            provider="openai",
            model_name="gpt-4o-mini",
            input_price_per_1k=Decimal("0.000150"),
            output_price_per_1k=Decimal("0.000600"),
        )

    def test_calculate_cost(self):
        """Test cost calculation."""
        cost = self.price.calculate_cost(1000, 1000)
        expected = Decimal("0.000150") + Decimal("0.000600")
        self.assertEqual(cost, expected)

    def test_calculate_cost_large_tokens(self):
        """Test cost calculation with large token counts."""
        cost = self.price.calculate_cost(100000, 50000)
        expected = Decimal("0.015") + Decimal("0.030")
        self.assertEqual(cost, expected)

    def test_get_current_price(self):
        """Test getting current price."""
        price = AIModelPrice.get_current_price("openai", "gpt-4o-mini")
        self.assertEqual(price, self.price)

    def test_get_current_price_not_found(self):
        """Test getting price for non-existent model."""
        price = AIModelPrice.get_current_price("openai", "nonexistent")
        self.assertIsNone(price)


class AIUsageLogTestCase(TestCase):
    """Tests for AIUsageLog model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

        self.log = AIUsageLog.objects.create(
            provider="openai",
            model_name="gpt-4o-mini",
            user=self.user,
            input_tokens=1000,
            output_tokens=500,
            total_cost=Decimal("0.000450"),
            task_description="Test task",
        )

    def test_total_tokens(self):
        """Test total tokens calculation."""
        self.assertEqual(self.log.total_tokens, 1500)

    def test_cost_per_token(self):
        """Test cost per token calculation."""
        expected = Decimal("0.000450") / 1500
        self.assertEqual(self.log.cost_per_token, expected)


class AIBudgetAlertTestCase(TestCase):
    """Tests for AIBudgetAlert model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

        self.alert = AIBudgetAlert.objects.create(
            name="Test Budget",
            budget_amount=Decimal("100.00"),
            period="monthly",
            email_recipients=["admin@example.com"],
            threshold_percentage=80,
        )

        # Create some usage logs
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

    def test_get_current_spend(self):
        """Test getting current spend."""
        spend = self.alert.get_current_spend()
        self.assertEqual(spend, Decimal("50.00"))

    def test_get_spend_percentage(self):
        """Test getting spend percentage."""
        percentage = self.alert.get_spend_percentage()
        self.assertEqual(percentage, 50.0)

    def test_should_trigger_alert_no(self):
        """Test alert shouldn't trigger below threshold."""
        self.assertFalse(self.alert.should_trigger_alert())
