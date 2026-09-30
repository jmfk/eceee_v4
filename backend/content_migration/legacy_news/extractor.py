"""Extract legacy ECEEE News HTML into a presentation-neutral record."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Tag

from content_import.utils.html_sanitizer import sanitize_html

INTRO_RE = re.compile(r"^\s*\((?P<source>.*?),\s*(?P<date>[^)]+)\)\s*", re.DOTALL)
DATE_FORMATS = ("%d %b %Y", "%d %B %Y", "%Y-%m-%d")
SAFE_SCHEMES = {"http", "https", "mailto", "tel"}


@dataclass(frozen=True)
class ExtractedNews:
    title: str
    slug: str
    summary: str
    source_name: str
    source_date: Optional[date]
    external_url: str
    body_html: str
    image_urls: tuple[str, ...]
    source_url: str
    source_checksum: str
    content_checksum: str


def _parse_date(value: str) -> Optional[date]:
    normalized = " ".join(value.split())
    for date_format in DATE_FORMATS:
        try:
            return datetime.strptime(normalized, date_format).date()
        except ValueError:
            continue
    return None


def _safe_absolute_url(value: str, source_url: str) -> str:
    absolute = urljoin(source_url, value.strip())
    parsed = urlparse(absolute)
    return absolute if parsed.scheme.lower() in SAFE_SCHEMES else ""


def _normalize_urls_and_attributes(root: Tag, source_url: str) -> None:
    for tag in root.find_all(True):
        if tag.name == "a":
            href = _safe_absolute_url(tag.get("href", ""), source_url)
            tag.attrs = {"href": href} if href else {}
            if href.startswith(("http://", "https://")) and urlparse(href).netloc != urlparse(source_url).netloc:
                tag.attrs.update({"rel": "noopener noreferrer"})
        elif tag.name == "img":
            src = _safe_absolute_url(tag.get("src", ""), source_url)
            attrs = {"src": src} if src else {}
            if tag.get("alt"):
                attrs["alt"] = tag.get("alt", "").strip()
            if tag.get("title"):
                attrs["title"] = tag.get("title", "").strip()
            tag.attrs = attrs
        elif tag.name in {"td", "th"}:
            tag.attrs = {key: tag[key] for key in ("colspan", "rowspan") if tag.get(key)}
        else:
            tag.attrs = {}


def _extract_external_link(root: Tag, source_url: str) -> str:
    headings = root.find_all(["h2", "h3", "h4", "h5", "h6"])
    for heading in reversed(headings):
        if heading.get_text(" ", strip=True).rstrip(":").casefold() != "external link":
            continue
        section_nodes = [heading]
        external_url = ""
        sibling = heading.next_sibling
        while sibling is not None:
            next_sibling = sibling.next_sibling
            if isinstance(sibling, Tag) and sibling.name in {
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
            }:
                break
            if isinstance(sibling, Tag):
                section_nodes.append(sibling)
                if not external_url:
                    link = sibling if sibling.name == "a" else sibling.find("a", href=True)
                    if link:
                        external_url = _safe_absolute_url(link.get("href", ""), source_url)
            sibling = next_sibling
        for node in section_nodes:
            node.extract()
        return external_url
    return ""


def extract_news_html(html: str, source_url: str, slug: str = "") -> ExtractedNews:
    """Extract a single legacy page, strictly bounded to `.mainContentColumn`."""
    soup = BeautifulSoup(html, "html.parser")
    main = soup.select_one(".mainContentColumn")
    if main is None:
        raise ValueError("Legacy News page has no .mainContentColumn")

    for unwanted in main.select(
        ".share-on-social, .social, .social-share, aside, script, style, iframe, object, embed"
    ):
        unwanted.decompose()

    title_node = main.find("h1")
    if title_node is None or not title_node.get_text(" ", strip=True):
        raise ValueError("Legacy News page has no article h1")
    title = title_node.get_text(" ", strip=True)
    title_node.extract()

    summary = ""
    source_name = ""
    source_date = None
    intro = main.select_one("p.news_intro")
    if intro is not None:
        intro_text = intro.get_text(" ", strip=True)
        match = INTRO_RE.match(intro_text)
        if match:
            source_name = " ".join(match.group("source").split())
            source_date = _parse_date(match.group("date"))
            intro_text = intro_text[match.end() :]
        summary = " ".join(intro_text.split())
        intro.extract()

    external_url = _extract_external_link(main, source_url)
    _normalize_urls_and_attributes(main, source_url)

    # Drop the small legacy external-link glyph even if malformed markup left it behind.
    for image in main.find_all("img"):
        if urlparse(image.get("src", "")).path.endswith("/eceeenews/img/link.gif"):
            image.decompose()

    cleaned = sanitize_html(str(main))
    cleaned_soup = BeautifulSoup(cleaned, "html.parser")
    wrapper = cleaned_soup.find(["div", "main"])
    if wrapper:
        wrapper.unwrap()
    body_html = str(cleaned_soup).strip()
    image_urls = tuple(dict.fromkeys(image.get("src") for image in cleaned_soup.find_all("img", src=True)))
    canonical_slug = slug.strip("/") or urlparse(source_url).path.rstrip("/").split("/")[-1]
    source_checksum = hashlib.sha256(html.encode("utf-8")).hexdigest()
    content_fingerprint = "\n".join(
        [
            title,
            summary,
            source_name,
            source_date.isoformat() if source_date else "",
            external_url,
            body_html,
        ]
    )
    content_checksum = hashlib.sha256(content_fingerprint.encode("utf-8")).hexdigest()

    return ExtractedNews(
        title=title,
        slug=canonical_slug,
        summary=summary,
        source_name=source_name,
        source_date=source_date,
        external_url=external_url,
        body_html=body_html,
        image_urls=image_urls,
        source_url=source_url,
        source_checksum=source_checksum,
        content_checksum=content_checksum,
    )
