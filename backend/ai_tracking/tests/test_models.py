"""
Tests for AI Tracking Models
"""

from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from ai_tracking.models import AIModelPrice, AIUsageLog, AIBudgetAlert

User = get_user_model()


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
        # 100k tokens * $0.15/1M = $0.015
        # 50k tokens * $0.60/1M = $0.030
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

    def test_str_representation(self):
        """Test string representation."""
        expected = "openai/gpt-4o-mini - $0.000150/1k in, $0.000600/1k out"
        self.assertEqual(str(self.price), expected)


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

    def test_cost_per_token_zero_tokens(self):
        """Test cost per token with zero tokens."""
        log = AIUsageLog.objects.create(
            provider="openai",
            model_name="gpt-4o-mini",
            user=self.user,
            input_tokens=0,
            output_tokens=0,
            total_cost=Decimal("0"),
            task_description="Test task",
        )
        self.assertEqual(log.cost_per_token, Decimal("0"))

    def test_str_representation(self):
        """Test string representation."""
        self.assertIn("openai/gpt-4o-mini", str(self.log))
        self.assertIn("testuser", str(self.log))


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
        self.assertEqual(spend, Decimal("50.00"))  # 5 logs * $10

    def test_get_spend_percentage(self):
        """Test getting spend percentage."""
        percentage = self.alert.get_spend_percentage()
        self.assertEqual(percentage, 50.0)  # 50/100 * 100

    def test_should_trigger_alert_no(self):
        """Test alert shouldn't trigger below threshold."""
        self.assertFalse(self.alert.should_trigger_alert())

    def test_should_trigger_alert_yes(self):
        """Test alert should trigger at threshold."""
        # Add more logs to reach 80%
        for i in range(3):
            AIUsageLog.objects.create(
                provider="openai",
                model_name="gpt-4o-mini",
                user=self.user,
                input_tokens=1000,
                output_tokens=500,
                total_cost=Decimal("10.00"),
                task_description=f"Test task extra {i}",
            )

        self.assertTrue(self.alert.should_trigger_alert())

    def test_should_trigger_alert_inactive(self):
        """Test inactive alert doesn't trigger."""
        self.alert.is_active = False
        self.alert.save()

        # Add logs to exceed threshold
        for i in range(10):
            AIUsageLog.objects.create(
                provider="openai",
                model_name="gpt-4o-mini",
                user=self.user,
                input_tokens=1000,
                output_tokens=500,
                total_cost=Decimal("10.00"),
                task_description=f"Test task overflow {i}",
            )

        self.assertFalse(self.alert.should_trigger_alert())

    def test_str_representation(self):
        """Test string representation."""
        expected = "Test Budget - $100.00/monthly"
        self.assertEqual(str(self.alert), expected)
