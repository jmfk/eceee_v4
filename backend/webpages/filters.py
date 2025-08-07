"""
Django filters for the Web Page Publishing System

Provides advanced filtering capabilities for API endpoints including
hierarchical filtering, date ranges, and publication status filtering.
"""

import django_filters
from django.db.models import Q
from django.utils import timezone
from .models import WebPage, PageVersion, PageTheme


class WebPageFilter(django_filters.FilterSet):
    """Advanced filtering for WebPage queryset"""

    # Basic filters
    title = django_filters.CharFilter(lookup_expr="icontains")
    slug = django_filters.CharFilter(lookup_expr="icontains")
    description = django_filters.CharFilter(lookup_expr="icontains")

    # Hierarchy filters
    parent = django_filters.ModelChoiceFilter(queryset=WebPage.objects.all())
    parent_isnull = django_filters.BooleanFilter(
        field_name="parent", lookup_expr="isnull"
    )
    has_children = django_filters.BooleanFilter(method="filter_has_children")
    depth_level = django_filters.NumberFilter(method="filter_depth_level")

    # Publication filters (date-based)
    is_published = django_filters.BooleanFilter(method="filter_is_published")
    active_on_date = django_filters.DateFilter(method="filter_active_on_date")

    # Layout and theme filters (layout removed - now using code-based layouts)
    code_layout = django_filters.CharFilter(lookup_expr="icontains")
    theme = django_filters.ModelChoiceFilter(queryset=PageTheme.objects.all())
    theme_isnull = django_filters.BooleanFilter(
        field_name="theme", lookup_expr="isnull"
    )

    # Date filters
    created_after = django_filters.DateTimeFilter(
        field_name="created_at", lookup_expr="gte"
    )
    created_before = django_filters.DateTimeFilter(
        field_name="created_at", lookup_expr="lte"
    )
    updated_after = django_filters.DateTimeFilter(
        field_name="updated_at", lookup_expr="gte"
    )
    updated_before = django_filters.DateTimeFilter(
        field_name="updated_at", lookup_expr="lte"
    )

    # User filters
    created_by = django_filters.CharFilter(
        field_name="created_by__username", lookup_expr="icontains"
    )
    modified_by = django_filters.CharFilter(
        field_name="last_modified_by__username", lookup_expr="icontains"
    )

    # SEO filters
    has_meta_title = django_filters.BooleanFilter(method="filter_has_meta_title")
    has_meta_description = django_filters.BooleanFilter(
        method="filter_has_meta_description"
    )

    class Meta:
        model = WebPage
        fields = {
            "sort_order": ["exact", "lt", "lte", "gt", "gte"],
        }

    def filter_has_children(self, queryset, name, value):
        """Filter pages that have or don't have children"""
        if value:
            return queryset.filter(children__isnull=False).distinct()
        else:
            return queryset.filter(children__isnull=True)

    def filter_depth_level(self, queryset, name, value):
        """Filter pages at a specific depth level (0=root, 1=first level, etc.)"""
        if value == 0:
            return queryset.filter(parent__isnull=True)
        elif value == 1:
            return queryset.filter(parent__isnull=False, parent__parent__isnull=True)
        elif value == 2:
            return queryset.filter(
                parent__isnull=False,
                parent__parent__isnull=False,
                parent__parent__parent__isnull=True,
            )
        # For deeper levels, we'd need raw SQL or recursive queries
        return queryset

    def filter_is_published(self, queryset, name, value):
        """Filter pages based on current publication status using date-based logic"""
        from django.db.models import Exists, OuterRef

        now = timezone.now()

        # Subquery to check if page has published versions
        published_version_exists = PageVersion.objects.filter(
            page=OuterRef("pk"), effective_date__lte=now
        ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))

        if value:
            return queryset.filter(Exists(published_version_exists))
        else:
            return queryset.exclude(Exists(published_version_exists))

    def filter_active_on_date(self, queryset, name, value):
        """Filter pages that were/will be active on a specific date using date-based logic"""
        from django.db.models import Exists, OuterRef

        # Subquery to check if page has versions active on the specified date
        active_version_exists = PageVersion.objects.filter(
            page=OuterRef("pk"), effective_date__lte=value
        ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=value))

        return queryset.filter(Exists(active_version_exists))

    def filter_has_meta_title(self, queryset, name, value):
        """Filter pages that have or don't have meta titles"""
        from django.db.models import Exists, OuterRef

        if value:
            # Pages with non-empty meta_title in their latest version
            has_meta_title = (
                PageVersion.objects.filter(page=OuterRef("pk"))
                .order_by("-version_number")
                .filter(page_data__meta_title__isnull=False)
                .exclude(page_data__meta_title="")[:1]
            )
            return queryset.filter(Exists(has_meta_title))
        else:
            # Pages without meta_title or with empty meta_title
            has_meta_title = (
                PageVersion.objects.filter(page=OuterRef("pk"))
                .order_by("-version_number")
                .filter(page_data__meta_title__isnull=False)
                .exclude(page_data__meta_title="")[:1]
            )
            return queryset.exclude(Exists(has_meta_title))

    def filter_has_meta_description(self, queryset, name, value):
        """Filter pages that have or don't have meta descriptions"""
        from django.db.models import Exists, OuterRef

        if value:
            # Pages with non-empty meta_description in their latest version
            has_meta_description = (
                PageVersion.objects.filter(page=OuterRef("pk"))
                .order_by("-version_number")
                .filter(page_data__meta_description__isnull=False)
                .exclude(page_data__meta_description="")[:1]
            )
            return queryset.filter(Exists(has_meta_description))
        else:
            # Pages without meta_description or with empty meta_description
            has_meta_description = (
                PageVersion.objects.filter(page=OuterRef("pk"))
                .order_by("-version_number")
                .filter(page_data__meta_description__isnull=False)
                .exclude(page_data__meta_description="")[:1]
            )
            return queryset.exclude(Exists(has_meta_description))


class PageVersionFilter(django_filters.FilterSet):
    """Advanced filtering for PageVersion queryset with workflow support"""

    # Page filters
    page = django_filters.ModelChoiceFilter(queryset=WebPage.objects.all())
    page_title = django_filters.CharFilter(
        field_name="page__title", lookup_expr="icontains"
    )
    page_slug = django_filters.CharFilter(
        field_name="page__slug", lookup_expr="icontains"
    )

    # Version filters
    version_number = django_filters.NumberFilter()
    version_number_gte = django_filters.NumberFilter(
        field_name="version_number", lookup_expr="gte"
    )
    version_number_lte = django_filters.NumberFilter(
        field_name="version_number", lookup_expr="lte"
    )

    # Publication filters (removed - effective_date and expiry_date are on PageVersion, not WebPage)

    # Date filters
    created_after = django_filters.DateTimeFilter(
        field_name="created_at", lookup_expr="gte"
    )
    created_before = django_filters.DateTimeFilter(
        field_name="created_at", lookup_expr="lte"
    )
    created_on_date = django_filters.DateFilter(
        field_name="created_at", lookup_expr="date"
    )

    is_published = django_filters.BooleanFilter(method="filter_is_published")

    # User filters
    created_by = django_filters.CharFilter(
        field_name="created_by__username", lookup_expr="icontains"
    )

    # Content filters
    description = django_filters.CharFilter(lookup_expr="icontains")
    has_description = django_filters.BooleanFilter(method="filter_has_description")
    has_change_summary = django_filters.BooleanFilter(
        method="filter_has_change_summary"
    )

    # Time range filters
    created_this_week = django_filters.BooleanFilter(method="filter_created_this_week")
    created_this_month = django_filters.BooleanFilter(
        method="filter_created_this_month"
    )
    created_today = django_filters.BooleanFilter(method="filter_created_today")

    # Workflow filters
    drafts_only = django_filters.BooleanFilter(method="filter_drafts_only")
    published_only = django_filters.BooleanFilter(method="filter_published_only")
    current_versions_only = django_filters.BooleanFilter(
        method="filter_current_versions_only"
    )

    class Meta:
        model = PageVersion
        fields = []

    def filter_has_description(self, queryset, name, value):
        """Filter versions that have or don't have descriptions"""
        if value:
            return queryset.exclude(description="").exclude(description__isnull=True)
        else:
            return queryset.filter(Q(description="") | Q(description__isnull=True))

    def filter_created_this_week(self, queryset, name, value):
        """Filter versions created this week"""
        if not value:
            return queryset

        now = timezone.now()
        week_start = now - timezone.timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

        return queryset.filter(created_at__gte=week_start)

    def filter_created_this_month(self, queryset, name, value):
        """Filter versions created this month"""
        if not value:
            return queryset

        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        return queryset.filter(created_at__gte=month_start)

    def filter_created_today(self, queryset, name, value):
        """Filter versions created today"""
        if not value:
            return queryset

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        return queryset.filter(created_at__gte=today_start)

    def filter_is_published(self, queryset, name, value):
        """Filter versions that are published or not using date-based logic"""
        now = timezone.now()

        if value:
            return queryset.filter(effective_date__lte=now).filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gt=now)
            )
        else:
            return queryset.exclude(effective_date__lte=now).exclude(
                Q(expiry_date__isnull=True) | Q(expiry_date__gt=now)
            )

    def filter_has_change_summary(self, queryset, name, value):
        """Filter versions that have or don't have change summaries"""
        if value:
            return queryset.exclude(change_summary={}).exclude(
                change_summary__isnull=True
            )
        else:
            return queryset.filter(
                Q(change_summary={}) | Q(change_summary__isnull=True)
            )

    def filter_drafts_only(self, queryset, name, value):
        """Filter to show only draft versions (no effective_date)"""
        if value:
            return queryset.filter(effective_date__isnull=True)
        return queryset

    def filter_published_only(self, queryset, name, value):
        """Filter to show only published versions using date-based logic"""
        if value:
            now = timezone.now()
            return queryset.filter(effective_date__lte=now).filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gt=now)
            )
        return queryset

    def filter_current_versions_only(self, queryset, name, value):
        """Filter to show only current published versions using date-based logic"""
        if value:
            now = timezone.now()
            # Get the latest published version for each page
            # This is complex with queryset filtering, so we'll use a simpler approach
            current_version_ids = []

            for version in (
                queryset.filter(effective_date__lte=now)
                .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
                .select_related("page")
            ):
                current_published = version.page.get_current_published_version(now)
                if current_published and current_published.id == version.id:
                    current_version_ids.append(version.id)

            return queryset.filter(id__in=current_version_ids)
        return queryset


# PageLayoutFilter removed - now using code-based layouts only


class PageThemeFilter(django_filters.FilterSet):
    """Filtering for PageTheme queryset"""

    name = django_filters.CharFilter(lookup_expr="icontains")
    description = django_filters.CharFilter(lookup_expr="icontains")
    is_active = django_filters.BooleanFilter()
    created_by = django_filters.CharFilter(
        field_name="created_by__username", lookup_expr="icontains"
    )

    # Date filters
    created_after = django_filters.DateTimeFilter(
        field_name="created_at", lookup_expr="gte"
    )
    created_before = django_filters.DateTimeFilter(
        field_name="created_at", lookup_expr="lte"
    )

    # Usage filters
    in_use = django_filters.BooleanFilter(method="filter_in_use")

    class Meta:
        model = PageTheme
        fields = []

    def filter_in_use(self, queryset, name, value):
        """Filter themes that are or aren't in use by pages"""
        if value:
            return queryset.filter(webpage__isnull=False).distinct()
        else:
            return queryset.filter(webpage__isnull=True)


# WidgetTypeFilter removed - widget types are now code-based
