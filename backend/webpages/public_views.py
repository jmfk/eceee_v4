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
        if not current_version:
            current_version = page.get_latest_published_version()

        # Ensure we have a valid version
        if not current_version:
            raise Http404("No published version available for this page")
        if current_version:
            renderer = WebPageRenderer(request=self.request)
            base_context = renderer._build_base_context(page, current_version, {})
            context["widgets_by_slot"] = renderer._render_widgets_by_slot(
                page, current_version, base_context
            )
        else:
            context["widgets_by_slot"] = {}

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


class NewsDetailView(ObjectDetailView):
    """Detail view for News objects"""

    object_type = "news"

    def get_model(self):
        from content.models import News

        return News

    def get_queryset(self):
        from content.models import News

        return News.objects.filter(is_published=True)


class EventDetailView(ObjectDetailView):
    """Detail view for Event objects"""

    object_type = "event"

    def get_model(self):
        from content.models import Event

        return Event

    def get_queryset(self):
        from content.models import Event

        return Event.objects.filter(is_published=True)


class LibraryItemDetailView(ObjectDetailView):
    """Detail view for LibraryItem objects"""

    object_type = "libraryitem"

    def get_model(self):
        from content.models import LibraryItem

        return LibraryItem

    def get_queryset(self):
        from content.models import LibraryItem

        return LibraryItem.objects.filter(is_published=True, access_level="public")


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


# Object List Views
class NewsListView(ListView):
    """Public list view for News objects"""

    template_name = "content/news_list.html"
    context_object_name = "news_articles"
    paginate_by = 10

    def get_queryset(self):
        from content.models import News

        return News.objects.filter(is_published=True).order_by(
            "-priority", "-published_date"
        )


class EventListView(ListView):
    """Public list view for Event objects"""

    template_name = "content/event_list.html"
    context_object_name = "events"
    paginate_by = 10

    def get_queryset(self):
        from content.models import Event

        return Event.objects.filter(is_published=True).order_by("start_date")


class LibraryItemListView(ListView):
    """Public list view for LibraryItem objects"""

    template_name = "content/library_list.html"
    context_object_name = "library_items"
    paginate_by = 20

    def get_queryset(self):
        from content.models import LibraryItem

        return LibraryItem.objects.filter(
            is_published=True, access_level="public"
        ).order_by("-featured", "-published_date")


class MemberListView(ListView):
    """Public list view for Member objects"""

    template_name = "content/member_list.html"
    context_object_name = "members"
    paginate_by = 20

    def get_queryset(self):
        from content.models import Member

        return Member.objects.filter(
            is_published=True, list_in_directory=True, is_current=True
        ).order_by("last_name", "first_name")


class HostnamePageView(View):
    """
    Hostname-aware catch-all view that resolves pages based on hostname and path.
    Supports multi-site functionality by finding the appropriate root page for
    the request hostname and then resolving the path within that site's hierarchy.
    """

    model = WebPage
    template_name = "webpages/page_detail.html"
    context_object_name = "page"

    def get(self, request, *args, **kwargs):
        """
        Resolve page based on hostname and path.

        For requests like:
        - example.com/ -> root page for example.com
        - example.com/about/ -> 'about' page under example.com's root
        - example.com/about/team/ -> 'team' page under 'about' under example.com's root
        """

        # Get hostname from request with validation
        hostname = self.request.get_host().lower()

        # Validate hostname format to prevent host header injection
        import re

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

        # If no path specified, return the root page
        content = root_page.get_latest_published_version()

        # Handle case where no published version exists
        if not content:
            raise Http404(f"No published content available for this site")

        widgets = content.widgets
        page_data = content.page_data

        context = {
            "root_page": root_page,
            "current_page": root_page,
            "widgets": widgets,
            "layout": root_page.get_effective_layout(),
            "theme": root_page.get_effective_theme(),
            "parent": root_page.parent,
            "slug_parts": slug_parts,
            "request": request,
            "widgets": widgets,
            "page_data": page_data,
            "version_number": content.version_number,
            "status": content.get_publication_status(),
            "is_current": content.is_current_published(),
            "published_at": content.effective_date,
            "published_by": content.created_by,
        }

        if not slug_parts:
            current_page = root_page
        else:
            # First check if the first slug is a direct child of root_page
            first_slug = slug_parts[0]
            if not WebPage.objects.filter(slug=first_slug, parent=root_page).exists():
                raise Http404(f"Page '{first_slug}' not found under site root")

            # Navigate through the hierarchy starting from the root page
            current_page = root_page
            # context["current_hostname"] = hostname
            # context["is_root_page"] = page.is_root_page()
            # context["site_root_page"] = self._get_site_root_page(page)
            # # Get effective layout and theme
            # context["effective_layout"] = page.get_effective_layout()
            # context["effective_theme"] = page.get_effective_theme()
            # # Get widgets organized by slot with inheritance
            # context["widgets_by_slot"] = self._get_widgets_by_slot(page)
            # # Get breadcrumbs
            # context["breadcrumbs"] = page.get_breadcrumbs()
            # # If this is an object page, get object content
            # if page.is_object_page():
            #     context["object_content"] = page.get_object_content()
            #     context["is_object_page"] = True
            #     context["linked_object"] = {
            #         "type": page.linked_object_type,
            #         "id": page.linked_object_id,
            #     }
            # else:
            #     context["is_object_page"] = False

            for slug in slug_parts:
                try:
                    current_page = WebPage.objects.select_related("parent").get(
                        slug=slug, parent=current_page
                    )
                    content = current_page.get_latest_published_version()

                    # Handle case where no published version exists
                    if not content:
                        raise Http404(
                            f"No published content available for page: {slug}"
                        )

                    widgets = content.widgets
                    page_data = content.page_data
                    context["current_page"] = current_page
                    context["widgets"] = widgets
                    context["page_data"] = page_data
                    context["version_number"] = content.version_number
                    context["status"] = content.get_publication_status()
                    context["is_current"] = content.is_current_published()
                    context["published_at"] = content.effective_date
                    context["published_by"] = content.created_by
                    context["layout"] = current_page.get_effective_layout()
                    context["theme"] = current_page.get_effective_theme()
                    context["parent"] = current_page.parent
                except WebPage.DoesNotExist:
                    raise Http404(f"Page not found: /{'/'.join(slug_parts)}/")

        # Check if page is published and effective
        if not self._is_page_accessible(current_page):
            raise Http404("Page not available")

        effective_layout = current_page.get_effective_layout()

        template_name = (
            effective_layout.template_name
            if effective_layout
            else "webpages/page_detail.html"
        )

        # Ensure effective layout, theme, and widgets_by_slot are present in context
        context["effective_layout"] = effective_layout
        context["effective_theme"] = current_page.get_effective_theme()

        # Build widgets_by_slot via renderer (new system)
        renderer = WebPageRenderer(request=request)
        base_context = renderer._build_base_context(current_page, content, {})
        context["widgets_by_slot"] = renderer._render_widgets_by_slot(
            current_page, content, base_context
        )

        if effective_layout:
            context["slots"] = effective_layout.slot_configuration["slots"]
        else:
            context["slots"] = []

        # debug

        return render(request, template_name, context)

    def _is_page_accessible(self, page):
        """Check if page is published and currently accessible using date-based logic"""
        return page.is_published()

    def get_context_data(self, **kwargs):
        """Add layout, theme, widgets, hostname info, and object content to context"""
        # debug
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
        current_version = (
            page.get_current_published_version() or page.get_latest_published_version()
        )
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
