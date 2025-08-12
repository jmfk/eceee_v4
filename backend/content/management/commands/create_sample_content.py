"""
Management command to create sample content for object publishing system testing
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime, timedelta
import random

from content.models import Category, Tag, News, Event, LibraryItem, Member


class Command(BaseCommand):
    help = "Create sample content for object publishing system testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=5,
            help="Number of objects to create for each type",
        )

    def handle(self, *args, **options):
        count = options["count"]

        # Get or create a superuser
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

        # Create categories
        categories = []
        category_data = [
            {"name": "Technology", "slug": "technology", "color": "#3B82F6"},
            {"name": "Education", "slug": "education", "color": "#10B981"},
            {"name": "Research", "slug": "research", "color": "#8B5CF6"},
            {"name": "Community", "slug": "community", "color": "#F59E0B"},
            {"name": "Policy", "slug": "policy", "color": "#EF4444"},
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
            if created:
                self.stdout.write(f"Created category: {category.name}")

        # Create tags
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
        ]

        for tag_name in tag_names:
            tag, created = Tag.objects.get_or_create(
                slug=tag_name, defaults={"name": tag_name.title()}
            )
            tags.append(tag)
            if created:
                self.stdout.write(f"Created tag: {tag.name}")

        # Create news articles
        news_data = [
            {
                "title": "New Research Initiative Launched",
                "slug": "new-research-initiative-launched",
                "content": "We are excited to announce the launch of our new research initiative focused on sustainable development...",
                "author": "Dr. Sarah Johnson",
                "priority": "high",
            },
            {
                "title": "Partnership with Leading University",
                "slug": "partnership-with-leading-university",
                "content": "Our organization has formed a strategic partnership with XYZ University to advance research in environmental science...",
                "author": "Prof. Michael Chen",
                "priority": "normal",
            },
            {
                "title": "Annual Conference Results",
                "slug": "annual-conference-results",
                "content": "The results from our annual conference are now available, showcasing groundbreaking research and innovations...",
                "author": "Dr. Emily Rodriguez",
                "priority": "normal",
            },
            {
                "title": "Grant Funding Opportunity",
                "slug": "grant-funding-opportunity",
                "content": "A new grant funding opportunity is available for researchers working on climate change solutions...",
                "author": "Alex Thompson",
                "priority": "urgent",
            },
            {
                "title": "Technology Innovation Award",
                "slug": "technology-innovation-award",
                "content": "Our team has received the Technology Innovation Award for developing sustainable energy solutions...",
                "author": "Dr. Lisa Wang",
                "priority": "high",
            },
        ]

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
                news.tags.set(random.sample(tags, random.randint(1, 3)))
                self.stdout.write(f"Created news: {news.title}")

        # Create events
        event_data = [
            {
                "title": "Annual Research Symposium",
                "slug": "annual-research-symposium",
                "location_name": "Main Conference Center",
                "organizer_name": "Research Committee",
            },
            {
                "title": "Sustainability Workshop",
                "slug": "sustainability-workshop",
                "location_name": "Training Room A",
                "organizer_name": "Education Team",
            },
            {
                "title": "Technology Demo Day",
                "slug": "technology-demo-day",
                "location_name": "Innovation Lab",
                "organizer_name": "Tech Team",
            },
            {
                "title": "Community Outreach Event",
                "slug": "community-outreach-event",
                "location_name": "Community Center",
                "organizer_name": "Outreach Committee",
            },
            {
                "title": "Policy Forum Discussion",
                "slug": "policy-forum-discussion",
                "location_name": "Board Room",
                "organizer_name": "Policy Team",
            },
        ]

        for i, event_item in enumerate(event_data[:count]):
            start_date = timezone.now() + timedelta(days=random.randint(7, 60))
            event, created = Event.objects.get_or_create(
                slug=event_item["slug"],
                defaults={
                    "title": event_item["title"],
                    "content": f'Join us for {event_item["title"]} at {event_item["location_name"]}. This event will cover important topics and provide networking opportunities.',
                    "description": f"An important event focusing on key topics in our field.",
                    "excerpt": f'Join us for {event_item["title"]} - an important gathering for our community.',
                    "start_date": start_date,
                    "end_date": start_date + timedelta(hours=3),
                    "location_name": event_item["location_name"],
                    "organizer_name": event_item["organizer_name"],
                    "organizer_email": "events@example.com",
                    "is_published": True,
                    "published_date": timezone.now()
                    - timedelta(days=random.randint(1, 10)),
                    "featured": i < 2,
                    "created_by": user,
                    "last_modified_by": user,
                    "category": random.choice(categories),
                },
            )
            if created:
                event.tags.set(random.sample(tags, random.randint(1, 3)))
                self.stdout.write(f"Created event: {event.title}")

        # Create library items
        library_data = [
            {
                "title": "Research Methodology Guide",
                "slug": "research-methodology-guide",
                "item_type": "guide",
                "file_format": "PDF",
            },
            {
                "title": "Sustainability Best Practices",
                "slug": "sustainability-best-practices",
                "item_type": "manual",
                "file_format": "PDF",
            },
            {
                "title": "Annual Report 2024",
                "slug": "annual-report-2024",
                "item_type": "report",
                "file_format": "PDF",
            },
            {
                "title": "Policy Framework Document",
                "slug": "policy-framework-document",
                "item_type": "policy",
                "file_format": "DOCX",
            },
            {
                "title": "Training Materials Collection",
                "slug": "training-materials-collection",
                "item_type": "document",
                "file_format": "ZIP",
            },
        ]

        for i, lib_item in enumerate(library_data[:count]):
            library_item, created = LibraryItem.objects.get_or_create(
                slug=lib_item["slug"],
                defaults={
                    "title": lib_item["title"],
                    "content": f'This {lib_item["item_type"]} provides comprehensive information and guidance on important topics.',
                    "description": f"A valuable resource for researchers and practitioners.",
                    "excerpt": f'Essential {lib_item["item_type"]} for our community.',
                    "item_type": lib_item["item_type"],
                    "file_format": lib_item["file_format"],
                    "file_size": f"{random.randint(1, 10)} MB",
                    "file_url": f'/media/library/{lib_item["slug"]}.{lib_item["file_format"].lower()}',
                    "access_level": "public",
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
                library_item.tags.set(random.sample(tags, random.randint(1, 3)))
                self.stdout.write(f"Created library item: {library_item.title}")

        # Create members
        member_data = [
            {
                "first_name": "Dr. Sarah",
                "last_name": "Johnson",
                "job_title": "Research Director",
                "department": "Research & Development",
            },
            {
                "first_name": "Prof. Michael",
                "last_name": "Chen",
                "job_title": "Senior Researcher",
                "department": "Environmental Science",
            },
            {
                "first_name": "Dr. Emily",
                "last_name": "Rodriguez",
                "job_title": "Policy Analyst",
                "department": "Policy & Strategy",
            },
            {
                "first_name": "Alex",
                "last_name": "Thompson",
                "job_title": "Communications Manager",
                "department": "Communications",
            },
            {
                "first_name": "Dr. Lisa",
                "last_name": "Wang",
                "job_title": "Technology Lead",
                "department": "Innovation & Technology",
            },
        ]

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
                    "biography": f'{member_item["first_name"]} {member_item["last_name"]} is a dedicated professional with extensive experience in {member_item["department"].lower()}.',
                    "description": f'Professional profile for {member_item["first_name"]} {member_item["last_name"]}',
                    "excerpt": f'{member_item["job_title"]} at {member_item["department"]}',
                    "member_type": "staff",
                    "is_current": True,
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
                member.tags.set(random.sample(tags, random.randint(1, 2)))
                self.stdout.write(f"Created member: {member.get_full_name()}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully created sample content with {count} objects of each type!"
            )
        )
