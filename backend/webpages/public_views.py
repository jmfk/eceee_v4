"""
Public views for the Web Page Publishing System

Handles public display of published pages with slug-based URL resolution
and hierarchical navigation support.
"""

from django.shortcuts import get_object_or_404, render
from django.http import Http404, HttpResponse, JsonResponse
from django.views.generic import DetailView, ListView
from django.utils import timezone
from django.db.models import Q
from django.template.loader import get_template
from django.template import TemplateDoesNotExist

from .models import WebPage, PageWidget
from .serializers import WebPageDetailSerializer, PageHierarchySerializer


class PublishedPageMixin:
    """Mixin to filter only published pages"""

    def get_queryset(self):
        now = timezone.now()
        return (
            WebPage.objects.filter(
                publication_status="published", effective_date__lte=now
            )
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
            .select_related("parent", "layout", "theme")
            .prefetch_related("widgets__widget_type")
        )


class PageDetailView(PublishedPageMixin, DetailView):
    """
    Display a single published page by its full slug path.
    Supports hierarchical URLs like /parent/child/grandchild/
    """

    model = WebPage
    template_name = "webpages/page_detail.html"
    context_object_name = "page"

    def get_object(self, queryset=None):
        """Get page by resolving the full slug path"""
        if queryset is None:
            queryset = self.get_queryset()

        # Get the full path from URL
        slug_path = self.kwargs.get("slug_path", "")
        if not slug_path:
            # Handle root page request
            return get_object_or_404(queryset, slug="home", parent__isnull=True)

        # Split the path into slugs
        slugs = [slug for slug in slug_path.split("/") if slug]

        if not slugs:
            raise Http404("Page not found")

        # Navigate through the hierarchy
        current_page = None
        current_parent = None

        for i, slug in enumerate(slugs):
            try:
                if i == 0:
                    # First level - find root page
                    current_page = queryset.get(slug=slug, parent__isnull=True)
                else:
                    # Subsequent levels - find child of current parent
                    current_page = queryset.get(slug=slug, parent=current_parent)

                current_parent = current_page

            except WebPage.DoesNotExist:
                raise Http404(f"Page not found: {'/'.join(slugs[:i+1])}")

        return current_page

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        page = self.object

        # Add breadcrumbs
        context["breadcrumbs"] = page.get_breadcrumbs()

        # Add navigation
        context["children"] = page.children.filter(
            publication_status="published"
        ).order_by("sort_order", "title")

        # Add effective layout and theme
        context["effective_layout"] = page.get_effective_layout()
        context["effective_theme"] = page.get_effective_theme()

        # Add widgets organized by slot
        widgets_by_slot = {}
        current = page

        # Collect widgets from current page and parents (inheritance)
        inherited_widgets = {}
        while current:
            for widget in current.widgets.all().order_by("sort_order"):
                slot_name = widget.slot_name

                # If this is the original page or widget allows inheritance
                if current == page or widget.inherit_from_parent:
                    # If slot doesn't exist yet, or this is an override
                    if slot_name not in inherited_widgets or (
                        current == page and widget.override_parent
                    ):

                        if slot_name not in inherited_widgets:
                            inherited_widgets[slot_name] = []

                        # Add widget info
                        widget_data = {
                            "widget": widget,
                            "inherited_from": current if current != page else None,
                            "is_override": widget.override_parent,
                        }

                        # Insert or replace based on override
                        if widget.override_parent:
                            inherited_widgets[slot_name] = [widget_data]
                        else:
                            inherited_widgets[slot_name].append(widget_data)

            current = current.parent

        context["widgets_by_slot"] = inherited_widgets

        # Add meta information
        context["meta_title"] = page.meta_title or page.title
        context["meta_description"] = page.meta_description or page.description
        context["meta_keywords"] = page.meta_keywords

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
    """List view for published pages"""

    model = WebPage
    template_name = "webpages/page_list.html"
    context_object_name = "pages"
    paginate_by = 20

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by parent if specified
        parent_slug = getattr(self, "kwargs", {}).get("parent_slug")
        if parent_slug:
            try:
                parent = WebPage.objects.get(slug=parent_slug, parent__isnull=True)
                queryset = queryset.filter(parent=parent)
            except WebPage.DoesNotExist:
                queryset = queryset.none()
        else:
            # Show only root pages
            queryset = queryset.filter(parent__isnull=True)

        return queryset.order_by("sort_order", "title")


def page_sitemap_view(request):
    """Generate XML sitemap for published pages"""
    from django.template.loader import render_to_string

    now = timezone.now()
    pages = (
        WebPage.objects.filter(publication_status="published", effective_date__lte=now)
        .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        .order_by("sort_order", "title")
    )

    sitemap_xml = render_to_string(
        "webpages/sitemap.xml",
        {
            "pages": pages,
            "request": request,
        },
    )

    return HttpResponse(sitemap_xml, content_type="application/xml")


def page_hierarchy_api(request):
    """JSON API for page hierarchy (public pages only)"""
    now = timezone.now()
    root_pages = (
        WebPage.objects.filter(
            publication_status="published", effective_date__lte=now, parent__isnull=True
        )
        .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        .order_by("sort_order", "title")
    )

    serializer = PageHierarchySerializer(
        root_pages, many=True, context={"request": request}
    )
    return JsonResponse({"pages": serializer.data})


def page_search_view(request):
    """Search published pages"""
    query = request.GET.get("q", "").strip()
    pages = []

    if query and len(query) >= 3:  # Minimum 3 characters
        now = timezone.now()
        pages = (
            WebPage.objects.filter(
                publication_status="published", effective_date__lte=now
            )
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
            .filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(meta_title__icontains=query)
                | Q(meta_description__icontains=query)
            )
            .order_by("sort_order", "title")[:20]
        )  # Limit results

    if request.headers.get("Accept") == "application/json":
        # Return JSON for AJAX requests
        results = []
        for page in pages:
            results.append(
                {
                    "id": page.id,
                    "title": page.title,
                    "url": page.get_absolute_url(),
                    "description": (
                        page.description[:200] + "..."
                        if len(page.description) > 200
                        else page.description
                    ),
                }
            )
        return JsonResponse({"results": results, "query": query})

    # Return HTML template
    return render(
        request,
        "webpages/search_results.html",
        {"pages": pages, "query": query, "total_results": len(pages)},
    )


def render_widget(request, widget_id):
    """Render a single widget (useful for AJAX updates)"""
    try:
        widget = PageWidget.objects.select_related("widget_type", "page").get(
            id=widget_id
        )

        # Check if page is published
        if not widget.page.is_published():
            raise Http404("Widget not found")

        # Try to find specific template for widget type
        template_names = [
            f"webpages/widgets/{widget.widget_type.template_name}",
            f"webpages/widgets/{widget.widget_type.name.lower()}.html",
            "webpages/widgets/default.html",
        ]

        context = {
            "widget": widget,
            "config": widget.configuration,
            "page": widget.page,
        }

        for template_name in template_names:
            try:
                template = get_template(template_name)
                return HttpResponse(template.render(context, request))
            except TemplateDoesNotExist:
                continue

        # Fallback to simple display
        return HttpResponse(f"<div>Widget: {widget.widget_type.name}</div>")

    except PageWidget.DoesNotExist:
        raise Http404("Widget not found")
