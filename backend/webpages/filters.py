"""
Django filters for the Web Page Publishing System

Provides advanced filtering capabilities for API endpoints including
hierarchical filtering, date ranges, and publication status filtering.
"""

import django_filters
from django.db.models import Q
from django.utils import timezone
from .models import WebPage, PageVersion, PageTheme, WidgetType


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

    # Publication filters
    publication_status = django_filters.ChoiceFilter(
        choices=WebPage.PUBLICATION_STATUS_CHOICES
    )
    is_published = django_filters.BooleanFilter(method="filter_is_published")
    published_between = django_filters.DateFromToRangeFilter(
        field_name="effective_date"
    )
    expires_between = django_filters.DateFromToRangeFilter(field_name="expiry_date")
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

    # Object publishing filters
    linked_object_type = django_filters.CharFilter(lookup_expr="iexact")
    has_linked_object = django_filters.BooleanFilter(method="filter_has_linked_object")

    # SEO filters
    has_meta_title = django_filters.BooleanFilter(method="filter_has_meta_title")
    has_meta_description = django_filters.BooleanFilter(
        method="filter_has_meta_description"
    )

    class Meta:
        model = WebPage
        fields = {
            "sort_order": ["exact", "lt", "lte", "gt", "gte"],
            "linked_object_id": ["exact", "isnull"],
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
        """Filter pages based on current publication status"""
        now = timezone.now()

        if value:
            return queryset.filter(
                publication_status="published", effective_date__lte=now
            ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        else:
            return queryset.exclude(
                publication_status="published", effective_date__lte=now
            ).exclude(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))

    def filter_active_on_date(self, queryset, name, value):
        """Filter pages that were/will be active on a specific date"""
        return queryset.filter(
            publication_status="published", effective_date__lte=value
        ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=value))

    def filter_has_linked_object(self, queryset, name, value):
        """Filter pages that have or don't have linked objects"""
        if value:
            return (
                queryset.filter(
                    linked_object_type__isnull=False, linked_object_id__isnull=False
                )
                .exclude(linked_object_type="")
                .exclude(linked_object_id=0)
            )
        else:
            return queryset.filter(
                Q(linked_object_type__isnull=True)
                | Q(linked_object_type="")
                | Q(linked_object_id__isnull=True)
                | Q(linked_object_id=0)
            )

    def filter_has_meta_title(self, queryset, name, value):
        """Filter pages that have or don't have meta titles"""
        if value:
            return queryset.exclude(meta_title="").exclude(meta_title__isnull=True)
        else:
            return queryset.filter(Q(meta_title="") | Q(meta_title__isnull=True))

    def filter_has_meta_description(self, queryset, name, value):
        """Filter pages that have or don't have meta descriptions"""
        if value:
            return queryset.exclude(meta_description="").exclude(
                meta_description__isnull=True
            )
        else:
            return queryset.filter(
                Q(meta_description="") | Q(meta_description__isnull=True)
            )


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
    is_current = django_filters.BooleanFilter()

    # Status filters
    status = django_filters.ChoiceFilter(choices=PageVersion.VERSION_STATUS_CHOICES)
    status_in = django_filters.MultipleChoiceFilter(
        field_name="status",
        choices=PageVersion.VERSION_STATUS_CHOICES,
        lookup_expr="in",
    )

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

    # Published date filters
    published_after = django_filters.DateTimeFilter(
        field_name="published_at", lookup_expr="gte"
    )
    published_before = django_filters.DateTimeFilter(
        field_name="published_at", lookup_expr="lte"
    )
    published_on_date = django_filters.DateFilter(
        field_name="published_at", lookup_expr="date"
    )
    is_published = django_filters.BooleanFilter(method="filter_is_published")

    # User filters
    created_by = django_filters.CharFilter(
        field_name="created_by__username", lookup_expr="icontains"
    )
    published_by = django_filters.CharFilter(
        field_name="published_by__username", lookup_expr="icontains"
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
        """Filter versions that are published or not"""
        if value:
            return queryset.filter(status="published")
        else:
            return queryset.exclude(status="published")

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
        """Filter to show only draft versions"""
        if value:
            return queryset.filter(status="draft")
        return queryset

    def filter_published_only(self, queryset, name, value):
        """Filter to show only published versions"""
        if value:
            return queryset.filter(status="published")
        return queryset

    def filter_current_versions_only(self, queryset, name, value):
        """Filter to show only current versions"""
        if value:
            return queryset.filter(is_current=True)
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


class WidgetTypeFilter(django_filters.FilterSet):
    """Filtering for WidgetType queryset"""

    name = django_filters.CharFilter(lookup_expr="icontains")
    description = django_filters.CharFilter(lookup_expr="icontains")
    template_name = django_filters.CharFilter(lookup_expr="icontains")
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
        model = WidgetType
        fields = []

    def filter_in_use(self, queryset, name, value):
        """Filter widget types that are or aren't in use by page widgets"""
        if value:
            return queryset.filter(pagewidget__isnull=False).distinct()
        else:
            return queryset.filter(pagewidget__isnull=True)
