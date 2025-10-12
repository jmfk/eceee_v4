"""
Tests for the Content app
"""

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient

from content.models import Category, Tag

# News, Event, LibraryItem, Member models have been deprecated


class ContentModelsTest(TestCase):
    """Test content models functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_news_model_creation(self):
        """Test News model creation and basic functionality"""
        news = News.objects.create(
            title="Test News",
            slug="test-news",
            description="Test description",
            content="Test content",
            author="Test Author",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertEqual(news.title, "Test News")
        self.assertEqual(news.slug, "test-news")
        self.assertTrue(news.is_published)
        self.assertEqual(str(news), "Test News")

    def test_event_model_creation(self):
        """Test Event model creation and basic functionality"""
        from datetime import datetime, timezone

        event = Event.objects.create(
            title="Test Event",
            slug="test-event",
            description="Test event description",
            start_date=datetime.now(timezone.utc),
            end_date=datetime.now(timezone.utc),
            location_name="Test Location",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertEqual(event.title, "Test Event")
        self.assertEqual(event.location_name, "Test Location")
        self.assertTrue(event.is_published)
        self.assertEqual(str(event), "Test Event")

    def test_library_item_model_creation(self):
        """Test LibraryItem model creation and basic functionality"""
        library_item = LibraryItem.objects.create(
            title="Test Library Item",
            slug="test-library-item",
            description="Test library item description",
            content="Test content",
            item_type="document",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertEqual(library_item.title, "Test Library Item")
        self.assertEqual(library_item.item_type, "document")
        self.assertTrue(library_item.is_published)
        self.assertEqual(str(library_item), "Test Library Item")

    def test_member_model_creation(self):
        """Test Member model creation and basic functionality"""
        member = Member.objects.create(
            title="Test Member",
            slug="test-member",
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            phone="123-456-7890",
            job_title="Developer",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertEqual(member.title, "Test Member")
        self.assertEqual(member.first_name, "John")
        self.assertEqual(member.email, "john@example.com")
        self.assertTrue(member.is_published)
        self.assertEqual(str(member), "Test Member")

    def test_category_model(self):
        """Test Category model functionality"""
        category = Category.objects.create(name="Test Category", slug="test-category")

        self.assertEqual(category.name, "Test Category")
        self.assertEqual(category.slug, "test-category")
        self.assertEqual(str(category), "Test Category")

    def test_tag_model(self):
        """Test Tag model functionality"""
        tag = Tag.objects.create(name="Test Tag", slug="test-tag")

        self.assertEqual(tag.name, "Test Tag")
        self.assertEqual(tag.slug, "test-tag")
        self.assertEqual(str(tag), "Test Tag")


class ContentAPITest(APITestCase):
    """Test Content API endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

    def test_news_api_creation(self):
        """Test News API creation"""
        data = {
            "title": "Test News API",
            "slug": "test-news-api",
            "description": "Test description",
            "content": "Test content",
            "author": "Test Author",
            "is_published": True,
        }

        response = self.client.post("/api/v1/content/news/", data, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "Test News API")

    def test_news_api_list(self):
        """Test News API list endpoint"""
        News.objects.create(
            title="Test News",
            slug="test-news",
            description="Test description",
            content="Test content",
            author="Test Author",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        response = self.client.get("/api/v1/content/news/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
