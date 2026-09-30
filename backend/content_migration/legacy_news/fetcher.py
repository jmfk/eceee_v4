"""Bounded and polite fetching for the explicitly approved golden sample."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Callable, Optional

import requests

USER_AGENT = "ECEEE-v4-Legacy-News-Migrator/1.0 (+https://www.eceee.org/)"


class ManifestFetcher:
    def __init__(
        self,
        *,
        crawl_delay: float = 10.0,
        retries: int = 2,
        timeout: float = 30.0,
        session: Optional[requests.Session] = None,
        sleeper: Callable[[float], None] = time.sleep,
    ):
        self.crawl_delay = max(10.0, crawl_delay)
        self.retries = max(0, min(retries, 3))
        self.timeout = timeout
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.sleeper = sleeper
        self._last_request_at: Optional[float] = None

    def fetch(self, *, url: str = "", fixture: str = "", manifest_dir: Optional[Path] = None) -> str:
        if fixture:
            if not manifest_dir:
                raise ValueError("manifest_dir is required for fixture entries")
            return (manifest_dir / fixture).resolve().read_text(encoding="utf-8")
        if not url.startswith(("https://www.eceee.org/", "http://www.eceee.org/")):
            raise ValueError(f"Sample URL is outside the approved eceee.org host: {url}")

        last_error: Optional[Exception] = None
        for attempt in range(self.retries + 1):
            if self._last_request_at is not None:
                elapsed = time.monotonic() - self._last_request_at
                if elapsed < self.crawl_delay:
                    self.sleeper(self.crawl_delay - elapsed)
            try:
                response = self.session.get(url, timeout=self.timeout)
                self._last_request_at = time.monotonic()
                response.raise_for_status()
                return response.text
            except requests.RequestException as exc:
                last_error = exc
                if attempt < self.retries:
                    self.sleeper(min(2**attempt, 4))
        raise RuntimeError(f"Failed to fetch manifest URL after bounded retries: {url}") from last_error
