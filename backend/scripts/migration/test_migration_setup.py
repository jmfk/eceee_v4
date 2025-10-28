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

    try:
        from scripts.migration.base_migrator import BaseMigrator

    except ImportError as e:
        logger.error(f"❌ Failed to import BaseMigrator: {e}")
        return False

    try:
        from scripts.migration.migrate_tags import TagMigrator

    except ImportError as e:
        logger.error(f"❌ Failed to import TagMigrator: {e}")
        return False

    try:
        from content.models import Tag, Namespace

    except ImportError as e:
        logger.error(f"❌ Failed to import models: {e}")
        return False

    return True


def test_namespace():
    """Test namespace creation/retrieval"""

    try:
        from content.models import Namespace

        # Check if default namespace exists
        default_ns = Namespace.get_default()

        if default_ns:
        else:
            logger.warning("⚠️  No default namespace found")

        return True
    except Exception as e:
        logger.error(f"❌ Namespace test failed: {e}")
        return False


def test_tag_creation():
    """Test tag creation functionality"""

    try:
        from scripts.migration.base_migrator import BaseMigrator
        from django.db import transaction

        migrator = BaseMigrator(dry_run=True)

        # Test in a transaction that we'll roll back
        with transaction.atomic():
            # Test namespace creation
            namespace = migrator.get_or_create_default_namespace()

            # Test tag creation
            tag1, created1 = migrator.get_or_create_tag("Test Tag 1", namespace)
            if tag1 and created1:
            elif tag1:

            # Test duplicate detection
            tag2, created2 = migrator.get_or_create_tag("Test Tag 1", namespace)
            if tag2 and not created2:

            # Test normalization
            tag3, created3 = migrator.get_or_create_tag("  test tag 1  ", namespace)
            if tag3 and not created3:

            # Rollback the transaction
            raise Exception("Intentional rollback for test")

    except Exception as e:
        if str(e) == "Intentional rollback for test":
            return True
        else:
            logger.error(f"❌ Tag creation test failed: {e}")
            return False


def test_migration_user():
    """Test migration user creation"""

    try:
        from scripts.migration.base_migrator import BaseMigrator
        from django.contrib.auth.models import User

        migrator = BaseMigrator()
        user = migrator.get_migration_user()


        return True
    except Exception as e:
        logger.error(f"❌ Migration user test failed: {e}")
        return False


def test_stats_tracking():
    """Test statistics tracking"""

    try:
        from scripts.migration.base_migrator import BaseMigrator

        migrator = BaseMigrator()

        # Update some stats
        migrator.stats["created"] = 10
        migrator.stats["skipped"] = 5
        migrator.stats["errors"] = 0

        # Test logging
        migrator.log_stats()

        return True
    except Exception as e:
        logger.error(f"❌ Statistics test failed: {e}")
        return False


def run_all_tests():
    """Run all tests"""

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

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"


    if passed == total:
    else:
        logger.warning(f"\n⚠️  {total - passed} test(s) failed. Review errors above.")

    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
else:
    # If imported in Django shell, run automatically
    run_all_tests()
