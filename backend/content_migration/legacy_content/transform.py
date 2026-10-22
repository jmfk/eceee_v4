"""Normalize public records without guessing authors, organizations or precise dates."""

import hashlib
import json
from dataclasses import replace
from datetime import date, datetime
from html import escape

from bs4 import BeautifulSoup
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from content_migration.legacy_news.extractor import ExtractedNews, _normalize_urls_and_attributes, content_checksum
from content_migration.legacy_news.transformer import build_payload

from .source import TARGETS


class BlockedRecord(ValueError):
    pass


def checksum(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()


def display_date(row):
    for key in ("presentationalPublishingDate", "sourceDate", "publishDate", "createdAt"):
        value = row.get("data", {}).get(key) if key == "sourceDate" else row.get(key)
        if value:
            try:
                value = parse_datetime(value) or parse_date(value)
            except ValueError:
                value = None
            if value:
                if isinstance(value, date) and not isinstance(value, datetime):
                    value = datetime.combine(value, datetime.min.time())
                if timezone.is_naive(value):
                    value = timezone.make_aware(value)
                return value.isoformat()
    raise BlockedRecord("missing_display_date")


def normalize(row, resource, *, author_ids=None, media_by_url=None):
    data = dict(row["data"])
    author_ids = author_ids or {}
    media_by_url = media_by_url or {}
    title = row["title"].strip()
    if not title:
        raise BlockedRecord("missing_public_title")
    target = TARGETS[resource]
    body = row.get("content", "")
    images = []
    soup = BeautifulSoup(body, "html.parser")
    for unwanted in soup.select("script,style,iframe,object,embed,.share-on-social,.social-share,aside"):
        unwanted.decompose()
    _normalize_urls_and_attributes(soup, row["sourceUrl"])
    for image in soup.find_all("img", src=True):
        images.append(image["src"])
    if resource in {"news", "columns"}:
        data = {k: v for k, v in data.items() if k in {"sourceDate", "externalUrl"}}
        data.update(
            summary=row.get("summary", ""),
            presentationalPublishingDate=display_date(row),
            featuredImage=None,
            authors=[],
        )
        if resource == "columns":
            originals = row["data"].get("authorIds", [])
            if not originals or any(str(pk) not in author_ids for pk in originals):
                raise BlockedRecord("missing_columnist_dependency")
            data["authors"] = [author_ids[str(pk)] for pk in originals]
    elif resource == "columnists":
        data = {k: v for k, v in data.items() if k in {"firstName", "lastName", "prefix", "affiliation", "homePage"}}
        portraits = row["data"].get("portraits", [])
        images.extend(portraits)
        media = media_by_url.get(portraits[0]) if portraits else None
        data["photo"] = str(media.pk) if media else None
    elif resource == "events":
        data = {
            k: v
            for k, v in data.items()
            if k in {"eventStartDate", "eventEndDate", "eventTime", "organiser", "venue", "focusAreas", "externalUrl"}
        }
        for key in ("eventStartDate", "eventEndDate"):
            if not data.get(key):
                if key == "eventStartDate":
                    raise BlockedRecord("incomplete_event_date")
                data[key] = None
                continue
            try:
                parsed = parse_date(data[key])
            except (ValueError, TypeError):
                parsed = None
            if parsed is None:
                raise BlockedRecord("incomplete_event_date")
            data[key] = parsed.isoformat()
        if data.get("eventEndDate") and data["eventEndDate"] < data["eventStartDate"]:
            raise BlockedRecord("invalid_event_range")
    elif resource == "organizations":
        data = {k: v for k, v in data.items() if k in {"fullName", "homePage", "country", "isInternational"}}
        if not data.get("fullName"):
            raise BlockedRecord("missing_public_organization_name")
        logo = row["data"].get("logo")
        if logo:
            images.append(logo)
        data["logo"] = str(media_by_url[logo].pk) if logo in media_by_url else None
    else:
        data = {"summary": row.get("summary", ""), "externalUrl": "", "document": None}
    # Attachment metadata retains exact order; body download links remain editable in the existing UI.
    attachments = []
    for attachment in row.get("attachments", []):
        url = attachment.get("url") or attachment.get("externalUrl")
        if not url:
            raise BlockedRecord("missing_attachment_url")
        attachments.append(dict(attachment))
        soup.append(
            BeautifulSoup(
                '<p><a href="'
                + escape(url, quote=True)
                + '">'
                + escape(attachment.get("title") or "Document")
                + "</a></p>",
                "html.parser",
            )
        )
    cleaned = str(soup)
    article = ExtractedNews(
        title=title,
        slug=row["slug"],
        summary=row.get("summary", ""),
        source_name="",
        source_date=None,
        external_url=data.get("externalUrl", ""),
        body_html=cleaned,
        image_urls=tuple(dict.fromkeys(images)),
        source_url=row["sourceUrl"],
        source_checksum=checksum(row),
        content_checksum="",
    )
    article = replace(article, content_checksum=content_checksum(article, cleaned))
    payload = build_payload(article, media_by_url=media_by_url)
    return {
        "target": target,
        "title": title,
        "data": data,
        "widgets": payload.widgets,
        "images": article.image_urls,
        "attachments": attachments,
        "kind": "column" if resource == "columns" else "news" if resource == "news" else None,
    }
