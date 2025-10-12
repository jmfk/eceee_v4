"""
Management command to create sample content for object publishing system testing
Enhanced version with better error handling, more realistic data, and improved configurability
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import transaction
from datetime import datetime, timedelta
import random
import logging
from typing import List, Dict, Any

from content.models import Category, Tag

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Create sample content for object publishing system testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=5,
            help="Number of objects to create for each type",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Remove existing sample data before creating new ones",
        )
        parser.add_argument(
            "--seed",
            type=int,
            help="Random seed for reproducible data generation",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Batch size for database operations",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Enable verbose output",
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.WARNING(
                "This command is deprecated. News, Event, LibraryItem, and Member models "
                "have been removed. Use the Object Storage system instead."
            )
        )
        return

        # DEPRECATED CODE BELOW
        count = options["count"]
        clean = options["clean"]
        seed = options["seed"]
        batch_size = options["batch_size"]
        verbose = options["verbose"]

        # Set random seed for reproducible data
        if seed is not None:
            random.seed(seed)
            self.stdout.write(f"Using random seed: {seed}")

        # Configure logging level
        if verbose:
            logging.basicConfig(level=logging.DEBUG)

        try:
            with transaction.atomic():
                # Clean existing data if requested
                if clean:
                    self._clean_existing_data()

                # Get or create a superuser
                user = self._get_or_create_superuser()

                # Create all content types
                self._create_all_content(user, count, batch_size, verbose)

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Successfully created sample content with {count} objects of each type!"
                    )
                )

        except Exception as e:
            logger.error(f"Error creating sample content: {e}")
            self.stdout.write(self.style.ERROR(f"Failed to create sample content: {e}"))
            raise

    def _clean_existing_data(self):
        """Remove existing sample data."""
        self.stdout.write("Cleaning existing sample data...")

        # Delete in correct order to avoid foreign key conflicts
        Member.objects.filter(email__contains="@example.com").delete()
        LibraryItem.objects.filter(file_url__contains="/media/library/").delete()
        Event.objects.filter(organizer_email="events@example.com").delete()
        News.objects.filter(
            author__in=[
                "Dr. Sarah Johnson",
                "Prof. Michael Chen",
                "Dr. Emily Rodriguez",
                "Alex Thompson",
                "Dr. Lisa Wang",
            ]
        ).delete()

        # Clean up categories and tags that might be sample data
        Tag.objects.filter(
            slug__in=[
                "important",
                "featured",
                "urgent",
                "research",
                "collaboration",
                "innovation",
                "sustainability",
                "development",
                "training",
                "workshop",
            ]
        ).delete()
        Category.objects.filter(
            slug__in=["technology", "education", "research", "community", "policy"]
        ).delete()

        self.stdout.write(self.style.SUCCESS("Cleaned existing sample data"))

    def _get_or_create_superuser(self):
        """Get or create a superuser for content creation."""
        try:
            user = User.objects.get(is_superuser=True)
        except User.DoesNotExist:
            user = User.objects.create_user(
                username="admin",
                email="admin@example.com",
                password="blarg123!",
                is_superuser=True,
                is_staff=True,
            )
            self.stdout.write(self.style.SUCCESS(f"Created superuser: {user.username}"))
        except User.MultipleObjectsReturned:
            user = User.objects.filter(is_superuser=True).first()

        return user

    def _create_all_content(
        self, user: User, count: int, batch_size: int, verbose: bool
    ):
        """Create all content types."""
        # Create categories and tags first
        categories = self._create_categories(verbose)
        tags = self._create_tags(verbose)

        # Create content in batches
        self._create_news_articles(user, categories, tags, count, verbose)
        self._create_events(user, categories, tags, count, verbose)
        self._create_library_items(user, categories, tags, count, verbose)
        self._create_members(user, categories, tags, count, verbose)

    def _create_categories(self, verbose: bool) -> List[Category]:
        """Create sample categories."""
        categories = []
        category_data = [
            {"name": "Technology", "slug": "technology", "color": "#3B82F6"},
            {"name": "Education", "slug": "education", "color": "#10B981"},
            {"name": "Research", "slug": "research", "color": "#8B5CF6"},
            {"name": "Community", "slug": "community", "color": "#F59E0B"},
            {"name": "Policy", "slug": "policy", "color": "#EF4444"},
            {"name": "Innovation", "slug": "innovation", "color": "#06B6D4"},
            {"name": "Sustainability", "slug": "sustainability", "color": "#84CC16"},
            {"name": "Collaboration", "slug": "collaboration", "color": "#F97316"},
        ]

        for cat_data in category_data:
            category, created = Category.objects.get_or_create(
                slug=cat_data["slug"],
                defaults={
                    "name": cat_data["name"],
                    "color": cat_data["color"],
                    "description": f'Content related to {cat_data["name"].lower()}',
                },
            )
            categories.append(category)
            if created and verbose:
                self.stdout.write(f"Created category: {category.name}")

        return categories

    def _create_tags(self, verbose: bool) -> List[Tag]:
        """Create sample tags."""
        tags = []
        tag_names = [
            "important",
            "featured",
            "urgent",
            "research",
            "collaboration",
            "innovation",
            "sustainability",
            "development",
            "training",
            "workshop",
            "conference",
            "publication",
            "networking",
            "best-practices",
            "case-study",
        ]

        for tag_name in tag_names:
            tag, created = Tag.objects.get_or_create(
                slug=tag_name, defaults={"name": tag_name.title().replace("-", " ")}
            )
            tags.append(tag)
            if created and verbose:
                self.stdout.write(f"Created tag: {tag.name}")

        return tags

    def _create_news_articles(
        self,
        user: User,
        categories: List[Category],
        tags: List[Tag],
        count: int,
        verbose: bool,
    ):
        """Create sample news articles."""
        news_data = [
            {
                "title": "New Research Initiative Launched",
                "slug": "new-research-initiative-launched",
                "content": "We are excited to announce the launch of our new research initiative focused on sustainable development. This groundbreaking program will bring together leading researchers from around the world to tackle some of the most pressing environmental challenges of our time. The initiative includes funding for innovative projects, collaborative research opportunities, and knowledge sharing platforms.",
                "author": "Dr. Sarah Johnson",
                "priority": "high",
            },
            {
                "title": "Partnership with Leading University",
                "slug": "partnership-with-leading-university",
                "content": "Our organization has formed a strategic partnership with XYZ University to advance research in environmental science. This collaboration will facilitate joint research projects, student exchange programs, and shared access to cutting-edge laboratory facilities. The partnership aims to accelerate the development of sustainable technologies and practices.",
                "author": "Prof. Michael Chen",
                "priority": "normal",
            },
            {
                "title": "Annual Conference Results",
                "slug": "annual-conference-results",
                "content": "The results from our annual conference are now available, showcasing groundbreaking research and innovations from our global community. This year's event featured over 200 presentations, workshops, and networking sessions. Key themes included renewable energy, circular economy principles, and climate adaptation strategies.",
                "author": "Dr. Emily Rodriguez",
                "priority": "normal",
            },
            {
                "title": "Grant Funding Opportunity",
                "slug": "grant-funding-opportunity",
                "content": "A new grant funding opportunity is available for researchers working on climate change solutions. The program offers up to $500,000 in funding for innovative projects that demonstrate potential for significant environmental impact. Applications are due by the end of next month, and we encourage all eligible researchers to apply.",
                "author": "Alex Thompson",
                "priority": "urgent",
            },
            {
                "title": "Technology Innovation Award",
                "slug": "technology-innovation-award",
                "content": "Our team has received the Technology Innovation Award for developing sustainable energy solutions. The award recognizes our breakthrough work in developing more efficient solar panel technology that can be manufactured using recycled materials. This achievement represents years of dedicated research and collaboration.",
                "author": "Dr. Lisa Wang",
                "priority": "high",
            },
            {
                "title": "Community Engagement Program Launch",
                "slug": "community-engagement-program-launch",
                "content": "We are launching a new community engagement program to increase public awareness about sustainability practices. The program includes educational workshops, community gardens, and local sustainability challenges. Our goal is to empower individuals and communities to take meaningful action on environmental issues.",
                "author": "Maria Santos",
                "priority": "normal",
            },
            {
                "title": "International Collaboration Agreement",
                "slug": "international-collaboration-agreement",
                "content": "A new international collaboration agreement has been signed with research institutions across five continents. This partnership will enable large-scale studies on global environmental trends and facilitate the sharing of best practices. The collaboration is expected to significantly advance our understanding of climate change impacts.",
                "author": "Dr. James Wilson",
                "priority": "high",
            },
        ]

        created_count = 0
        for i, news_item in enumerate(news_data[:count]):
            news, created = News.objects.get_or_create(
                slug=news_item["slug"],
                defaults={
                    "title": news_item["title"],
                    "content": news_item["content"],
                    "description": news_item["content"][:200] + "...",
                    "excerpt": news_item["content"][:100] + "...",
                    "author": news_item["author"],
                    "priority": news_item["priority"],
                    "is_published": True,
                    "published_date": timezone.now()
                    - timedelta(days=random.randint(1, 30)),
                    "featured": i < 2,
                    "created_by": user,
                    "last_modified_by": user,
                    "category": random.choice(categories),
                },
            )
            if created:
                news.tags.set(random.sample(tags, random.randint(1, 4)))
                created_count += 1
                if verbose:
                    self.stdout.write(f"Created news: {news.title}")

        self.stdout.write(self.style.SUCCESS(f"Created {created_count} news articles"))

    def _create_events(
        self,
        user: User,
        categories: List[Category],
        tags: List[Tag],
        count: int,
        verbose: bool,
    ):
        """Create sample events."""
        event_data = [
            {
                "title": "Annual Research Symposium",
                "slug": "annual-research-symposium",
                "location_name": "Main Conference Center",
                "organizer_name": "Research Committee",
                "duration_hours": 8,
            },
            {
                "title": "Sustainability Workshop",
                "slug": "sustainability-workshop",
                "location_name": "Training Room A",
                "organizer_name": "Education Team",
                "duration_hours": 4,
            },
            {
                "title": "Technology Demo Day",
                "slug": "technology-demo-day",
                "location_name": "Innovation Lab",
                "organizer_name": "Tech Team",
                "duration_hours": 6,
            },
            {
                "title": "Community Outreach Event",
                "slug": "community-outreach-event",
                "location_name": "Community Center",
                "organizer_name": "Outreach Committee",
                "duration_hours": 3,
            },
            {
                "title": "Policy Forum Discussion",
                "slug": "policy-forum-discussion",
                "location_name": "Board Room",
                "organizer_name": "Policy Team",
                "duration_hours": 2,
            },
            {
                "title": "Innovation Showcase",
                "slug": "innovation-showcase",
                "location_name": "Exhibition Hall",
                "organizer_name": "Innovation Team",
                "duration_hours": 5,
            },
            {
                "title": "Networking Mixer",
                "slug": "networking-mixer",
                "location_name": "Rooftop Terrace",
                "organizer_name": "Community Relations",
                "duration_hours": 3,
            },
        ]

        created_count = 0
        for i, event_item in enumerate(event_data[:count]):
            start_date = timezone.now() + timedelta(days=random.randint(7, 90))
            event, created = Event.objects.get_or_create(
                slug=event_item["slug"],
                defaults={
                    "title": event_item["title"],
                    "content": f'Join us for {event_item["title"]} at {event_item["location_name"]}. This event will cover important topics and provide excellent networking opportunities. We expect participants from various sectors including academia, industry, and government.',
                    "description": f"An important event focusing on key topics in our field, featuring expert speakers and interactive sessions.",
                    "excerpt": f'Join us for {event_item["title"]} - an important gathering for our community.',
                    "start_date": start_date,
                    "end_date": start_date
                    + timedelta(hours=event_item["duration_hours"]),
                    "location_name": event_item["location_name"],
                    "organizer_name": event_item["organizer_name"],
                    "organizer_email": "events@example.com",
                    "is_published": True,
                    "published_date": timezone.now()
                    - timedelta(days=random.randint(1, 14)),
                    "featured": i < 2,
                    "created_by": user,
                    "last_modified_by": user,
                    "category": random.choice(categories),
                },
            )
            if created:
                event.tags.set(random.sample(tags, random.randint(1, 3)))
                created_count += 1
                if verbose:
                    self.stdout.write(f"Created event: {event.title}")

        self.stdout.write(self.style.SUCCESS(f"Created {created_count} events"))

    def _create_library_items(
        self,
        user: User,
        categories: List[Category],
        tags: List[Tag],
        count: int,
        verbose: bool,
    ):
        """Create sample library items."""
        library_data = [
            {
                "title": "Research Methodology Guide",
                "slug": "research-methodology-guide",
                "item_type": "guide",
                "file_format": "PDF",
                "access_level": "public",
            },
            {
                "title": "Sustainability Best Practices",
                "slug": "sustainability-best-practices",
                "item_type": "manual",
                "file_format": "PDF",
                "access_level": "public",
            },
            {
                "title": "Annual Report 2024",
                "slug": "annual-report-2024",
                "item_type": "report",
                "file_format": "PDF",
                "access_level": "public",
            },
            {
                "title": "Policy Framework Document",
                "slug": "policy-framework-document",
                "item_type": "policy",
                "file_format": "DOCX",
                "access_level": "members",
            },
            {
                "title": "Training Materials Collection",
                "slug": "training-materials-collection",
                "item_type": "document",
                "file_format": "ZIP",
                "access_level": "public",
            },
            {
                "title": "Technical Specifications Manual",
                "slug": "technical-specifications-manual",
                "item_type": "manual",
                "file_format": "PDF",
                "access_level": "members",
            },
            {
                "title": "Case Study Collection",
                "slug": "case-study-collection",
                "item_type": "document",
                "file_format": "PDF",
                "access_level": "public",
            },
        ]

        created_count = 0
        for i, lib_item in enumerate(library_data[:count]):
            library_item, created = LibraryItem.objects.get_or_create(
                slug=lib_item["slug"],
                defaults={
                    "title": lib_item["title"],
                    "content": f'This {lib_item["item_type"]} provides comprehensive information and guidance on important topics. It includes detailed explanations, practical examples, and actionable recommendations for professionals in the field.',
                    "description": f"A valuable resource for researchers and practitioners working in related fields.",
                    "excerpt": f'Essential {lib_item["item_type"]} for our community.',
                    "item_type": lib_item["item_type"],
                    "file_format": lib_item["file_format"],
                    "file_size": f"{random.randint(1, 15)} MB",
                    "file_url": f'/media/library/{lib_item["slug"]}.{lib_item["file_format"].lower()}',
                    "access_level": lib_item["access_level"],
                    "is_published": True,
                    "published_date": timezone.now()
                    - timedelta(days=random.randint(1, 90)),
                    "featured": i < 2,
                    "created_by": user,
                    "last_modified_by": user,
                    "category": random.choice(categories),
                },
            )
            if created:
                library_item.tags.set(random.sample(tags, random.randint(1, 3)))
                created_count += 1
                if verbose:
                    self.stdout.write(f"Created library item: {library_item.title}")

        self.stdout.write(self.style.SUCCESS(f"Created {created_count} library items"))

    def _create_members(
        self,
        user: User,
        categories: List[Category],
        tags: List[Tag],
        count: int,
        verbose: bool,
    ):
        """Create sample members."""
        member_data = [
            {
                "first_name": "Dr. Sarah",
                "last_name": "Johnson",
                "job_title": "Research Director",
                "department": "Research & Development",
                "member_type": "staff",
            },
            {
                "first_name": "Prof. Michael",
                "last_name": "Chen",
                "job_title": "Senior Researcher",
                "department": "Environmental Science",
                "member_type": "faculty",
            },
            {
                "first_name": "Dr. Emily",
                "last_name": "Rodriguez",
                "job_title": "Policy Analyst",
                "department": "Policy & Strategy",
                "member_type": "staff",
            },
            {
                "first_name": "Alex",
                "last_name": "Thompson",
                "job_title": "Communications Manager",
                "department": "Communications",
                "member_type": "staff",
            },
            {
                "first_name": "Dr. Lisa",
                "last_name": "Wang",
                "job_title": "Technology Lead",
                "department": "Innovation & Technology",
                "member_type": "staff",
            },
            {
                "first_name": "Maria",
                "last_name": "Santos",
                "job_title": "Community Coordinator",
                "department": "Community Relations",
                "member_type": "staff",
            },
            {
                "first_name": "Dr. James",
                "last_name": "Wilson",
                "job_title": "Senior Fellow",
                "department": "International Relations",
                "member_type": "fellow",
            },
        ]

        created_count = 0
        for i, member_item in enumerate(member_data[:count]):
            slug = f'{member_item["first_name"].lower().replace(".", "")}-{member_item["last_name"].lower()}'
            member, created = Member.objects.get_or_create(
                slug=slug,
                defaults={
                    "first_name": member_item["first_name"],
                    "last_name": member_item["last_name"],
                    "job_title": member_item["job_title"],
                    "department": member_item["department"],
                    "email": f'{member_item["first_name"].lower().replace(".", "")}.{member_item["last_name"].lower()}@example.com',
                    "biography": f'{member_item["first_name"]} {member_item["last_name"]} is a dedicated professional with extensive experience in {member_item["department"].lower()}. They have contributed significantly to various research projects and initiatives within the organization.',
                    "description": f'Professional profile for {member_item["first_name"]} {member_item["last_name"]}',
                    "excerpt": f'{member_item["job_title"]} at {member_item["department"]}',
                    "member_type": member_item["member_type"],
                    "is_current": True,
                    "is_published": True,
                    "published_date": timezone.now()
                    - timedelta(days=random.randint(1, 60)),
                    "featured": i < 2,
                    "created_by": user,
                    "last_modified_by": user,
                    "category": random.choice(categories),
                },
            )
            if created:
                member.tags.set(random.sample(tags, random.randint(1, 2)))
                created_count += 1
                if verbose:
                    self.stdout.write(f"Created member: {member.get_full_name()}")

        self.stdout.write(self.style.SUCCESS(f"Created {created_count} members"))
