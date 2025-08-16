"""
Management command to create sample pages for testing drag and drop functionality
Enhanced version with better error handling and improved configurability
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import transaction
import logging
from typing import List, Dict, Any

from webpages.models import WebPage, PageVersion

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Create sample pages with multiple hierarchy levels for testing drag and drop"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear all existing pages before creating new ones",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Enable verbose output",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be created without actually creating it",
        )

    def handle(self, *args, **options):
        verbose = options["verbose"]
        dry_run = options["dry_run"]
        clear = options["clear"]

        # Configure logging level
        if verbose:
            logging.basicConfig(level=logging.DEBUG)

        try:
            with transaction.atomic():
                if dry_run:
                    self.stdout.write(
                        self.style.WARNING("DRY RUN MODE - No changes will be made")
                    )

                # Get or create a superuser
                user = self._get_or_create_superuser(dry_run)

                if clear and not dry_run:
                    self._clear_existing_pages()

                # Create the page structure
                self._create_page_structure(user, verbose, dry_run)

                if not dry_run:
                    total_pages = WebPage.objects.count()
                    top_level_no_hostnames = WebPage.objects.filter(
                        parent=None, hostnames__len=0
                    ).count()

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"\nSuccessfully created {total_pages} sample pages!"
                        )
                    )

                    if top_level_no_hostnames > 0:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Note: {top_level_no_hostnames} top-level pages have no hostnames and will show warnings."
                            )
                        )

                    self.stdout.write(
                        self.style.SUCCESS(
                            "\nPage hierarchy created with multiple levels for testing drag and drop functionality!"
                        )
                    )

        except Exception as e:
            logger.error(f"Error creating sample pages: {e}")
            self.stdout.write(self.style.ERROR(f"Failed to create sample pages: {e}"))
            raise

    def _get_or_create_superuser(self, dry_run: bool):
        """Get or create a superuser for page creation."""
        try:
            user = User.objects.get(is_superuser=True)
        except User.DoesNotExist:
            if not dry_run:
                user = User.objects.create_user(
                    username="admin",
                    email="admin@example.com",
                    password="blarg123",
                    is_superuser=True,
                    is_staff=True,
                )
                self.stdout.write(
                    self.style.SUCCESS(f"Created superuser: {user.username}")
                )
            else:
                self.stdout.write("Would create superuser: admin")
                user = None
        except User.MultipleObjectsReturned:
            user = User.objects.filter(is_superuser=True).first()

        return user

    def _clear_existing_pages(self):
        """Clear all existing pages."""
        WebPage.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("Cleared all existing pages"))

    def _create_page_structure(self, user, verbose: bool, dry_run: bool):
        """Create the page structure."""
        # Define the page hierarchy - simplified with correct fields
        page_structure = [
            {
                "title": "Home",
                "slug": "home",
                "hostnames": ["example.com", "www.example.com"],
                "code_layout": "single_column",
                "children": [
                    {
                        "title": "About",
                        "slug": "about",
                        "code_layout": "two_column",
                        "children": [
                            {
                                "title": "Our Team",
                                "slug": "our-team",
                                "code_layout": "single_column",
                            },
                            {
                                "title": "History",
                                "slug": "history",
                                "code_layout": "single_column",
                            },
                            {
                                "title": "Mission",
                                "slug": "mission",
                                "code_layout": "single_column",
                            },
                        ],
                    },
                    {
                        "title": "Services",
                        "slug": "services",
                        "code_layout": "two_column",
                        "children": [
                            {
                                "title": "Consulting",
                                "slug": "consulting",
                                "code_layout": "single_column",
                                "children": [
                                    {
                                        "title": "Strategy Consulting",
                                        "slug": "strategy-consulting",
                                        "code_layout": "single_column",
                                    },
                                    {
                                        "title": "Technical Consulting",
                                        "slug": "technical-consulting",
                                        "code_layout": "single_column",
                                    },
                                ],
                            },
                            {
                                "title": "Training",
                                "slug": "training",
                                "code_layout": "single_column",
                                "children": [
                                    {
                                        "title": "Online Courses",
                                        "slug": "online-courses",
                                        "code_layout": "single_column",
                                    },
                                    {
                                        "title": "Workshops",
                                        "slug": "workshops",
                                        "code_layout": "single_column",
                                    },
                                ],
                            },
                            {
                                "title": "Support",
                                "slug": "support",
                                "code_layout": "single_column",
                            },
                        ],
                    },
                    {
                        "title": "Resources",
                        "slug": "resources",
                        "code_layout": "three_column",
                        "children": [
                            {
                                "title": "Documentation",
                                "slug": "documentation",
                                "code_layout": "single_column",
                            },
                            {
                                "title": "Downloads",
                                "slug": "downloads",
                                "code_layout": "single_column",
                            },
                        ],
                    },
                    {
                        "title": "Contact",
                        "slug": "contact",
                        "code_layout": "single_column",
                    },
                ],
            },
            {
                "title": "Blog",
                "slug": "blog",
                "hostnames": ["blog.example.com"],
                "code_layout": "landing_page",
                "children": [
                    {
                        "title": "Technology",
                        "slug": "technology",
                        "code_layout": "single_column",
                    },
                    {
                        "title": "Business",
                        "slug": "business",
                        "code_layout": "single_column",
                    },
                ],
            },
            {
                "title": "Staging Site",
                "slug": "staging",
                "hostnames": [],  # No hostnames - should show warning
                "code_layout": "minimal",
                "children": [
                    {
                        "title": "Test Page",
                        "slug": "test-page",
                        "code_layout": "single_column",
                    },
                ],
            },
            {
                "title": "Development",
                "slug": "development",
                "hostnames": [],
                "code_layout": "minimal",
            },
        ]

        def create_page(page_data, parent=None, level=0):
            """Create a single page with its version."""
            if dry_run:
                indent = "  " * level
                hostname_info = (
                    f" (hostnames: {', '.join(page_data.get('hostnames', []))})"
                    if page_data.get("hostnames")
                    else " (no hostnames)"
                )
                self.stdout.write(
                    f"{indent}Would create page: {page_data['title']}{hostname_info}"
                )

                # Process children in dry run
                if "children" in page_data:
                    for child_data in page_data["children"]:
                        create_page(child_data, parent=None, level=level + 1)
                return None

            # Create the page
            page = WebPage.objects.create(
                title=page_data["title"],
                slug=page_data["slug"],
                parent=parent,
                created_by=user,
                last_modified_by=user,
            )

            # Set hostnames if provided
            if page_data.get("hostnames"):
                page.hostnames = page_data["hostnames"]
                page.save()

            # Create initial page version
            PageVersion.objects.create(
                page=page,
                version_number=1,
                version_title="Initial version",
                title=page_data["title"],
                description=f"Sample page for {page_data['title']} - part of the demo page hierarchy",
                code_layout=page_data.get("code_layout", "single_column"),
                page_data={
                    "content": "<h1>"
                    + page_data["title"]
                    + "</h1><p>This is sample content for "
                    + page_data["title"]
                    + ". This page demonstrates the hierarchical structure and drag-and-drop functionality.</p>",
                    "meta_description": f"Sample page for {page_data['title']} - part of the demo page hierarchy",
                },
                widgets={},
                change_summary={"action": "created", "changes": []},
                created_by=user,
                effective_date=timezone.now(),
            )

            indent = "  " * level
            hostname_info = (
                f" (hostnames: {', '.join(page_data.get('hostnames', []))})"
                if page_data.get("hostnames")
                else " (no hostnames)"
            )
            if verbose:
                self.stdout.write(f"{indent}Created page: {page.title}{hostname_info}")

            # Create children
            if "children" in page_data:
                for child_data in page_data["children"]:
                    create_page(child_data, parent=page, level=level + 1)

            return page

        # Create all pages
        created_count = 0
        for page_data in page_structure:
            page = create_page(page_data)
            if page:
                created_count += 1

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created {created_count} top-level pages with their hierarchies"
                )
            )
