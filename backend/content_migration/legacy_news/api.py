"""Authenticated client for the bounded ECEEE legacy migration API."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Iterator, Optional
from urllib.parse import urlencode, urljoin, urlsplit

from .remote import get_public_json
from .source import LegacyNewsRecord


MAX_RESPONSE_BYTES = 32 * 1024 * 1024
MAX_PAGE_SIZE = 500


class LegacyMigrationApiError(RuntimeError):
    pass


def _date_time(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise LegacyMigrationApiError("The legacy API returned an invalid date.") from exc


class LegacyNewsApi:
    def __init__(self, *, base_url: str, token: str):
        parsed = urlsplit(str(base_url or "").strip())
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise LegacyMigrationApiError("The legacy API base URL must be a public HTTPS URL.")
        if not token:
            raise LegacyMigrationApiError("The legacy API access key is missing.")
        self.base_url = base_url.rstrip("/") + "/"
        self.authorization = f"Bearer {token}"

    def close(self):
        """Retain the source adapter contract; requests do not keep a session open."""

    def health(self) -> dict:
        return self._request("health/")

    def summary(self) -> dict:
        payload = self._request("news/summary/")
        summary = payload.get("summary")
        if not isinstance(summary, dict):
            raise LegacyMigrationApiError("The legacy API summary response is invalid.")
        names = {
            "notPublished": "not_published",
            "withExpiry": "with_expiry",
            "withImages": "with_images",
            "withSourceDate": "with_source_date",
            "withExternalUrl": "with_external_url",
            "earliestPresentationalDate": "earliest_presentational_date",
            "latestPresentationalDate": "latest_presentational_date",
            "typeAssignments": "type_assignments",
            "categoryAssignments": "category_assignments",
            "sourceAssignments": "source_assignments",
            "topicAssignments": "topic_assignments",
            "keywordAssignments": "keyword_assignments",
        }
        return {names.get(key, key): value for key, value in summary.items()}

    def iter_published(
        self,
        *,
        limit: Optional[int] = None,
        newest_first: bool = False,
    ) -> Iterator[LegacyNewsRecord]:
        remaining = limit
        cursor = None
        seen_cursors = set()
        while remaining is None or remaining > 0:
            page_size = min(remaining, MAX_PAGE_SIZE) if remaining is not None else MAX_PAGE_SIZE
            params = {"limit": page_size, "newestFirst": "true" if newest_first else "false"}
            if cursor is not None:
                params["cursor"] = cursor
            payload = self._request("news/", params=params)
            results = payload.get("results")
            if not isinstance(results, list):
                raise LegacyMigrationApiError("The legacy API News response is invalid.")
            if len(results) > page_size:
                raise LegacyMigrationApiError("The legacy API returned more News records than requested.")
            next_cursor = payload.get("nextCursor")
            if next_cursor is not None and not isinstance(next_cursor, str):
                raise LegacyMigrationApiError("The legacy API returned an invalid News cursor.")
            if next_cursor and next_cursor in seen_cursors:
                raise LegacyMigrationApiError("The legacy API repeated a News cursor.")
            for item in results:
                yield self._news(item)
                if remaining is not None:
                    remaining -= 1
            if not next_cursor or not results:
                break
            seen_cursors.add(next_cursor)
            cursor = next_cursor

    def _request(self, path: str, *, params=None) -> dict:
        url = urljoin(self.base_url, path)
        if params:
            url = f"{url}?{urlencode(params)}"
        try:
            response = get_public_json(
                url,
                authorization=self.authorization,
                max_bytes=MAX_RESPONSE_BYTES,
            )
        except ValueError as exc:
            raise LegacyMigrationApiError("The legacy migration API is unreachable.") from exc
        if len(response.content) > MAX_RESPONSE_BYTES:
            raise LegacyMigrationApiError("The legacy API response exceeded the size limit.")
        if response.status_code != 200:
            raise LegacyMigrationApiError(f"The legacy API returned HTTP {response.status_code}.")
        content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise LegacyMigrationApiError("The legacy API returned a non-JSON response.")
        try:
            payload = json.loads(response.content)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise LegacyMigrationApiError("The legacy API returned invalid JSON.") from exc
        if not isinstance(payload, dict) or payload.get("apiVersion") != "1":
            raise LegacyMigrationApiError("The legacy API version is incompatible.")
        return payload

    @staticmethod
    def _news(item) -> LegacyNewsRecord:
        if not isinstance(item, dict) or not isinstance(item.get("taxonomy"), dict):
            raise LegacyMigrationApiError("The legacy API returned an invalid News item.")
        try:
            return LegacyNewsRecord(
                legacy_id=int(item["legacyId"]),
                title=str(item["title"]),
                slug=str(item["slug"]),
                summary=str(item.get("summary") or ""),
                content=str(item.get("content") or ""),
                presentational_publishing_date=_date_time(item.get("presentationalPublishingDate")),
                source_date=_date_time(item.get("sourceDate")),
                publish_date=_date_time(item.get("publishDate")),
                expiry_date=_date_time(item.get("expiryDate")),
                external_url=str(item.get("externalUrl") or ""),
                featured=bool(item.get("featured")),
                taxonomy={
                    name: [str(value) for value in item["taxonomy"].get(name, [])]
                    for name in ("types", "categories", "sources", "topics", "keywords")
                },
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise LegacyMigrationApiError("The legacy API returned an invalid News item.") from exc
