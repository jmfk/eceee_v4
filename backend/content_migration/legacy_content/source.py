"""Fixed resources from the authenticated legacy API; source manifests contain no credentials."""

from urllib.parse import urlsplit

from content_migration.legacy_news.api import LegacyMigrationApiError, LegacyNewsApi

RESOURCES = ("columnists", "organizations", "news", "columns", "events", "publications")
DEFAULT_RESOURCES = ("columnists", "organizations", "news", "columns", "events")
TARGETS = {
    "news": "article",
    "columns": "article",
    "columnists": "columnist",
    "events": "event",
    "publications": "library_item",
    "organizations": "organization",
}
DEV_LIMITS = {"news": 100, "columns": 40, "columnists": 40, "events": 30, "publications": 25, "organizations": 25}


class EditorialSource(LegacyNewsApi):
    def available(self, health=None):
        health = self.health() if health is None else health
        if health.get("contentContract") != "1":
            return set()
        resources = health.get("contentResources")
        if not isinstance(resources, list) or any(not isinstance(r, str) or r not in RESOURCES for r in resources):
            raise LegacyMigrationApiError("Editorial resource declaration is invalid")
        return set(resources)

    def content_summary(self, resource):
        if resource not in RESOURCES:
            raise ValueError("Unknown editorial resource")
        payload = self._request("content/" + resource + "/summary/")
        summary = payload.get("summary")
        site = payload.get("sourceSite")
        if (
            payload.get("contentContract") != "1"
            or isinstance(site, bool)
            or not isinstance(site, int)
            or site < 1
            or not isinstance(summary, dict)
        ):
            raise LegacyMigrationApiError("Editorial inventory contract is invalid")
        counts = {key: summary.get(key) for key in ("total", "published", "excludedUnpublished")}
        if any(isinstance(v, bool) or not isinstance(v, int) or v < 0 for v in counts.values()):
            raise LegacyMigrationApiError("Editorial inventory counts are invalid")
        if counts["total"] != counts["published"] + counts["excludedUnpublished"]:
            raise LegacyMigrationApiError("Editorial inventory counts do not reconcile")
        return {"sourceSite": site, **counts}

    def iter_content(self, resource, *, limit=None, newest_first=True, ids=None):
        if resource not in RESOURCES:
            raise ValueError("Unknown editorial resource")
        if limit is not None and (isinstance(limit, bool) or not isinstance(limit, int) or limit < 1):
            raise ValueError("Choose a positive editorial sample limit")
        if ids is not None:
            if (
                resource != "columnists"
                or not 1 <= len(ids) <= 100
                or any(isinstance(pk, bool) or not str(pk).isdigit() or int(pk) < 1 for pk in ids)
            ):
                raise ValueError("Choose at most 100 positive columnist dependency IDs")
            ids = list(dict.fromkeys(str(pk) for pk in ids))
        cursor = None
        seen = set()
        seen_ids = set()
        source_site = None
        last_id = None
        remaining = limit
        while remaining is None or remaining > 0:
            size = min(remaining, 500) if remaining is not None else 500
            params = {"limit": size, "newestFirst": str(newest_first).lower()}
            if cursor:
                params["cursor"] = cursor
            if ids:
                params["ids"] = ",".join(map(str, ids))
            payload = self._request("content/" + resource + "/", params=params)
            if payload.get("contentContract") != "1" or not isinstance(payload.get("results"), list):
                raise LegacyMigrationApiError("Editorial contract is unavailable")
            rows = payload["results"]
            if len(rows) > size:
                raise LegacyMigrationApiError("Editorial page exceeds requested size")
            for row in rows:
                validate_record(row, resource)
                if source_site is None:
                    source_site = row["sourceSite"]
                if row["sourceSite"] != source_site or payload.get("sourceSite", source_site) != source_site:
                    raise LegacyMigrationApiError("Editorial pagination changed source site")
                pk = row["legacyId"]
                if pk in seen_ids or (ids and str(pk) not in ids):
                    raise LegacyMigrationApiError("Editorial source identity is duplicated or outside the selection")
                if last_id is not None and (pk >= last_id if newest_first else pk <= last_id):
                    raise LegacyMigrationApiError("Editorial pagination is not in source ID order")
                seen_ids.add(pk)
                last_id = pk
                yield row
                if remaining is not None:
                    remaining -= 1
            cursor = payload.get("nextCursor")
            if not cursor:
                return
            if not isinstance(cursor, str) or cursor in seen or not rows:
                raise LegacyMigrationApiError("Editorial pagination did not progress")
            seen.add(cursor)


def validate_record(row, resource):
    if not isinstance(row, dict):
        raise ValueError("record=invalid")
    source_id = row.get("legacyId")
    if isinstance(source_id, bool) or not isinstance(source_id, int) or source_id < 1:
        raise ValueError("source_identity=invalid")
    for key in ("title", "slug", "sourceModel", "sourceUrl", "content"):
        if not isinstance(row.get(key), str):
            raise ValueError("record_fields=invalid")
    source = urlsplit(row["sourceUrl"])
    if source.scheme not in {"https", "http"} or not source.hostname or source.username or source.password:
        raise ValueError("source_url=invalid")
    if (
        not isinstance(row.get("data"), dict)
        or not isinstance(row.get("taxonomy"), dict)
        or not isinstance(row.get("attachments", []), list)
    ):
        raise ValueError("record_metadata=invalid")
    if isinstance(row.get("status"), bool) or row.get("status") != 2:
        raise ValueError("record=not_published")
    if row.get("isPublic") is not True:
        raise ValueError("record=protected")
    expected = {
        "news": "eceeenews.eceeenews",
        "columns": "eceeecolumnists.eceeecolumn",
        "columnists": "eceeecolumnists.eceeecolumnist",
        "events": "eceeecalendar.eceeecalenderevent",
        "publications": "eceeelibrary.eceeelibraryitem",
        "organizations": "eceeememberforum.eceeememberorganization",
    }
    if row["sourceModel"].lower() != expected[resource]:
        raise ValueError("source_model=mismatch")
    if not isinstance(row.get("sourceSite"), int) or isinstance(row.get("sourceSite"), bool):
        raise ValueError("source_scope=missing")
