"""
Management command to send duplicate page reports to administrators.

This command queries unresolved duplicate page logs and sends a summary email
to configured administrators. Can be run daily or weekly via cron/celery.
"""

from django.core.management.base import BaseCommand
from django.core.mail import mail_admins
from django.utils import timezone
from django.template.loader import render_to_string
from datetime import timedelta

from webpages.models import DuplicatePageLog


class Command(BaseCommand):
    help = "Send duplicate page report to administrators"

    def add_arguments(self, parser):
        parser.add_argument(
            "--period",
            type=str,
            default="day",
            choices=["day", "week", "all"],
            help="Report period: day (last 24 hours), week (last 7 days), or all (all unresolved)",
        )
        parser.add_argument(
            "--min-occurrences",
            type=int,
            default=1,
            help="Minimum number of occurrences to include in report",
        )
        parser.add_argument(
            "--dry-run", action="store_true", help="Print report without sending email"
        )

    def handle(self, *args, **options):
        period = options["period"]
        min_occurrences = options["min_occurrences"]
        dry_run = options["dry_run"]

        # Calculate time threshold
        now = timezone.now()
        if period == "day":
            threshold = now - timedelta(days=1)
            period_label = "Last 24 Hours"
        elif period == "week":
            threshold = now - timedelta(days=7)
            period_label = "Last 7 Days"
        else:
            threshold = None
            period_label = "All Time"

        # Query unresolved duplicates
        queryset = DuplicatePageLog.objects.filter(resolved=False)

        if threshold:
            queryset = queryset.filter(last_seen__gte=threshold)

        if min_occurrences > 1:
            queryset = queryset.filter(occurrence_count__gte=min_occurrences)

        duplicates = queryset.select_related("parent").order_by(
            "-occurrence_count", "-last_seen"
        )

        if not duplicates.exists():
            self.stdout.write(self.style.SUCCESS("No duplicate pages to report"))
            return

        # Generate report
        report_data = []
        total_occurrences = 0

        for dup in duplicates:
            parent_info = (
                f"{dup.parent.title} (ID: {dup.parent.id})"
                if dup.parent
                else "Root Level"
            )
            report_data.append(
                {
                    "slug": dup.slug,
                    "parent": parent_info,
                    "page_ids": dup.page_ids,
                    "occurrence_count": dup.occurrence_count,
                    "first_seen": dup.first_seen,
                    "last_seen": dup.last_seen,
                }
            )
            total_occurrences += dup.occurrence_count

        # Format email
        subject = f"Duplicate Page Report - {period_label}"

        # Create plain text message
        message_lines = [
            f"Duplicate Page Report - {period_label}",
            "=" * 60,
            "",
            f"Total unique duplicates: {duplicates.count()}",
            f"Total occurrences: {total_occurrences}",
            "",
            "Details:",
            "-" * 60,
        ]

        for item in report_data:
            message_lines.extend(
                [
                    "",
                    f"Slug: {item['slug']}",
                    f"Parent: {item['parent']}",
                    f"Page IDs: {', '.join(map(str, item['page_ids']))}",
                    f"Occurrences: {item['occurrence_count']}",
                    f"First seen: {item['first_seen'].strftime('%Y-%m-%d %H:%M')}",
                    f"Last seen: {item['last_seen'].strftime('%Y-%m-%d %H:%M')}",
                    "-" * 60,
                ]
            )

        message_lines.extend(
            [
                "",
                "These duplicates should be reviewed and resolved in the Django admin:",
                "/admin/webpages/duplicatepagelog/",
                "",
                "To resolve duplicates:",
                "1. Review the duplicate pages in the admin",
                "2. Decide which page to keep",
                "3. Delete or merge the duplicate pages",
                "4. Mark the duplicate log entry as resolved",
            ]
        )

        message = "\n".join(message_lines)

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - Email not sent"))
            self.stdout.write("")
            self.stdout.write(f"Subject: {subject}")
            self.stdout.write("")
            self.stdout.write(message)
            return

        # Send email
        try:
            mail_admins(
                subject=subject,
                message=message,
                fail_silently=False,
            )

            # Update email_sent timestamp for all included duplicates
            duplicates.update(email_sent=now)

            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully sent duplicate page report "
                    f"({duplicates.count()} duplicates, {total_occurrences} total occurrences)"
                )
            )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to send email: {str(e)}"))
            raise
