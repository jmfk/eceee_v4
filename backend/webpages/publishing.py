"""
Publishing domain objects and services for the web page publishing system.

This module contains value objects and service classes that handle the business
logic for page publication workflows, following object-oriented design principles.
"""

from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from typing import Optional, List, Tuple
import logging

logger = logging.getLogger(__name__)


class PublicationSchedule:
    """
    Value object representing a publication schedule with effective and expiry dates.

    This encapsulates the logic for date validation and schedule operations,
    addressing the "data clumps" code smell identified in the review.
    """

    def __init__(
        self,
        effective_date: Optional[timezone.datetime] = None,
        expiry_date: Optional[timezone.datetime] = None,
    ):
        self.effective_date = effective_date
        self.expiry_date = expiry_date
        self._validate()

    def _validate(self):
        """Validate that the schedule dates are logical."""
        if (
            self.effective_date
            and self.expiry_date
            and self.effective_date >= self.expiry_date
        ):
            raise ValidationError("Effective date must be before expiry date.")

    def is_valid(self) -> bool:
        """Check if the schedule is valid."""
        try:
            self._validate()
            return True
        except ValidationError:
            return False

    def is_effective_now(self, now: Optional[timezone.datetime] = None) -> bool:
        """Check if the schedule is currently effective."""
        if now is None:
            now = timezone.now()

        if self.effective_date and self.effective_date > now:
            return False

        if self.expiry_date and self.expiry_date <= now:
            return False

        return True

    def should_be_published_at(self, when: timezone.datetime) -> bool:
        """Check if content should be published at the given time."""
        if self.effective_date and self.effective_date > when:
            return False
        return True

    def should_be_expired_at(self, when: timezone.datetime) -> bool:
        """Check if content should be expired at the given time."""
        if self.expiry_date and self.expiry_date <= when:
            return True
        return False

    def time_until_effective(
        self, now: Optional[timezone.datetime] = None
    ) -> Optional[timezone.timedelta]:
        """Get time remaining until the schedule becomes effective."""
        if not self.effective_date:
            return None

        if now is None:
            now = timezone.now()

        if self.effective_date <= now:
            return None

        return self.effective_date - now

    def time_until_expiry(
        self, now: Optional[timezone.datetime] = None
    ) -> Optional[timezone.timedelta]:
        """Get time remaining until the schedule expires."""
        if not self.expiry_date:
            return None

        if now is None:
            now = timezone.now()

        if self.expiry_date <= now:
            return None

        return self.expiry_date - now

    def __str__(self):
        if self.effective_date and self.expiry_date:
            return f"Effective: {self.effective_date}, Expires: {self.expiry_date}"
        elif self.effective_date:
            return f"Effective: {self.effective_date}"
        elif self.expiry_date:
            return f"Expires: {self.expiry_date}"
        else:
            return "No schedule set"


class PublishingService:
    """
    Service class that handles publishing business logic.

    This addresses the "feature envy" code smell by moving business logic
    out of the management command and into a dedicated service class.
    """

    def __init__(self, user):
        self.user = user
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    def process_scheduled_publications(
        self, now: Optional[timezone.datetime] = None
    ) -> Tuple[int, List[str]]:
        """
        Process pages that should be published now.

        Returns:
            Tuple of (count_published, error_messages)
        """
        if now is None:
            now = timezone.now()

        # Import here to avoid circular imports
        from .models import WebPage

        pages_to_publish = WebPage.objects.filter(
            publication_status="scheduled"
        ).select_related("created_by", "last_modified_by")

        published_count = 0
        errors = []

        for page in pages_to_publish:
            if page.should_be_published_now(now):
                try:
                    if page.publish(
                        self.user,
                        f'Automatically published at {now.strftime("%Y-%m-%d %H:%M")}',
                    ):
                        published_count += 1
                        self.logger.info(f"Published page: {page.title} (/{page.slug})")
                except Exception as e:
                    error_msg = f"Failed to publish {page.title}: {str(e)}"
                    errors.append(error_msg)
                    self.logger.error(error_msg)

        return published_count, errors

    def process_expired_pages(
        self, now: Optional[timezone.datetime] = None
    ) -> Tuple[int, List[str]]:
        """
        Process pages that should be expired now.

        Returns:
            Tuple of (count_expired, error_messages)
        """
        if now is None:
            now = timezone.now()

        # Import here to avoid circular imports
        from .models import WebPage

        pages_to_expire = WebPage.objects.filter(
            publication_status="published"
        ).select_related("created_by", "last_modified_by")

        expired_count = 0
        errors = []

        for page in pages_to_expire:
            if page.should_be_expired_now(now):
                try:
                    expiry_note = (
                        f'Automatically expired at {now.strftime("%Y-%m-%d %H:%M")} '
                        f'(expiry date: {page.expiry_date.strftime("%Y-%m-%d %H:%M")})'
                    )
                    if page.expire(self.user, expiry_note):
                        expired_count += 1
                        self.logger.info(f"Expired page: {page.title} (/{page.slug})")
                except Exception as e:
                    error_msg = f"Failed to expire {page.title}: {str(e)}"
                    errors.append(error_msg)
                    self.logger.error(error_msg)

        return expired_count, errors

    def bulk_publish_pages(
        self, page_ids: List[int], change_summary: str = "Bulk publish operation"
    ) -> Tuple[int, List[str]]:
        """
        Publish multiple pages at once.

        Returns:
            Tuple of (count_published, error_messages)
        """
        # Import here to avoid circular imports
        from .models import WebPage

        pages = WebPage.objects.filter(id__in=page_ids)
        published_count = 0
        errors = []

        for page in pages:
            try:
                if page.publish(self.user, change_summary):
                    published_count += 1
                    self.logger.info(f"Bulk published page: {page.title}")
            except Exception as e:
                error_msg = f"Failed to bulk publish {page.title}: {str(e)}"
                errors.append(error_msg)
                self.logger.error(error_msg)

        return published_count, errors

    def bulk_schedule_pages(
        self,
        page_ids: List[int],
        schedule: PublicationSchedule,
        change_summary: str = "Bulk schedule operation",
    ) -> Tuple[int, List[str]]:
        """
        Schedule multiple pages at once.

        Returns:
            Tuple of (count_scheduled, error_messages)
        """
        # Import here to avoid circular imports
        from .models import WebPage

        pages = WebPage.objects.filter(id__in=page_ids)
        scheduled_count = 0
        errors = []

        for page in pages:
            try:
                if page.schedule(schedule, self.user, change_summary):
                    scheduled_count += 1
                    self.logger.info(f"Bulk scheduled page: {page.title}")
            except Exception as e:
                error_msg = f"Failed to bulk schedule {page.title}: {str(e)}"
                errors.append(error_msg)
                self.logger.error(error_msg)

        return scheduled_count, errors
