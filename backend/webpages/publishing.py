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
        Process versions that should be published now using date-based logic.

        NEW: Finds versions with effective_date <= now that aren't currently published.

        Returns:
            Tuple of (count_published, error_messages)
        """
        if now is None:
            now = timezone.now()

        # Import here to avoid circular imports
        from .models import PageVersion

        # Find versions that should be published but aren't yet
        versions_to_publish = PageVersion.objects.filter(
            effective_date__lte=now
        ).filter(
            # Not currently the published version for their page
            # We'll check this in the loop for efficiency
        ).select_related("page", "created_by")

        published_count = 0
        errors = []

        for version in versions_to_publish:
            try:
                # Check if this version should be published and isn't already
                if version.is_published(now) and not version.is_current_published(now):
                    # This version should become the current published version
                    # We don't need complex publishing logic - just update effective_date if needed
                    
                    self.logger.info(
                        f"Version {version.version_number} of page '{version.page.title}' "
                        f"is now published (effective: {version.effective_date})"
                    )
                    published_count += 1
                    
                    # Note: In the new system, versions become published automatically
                    # based on their dates - no manual state changes needed
                    
            except Exception as e:
                error_msg = f"Failed to process version {version.version_number} of {version.page.title}: {str(e)}"
                errors.append(error_msg)
                self.logger.error(error_msg)

        return published_count, errors

    def process_scheduled_publications_legacy(
        self, now: Optional[timezone.datetime] = None
    ) -> Tuple[int, List[str]]:
        """
        LEGACY: Process pages using old publication_status logic.
        Will be removed in Phase 3.
        """
        if now is None:
            now = timezone.now()

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
        Process versions that should be expired now using date-based logic.

        NEW: Finds versions with expiry_date <= now that are currently published.

        Returns:
            Tuple of (count_expired, error_messages)
        """
        if now is None:
            now = timezone.now()

        # Import here to avoid circular imports
        from .models import PageVersion

        # Find versions that should be expired
        versions_to_expire = PageVersion.objects.filter(
            expiry_date__lte=now,
            expiry_date__isnull=False
        ).select_related("page", "created_by")

        expired_count = 0
        errors = []

        for version in versions_to_expire:
            try:
                # Check if this version was published but is now expired
                if not version.is_published(now) and version.expiry_date:
                    # This version has expired
                    
                    self.logger.info(
                        f"Version {version.version_number} of page '{version.page.title}' "
                        f"has expired (expiry: {version.expiry_date})"
                    )
                    expired_count += 1
                    
                    # Note: In the new system, versions expire automatically
                    # based on their dates - no manual state changes needed
                    
            except Exception as e:
                error_msg = f"Failed to process expired version {version.version_number} of {version.page.title}: {str(e)}"
                errors.append(error_msg)
                self.logger.error(error_msg)

        return expired_count, errors

    def process_expired_pages_legacy(
        self, now: Optional[timezone.datetime] = None
    ) -> Tuple[int, List[str]]:
        """
        LEGACY: Process pages using old publication_status logic.
        Will be removed in Phase 3.
        """
        if now is None:
            now = timezone.now()

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
        Publish multiple pages at once using date-based logic.

        NEW: Sets effective_date to now on the latest version of each page.

        Returns:
            Tuple of (count_published, error_messages)
        """
        # Import here to avoid circular imports
        from .models import WebPage, PageVersion

        pages = WebPage.objects.filter(id__in=page_ids)
        published_count = 0
        errors = []

        for page in pages:
            try:
                # Get or create the latest version for this page
                latest_version = page.versions.order_by('-version_number').first()
                
                if not latest_version:
                    # Create a new version if none exists
                    latest_version = page.create_version(
                        self.user, 
                        change_summary,
                        status="draft"  # Legacy field
                    )
                
                # Set effective_date to now to publish immediately
                latest_version.effective_date = timezone.now()
                # Don't set expiry_date - let it remain null for indefinite publishing
                latest_version.save(update_fields=['effective_date'])
                
                published_count += 1
                self.logger.info(f"Bulk published page: {page.title} (version {latest_version.version_number})")
                
            except Exception as e:
                error_msg = f"Failed to bulk publish {page.title}: {str(e)}"
                errors.append(error_msg)
                self.logger.error(error_msg)

        return published_count, errors

    def bulk_publish_pages_legacy(
        self, page_ids: List[int], change_summary: str = "Bulk publish operation"
    ) -> Tuple[int, List[str]]:
        """
        LEGACY: Publish multiple pages using old logic.
        Will be removed in Phase 3.
        """
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
        Schedule multiple pages at once using date-based logic.

        NEW: Sets effective_date and expiry_date on the latest version of each page.

        Returns:
            Tuple of (count_scheduled, error_messages)
        """
        # Import here to avoid circular imports
        from .models import WebPage, PageVersion

        if not schedule.is_valid():
            return 0, ["Invalid schedule: effective date must be before expiry date"]

        pages = WebPage.objects.filter(id__in=page_ids)
        scheduled_count = 0
        errors = []

        for page in pages:
            try:
                # Get or create the latest version for this page
                latest_version = page.versions.order_by('-version_number').first()
                
                if not latest_version:
                    # Create a new version if none exists
                    latest_version = page.create_version(
                        self.user, 
                        change_summary,
                        status="draft"  # Legacy field
                    )
                
                # Set the schedule dates
                latest_version.effective_date = schedule.effective_date
                latest_version.expiry_date = schedule.expiry_date
                latest_version.save(update_fields=['effective_date', 'expiry_date'])
                
                scheduled_count += 1
                self.logger.info(
                    f"Bulk scheduled page: {page.title} (version {latest_version.version_number}) "
                    f"from {schedule.effective_date} to {schedule.expiry_date or 'indefinite'}"
                )
                
            except Exception as e:
                error_msg = f"Failed to bulk schedule {page.title}: {str(e)}"
                errors.append(error_msg)
                self.logger.error(error_msg)

        return scheduled_count, errors

    def bulk_schedule_pages_legacy(
        self,
        page_ids: List[int],
        schedule: PublicationSchedule,
        change_summary: str = "Bulk schedule operation",
    ) -> Tuple[int, List[str]]:
        """
        LEGACY: Schedule multiple pages using old logic.
        Will be removed in Phase 3.
        """
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
