"""
Public views for the Web Page Publishing System

Handles public-facing page rendering with layout/theme inheritance,
widget rendering, and object publishing support.
"""

from django.shortcuts import get_object_or_404, render
from django.http import Http404, HttpResponse, JsonResponse
from django.views import View
from django.views.generic import DetailView, ListView
from django.utils import timezone
from django.db.models import Q
from django.template.loader import get_template, render_to_string
from django.template import TemplateDoesNotExist
from django.urls import reverse
from django.contrib.sitemaps import Sitemap
import json

from .models import WebPage
from .renderers import WebPageRenderer
from .serializers import PageHierarchySerializer


class PublishedPageMixin:
    """Mixin to filter only published pages using date-based logic"""

    def get_queryset(self):
        """
        NEW: Filter pages that have currently published versions.

        A page is published if it has at least one version with:
        - effective_date <= now
        - expiry_date is null OR expiry_date > now
        """
        # We need to filter pages that have published versions
        # This requires a subquery to check versions
        now = timezone.now()

        from .models import PageVersion

        # Get pages that have at least one published version
        published_page_ids = (
            PageVersion.objects.filter(effective_date__lte=now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
            .values_list("page_id", flat=True)
            .distinct()
        )

        return WebPage.objects.filter(id__in=published_page_ids).select_related(
            "parent"
        )


class PageDetailView(PublishedPageMixin, DetailView):
    """
    Public detail view for individual pages with layout/theme inheritance
    and widget rendering. Supports object-based pages.
    """

    model = WebPage
    template_name = "webpages/page_detail.html"
    context_object_name = "page"

    def get_object(self, queryset=None):
        """Get page by slug path, supporting hierarchical URLs"""
        slug_path = self.kwargs.get("slug_path", "")
        slug_parts = [part for part in slug_path.split("/") if part]

        if not slug_parts:
            raise Http404("No slug path provided")

        # Navigate through the hierarchy to find the page
        current_page = None
        parent = None

        for slug in slug_parts:
            try:
                current_page = WebPage.objects.select_related("parent").get(
                    slug=slug, parent=parent
                )
                parent = current_page
            except WebPage.DoesNotExist:
                raise Http404(f"Page not found: {'/'.join(slug_parts)}")

        # Check if page is published using new date-based logic
        if not current_page.is_published():
            raise Http404("Page not available")

        return current_page

    def get_context_data(self, **kwargs):
        """Add layout, theme, widgets, and object content to context"""
        context = super().get_context_data(**kwargs)
        page = self.object

        # Get effective layout and theme
        context["effective_layout"] = page.get_effective_layout()
        context["effective_theme"] = page.get_effective_theme()

        # Render widgets organized by slot using new PageVersion JSON + renderer
        current_version = getattr(page, "get_current_published_version", lambda: None)()

        # Ensure we have a valid version
        if not current_version:
            raise Http404("No published version available for this page")
        if current_version:
            renderer = WebPageRenderer(request=self.request)
            base_context = renderer._build_base_context(page, current_version, {})
            context["widgets_by_slot"] = renderer._render_widgets_by_slot(
                page, current_version, base_context
            )

            # Add SEO metadata from version
            page_data = current_version.page_data or {}
            context["meta_title"] = (
                page_data.get("meta_title") or page_data.get("metaTitle") or page.title
            )
            context["meta_description"] = (
                page_data.get("meta_description")
                or page_data.get("metaDescription")
                or page.description
            )
            context["page_data"] = page_data
            context["content"] = current_version
        else:
            context["widgets_by_slot"] = {}
            context["meta_title"] = page.title
            context["meta_description"] = page.description

        # Get breadcrumbs
        context["breadcrumbs"] = page.get_breadcrumbs()

        # Get root page for icon inheritance
        context["root_page"] = page.get_root_page()
        context["current_page"] = page

        # If this is an object page, get object content
        if page.is_object_page():
            context["object_content"] = page.get_object_content()
            context["is_object_page"] = True
            context["linked_object"] = {
                "type": page.linked_object_type,
                "id": page.linked_object_id,
            }
        else:
            context["is_object_page"] = False

        return context

    def get_template_names(self):
        """
        Try to find a specific template for the page layout,
        falling back to the default template.
        """
        page = self.object
        template_names = []

        # Try layout-specific template
        layout = page.get_effective_layout()
        if layout:
            template_names.append(f"webpages/layouts/{layout.name.lower()}.html")

        # Try page-specific template
        template_names.append(f"webpages/pages/{page.slug}.html")

        # Default template
        template_names.append("webpages/page_detail.html")

        return template_names


class PageListView(PublishedPageMixin, ListView):
    """
    Public list view for root pages (pages without a parent).
    Shows only published pages that are currently effective.
    """

    model = WebPage
    template_name = "webpages/page_list.html"
    context_object_name = "pages"
    paginate_by = 20

    def get_queryset(self):
        """Get published root pages using date-based logic"""
        now = timezone.now()

        from .models import PageVersion

        # Get root pages that have at least one published version
        published_page_ids = (
            PageVersion.objects.filter(effective_date__lte=now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
            .values_list("page_id", flat=True)
            .distinct()
        )

        return WebPage.objects.filter(
            parent__isnull=True, id__in=published_page_ids
        ).order_by("sort_order")


class ObjectDetailView(DetailView):
    """
    Generic view for rendering objects with their canonical URLs.
    This view handles direct object URLs like /news/my-article/
    """

    template_name = "webpages/object_detail.html"
    context_object_name = "object"
    object_type = None  # Override in subclasses
    model = None  # Override in subclasses

    def get_object(self, queryset=None):
        """Get object by slug, checking publication status"""
        if queryset is None:
            queryset = self.get_queryset()

        slug = self.kwargs.get("slug")
        if not slug:
            raise Http404("No slug provided")

        obj = get_object_or_404(queryset, slug=slug)

        # Check if object is published
        if hasattr(obj, "is_published") and not obj.is_published:
            raise Http404("Object not published")

        return obj

    def get_context_data(self, **kwargs):
        """Add object-specific context"""
        context = super().get_context_data(**kwargs)
        obj = self.object

        context["object_type"] = self.object_type
        context["canonical_url"] = obj.get_absolute_url()

        # Check if this object is linked to any published pages
        from .models import PageVersion

        # Get pages that have published versions
        now = timezone.now()
        published_page_ids = (
            PageVersion.objects.filter(effective_date__lte=now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
            .values_list("page_id", flat=True)
            .distinct()
        )

        linked_pages = WebPage.objects.filter(
            linked_object_type=self.object_type,
            linked_object_id=obj.id,
            id__in=published_page_ids,
        )
        context["linked_pages"] = linked_pages

        return context


class MemberDetailView(ObjectDetailView):
    """Detail view for Member objects"""

    object_type = "member"

    def get_model(self):
        from content.models import Member

        return Member

    def get_queryset(self):
        from content.models import Member

        return Member.objects.filter(is_published=True, list_in_directory=True)


def page_sitemap_view(request):
    """
    XML sitemap for published pages using date-based logic.
    """
    now = timezone.now()

    from .models import PageVersion

    # Get pages that have published versions
    published_page_ids = (
        PageVersion.objects.filter(effective_date__lte=now)
        .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        .values_list("page_id", flat=True)
        .distinct()
    )

    pages = WebPage.objects.filter(id__in=published_page_ids).order_by("sort_order")

    xml_content = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml_content.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')

    for page in pages:
        xml_content.append("  <url>")
        xml_content.append(
            f"    <loc>{request.build_absolute_uri(page.get_absolute_url())}</loc>"
        )
        xml_content.append(f"    <lastmod>{page.updated_at.date()}</lastmod>")
        xml_content.append("    <changefreq>weekly</changefreq>")
        xml_content.append("    <priority>0.8</priority>")
        xml_content.append("  </url>")

    xml_content.append("</urlset>")

    return HttpResponse("\n".join(xml_content), content_type="application/xml")


def page_hierarchy_api(request):
    """
    JSON API endpoint returning the complete page hierarchy using date-based logic.
    Only includes published pages.
    """
    now = timezone.now()

    from .models import PageVersion

    # Get root pages that have published versions
    published_page_ids = (
        PageVersion.objects.filter(effective_date__lte=now)
        .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        .values_list("page_id", flat=True)
        .distinct()
    )

    root_pages = (
        WebPage.objects.filter(parent__isnull=True, id__in=published_page_ids)
        .select_related("parent")
        .prefetch_related("children")
        .order_by("sort_order")
    )

    serializer = PageHierarchySerializer(
        root_pages, many=True, context={"request": request}
    )

    return JsonResponse({"pages": serializer.data})


def page_search_view(request):
    """
    JSON API endpoint for searching published pages using date-based logic.
    Supports query parameter 'q' for search term.
    """
    query = request.GET.get("q", "").strip()
    if len(query) < 2:
        return JsonResponse({"error": "Query too short", "results": []})

    now = timezone.now()

    from .models import PageVersion

    # Get pages that have published versions
    published_page_ids = (
        PageVersion.objects.filter(effective_date__lte=now)
        .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        .values_list("page_id", flat=True)
        .distinct()
    )

    pages = WebPage.objects.filter(
        Q(title__icontains=query) | Q(description__icontains=query),
        id__in=published_page_ids,
    )[:20]

    results = []
    for page in pages:
        results.append(
            {
                "id": page.id,
                "title": page.title,
                "description": (
                    page.description[:200] + "..."
                    if len(page.description) > 200
                    else page.description
                ),
                "url": page.get_absolute_url(),
                "is_object_page": page.is_object_page(),
                "object_type": (
                    page.linked_object_type if page.is_object_page() else None
                ),
            }
        )

    return JsonResponse({"query": query, "results": results})


def render_widget(request, widget_id):
    """
    Render a specific widget by ID.
    Returns HTML fragment that can be used via HTMX or AJAX.
    """
    # Deprecated after refactor: widgets are stored in PageVersion JSON, not DB
    raise Http404("Widget rendering by numeric ID is no longer supported")


class HostnamePageView(View):
    """
    Hostname-aware catch-all view that resolves pages based on hostname and path.
    Supports multi-site functionality by finding the appropriate root page for
    the request hostname and then resolving the path within that site's hierarchy.
    """

    model = WebPage
    template_name = "webpages/page_detail.html"
    context_object_name = "page"

    def _get_error_page(self, root_page, error_code):
        """
        Get custom error page for the given error code under root page.

        Args:
            root_page: The root page for the current site
            error_code: HTTP error code (e.g., 404, 500)

        Returns:
            WebPage or None if no custom error page exists
        """
        try:
            error_page = WebPage.objects.get(
                parent=root_page, slug=str(error_code), is_deleted=False
            )
            if error_page.is_published():
                return error_page
        except WebPage.DoesNotExist:
            pass
        return None

    def _render_error_page(self, error_page, status_code):
        """
        Render a custom error page with the appropriate HTTP status code.

        Args:
            error_page: The WebPage to render
            status_code: HTTP status code to return

        Returns:
            HttpResponse with the rendered error page
        """
        from django.shortcuts import render
        from .renderers import WebPageRenderer

        # Get the published version
        content = error_page.get_current_published_version()

        if not content:
            # If error page has no published content, fall back to default error
            return None

        effective_layout = error_page.get_effective_layout()

        template_name = (
            effective_layout.template_name
            if effective_layout
            else "webpages/page_detail.html"
        )

        # Build context for error page
        context = {
            "root_page": error_page.parent,  # Parent is the root page
            "current_page": error_page,
            "widgets": content.widgets,
            "layout": effective_layout,
            "theme": error_page.get_effective_theme(),
            "parent": error_page.parent,
            "slug_parts": [str(status_code)],
            "request": self.request,
            "page_data": content.page_data,
            "version_number": content.version_number,
            "status": content.get_publication_status(),
            "is_current": content.is_current_published(),
            "published_at": content.effective_date,
            "published_by": content.created_by,
            "effective_layout": effective_layout,
            "effective_theme": error_page.get_effective_theme(),
            "path_variables": {},
            "error_code": status_code,  # Add error code to context
        }

        # Build widgets_by_slot via renderer
        renderer = WebPageRenderer(request=self.request)
        base_context = renderer._build_base_context(error_page, content, {})
        context["widgets_by_slot"] = renderer._render_widgets_by_slot(
            error_page, content, base_context
        )

        if effective_layout:
            context["slots"] = effective_layout.slot_configuration["slots"]
        else:
            context["slots"] = []

        response = render(self.request, template_name, context)
        response.status_code = status_code
        return response

    def get(self, request, *args, **kwargs):
        """
        Resolve page based on hostname and path with pattern matching support.

        For requests like:
        - example.com/ -> root page for example.com
        - example.com/about/ -> 'about' page under example.com's root
        - example.com/news/my-article/ -> 'news' page with path_pattern capturing 'my-article'
        """
        import re

        # Get hostname from request with validation
        hostname = self.request.get_host().lower()

        # Validate hostname format to prevent host header injection
        # Allow hostname with optional port (e.g., localhost:8000, example.com:443)
        if not re.match(r"^[a-z0-9.-]+(?::[0-9]+)?$", hostname) or ".." in hostname:
            raise Http404("Invalid hostname format")

        # Get the path from the URL
        slug_path = getattr(self, "kwargs", {}).get("slug_path", "")
        slug_parts = (
            [part for part in slug_path.split("/") if part] if slug_path else []
        )

        # Find the root page for this hostname
        root_page = WebPage.get_root_page_for_hostname(hostname)

        if not root_page:
            raise Http404(f"No site configured for hostname: {hostname}")

        # Wrap main logic in try-except to handle 404 errors with custom error pages
        try:
            # Initialize path_variables (will be populated if pattern matching occurs)
            path_variables = {}

            # If no path specified, return the root page
            if not slug_parts:
                current_page = root_page
                remaining_path = ""
            else:
                # NEW: Smart path resolution - find longest matching page path
                current_page, remaining_path = self._resolve_page_with_pattern(
                    root_page, slug_parts
                )

                # If we have a remaining path and the page has a path_pattern_key, extract variables
                if remaining_path and current_page.path_pattern_key:
                    path_variables = self._extract_path_variables(
                        current_page.path_pattern_key, remaining_path
                    )

                    # If pattern doesn't match, it's a 404
                    if path_variables is None:
                        raise Http404(f"Path does not match pattern: {remaining_path}")

            # Get the published version
            content = current_page.get_current_published_version()

            # Handle case where no published version exists
            if not content:
                raise Http404(f"No published content available for this page")

            # Check if page is published and effective
            if not self._is_page_accessible(current_page):
                raise Http404("Page not available")

            effective_layout = current_page.get_effective_layout()

            template_name = (
                effective_layout.template_name
                if effective_layout
                else "webpages/page_detail.html"
            )

            # Build context with path_variables
            widgets = content.widgets
            page_data = content.page_data

            # Get SEO metadata from page_data
            meta_title = (
                page_data.get("meta_title")
                or page_data.get("metaTitle")
                or current_page.title
            )
            meta_description = (
                page_data.get("meta_description")
                or page_data.get("metaDescription")
                or current_page.description
            )

            context = {
                "root_page": root_page,
                "current_page": current_page,
                "widgets": widgets,
                "layout": effective_layout,
                "theme": current_page.get_effective_theme(),
                "parent": current_page.parent,
                "slug_parts": slug_parts,
                "request": request,
                "page_data": page_data,
                "version_number": content.version_number,
                "status": content.get_publication_status(),
                "is_current": content.is_current_published(),
                "published_at": content.effective_date,
                "published_by": content.created_by,
                "effective_layout": effective_layout,
                "effective_theme": current_page.get_effective_theme(),
                "path_variables": path_variables,  # NEW: Add path variables to context
                # SEO metadata
                "meta_title": meta_title,
                "meta_description": meta_description,
                "content": content,  # Add version for SEO tag access
            }

            # Build widgets_by_slot via renderer (new system)
            renderer = WebPageRenderer(request=request)
            # Pass path_variables in the extra context
            base_context = renderer._build_base_context(
                current_page, content, {"path_variables": path_variables}
            )
            context["widgets_by_slot"] = renderer._render_widgets_by_slot(
                current_page, content, base_context
            )

            if effective_layout:
                context["slots"] = effective_layout.slot_configuration["slots"]
            else:
                context["slots"] = []

            return render(request, template_name, context)

        except Http404:
            # Try to render custom 404 error page for this site
            error_page = self._get_error_page(root_page, 404)
            if error_page:
                error_response = self._render_error_page(error_page, 404)
                if error_response:
                    return error_response
            # Re-raise if no custom error page or rendering failed
            raise

    def _is_page_accessible(self, page):
        """Check if page is published and currently accessible using date-based logic"""
        return page.is_published()

    def _resolve_page_with_pattern(self, root_page, slug_parts):
        """
        Resolve page using smart path matching.

        Tries to find the longest matching page path, returning the matched page
        and any remaining path components.

        Args:
            root_page: The root page to start from
            slug_parts: List of path components (e.g., ['news', 'my-article'])

        Returns:
            tuple: (matched_page, remaining_path_string)

        Example:
            For slug_parts=['news', 'my-article']:
            1. Try to find page at /news/my-article/ -> not found
            2. Try to find page at /news/ -> found!
            3. Return (news_page, 'my-article/')
        """
        # Try to match paths from longest to shortest
        current_page = root_page

        for i in range(len(slug_parts), 0, -1):
            # Try to navigate through this subset of slugs
            temp_page = root_page
            found = True

            for j in range(i):
                slug = slug_parts[j]
                try:
                    temp_page = WebPage.objects.select_related("parent").get(
                        slug=slug, parent=temp_page
                    )
                except WebPage.DoesNotExist:
                    found = False
                    break

            if found:
                # We found a matching page at this depth
                current_page = temp_page
                # Calculate remaining path
                remaining_parts = slug_parts[i:]
                remaining_path = (
                    "/".join(remaining_parts) + "/" if remaining_parts else ""
                )
                return current_page, remaining_path

        # No page found in hierarchy
        raise Http404(f"Page not found: /{'/'.join(slug_parts)}/")

    def _extract_path_variables(self, pattern_key, remaining_path):
        """
        Extract variables from remaining path using a registry-based pattern.

        Args:
            pattern_key: Key of the pattern in the registry (e.g., 'news_slug')
            remaining_path: The remaining path to match (e.g., 'my-article/')

        Returns:
            dict: Extracted variables or None if no match (with HTML-escaped values)

        Example:
            pattern_key = "news_slug"
            remaining_path = "my-article/"
            returns: {'slug': 'my-article'}

        Security:
            All extracted path variables are HTML-escaped to prevent XSS attacks.
            This provides defense-in-depth even though Django templates auto-escape by default.
        """
        from .path_pattern_registry import path_pattern_registry
        from django.utils.html import escape
        import logging

        logger = logging.getLogger(__name__)

        # Get the pattern from the registry
        pattern = path_pattern_registry.get_pattern(pattern_key)
        if not pattern:
            logger.error(f"Path pattern '{pattern_key}' not found in registry")
            return None

        # Use the pattern's validate_match method
        try:
            variables = pattern.validate_match(remaining_path)
            if variables:
                # Sanitize path variables to prevent XSS attacks
                # Even though Django templates auto-escape by default, this provides
                # defense-in-depth in case templates use |safe filter or raw rendering
                variables = {
                    key: escape(str(value)) for key, value in variables.items()
                }
            return variables
        except Exception as e:
            logger.error(
                f"Error validating path '{remaining_path}' with pattern '{pattern_key}': {e}"
            )
            return None

    def get_context_data(self, **kwargs):
        """Add layout, theme, widgets, hostname info, and object content to context"""
        context = super().get_context_data(**kwargs)
        page = self.object
        hostname = self.request.get_host().lower()

        # Add hostname and multi-site context
        context["current_hostname"] = hostname
        context["is_root_page"] = page.is_root_page()
        context["site_root_page"] = self._get_site_root_page(page)

        # Get effective layout and theme
        context["effective_layout"] = page.get_effective_layout()
        context["effective_theme"] = page.get_effective_theme()

        # Get widgets organized by slot with inheritance
        context["widgets_by_slot"] = self._get_widgets_by_slot(page)

        # Get breadcrumbs
        context["breadcrumbs"] = page.get_breadcrumbs()

        # If this is an object page, get object content
        if page.is_object_page():
            context["object_content"] = page.get_object_content()
            context["is_object_page"] = True
            context["linked_object"] = {
                "type": page.linked_object_type,
                "id": page.linked_object_id,
            }
        else:
            context["is_object_page"] = False

        return context

    def _get_site_root_page(self, page):
        """Get the root page for the current site"""

        if page.is_root_page():
            return page

        # Walk up the hierarchy to find the root
        current = page
        while current.parent:
            current = current.parent
        return current

    def _get_widgets_by_slot(self, page):
        """Get widgets organized by slot, considering inheritance"""

        # Use renderer + PageVersion JSON to build rendered widgets
        renderer = WebPageRenderer(request=self.request)
        current_version = page.get_current_published_version()
        if not current_version:
            return {}
        base_context = renderer._build_base_context(page, current_version, {})
        return renderer._render_widgets_by_slot(page, current_version, base_context)

    def get_template_names(self):
        """
        Try to find templates in this order:
        1. Hostname-specific layout template
        2. Layout-specific template
        3. Hostname-specific page template
        4. Page-specific template
        5. Default template
        """

        page = self.object
        hostname = self.request.get_host().lower()
        template_names = []

        # Try hostname + layout specific template
        layout = page.get_effective_layout()
        if layout:
            hostname_safe = hostname.replace(".", "_")
            template_names.append(
                f"webpages/sites/{hostname_safe}/layouts/{layout.name.lower()}.html"
            )
            template_names.append(f"webpages/layouts/{layout.name.lower()}.html")

        # Try hostname + page specific template
        hostname_safe = hostname.replace(".", "_")
        template_names.append(f"webpages/sites/{hostname_safe}/pages/{page.slug}.html")
        template_names.append(f"webpages/sites/{hostname_safe}/page_detail.html")

        # Try page-specific template
        template_names.append(f"webpages/pages/{page.slug}.html")

        # Default template
        template_names.append("webpages/page_detail.html")

        return template_names


# Custom Error Handlers for Django
def custom_404_handler(request, exception=None):
    """
    Custom 404 error handler that renders site-specific error pages.

    This handler is called by Django when a 404 occurs outside of the
    normal view processing (e.g., no URL pattern matches).
    """
    import re

    # Get hostname from request
    hostname = request.get_host().lower()

    # Validate hostname format
    if not re.match(r"^[a-z0-9.-]+(?::[0-9]+)?$", hostname) or ".." in hostname:
        # Invalid hostname, use default 404
        from django.views.defaults import page_not_found

        return page_not_found(request, exception)

    # Find the root page for this hostname
    try:
        root_page = WebPage.get_root_page_for_hostname(hostname)
        if root_page:
            # Try to find custom 404 page
            try:
                error_page = WebPage.objects.get(
                    parent=root_page, slug="404", is_deleted=False
                )
                if error_page.is_published():
                    # Render custom 404 page
                    view = HostnamePageView()
                    view.request = request
                    error_response = view._render_error_page(error_page, 404)
                    if error_response:
                        return error_response
            except WebPage.DoesNotExist:
                pass
    except Exception:
        pass

    # Fall back to Django's default 404
    from django.views.defaults import page_not_found

    return page_not_found(request, exception)


def custom_500_handler(request):
    """
    Custom 500 error handler that renders site-specific error pages.

    This handler is called by Django when an unhandled exception occurs.
    """
    import re

    # Get hostname from request
    try:
        hostname = request.get_host().lower()

        # Validate hostname format
        if re.match(r"^[a-z0-9.-]+(?::[0-9]+)?$", hostname) and ".." not in hostname:
            # Find the root page for this hostname
            root_page = WebPage.get_root_page_for_hostname(hostname)
            if root_page:
                # Try to find custom 500 page
                error_page = WebPage.objects.get(
                    parent=root_page, slug="500", is_deleted=False
                )
                if error_page.is_published():
                    # Render custom 500 page
                    view = HostnamePageView()
                    view.request = request
                    error_response = view._render_error_page(error_page, 500)
                    if error_response:
                        return error_response
    except Exception:
        # If anything goes wrong, fall back to default handler
        pass

    # Fall back to Django's default 500
    from django.views.defaults import server_error

    return server_error(request)


def custom_403_handler(request, exception=None):
    """
    Custom 403 error handler that renders site-specific error pages.

    This handler is called by Django when permission is denied.
    """
    import re

    # Get hostname from request
    try:
        hostname = request.get_host().lower()

        # Validate hostname format
        if re.match(r"^[a-z0-9.-]+(?::[0-9]+)?$", hostname) and ".." not in hostname:
            # Find the root page for this hostname
            root_page = WebPage.get_root_page_for_hostname(hostname)
            if root_page:
                # Try to find custom 403 page
                error_page = WebPage.objects.get(
                    parent=root_page, slug="403", is_deleted=False
                )
                if error_page.is_published():
                    # Render custom 403 page
                    view = HostnamePageView()
                    view.request = request
                    error_response = view._render_error_page(error_page, 403)
                    if error_response:
                        return error_response
    except Exception:
        pass

    # Fall back to Django's default 403
    from django.views.defaults import permission_denied

    return permission_denied(request, exception)


def custom_503_handler(request, exception=None):
    """
    Custom 503 error handler that renders site-specific error pages.

    Note: This is not a standard Django error handler, but can be used
    in custom middleware or views when the service is unavailable.
    """
    import re

    # Get hostname from request
    try:
        hostname = request.get_host().lower()

        # Validate hostname format
        if re.match(r"^[a-z0-9.-]+(?::[0-9]+)?$", hostname) and ".." not in hostname:
            # Find the root page for this hostname
            root_page = WebPage.get_root_page_for_hostname(hostname)
            if root_page:
                # Try to find custom 503 page
                error_page = WebPage.objects.get(
                    parent=root_page, slug="503", is_deleted=False
                )
                if error_page.is_published():
                    # Render custom 503 page
                    view = HostnamePageView()
                    view.request = request
                    error_response = view._render_error_page(error_page, 503)
                    if error_response:
                        return error_response
    except Exception:
        pass

    # Fall back to a simple 503 response
    from django.http import HttpResponse

    return HttpResponse(
        "<h1>503 Service Unavailable</h1><p>The service is temporarily unavailable. Please try again later.</p>",
        status=503,
    )


# class HostnameRootView(HostnamePageView):
#     """
#     Special view for handling requests to the domain root (/)
#     based on hostname resolution. Returns the root page for the hostname.
#     """

#     def get_object(self, queryset=None):
#         """Get the root page for the current hostname"""
#         hostname = self.request.get_host().lower()

#         # Find the root page for this hostname
#         root_page = WebPage.get_root_page_for_hostname(hostname)

#         if not root_page:
#             raise Http404(f"No site configured for hostname: {hostname}")

#         # Check if page is published and effective
#         if not self._is_page_accessible(root_page):
#             raise Http404("Root page not available")

#         return root_page
