"""Cross-process serialization for write-mode legacy News imports."""

from __future__ import annotations

import hashlib
import threading
from contextlib import contextmanager

from django.db import connection


class LegacyNewsImportAlreadyRunning(RuntimeError):
    """Raised when another write-mode legacy News import owns the lock."""


_LOCK_NAME = "eceee:legacy-news-import"
_LOCK_ID = int.from_bytes(hashlib.sha256(_LOCK_NAME.encode("utf-8")).digest()[:8], "big", signed=True)
_LOCAL_LOCK = threading.Lock()


@contextmanager
def legacy_news_import_lock():
    """Allow only one write-mode legacy News import at a time.

    PostgreSQL advisory locks serialize separate command processes. The local
    fallback keeps SQLite-backed tests and development commands deterministic.
    """

    locally_acquired = _LOCAL_LOCK.acquire(blocking=False)
    if not locally_acquired:
        raise LegacyNewsImportAlreadyRunning("Another legacy News import is already running")

    postgres_acquired = False
    try:
        if connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_try_advisory_lock(%s)", [_LOCK_ID])
                postgres_acquired = cursor.fetchone()[0]
            if not postgres_acquired:
                raise LegacyNewsImportAlreadyRunning("Another legacy News import is already running")
        yield
    finally:
        if postgres_acquired:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [_LOCK_ID])
        _LOCAL_LOCK.release()
