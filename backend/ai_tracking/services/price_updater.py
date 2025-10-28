"""
Price Updater Service

Manages AI model pricing information with automatic updates and notifications.
"""

import logging
from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


class PriceUpdater:
    """
    Service for updating and managing AI model prices.

    Attempts to fetch current prices from provider APIs.
    Flags stale prices and sends email notifications to admins.
    """

    def __init__(self):
        self.tracking_settings = getattr(settings, "AI_TRACKING", {})
        self.stale_days = self.tracking_settings.get("PRICE_STALE_DAYS", 30)
        self.admin_email = self.tracking_settings.get(
            "ADMIN_EMAIL", "admin@example.com"
        )

    def check_all_prices(self):
        """
        Check all model prices for updates and staleness.

        Returns dict with update results.
        """
        from ai_tracking.models import AIModelPrice

        results = {
            "updated": [],
            "stale": [],
            "errors": [],
        }

        # Get all unique provider/model combinations
        prices = AIModelPrice.objects.values("provider", "model_name").distinct()

        for price_info in prices:
            provider = price_info["provider"]
            model_name = price_info["model_name"]

            try:
                # Try to update from API
                updated = self.update_price_from_api(provider, model_name)
                if updated:
                    results["updated"].append(f"{provider}/{model_name}")
            except Exception as e:
                logger.error(f"Error updating {provider}/{model_name}: {e}")
                results["errors"].append(f"{provider}/{model_name}: {str(e)}")

        # Check for stale prices
        stale_threshold = timezone.now() - timedelta(days=self.stale_days)
        stale_prices = AIModelPrice.objects.filter(
            last_verified__lt=stale_threshold, is_stale=False
        )

        for price in stale_prices:
            price.is_stale = True
            price.save()
            results["stale"].append(f"{price.provider}/{price.model_name}")

        return results

    def update_price_from_api(self, provider, model_name):
        """
        Attempt to fetch current price from provider API.

        Returns True if price was updated, False otherwise.
        """
        if provider == "openai":
            return self._update_openai_price(model_name)
        elif provider == "anthropic":
            return self._update_anthropic_price(model_name)
        else:
            return False

    def _update_openai_price(self, model_name):
        """
        Update OpenAI model price.

        Note: OpenAI doesn't provide a pricing API, so this uses hardcoded
        values that should be updated manually when prices change.
        """
        # OpenAI pricing as of 2024 (USD per 1M tokens)
        # These should be updated when OpenAI changes pricing
        pricing_map = {
            "gpt-4": {"input": 30.00, "output": 60.00},
            "gpt-4-turbo": {"input": 10.00, "output": 30.00},
            "gpt-4o": {"input": 5.00, "output": 15.00},
            "gpt-4o-mini": {"input": 0.150, "output": 0.600},
            "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
            "o1-preview": {"input": 15.00, "output": 60.00},
            "o1-mini": {"input": 3.00, "output": 12.00},
        }

        if model_name not in pricing_map:
            logger.warning(f"No pricing data for OpenAI model: {model_name}")
            return False

        pricing = pricing_map[model_name]

        return self._create_or_update_price(
            provider="openai",
            model_name=model_name,
            input_price_per_1k=Decimal(str(pricing["input"] / 1000)),
            output_price_per_1k=Decimal(str(pricing["output"] / 1000)),
            auto_updated=True,
            notes="Auto-updated from hardcoded pricing map",
        )

    def _update_anthropic_price(self, model_name):
        """
        Update Anthropic model price.

        Note: Anthropic doesn't provide a pricing API, so this uses hardcoded
        values that should be updated manually when prices change.
        """
        # Anthropic pricing as of 2024 (USD per 1M tokens)
        pricing_map = {
            "claude-3-opus-20240229": {"input": 15.00, "output": 75.00},
            "claude-3-sonnet-20240229": {"input": 3.00, "output": 15.00},
            "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
            "claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},
            "claude-3-5-haiku-20241022": {"input": 0.80, "output": 4.00},
        }

        if model_name not in pricing_map:
            logger.warning(f"No pricing data for Anthropic model: {model_name}")
            return False

        pricing = pricing_map[model_name]

        return self._create_or_update_price(
            provider="anthropic",
            model_name=model_name,
            input_price_per_1k=Decimal(str(pricing["input"] / 1000)),
            output_price_per_1k=Decimal(str(pricing["output"] / 1000)),
            auto_updated=True,
            notes="Auto-updated from hardcoded pricing map",
        )

    def _create_or_update_price(
        self,
        provider,
        model_name,
        input_price_per_1k,
        output_price_per_1k,
        auto_updated=False,
        notes="",
    ):
        """
        Create or update price entry.

        Only creates new entry if prices have changed.
        """
        from ai_tracking.models import AIModelPrice

        # Get current price
        current_price = AIModelPrice.get_current_price(provider, model_name)

        # Check if price has changed
        if current_price:
            if (
                current_price.input_price_per_1k == input_price_per_1k
                and current_price.output_price_per_1k == output_price_per_1k
            ):
                # Price unchanged, just update verification time
                current_price.last_verified = timezone.now()
                current_price.is_stale = False
                current_price.save()
                return False

        # Create new price entry
        AIModelPrice.objects.create(
            provider=provider,
            model_name=model_name,
            input_price_per_1k=input_price_per_1k,
            output_price_per_1k=output_price_per_1k,
            auto_updated=auto_updated,
            notes=notes,
            effective_date=timezone.now(),
            is_stale=False,
        )

        return True

    def send_price_update_email(self, results):
        """
        Send email notification about price updates.

        Args:
            results: Dict with 'updated', 'stale', and 'errors' keys
        """
        if not any([results["updated"], results["stale"], results["errors"]]):
            # Nothing to report
            return

        subject = "AI Model Price Update Report"

        # Build email body
        message_parts = []

        if results["updated"]:
            message_parts.append("Updated Prices:")
            for item in results["updated"]:
                message_parts.append(f"  - {item}")
            message_parts.append("")

        if results["stale"]:
            message_parts.append("Stale Prices (need manual update):")
            for item in results["stale"]:
                message_parts.append(f"  - {item}")
            message_parts.append("")

        if results["errors"]:
            message_parts.append("Errors:")
            for item in results["errors"]:
                message_parts.append(f"  - {item}")
            message_parts.append("")

        message_parts.append(
            "Please review and update prices as needed in the admin panel."
        )

        message = "\n".join(message_parts)

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[self.admin_email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Failed to send price update email: {e}")

    def send_stale_price_reminder(self):
        """Send reminder about stale prices."""
        from ai_tracking.models import AIModelPrice

        stale_prices = AIModelPrice.objects.filter(is_stale=True)

        if not stale_prices.exists():
            return

        subject = f"Reminder: {stale_prices.count()} AI Model Prices Need Updating"

        message_parts = [
            f"The following {stale_prices.count()} AI model prices are marked as stale",
            f"(not verified in {self.stale_days} days):",
            "",
        ]

        for price in stale_prices:
            days_old = (timezone.now() - price.last_verified).days
            message_parts.append(
                f"  - {price.provider}/{price.model_name} "
                f"(last verified {days_old} days ago)"
            )

        message_parts.append("")
        message_parts.append(
            "Please verify and update these prices in the admin panel at "
            f"{settings.SITE_URL}/admin/ai_tracking/aimodelprice/"
        )

        message = "\n".join(message_parts)

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[self.admin_email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Failed to send stale price reminder: {e}")

    def check_budget_alerts(self):
        """
        Check all active budget alerts and trigger notifications if needed.

        Returns list of triggered alerts.
        """
        from ai_tracking.models import AIBudgetAlert

        triggered = []
        alerts = AIBudgetAlert.objects.filter(is_active=True)

        for alert in alerts:
            alert.last_checked = timezone.now()

            if alert.should_trigger_alert():
                self._send_budget_alert_email(alert)
                alert.last_triggered = timezone.now()
                triggered.append(alert)

            alert.save()

        return triggered

    def _send_budget_alert_email(self, alert):
        """Send budget alert email."""
        current_spend = alert.get_current_spend()
        percentage = alert.get_spend_percentage()

        subject = f"AI Budget Alert: {alert.name}"

        message = (
            f"Budget alert '{alert.name}' has been triggered.\n\n"
            f"Current spend: ${current_spend:.2f}\n"
            f"Budget: ${alert.budget_amount:.2f}\n"
            f"Percentage: {percentage:.1f}%\n"
            f"Period: {alert.period}\n"
        )

        if alert.provider:
            message += f"Provider: {alert.provider}\n"
        if alert.model_name:
            message += f"Model: {alert.model_name}\n"
        if alert.user:
            message += f"User: {alert.user.username}\n"

        message += (
            f"\n"
            f"View details at {settings.SITE_URL}/admin/ai_tracking/aibudgetalert/{alert.id}/\n"
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=alert.email_recipients,
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Failed to send budget alert email: {e}")
