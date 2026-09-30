"""Read-only access to the legacy Mezzanine News tables."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator, Optional

import psycopg2
from psycopg2.extras import RealDictCursor


@dataclass(frozen=True)
class LegacyDatabaseNews:
    legacy_id: int
    title: str
    slug: str
    summary: str
    content: str
    presentational_publishing_date: object
    source_date: object
    publish_date: object
    expiry_date: object
    external_url: str
    featured: bool
    taxonomy: dict[str, list[str]]


class LegacyNewsDatabase:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        dbname: str,
        user: str,
        password: str,
        sslmode: str = "prefer",
    ):
        self.connection = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            sslmode=sslmode,
            connect_timeout=10,
            application_name="eceee_v4_legacy_news_migration",
        )
        self.connection.set_session(readonly=True, autocommit=False)
        self._news_content_type_id = self._content_type_id()

    def close(self):
        self.connection.rollback()
        self.connection.close()

    def summary(self) -> dict:
        with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT
                  count(*) AS total,
                  count(*) FILTER (WHERE status = 2) AS published,
                  count(*) FILTER (WHERE status <> 2) AS not_published,
                  count(*) FILTER (WHERE status = 2 AND expiry_date IS NOT NULL) AS with_expiry,
                  count(*) FILTER (WHERE status = 2 AND publish_on_front_page) AS featured,
                  count(*) FILTER (WHERE status = 2 AND content LIKE '%%<img%%') AS with_images,
                  count(*) FILTER (WHERE status = 2 AND source_date IS NOT NULL) AS with_source_date,
                  count(*) FILTER (WHERE status = 2 AND external_url <> '') AS with_external_url,
                  min(presentational_publishing_date) FILTER (WHERE status = 2) AS earliest_presentational_date,
                  max(presentational_publishing_date) FILTER (WHERE status = 2) AS latest_presentational_date
                FROM eceeenews_eceeenews
                """
            )
            summary = dict(cursor.fetchone())
            cursor.execute(
                """
                SELECT
                  (SELECT count(*)
                     FROM eceeenews_assignedeceeenewstype assignment
                     JOIN eceeenews_eceeenews news ON news.id = assignment.object_pk
                    WHERE assignment.content_type_id = %s AND news.status = 2) AS type_assignments,
                  (SELECT count(*)
                     FROM eceeenews_assignedeceeenewscategory assignment
                     JOIN eceeenews_eceeenews news ON news.id = assignment.object_pk
                    WHERE assignment.content_type_id = %s AND news.status = 2) AS category_assignments,
                  (SELECT count(*)
                     FROM eceeenews_assignedeceeenewssource assignment
                     JOIN eceeenews_eceeenews news ON news.id = assignment.object_pk
                    WHERE assignment.content_type_id = %s AND news.status = 2) AS source_assignments,
                  (SELECT count(*)
                     FROM eceeenews_assignedrelatednews assignment
                     JOIN eceeenews_eceeenews news ON news.id = assignment.object_pk
                    WHERE assignment.content_type_id = %s AND news.status = 2) AS topic_assignments,
                  (SELECT count(*) FROM (
                    SELECT assignment.object_pk, assignment.keyword_id
                      FROM generic_assignedkeyword assignment
                      JOIN eceeenews_eceeenews news ON news.id = assignment.object_pk
                     WHERE assignment.content_type_id = %s AND news.status = 2
                    UNION
                    SELECT assignment.object_pk, assignment.keyword_id
                      FROM eceeenews_assignedkeywordsub assignment
                      JOIN eceeenews_eceeenews news ON news.id = assignment.object_pk
                     WHERE assignment.content_type_id = %s AND news.status = 2
                  ) assigned_keywords) AS keyword_assignments
                """,
                [self._news_content_type_id] * 6,
            )
            summary.update(dict(cursor.fetchone()))
            return summary

    def iter_published(self, *, limit: Optional[int] = None) -> Iterator[LegacyDatabaseNews]:
        query = """
            SELECT id, title, slug, description, content,
                   presentational_publishing_date, source_date, publish_date,
                   expiry_date, external_url, publish_on_front_page
            FROM eceeenews_eceeenews
            WHERE status = 2
            ORDER BY id
        """
        params = []
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()
            taxonomy_by_id = self._taxonomy_map([row["id"] for row in rows])
            for row in rows:
                legacy_id = row["id"]
                yield LegacyDatabaseNews(
                    legacy_id=legacy_id,
                    title=row["title"],
                    slug=row["slug"],
                    summary=row["description"] or "",
                    content=row["content"] or "",
                    presentational_publishing_date=row["presentational_publishing_date"],
                    source_date=row["source_date"],
                    publish_date=row["publish_date"],
                    expiry_date=row["expiry_date"],
                    external_url=row["external_url"] or "",
                    featured=bool(row["publish_on_front_page"]),
                    taxonomy=taxonomy_by_id[legacy_id],
                )

    def _taxonomy_map(self, legacy_ids: list[int]) -> dict[int, dict[str, list[str]]]:
        result = {
            legacy_id: {
                "types": [],
                "categories": [],
                "sources": [],
                "topics": [],
                "keywords": [],
            }
            for legacy_id in legacy_ids
        }
        if not legacy_ids:
            return result
        assignments = {
            "types": self._assigned_titles_bulk(
                "eceeenews_assignedeceeenewstype",
                "news_type_id",
                "eceeenews_eceeenewstype",
                legacy_ids,
            ),
            "categories": self._assigned_titles_bulk(
                "eceeenews_assignedeceeenewscategory",
                "news_category_id",
                "eceeenews_eceeenewscategory",
                legacy_ids,
            ),
            "sources": self._assigned_titles_bulk(
                "eceeenews_assignedeceeenewssource",
                "news_source_id",
                "eceeenews_eceeenewssource",
                legacy_ids,
            ),
            "topics": self._assigned_titles_bulk(
                "eceeenews_assignedrelatednews",
                "related_newsitem_id",
                "eceeenews_relatednews",
                legacy_ids,
            ),
        }
        standard_keywords = self._keyword_titles_bulk("generic_assignedkeyword", legacy_ids)
        secondary_keywords = self._keyword_titles_bulk("eceeenews_assignedkeywordsub", legacy_ids)
        for field_name, values_by_id in assignments.items():
            for legacy_id, values in values_by_id.items():
                result[legacy_id][field_name] = values
        for legacy_id in legacy_ids:
            result[legacy_id]["keywords"] = list(
                dict.fromkeys(standard_keywords.get(legacy_id, []) + secondary_keywords.get(legacy_id, []))
            )
        return result

    def _assigned_titles_bulk(
        self,
        assignment_table: str,
        fk_column: str,
        value_table: str,
        legacy_ids: list[int],
    ) -> dict[int, list[str]]:
        # Table/column names are fixed application constants, never user input.
        query = f"""
            SELECT assignment.object_pk, value.title
            FROM {assignment_table} assignment
            JOIN {value_table} value ON value.id = assignment.{fk_column}
            WHERE assignment.object_pk = ANY(%s) AND assignment.content_type_id = %s
            ORDER BY assignment.object_pk, assignment._order NULLS LAST, assignment.id
        """
        with self.connection.cursor() as cursor:
            cursor.execute(query, [legacy_ids, self._news_content_type_id])
            result = {}
            for object_pk, title in cursor.fetchall():
                result.setdefault(object_pk, []).append(title)
            return result

    def _keyword_titles_bulk(self, assignment_table: str, legacy_ids: list[int]) -> dict[int, list[str]]:
        query = f"""
            SELECT assignment.object_pk, keyword.title
            FROM {assignment_table} assignment
            JOIN generic_keyword keyword ON keyword.id = assignment.keyword_id
            WHERE assignment.object_pk = ANY(%s) AND assignment.content_type_id = %s
            ORDER BY assignment.object_pk, assignment._order NULLS LAST, assignment.id
        """
        with self.connection.cursor() as cursor:
            cursor.execute(query, [legacy_ids, self._news_content_type_id])
            result = {}
            for object_pk, title in cursor.fetchall():
                result.setdefault(object_pk, []).append(title)
            return result

    def _content_type_id(self) -> int:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id FROM django_content_type
                WHERE app_label = 'eceeenews' AND model = 'eceeenews'
                """
            )
            row = cursor.fetchone()
            if not row:
                raise RuntimeError("Legacy eceeenews content type was not found")
            return row[0]
