from unittest import TestCase

from utils.cache import clear_project_cache


class FakeRedisClient:
    def __init__(self):
        self.deleted = []

    def scan_iter(self, *, match, count):
        assert match == "eceee_v4:1:*"
        assert count == 500
        return iter((b"eceee_v4:1:first", b"eceee_v4:1:second"))

    def delete(self, *keys):
        self.deleted.extend(keys)


class FakeRedisCacheClient:
    def __init__(self, client):
        self.client = client

    def get_client(self, key, *, write):
        assert key is None
        assert write is True
        return self.client


class FakeRedisCache:
    def __init__(self):
        self.client = FakeRedisClient()
        self._cache = FakeRedisCacheClient(self.client)

    def make_key(self, key):
        return f"eceee_v4:1:{key}"


class ClearProjectCacheTests(TestCase):
    def test_deletes_only_keys_matching_the_configured_cache_prefix(self):
        backend = FakeRedisCache()

        deleted = clear_project_cache(backend)

        self.assertEqual(deleted, 2)
        self.assertEqual(
            backend.client.deleted,
            [b"eceee_v4:1:first", b"eceee_v4:1:second"],
        )
