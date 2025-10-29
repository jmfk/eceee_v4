"""Tests for slug uniqueness enforcement with auto-rename."""

from django.test import TestCase
from django.contrib.auth.models import User
from ..models import WebPage


class SlugUniquenessTests(TestCase):
    """Test slug uniqueness within same parent"""

    def setUp(self):
        """Create test user and root page"""
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.root_page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_slug_unique_within_parent(self):
        """Test that slugs are unique within the same parent"""
        # Create first child page
        child1 = WebPage.objects.create(
            title="About Us",
            slug="about",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.assertEqual(child1.slug, "about")

        # Create second child with same slug - should auto-rename
        child2 = WebPage(
            title="About Company",
            slug="about",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )
        slug_info = child2.ensure_unique_slug()
        child2.save()

        self.assertEqual(child2.slug, "about-2")
        self.assertTrue(slug_info["modified"])
        self.assertEqual(slug_info["original_slug"], "about")
        self.assertEqual(slug_info["new_slug"], "about-2")

    def test_slug_auto_increment(self):
        """Test that slug suffix increments correctly"""
        # Create pages with same slug
        WebPage.objects.create(
            title="Contact 1",
            slug="contact",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Second page
        page2 = WebPage(
            title="Contact 2",
            slug="contact",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )
        page2.ensure_unique_slug()
        page2.save()
        self.assertEqual(page2.slug, "contact-2")

        # Third page
        page3 = WebPage(
            title="Contact 3",
            slug="contact",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )
        page3.ensure_unique_slug()
        page3.save()
        self.assertEqual(page3.slug, "contact-3")

        # Fourth page
        page4 = WebPage(
            title="Contact 4",
            slug="contact",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )
        page4.ensure_unique_slug()
        page4.save()
        self.assertEqual(page4.slug, "contact-4")

    def test_different_parents_same_slug(self):
        """Test that same slugs are allowed under different parents"""
        # Create another root page
        root2 = WebPage.objects.create(
            title="Root 2",
            slug="root2",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create child under first root
        child1 = WebPage.objects.create(
            title="Services",
            slug="services",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create child with same slug under second root - should work
        child2 = WebPage(
            title="Services",
            slug="services",
            parent=root2,
            created_by=self.user,
            last_modified_by=self.user,
        )
        slug_info = child2.ensure_unique_slug()
        child2.save()

        self.assertEqual(child2.slug, "services")
        self.assertFalse(slug_info["modified"])

    def test_update_preserves_slug_if_unique(self):
        """Test that updating a page preserves its slug if still unique"""
        page = WebPage.objects.create(
            title="Products",
            slug="products",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Update title but keep slug
        page.title = "Our Products"
        slug_info = page.ensure_unique_slug()
        page.save()

        self.assertEqual(page.slug, "products")
        self.assertFalse(slug_info["modified"])

    def test_update_with_slug_conflict(self):
        """Test that updating slug to conflicting value auto-renames"""
        page1 = WebPage.objects.create(
            title="Team",
            slug="team",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        page2 = WebPage.objects.create(
            title="Staff",
            slug="staff",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Try to change page2 slug to 'team'
        page2.slug = "team"
        slug_info = page2.ensure_unique_slug()
        page2.save()

        self.assertEqual(page2.slug, "team-2")
        self.assertTrue(slug_info["modified"])

    def test_null_slug_handling(self):
        """Test that null/empty slugs are handled correctly"""
        page = WebPage(
            title="No Slug",
            slug=None,
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )
        slug_info = page.ensure_unique_slug()

        self.assertIsNone(page.slug)
        self.assertFalse(slug_info["modified"])

    def test_error_page_slug_uniqueness_still_works(self):
        """Test that error page validation still works with auto-rename"""
        # Error pages have special validation in clean()
        # Create first 404 page
        page1 = WebPage.objects.create(
            title="Error 404",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Try to create another 404 - should auto-rename
        page2 = WebPage(
            title="Another 404",
            slug="404",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )
        slug_info = page2.ensure_unique_slug()
        page2.save()

        # Should be renamed to 404-2
        self.assertEqual(page2.slug, "404-2")
        self.assertTrue(slug_info["modified"])

    def test_root_pages_different_hostnames(self):
        """Test that root pages (no parent) can have same slug if different hostnames"""
        # Root pages with hostnames should still enforce uniqueness
        root1 = WebPage.objects.create(
            title="Root 1",
            slug="index",
            hostnames=["site1.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Second root with same slug but different hostname
        root2 = WebPage(
            title="Root 2",
            slug="index",
            hostnames=["site2.com"],
            created_by=self.user,
            last_modified_by=self.user,
        )
        slug_info = root2.ensure_unique_slug()
        root2.save()

        # Should be renamed even with different hostnames (since parent is None for both)
        self.assertEqual(root2.slug, "index-2")
        self.assertTrue(slug_info["modified"])

    def test_soft_deleted_pages_dont_conflict(self):
        """Test that soft-deleted pages don't cause slug conflicts"""
        # Create and soft-delete a page
        page1 = WebPage.objects.create(
            title="Careers",
            slug="careers",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )
        page1.is_deleted = True
        page1.save()

        # Create new page with same slug - should work without rename
        page2 = WebPage(
            title="New Careers",
            slug="careers",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )
        slug_info = page2.ensure_unique_slug()
        page2.save()

        self.assertEqual(page2.slug, "careers")
        self.assertFalse(slug_info["modified"])


class SlugUniquenessHelperMethodsTests(TestCase):
    """Test the helper methods for slug uniqueness"""

    def setUp(self):
        """Create test user and pages"""
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.root_page = WebPage.objects.create(
            title="Root",
            slug="root",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_slug_exists_for_parent(self):
        """Test _slug_exists_for_parent helper method"""
        WebPage.objects.create(
            title="FAQ",
            slug="faq",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Test with new page
        new_page = WebPage(
            title="New Page",
            slug="faq",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Should find existing slug
        self.assertTrue(new_page._slug_exists_for_parent("faq", self.root_page))
        # Should not find non-existent slug
        self.assertFalse(new_page._slug_exists_for_parent("blog", self.root_page))

    def test_get_unique_slug(self):
        """Test _get_unique_slug helper method"""
        WebPage.objects.create(
            title="News",
            slug="news",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        new_page = WebPage(
            title="News 2",
            slug="news",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Get unique slug
        unique_slug, was_modified = new_page._get_unique_slug("news", self.root_page)

        self.assertEqual(unique_slug, "news-2")
        self.assertTrue(was_modified)

    def test_ensure_unique_slug_return_value(self):
        """Test ensure_unique_slug return value structure"""
        page = WebPage(
            title="Test",
            slug="test",
            parent=self.root_page,
            created_by=self.user,
            last_modified_by=self.user,
        )

        slug_info = page.ensure_unique_slug()

        # Check return value structure
        self.assertIn("modified", slug_info)
        self.assertIn("original_slug", slug_info)
        self.assertFalse(slug_info["modified"])
        self.assertIsNone(slug_info["original_slug"])
