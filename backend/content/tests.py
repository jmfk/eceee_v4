"""
Comprehensive tests for the Content app and Object Publishing System
"""

from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from content.models import News, Event, LibraryItem, Member, Category, Tag
from webpages.models import WebPage
from webpages.object_publishing import (
    ObjectTypeRegistry,
    ObjectContentFormatter,
    ObjectPublishingService,
    NewsContentTransformer,
    EventContentTransformer,
    LibraryItemContentTransformer,
    MemberContentTransformer,
    ContentTransformerFactory,
    BaseContentTransformer,
)


class ContentModelsTest(TestCase):
    """Test content models functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.category = Category.objects.create(
            name="Test Category", slug="test-category"
        )
        self.tag = Tag.objects.create(name="Test Tag", slug="test-tag")

    def test_news_creation(self):
        """Test News model creation and methods"""
        news = News.objects.create(
            title="Test News",
            slug="test-news",
            description="Test description",
            content="Test content",
            author="Test Author",
            is_published=True,
            category=self.category,
            created_by=self.user,
            last_modified_by=self.user,
        )
        news.tags.add(self.tag)

        self.assertEqual(str(news), "Test News")
        self.assertEqual(news.get_absolute_url(), "/news/test-news/")
        self.assertTrue(news.is_published)
        self.assertEqual(news.category, self.category)
        self.assertIn(self.tag, news.tags.all())

    def test_event_creation(self):
        """Test Event model creation and methods"""
        from datetime import datetime, timedelta

        start_date = datetime.now()
        end_date = start_date + timedelta(hours=2)

        event = Event.objects.create(
            title="Test Event",
            slug="test-event",
            description="Test event description",
            start_date=start_date,
            end_date=end_date,
            location_name="Test Location",
            organizer_name="Test Organizer",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertEqual(str(event), "Test Event")
        self.assertEqual(event.get_absolute_url(), "/events/test-event/")
        self.assertEqual(event.location_name, "Test Location")

    def test_library_item_creation(self):
        """Test LibraryItem model creation and methods"""
        library_item = LibraryItem.objects.create(
            title="Test Document",
            slug="test-document",
            description="Test document description",
            item_type="document",
            file_url="https://example.com/doc.pdf",
            access_level="public",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertEqual(str(library_item), "Test Document")
        self.assertEqual(library_item.get_absolute_url(), "/library/test-document/")
        self.assertEqual(library_item.item_type, "document")

    def test_member_creation(self):
        """Test Member model creation and methods"""
        member = Member.objects.create(
            title="Dr. John Doe",
            slug="john-doe",
            first_name="John",
            last_name="Doe",
            job_title="Senior Researcher",
            department="Research",
            member_type="staff",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertEqual(str(member), "Dr. John Doe")
        self.assertEqual(member.get_absolute_url(), "/members/john-doe/")
        self.assertEqual(member.full_name, "John Doe")


class ObjectTypeRegistryTest(TestCase):
    """Test ObjectTypeRegistry functionality"""

    def test_registry_registration(self):
        """Test registering and retrieving object types"""
        # Test that content models are auto-registered
        self.assertTrue(ObjectTypeRegistry.is_registered("news"))
        self.assertTrue(ObjectTypeRegistry.is_registered("event"))
        self.assertTrue(ObjectTypeRegistry.is_registered("libraryitem"))
        self.assertTrue(ObjectTypeRegistry.is_registered("member"))

        # Test getting models
        news_model = ObjectTypeRegistry.get_model("news")
        self.assertEqual(news_model, News)

        # Test unknown type
        self.assertFalse(ObjectTypeRegistry.is_registered("unknown"))
        self.assertIsNone(ObjectTypeRegistry.get_model("unknown"))


class ContentTransformersTest(TestCase):
    """Test content transformers functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.category = Category.objects.create(
            name="Test Category", slug="test-category"
        )

        self.news = News.objects.create(
            title="Test News",
            slug="test-news",
            description="Test description",
            content="Test content",
            author="Test Author",
            priority="high",
            category=self.category,
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_news_transformer(self):
        """Test NewsContentTransformer"""
        transformer = NewsContentTransformer()
        content = transformer.transform(self.news)

        self.assertEqual(content["object_type"], "news")
        self.assertEqual(content["title"], "Test News")
        self.assertEqual(content["author"], "Test Author")
        self.assertEqual(content["priority"], "high")
        self.assertEqual(content["category"], self.category)

    def test_content_transformer_factory(self):
        """Test ContentTransformerFactory"""
        transformer = ContentTransformerFactory.create("news")
        self.assertIsInstance(transformer, NewsContentTransformer)

        transformer = ContentTransformerFactory.create("unknown")
        self.assertIsInstance(transformer, BaseContentTransformer)

    def test_object_content_formatter(self):
        """Test ObjectContentFormatter"""
        formatter = ObjectContentFormatter(self.news, "news")
        content = formatter.format()

        self.assertEqual(content["object_type"], "news")
        self.assertEqual(content["title"], "Test News")
        self.assertEqual(content["author"], "Test Author")


class ObjectPublishingServiceTest(TestCase):
    """Test ObjectPublishingService functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.news = News.objects.create(
            title="Test News",
            slug="test-news",
            description="Test description",
            content="Test content",
            author="Test Author",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.service = ObjectPublishingService(self.page)

    def test_link_object_success(self):
        """Test successful object linking"""
        result = self.service.link_object("news", self.news.id, self.user)

        self.assertTrue(result)
        self.assertEqual(self.page.linked_object_type, "news")
        self.assertEqual(self.page.linked_object_id, self.news.id)
        self.assertEqual(self.page.title, "Test News")  # Should update from object

    def test_link_object_invalid_type(self):
        """Test linking with invalid object type"""
        with self.assertRaises(ValueError):
            self.service.link_object("invalid", 1, self.user)

    def test_link_object_nonexistent(self):
        """Test linking with nonexistent object"""
        with self.assertRaises(ValueError):
            self.service.link_object("news", 99999, self.user)

    def test_unlink_object(self):
        """Test object unlinking"""
        # First link an object
        self.service.link_object("news", self.news.id, self.user)

        # Then unlink it
        result = self.service.unlink_object(self.user)

        self.assertTrue(result)
        self.assertEqual(self.page.linked_object_type, "")
        self.assertIsNone(self.page.linked_object_id)

    def test_get_linked_object(self):
        """Test getting linked object"""
        # No object linked initially
        self.assertIsNone(self.service.get_linked_object())

        # Link an object
        self.service.link_object("news", self.news.id, self.user)

        # Should return the linked object
        linked = self.service.get_linked_object()
        self.assertEqual(linked, self.news)

    def test_get_formatted_content(self):
        """Test getting formatted content"""
        # No content when no object linked
        self.assertIsNone(self.service.get_formatted_content())

        # Link an object
        self.service.link_object("news", self.news.id, self.user)

        # Should return formatted content
        content = self.service.get_formatted_content()
        self.assertIsNotNone(content)
        self.assertEqual(content["title"], "Test News")
        self.assertEqual(content["object_type"], "news")

    def test_sync_with_object(self):
        """Test syncing page with object"""
        # Link an object first
        self.service.link_object("news", self.news.id, self.user)

        # Change page title
        self.page.title = "Different Title"
        self.page.save()

        # Sync should update page with object data
        result = self.service.sync_with_object(self.user)

        self.assertTrue(result)
        self.page.refresh_from_db()
        self.assertEqual(self.page.title, "Test News")


class WebPageObjectPublishingTest(TestCase):
    """Test WebPage model object publishing methods"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.news = News.objects.create(
            title="Test News",
            slug="test-news",
            description="Test description",
            content="Test content",
            author="Test Author",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_is_object_page(self):
        """Test is_object_page method"""
        self.assertFalse(self.page.is_object_page())

        self.page.linked_object_type = "news"
        self.page.linked_object_id = self.news.id
        self.page.save()

        self.assertTrue(self.page.is_object_page())

    def test_link_to_object(self):
        """Test link_to_object method"""
        result = self.page.link_to_object("news", self.news.id, self.user)

        self.assertTrue(result)
        self.assertEqual(self.page.linked_object_type, "news")
        self.assertEqual(self.page.linked_object_id, self.news.id)

    def test_unlink_object(self):
        """Test unlink_object method"""
        # First link an object
        self.page.link_to_object("news", self.news.id, self.user)

        # Then unlink it
        result = self.page.unlink_object(self.user)

        self.assertTrue(result)
        self.assertEqual(self.page.linked_object_type, "")
        self.assertIsNone(self.page.linked_object_id)

    def test_get_linked_object(self):
        """Test get_linked_object method"""
        self.assertIsNone(self.page.get_linked_object())

        self.page.link_to_object("news", self.news.id, self.user)
        linked = self.page.get_linked_object()

        self.assertEqual(linked, self.news)

    def test_get_object_content(self):
        """Test get_object_content method"""
        self.assertIsNone(self.page.get_object_content())

        self.page.link_to_object("news", self.news.id, self.user)
        content = self.page.get_object_content()

        self.assertIsNotNone(content)
        self.assertEqual(content["title"], "Test News")

    def test_sync_with_object(self):
        """Test sync_with_object method"""
        self.page.link_to_object("news", self.news.id, self.user)

        # Change page title
        self.page.title = "Different Title"
        self.page.save()

        # Sync should update page
        result = self.page.sync_with_object(self.user)

        self.assertTrue(result)
        self.page.refresh_from_db()
        self.assertEqual(self.page.title, "Test News")


class ContentAPITest(APITestCase):
    """Test Content API endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.category = Category.objects.create(
            name="Test Category", slug="test-category"
        )

        self.news = News.objects.create(
            title="Test News",
            slug="test-news",
            description="Test description",
            content="Test content",
            author="Test Author",
            category=self.category,
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_news_list_api(self):
        """Test news list API endpoint"""
        url = reverse("content:news-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Test News")

    def test_news_detail_api(self):
        """Test news detail API endpoint"""
        url = reverse("content:news-detail", kwargs={"pk": self.news.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Test News")

    def test_search_filtering(self):
        """Test search functionality"""
        url = reverse("content:news-list")
        response = self.client.get(url, {"search": "Test"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

        response = self.client.get(url, {"search": "NonExistent"})
        self.assertEqual(len(response.data["results"]), 0)

    def test_category_filtering(self):
        """Test category filtering"""
        url = reverse("content:news-list")
        response = self.client.get(url, {"category": self.category.slug})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)


class WebPageObjectAPITest(APITestCase):
    """Test WebPage object publishing API endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.news = News.objects.create(
            title="Test News",
            slug="test-news",
            description="Test description",
            content="Test content",
            author="Test Author",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_link_object_api(self):
        """Test link object API endpoint"""
        url = reverse("webpages:webpage-link-object", kwargs={"pk": self.page.pk})
        data = {"object_type": "news", "object_id": self.news.id}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.page.refresh_from_db()
        self.assertEqual(self.page.linked_object_type, "news")
        self.assertEqual(self.page.linked_object_id, self.news.id)

    def test_unlink_object_api(self):
        """Test unlink object API endpoint"""
        # First link an object
        self.page.link_to_object("news", self.news.id, self.user)

        url = reverse("webpages:webpage-unlink-object", kwargs={"pk": self.page.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.page.refresh_from_db()
        self.assertEqual(self.page.linked_object_type, "")
        self.assertIsNone(self.page.linked_object_id)

    def test_sync_object_api(self):
        """Test sync object API endpoint"""
        # First link an object
        self.page.link_to_object("news", self.news.id, self.user)

        # Change page title
        self.page.title = "Different Title"
        self.page.save()

        url = reverse("webpages:webpage-sync-object", kwargs={"pk": self.page.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.page.refresh_from_db()
        self.assertEqual(self.page.title, "Test News")


class ObjectPublishingIntegrationTest(TestCase):
    """Integration tests for the complete object publishing workflow"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            publication_status="published",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create various content objects
        self.news = News.objects.create(
            title="Test News",
            slug="test-news",
            description="News description",
            content="News content",
            author="News Author",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

        from datetime import datetime, timedelta

        self.event = Event.objects.create(
            title="Test Event",
            slug="test-event",
            description="Event description",
            start_date=datetime.now(),
            end_date=datetime.now() + timedelta(hours=2),
            location_name="Event Location",
            is_published=True,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_complete_publishing_workflow(self):
        """Test the complete object publishing workflow"""
        # 1. Initially no object linked
        self.assertFalse(self.page.is_object_page())
        self.assertIsNone(self.page.get_linked_object())

        # 2. Link a news object
        result = self.page.link_to_object("news", self.news.id, self.user)
        self.assertTrue(result)
        self.assertTrue(self.page.is_object_page())

        # 3. Verify object content is accessible
        content = self.page.get_object_content()
        self.assertIsNotNone(content)
        self.assertEqual(content["title"], "Test News")
        self.assertEqual(content["object_type"], "news")

        # 4. Sync page with object
        result = self.page.sync_with_object(self.user)
        self.assertTrue(result)

        # 5. Switch to different object type
        self.page.unlink_object(self.user)
        self.assertFalse(self.page.is_object_page())

        # 6. Link an event
        result = self.page.link_to_object("event", self.event.id, self.user)
        self.assertTrue(result)

        content = self.page.get_object_content()
        self.assertEqual(content["object_type"], "event")
        self.assertEqual(content["title"], "Test Event")

    def test_error_handling(self):
        """Test error handling in object publishing"""
        # Test invalid object type
        with self.assertRaises(ValueError):
            self.page.link_to_object("invalid_type", 1, self.user)

        # Test nonexistent object
        with self.assertRaises(ValueError):
            self.page.link_to_object("news", 99999, self.user)

        # Test sync without linked object
        result = self.page.sync_with_object(self.user)
        self.assertFalse(result)  # Should return False, not raise error
