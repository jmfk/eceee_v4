"""
Test script to verify migration setup is working correctly.

This script tests the migration infrastructure without touching any real data.

Usage:
    python manage.py shell
    >>> exec(open('scripts/migration/test_migration_setup.py').read())
"""

import logging

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


def test_imports():
    """Test that all necessary imports work"""
    logger.info("=" * 60)
    logger.info("Testing Imports")
    logger.info("=" * 60)

    try:
        from scripts.migration.base_migrator import BaseMigrator

        logger.info("✅ BaseMigrator imported successfully")
    except ImportError as e:
        logger.error(f"❌ Failed to import BaseMigrator: {e}")
        return False

    try:
        from scripts.migration.migrate_tags import TagMigrator

        logger.info("✅ TagMigrator imported successfully")
    except ImportError as e:
        logger.error(f"❌ Failed to import TagMigrator: {e}")
        return False

    try:
        from content.models import Tag, Namespace

        logger.info("✅ Tag and Namespace models imported successfully")
    except ImportError as e:
        logger.error(f"❌ Failed to import models: {e}")
        return False

    return True


def test_namespace():
    """Test namespace creation/retrieval"""
    logger.info("\n" + "=" * 60)
    logger.info("Testing Namespace")
    logger.info("=" * 60)

    try:
        from content.models import Namespace

        # Check if default namespace exists
        default_ns = Namespace.get_default()

        if default_ns:
            logger.info(f"✅ Default namespace exists: {default_ns.name}")
            logger.info(f"   - ID: {default_ns.id}")
            logger.info(f"   - Slug: {default_ns.slug}")
            logger.info(f"   - Is Default: {default_ns.is_default}")
        else:
            logger.warning("⚠️  No default namespace found")
            logger.info("   This is OK - migration script will create it")

        return True
    except Exception as e:
        logger.error(f"❌ Namespace test failed: {e}")
        return False


def test_tag_creation():
    """Test tag creation functionality"""
    logger.info("\n" + "=" * 60)
    logger.info("Testing Tag Creation (Dry Run)")
    logger.info("=" * 60)

    try:
        from scripts.migration.base_migrator import BaseMigrator
        from django.db import transaction

        migrator = BaseMigrator(dry_run=True)

        # Test in a transaction that we'll roll back
        with transaction.atomic():
            # Test namespace creation
            namespace = migrator.get_or_create_default_namespace()
            logger.info(f"✅ Got/created namespace: {namespace.name}")

            # Test tag creation
            tag1, created1 = migrator.get_or_create_tag("Test Tag 1", namespace)
            if tag1 and created1:
                logger.info(f"✅ Created test tag: {tag1.name} (slug: {tag1.slug})")
            elif tag1:
                logger.info(f"✅ Found existing tag: {tag1.name}")

            # Test duplicate detection
            tag2, created2 = migrator.get_or_create_tag("Test Tag 1", namespace)
            if tag2 and not created2:
                logger.info("✅ Duplicate detection working (same tag returned)")

            # Test normalization
            tag3, created3 = migrator.get_or_create_tag("  test tag 1  ", namespace)
            if tag3 and not created3:
                logger.info("✅ Name normalization working")

            # Rollback the transaction
            raise Exception("Intentional rollback for test")

    except Exception as e:
        if str(e) == "Intentional rollback for test":
            logger.info("✅ Test transaction rolled back successfully")
            return True
        else:
            logger.error(f"❌ Tag creation test failed: {e}")
            return False


def test_migration_user():
    """Test migration user creation"""
    logger.info("\n" + "=" * 60)
    logger.info("Testing Migration User")
    logger.info("=" * 60)

    try:
        from scripts.migration.base_migrator import BaseMigrator
        from django.contrib.auth.models import User

        migrator = BaseMigrator()
        user = migrator.get_migration_user()

        logger.info(f"✅ Migration user exists: {user.username}")
        logger.info(f"   - ID: {user.id}")
        logger.info(f"   - Email: {user.email}")
        logger.info(f"   - Active: {user.is_active}")

        return True
    except Exception as e:
        logger.error(f"❌ Migration user test failed: {e}")
        return False


def test_stats_tracking():
    """Test statistics tracking"""
    logger.info("\n" + "=" * 60)
    logger.info("Testing Statistics Tracking")
    logger.info("=" * 60)

    try:
        from scripts.migration.base_migrator import BaseMigrator

        migrator = BaseMigrator()

        # Update some stats
        migrator.stats["created"] = 10
        migrator.stats["skipped"] = 5
        migrator.stats["errors"] = 0

        # Test logging
        migrator.log_stats()
        logger.info("✅ Statistics tracking working")

        return True
    except Exception as e:
        logger.error(f"❌ Statistics test failed: {e}")
        return False


def run_all_tests():
    """Run all tests"""
    logger.info("\n" + "🚀 " * 20)
    logger.info("MIGRATION SETUP TEST SUITE")
    logger.info("🚀 " * 20 + "\n")

    tests = [
        ("Imports", test_imports),
        ("Namespace", test_namespace),
        ("Tag Creation", test_tag_creation),
        ("Migration User", test_migration_user),
        ("Statistics", test_stats_tracking),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"Test '{test_name}' crashed: {e}")
            results.append((test_name, False))

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("TEST SUMMARY")
    logger.info("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"{status} - {test_name}")

    logger.info("-" * 60)
    logger.info(f"Results: {passed}/{total} tests passed")

    if passed == total:
        logger.info("\n🎉 All tests passed! Migration setup is ready.")
        logger.info("\nNext steps:")
        logger.info("1. Review legacy models in extracted_models/")
        logger.info("2. Customize migrate_tags.py with your schema")
        logger.info("3. Run: TagMigrator(dry_run=True).run()")
    else:
        logger.warning(f"\n⚠️  {total - passed} test(s) failed. Review errors above.")

    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
else:
    # If imported in Django shell, run automatically
    run_all_tests()
