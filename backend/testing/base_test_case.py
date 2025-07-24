"""
Enhanced base test case for comprehensive testing framework
"""

from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from rest_framework.test import APITestCase
from rest_framework import status
import time
import json
from contextlib import contextmanager
from unittest.mock import patch
from typing import Dict, Any, Optional, List

User = get_user_model()


class BaseTestCase(TestCase):
    """Enhanced base test case with common utilities"""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.start_time = time.time()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        elapsed_time = time.time() - cls.start_time
        print(f"\n{cls.__name__} completed in {elapsed_time:.3f}s")

    def setUp(self):
        super().setUp()
        # Clear cache between tests
        cache.clear()

        # Create standard test users
        self.superuser = User.objects.create_superuser(
            username="test_superuser",
            email="superuser@test.com",
            password="testpass123",
        )

        self.user = User.objects.create_user(
            username="test_user", email="user@test.com", password="testpass123"
        )

        self.staff_user = User.objects.create_user(
            username="test_staff",
            email="staff@test.com",
            password="testpass123",
            is_staff=True,
        )

    def tearDown(self):
        super().tearDown()
        # Clean up any test data that might leak between tests
        cache.clear()

    @contextmanager
    def assert_query_count(self, expected_count: int, tolerance: int = 0):
        """Assert the number of database queries"""
        with self.assertNumQueries(expected_count + tolerance):
            yield

    @contextmanager
    def assert_max_query_count(self, max_count: int):
        """Assert maximum number of database queries"""
        with self.assertNumQueries(lambda count: count <= max_count):
            yield

    def assert_performance_under(self, max_seconds: float):
        """Context manager to assert code executes under time limit"""

        @contextmanager
        def _performance_check():
            start = time.time()
            yield
            elapsed = time.time() - start
            self.assertLess(
                elapsed,
                max_seconds,
                f"Code took {elapsed:.3f}s, expected under {max_seconds}s",
            )

        return _performance_check()

    def assert_memory_usage_under(self, max_mb: float):
        """Assert memory usage stays under limit (requires psutil)"""
        try:
            import psutil
            import os

            @contextmanager
            def _memory_check():
                process = psutil.Process(os.getpid())
                initial_memory = process.memory_info().rss / 1024 / 1024  # MB
                yield
                final_memory = process.memory_info().rss / 1024 / 1024  # MB
                memory_used = final_memory - initial_memory
                self.assertLess(
                    memory_used,
                    max_mb,
                    f"Memory usage: {memory_used:.2f}MB, expected under {max_mb}MB",
                )

            return _memory_check()
        except ImportError:

            @contextmanager
            def _mock_memory_check():
                print("Warning: psutil not available, skipping memory check")
                yield

            return _mock_memory_check()

    def create_test_data(self, model_class, count: int = 1, **defaults):
        """Create test data with optional defaults"""
        objects = []
        for i in range(count):
            data = defaults.copy()
            # Add index to unique fields if not specified
            if "title" in data and count > 1:
                data["title"] = f"{data['title']} {i+1}"
            if "slug" in data and count > 1:
                data["slug"] = f"{data['slug']}-{i+1}"
            if "name" in data and count > 1:
                data["name"] = f"{data['name']} {i+1}"

            obj = model_class.objects.create(**data)
            objects.append(obj)

        return objects[0] if count == 1 else objects

    def assert_field_validation_error(
        self, model_class, field_name: str, invalid_value, **valid_data
    ):
        """Assert that a field validation error is raised"""
        data = valid_data.copy()
        data[field_name] = invalid_value

        with self.assertRaises(Exception):  # ValidationError or IntegrityError
            model_class.objects.create(**data)

    def assert_required_field(self, model_class, field_name: str, **valid_data):
        """Assert that a field is required"""
        data = valid_data.copy()
        if field_name in data:
            del data[field_name]

        with self.assertRaises(Exception):
            model_class.objects.create(**data)


class BaseAPITestCase(APITestCase):
    """Enhanced API test case with comprehensive utilities"""

    def setUp(self):
        super().setUp()
        cache.clear()

        # Create test users
        self.superuser = User.objects.create_superuser(
            username="api_superuser",
            email="api_superuser@test.com",
            password="testpass123",
        )

        self.user = User.objects.create_user(
            username="api_user", email="api_user@test.com", password="testpass123"
        )

    def login_user(self, user: User = None):
        """Login a user for API testing"""
        if user is None:
            user = self.user
        self.client.force_authenticate(user=user)
        return user

    def logout_user(self):
        """Logout current user"""
        self.client.force_authenticate(user=None)

    def assert_api_response(
        self,
        response,
        expected_status: int = status.HTTP_200_OK,
        expected_keys: List[str] = None,
        expected_data: Dict[str, Any] = None,
    ):
        """Comprehensive API response assertion"""
        self.assertEqual(
            response.status_code,
            expected_status,
            f"Expected {expected_status}, got {response.status_code}. "
            f"Response: {response.data}",
        )

        if expected_keys:
            for key in expected_keys:
                self.assertIn(
                    key, response.data, f"Expected key '{key}' not found in response"
                )

        if expected_data:
            for key, value in expected_data.items():
                self.assertEqual(
                    response.data.get(key),
                    value,
                    f"Expected {key}={value}, got {response.data.get(key)}",
                )

    def assert_api_error(
        self,
        response,
        expected_status: int,
        expected_error_code: str = None,
        expected_error_message: str = None,
    ):
        """Assert API error response"""
        self.assertEqual(response.status_code, expected_status)

        if expected_error_code:
            self.assertEqual(response.data.get("code"), expected_error_code)

        if expected_error_message:
            self.assertIn(expected_error_message.lower(), str(response.data).lower())

    def assert_pagination_response(
        self,
        response,
        expected_count: int = None,
        has_next: bool = None,
        has_previous: bool = None,
    ):
        """Assert paginated API response structure"""
        self.assert_api_response(response)

        required_keys = ["count", "next", "previous", "results"]
        self.assert_api_response(response, expected_keys=required_keys)

        if expected_count is not None:
            self.assertEqual(len(response.data["results"]), expected_count)

        if has_next is not None:
            if has_next:
                self.assertIsNotNone(response.data["next"])
            else:
                self.assertIsNone(response.data["next"])

        if has_previous is not None:
            if has_previous:
                self.assertIsNotNone(response.data["previous"])
            else:
                self.assertIsNone(response.data["previous"])

    @contextmanager
    def assert_api_performance(self, max_seconds: float = 1.0):
        """Assert API endpoint performs under time limit"""
        start = time.time()
        yield
        elapsed = time.time() - start
        self.assertLess(
            elapsed,
            max_seconds,
            f"API call took {elapsed:.3f}s, expected under {max_seconds}s",
        )

    def bulk_create_test_data(self, model_class, count: int, **defaults):
        """Efficiently create bulk test data"""
        objects = []
        for i in range(count):
            data = defaults.copy()
            # Add index to unique fields
            for field in ["title", "name", "slug", "username", "email"]:
                if field in data:
                    data[field] = f"{data[field]}-{i+1}"
            objects.append(model_class(**data))

        return model_class.objects.bulk_create(objects)


class BaseSecurityTestCase(BaseAPITestCase):
    """Test case focused on security testing"""

    def assert_requires_authentication(self, method: str, url: str, data: Dict = None):
        """Assert endpoint requires authentication"""
        self.logout_user()

        if method.upper() == "GET":
            response = self.client.get(url)
        elif method.upper() == "POST":
            response = self.client.post(url, data=data or {})
        elif method.upper() == "PUT":
            response = self.client.put(url, data=data or {})
        elif method.upper() == "PATCH":
            response = self.client.patch(url, data=data or {})
        elif method.upper() == "DELETE":
            response = self.client.delete(url)
        else:
            raise ValueError(f"Unsupported method: {method}")

        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def assert_requires_permission(
        self, method: str, url: str, unauthorized_user: User, data: Dict = None
    ):
        """Assert endpoint requires specific permissions"""
        self.login_user(unauthorized_user)

        if method.upper() == "GET":
            response = self.client.get(url)
        elif method.upper() == "POST":
            response = self.client.post(url, data=data or {})
        elif method.upper() == "PUT":
            response = self.client.put(url, data=data or {})
        elif method.upper() == "PATCH":
            response = self.client.patch(url, data=data or {})
        elif method.upper() == "DELETE":
            response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sql_injection_protection(self, url: str, param_name: str):
        """Test SQL injection protection"""
        sql_payloads = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; INSERT INTO users (username) VALUES ('hacker'); --",
            "' UNION SELECT * FROM users --",
        ]

        for payload in sql_payloads:
            response = self.client.get(url, {param_name: payload})
            # Should not return 500 (server error) or expose sensitive data
            self.assertNotEqual(
                response.status_code,
                500,
                f"SQL injection payload caused server error: {payload}",
            )

    def test_xss_protection(self, method: str, url: str, data_field: str):
        """Test XSS protection"""
        xss_payloads = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
            "javascript:alert('xss')",
            "<svg onload=alert('xss')>",
        ]

        for payload in xss_payloads:
            data = {data_field: payload}

            if method.upper() == "POST":
                response = self.client.post(url, data=data)
            elif method.upper() == "PUT":
                response = self.client.put(url, data=data)
            elif method.upper() == "PATCH":
                response = self.client.patch(url, data=data)

            # Verify XSS payload is properly escaped in response
            if response.status_code == 200:
                response_text = str(response.content)
                self.assertNotIn(
                    "<script>",
                    response_text.lower(),
                    f"XSS payload not properly escaped: {payload}",
                )


class BasePerformanceTestCase(BaseTestCase):
    """Test case focused on performance testing"""

    def setUp(self):
        super().setUp()
        self.performance_data = {}

    def tearDown(self):
        super().tearDown()
        # Log performance data
        if self.performance_data:
            print(f"\nPerformance data for {self._testMethodName}:")
            for metric, value in self.performance_data.items():
                print(f"  {metric}: {value}")

    def benchmark_function(self, func, *args, **kwargs):
        """Benchmark a function and return timing data"""
        start = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - start

        self.performance_data[f"{func.__name__}_time"] = f"{elapsed:.3f}s"
        return result, elapsed

    def assert_performance_baseline(
        self, func, baseline_seconds: float, tolerance: float = 0.1, *args, **kwargs
    ):
        """Assert function performs within baseline +/- tolerance"""
        result, elapsed = self.benchmark_function(func, *args, **kwargs)

        min_time = baseline_seconds * (1 - tolerance)
        max_time = baseline_seconds * (1 + tolerance)

        self.assertGreaterEqual(
            elapsed, min_time, f"Function too fast: {elapsed:.3f}s < {min_time:.3f}s"
        )
        self.assertLessEqual(
            elapsed, max_time, f"Function too slow: {elapsed:.3f}s > {max_time:.3f}s"
        )

        return result


class TransactionTestCase(BaseTestCase, TransactionTestCase):
    """Enhanced transaction test case for testing with real transactions"""

    def setUp(self):
        super().setUp()
        # Transaction test cases don't use fixtures, so create data here
        with transaction.atomic():
            self.superuser = User.objects.create_superuser(
                username="txn_superuser",
                email="txn_superuser@test.com",
                password="testpass123",
            )

            self.user = User.objects.create_user(
                username="txn_user", email="txn_user@test.com", password="testpass123"
            )

    @contextmanager
    def assert_transaction_rollback(self):
        """Assert that a transaction is properly rolled back"""
        initial_count = User.objects.count()
        try:
            yield
            self.fail("Expected transaction to rollback but it didn't")
        except Exception:
            # Verify rollback occurred
            final_count = User.objects.count()
            self.assertEqual(
                initial_count, final_count, "Transaction did not properly rollback"
            )
