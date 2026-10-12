"""Resolve and validate links embedded in imported legacy News HTML."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from typing import Callable, Iterable, Mapping, Optional
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup
from django.utils import timezone

from object_storage.models import ObjectInstance
from webpages.models import WebPage

from .extractor import ExtractedNews, content_checksum
from .remote import HeadResponse, head_public_url

UNRESOLVED_LINK_CLASS = "legacy-link-unresolved"
UNRESOLVED_STATUS_ATTRIBUTE = "data-legacy-link-status"


def _normalized_path(value: str) -> str:
    path = urlsplit(value).path or "/"
    if not path.startswith("/"):
        path = f"/{path}"
    if path != "/" and not path.endswith("/"):
        path = f"{path}/"
    return path


def _internal_hosts(source_url: str) -> set[str]:
    hostname = (urlsplit(source_url).hostname or "").lower().rstrip(".")
    if not hostname:
        return set()
    bare = hostname.removeprefix("www.")
    return {bare, f"www.{bare}"}


def _route_with_suffix(route: str, original_url: str) -> str:
    parsed = urlsplit(original_url)
    return urlunsplit(("", "", route, parsed.query, parsed.fragment))


class ExternalHeadChecker:
    """Cache exact-200 HEAD results and validate every redirect destination."""

    def __init__(
        self,
        *,
        timeout: float = 10.0,
        head_request: Callable[..., HeadResponse] = head_public_url,
    ):
        self.timeout = timeout
        self.head_request = head_request
        self._cache: dict[str, str] = {}

    def status(self, url: str) -> str:
        if url in self._cache:
            return self._cache[url]

        result = self._request_status(url)
        self._cache[url] = result
        return result

    def prime(self, urls: Iterable[str]) -> None:
        """Check unique URLs concurrently before a batch rewrite."""

        pending = sorted(set(urls) - self._cache.keys())
        if not pending:
            return
        if len(pending) == 1:
            for url in pending:
                self.status(url)
            return

        with ThreadPoolExecutor(max_workers=min(8, len(pending))) as executor:
            results = executor.map(self._request_status, pending)
            self._cache.update(zip(pending, results))

    def _request_status(self, url: str) -> str:
        current_url = url
        result = "external-head-unreachable"
        try:
            for _ in range(4):
                response = self.head_request(current_url, timeout=self.timeout)
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        result = "external-head-redirect-without-location"
                        break
                    current_url = urljoin(current_url, location)
                    continue
                result = "ok" if response.status_code == 200 else f"external-head-{response.status_code}"
                break
            else:
                result = "external-head-too-many-redirects"
        except ValueError:
            result = "external-head-unreachable"

        return result


class LegacyNewsLinkRewriter:
    """Rewrite resolvable internal links and disable unresolved or dead links."""

    def __init__(
        self,
        *,
        tenant,
        news_object_type,
        checker: Optional[ExternalHeadChecker] = None,
        internal_targets: Optional[Mapping[str, str]] = None,
    ):
        self.tenant = tenant
        self.checker = checker or ExternalHeadChecker()
        self.internal_targets = (
            dict(internal_targets) if internal_targets is not None else self._internal_targets(tenant, news_object_type)
        )
        self._page_targets_by_host: dict[str, dict[str, str]] = {}

    @staticmethod
    def _internal_targets(tenant, news_object_type) -> dict[str, str]:
        targets: dict[str, str] = {}
        now = timezone.now()
        existing = ObjectInstance.published.published_only(now).filter(
            tenant=tenant,
            object_type=news_object_type,
        )
        for obj in existing.only("slug", "metadata"):
            route = f"/news/{obj.slug}/"
            targets[_normalized_path(route)] = route
            for key in ("legacy_source_url", "legacy_database_source_url"):
                source_url = (obj.metadata or {}).get(key)
                if source_url:
                    targets[_normalized_path(source_url)] = route
        return targets

    def _page_targets(self, hostname: str) -> dict[str, str]:
        """Return published page routes for the site that actually serves hostname."""

        hostname = hostname.lower().rstrip(".")
        if hostname in self._page_targets_by_host:
            return self._page_targets_by_host[hostname]
        if self.tenant is None:
            self._page_targets_by_host[hostname] = {}
            return {}

        root = WebPage.get_root_page_for_hostname(hostname)
        if root is None or root.tenant_id != self.tenant.pk:
            self._page_targets_by_host[hostname] = {}
            return {}

        targets = {}
        paths = (
            WebPage.objects.filter(
                tenant=self.tenant,
                cached_root_id=root.pk,
                is_deleted=False,
                is_currently_published=True,
            )
            .exclude(cached_path="")
            .values_list("cached_path", flat=True)
        )
        for path in paths:
            targets[_normalized_path(path)] = path
        self._page_targets_by_host[hostname] = targets
        return targets

    def _internal_target(self, href: str, hostname: str) -> Optional[str]:
        key = _normalized_path(href)
        # Object routes win over colliding page paths because they are the
        # canonical destination for legacy News identities.
        return self.internal_targets.get(key) or self._page_targets(hostname).get(key)

    def rewrite(self, article: ExtractedNews) -> ExtractedNews:
        soup = BeautifulSoup(article.body_html, "html.parser")
        internal_hosts = _internal_hosts(article.source_url)
        article_hostname = (urlsplit(article.source_url).hostname or "").lower().rstrip(".")

        for link in soup.find_all("a"):
            href = link.get("href", "")
            parsed = urlsplit(href)
            if not href:
                self._disable(link, "missing-href")
            elif parsed.scheme in {"mailto", "tel"}:
                continue
            elif parsed.scheme not in {"http", "https"} or not parsed.hostname:
                self._disable(link, "unsupported-link")
            elif parsed.hostname.lower().rstrip(".") in internal_hosts:
                # The replacement is relative, so verify the route on the host
                # where the imported article will actually be rendered.
                target = self._internal_target(href, article_hostname)
                if target:
                    link["href"] = _route_with_suffix(target, href)
                else:
                    self._disable(link, "missing-internal-target")
            else:
                status = self.checker.status(href)
                if status != "ok":
                    self._disable(link, status)

        body_html = str(soup).strip()
        return replace(article, body_html=body_html, content_checksum=content_checksum(article, body_html))

    def rewrite_many(self, articles: Iterable[ExtractedNews]) -> list[ExtractedNews]:
        articles = list(articles)
        external_urls = []
        for article in articles:
            internal_hosts = _internal_hosts(article.source_url)
            soup = BeautifulSoup(article.body_html, "html.parser")
            for link in soup.find_all("a", href=True):
                parsed = urlsplit(link["href"])
                if (
                    parsed.scheme in {"http", "https"}
                    and parsed.hostname
                    and parsed.hostname.lower().rstrip(".") not in internal_hosts
                ):
                    external_urls.append(link["href"])
        self.checker.prime(external_urls)
        return [self.rewrite(article) for article in articles]

    @staticmethod
    def _disable(link, status: str) -> None:
        classes = list(link.get("class", []))
        if UNRESOLVED_LINK_CLASS not in classes:
            classes.append(UNRESOLVED_LINK_CLASS)
        link.name = "span"
        link["class"] = classes
        link[UNRESOLVED_STATUS_ATTRIBUTE] = status
