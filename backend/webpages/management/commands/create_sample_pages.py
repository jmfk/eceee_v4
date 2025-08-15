"""
Management command to create sample pages for testing drag and drop functionality
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone

from webpages.models import WebPage, PageVersion


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

    def handle(self, *args, **options):
        # Get or create a superuser
        try:
            user = User.objects.get(is_superuser=True)
        except User.DoesNotExist:
            user = User.objects.create_user(
                username="admin",
                email="admin@example.com",
                password="blarg123",
                is_superuser=True,
                is_staff=True,
            )
            self.stdout.write(self.style.SUCCESS(f"Created superuser: {user.username}"))

        if options["clear"]:
            WebPage.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("Cleared all existing pages"))

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
            # Create the page
            page = WebPage.objects.create(
                title=page_data["title"],
                slug=page_data["slug"],
                code_layout=page_data.get("code_layout", "single_column"),
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
                page_data={
                    "title": page_data["title"],
                    "content": "<h1>"
                    + page_data["title"]
                    + "</h1><p>This is sample content for "
                    + page_data["title"]
                    + ".</p>",
                    "meta_description": f"Sample page for {page_data['title']}",
                },
                widgets=[],
                description="Initial version",
                change_summary={"action": "created", "changes": []},
                created_by=user,
                status="published",
                is_current=True,
                published_at=timezone.now(),
                published_by=user,
            )

            indent = "  " * level
            hostname_info = (
                f" (hostnames: {', '.join(page_data.get('hostnames', []))})"
                if page_data.get("hostnames")
                else " (no hostnames)"
            )
            self.stdout.write(f"{indent}Created page: {page.title}{hostname_info}")

            # Create children
            if "children" in page_data:
                for child_data in page_data["children"]:
                    create_page(child_data, parent=page, level=level + 1)

            return page

        # Create all pages
        for page_data in page_structure:
            create_page(page_data)

        total_pages = WebPage.objects.count()
        top_level_no_hostnames = WebPage.objects.filter(
            parent=None, hostnames__len=0
        ).count()

        self.stdout.write(
            self.style.SUCCESS(f"\nSuccessfully created {total_pages} sample pages!")
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
